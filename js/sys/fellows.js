/* fellows.js：AI 虛擬道友系統（契約 §10/§11，本遊戲靈魂）——純邏輯，無 DOM 依賴
 *
 * ============================ UI 對接面（供 ui 層調用的全部接口） ============================
 * 查詢：
 *   XG.sys.fellows.list()            → [{uid,name,persona,personaName,school,schoolName,schoolIcon,
 *                                        rootName,realmIdx,layer,realmName,state,favor,relation,
 *                                        power,reincarn,canDiscuss,lastNews}]  按好感>境界排序
 *   XG.sys.fellows.get(uid)          → 單個道友詳情（同上結構 + talent/stateUntil/gifts/metAt/lastNews），無則 null
 *   XG.sys.fellows.count()           → {total, friend, rival, partner}
 *   XG.sys.fellows.listHelp()        → [{hid,uid,name,text,kind,id,n,itemName,icon,done}]  當前一波求助（done:0待處理 1已助 -1已拒）
 *   XG.sys.fellows.market()          → {unlocked, refreshAt, nextInSec, slots:[{sid,uid,sellerName,persona,
 *                                        kind,id,baseId,grade,n,name,icon,price,cur,curName,sold,line}]}  坊市貨欄
 *   XG.sys.fellows.partnerInfo()     → null | {uid,name,realmName,canDual}  道侶狀態
 *   XG.sys.fellows.canDiscuss(uid)   → bool
 * 操作（均返回 {ok, msg, ...}，ok=false 時 msg 為失敗原因，可直接 toast）：
 *   XG.sys.fellows.discuss(uid)      → {ok,msg,text,cult,favor}      論道（每友10分鐘冷卻：+修為+好感+性格文案）
 *   XG.sys.fellows.discussAll()      → {ok,msg,count,cult}           一鍵論道（與全部冷卻完畢的道友依次煮茶）
 *   XG.sys.fellows.satisfyHelp(hid)  → {ok,msg,text,gift}            滿足求助（扣資源，好感+10+回贈）
 *   XG.sys.fellows.refuseHelp(hid)   → {ok,msg,text}                 拒絕求助（refuse 池文案，無懲罰）
 *   XG.sys.fellows.buyMarket(sid)    → {ok,msg}                      坊市購買（耗靈石/靈玉，每格限量）
 *   XG.sys.fellows.refreshMarket()   → {ok,msg}                      每日五次遞增費用換新坊市
 *   XG.sys.fellows.becomePartner(uid)→ {ok,msg}                      結緣道侶（好感=100，每日限1次操作）
 *   XG.sys.fellows.dualCultivate()   → {ok,msg,cult}                 每小時雙修一次（修為加成）
 * 屬性聚合：getMods() → 道侶在世時 {cultRatePct:10}
 *
 * ============================ 寫入的 stats 鍵（XG.state.stats，snake） ============================
 *   news_count        本系統產生的傳聞條數（check.k: newsCount）
 *   help_fellow       累計幫助道友次數（check.k: helpFellow）
 *   fellow_favor_max  道友好感歷史峯值（check.k: fellowFavorMax）
 *   fellow_partner    已結道侶（0/1）（check.k: fellowPartner）
 *   discuss_count     累計論道次數（修行錄「結交道友」目標統計口徑）
 *
 * ============================ 事件 ============================
 * emit：fellow:gift {uid,persona,ouhuang}（回贈禮；ouhuang=true 即 3% 隱藏功法機緣，gongfa 系統據此解鎖 gf_hongyun）
 *       fellow:helped {uid} ｜ fellow:partner {uid} ｜ fellow:news {uid,text,imp,t}（契約 §4 道友大事件）
 *       news（經內部 pushNews，同時落 state.news）
 * 訂閱：realm:break {realmIdx,ok}（玩家高光播報+摯友賀禮）｜ forge:done {uid,grade}（grade4 神裝播報）
 *       tower:clear {layer}（33 倍數層播報）
 *
 * ============================ offline 行為 ============================
 * offline(dt)：按 5 分鐘一步循環模擬全部道友成長/突破/卡關/渡劫/轉世/隨機動態；
 *   傳聞不逐條入 state.news，壓縮為「總條數+≤3 條要聞樣本」經報告片段 fellowNews 返回（契約 §8 彈窗展示）；
 *   坊市按實際流逝時間補刷新；週報/關係判定同步推進。
 *
 * ============================ 隱藏內容 ============================
 *   歐皇道友求助被滿足後有 3% 概率贈出隱藏功法機緣（emit fellow:gift{ouhuang:true} → gf_hongyun 鴻運通寶錄）；
 *   歐皇坊市貨欄 8% 概率刷出超一階的貨而售價不變（world.marketRules 坊市傳聞）；
 *   彩蛋名道友（韓立/葉凡等）好感滿可被成就統計器識別（fellowEggFavorMax）。
 * ===================================================================================== */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  /* ---------------- 常量 ---------------- */
  const STEP_SEC = 300;               // 成長步進：遊戲內 5 分鐘一步（online/offline 同路徑）
  const STEP_NEWS_MAX = 3;            // 每步最多播報 2~3 條（採樣剋制）
  const STUCK_H = [6, 48];            // 卡關時長區間（小時）
  const SURGE_SEC = 7200;             // 頓悟（surge）持續 2 小時
  const SURGE_MULT = 3;               // 頓悟期間成長倍率
  const FAVOR_FRIEND = 60;            // 摯友門檻
  const FAVOR_PARTNER = 100;          // 道侶門檻
  const RIVAL_CAP = 3;                // 宿敵數量上限
  const HELP_ROLL_MS = 4 * 3600000;   // 求助重搖間隔（每 4 小時一波）
  const HELP_PER_ROLL = [1, 3];       // 每波求助道友數區間
  const DISCUSS_CD_MS = 600000;       // 論道冷卻（每友 10 分鐘）
  const DUAL_CD_MS = 3600000;         // 雙修冷卻（1 小時）
  const OUHUANG_GIFT_P = 0.03;        // 歐皇回贈隱藏功法概率
  const OUHUANG_SLOT_P = 0.08;        // 歐皇貨欄超階概率
  const HILIGHT_GAP_MS = 45000;       // 玩家高光播報最小間隔

  /* ---------------- 內部小工具 ---------------- */
  function U() { return XG.util; }
  function S() { return XG.state; }
  function stats() { XG.state.stats = XG.state.stats || {}; return XG.state.stats; }
  function bumpStat(k, n) { const s = stats(); s[k] = (s[k] || 0) + (n == null ? 1 : n); }
  function maxStat(k, v) { const s = stats(); if (!(s[k] >= v)) s[k] = v; }
  function dayStr() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  // 傳聞統一出口：落 state.news（NEWS_CAP 截斷）+ 廣播；fellow 類同步發 fellow:news（契約 §4）
  function pushNews(cat, text, imp, uid) {
    const n = { t: Date.now(), cat: cat, text: text, imp: imp || 0 };
    const arr = S().news = S().news || [];
    arr.unshift(n);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (arr.length > cap) arr.length = cap;
    bumpStat('news_count');
    XG.bus.emit('news', n);
    if (cat === 'fellow') XG.bus.emit('fellow:news', { uid: uid || '', text: text, imp: imp || 0, t: n.t });
  }

  // 給其他系統發修為（守則 §5：防禦性降級）
  function giveCult(n, src) {
    n = Math.max(0, Math.floor(n));
    if (!n) return 0;
    XG.balance.applyActivityToxicity(n);
    const c = XG.sys.cultivation;
    if (c && typeof c.addCult === 'function') c.addCult(n, src);
    else { S().player.cult = (S().player.cult || 0) + n; XG.bus.emit('res:changed'); }
    return n;
  }

  /* ---------------- 數據查詢 ---------------- */
  function personas() { return (XG.data.fellows && XG.data.fellows.personas) || []; }
  function schools() { return (XG.data.fellows && XG.data.fellows.schools) || []; }
  function lines() { return (XG.data.fellows && XG.data.fellows.lines) || {}; }
  function roots() { return (XG.data.gongfa && XG.data.gongfa.roots) || []; }
  function personaOf(f) { const ps = personas(); for (const p of ps) if (p.id === f.persona) return p; return ps[0] || { id: '?', name: '未知', growth: [1, 1], favorGain: 1, pricePct: 1, giftW: 1, w: 1 }; }
  function schoolOf(f) { const ss = schools(); for (const s of ss) if (s.id === f.school) return s; return ss[0] || { id: '?', name: '散修', icon: '修' }; }
  function rootOf(f) { const rs = roots(); for (const r of rs) if (r.id === f.root) return r; return { id: f.root, name: '靈根', mult: 1, w: 1 }; }
  function realmName(realmIdx, layer) {
    const r = XG.cfg.REALMS[realmIdx] || XG.cfg.REALMS[0];
    return r.name + (realmIdx >= XG.cfg.REALMS.length - 1 ? '' : layer + '層');
  }
  function findFellow(uid) {
    const fs = S().fellows || [];
    for (const f of fs) if (f.uid === uid) return f;
    return null;
  }

  // 文案佔位符替換：{name} {realm} {item} {map} {layer}
  function fill(tpl, f, extra) {
    const u = U();
    let s = String(tpl || '');
    const map = extra && extra.map ? extra.map : u.pick(mapNames());
    const item = extra && extra.item ? extra.item : u.pick(itemNames());
    s = s.split('{name}').join(extra && extra.name ? extra.name : (f && f.name ? f.name : '某位道友'));
    s = s.split('{realm}').join(extra && extra.realm ? extra.realm : (f ? realmName(f.realmIdx, f.layer) : '此境'));
    s = s.split('{layer}').join(String(extra && extra.layer ? extra.layer : (f ? f.layer : 1)));
    s = s.split('{map}').join(map);
    s = s.split('{item}').join(item);
    return s;
  }

  // 惰性構建 {map}/{item} 佔位符素材池
  let _mapNames = null, _itemNames = null;
  function mapNames() {
    if (!_mapNames) {
      _mapNames = ((XG.data.world && XG.data.world.maps) || []).map(function (m) { return m.name; });
      if (!_mapNames.length) _mapNames = ['青雲山'];
    }
    return _mapNames;
  }
  function itemNames() {
    if (!_itemNames) {
      _itemNames = [];
      const eq = (XG.data.equips && XG.data.equips.bases) || [];
      for (const b of eq) if (b.grade >= 2) _itemNames.push(b.name);
      const mats = XG.data.mats || {};
      for (const id in mats) if (mats[id].grade >= 2) _itemNames.push(mats[id].name);
      const pills = (XG.data.pills && XG.data.pills.recipes) || [];
      for (const p of pills) if (!p.hidden && p.grade >= 3) _itemNames.push(p.name);
      if (!_itemNames.length) _itemNames = ['上古玉簡'];
    }
    return _itemNames;
  }

  // 道友戰力估算（境界基值 × 層數係數 × 天賦，供宿敵匹配/論劍參考）
  function fellowPower(f) {
    const base = XG.cfg.REALM_BASE[f.realmIdx] || XG.cfg.REALM_BASE[0];
    const k = (1 + 0.12 * (f.layer - 1)) * (0.6 + 0.4 * f.talent) * (rootOf(f).mult || 1);
    return XG.cfg.POWER({ atk: base.atk * k, def: base.def * k, hp: base.hp * k, spd: base.spd * k });
  }

  /* ---------------- 生成（契約 §11） ---------------- */
  function genFellow(schoolId, usedNames) {
    const u = U();
    const p = S().player;
    const persona = u.weighted(personas());
    const gender = u.chance(0.5) ? 'male' : 'female';
    let name = '';
    for (let i = 0; i < 20; i++) { name = XG.data.genName(gender === 'male' ? 'm' : 'f'); if (!usedNames[name]) break; }
    usedNames[name] = 1;
    const g = persona.growth || [1, 1];
    const realmIdx = u.clamp(p.realmIdx + u.randInt(-2, 2), 0, XG.cfg.REALMS.length - 2); // 圍繞玩家±2大境界（渡劫止，免生成即飛昇）
    const layer = u.randInt(1, XG.cfg.LAYERS);
    return {
      uid: u.uid(), name: name, gender: gender,
      persona: persona.id, school: schoolId, root: u.weighted(roots()).id,
      realmIdx: realmIdx, layer: layer,
      cult: Math.floor(XG.cfg.layerCost(realmIdx, layer) * u.rand(0, 0.8)),
      talent: u.clamp(u.rand(g[0], g[1]), 0.5, 2.0),
      state: 'normal', stateUntil: 0, alive: true,
      favor: u.randInt(0, 15), relation: 'stranger', metAt: Date.now(),
      lastNews: '', gifts: 0, reincarn: 0, breakFails: 0, hasPartner: false,
    };
  }

  function ensureFellows() {
    const st=S(); st.fellows=st.fellows||[];
    migrate();
    const usedNames={};st.fellows.forEach(f=>usedNames[f.name]=1);
    const ids=schools().map(s=>s.id);
    while(st.fellows.length<50) st.fellows.push(genFellow(ids[st.fellows.length%ids.length],usedNames));
  }

  // 舊檔字段補齊（自恢復）
  function migrate() {
    for (const f of S().fellows) {
      if (f.cult == null) f.cult = 0;
      if (!f.state) f.state = 'normal';
      if (f.stateUntil == null) f.stateUntil = 0;
      if (f.alive == null) f.alive = true;
      if (f.favor == null) f.favor = 0;
      if (!f.relation) f.relation = 'stranger';
      if (f.reincarn == null) f.reincarn = 0;
      if (f.breakFails == null) f.breakFails = 0;
      if (f.gifts == null) f.gifts = 0;
      if (f.lastNews == null) f.lastNews = '';
      if (!f.metAt) f.metAt = Date.now();
    }
  }

  /* ---------------- 成長模擬（10 分鐘一步） ---------------- */
  // 單道友一步成長；newsBuf 收集候選動態 {uid, cat, text, imp}
  function stepFellow(f, now, newsBuf) {
    if (!f.alive) return;
    const u = U();
    // 卡關中：龜速修行，到期自解
    if (f.state === 'stuck') {
      if (now >= f.stateUntil) { f.state = 'normal'; f.breakFails = 0; }
      else { f.cult += XG.cfg.REALMS[f.realmIdx].rate * STEP_SEC * 0.05; return; }
    }
    // 頓悟（surge）狀態到期回落
    const surge = f.state === 'surge' && now < f.stateUntil;
    if (f.state === 'surge' && !surge) f.state = 'normal';
    // 飛昇（末境）不再增長
    if (f.realmIdx >= XG.cfg.REALMS.length - 1) return;

    const realm = XG.cfg.REALMS[f.realmIdx];
    const gain = realm.rate * (1 + 0.12 * (f.layer - 1)) * STEP_SEC
      * f.talent * (rootOf(f).mult || 1) * (surge ? SURGE_MULT : 1) * u.rand(0.85, 1.15);
    f.cult += gain;

    // 小境界：修為滿即升（可連升，靜默不播報）
    while (f.layer < XG.cfg.LAYERS && f.cult >= XG.cfg.layerCost(f.realmIdx, f.layer)) {
      f.cult -= XG.cfg.layerCost(f.realmIdx, f.layer);
      f.layer++;
    }
    // 大境界：滿層且修為足 → 按概率突破
    if (f.layer >= XG.cfg.LAYERS && f.cult >= XG.cfg.layerCost(f.realmIdx, XG.cfg.LAYERS)) {
      tryBreakthrough(f, now, newsBuf);
    }
  }

  function tryBreakthrough(f, now, newsBuf) {
    const u = U();
    const dyn = lines().dynamic || {};
    const trib = f.realmIdx >= 7; // 大乘→渡劫、渡劫→飛昇 視為渡天劫
    const persona = personaOf(f);
    let rate = XG.cfg.REALMS[f.realmIdx].breakRate + (f.breakFails || 0) * XG.cfg.BREAK_FAIL_BONUS;
    if (persona.id === 'ouhuang') rate += 0.05; // 氣運之子
    if (u.chance(Math.min(0.95, rate))) {
      // 突破成功
      f.realmIdx++; f.layer = 1; f.cult = 0; f.breakFails = 0; f.state = 'normal';
      const text = fill(u.pick(dyn['突破'] || ['{name}破境成功。']), f);
      newsBuf.push({ uid: f.uid, cat: '突破', text: text, imp: f.realmIdx >= 7 ? 1 : 0 });
      f.lastNews = { k: '突破', text: text, t: now };
    } else {
      // 突破失敗 → 卡關一段時間；渡劫失敗另有文案，小概率轉世重來
      f.breakFails = (f.breakFails || 0) + 1;
      f.state = 'stuck';
      f.stateUntil = now + u.randInt(STUCK_H[0], STUCK_H[1]) * 3600 * 1000;
      if (trib) {
        const text = fill(u.pick(dyn['渡劫失敗'] || ['{name}渡劫失敗。']), f);
        newsBuf.push({ uid: f.uid, cat: '渡劫失敗', text: text, imp: 1 });
        f.lastNews = { k: '渡劫失敗', text: text, t: now };
        if (u.chance(0.15)) { // 兵解轉世：境界歸零，天賦重擲
          f.reincarn++;
          f.realmIdx = 0; f.layer = 1; f.cult = 0; f.breakFails = 0; f.state = 'normal'; f.stateUntil = 0;
          const g = persona.growth || [1, 1];
          f.talent = u.clamp(u.rand(g[0], g[1]) * u.rand(0.9, 1.3), 0.5, 2.0); // 轉世或得更好根骨
          const t2 = fill(u.pick(dyn['轉世'] || ['{name}轉世重修。']), f);
          newsBuf.push({ uid: f.uid, cat: '轉世', text: t2, imp: 1 });
          f.lastNews = { k: '轉世', text: t2, t: now };
        }
      } else {
        const text = fill(u.pick(dyn['卡關'] || ['{name}困於瓶頸。']), f);
        newsBuf.push({ uid: f.uid, cat: '卡關', text: text, imp: 0 });
        f.lastNews = { k: '卡關', text: text, t: now };
      }
    }
  }

  // 單道友一步隨機動態（至寶/炸爐/結道侶/頓悟/隱居/比武；小概率，全局採樣剋制在 doStep 收口）
  function stepEvent(f, now, newsBuf) {
    if (!f.alive || f.state === 'stuck') return;
    const u = U();
    const persona = personaOf(f);
    let p = 0.012;                       // 基礎每步 1.2%
    if (persona.id === 'ouhuang') p = 0.03;   // 歐皇事兒多
    if (persona.id === 'hualao') p = 0.018;   // 話癆愛出動靜
    if (!u.chance(p)) return;
    const dyn = lines().dynamic || {};
    const cat = u.weighted([
      { k: '獲得至寶', w: persona.id === 'ouhuang' ? 30 : 12 },
      { k: '炸爐', w: f.school === 'dan' ? 22 : 10 },
      { k: '結為道侶', w: f.hasPartner ? 0 : 8 },
      { k: '頓悟', w: 12 },
      { k: '隱居', w: 5 },
      { k: '比武', w: 14 },
    ], 'w');
    if (!cat) return;
    if (cat.k === '結為道侶') f.hasPartner = true;
    if (cat.k === '頓悟') { f.state = 'surge'; f.stateUntil = now + SURGE_SEC * 1000; }
    const text = fill(u.pick(dyn[cat.k] || ['{name}有了新動靜。']), f);
    newsBuf.push({ uid: f.uid, cat: cat.k, text: text, imp: 0 });
    f.lastNews = { k: cat.k, text: text, t: now };
  }

  // 一步總控：成長+事件+關係判定+週報+道侶劇情；offlineBuf 為 null 時在線直推，否則壓縮收集
  function doStep(now, offlineBuf) {
    const u = U();
    const buf = [];
    const fs = S().fellows || [];
    for (const f of fs) { stepFellow(f, now, buf); stepEvent(f, now, buf); }
    checkRelations(now, buf);
    weeklyCheck(now, buf);
    partnerStory(now, buf);

    if (!offlineBuf) {
      // 在線：採樣 2~3 條直推傳聞流
      const n = Math.min(buf.length, u.randInt(2, STEP_NEWS_MAX));
      const picked = u.pickN(buf, n);
      for (const it of picked) pushNews('fellow', it.text, it.imp, it.uid);
    } else {
      // 離線：只記總條數與要聞樣本（重要的優先）
      offlineBuf.count += buf.length;
      buf.sort(function (a, b) { return b.imp - a.imp; });
      for (const it of buf) {
        if (offlineBuf.samples.length >= 3) break;
        offlineBuf.samples.push(it.text);
      }
    }
  }

  /* ---------------- 關係：摯友/宿敵 ---------------- */
  function setRelation(f, rel) { f.relation = rel; }

  function checkRelations(now, buf) {
    const u = U();
    const st = S();
    const p = st.player;
    let rivals = 0;
    for (const f of st.fellows) if (f.relation === 'rival') rivals++;
    let myPower = 0;
    try { myPower = XG.stats.get().power || 0; } catch (e) { myPower = 0; }
    for (const f of st.fellows) {
      if (!f.alive) continue;
      // 摯友：好感 ≥60 自動晉級
      if (f.relation === 'stranger' && f.favor >= FAVOR_FRIEND) {
        setRelation(f, 'friend');
        buf.push({ uid: f.uid, cat: '摯友', text: f.name + '與你相交莫逆，自此以摯友相稱，修行路上互為奧援。', imp: 1 });
        continue;
      }
      // 宿敵：境界差≤1 且戰力相近、非摯友/道侶，自動標記
      if (f.relation === 'stranger' && rivals < RIVAL_CAP
        && Math.abs(f.realmIdx - p.realmIdx) <= 1 && f.favor < FAVOR_FRIEND && myPower > 0) {
        const ratio = fellowPower(f) / myPower;
        if (ratio > 0.3 && ratio < 3 && u.chance(0.02)) {
          setRelation(f, 'rival'); rivals++;
          buf.push({ uid: f.uid, cat: '宿敵', text: f.name + '近日處處與你針鋒相對，坊間已將你們並稱為一時瑜亮。', imp: 1 });
        }
      }
      // 宿敵境界拉開兩檔以上 → 恩怨自解
      if (f.relation === 'rival' && Math.abs(f.realmIdx - p.realmIdx) > 2) {
        setRelation(f, 'stranger');
      }
    }
  }

  // 每週對比宿敵與玩家的境界進度，排行互超即發戰書（war 池）
  function weeklyCheck(now, buf) {
    const st = S();
    const wid = U().weekId();
    st.fellowWeek = st.fellowWeek || { wid: wid, player: 0, rivals: {} };
    const wk = st.fellowWeek;
    const score = function (realmIdx, layer) { return realmIdx * XG.cfg.LAYERS + layer; };
    const pScore = score(st.player.realmIdx, st.player.layer);
    if (wk.wid !== wid) {
      // 周輪換：找出互超的宿敵發戰書
      const u = U();
      const warPool = lines().war || [];
      for (const f of st.fellows) {
        if (f.relation !== 'rival' || !f.alive) continue;
        const prevR = wk.rivals[f.uid] || 0;
        const curR = score(f.realmIdx, f.layer);
        const overtaken = (prevR <= wk.player && curR > pScore) || (prevR >= wk.player && curR < pScore);
        if (overtaken && warPool.length) {
          const tpl = u.pick(warPool);
          buf.push({
            uid: f.uid, cat: '戰書', imp: 1,
            text: fill(tpl, f, { name: st.player.name, realm: realmName(st.player.realmIdx, st.player.layer) }),
          });
        }
      }
      // 新周快照
      wk.wid = wid; wk.player = pScore; wk.rivals = {};
      for (const f of st.fellows) if (f.relation === 'rival') wk.rivals[f.uid] = score(f.realmIdx, f.layer);
    } else {
      // 周內持續刷新快照（保持可比性）
      wk.player = pScore;
      for (const f of st.fellows) if (f.relation === 'rival') wk.rivals[f.uid] = score(f.realmIdx, f.layer);
    }
  }

  /* ---------------- 玩家高光（訂閱玩家事件，playerHilight 池統一播報） ---------------- */
  function playerHilight(extra) {
    const now = Date.now();
    if (now - (playerHilight._last || 0) < HILIGHT_GAP_MS) return;
    playerHilight._last = now;
    const p = S().player;
    const pool = lines().playerHilight || [];
    if (!pool.length) return;
    const text = fill(U().pick(pool), null, {
      name: p.name, realm: realmName(p.realmIdx, p.layer),
    });
    pushNews('player', text, 1);
  }

  // 玩家突破大境界成功：摯友/道侶按 giftW 概率攜禮來賀（congrats 池）
  function friendsCongrat() {
    const u = U();
    const p = S().player;
    const pool = lines().congrats || [];
    for (const f of S().fellows) {
      if (!f.alive || (f.relation !== 'friend' && f.relation !== 'partner')) continue;
      const persona = personaOf(f);
      if (!u.chance(Math.min(0.85, 0.45 * (persona.giftW || 1)))) continue;
      const gift = rollGift(f);
      const text = fill(u.pick(pool), f, { realm: realmName(p.realmIdx, p.layer) })
        + (gift ? '（賀禮：' + gift.desc + '）' : '');
      pushNews('fellow', text, 1, f.uid);
      if (gift) { gift.apply(); f.gifts++; }
    }
  }

  function subscribe() {
    if (subscribe._done) return;
    subscribe._done = true;
    XG.bus.on('realm:break', function (e) {
      if (!e || !e.ok) return;
      playerHilight();
      friendsCongrat();
    });
    XG.bus.on('forge:done', function (e) {
      if (e && e.grade >= 4) playerHilight(); // grade4 神裝出爐
    });
    XG.bus.on('tower:clear', function (e) {
      if (e && e.layer > 0 && e.layer % 33 === 0) playerHilight(); // 33 倍數層（隱藏 BOSS 層）
    });
  }

  /* ---------------- 禮物生成（回贈/賀禮共用） ---------------- */
  // 返回 {desc, apply()}；量級與玩家境界掛鉤（數值紀律：參照境界 rate × 秒數）
  function rollGift(f) {
    const u = U();
    const p = S().player;
    const kind = u.weighted([{ k: 'mat', w: 40 }, { k: 'lingShi', w: 35 }, { k: 'pill', w: 25 }], 'w');
    if (kind.k === 'lingShi') {
      const n = Math.round((p.realmIdx + 1) * u.randInt(300, 1200));
      return { desc: '靈石×' + U().fmt(n), apply: function () { XG.addRes({ lingShi: n }); } };
    }
    if (kind.k === 'pill') {
      const pool = ((XG.data.pills && XG.data.pills.recipes) || []).filter(function (r) {
        return !r.hidden && r.grade <= Math.min(9, p.realmIdx + 2);
      });
      if (pool.length) {
        const r = u.pick(pool);
        const n = u.randInt(1, 2);
        return { desc: r.name + '×' + n, apply: function () { XG.addRes({ pill: { [r.id]: n } }); } };
      }
    }
    // 材料兜底（含 mats 池為空時的靈石降級）
    const g = u.clamp(Math.round(p.realmIdx / 2) + u.randInt(0, 1), 0, 4);
    const pool = [];
    const mats = XG.data.mats || {};
    for (const id in mats) if (mats[id].grade === g) pool.push(id);
    if (!pool.length) for (const id in mats) pool.push(id);
    if (pool.length) {
      const id = u.pick(pool);
      const n = u.randInt(1, 3);
      return { desc: (mats[id] ? mats[id].name : id) + '×' + n, apply: function () { XG.addRes({ mat: { [id]: n } }); } };
    }
    const n2 = Math.round((p.realmIdx + 1) * u.randInt(200, 600));
    return { desc: '靈石×' + U().fmt(n2), apply: function () { XG.addRes({ lingShi: n2 }); } };
  }

  /* ---------------- 求助（每 4 小時一波，1~3 名道友） ---------------- */
  function dailyHelp() {
    const d = S().daily = S().daily || {};
    if (!d.help || !d.help.at || Date.now() - d.help.at >= HELP_ROLL_MS || !Array.isArray(d.help.list)) rollDailyHelp();
    return S().daily.help;
  }

  function rollDailyHelp() {
    const u = U();
    const d = S().daily;
    d.help = { at: Date.now(), list: [] };
    const n = u.randInt(HELP_PER_ROLL[0], HELP_PER_ROLL[1]);
    if (!n || !(S().fellows || []).length) return;
    const p = S().player;
    const helpPool = lines().help || [];
    const cands = u.pickN(S().fellows.filter(function (f) { return f.alive; }), n);
    for (const f of cands) {
      const kind = u.chance(0.5) ? 'mat' : 'pill';
      let id = '', itemName = '', cnt = 1;
      if (kind === 'mat') {
        const g = u.clamp(Math.round(p.realmIdx / 2) + u.randInt(-1, 1), 0, 4);
        const pool = [];
        const mats = XG.data.mats || {};
        for (const mid in mats) if (mats[mid].grade === g) pool.push(mid);
        if (!pool.length) for (const mid in mats) pool.push(mid);
        if (!pool.length) continue;
        id = u.pick(pool);
        itemName = mats[id].name;
        cnt = u.randInt(1, 3);
      } else {
        const pool = ((XG.data.pills && XG.data.pills.recipes) || []).filter(function (r) {
          return !r.hidden && r.grade <= Math.min(9, p.realmIdx + 1);
        });
        if (!pool.length) continue;
        const r = u.pick(pool);
        id = r.id; itemName = r.name;
        cnt = u.randInt(1, 2);
      }
      d.help.list.push({
        hid: u.uid(), uid: f.uid, kind: kind, id: id, n: cnt,
        itemName: itemName,
        icon: kind === 'pill' ? ((XG.data.pills.recipes.find(function (x) { return x.id === id; }) || {}).icon || '丹') : ((XG.data.mats[id] || {}).icon || '材'),
        text: fill(u.pick(helpPool), f),
        done: 0,
      });
      pushNews('fellow', f.name + '似乎有求於你，不妨去道友錄中看看。', 0, f.uid);
    }
  }

  /* ---------------- 坊市（築基5層解鎖，每日首批＋最多五次付費換新） ---------------- */
  function marketRules() { return (XG.data.world && XG.data.world.marketRules) || { refreshSec: 600, slots: 6, priceByPersona: {}, priceByRelation: {}, stock: { kindW: {}, basePrice: {}, currencyW: {} } }; }
  function marketSt() {
    const st=S();st.fellowMarket=st.fellowMarket||{};
    const m=st.fellowMarket;
    if(m.balanceVersion!=='1.9.2') {
      if(m.day&&Array.isArray(m.slots)) {
        m.batchIndex=m.discounted?Math.min(5,Math.max(1,XG.balance.daily().marketRefreshes||1)):0;
        m.markup=XG.balance.marketMarkup(m.batchIndex);
        for(const slot of m.slots) {
          slot.originalPrice=slot.originalPrice||slot.basePrice||slot.price;
          slot.markup=m.markup;slot.price=Math.max(1,Math.ceil(slot.originalPrice*(1+m.markup)));
          delete slot.discount;
        }
      } else {m.at=0;m.slots=[];m.day='';m.batchIndex=0;m.markup=0;}
      delete m.discounted;m.balanceVersion='1.9.2';
    }
    if(!Array.isArray(m.slots))m.slots=[];
    return m;
  }
  function marketUnlocked() { return XG.cfg.isUnlocked('market'); }
  function ensureMarket() {
    const m=marketSt();
    if(marketUnlocked()&&m.day!==XG.balance.dayKey())genMarket(Date.now(),false);
    return m;
  }
  function genMarket(now,batchIndex) {
    const u=U(),mr=marketRules(),st=marketSt(),profile=XG.balance.marketProfile();
    const fs=(S().fellows||[]).filter(f=>f.alive);
    if(!fs.length)return;
    st.at=now||Date.now();st.day=XG.balance.dayKey();st.slots=[];st.profile=profile;st.batchIndex=Number(batchIndex)||0;st.markup=XG.balance.marketMarkup(st.batchIndex);
    const bp=mr.stock.basePrice||{},pills=XG.data.pills.recipes||[],bases=XG.data.equips.bases||[];
    const gfs=XG.data.gongfa.list||[],mats=XG.data.mats||{},usedRecipe={};
    const lines=(XG.data.fellows.marketLines&&XG.data.fellows.marketLines.sell)||[];
    function tierPool(list,cap,filter) {
      const eligible=list.filter(it=>(!filter||filter(it))&&it.grade<=cap);
      const highest=eligible.reduce((n,it)=>Math.max(n,it.grade),0);
      return eligible.filter(it=>it.grade>=Math.max(0,highest-1));
    }
    // Bounded attempts; empty recipe pools reroll into another category instead of emptying the whole shop.
    for(let attempts=0;st.slots.length<(mr.slots||6)&&attempts<120;attempts++) {
      const seller=u.pick(fs),persona=personaOf(seller);
      let kind=u.weighted([{k:'pill',w:30},{k:'mat',w:30},{k:'equip',w:20},{k:'frag',w:15},{k:'egg',w:5},{k:'recipe',w:8}],'w').k;
      if(kind==='equip'&&!XG.cfg.isUnlocked('forge'))kind='mat';
      const slot={sid:u.uid(),uid:seller.uid,kind:kind,n:1,sold:false,grade:0,id:'',baseId:''};
      if(kind==='pill') {
        const pool=tierPool(pills,profile.pillGrade,r=>!r.hidden);if(!pool.length)continue;
        const r=u.pick(pool);Object.assign(slot,{id:r.id,name:r.name,icon:r.icon,grade:r.grade,n:u.randInt(1,2),price:200*r.grade});
      } else if(kind==='mat') {
        const pool=tierPool(Object.keys(mats).map(id=>Object.assign({id:id},mats[id])),profile.matGrade);if(!pool.length)continue;
        const m=u.pick(pool);Object.assign(slot,{id:m.id,name:m.name,icon:m.icon,grade:m.grade,n:u.randInt(1,5),price:bp['matG'+m.grade]||100});
      } else if(kind==='equip') {
        const pool=tierPool(bases,profile.equipGrade,b=>!b.hidden);if(!pool.length)continue;
        const b=u.pick(pool);Object.assign(slot,{baseId:b.id,id:b.id,name:b.name,icon:b.icon,grade:b.grade,price:800*Math.max(1,b.grade)});
      } else if(kind==='frag') {
        const pool=tierPool(gfs,profile.fragGrade,g=>!g.hidden&&!g.cond);if(!pool.length)continue;
        const g=u.pick(pool);Object.assign(slot,{id:g.id,name:g.name+'殘篇',icon:g.icon,grade:g.grade,n:u.randInt(1,3),price:1500*g.grade});
      } else if(kind==='recipe') {
        const known=(S().alchemy&&S().alchemy.known)||[];
        const pool=tierPool(pills,profile.recipeGrade,r=>known.indexOf(r.id)<0&&!usedRecipe[r.id]&&(!r.hidden||r.id==='pill_puti'));
        if(!pool.length)continue;const r=u.pick(pool);usedRecipe[r.id]=1;
        Object.assign(slot,{id:r.id,name:'丹方·'+r.name,icon:r.icon,grade:r.grade,price:r.grade*3,cur:'lingYu',fixed:true});
      } else Object.assign(slot,{id:'egg',name:'靈寵蛋',icon:'🥚',grade:1,price:bp.egg||30000});
      // Lucky vendors can upgrade one tier; pricing always uses the final item.
      if(persona.id==='ouhuang'&&u.chance(OUHUANG_SLOT_P)&&['pill','equip','mat'].indexOf(kind)>=0) {
        let pool=[];
        if(kind==='pill')pool=pills.filter(r=>!r.hidden&&r.grade===slot.grade+1);
        if(kind==='equip')pool=bases.filter(b=>!b.hidden&&b.grade===slot.grade+1);
        if(kind==='mat')pool=Object.keys(mats).filter(id=>mats[id].grade===slot.grade+1).map(id=>Object.assign({id:id},mats[id]));
        if(pool.length){const it=u.pick(pool);Object.assign(slot,{id:it.id,name:it.name,icon:it.icon,grade:it.grade});if(kind==='equip')slot.baseId=it.id;if(kind==='mat')slot.price=bp['matG'+it.grade]||slot.price;}
      }
      const relation=mr.priceByRelation[seller.relation]==null?1:mr.priceByRelation[seller.relation];
      const disc=Math.max(.7,1-((XG.stats.get().marketDiscPct||0)/100));
      const factor=profile.priceMult*(mr.priceByPersona[seller.persona]||1)*relation*disc;
      if(slot.fixed)slot.originalPrice=Math.max(1,Math.ceil(slot.price*profile.priceMult));
      else {
        slot.cur=u.weighted([{k:'lingShi',w:8},{k:'lingYu',w:2}],'w').k;
        slot.originalPrice=XG.balance.marketPrice(slot,factor,slot.cur);
      }
      slot.markup=st.markup;
      slot.price=Math.max(1,Math.ceil(slot.originalPrice*(1+slot.markup)));slot.basePrice=slot.originalPrice;
      slot.line=lines.length?fill(u.pick(lines),seller,{item:slot.name}):'';
      st.slots.push(slot);
    }
    XG.bus.emit('save:dirty');
  }

  /* ---------------- 道侶專屬劇情 news 系列 ---------------- */
  const PARTNER_STORY = [
    '洞房花燭夜，{name}與你剪燭西窗，共誓大道：他日飛昇，同去同歸。',
    '{name}將洞府重新佈置了一番，檐下新掛兩盞鴛鴦燈，日子過得有了煙火氣。',
    '有好事者編了段《神仙眷侶傳》在坊市傳唱，說的正是你與{name}。',
  ];
  function partnerStory(now, buf) {
    const st = S();
    const s = st.fellowStory;
    if (!s || !s.uid || s.stage >= PARTNER_STORY.length || now < s.nextAt) return;
    const f = findFellow(s.uid);
    if (!f || !f.alive) { st.fellowStory = null; return; }
    buf.push({
      uid: f.uid, cat: '道侶', imp: 1,
      text: PARTNER_STORY[s.stage].split('{name}').join(f.name),
    });
    s.stage++;
    s.nextAt = now + 86400000; // 每日一折
  }

  function giftLedger() {
    const st=S();
    if(!st.fellowGiftLedger) {
      let total=0,claimed=0,value=0;
      for(const f of st.fellows||[]) {
        const n=Math.max(0,Math.floor(f.giftsReceived||0));
        total+=n;claimed+=Math.floor(n/50);value+=Math.max(0,f.giftBatchValue||0);
      }
      const pending=Math.max(0,Math.floor(total/50)-claimed),remaining=total%50;
      const units=pending*50+remaining,unitValue=units>0?value/units:0;
      st.fellowGiftLedger={version:1,totalSent:total,returnsClaimed:claimed,pendingReturns:pending,
        pendingValue:unitValue*pending*50,batchValue:unitValue*remaining};
      XG.bus.emit('save:dirty');
    }
    return st.fellowGiftLedger;
  }
  // Each return is a single eligible type, bounded by 10% of that batch's gift valuation.
  function globalReturn(batchValue) {
    const budget=Math.max(1,Math.floor(batchValue*.1)),p=S().player,B=XG.balance;
    const maxGrade=Math.min(9,p.realmIdx+1),eqGrade=B.marketProfile().equipGrade;
    const pills=(XG.data.pills.recipes||[]).filter(r=>!r.hidden&&r.grade<=maxGrade&&B.pillSale(r)<=budget);
    const equips=(XG.data.equips.bases||[]).filter(b=>!b.hidden&&b.grade<=eqGrade&&Math.floor(B.equipYu(b.grade)*500*.6)<=budget);
    const frags=(XG.data.gongfa.list||[]).filter(g=>!g.hidden&&!g.cond&&g.grade<=maxGrade&&750*g.grade<=budget);
    const kinds=['lingShi'];
    if(budget>=500)kinds.push('lingYu');if(equips.length)kinds.push('equip');if(pills.length)kinds.push('pill');if(frags.length)kinds.push('frag');
    const donors=(S().fellows||[]).filter(f=>f.alive&&(f.giftsReceived||0)>0);
    const donor=U().pick(donors)||null,kind=U().pick(kinds);
    const result={kind:kind,fromUid:donor?donor.uid:null,fromName:donor?donor.name:'道友們',value:0,desc:'',n:1};
    if(kind==='lingYu') {
      result.n=Math.max(1,Math.min(Math.floor(budget/500),p.realmIdx+2));result.value=result.n*500;
      result.desc='靈玉×'+result.n;XG.addRes({lingYu:result.n});
    } else if(kind==='equip') {
      const b=U().pick(equips),eq=XG.sys.forge&&XG.sys.forge.createEquip(b.id,b.grade);
      if(eq){result.id=eq.uid;result.value=Math.floor(B.equipYu(b.grade)*500*.6);result.desc=b.name+'×1';}
      else {result.kind='lingShi';result.n=budget;result.value=budget;result.desc='靈石×'+budget;XG.addRes({lingShi:budget});}
    } else if(kind==='pill') {
      const r=U().pick(pills);result.id=r.id;result.value=B.pillSale(r);result.desc=r.name+'×1';XG.addRes({pill:{[r.id]:1}});
    } else if(kind==='frag') {
      const g=U().pick(frags);result.id=g.id;result.value=750*g.grade;result.desc=g.name+'殘片×1';
      if(XG.sys.gongfa&&XG.sys.gongfa.addFrag)XG.sys.gongfa.addFrag(g.id,1);else XG.addRes({frag:{[g.id]:1}});
    } else {result.n=budget;result.value=budget;result.desc='靈石×'+budget;XG.addRes({lingShi:budget});}
    if(donor){donor.gifts=(donor.gifts||0)+1;XG.bus.emit('fellow:gift',{uid:donor.uid,persona:donor.persona,ouhuang:false});}
    pushNews('fellow',result.fromName+'託人送來回禮：'+result.desc+'。仙界的人情往來，終於不是已讀不回！',1,result.fromUid);
    return result;
  }

  /* ---------------- 系統註冊 ---------------- */
  XG.sys.fellows = {
    id: 'fellows',
    _acc: 0,

    init() {
      try {
        ensureFellows();
        giftLedger();
        if (XG.character) XG.character.normalize();
        marketSt();
        S().fellowWeek = S().fellowWeek || { wid: U().weekId(), player: 0, rivals: {} };
        dailyHelp(); // 僅跨天/缺檔才重搖（曾誤用 rollDailyHelp：每次加載都清空重搖，致「有求於你」傳聞與求助列表脫節）
        ensureMarket();
        subscribe();
      } catch (e) {
        console.error('[fellows] init 失敗', e);
      }
    },

    // 主循環每秒：累計滿 10 分鐘走一步（online 與 offline 同路徑）
    tick(dt) {
      // 求助到點重搖（dailyHelp 內部按 4 小時間隔判定）
      dailyHelp();
      // 坊市只在跨日時產生首批，十分鐘步進不再換新
      if (marketUnlocked()) {
        const mr = marketRules();
        const st = marketSt();
        ensureMarket();
      }
      // 成長步進
      this._acc += dt;
      let guard = 0;
      while (this._acc >= STEP_SEC && guard < 100) {
        this._acc -= STEP_SEC;
        doStep(Date.now(), null);
        guard++;
      }
    },

    // 離線結算：按 10 分鐘一步循環，傳聞壓縮為摘要+總條數（契約 §8 報告片段）
    offline(dt) {
      const steps = Math.floor(dt / STEP_SEC);
      const buf = { count: 0, samples: [] };
      const now = Date.now();
      for (let i = 0; i < steps; i++) doStep(now, buf);
      // 離線返回只補當日首批，不補十分鐘刷新
      if (marketUnlocked()) {
        const mr = marketRules();
        ensureMarket();
      }
      if (!steps || !buf.count) return null;
      const fellowNews = ['閉關這些時日，道友圈共傳出 ' + buf.count + ' 樁動靜，最引人側目的有：'];
      for (const s of buf.samples) fellowNews.push('· ' + s);
      return { fellowNews: fellowNews, fellowEventCount: buf.count };
    },

    // 道侶在世：永久 cultRatePct+10（契約 §10 fellows 條目）
    getMods() {
      const uid = S().player && S().player.partner;
      if (!uid) return {};
      const f = findFellow(uid);
      if (!f || !f.alive || f.relation !== 'partner') return {};
      return { cultRatePct: 10 };
    },

    /* ================= UI 對接面 ================= */

    list() {
      const u = U();
      const fs = (S().fellows || []).slice();
      fs.sort(function (a, b) {
        const ra = a.relation === 'partner' ? 3 : a.relation === 'friend' ? 2 : a.relation === 'rival' ? 1 : 0;
        const rb = b.relation === 'partner' ? 3 : b.relation === 'friend' ? 2 : b.relation === 'rival' ? 1 : 0;
        if (ra !== rb) return rb - ra;
        if (b.favor !== a.favor) return b.favor - a.favor;
        return (b.realmIdx * 10 + b.layer) - (a.realmIdx * 10 + a.layer);
      });
      const self = this;
      return fs.map(function (f) { return self._view(f, u); });
    },

    _view(f, u) {
      const persona = personaOf(f), school = schoolOf(f);
      return {
        uid: f.uid, name: f.name, gender: f.gender, genderSymbol: XG.character.symbol(f.gender),
        persona: f.persona, personaName: persona.name, personaDesc: persona.desc,
        school: f.school, schoolName: school.name, schoolIcon: school.icon,
        root: f.root, rootName: rootOf(f).name,
        realmIdx: f.realmIdx, layer: f.layer, realmName: realmName(f.realmIdx, f.layer),
        cultPct: XG.cfg.layerCost(f.realmIdx, f.layer) > 0 && isFinite(XG.cfg.layerCost(f.realmIdx, f.layer))
          ? Math.min(100, Math.floor(f.cult / XG.cfg.layerCost(f.realmIdx, f.layer) * 100)) : 100,
        state: f.state, favor: f.favor, relation: f.relation,
        power: Math.round(fellowPower(f)), reincarn: f.reincarn,
        lastNews: f.lastNews || '',
        giftsReceived:f.giftsReceived||0,giftReturnIn:50-(giftLedger().totalSent%50),globalGiftsSent:giftLedger().totalSent,
        canDiscuss: this.canDiscuss(f.uid),
      };
    },

    get(uid) {
      const f = findFellow(uid);
      if (!f) return null;
      const v = this._view(f, U());
      v.talent = f.talent;
      v.stateUntil = f.stateUntil;
      v.gifts = f.gifts;
      v.metAt = f.metAt;
      return v;
    },

    count() {
      const r = { total: 0, friend: 0, rival: 0, partner: 0 };
      for (const f of (S().fellows || [])) {
        r.total++;
        if (f.relation === 'friend') r.friend++;
        else if (f.relation === 'rival') r.rival++;
        else if (f.relation === 'partner') r.partner++;
      }
      return r;
    },

    canDiscuss(uid) {
      const f = findFellow(uid);
      if (!f || !f.alive) return false;
      const d = S().daily || {};
      return !(d.discussAt && d.discussAt[uid] > Date.now());
    },

    // 論道：每友 10 分鐘冷卻；+修為（對方境界越高越多）+好感（×性格 favorGain）；性格池文案+最近動態呼應
    discuss(uid) {
      const f = findFellow(uid);
      if (!f || !f.alive) return { ok: false, msg: '查無此人。' };
      if (!this.canDiscuss(uid)) return { ok: false, msg: f.name + '正在靜思，盞茶後再論。' };
      const u = U();
      const d = S().daily = S().daily || {};
      d.discussAt = d.discussAt || {};
      d.discussAt[uid] = Date.now() + DISCUSS_CD_MS;

      const persona = personaOf(f);
      const budget=XG.balance.daily(), used=budget.discuss||0;
      budget.discuss=used+1;
      const higher=1+Math.min(.2,Math.max(0,f.realmIdx-S().player.realmIdx)*.1);
      const cult = XG.sys.sect&&XG.sys.sect.active()?0:giveCult(XG.balance.boostActivityCult(XG.balance.standardRate()*u.randInt(2,4)*higher), '與' + f.name + '論道');
      XG.bus.emit('save:dirty');
      const favorAdd = u.clamp(Math.round(u.rand(2, 4) * (persona.favorGain || 1)), 1, 8);
      f.favor = u.clamp(f.favor + favorAdd, 0, 100);
      maxStat('fellow_favor_max', f.favor);
      bumpStat('discuss_count'); // 論道累計（修行錄「結交道友」目標統計口徑）

      const pool = (lines().discuss || {})[f.persona] || [];
      let text = pool.length ? fill(u.pick(pool), f) : '「今日論道，受益匪淺。」';
      if (f.lastNews && f.lastNews.k && u.chance(0.6)) {
        text += '\n「前番聞你' + f.lastNews.k + '之事，可有什麼心得，說與我聽聽？」';
      }
      return { ok: true, msg: '與' + f.name + '論道一番，修為+' + u.fmt(cult) + '，好感+' + favorAdd, text: text, cult: cult, favor: f.favor };
    },

    // 一鍵論道：與全部冷卻完畢的道友依次煮茶，彙總收益（契約 quick 操作口徑）
    discussAll() {
      const fs = (S().fellows || []).filter(function (f) { return f.alive; });
      let count = 0, cult = 0;
      const names = [];
      const self = this;
      fs.forEach(function (f) {
        if (!self.canDiscuss(f.uid)) return;
        const r = self.discuss(f.uid);
        if (r && r.ok) {
          count++;
          cult += r.cult || 0;
          if (names.length < 3) names.push(f.name);
        }
      });
      if (!count) return { ok: false, msg: '諸友皆在靜思，盞茶後再來。' };
      return {
        ok: true, count: count, cult: cult,
        msg: '與 ' + names.join('、') + (count > 3 ? ' 等 ' : ' 共 ') + count + ' 位道友煮茶論道，修為+' + U().fmt(cult) + '。',
      };
    },

    listHelp() {
      const h = dailyHelp();
      const out = [];
      for (const it of h.list) {
        const f = findFellow(it.uid);
        out.push({
          hid: it.hid, uid: it.uid, name: f ? f.name : '故人', gender: f ? f.gender : null, text: it.text,
          kind: it.kind, id: it.id, n: it.n, itemName: it.itemName, icon: it.icon, done: it.done,
        });
      }
      return out;
    },

    // 滿足求助：扣資源 → 好感+10 + 回贈（thanks 池+禮物）；歐皇 3% 贈隱藏功法機緣
    satisfyHelp(hid) {
      const h = dailyHelp();
      let req = null;
      for (const it of h.list) if (it.hid === hid) { req = it; break; }
      if (!req) return { ok: false, msg: '這樁求助已不在了。' };
      if (req.done !== 0) return { ok: false, msg: '這樁求助已經了結過了。' };
      const f = findFellow(req.uid);
      if (!f || !f.alive) return { ok: false, msg: '對方已雲遊遠去。' };
      const cost = req.kind === 'pill' ? { pill: { [req.id]: req.n } } : { mat: { [req.id]: req.n } };
      if (!XG.hasRes(cost)) return { ok: false, msg: req.itemName + '×' + req.n + ' 不足，愛莫能助。' };
      XG.addRes(req.kind === 'pill' ? { pill: { [req.id]: -req.n } } : { mat: { [req.id]: -req.n } });
      req.done = 1;

      const u = U();
      f.favor = u.clamp(f.favor + 10, 0, 100);
      maxStat('fellow_favor_max', f.favor);
      bumpStat('help_fellow');
      XG.bus.emit('fellow:helped', { uid: f.uid });

      const persona = personaOf(f);
      let text = fill(u.pick(lines().thanks || ['「多謝道友！」']), f, { item: req.itemName });
      let giftDesc = '';
      // 回贈：按性格 giftW 概率附禮
      if (u.chance(Math.min(0.95, 0.6 * (persona.giftW || 1)))) {
        const gift = rollGift(f);
        gift.apply();
        f.gifts++;
        giftDesc = gift.desc;
        XG.bus.emit('fellow:gift', { uid: f.uid, persona: f.persona, ouhuang: false });
      }
      // 歐皇隱藏機緣：3% 贈隱藏功法（gongfa 系統監聽 fellow:gift{ouhuang:true} 解鎖 gf_hongyun）
      let ouhuang = false;
      if (persona.id === 'ouhuang' && u.chance(OUHUANG_GIFT_P)) {
        ouhuang = true;
        XG.bus.emit('fellow:gift', { uid: f.uid, persona: f.persona, ouhuang: true });
        const bonus = u.randInt(5, 15);
        XG.addRes({ lingYu: bonus });
        giftDesc += (giftDesc ? '、' : '') + '靈玉×' + bonus;
        text += '\n「這個你收好——」' + f.name + '神神祕祕地塞來一卷古冊，冊上五個古篆：鴻運通寶錄。';
        pushNews('fellow', f.name + '贈予你一卷疑似上古傳承的古冊，坊市為之轟動！', 2, f.uid);
      }
      return {
        ok: true, msg: '相助' + f.name + '，好感+10' + (giftDesc ? '，獲回贈：' + giftDesc : ''),
        text: text, gift: giftDesc ? { desc: giftDesc, ouhuang: ouhuang } : null,
      };
    },

    // 拒絕求助：refuse 池文案，無任何懲罰
    refuseHelp(hid) {
      const h = dailyHelp();
      let req = null;
      for (const it of h.list) if (it.hid === hid) { req = it; break; }
      if (!req) return { ok: false, msg: '這樁求助已不在了。' };
      if (req.done !== 0) return { ok: false, msg: '這樁求助已經了結過了。' };
      req.done = -1;
      const f = findFellow(req.uid);
      const text = fill(U().pick(lines().refuse || ['「無妨。」']), f || { name: '對方' });
      return { ok: true, msg: '已婉拒' + (f ? f.name : '對方') + '的求助。', text: text };
    },

    giftProgress() {
      const l=giftLedger();return {totalSent:l.totalSent,nextIn:50-l.totalSent%50,pendingReturns:l.pendingReturns,returnsClaimed:l.returnsClaimed};
    },
    claimGiftReturns() {
      if(!XG.cfg.isUnlocked('fellows'))return {ok:false,msg:'道友尚未解鎖。',rewards:[]};
      const l=giftLedger(),rewards=[];
      for(let i=0;i<20&&l.pendingReturns>0;i++) {
        const share=l.pendingValue/l.pendingReturns;
        const reward=globalReturn(share);rewards.push(reward);
        l.pendingValue=Math.max(0,l.pendingValue-share);l.pendingReturns--;l.returnsClaimed++;
      }
      if(rewards.length){XG.bus.emit('res:changed');XG.bus.emit('save:dirty');}
      return {ok:rewards.length>0,rewards:rewards,count:rewards.length,
        msg:rewards.length?rewards.map(r=>r.fromName+'回禮：'+r.desc).join('；'):'暫無待領回禮。'};
    },
    giftItems() {
      const out=[],st=S(),B=XG.balance;
      const bases=XG.data.equips.bases||[];
      for(const eq of st.equips.list) {
        if(Object.keys(st.equips.slots).some(k=>st.equips.slots[k]===eq.uid))continue;
        const base=bases.find(b=>b.id===eq.baseId);if(!base)continue;
        const value=Math.floor(Math.min(B.equipYu(eq.grade)*500,Number.isFinite(eq.marketPaidStone)?eq.marketPaidStone:Infinity)*.6);
        out.push({kind:'equip',id:eq.uid,name:base.name+'（強化+'+(eq.enh||0)+'）',count:1,value:value});
      }
      for(const id in st.inv.pill) {
        if(st.inv.pill[id]<=0)continue;const base=id.replace(/_star$/,'');
        const r=XG.data.pills.recipes.find(r=>r.id===base);if(!r)continue;
        out.push({kind:'pill',id:id,name:r.name+(base!==id?'·極品':''),count:st.inv.pill[id],value:B.pillGiftQuote(id,r).price});
      }
      const ids=new Set(Object.keys(st.gongfa.frag||{}).concat(Object.keys(st.inv.frag||{})));
      for(const id of ids) {
        const count=(st.gongfa.frag[id]||0)+(st.inv.frag[id]||0);if(count<=0)continue;
        const def=(XG.data.gongfa.list||[]).concat(st.gongfa.custom||[]).find(g=>g.id===id);if(!def)continue;
        out.push({kind:'frag',id:id,name:def.name+'殘片',count:count,value:750*(def.grade||1)});
      }
      return out;
    },
    sendGift(uid,kind,id) {
      if(!XG.cfg.isUnlocked('fellows'))return {ok:false,msg:'道友尚未解鎖。'};
      const f=findFellow(uid);if(!f||!f.alive)return {ok:false,msg:'這位道友暫時不在。'};
      const item=this.giftItems().find(it=>it.kind===kind&&it.id===id);
      if(!item)return {ok:false,msg:'禮物已不在揹包，或裝備還穿在身上。'};
      if(kind==='equip') {if(!XG.sys.forge.takeGift(id))return {ok:false,msg:'裝備暫時不能送出。'};}
      else if(kind==='pill')XG.addRes({pill:{[id]:-1}});
      else if(kind==='frag') {
        if((S().gongfa.frag[id]||0)>0){S().gongfa.frag[id]--;if(!S().gongfa.frag[id])delete S().gongfa.frag[id];}
        else XG.addRes({frag:{[id]:-1}});
      } else return {ok:false,msg:'這種禮物暫時不收。'};
      const ledger=giftLedger();
      const before=f.favor||0;
      const gain=Math.max(1,Math.min(8,1+Math.floor(Math.log10(1+Math.max(0,item.value)/100))));
      f.favor=U().clamp(before+gain,0,100);
      if(f.relation==='stranger'&&f.favor>=FAVOR_FRIEND)f.relation='friend';
      f.giftsReceived=(f.giftsReceived||0)+1;
      ledger.totalSent++;ledger.batchValue+=Math.max(0,item.value);
      if(ledger.totalSent%50===0){ledger.pendingReturns++;ledger.pendingValue+=ledger.batchValue;ledger.batchValue=0;}
      const returned=this.claimGiftReturns();
      maxStat('fellow_favor_max',f.favor);bumpStat('fellow_gifts_sent');
      XG.bus.emit('res:changed');XG.bus.emit('save:dirty');
      return {ok:true,returnLingShi:returned.rewards.filter(r=>r.kind==='lingShi').reduce((n,r)=>n+r.n,0),
        returns:returned.rewards,giftsReceived:f.giftsReceived,globalGiftsSent:ledger.totalSent,favorGain:f.favor-before,
        msg:'送給'+f.name+'「'+item.name+'」×1，好感+'+(f.favor-before)+'。全體累計'+ledger.totalSent+'次。'+
          (returned.ok?returned.msg:'距下次回禮尚餘'+(50-ledger.totalSent%50)+'次。')};
    },

    /* -------- 坊市 -------- */
    market() {
      const st = ensureMarket();
      const mr = marketRules();
      const now = Date.now();
      const refresh=XG.balance.marketRefreshInfo();
      const midnight=new Date();midnight.setHours(24,0,0,0);
      return {
        unlocked: marketUnlocked(),
        refreshAt: st.at,
        nextInSec:Math.max(0,Math.ceil((midnight.getTime()-now)/1000)),
        refreshUsed:refresh.used,refreshLeft:refresh.left,refreshCost:refresh.cost,nextMarkup:refresh.nextMarkup,batchMarkup:st.markup||0,profile:st.profile,
        slots: st.slots.map(function (s) {
          const f = findFellow(s.uid);
          return {
            sid: s.sid, uid: s.uid,
            sellerName: f ? f.name : '行商', gender: f ? f.gender : null, persona: f ? f.persona : '',
            kind: s.kind, id: s.id, baseId: s.baseId || '', grade: s.grade,
            n: s.n, name: s.name, icon: s.icon,
            price: s.price, cur: s.cur, curName: s.cur === 'lingYu' ? '靈玉' : '靈石',
            originalPrice:s.originalPrice,markup:s.markup||0,basePrice:s.originalPrice||s.basePrice, dailyLeft:s.kind==='pill'?Math.max(0,3-(XG.balance.daily().purchases[s.id]||0)):null,
            sold: !!s.sold || s.n <= 0 || (s.kind==='pill'&&(XG.balance.daily().purchases[s.id]||0)>=3), line: s.line || '',
          };
        }),
      };
    },

    buyMarket(sid) {
      if (!marketUnlocked()) return { ok: false, msg: '坊市尚未開啓（築基5層解鎖）。' };
      const st = ensureMarket();
      let slot = null;
      for (const s of st.slots) if (s.sid === sid) { slot = s; break; }
      if (!slot) return { ok: false, msg: '這宗買賣已不在了。' };
      if (slot.sold || slot.n <= 0) return { ok: false, msg: '此貨已售罄。' };
      // 丹方欄：已參悟者在扣費前攔截（丹方池按生成時快照，期間可能已從別處習得）
      if (slot.kind === 'recipe') {
        const known0 = (XG.state.alchemy && XG.state.alchemy.known) || [];
        if (known0.indexOf(slot.id) >= 0) return { ok: false, msg: '此丹方你已參悟，這宗買賣作罷。' };
      }
      const budget=XG.balance.daily();
      if(slot.kind==='pill'&&(budget.purchases[slot.id]||0)>=3) return {ok:false,msg:'這種成品丹今日已買3顆，換攤也不能瞞過仙界帳本。'};
      const cost = { [slot.cur]: slot.price };
      if (!XG.hasRes(cost)) return { ok: false, msg: (slot.cur === 'lingYu' ? '靈玉' : '靈石') + '不足。' };
      XG.addRes({ [slot.cur]: -slot.price });

      // 交付
      let got = slot.name;
      if (slot.kind === 'mat') XG.addRes({ mat: { [slot.id]: 1 } });
      else if (slot.kind === 'pill') {
        XG.addRes({ pill: { [slot.id]: 1 } });
        XG.balance.recordMarketPill(slot.id,slot.price*(slot.cur==='lingYu'?500:1));
      }
      else if (slot.kind === 'egg') XG.addRes({ egg: 1 });
      else if (slot.kind === 'recipe') {
        const al = XG.sys.alchemy;
        if (al && typeof al.learn === 'function') {
          al.learn(slot.id);
          got = slot.name + '（已參悟）';
        } else {
          XG.addRes({ lingShi: 2000 });
          got += '（丹道未開，折算靈石）';
        }
      }
      else if (slot.kind === 'frag') {
        const g = XG.sys.gongfa;
        if (g && typeof g.addFrag === 'function') g.addFrag(slot.id, 1);
        else XG.addRes({ frag: { [slot.id]: 1 } }); // 降級：直接入殘篇袋
      } else if (slot.kind === 'equip') {
        const fg = XG.sys.forge;
        if (fg && typeof fg.createEquip === 'function') {const eq=fg.createEquip(slot.baseId,slot.grade);if(eq)eq.marketPaidStone=slot.price*(slot.cur==='lingYu'?500:1);}
        else { // 降級：發等階礦石
          const oreByGrade = { 0: 'ore_heite', 1: 'ore_xuantie', 2: 'ore_miyin', 3: 'ore_hantie', 4: 'ore_xingchenjin' };
          const oid = oreByGrade[slot.grade] || 'ore_heite';
          XG.addRes({ mat: { [oid]: 2 } });
          got += '（煉器鋪未開，折算為材料）';
        }
      }
      if(slot.kind==='pill') budget.purchases[slot.id]=(budget.purchases[slot.id]||0)+1;
      XG.bus.emit('save:dirty');
      slot.n--;
      if (slot.n <= 0) slot.sold = true;
      const f = findFellow(slot.uid);
      if (f) { f.favor = U().clamp(f.favor + 1, 0, 100); } // 照顧生意略增好感
      const dealPool = (XG.data.fellows.marketLines && XG.data.fellows.marketLines.deal) || [];
      const line = dealPool.length ? fill(U().pick(dealPool), f || { name: '賣家' }, { item: slot.name }) : '';
      return { ok: true, msg: '購得 ' + got + '，花費' + slot.price + (slot.cur === 'lingYu' ? '靈玉' : '靈石') + '。' + line };
    },

    // 每日五次：5／10／20／40／80靈玉
    refreshMarket() {
      if (!marketUnlocked()) return { ok: false, msg: '坊市尚未開啓（築基5層解鎖）。' };
      ensureMarket();
      const info=XG.balance.marketRefreshInfo();
      if(!info.left)return {ok:false,msg:'今日5次換新已用完，明日再逛，掌櫃也要下班。'};
      if(!XG.hasRes({lingYu:info.cost}))return {ok:false,msg:'靈玉不足（本次需'+info.cost+'）。'};
      XG.addRes({lingYu:-info.cost});
      XG.balance.daily().marketRefreshes=info.used+1;
      genMarket(Date.now(),info.used+1);
      return {ok:true,cost:info.cost,msg:'坊市已換新。'};
    },

    /* -------- 道侶 -------- */
    partnerInfo() {
      const uid = S().player && S().player.partner;
      if (!uid) return null;
      const f = findFellow(uid);
      if (!f) return null;
      const d = S().daily || {};
      return {
        uid: f.uid, name: f.name, gender: f.gender, genderSymbol: XG.character.symbol(f.gender), realmName: realmName(f.realmIdx, f.layer),
        favor: f.favor, canDual: !(d.dualAt > Date.now()),
      };
    },

    // 結緣：好感=100，每日限 1 次結緣操作
    becomePartner(uid) {
      const f = findFellow(uid);
      if (!f || !f.alive) return { ok: false, msg: '查無此人。' };
      if (XG.character.needsChoice()) return { ok: false, msg: '先選好這一世的主角性別，再來尋找道侶。' };
      if (!XG.character.opposite(S().player.gender, f.gender)) return { ok: false, msg: '結為道侶需要雙方性別相反；同性別的道友仍可成為摯友。' };
      if (f.relation === 'partner') return { ok: false, msg: '你們已是道侶。' };
      if ((f.favor || 0) < FAVOR_PARTNER) return { ok: false, msg: '好感未滿（需' + FAVOR_PARTNER + '），結緣時機未到。' };
      const p = S().player;
      if (p.partner) return { ok: false, msg: '你已有道侶在身，豈可負心。' };
      const d = S().daily = S().daily || {};
      if (d.partner === dayStr()) return { ok: false, msg: '今日已行過結緣之禮，明日再來。' };
      d.partner = dayStr();

      f.relation = 'partner';
      f.favor = FAVOR_PARTNER;
      p.partner = f.uid;
      maxStat('fellow_partner', 1);
      XG.bus.emit('fellow:partner', { uid: f.uid });
      const text = fill(U().pick(lines().partner || ['「往後請多指教。」']), f);
      pushNews('fellow', '你與' + f.name + '結為道侶，紅綢十里，仙鶴來賀。' + text, 2, f.uid);
      // 專屬劇情 news 系列：即刻起每日一折
      S().fellowStory = { uid: f.uid, stage: 0, nextAt: Date.now() };
      XG.stats.invalidate(); // getMods 變化（cultRatePct+10）
      return { ok: true, msg: '你與' + f.name + '結為道侶！修煉速度永久+10%。', text: text };
    },

    // 雙修：每小時一次，修為加成（按道侶境界 rate 折算）
    dualCultivate() {
      const info = this.partnerInfo();
      if (!info) return { ok: false, msg: '你尚無道侶。' };
      if (!info.canDual) return { ok: false, msg: '調息未畢，一個時辰後再修。' };
      const f = findFellow(info.uid);
      const d = S().daily = S().daily || {};
      d.dualAt = Date.now() + DUAL_CD_MS;
      const base = XG.balance.standardRate();
      const cult = giveCult(XG.balance.activityCult(base * U().randInt(600, 1200)), '與' + f.name + '雙修');
      const text = fill(U().pick(lines().partner || ['「雙修共進。」']), f);
      return { ok: true, msg: '與' + f.name + '雙修一回，修為+' + U().fmt(cult), cult: cult, text: text };
    },
  };

  XG.sysOrder.push('fellows');
})();
