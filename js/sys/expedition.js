/* expedition.js：歷練探索系統（契約 §10 —— 地圖解鎖/派遣/結算/隱藏圖/一鍵派遣/離線結算）
 *
 * ============================ 玩法說明 ============================
 * - 系統解鎖：cfg.UNLOCKS.expedition（築基1層）；單圖另按 world.js maps[].unlock 境界解鎖。
 * - 派遣：選地圖 + 1~3 只靈寵 + 時長檔（1分/3分/10分鐘）。同時最多 3 隊：
 *   第 2 隊欄位=金丹1層 或 靈玉200，第 3 隊欄位=化神1層 或 靈玉500。
 * - 結算規則（對齊 world.js drops 口徑註釋）：材料按權重抽 3/4/5 種（時長檔），
 *   每種 [min,max] 取整 × 時長係數 ×1/×3.2/×6；sp 特產按 min(1, 時長/1h) 概率判定，
 *   得 1/1/2 件（保底不打折）；
 *   pill/frag 按品階權重抽 1 檔，品階池分別隨機取 pills.js 成品丹 / gongfa.js 功法殘篇；
 *   eggChance / recipeChance 每次派遣獨立判定，並按 min(1, 時長/1h) 縮放
 *   （保持與舊 1h 檔相同的時產口徑）（丹方→alchemy.learnRandomRecipe，殘篇→gongfa.addFrag）。
 * - 戰力校驗：隊伍戰力 < map.power 時收益打折，factor = 0.5 + 0.5×(隊伍/需求)，夾在 [0.5,1]。
 * - 每次結算必觸發 1 次該地圖事件：調 adventure.triggerOnMap(mapId)（防禦性，可不存在/可拋錯）。
 * - 隨機性：6% 「鴻運當頭」材料翻倍；擅長「財(cai)」的靈寵每隻 +10% 材料產出。
 * - 隱藏圖：歸墟 cond youming_exp_30（幽冥澗派遣滿30次 + 大乘1層，自動解鎖+news）；
 *   龍淵 cond guixu_bi_5（渡劫1層 + 消耗 sp_guixu_bi×5 獻祭，自動解鎖+news）。
 * - quickDispatch：自動為空餘欄位挑空閒最強 ≤3 寵，選「地圖階位×戰力系數」最高的已解鎖圖派中途檔（3分鐘）。
 * - 連續歷練：setAuto 記憶派遣配置，隊伍結算後由 tick 按同配置自動再派（僅在線接續；
 *   離線結算不連派，回到線上後自動恢復）；地圖不可達/派遣失敗時自動中止併發傳聞。
 * - offline：啓動時結算所有已到期隊伍（未到期按剩餘時間跳過，不補釦不加速）。
 *
 * ============================ stats 寫入鍵（XG.state.stats，snake_case） ============================
 *   expedition_count   累計派遣次數（dispatch 成功時 +1）——對應 check.k expeditionCount
 *   expedition_done    累計完成結算次數（settle 時 +1）
 *   youming_exp        幽冥澗累計派遣次數（隱藏圖歸墟 cond 計數源）
 *   map_unlock         當前已解鎖歷練地圖數（含隱藏，變化時刷新）——對應 check.k mapUnlock
 *   hidden_map_unlock  當前已解鎖隱藏地圖數——對應 check.k hiddenMapUnlock
 *
 * ============================ emit 事件 ============================
 *   'expedition:done' {mapId}        每支隊伍結算完成時（含離線結算）
 *   'news'            news 對象       地圖解鎖/隱藏圖開啓/靈寵蛋/鴻運等（同時自 push 進 state.news）
 *   'save:dirty'                     隊伍狀態變動（派遣/結算/欄位解鎖）時
 *
 * ============================ offline 行為 ============================
 *   offline(dt)：逐隊檢查 endAt，已到期者完整結算（掉落、事件、計數、日誌一樣不少），
 *   未到期隊伍原樣保留；返回報告片段 {expedition:{done, items:[結算簡訊字符串]}}，無到期隊伍返回 null。
 *
 * ============================ UI 對接面（全部查詢/操作函數） ============================
 *   isUnlocked() → bool                              系統是否已解鎖（築基1層）
 *   DUR_OPTS → [{sec,label,kinds,mul,sp}]            時長檔定義（0=1分/1=3分/2=10分）
 *   getMaps() → [{id,name,icon,desc,hidden,power,sp,dur,unlock,condText,
 *                 unlocked:bool, lockedReason:string|null, dispatchCount:n}]
 *   getMap(mapId) → world.js 地圖原始對象 | null
 *   getSlots() → {max, used, list:[{idx, unlocked, lingYu, realmText}]}
 *   unlockSlot(idx) → {ok, msg}                      idx=1|2，境界達標免費，否則扣靈玉
 *   getActive() → [{id,mapId,mapName,icon,petUids,pets:[{uid,name,icon,lv}],
 *                   endAt,dur,durIdx,remainSec,progress(0~1)}]
 *   getIdlePets() → [{uid,name,icon,lv,power}]       未派遣且未被佔用的靈寵（按戰力降序）
 *   petPower(pet) → number                           單寵戰力（防禦性估算，見函數註釋）
 *   teamPower(petUids) → number
 *   estimateFactor(mapId, petUids) → {factor, teamPower, need}
 *   dispatch(mapId, petUids, durIdx) → {ok, msg, team?}
 *   quickDispatch() → {ok, msg:[...]}                一鍵派遣（契約 quick 操作口徑）
 *   setAuto(cfg|null) → {ok,msg}                     連續歷練開關（cfg={mapId, petUids, durIdx}）
 *   getAuto() → null|{mapId, petUids, durIdx, mapName, durLabel}
 *   getLog() → [{t,mapId,mapName,dur,factor,mat,pill,frag,egg,recipe,hongyun}]  最新在前，上限20
 *   checkHidden() → 手動觸發隱藏圖條件檢查（境界突破後 UI 可調，tick 每秒也會自檢）
 *
 * 依賴約定：只讀 XG.data.world / XG.data.pets / XG.data.pills / XG.data.gongfa / XG.cfg / XG.state；
 * 跨系統調用（cultivation/forge/alchemy/gongfa/adventure）全部防禦性判存，不存在則降級發靈石/材料。
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  /* ---------------- 常量 ---------------- */
  // 時長檔（對齊 world.js drops 口徑註釋：抽 3/4/5 種材料，係數 ×1/×3.2/×6；
  // sp 特產與蛋/丹方概率均按 min(1, 時長/1h) 縮放，sp 為中 1/1/2 件）
  const DUR_OPTS = [
    { sec: 60, label: '短途·一分', kinds: 3, mul: 1, sp: 1 },
    { sec: 180, label: '中途·三分', kinds: 4, mul: 3.2, sp: 1 },
    { sec: 600, label: '遠遊·十分', kinds: 5, mul: 6, sp: 2 },
  ];
  // 第 2/3 隊欄位解鎖規則（idx 即隊伍序號 1/2；第 1 隊默認開放）
  const SLOT_RULES = {
    1: { realmIdx: 2, layer: 1, lingYu: 200, realmText: '金丹1層' },
    2: { realmIdx: 4, layer: 1, lingYu: 500, realmText: '化神1層' },
  };
  const LOG_CAP = 20;      // 派遣日誌上限
  const HONGYUN_P = 0.06;  // 鴻運當頭（材料翻倍）概率
  const CAI_DROP_PCT = 0.1; // 每隻「財」擅長靈寵材料產出 +10%

  /* ---------------- 內部助手 ---------------- */
  // 狀態子樹（含本系統擴展鍵的懶初始化：slots=已購欄位, hidden=已解鎖隱藏圖, seen=已播報解鎖的地圖）
  function st() {
    const e = XG.state.expedition || (XG.state.expedition = { active: [], log: [] });
    e.active = e.active || [];
    e.log = e.log || [];
    e.slots = e.slots || {};   // {s2:true, s3:true} 靈玉購買的欄位
    e.hidden = e.hidden || {}; // {guixu:1, longyuan:1} 已解鎖隱藏圖
    e.seen = e.seen || {};     // 已播過解鎖傳聞的地圖 id
    if (e.auto === undefined) e.auto = null; // 連續歷練配置 {mapId, petUids, durIdx}（null=關閉）
    return e;
  }
  function stats() { return (XG.state.stats = XG.state.stats || {}); }
  function bump(k, n) { const s = stats(); s[k] = (s[k] || 0) + (n || 1); }
  function dirty() { XG.bus.emit('save:dirty'); }

  // 傳聞推送：unshift 進 state.news 並按 cfg.NEWS_CAP 截斷，同時 emit 'news'
  function pushNews(cat, text, imp) {
    const news = { t: Date.now(), cat: cat, text: text, imp: imp || 0 };
    const arr = XG.state.news || (XG.state.news = []);
    arr.unshift(news);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (arr.length > cap) arr.length = cap;
    XG.bus.emit('news', news);
  }

  function maps() { return (XG.data.world && XG.data.world.maps) || []; }
  function getMap(mapId) {
    const ms = maps();
    for (let i = 0; i < ms.length; i++) if (ms[i].id === mapId) return ms[i];
    return null;
  }
  // 境界達標判定（與 cfg.isUnlocked 同口徑，但作用於地圖自帶的 unlock 對象）
  function meetsRealm(u) {
    if (!u) return true;
    const p = XG.state.player;
    if (!p) return false;
    return p.realmIdx > u.realmIdx || (p.realmIdx === u.realmIdx && p.layer >= u.layer);
  }
  function realmName(realmIdx) {
    const r = XG.cfg.REALMS[realmIdx];
    return r ? r.name : '未知';
  }

  /* ---------------- 靈寵查詢（防禦性：pets 系統可能尚未註冊/實例結構待聯調） ---------------- */
  function petList() { return (XG.state.pets && XG.state.pets.list) || []; }
  function petJobs() {
    const ps = XG.state.pets || (XG.state.pets = { list: [], team: [], jobs: {} });
    return (ps.jobs = ps.jobs || {});
  }
  function findPet(uid) {
    const ls = petList();
    for (let i = 0; i < ls.length; i++) if (ls[i] && ls[i].uid === uid) return ls[i];
    return null;
  }
  function speciesOf(pet) {
    if (!pet || !XG.data.pets) return null;
    const sid = pet.sp || pet.spId || pet.speciesId || pet.species || pet.sid;
    if (!sid) return null;
    const sp = XG.data.pets.species || [];
    for (let i = 0; i < sp.length; i++) if (sp[i].id === sid) return sp[i];
    return null;
  }
  // 單寵戰力：優先委託 pets 系統權威口徑 powerOf（實例字段以其為準）；
  // 缺則本地估算——物種 base × 等級成長(8%/級) × 資質倍率 × 覺醒加成
  function petPower(pet) {
    if (!pet) return 0;
    const ps = XG.sys.pets;
    if (ps && typeof ps.powerOf === 'function') {
      try {
        const v = ps.powerOf(pet.uid);
        if (typeof v === 'number' && v > 0) return v;
      } catch (e) { /* 降級本地估算 */ }
    }
    if (typeof pet.atk === 'number' && typeof pet.def === 'number' && typeof pet.hp === 'number') {
      return XG.cfg.POWER({ atk: pet.atk, def: pet.def, hp: pet.hp, spd: pet.spd || 10 });
    }
    const sp = speciesOf(pet);
    if (!sp || !sp.base) return 0;
    const lv = pet.lv || 1;
    let mult = 1 + 0.08 * (lv - 1);
    let aptMult = 1;
    if (typeof pet.aptMult === 'number') aptMult = pet.aptMult;
    else if (typeof pet.apt === 'number' && XG.data.pets.aptTiers) {
      const tiers = XG.data.pets.aptTiers;
      for (let i = 0; i < tiers.length; i++) {
        if (pet.apt >= tiers[i].min && pet.apt <= tiers[i].max) { aptMult = tiers[i].mult; break; }
      }
    }
    mult *= aptMult;
    if (pet.awakened) mult *= 1.5;
    return XG.cfg.POWER({ atk: sp.base.atk * mult, def: sp.base.def * mult, hp: sp.base.hp * mult, spd: 10 });
  }
  function teamPower(petUids) {
    let sum = 0;
    (petUids || []).forEach(function (uid) { sum += petPower(findPet(uid)); });
    if (!(petUids || []).length) {
      // 獨自歷練（無寵同行）：以玩家自身戰力半數折算，保底收益係數 0.5 由此而來
      try { sum = (XG.stats.get().power || 0) * 0.5; } catch (e) { sum = 0; }
    }
    return sum;
  }
  function petView(pet) {
    const sp = speciesOf(pet) || {};
    return { uid: pet.uid, name: pet.name || sp.name || '靈寵', icon: pet.icon || sp.icon || '🐾', lv: pet.lv || 1 };
  }
  // 佔用判定：已在某支出徵隊伍中，或 pets.jobs 有崗位（explore/建築）
  function isPetBusy(uid) {
    const act = st().active;
    for (let i = 0; i < act.length; i++) {
      if ((act[i].petUids || []).indexOf(uid) >= 0) return true;
    }
    return !!petJobs()[uid];
  }
  function getIdlePets() {
    return petList()
      .filter(function (p) { return p && p.uid && !isPetBusy(p.uid); })
      .map(function (p) {
        const v = petView(p);
        v.power = petPower(p);
        return v;
      })
      .sort(function (a, b) { return b.power - a.power; });
  }

  /* ---------------- 地圖解鎖 ---------------- */
  function isMapUnlocked(map) {
    if (!map) return false;
    if (!map.hidden) return meetsRealm(map.unlock);
    return !!st().hidden[map.id];
  }
  // 隱藏圖 cond 判定（滿足即解鎖 + news，龍淵解鎖即消耗 sp_guixu_bi×5 獻祭）
  function checkHidden() {
    const e = st();
    maps().forEach(function (m) {
      if (!m.hidden || e.hidden[m.id]) return;
      if (!meetsRealm(m.unlock)) return;
      if (m.cond === 'youming_exp_30') {
        if ((stats().youming_exp || 0) >= 30) {
          e.hidden[m.id] = 1;
          pushNews('world', '夜半潮落，幽冥澗底忽現古渡。萬水歸處，「歸墟」之路悄然顯現！', 2);
        }
      } else if (m.cond === 'guixu_bi_5') {
        const have = (XG.state.inv.mat && XG.state.inv.mat.sp_guixu_bi) || 0;
        if (have >= 5) {
          XG.addRes({ mat: { sp_guixu_bi: -5 } }); // 五璧獻祭，祭壇啓門
          e.hidden[m.id] = 1;
          pushNews('world', '五枚歸墟殘璧沒入祭壇，龍吟自深淵而起，「龍淵」之門轟然中開！', 2);
        }
      }
    });
    refreshUnlockStats();
  }
  // 普通圖境界解鎖的新圖播報（init 時靜默標記已解鎖圖，避免老檔刷屏）
  function checkMapNews() {
    const e = st();
    maps().forEach(function (m) {
      if (!isMapUnlocked(m) || e.seen[m.id]) return;
      e.seen[m.id] = 1;
      if (m.hidden) {
        pushNews('world', '傳聞秘境「' + m.name + '」已現於世，可遣靈寵前往一探究竟。', 2);
      } else {
        pushNews('world', '雲遊四方，始知「' + m.name + '」之路已通，可遣靈寵前往歷練。', 0);
      }
    });
  }
  // 成就統計源：已解鎖地圖數/隱藏圖數（變化時才寫）
  function refreshUnlockStats() {
    const s = stats();
    let total = 0, hid = 0;
    maps().forEach(function (m) {
      if (isMapUnlocked(m)) { total++; if (m.hidden) hid++; }
    });
    if (s.map_unlock !== total) s.map_unlock = total;
    if (s.hidden_map_unlock !== hid) s.hidden_map_unlock = hid;
  }

  /* ---------------- 欄位 ---------------- */
  function slotUnlocked(idx) {
    if (idx <= 0) return true;
    const rule = SLOT_RULES[idx];
    if (!rule) return false;
    if (st().slots['s' + (idx + 1)]) return true;
    return meetsRealm({ realmIdx: rule.realmIdx, layer: rule.layer });
  }
  function maxSlots() {
    let n = 0;
    for (let i = 0; i < 3; i++) if (slotUnlocked(i)) n++;
    return n;
  }
  function getSlots() {
    const list = [];
    for (let i = 0; i < 3; i++) {
      const rule = SLOT_RULES[i];
      list.push({
        idx: i,
        unlocked: slotUnlocked(i),
        lingYu: rule ? rule.lingYu : 0,
        realmText: rule ? rule.realmText : '',
      });
    }
    return { max: maxSlots(), used: st().active.length, list: list };
  }
  function unlockSlot(idx) {
    if (idx !== 1 && idx !== 2) return { ok: false, msg: '欄位不存在。' };
    if (slotUnlocked(idx)) return { ok: false, msg: '該欄位已然可用。' };
    const rule = SLOT_RULES[idx];
    if (!XG.hasRes({ lingYu: rule.lingYu })) {
      return { ok: false, msg: '靈玉不足（需 ' + rule.lingYu + '），或臻' + rule.realmText + '自開。' };
    }
    XG.addRes({ lingYu: -rule.lingYu });
    st().slots['s' + (idx + 1)] = true;
    pushNews('system', '洞府靈光一閃，歷練隊伍欄位增至 ' + maxSlots() + ' 隊。', 0);
    dirty();
    return { ok: true, msg: '欄位已開，可同時派遣 ' + maxSlots() + ' 支隊伍。' };
  }

  /* ---------------- 掉落 roll（品階 → 具體 id） ---------------- */
  // 不放回權重抽 n 個（entries 元素需含 w 字段）
  function pickWeightedN(entries, n) {
    const pool = entries.slice();
    const out = [];
    while (pool.length && out.length < n) {
      const it = XG.util.weighted(pool, 'w');
      if (!it) break;
      out.push(it);
      pool.splice(pool.indexOf(it), 1);
    }
    return out;
  }
  // 按品階隨機取一個成品丹 id（優先非隱藏丹方；全空返回 null）
  function randomPillId(grade) {
    const R = (XG.data.pills && XG.data.pills.recipes) || [];
    let pool = R.filter(function (r) { return r.grade === grade && !r.hidden; });
    if (!pool.length) pool = R.filter(function (r) { return r.grade === grade; });
    if (!pool.length) pool = R.filter(function (r) { return !r.hidden; });
    const it = pool.length ? XG.util.pick(pool) : null;
    return it ? it.id : null;
  }
  // 按品階隨機取一個功法 id（優先非隱藏；全空返回 null）
  function randomGongfaId(grade) {
    const L = (XG.data.gongfa && XG.data.gongfa.list) || [];
    let pool = L.filter(function (g) { return g.grade === grade && !g.hidden; });
    if (!pool.length) pool = L.filter(function (g) { return g.grade === grade; });
    if (!pool.length) pool = L.filter(function (g) { return !g.hidden; });
    const it = pool.length ? XG.util.pick(pool) : null;
    return it ? it.id : null;
  }
  // 丹方學習（防禦性：alchemy 未註冊/無可學丹方則降級發靈石）
  function grantRecipe(maxLv) {
    const alch = XG.sys.alchemy;
    if (alch && typeof alch.learnRandomRecipe === 'function') {
      try {
        const r = alch.learnRandomRecipe(maxLv);
        if (r) return true; // 習得新丹方
      } catch (e) { /* 降級 */ }
    }
    XG.addRes({ lingShi: XG.balance.activityStone(500 * (maxLv || 1)) });
    return false;
  }
  // 殘篇發放（防禦性：gongfa 未註冊則塞揹包 inv.frag）
  function grantFrag(gfId, n) {
    const gf = XG.sys.gongfa;
    if (gf && typeof gf.addFrag === 'function') {
      try { gf.addFrag(gfId, n); return; } catch (e) { /* 降級 */ }
    }
    const delta = { frag: {} };
    delta.frag[gfId] = n;
    XG.addRes(delta);
  }
  // 地圖事件觸發（防禦性：adventure 未註冊/拋錯均吞掉）
  function triggerEvent(mapId, offline) {
    const adv = XG.sys.adventure;
    if (adv && typeof adv.triggerOnMap === 'function') {
      try {
        adv.triggerOnMap(mapId, offline ? { offline: true } : undefined);
        return true;
      } catch (e) { /* 忽略 */ }
    }
    return false;
  }

  /* ---------------- 結算 ---------------- */
  // 戰力系數：隊伍戰力不足 map.power 時收益打折（0.5~1）
  function powerFactor(map, tp) {
    if (!map || !map.power) return 1;
    if (tp >= map.power) return 1;
    return XG.util.clamp(0.5 + 0.5 * (tp / map.power), 0.5, 1);
  }

  // 結算一支隊伍（online/offline 共用），返回結算報告
  function settleTeam(team, isOffline) {
    const map = getMap(team.mapId);
    const opt = DUR_OPTS[team.durIdx] || DUR_OPTS[0];
    const pets = (team.petUids || []).map(findPet).filter(Boolean);
    const tp = teamPower(team.petUids);
    const factor = map ? powerFactor(map, tp) : 1;
    // 「財」擅長加成：每隻 +10% 材料產出
    let caiN = 0;
    pets.forEach(function (p) {
      const sp = speciesOf(p);
      if (sp && sp.apt && sp.apt.indexOf('cai') >= 0) caiN++;
    });
    const dropMul = 1 + CAI_DROP_PCT * caiN;

    const report = {
      t: Date.now(), mapId: team.mapId, mapName: map ? map.name : team.mapId,
      icon: map ? map.icon : '🗺️', dur: team.dur || opt.sec, factor: Math.round(factor * 100) / 100,
      mat: {}, pill: {}, frag: {}, egg: 0, recipe: false, hongyun: false, event: false, exp: 0,
    };
    const resDelta = { mat: {}, pill: {} };

    if (map && map.drops) {
      // ---- 材料：按權重抽 kinds 種，[min,max] × 時長係數 × 戰力系數 × 財加成 ----
      const entries = [];
      for (const id in map.drops.mat || {}) {
        const v = map.drops.mat[id];
        entries.push({ id: id, min: v[0], max: v[1], w: v[2] });
      }
      const picked = pickWeightedN(entries, opt.kinds);
      const hongyun = XG.util.chance(HONGYUN_P);
      report.hongyun = hongyun;
      picked.forEach(function (it) {
        let n = XG.util.randInt(it.min, it.max) * opt.mul * factor * dropMul;
        n = Math.max(1, Math.round(n));
        if (hongyun) n *= 2;
        report.mat[it.id] = (report.mat[it.id] || 0) + n;
      });
      // ---- sp 特產：按 min(1,時長/1h) 概率判定，中 1/1/2 件（保底不折扣）；特產同時折靈玉 ----
      const rareScale = Math.min(1, opt.sec / 3600);
      if (map.sp && XG.util.chance(rareScale)) {
        report.mat[map.sp] = (report.mat[map.sp] || 0) + opt.sp;
        const ly = XG.balance.activityJade(opt.sp); // 每件特產折 1 靈玉
        report.lingYu = (report.lingYu || 0) + ly;
      }
      // ---- 成品丹：品階權重抽 1 檔，品階池隨機 ----
      if (map.drops.pill) {
        const pe = [];
        for (const g in map.drops.pill) {
          const v = map.drops.pill[g];
          pe.push({ grade: parseInt(g.slice(1), 10) || 1, min: v[0], max: v[1], w: v[2] });
        }
        const pit = XG.util.weighted(pe, 'w');
        if (pit) {
          const n = Math.max(1, Math.round(XG.util.randInt(pit.min, pit.max) * factor));
          const pid = randomPillId(pit.grade);
          if (pid) report.pill[pid] = (report.pill[pid] || 0) + n;
          else resDelta.lingShi = (resDelta.lingShi || 0) + 200 * pit.grade * n; // 無此品階丹方，折靈石
        }
      }
      // ---- 功法殘篇：品階權重抽 1 檔 → gongfa.addFrag ----
      if (map.drops.frag) {
        const fe = [];
        for (const g2 in map.drops.frag) {
          const v2 = map.drops.frag[g2];
          fe.push({ grade: parseInt(g2.slice(1), 10) || 1, min: v2[0], max: v2[1], w: v2[2] });
        }
        const fit = XG.util.weighted(fe, 'w');
        if (fit) {
          const n2 = Math.max(1, Math.round(XG.util.randInt(fit.min, fit.max) * factor));
          const gfId = randomGongfaId(fit.grade);
          if (gfId) {
            report.frag[gfId] = (report.frag[gfId] || 0) + n2;
            grantFrag(gfId, n2);
          } else {
            resDelta.lingShi = (resDelta.lingShi || 0) + 1500 * fit.grade * n2; // 折靈石
          }
        }
      }
      // ---- 靈寵蛋 / 丹方：獨立概率判定（受戰力系數影響；按 min(1,時長/1h) 縮放，保持時產口徑） ----
      if (XG.util.chance((map.drops.eggChance || 0) * factor * rareScale)) report.egg = 1;
      if (XG.util.chance((map.drops.recipeChance || 0) * factor * rareScale)) {
        let maxG = 1;
        for (const g3 in map.drops.pill || {}) maxG = Math.max(maxG, parseInt(g3.slice(1), 10) || 1);
        report.recipe = grantRecipe(maxG);
      }
    }

    // ---- 統一入賬 ----
    resDelta.mat = report.mat;
    resDelta.pill = report.pill;
    if (report.egg) resDelta.egg = report.egg;
    if(resDelta.lingShi) resDelta.lingShi=XG.balance.activityStone(resDelta.lingShi);
    if (report.lingYu) resDelta.lingYu = report.lingYu;
    XG.addRes(resDelta);

    // ---- 歷練靈寵獲得經驗（按獸欄打工速率 ×0.5 × 耗時） ----
    var totalExp = 0;
    (team.petUids || []).forEach(function (uid) {
      const pet = findPet(uid);
      if (!pet) return;
      const sp = speciesOf(pet);
      const grade = sp ? sp.grade : 1;
      const realmIdx = (XG.state.player || {}).realmIdx || 0;
      const expPs = (80 + 40 * grade) * (1 + realmIdx) * 0.5;
      const expGain = Math.floor(expPs * (team.dur || opt.sec));
      totalExp += expGain;
      try {
        const ps = XG.sys.pets;
        if (ps && typeof ps.addExp === 'function') ps.addExp(uid, expGain);
      } catch (e) { /* 防禦性 */ }
    });
    report.exp = totalExp;

    // ---- 釋放靈寵崗位 ----
    (team.petUids || []).forEach(function (uid) {
      const jobs = petJobs();
      if (jobs[uid] === 'explore') delete jobs[uid];
    });

    // ---- 必觸發 1 次地圖事件（防禦性） ----
    report.event = triggerEvent(team.mapId, !!isOffline);

    // ---- 計數 / 事件 / 日誌 / 傳聞 ----
    bump('expedition_done');
    XG.bus.emit('expedition:done', { mapId: team.mapId });
    const e = st();
    e.log.unshift(report);
    if (e.log.length > LOG_CAP) e.log.length = LOG_CAP;

    if (report.egg) {
      pushNews('world', '靈寵歷練歸來，竟於「' + report.mapName + '」銜回一枚靈寵蛋，祥瑞之兆！', 1);
    } else if (report.hongyun) {
      pushNews('world', '靈寵於「' + report.mapName + '」鴻運當頭，所攜天材地寶較往日翻倍。', 1);
    } else if (factor <= 0.6) {
      pushNews('world', '靈寵於「' + report.mapName + '」險象環生，力有不逮，所得寥寥。', 0);
    }
    refreshUnlockStats();
    dirty();
    return report;
  }

  /* ---------------- 派遣 ---------------- */
  function dispatch(mapId, petUids, durIdx) {
    if (!XG.cfg.isUnlocked('expedition')) return { ok: false, msg: '歷練之道尚未開啓（需築基1層）。' };
    const map = getMap(mapId);
    if (!map) return { ok: false, msg: '查無此圖。' };
    if (!isMapUnlocked(map)) {
      return { ok: false, msg: map.hidden ? (map.condText || '秘境未啓，機緣未到。') : '境界不足，難入「' + map.name + '」。' };
    }
    durIdx = durIdx | 0;
    if (durIdx < 0 || durIdx >= DUR_OPTS.length) durIdx = 0;
    const e = st();
    if (e.active.length >= maxSlots()) return { ok: false, msg: '歷練隊伍已滿（' + maxSlots() + ' 隊）。' };
    // 靈寵校驗：0~3 只（不遣靈寵即獨自歷練，戰力按自身半數折算）、存在、空閒、不重複
    const uids = [];
    (petUids || []).forEach(function (u) { if (u && uids.indexOf(u) < 0) uids.push(u); });
    if (uids.length > 3) return { ok: false, msg: '一隊至多遣 3 只靈寵同行。' };
    for (let i = 0; i < uids.length; i++) {
      if (!findPet(uids[i])) return { ok: false, msg: '所選靈寵不在囊中。' };
      if (isPetBusy(uids[i])) return { ok: false, msg: '所選靈寵另有差事，暫不可遣。' };
    }
    const dur = (map.dur && map.dur[durIdx]) || DUR_OPTS[durIdx].sec;
    const team = {
      id: XG.util.uid(), mapId: mapId, petUids: uids,
      endAt: Date.now() + dur * 1000, dur: dur, durIdx: durIdx,
    };
    e.active.push(team);
    const jobs = petJobs();
    uids.forEach(function (u) { jobs[u] = 'explore'; });
    bump('expedition_count');
    if (mapId === 'youming') { bump('youming_exp'); checkHidden(); }
    dirty();
    return { ok: true, msg: uids.length ? '靈寵已往「' + map.name + '」歷練（' + DUR_OPTS[durIdx].label + '）。' : '你獨自往「' + map.name + '」歷練（' + DUR_OPTS[durIdx].label + '）——無寵相助，收益以自身戰力半數折算。', team: team };
  }

  // 一鍵派遣：空餘欄位 × 空閒最強 ≤3 寵 × 期望收益最高圖 × 中途檔（3分鐘）
  function quickDispatch() {
    const msg = [];
    if (!XG.cfg.isUnlocked('expedition')) return { ok: false, msg: ['歷練之道尚未開啓（需築基1層）。'] };
    if (st().active.length >= maxSlots()) return { ok: false, msg: ['歷練隊伍已滿，靜候諸寵歸來。'] };
    const idle = getIdlePets();
    if (!idle.length) {
      // 無空閒靈寵：獨自歷練兜底（收益按自身戰力半數折算），破「無寵不能歷練」死局
      const tp0 = teamPower([]);
      let best0 = null, bestScore0 = -1;
      maps().forEach(function (m, idx) {
        if (!isMapUnlocked(m)) return;
        const score = (idx + 1) * powerFactor(m, tp0);
        if (score > bestScore0) { bestScore0 = score; best0 = m; }
      });
      if (!best0) return { ok: false, msg: ['尚無已解鎖的歷練地圖。'] };
      const r0 = dispatch(best0.id, [], 1);
      msg.push(r0.msg);
      if (r0.ok) {
        XG.sys.expedition.setAuto({ mapId: best0.id, petUids: [], durIdx: 1 });
        msg.push('連續歷練已自動開啓。');
      }
      return { ok: r0.ok, msg: msg };
    }
    const team = idle.slice(0, 3);
    const tp = team.reduce(function (s, p) { return s + p.power; }, 0);
    // 期望收益：地圖階位(靠後者厚) × 戰力系數
    let best = null, bestScore = -1;
    const ms = maps();
    ms.forEach(function (m, idx) {
      if (!isMapUnlocked(m)) return;
      const score = (idx + 1) * powerFactor(m, tp);
      if (score > bestScore) { bestScore = score; best = m; }
    });
    if (!best) return { ok: false, msg: ['尚無已解鎖的歷練地圖。'] };
    const r = dispatch(best.id, team.map(function (p) { return p.uid; }), 1);
    msg.push(r.msg);
    if (r.ok) {
      XG.sys.expedition.setAuto({ mapId: best.id, petUids: team.map(function (p) { return p.uid; }), durIdx: 1 });
      msg.push('連續歷練已自動開啓。');
      if (powerFactor(best, tp) < 1) msg.push('隊伍戰力未足「' + best.name + '」所需，歸來收益將打折扣。');
    }
    return { ok: r.ok, msg: msg };
  }

  /* ---------------- 查詢（UI 對接面） ---------------- */
  function getMaps() {
    const e = st();
    return maps().map(function (m) {
      const un = isMapUnlocked(m);
      let reason = null;
      if (!un) {
        reason = m.hidden
          ? (m.condText || '機緣未到')
          : '需臻 ' + realmName(m.unlock.realmIdx) + m.unlock.layer + ' 層';
      }
      return {
        id: m.id, name: m.name, icon: m.icon, desc: m.desc, hidden: !!m.hidden,
        power: m.power, sp: m.sp, dur: m.dur, unlock: m.unlock, condText: m.condText || '',
        unlocked: un, lockedReason: reason,
        dispatchCount: m.id === 'youming' ? (stats().youming_exp || 0) : 0,
        activeCount: e.active.filter(function (t) { return t.mapId === m.id; }).length,
      };
    });
  }
  function getActive() {
    const now = Date.now();
    return st().active.map(function (t) {
      const m = getMap(t.mapId) || {};
      const total = (t.dur || 1) * 1000;
      return {
        id: t.id, mapId: t.mapId, mapName: m.name || t.mapId, icon: m.icon || '🗺️',
        petUids: t.petUids.slice(),
        pets: t.petUids.map(function (u) { const p = findPet(u); return p ? petView(p) : { uid: u, name: '靈寵', icon: '🐾', lv: 1 }; }),
        endAt: t.endAt, dur: t.dur, durIdx: t.durIdx,
        remainSec: Math.max(0, Math.ceil((t.endAt - now) / 1000)),
        progress: XG.util.clamp(1 - (t.endAt - now) / total, 0, 1),
      };
    });
  }
  function estimateFactor(mapId, petUids) {
    const m = getMap(mapId);
    const tp = teamPower(petUids);
    return { factor: m ? powerFactor(m, tp) : 1, teamPower: tp, need: m ? m.power : 0 };
  }
  function getLog() { return st().log; }

  /* ---------------- 連續歷練（結算後按記憶配置自動再派；僅在線接續，離線結算不連派） ---------------- */
  function runAuto() {
    const e = st();
    const a = e.auto;
    if (!a || e.active.length >= maxSlots()) return;
    const map = getMap(a.mapId);
    if (!map || !isMapUnlocked(map)) {
      e.auto = null;
      pushNews('world', '連續歷練中止：' + (map ? '「' + map.name + '」之路已斷，機緣不再。' : '目的地已不可達。'), 0);
      dirty();
      return;
    }
    // 靈寵忙/不在囊中者自動剔除；全體不可遣則獨自歷練亦可（dispatch 支持空隊）
    const uids = (a.petUids || []).filter(function (u) { return findPet(u) && !isPetBusy(u); });
    const r = dispatch(a.mapId, uids, a.durIdx);
    if (!r.ok) {
      e.auto = null;
      pushNews('world', '連續歷練中止：' + r.msg, 0);
      dirty();
    }
  }

  /* ---------------- 模塊協議（契約 §10） ---------------- */
  XG.sys.expedition = {
    id: 'expedition',
    DUR_OPTS: DUR_OPTS,

    // 自恢復：擴展鍵懶初始化、回補出征寵物崗位標記、清理殘損隊伍、靜默標記已解鎖圖
    init() {
      const e = st();
      e.active = e.active.filter(function (t) { return t && t.mapId && t.petUids && typeof t.endAt === 'number'; });
      const jobs = petJobs();
      e.active.forEach(function (t) {
        t.petUids.forEach(function (u) { if (findPet(u)) jobs[u] = 'explore'; });
      });
      checkHidden();
      // 靜默標記當前已解鎖地圖（防老檔首次加載連刷解鎖傳聞），之後由 tick 播報新解鎖
      maps().forEach(function (m) { if (isMapUnlocked(m)) e.seen[m.id] = 1; });
      refreshUnlockStats();
    },

    // 每秒：結算到期隊伍 + 連續歷練接續 + 隱藏圖條件自檢 + 新圖解鎖播報
    tick(dt) {
      const e = st();
      const now = Date.now();
      for (let i = e.active.length - 1; i >= 0; i--) {
        const t = e.active[i];
        if (t && typeof t.endAt === 'number' && t.endAt <= now) {
          e.active.splice(i, 1);
          settleTeam(t, false);
        }
      }
      runAuto();
      checkHidden();
      checkMapNews();
    },

    // 離線結算：到期隊伍完整結算，未到期跳過；返回報告片段
    offline(dt) {
      const e = st();
      const now = Date.now();
      const items = [];
      for (let i = e.active.length - 1; i >= 0; i--) {
        const t = e.active[i];
        if (t && typeof t.endAt === 'number' && t.endAt <= now) {
          e.active.splice(i, 1);
          const r = settleTeam(t, true);
          items.push('靈寵自「' + r.mapName + '」歷練歸來，攜迴天材地寶若干。');
        }
      }
      if (!items.length) return null;
      return { expedition: { done: items.length, items: items } };
    },

    // 本系統無永久屬性加成，不實現 getMods

    // ---- UI 對接面（見文件頭註釋） ----
    isUnlocked: function () { return XG.cfg.isUnlocked('expedition'); },
    getMaps: getMaps,
    getMap: getMap,
    getSlots: getSlots,
    unlockSlot: unlockSlot,
    getActive: getActive,
    getIdlePets: getIdlePets,
    petPower: petPower,
    teamPower: teamPower,
    estimateFactor: estimateFactor,
    dispatch: dispatch,
    quickDispatch: quickDispatch,
    // 連續歷練：cfg={mapId, petUids, durIdx} 開啓，null 關閉
    setAuto: function (cfg) {
      const e = st();
      if (!cfg) { e.auto = null; dirty(); return { ok: true, msg: '連續歷練已停止。' }; }
      const map = getMap(cfg.mapId);
      if (!map || !isMapUnlocked(map)) return { ok: false, msg: '此圖不可連續歷練。' };
      e.auto = { mapId: cfg.mapId, petUids: (cfg.petUids || []).slice(), durIdx: cfg.durIdx | 0 };
      dirty();
      return { ok: true, msg: '連續歷練已開啓：' + map.name + '，歸來後自動再派。' };
    },
    getAuto: function () {
      const a = st().auto;
      if (!a) return null;
      const m = getMap(a.mapId) || {};
      const opt = DUR_OPTS[a.durIdx] || DUR_OPTS[0];
      return { mapId: a.mapId, petUids: a.petUids.slice(), durIdx: a.durIdx, mapName: m.name || a.mapId, durLabel: opt.label };
    },
    getLog: getLog,
    checkHidden: checkHidden,
  };
  XG.sysOrder.push('expedition');
})();
