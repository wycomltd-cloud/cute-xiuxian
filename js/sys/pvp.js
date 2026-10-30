/* pvp.js：異步鬥法「論劍」系統（純邏輯層，契約 §10 模塊協議）
 *
 * 玩法：對手池=state.fellows（道友）；匹配=玩家戰力±40% 篩選 + 強度貼近/宿敵偏好，無匹配時全表隨機；
 *      戰鬥自動結算：雙方戰力 × 流派克制（劍→符→陣→丹→體→劍，剋制方 +15%）× 隨機 0.9~1.1，三局兩勝；
 *      週期=10 分鐘一輪，段位 pts 閾值：青銅0/白銀1200/黃金1500/白金1800/鑽石2100/仙尊2500；
 *      勝 +30 / 負 -15（按對手強度浮動）；連勝加成：2 連勝起每場勝利 +3 遞增、封頂 +30（敗北清零）；
 *      每日前 5 場發靈石+修為，之後僅 pts；戰報 history ≤20；
 *      每 10 分鐘按當前段位自動結算，發靈玉+隨機殘篇，進入可補領列表（不打也發基礎獎，不懲罰缺席）；
 *      宿敵聯動：對手 relation==='rival' 時防禦性調 XG.sys.fellows.onRivalBattle(win, uid)，
 *      fellows 系統未就位時自行用 lines.war 文案池發戰書 news 兜底。
 *
 * ==================== UI 對接面（本文件唯一對外接口，UI 代理以此為準） ====================
 * XG.sys.pvp.canFight()
 *   → { ok:bool, reason?:string }   // 未解鎖(金丹5層)/無道友時 ok=false 並附原因文案
 * XG.sys.pvp.match()
 *   → null | { uid, name, school, schoolName, persona, relation, realmIdx, layer, power }
 *   // 匹配一名對手的快照（不下注不改狀態）；無可用對手返回 null
 * XG.sys.pvp.fight(uid?)
 *   → { ok:false, reason } 或
 *     { ok:true, win, rounds:[bool..], opp:{uid,name,school,schoolName,relation,power},
 *       counter:'win'|'lose'|'none',        // 玩家剋制對方/被剋制/無剋制
 *       delta, pts,                          // pts 變化量與賽後總分
 *       tier:{id,name,min}, tierUp:bool, tierDown:bool,
 *       reward:null|{ cult, lingShi },       // 每日前5場纔有，之後為 null
 *       dailyLeft, streak, streakBonus,      // streak=賽後連勝數；streakBonus=本場連勝加成積分
 *       rival:bool, upset:bool }  // upset=越階挑戰(對手戰力≥1.3倍仍勝)
 * XG.sys.pvp.getOverview()
 *   → { unlocked, pts, tier:{id,name,min,idx}, nextTier:null|{id,name,min}, progress:0~1,
 *       wins, losses, streak, dailyLeft, dailyMax:5, season:'YYYY-Www',
 *       pending:[{season,tierId,tierName,lingYu,frags,t}], school, schoolName, historyLen }
 * XG.sys.pvp.getHistory()
 *   → [{ t, name, uid, win, delta, pts, rounds:[bool..], rival }]  // 新→舊，≤20 條
 * XG.sys.pvp.claimSeason()
 *   → { ok:false, reason } 或 { ok:true, count, lingYu, frags:{gfId:n} }  // 一鍵補領全部賽季獎勵
 * XG.sys.pvp.getSchool() → { id, name }            // 玩冢論劍流派（默認按靈根推導）
 * XG.sys.pvp.setSchool(id) → bool                  // id∈ jian/fu/zhen/dan/ti
 * XG.sys.pvp.getTiers() → TIERS 拷貝               // 段位表[{id,name,min,yu,frags}]
 * XG.sys.pvp.fellowPower(f) → number               // 道友戰力估算（fellows 系統有同名函數則委託之）
 *
 * ==================== 寫入的 state.stats 鍵（成就統計器讀這裏） ====================
 *   pvp_matches        累計論劍場次
 *   pvp_wins           累計勝場（check.k = pvpWins）
 *   pvp_losses         累計負場
 *   pvp_pts_max        積分歷史峯值（check.k = pvpPts）
 *   pvp_season_claims  賽季獎勵補領次數
 *   pvp_upsets         越階挑戰獲勝次數
 *
 * ==================== emit 的事件 ====================
 *   pvp:result { win, pts, delta }   // pts=賽後總積分，delta=本場積分變化（勝正負）
 *   news      { t, cat, text, imp }  // 段位升降/連勝/賽季結算/宿敵戰書等（經內部 pushNews）
 *
 * ==================== offline 行為 ====================
 *   offline(dt)：補做週期結算（與 tick/init 同一入口 checkSeason），
 *   若產生了新的待補領獎勵，返回 { events:['論劍週期結算…'] } 併入離線報告；否則返回 null。
 *
 * ==================== 埋的隱藏內容 ====================
 *   · 越階挑戰：對手戰力 ≥1.3 倍仍獲勝 → 額外 +5 pts 並播報 imp1 傳聞；
 *   · 歐皇送福：戰勝 persona==='ouhuang' 的對手有 5% 概率額外掉落 1 枚隨機功法殘篇；
 *   · 連勝播報：5/10/20 連勝各播一次傳聞（敗北清零）；
 *   · 宿敵戰書：擊敗/敗給宿敵後觸發對方戰書傳聞（fellows 系統接管時自動讓位）。
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  /* ---------------- 常量 ---------------- */
  // 段位表（min=達到積分；yu=10分鐘週期結算靈玉；frags=10分鐘週期結算殘篇數）
  const TIERS = [
    { id: 'qingtong', name: '青銅', min: 0,    yu: 0,  frags: 0 },
    { id: 'baiyin',   name: '白銀', min: 1200, yu: 1,  frags: 0 },
    { id: 'huangjin', name: '黃金', min: 1500, yu: 1,  frags: 1 },
    { id: 'bojin',    name: '白金', min: 1800, yu: 2,  frags: 1 },
    { id: 'zuanshi',  name: '鑽石', min: 2100, yu: 3,  frags: 1 },
    { id: 'xianzun',  name: '仙尊', min: 2500, yu: 5,  frags: 2 },
  ];
  // 流派克制環：key 剋制 value（劍→符→陣→丹→體→劍），剋制方戰力 +15%
  const COUNTER = { jian: 'fu', fu: 'zhen', zhen: 'dan', dan: 'ti', ti: 'jian' };
  const COUNTER_MULT = 1.15;
  // 靈根→默認論劍流派推導（金劍/木丹/水符/火體/土陣，變異兜底劍修）
  const ROOT2SCHOOL = { jin: 'jian', mu: 'dan', shui: 'fu', huo: 'ti', tu: 'zhen' };

  const MATCH_RANGE = 0.4;     // 匹配戰力窗口 ±40%
  const WIN_PTS = 30;          // 勝利基礎積分
  const LOSE_PTS = 15;         // 失敗基礎積分
  const DAILY_MAX = 5;         // 每日有獎勵場次
  const HISTORY_CAP = 20;      // 戰報上限
  const PENDING_CAP = 4;       // 賽季待補領獎勵緩存上限
  const UPSET_RATIO = 1.3;     // 越階挑戰判定：對手戰力 ≥ 1.3 × 玩家
  const UPSET_BONUS = 5;       // 越階挑戰額外積分
  const OUHUANG_FRAG_P = 0.05; // 戰勝歐皇額外掉殘篇概率
  const STREAK_PER = 3;        // 連勝加成：連勝中每場勝利額外 +3（2 連勝起生效）
  const STREAK_CAP = 30;       // 連勝加成封頂 +30

  /* ---------------- 內部助手 ---------------- */
  // 讀取（並懶初始化/自修復）pvp 狀態子樹
  function st() {
    const s = XG.state;
    s.pvp = s.pvp || {};
    const p = s.pvp;
    if (typeof p.pts !== 'number') p.pts = 1000;
    if (typeof p.wins !== 'number') p.wins = 0;
    if (typeof p.losses !== 'number') p.losses = 0;
    if (typeof p.season !== 'string') p.season = '';
    if (typeof p.claimed !== 'string') p.claimed = '';
    if (!Array.isArray(p.history)) p.history = [];
    if (!Array.isArray(p.pending)) p.pending = [];       // 賽季待補領 [{season,tierId,tierName,lingYu,frags,t}]
    if (typeof p.streak !== 'number') p.streak = 0;      // 當前連勝
    if (typeof p.school !== 'string' || !COUNTER[p.school]) p.school = ''; // 論劍流派（'' 待推導）
    if (p.auto === undefined) p.auto = null; // 自動連戰：null=關閉，{cd}=開啓+冷卻秒數
    return p;
  }

  // 跨系統統計累加（成就統計器讀 state.stats）
  function statsAdd(k, n) {
    const s = (XG.state.stats = XG.state.stats || {});
    s[k] = (s[k] || 0) + (n || 1);
  }

  // 傳聞推送：unshift 進 state.news 並按上限截斷，同時 emit 'news'
  function pushNews(cat, text, imp) {
    const s = XG.state;
    s.news = s.news || [];
    const item = { t: Date.now(), cat: cat, text: text, imp: imp || 0 };
    s.news.unshift(item);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (s.news.length > cap) s.news.length = cap;
    if (XG.bus) XG.bus.emit('news', item);
  }

  // 本地日期串 'YYYY/M/D'（與 main.js dayKey 一致，每日場次自愈用）
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  }

  // 當日已賽場次（daily 對象被 main.js 每日重置；這裏再按日期自愈一次，雙保險）
  function dailyCount() {
    const s = XG.state;
    s.daily = s.daily || { day: '', discuss: {}, help: {}, gift: 0 };
    if (s.daily.pvpDay !== todayKey()) { s.daily.pvpDay = todayKey(); s.daily.pvpCount = 0; }
    return s.daily.pvpCount || 0;
  }
  function dailyLeft() { return Math.max(0, DAILY_MAX - dailyCount()); }

  // 玩家戰力（stats 面板為準，異常時退化為境界裸基值）
  function playerPower() {
    try {
      const pw = XG.stats && XG.stats.get().power;
      if (typeof pw === 'number' && pw > 0) return pw;
    } catch (e) { /* ignore */ }
    const p = XG.state.player;
    const base = XG.cfg.REALM_BASE[p.realmIdx] || XG.cfg.REALM_BASE[0];
    return XG.cfg.POWER(base);
  }

  // 道友戰力估算：fellows 系統若提供 fellowPower 則委託（保證兩邊口徑一致），否則按境界基值×天賦×層數係數
  function fellowPower(f) {
    const fs = XG.sys.fellows;
    if (fs && typeof fs.fellowPower === 'function') {
      try {
        const v = fs.fellowPower(f);
        if (typeof v === 'number' && v > 0) return v;
      } catch (e) { /* ignore */ }
    }
    const base = XG.cfg.REALM_BASE[f.realmIdx || 0] || XG.cfg.REALM_BASE[0];
    const layerCoef = 1 + 0.06 * (((f.layer || 1) - 1));
    return XG.cfg.POWER(base) * (f.talent || 1) * layerCoef;
  }

  // 流派名查表（數據缺失時返回原 id）
  function schoolName(id) {
    const arr = (XG.data && XG.data.fellows && XG.data.fellows.schools) || [];
    for (const s of arr) if (s.id === id) return s.name;
    return id || '—';
  }

  // 積分→段位（返回拷貝，附 idx）
  function tierOf(pts) {
    let idx = 0;
    for (let i = 0; i < TIERS.length; i++) if (pts >= TIERS[i].min) idx = i;
    return { id: TIERS[idx].id, name: TIERS[idx].name, min: TIERS[idx].min, idx: idx };
  }

  // 發修為：優先走 cultivation 系統，缺位則直接加 state.player.cult（防禦性）
  function grantCult(n, src) {
    const cv = XG.sys.cultivation;
    if (cv && typeof cv.addCult === 'function') {
      try { cv.addCult(n, src); return; } catch (e) { /* fallthrough */ }
    }
    XG.state.player.cult = (XG.state.player.cult || 0) + n;
  }

  // 發功法殘篇：優先走 gongfa.addFrag，缺位則直接入揹包（防禦性）
  function grantFrag(gfId, n) {
    const gf = XG.sys.gongfa;
    if (gf && typeof gf.addFrag === 'function') {
      try { gf.addFrag(gfId, n); return; } catch (e) { /* fallthrough */ }
    }
    XG.addRes({ frag: { [gfId]: n } });
  }

  // 隨機抽一部非隱藏功法 id 作殘篇獎勵（低品權重略高；數據缺失返回 null）
  function randomFragGf() {
    const list = (XG.data && XG.data.gongfa && XG.data.gongfa.list) || [];
    const pool = [];
    for (const g of list) {
      if (!g || g.hidden || !g.id) continue;
      pool.push({ id: g.id, w: Math.max(1, 10 - (g.grade || 1)) });
    }
    if (!pool.length) return null;
    const hit = XG.util.weighted(pool, 'w');
    return hit ? hit.id : null;
  }

  /* ---------------- 10 分鐘週期結算 ---------------- */
  // 週期 id，每 10 分鐘一換（取代原來的周賽）
  function cycleId() { return 'C' + Math.floor(Date.now() / 600000); }

  // 跨週期檢測與結算：週期變更時按當前段位生成待補領獎勵（不打也發基礎獎，不懲罰缺席）
  function checkSeason() {
    const p = st();
    const cid = cycleId();
    if (p.season === cid) return null;
    const old = p.season;
    p.season = cid;
    if (!old) return null; // 新檔首記，無上週期可結算

    const tier = tierOf(p.pts);
    const tDef = TIERS[tier.idx];
    const frags = {};
    for (let i = 0; i < tDef.frags; i++) {
      const id = randomFragGf();
      if (id) frags[id] = (frags[id] || 0) + 1;
    }
    const reward = {
      season: old, tierId: tDef.id, tierName: tDef.name,
      lingYu: tDef.yu, frags: frags, t: Date.now(),
    };
    p.pending.unshift(reward);
    if (p.pending.length > PENDING_CAP) p.pending.length = PENDING_CAP; // 超上限丟棄最舊（防囤）
    pushNews('system', '論劍結算：' + tDef.name +
      '段位獎勵靈玉×' + tDef.yu + '、功法殘篇×' + tDef.frags + '，記得前往論劍臺補領。', 1);
    if (XG.bus) XG.bus.emit('save:dirty');
    return reward;
  }

  /* ---------------- 匹配 ---------------- */
  // 可用對手池：存活道友（alive!==false）
  function oppPool() {
    const arr = XG.state.fellows || [];
    const pool = [];
    for (const f of arr) if (f && f.alive !== false) pool.push(f);
    return pool;
  }

  // 匹配：±40% 戰力窗口內按「強度貼近 + 宿敵偏好」加權；無候選則全表隨機
  function match() {
    const pool = oppPool();
    if (!pool.length) return null;
    const pp = playerPower();
    const cands = [];
    for (const f of pool) {
      const fp = fellowPower(f);
      if (fp >= pp * (1 - MATCH_RANGE) && fp <= pp * (1 + MATCH_RANGE)) {
        // 權重：戰力越貼近越高；宿敵 ×2（排行互超，狹路相逢）
        let w = 1 / (0.1 + Math.abs(fp - pp) / Math.max(1, pp));
        if (f.relation === 'rival') w *= 2;
        cands.push({ f: f, w: w });
      }
    }
    let hit = null;
    if (cands.length) hit = XG.util.weighted(cands, 'w');
    const f = hit ? hit.f : XG.util.pick(pool);
    return {
      uid: f.uid, name: f.name, gender: f.gender, school: f.school, schoolName: schoolName(f.school),
      persona: f.persona, relation: f.relation || 'stranger',
      realmIdx: f.realmIdx || 0, layer: f.layer || 1, power: Math.round(fellowPower(f)),
    };
  }

  /* ---------------- 戰鬥結算 ---------------- */
  function fight(uid) {
    if (!XG.cfg.isUnlocked('pvp')) return { ok: false, reason: '論劍臺尚未開啓（需金丹5層）。' };
    const p = st();
    checkSeason();

    // 解析對手：指定 uid 則按 uid 找（找不到則重新匹配），否則走匹配
    let opp = null;
    if (uid) {
      const pool = oppPool();
      for (const f of pool) {
        if (f.uid === uid) {
          opp = {
            uid: f.uid, name: f.name, gender: f.gender, school: f.school, schoolName: schoolName(f.school),
            persona: f.persona, relation: f.relation || 'stranger',
            realmIdx: f.realmIdx || 0, layer: f.layer || 1, power: Math.round(fellowPower(f)),
          };
          break;
        }
      }
    }
    if (!opp) opp = match();
    if (!opp) return { ok: false, reason: '暫無道友可一戰，待廣結仙緣後再來。' };

    const mySchool = p.school || 'jian';
    const pp = playerPower();
    const op = Math.max(1, opp.power);
    // 流派克制（固定於整場）：我克對面 / 對面克我 / 無剋制
    const cmP = COUNTER[mySchool] === opp.school ? COUNTER_MULT : 1;
    const cmO = COUNTER[opp.school] === mySchool ? COUNTER_MULT : 1;
    const counter = cmP > 1 ? 'win' : (cmO > 1 ? 'lose' : 'none');

    // 三局兩勝：每局 戰力×剋制×隨機0.9~1.1
    const rounds = [];
    let pw = 0, ow = 0;
    while (pw < 2 && ow < 2) {
      const pr = pp * cmP * XG.util.rand(0.9, 1.1);
      const or_ = op * cmO * XG.util.rand(0.9, 1.1);
      const win = pr >= or_;
      rounds.push(win);
      if (win) pw++; else ow++;
    }
    const win = pw === 2;

    // 積分：勝 +30 / 負 -15，按對手強度比 r 浮動（勝強越多、負弱掉越多）
    const r = op / Math.max(1, pp);
    let delta;
    if (win) delta = Math.round(WIN_PTS * XG.util.clamp(r, 0.6, 1.6));
    else delta = -Math.round(LOSE_PTS * XG.util.clamp(1 / r, 0.6, 1.6));
    // 隱藏·越階挑戰：對手戰力 ≥1.3 倍仍獲勝，額外 +5
    const upset = win && r >= UPSET_RATIO;
    if (upset) delta += UPSET_BONUS;
    // 連勝加成：連勝越多勝場加分越多（2 連勝起 +3/場遞增，封頂 +30；敗北清零）
    // p.streak 此處為賽前連勝數：0=本場首勝無加成，1=2 連勝 +3，…，10 及以上封頂 +30
    let streakBonus = 0;
    if (win) {
      streakBonus = Math.min(STREAK_CAP, STREAK_PER * p.streak);
      delta += streakBonus;
    }

    const tierBefore = tierOf(p.pts);
    p.pts = Math.max(0, p.pts + delta);
    const tierAfter = tierOf(p.pts);
    const tierUp = tierAfter.idx > tierBefore.idx;
    const tierDown = tierAfter.idx < tierBefore.idx;

    // 戰績與統計
    if (win) { p.wins++; p.streak++; statsAdd('pvp_wins'); } else { p.losses++; p.streak = 0; statsAdd('pvp_losses'); }
    statsAdd('pvp_matches');
    const stats = (XG.state.stats = XG.state.stats || {});
    if (p.pts > (stats.pvp_pts_max || 0)) stats.pvp_pts_max = p.pts; // 積分歷史峯值（check.k=pvpPts）
    if (upset) statsAdd('pvp_upsets');

    // 每日前 5 場發獎勵（靈石+修為），之後僅 pts
    let reward = null;
    if (dailyLeft() > 0) {
      const pl = XG.state.player;
      const realm = XG.cfg.REALMS[pl.realmIdx] || XG.cfg.REALMS[0];
      const baseRate = realm.rate * (1 + 0.12 * (pl.layer - 1)); // 境界基礎產出（不含外部加成，防速通）
      const cult = Math.round(baseRate * (win ? 900 : 300) * XG.util.rand(0.9, 1.2)); // 勝≈15分鐘 / 負≈5分鐘
      const lingShi = Math.round(Math.pow(pl.realmIdx + 1, 1.5) * 200 * (win ? 1 : 0.4) * XG.util.rand(0.8, 1.3));
      grantCult(cult, win ? '論劍得勝' : '論劍惜敗');
      XG.addRes({ lingShi: lingShi });
      reward = { cult: cult, lingShi: lingShi };
      XG.state.daily.pvpCount = dailyCount() + 1;
    }

    // 戰報（≤20 條，新→舊）
    const rival = opp.relation === 'rival';
    p.history.unshift({
      t: Date.now(), name: opp.name, uid: opp.uid, win: win,
      delta: delta, pts: p.pts, rounds: rounds, rival: rival,
    });
    if (p.history.length > HISTORY_CAP) p.history.length = HISTORY_CAP;

    // 跨系統事件（payload 約定 {win, pts}，附 delta 便於訂閱方播報）
    if (XG.bus) XG.bus.emit('pvp:result', { win: win, pts: p.pts, delta: delta });

    // 宿敵聯動：優先交 fellows 系統發戰書；未就位則自行用 war 文案池兜底
    if (rival) {
      const fs = XG.sys.fellows;
      let handled = false;
      if (fs && typeof fs.onRivalBattle === 'function') {
        try { fs.onRivalBattle(win, opp.uid); handled = true; } catch (e) { handled = false; }
      }
      if (!handled) {
        const war = (XG.data && XG.data.fellows && XG.data.fellows.lines && XG.data.fellows.lines.war) || [];
        const line = war.length ? XG.util.pick(war) : '「{name}，擇日再戰！」';
        pushNews('fellow', line.replace(/\{name\}/g, opp.name), 1);
      }
    }

    // 隱藏·歐皇送福：戰勝歐皇 5% 概率額外掉 1 枚隨機殘篇
    if (win && opp.persona === 'ouhuang' && XG.util.chance(OUHUANG_FRAG_P)) {
      const gfId = randomFragGf();
      if (gfId) {
        grantFrag(gfId, 1);
        pushNews('player', '你與' + opp.name + '論劍得勝，對方興致大發，隨手贈你功法殘篇一枚，歐氣逼人。', 1);
      }
    }

    // 播報剋制刷屏控制：僅段位變動 / 越階 / 連勝節點發 news，普通場次靜默（看戰報即可）
    if (tierUp) pushNews('player', '論劍積分漲至 ' + p.pts + '，晉入「' + tierAfter.name + '」段位！', 1);
    else if (tierDown) pushNews('player', '論劍失利，積分滑落至 ' + p.pts + '，跌回「' + tierAfter.name + '」段位。', 0);
    if (upset) pushNews('player', '越階挑戰！你力克戰力高你三成的' + opp.name + '，+' + UPSET_BONUS + ' 額外積分，一時傳為佳話。', 1);
    if (win && (p.streak === 5 || p.streak === 10 || p.streak === 20)) {
      pushNews('player', '論劍臺捷報：你已豪取 ' + p.streak + ' 連勝，四方修士聞風側目。', 1);
    }

    if (XG.bus) XG.bus.emit('save:dirty');
    return {
      ok: true, win: win, rounds: rounds, opp: opp, counter: counter,
      delta: delta, pts: p.pts,
      tier: { id: tierAfter.id, name: tierAfter.name, min: tierAfter.min },
      tierUp: tierUp, tierDown: tierDown,
      reward: reward, dailyLeft: dailyLeft(), streak: p.streak, streakBonus: streakBonus,
      rival: rival, upset: upset,
    };
  }

  /* ---------------- 賽季獎勵補領 ---------------- */
  function claimSeason() {
    const p = st();
    checkSeason();
    if (!p.pending.length) return { ok: false, reason: '暫無待補領的賽季獎勵。' };
    let lingYu = 0;
    const frags = {};
    let lastSeason = '';
    for (const r of p.pending) {
      lingYu += r.lingYu || 0;
      for (const id in (r.frags || {})) frags[id] = (frags[id] || 0) + r.frags[id];
      lastSeason = r.season;
    }
    p.pending = [];
    p.claimed = lastSeason || p.claimed;
    if (lingYu > 0) XG.addRes({ lingYu: lingYu });
    for (const id in frags) grantFrag(id, frags[id]);
    statsAdd('pvp_season_claims');
    pushNews('player', '你補領了論劍賽季獎勵：靈玉×' + lingYu + '、功法殘篇×' +
      Object.keys(frags).reduce(function (a, k) { return a + frags[k]; }, 0) + '。', 1);
    if (XG.bus) XG.bus.emit('save:dirty');
    return { ok: true, count: 1, lingYu: lingYu, frags: frags };
  }

  /* ---------------- 查詢接口（UI 對接面） ---------------- */
  function canFight() {
    if (!XG.cfg.isUnlocked('pvp')) return { ok: false, reason: '論劍臺尚未開啓（需金丹5層）。' };
    if (!oppPool().length) return { ok: false, reason: '暫無道友可一戰。' };
    return { ok: true };
  }

  function getOverview() {
    const p = st();
    const tier = tierOf(p.pts);
    const next = tier.idx + 1 < TIERS.length ? TIERS[tier.idx + 1] : null;
    const span = next ? (next.min - tier.min) : 1;
    return {
      unlocked: XG.cfg.isUnlocked('pvp'),
      pts: p.pts,
      tier: { id: tier.id, name: tier.name, min: tier.min, idx: tier.idx },
      nextTier: next ? { id: next.id, name: next.name, min: next.min } : null,
      progress: next ? XG.util.clamp((p.pts - tier.min) / span, 0, 1) : 1,
      wins: p.wins, losses: p.losses, streak: p.streak,
      dailyLeft: dailyLeft(), dailyMax: DAILY_MAX,
      season: p.season, pending: XG.util.deepClone(p.pending),
      school: p.school, schoolName: schoolName(p.school),
      historyLen: p.history.length,
    };
  }

  function getHistory() { return XG.util.deepClone(st().history); }

  function getTiers() { return XG.util.deepClone(TIERS); }

  function getSchool() { return { id: st().school, name: schoolName(st().school) }; }

  function setSchool(id) {
    if (!COUNTER[id]) return false;
    st().school = id;
    if (XG.bus) XG.bus.emit('save:dirty');
    return true;
  }

  /* ---------------- 模塊協議（契約 §10） ---------------- */
  XG.sys.pvp = {
    id: 'pvp',

    // 啓動自恢復：修復狀態、推導默認論劍流派、補做跨周結算
    init() {
      const p = st();
      if (!p.school) {
        const root = XG.state.player && XG.state.player.spiritRoot;
        p.school = ROOT2SCHOOL[root && root.type] || 'jian';
      }
      checkSeason();
    },

    // 每秒：週期結算 + 自動連戰
    tick(dt) {
      checkSeason();
      const p = st();
      if (p.auto !== null) {
        p.auto.cd = (p.auto.cd || 0) - dt;
        if (p.auto.cd <= 0) {
          p.auto.cd = 3;
          try {
            const r = this.fight();
            if (r && r.ok) {
              XG.bus.emit('pvp:result', { win: r.win, pts: r.pts, delta: r.delta, opp: r.opp, streak: r.streak, tier: r.tier });
            }
          } catch (e) { /* 容錯 */ }
        }
      }
    },

    // 離線：補做賽季結算；有新待補領獎勵時併入離線報告
    offline(dt) {
      const before = st().pending.length;
      const r = checkSeason();
      if (r && st().pending.length > before) {
        return { events: ['論劍週期結算：' + r.tierName + '段位獎勵待補領（靈玉×' + r.lingYu + '）'] };
      }
      return null;
    },

    // 本系統無屬性加成，不實現 getMods

    // 對外接口
    canFight: canFight,
    match: match,
    fight: fight,
    getOverview: getOverview,
    getHistory: getHistory,
    claimSeason: claimSeason,
    getSchool: getSchool,
    setSchool: setSchool,
    getTiers: getTiers,
    fellowPower: fellowPower,
    // 自動連戰
    setAuto(on) { const p = st(); p.auto = on ? { cd: 0 } : null; XG.bus.emit('save:dirty'); },
    getAuto() { const a = st().auto; return a !== null; },
  };
  XG.sysOrder.push('pvp');
})();
