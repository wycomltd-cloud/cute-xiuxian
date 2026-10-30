/* sys/gongfa.js：功法系統——殘篇合成/學習/升級/熟練度/裝備槽/羈絆/隱藏功法監聽/自創功法（契約 §10，純邏輯無 UI）
 *
 * ============================ UI 對接面（供 ui 層調用的全部查詢/操作函數） ============================
 * 常量（直接掛在 XG.sys.gongfa 上）：
 *   LV_MAX=20（功法等級上限） MAX_ACTIVE=4（裝備槽） MAX_CUSTOM=9（自創上限）
 *   PROF_PER_SEC=5/3（熟練度/秒，約 10 分鐘圓滿） PROF_BONUS=1.5（熟練圓滿後 eff 倍率）
 *   CREATE_FRAG_COST=24（自創一次消耗的任意殘篇總數）
 *
 * 查詢：
 *   listGongfa() → [vm]，全量功法視圖模型（data.list 按表序 + custom 尾隨），元素：
 *     { id, name, icon, grade, hidden, root, desc, getHint, idx(data 表序，custom 為 -1),
 *       fragNeed, fragHave,                  // 殘篇需求/持有（gongfa.frag 與 inv.frag 兩袋合計）
 *       unlocked, visible,                   // unlocked=可參悟（境界/隱藏條件達成）；visible=UI 是否亮出（隱藏功法未解鎖時顯示 ???）
 *       learned, lv, prof, profMax, profFull,// 已學信息（未學 lv=0/prof=0）
 *       active,                              // 是否已裝備
 *       learnable,                           // 未學 && 已解鎖 && 殘篇集滿
 *       upCost,                              // 下一級修為消耗（滿級/未學為 Infinity）
 *       effPerLv,                            // 每級 eff 原表
 *       effLines:[str],                      // 每級效果文案，如 '修煉速度 +1.5%'
 *       effNow:null|{eff,lines,lv,mult,profFull}, // 當前總效果（lv×倍率，圓滿×1.5）
 *       custom:bool }
 *   listBonds() → [{ id, name, desc, eff, effLines:[str], need:[gfId],
 *                    needStatus:[{id,name,owned}], active }]   // active=need 全部已學
 *   getDef(id) → def|null                    // 原始定義（普通功法查 data，自創查 state.custom）
 *   fragOf(gfId) → n                         // 兩袋殘篇合計
 *   unlockOk(def) → bool                     // 境界解鎖/隱藏條件是否滿足
 *   upCost(id) → number                      // 升級修為消耗（滿級 Infinity）
 *   effNow(id) → null|{eff,lines,lv,mult,profFull}
 *   effLines(eff, mult?) → [str]             // eff 對象轉文案（供羈絆/自創展示）
 *   canCreate() → {ok, msg?, cost?}          // 自創前置檢查（化神解鎖/上限 9/殘篇 24）
 *
 * 操作（均返回 {ok, msg?...}，失敗不扣資源）：
 *   learn(gfId)        → {ok, msg?}                 // 集滿殘篇合成學習（耗 fragNeed）
 *   upgrade(gfId)      → {ok, msg?, lv?, cost?}     // 耗修為升 1 級
 *   upgradeMax(gfId)   → {ok, times, lv}            // 連升至修為不足或滿級
 *   equip(gfId)        → {ok, msg?}                 // 裝備（≤4，需已學）
 *   unequip(gfId)      → {ok, msg?}
 *   toggle(gfId)       → 同 equip/unequip           // UI 單擊切換
 *   createCustom()     → {ok, msg?, def?}           // 自創 roll（耗任意殘篇×24，結果 def 見下）
 *   forgetCustom(id)   → {ok, msg?}                 // 遺忘自創功法（僅 custom）
 *   addFrag(gfId, n)   → {ok, total, degraded?}     // 【跨系統 API】發殘篇統一入口（守則 5）
 *
 * ============================ state.stats 寫入鍵（snake_case，守則 3） ============================
 *   gongfa_frag          累計獲得殘篇數        gongfa_learn        累計習得功法數
 *   gongfa_up            累計功法升級次數      gongfa_prof_max     熟練度圓滿次數
 *   gongfa_hidden_unlock 隱藏功法解鎖次數      gongfa_create       自創功法次數
 *   gongfa_forget        遺忘自創功法次數
 * （成就的 gongfaOwn/gongfaMaxLv/gongfaCreateCount/gongfaHidden 由 collection 直接讀 state.gongfa 子樹，本系統不重複計數）
 *
 * ============================ 事件 ============================
 * emit：'news'（+push state.news）、'codex:new' {kind:'gongfa', id}（習得/隱藏解鎖/自創）、
 *       'res:changed'、'save:dirty'
 * 訂閱（守則 4，隱藏功法 5 條件）：
 *   'alch:done' {explode}      → 炸爐計數 ≥10 解鎖 cond alchemy_explode_10（gf_danjie）
 *   'tower:clear' {layer≥33}   → 解鎖 tower_33（gf_qingtian）
 *   'fellow:gift' {ouhuang|persona='ouhuang'} → 解鎖 fellow_ouhuang_gift（gf_hongyun）
 *   'reincarn:done' {count}    → 解鎖 reincarn_1（gf_wangsheng）
 *   'codex:new' {kind:'pet'}   → codex.pet.length≥20 解鎖 codex_pet_20（gf_wanling）
 * 另有每 5s tick 兜底全量校驗（自恢復：兼容舊檔/輪迴後/事件漏發）。
 *
 * ============================ 隱藏內容 ============================
 * 5 部 cond 隱藏功法按上述事件解鎖；解鎖後 news(imp2) 播報 + codex:new；
 * 自創功法名字 12 次重 roll 防重名，grade 按玩家境界段上浮（化神 5~7 品 → 渡劫 8~9 品），eff 2~3 條帶 ±20% 歐非浮動。
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  // ============ 常量 ============
  const LV_MAX = 20;          // 功法等級上限（每級 eff 線性成長）
  const MAX_ACTIVE = 4;       // 裝備槽上限（state.gongfa.active）
  const MAX_CUSTOM = 9;       // 自創功法上限
  const PROF_PER_SEC = 5 / 3; // 裝備中功法熟練度增速（滿 1000 約 10 分鐘）
  const PROF_BONUS = 1.5;     // 熟練度圓滿後 eff 倍率
  const CREATE_FRAG_COST = 24;// 自創一次消耗的任意殘篇總數
  // 品階→升級消耗參考境界（無 unlock 字段的隱藏功法用；g1~3 煉氣，g4 築基，g5 金丹，g6 元嬰，g7 化神，g8 合體，g9 大乘）
  const GRADE_REALM = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 6, 9: 7 };
  // 隱藏功法 5 條件（data/gongfa.js 的 cond 取值）
  const HIDDEN_CONDS = ['alchemy_explode_10', 'tower_33', 'fellow_ouhuang_gift', 'reincarn_1', 'codex_pet_20'];
  // eff 鍵 → 展示文案
  const EFF_LABELS = {
    cultRatePct: '修煉速度', atkPct: '攻擊加成', defPct: '防禦加成', hpPct: '氣血加成',
    dropPct: '掉落加成', alchSuccPct: '煉丹成功率', forgeSuccPct: '鍛造成功率',
    breakSuccPct: '破境成功率', workPct: '雜務效率', offlineHours: '離線收益時長',
    atkFlat: '攻擊', defFlat: '防禦', hpFlat: '氣血', spdPct: '身法加成', spdFlat: '身法',
  };
  const FLAT_KEYS = { atkFlat: 1, defFlat: 1, hpFlat: 1, spdFlat: 1 };
  // 自創功法 eff 每品階強度係數（對齊 data：g7 cultRatePct≈2.5~3.5/級，g9≈6~7/級）
  const CREATE_EFF_SCALE = {
    cultRatePct: 0.7, atkPct: 0.65, defPct: 0.65, hpPct: 0.6, dropPct: 0.5,
    alchSuccPct: 0.4, forgeSuccPct: 0.35, workPct: 0.5, breakSuccPct: 0.12,
  };
  const CREATE_EFF_KEYS = Object.keys(CREATE_EFF_SCALE);

  let _map = null; // data list id→def 索引（惰性建立，避免頂層依賴 data）
  let _acc = 0;    // tick 節流計時器

  // ============ 內部助手 ============
  // 取 state.gongfa 子樹並懶初始化擴展字段（save.js 深合併保留多餘鍵，讀檔安全）
  function st() {
    const g = (XG.state.gongfa = XG.state.gongfa || { owned: {}, active: [], frag: {}, custom: [] });
    g.owned = g.owned || {}; g.active = g.active || []; g.frag = g.frag || {}; g.custom = g.custom || [];
    g.hiddenUnlock = g.hiddenUnlock || {};                    // {gfId:1} 已解鎖的 cond 隱藏功法
    g.hiddenProg = g.hiddenProg || { explode: 0, ouhuangGift: 0 }; // 隱藏條件進度
    g.hiddenProg.explode = g.hiddenProg.explode || 0;
    g.hiddenProg.ouhuangGift = g.hiddenProg.ouhuangGift || 0;
    g.bondSeen = g.bondSeen || {};                            // {bondId:1} 已播報過的激活羈絆
    return g;
  }

  function defMap() {
    if (!_map) {
      _map = {};
      const list = (XG.data.gongfa && XG.data.gongfa.list) || [];
      for (let i = 0; i < list.length; i++) _map[list[i].id] = list[i];
    }
    return _map;
  }

  // 查功法定義：先 data 表，再自創列表
  function getDef(id) {
    if (!id) return null;
    const m = defMap();
    if (m[id]) return m[id];
    const c = st().custom;
    for (let i = 0; i < c.length; i++) if (c[i].id === id) return c[i];
    return null;
  }

  // 成就/統計計數（守則 3：懶初始化 XG.state.stats）
  function bump(k, n) {
    const s = (XG.state.stats = XG.state.stats || {});
    s[k] = (s[k] || 0) + (n || 1);
  }

  // 傳聞推送（守則 7：emit + push state.news 截斷）
  function pushNews(cat, text, imp) {
    const obj = { t: Date.now(), cat: cat, text: text, imp: imp || 0 };
    const news = (XG.state.news = XG.state.news || []);
    news.unshift(obj);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (news.length > cap) news.length = cap;
    XG.bus.emit('news', obj);
  }

  function invalidate() { if (XG.stats && XG.stats.invalidate) XG.stats.invalidate(); }
  function dirty() { XG.bus.emit('save:dirty'); }

  // 殘篇兩袋合計（state.gongfa.frag 為主，inv.frag 兼容 addRes 路徑）
  function fragOf(gfId) {
    const g = st();
    const inv = XG.state.inv.frag || {};
    return (g.frag[gfId] || 0) + (inv[gfId] || 0);
  }

  // 扣除指定功法殘篇 n 張（先扣 gongfa.frag，再扣 inv.frag）
  function consumeFrag(gfId, n) {
    const g = st();
    let left = n;
    const own = g.frag[gfId] || 0;
    if (own > 0) {
      const take = Math.min(own, left);
      g.frag[gfId] -= take;
      if (g.frag[gfId] <= 0) delete g.frag[gfId];
      left -= take;
    }
    if (left > 0) XG.addRes({ frag: { [gfId]: -left } });
    XG.bus.emit('res:changed');
  }

  // 全部殘篇總數（兩袋所有 id 合計，自創消耗用）
  function totalFrags() {
    let t = 0;
    const g = st();
    for (const k in g.frag) t += g.frag[k];
    const inv = XG.state.inv.frag || {};
    for (const k in inv) t += inv[k];
    return t;
  }

  // 從任意殘篇中扣除 n 張（存量多的先扣）
  function consumeAnyFrags(n) {
    const g = st();
    const entries = [];
    for (const k in g.frag) entries.push({ inv: false, id: k, n: g.frag[k] });
    const inv = XG.state.inv.frag || {};
    for (const k in inv) entries.push({ inv: true, id: k, n: inv[k] });
    entries.sort((a, b) => b.n - a.n);
    let left = n;
    for (const e of entries) {
      if (left <= 0) break;
      const take = Math.min(e.n, left);
      if (e.inv) XG.addRes({ frag: { [e.id]: -take } });
      else {
        g.frag[e.id] -= take;
        if (g.frag[e.id] <= 0) delete g.frag[e.id];
      }
      left -= take;
    }
    XG.bus.emit('res:changed');
  }

  // 解鎖判定：cond 隱藏功法看 hiddenUnlock；unlock 看境界層數；自創/無門檻恆可
  function unlockOk(def) {
    if (!def) return false;
    if (def.custom) return true;
    if (def.cond) return !!st().hiddenUnlock[def.id];
    if (def.unlock) {
      const p = XG.state.player;
      const u = def.unlock;
      return p.realmIdx > u.realmIdx || (p.realmIdx === u.realmIdx && p.layer >= u.layer);
    }
    return true;
  }

  // 單個隱藏條件當前是否滿足（讀 state 自恢復，事件只做加速）
  function condMet(cond) {
    const g = st();
    const s = XG.state;
    const stats = s.stats || {};
    switch (cond) {
      case 'alchemy_explode_10':
        return (g.hiddenProg.explode || 0) >= 10 || (stats.pill_explode || 0) >= 10;
      case 'tower_33': {
        const dg = s.dungeon || {};
        return (dg.towerBest || 0) >= 33 || (dg.tower || 1) >= 33;
      }
      case 'fellow_ouhuang_gift':
        return !!g.hiddenProg.ouhuangGift;
      case 'reincarn_1':
        return (s.player.reincarn || 0) >= 1;
      case 'codex_pet_20':
        return (s.codex && s.codex.pet ? s.codex.pet.length : 0) >= 20;
    }
    return false;
  }

  // 解鎖某 cond 對應的全部隱藏功法：置可學習 + news 播報 + emit codex:new（守則 4）
  function unlockByCond(cond) {
    const g = st();
    const list = (XG.data.gongfa && XG.data.gongfa.list) || [];
    for (let i = 0; i < list.length; i++) {
      const def = list[i];
      if (def.cond !== cond || g.hiddenUnlock[def.id]) continue;
      g.hiddenUnlock[def.id] = 1;
      bump('gongfa_hidden_unlock');
      grantHiddenFrags(def);
      pushNews('system', '天機顯現！隱藏功法《' + def.name + '》現世，殘篇已齊備，可前往合成參悟。', 2);
      XG.bus.emit('codex:new', { kind: 'gongfa', id: def.id });
    }
    dirty();
  }

  // 隱藏功法殘篇保送：解鎖（cond 達成/境界達標）即一次性補足殘篇至 fragNeed。
  // 緣由：隨機殘篇池一律過濾 hidden，連鎖終點各僅 ×2 片，隱藏功法曾解鎖亦永不可合成。
  // granted 防重（含老檔一次性補發）；已習得/殘篇已足者僅標記。
  function grantHiddenFrags(def) {
    const g = st();
    g.granted = g.granted || {};
    if (g.granted[def.id] || g.owned[def.id]) return;
    const need = def.fragNeed || 0;
    if (!need) { g.granted[def.id] = 1; return; }
    const have = fragOf(def.id);
    g.granted[def.id] = 1;
    if (have >= need) return;
    addFrag(def.id, need - have);
    pushNews('system', '《' + def.name + '》殘篇 ' + (need - have) + ' 片隨天機而至，已然集齊。', 1);
  }

  // 全量校驗 5 個隱藏條件（init 自恢復 + tick 兜底）；順帶為境界解鎖型隱藏功法（軒轅/歸墟）保送殘篇
  function checkConds() {
    for (let i = 0; i < HIDDEN_CONDS.length; i++) {
      if (condMet(HIDDEN_CONDS[i])) unlockByCond(HIDDEN_CONDS[i]);
    }
    const list = (XG.data.gongfa && XG.data.gongfa.list) || [];
    for (let i = 0; i < list.length; i++) {
      const def = list[i];
      if (def.hidden && !def.cond && unlockOk(def)) grantHiddenFrags(def);
    }
  }

  // 羈絆是否激活：need 全部已學
  function bondActive(bond) {
    const ow = st().owned;
    for (let i = 0; i < bond.need.length; i++) if (!ow[bond.need[i]]) return false;
    return true;
  }

  // 羈絆激活檢測：notify=true 時對首次激活的羈絆播報（init 時用 false 播種防刷屏）
  function checkBonds(notify) {
    const g = st();
    const bonds = (XG.data.gongfa && XG.data.gongfa.bonds) || [];
    for (let i = 0; i < bonds.length; i++) {
      const b = bonds[i];
      if (!bondActive(b) || g.bondSeen[b.id]) continue;
      g.bondSeen[b.id] = 1;
      if (notify) {
        pushNews('player', '功法共鳴！羈絆「' + b.name + '」激活——' + b.desc, 1);
        invalidate(); // 羈絆 eff 進 getMods
      }
    }
  }

  // eff 對象 → 展示文案數組（mult=倍率，默認每級）
  function effLines(eff, mult) {
    mult = mult || 1;
    const out = [];
    for (const k in eff) {
      const v = Math.round(eff[k] * mult * 10) / 10;
      const label = EFF_LABELS[k] || k;
      if (k === 'offlineHours') out.push(label + ' +' + v + ' 小時');
      else if (FLAT_KEYS[k]) out.push(label + ' +' + v);
      else out.push(label + ' +' + v + '%');
    }
    return out;
  }

  // 當前已學功法的實際總效果（lv 線性 × 圓滿 1.5）
  function effNow(id) {
    const g = st();
    const ow = g.owned[id];
    const def = getDef(id);
    if (!ow || !def || !def.eff) return null;
    const full = (ow.prof || 0) >= (def.profMax || 1000);
    const mult = ow.lv * (full ? PROF_BONUS : 1);
    const eff = {};
    for (const k in def.eff) eff[k] = Math.round(def.eff[k] * mult * 10) / 10;
    return { eff: eff, lines: effLines(def.eff, mult), lv: ow.lv, mult: mult, profFull: full };
  }

  // 升級修為消耗：參考境界 rate×3×lv²（滿級總耗≈該境界 2 小時修為，防單系統速通）
  function upCost(id) {
    const def = getDef(id);
    const ow = st().owned[id];
    if (!def || !ow || ow.lv >= LV_MAX) return Infinity;
    const rIdx = def.custom
      ? (def.born != null ? def.born : 4) // 自創功法按創生時境界段計價
      : (def.unlock ? def.unlock.realmIdx : (GRADE_REALM[def.grade] || 0));
    const base = (XG.cfg.REALMS[rIdx] || XG.cfg.REALMS[0]).rate * 3;
    return Math.ceil(base * ow.lv * ow.lv);
  }

  // 熟練度增長（裝備中的才漲）；collect 傳入數組時收集圓滿簡訊（offline 用），否則即時播報
  function gainProf(dt, collect) {
    const g = st();
    for (let i = 0; i < g.active.length; i++) {
      const id = g.active[i];
      const ow = g.owned[id];
      const def = getDef(id);
      if (!ow || !def) continue;
      const max = def.profMax || 1000;
      if ((ow.prof || 0) >= max) continue;
      ow.prof = Math.min(max, (ow.prof || 0) + dt * PROF_PER_SEC);
      if (ow.prof >= max) {
        bump('gongfa_prof_max');
        const txt = '《' + def.name + '》臻至圓滿，收發由心，威力倍增（效果×' + PROF_BONUS + '）！';
        if (collect) collect.push(txt);
        else pushNews('player', txt, 1);
        invalidate(); // ×1.5 生效
      }
    }
  }

  // 自創名字查重（普通 + 自創）
  function nameTaken(name) {
    const list = (XG.data.gongfa && XG.data.gongfa.list) || [];
    for (let i = 0; i < list.length; i++) if (list[i].name === name) return true;
    const c = st().custom;
    for (let i = 0; i < c.length; i++) if (c[i].name === name) return true;
    return false;
  }

  // ============ 跨系統 API（守則 5）：發功法殘篇統一入口 ============
  function addFrag(gfId, n) {
    n = Math.floor(n || 0);
    if (n <= 0) return { ok: false, total: fragOf(gfId) };
    const def = getDef(gfId);
    if (!def || def.custom) {
      // 防禦：未知/自創 id 折算靈石，不報錯（守則 5 降級）
      XG.addRes({ lingShi: n * 100 });
      return { ok: false, total: 0, degraded: true };
    }
    const g = st();
    const before = fragOf(gfId);
    g.frag[gfId] = (g.frag[gfId] || 0) + n;
    bump('gongfa_frag', n);
    // 殘篇集滿提示（未學且已解鎖，恰好跨過門檻時）
    if (!g.owned[gfId] && before < (def.fragNeed || 0) && fragOf(gfId) >= (def.fragNeed || 0) && unlockOk(def)) {
      pushNews('system', '《' + def.name + '》殘篇已集齊，可前往功法界面參悟。', 1);
    }
    XG.bus.emit('res:changed');
    dirty();
    return { ok: true, total: fragOf(gfId) };
  }

  // ============ 學習 / 升級 / 裝備 ============
  function learn(gfId) {
    const g = st();
    const def = getDef(gfId);
    if (!def || def.custom) return { ok: false, msg: '查無此功法' };
    if (g.owned[gfId]) return { ok: false, msg: '已然習得' };
    if (!unlockOk(def)) return { ok: false, msg: '機緣未至，尚不可參悟' };
    const need = def.fragNeed || 0;
    if (fragOf(gfId) < need) return { ok: false, msg: '殘篇不足（' + fragOf(gfId) + '/' + need + '）' };
    consumeFrag(gfId, need);
    g.owned[gfId] = { lv: 1, prof: 0 };
    bump('gongfa_learn');
    pushNews('player', '你集齊殘篇，習得' + def.grade + '品功法《' + def.name + '》！', def.grade >= 8 ? 2 : 1);
    XG.bus.emit('codex:new', { kind: 'gongfa', id: gfId });
    checkBonds(true);
    invalidate();
    dirty();
    return { ok: true };
  }

  function upgrade(gfId) {
    const g = st();
    const ow = g.owned[gfId];
    const def = getDef(gfId);
    if (!ow || !def) return { ok: false, msg: '尚未習得此功法' };
    if (ow.lv >= LV_MAX) return { ok: false, msg: '已臻化境（滿級 ' + LV_MAX + '）' };
    const cost = upCost(gfId);
    if ((XG.state.player.cult || 0) < cost) return { ok: false, msg: '修為不足', cost: cost };
    XG.state.player.cult -= cost;
    ow.lv += 1;
    bump('gongfa_up');
    invalidate();
    XG.bus.emit('res:changed');
    dirty();
    return { ok: true, lv: ow.lv, cost: cost };
  }

  // 一鍵連升：修為夠就一直升到滿級
  function upgradeMax(gfId) {
    let times = 0;
    for (let i = 0; i < LV_MAX; i++) {
      const r = upgrade(gfId);
      if (!r.ok) break;
      times++;
    }
    const ow = st().owned[gfId];
    return { ok: times > 0, times: times, lv: ow ? ow.lv : 0 };
  }

  function equip(gfId) {
    const g = st();
    if (!g.owned[gfId]) return { ok: false, msg: '尚未習得此功法' };
    if (g.active.indexOf(gfId) >= 0) return { ok: false, msg: '已在裝備中' };
    if (g.active.length >= MAX_ACTIVE) return { ok: false, msg: '裝備槽已滿（' + MAX_ACTIVE + ' 個）' };
    g.active.push(gfId);
    invalidate();
    dirty();
    return { ok: true };
  }

  function unequip(gfId) {
    const g = st();
    const i = g.active.indexOf(gfId);
    if (i < 0) return { ok: false, msg: '並未裝備' };
    g.active.splice(i, 1);
    invalidate();
    dirty();
    return { ok: true };
  }

  function toggle(gfId) {
    return st().active.indexOf(gfId) >= 0 ? unequip(gfId) : equip(gfId);
  }

  // ============ 自創功法（化神 1 層解鎖，耗任意殘篇×24 roll 一次） ============
  function canCreate() {
    if (!(XG.cfg && XG.cfg.isUnlocked && XG.cfg.isUnlocked('gongfaCreate'))) {
      return { ok: false, msg: '化神一層方可自創功法' };
    }
    if (st().custom.length >= MAX_CUSTOM) {
      return { ok: false, msg: '自創功法已達上限（' + MAX_CUSTOM + ' 門），可遺忘後再創' };
    }
    if (totalFrags() < CREATE_FRAG_COST) {
      return { ok: false, msg: '殘篇不足（需任意功法殘篇×' + CREATE_FRAG_COST + '）' };
    }
    return { ok: true, cost: CREATE_FRAG_COST };
  }

  function createCustom() {
    const chk = canCreate();
    if (!chk.ok) return chk;
    const p = XG.state.player;
    consumeAnyFrags(CREATE_FRAG_COST);
    // 品階按境界段位上浮：化神 5~7 品 → 渡劫 8~9 品（歐非隨機）
    const grade = XG.util.clamp(XG.util.randInt(p.realmIdx, p.realmIdx + 3), 5, 9);
    // 拼名：前綴+核心+後綴，至多 12 次重 roll 防重名
    const pool = XG.data.gongfa.createPool;
    let name = '';
    for (let t = 0; t < 12; t++) {
      name = XG.util.pick(pool.prefix) + XG.util.pick(pool.core) + XG.util.pick(pool.suffix);
      if (!nameTaken(name)) break;
    }
    // roll 2~3 條 eff（55% 三條），強度=係數×品階×±20% 浮動
    const picked = XG.util.pickN(CREATE_EFF_KEYS, XG.util.chance(0.55) ? 3 : 2);
    const eff = {};
    for (let i = 0; i < picked.length; i++) {
      const k = picked[i];
      eff[k] = Math.max(0.1, Math.round(CREATE_EFF_SCALE[k] * grade * XG.util.rand(0.8, 1.3) * 10) / 10);
    }
    // 僅兩條時 40% 追加一條固定值詞條（攻/血）
    if (picked.length < 3 && XG.util.chance(0.4)) {
      if (XG.util.chance(0.5)) eff.atkFlat = Math.round(grade * grade * 2.5 * XG.util.rand(0.7, 1.3));
      else eff.hpFlat = Math.round(grade * grade * 15 * XG.util.rand(0.7, 1.3));
    }
    const id = 'gfc_' + XG.util.uid();
    const def = {
      id: id, name: name, icon: XG.util.pick(['悟', '創', '道', '玄', '意', '靈']),
      grade: grade, hidden: false, root: 'wuxing',
      desc: '你於' + XG.cfg.REALMS[p.realmIdx].name + '之境觀天悟道，融百家殘篇自成一訣。世間獨此一份。',
      eff: eff, profMax: 1000, fragNeed: 0,
      custom: true, born: p.realmIdx, ct: Date.now(),
      getHint: '自創功法，僅此一家。',
    };
    const g = st();
    g.custom.push(def);
    g.owned[id] = { lv: 1, prof: 0 }; // 自創即習得，可裝備可升級
    bump('gongfa_create');
    pushNews('player', '開宗立派！你自創' + grade + '品功法《' + name + '》，自成一家之言。', grade >= 8 ? 2 : 1);
    XG.bus.emit('codex:new', { kind: 'gongfa', id: id });
    checkBonds(true);
    invalidate();
    dirty();
    return { ok: true, def: def };
  }

  function forgetCustom(gfId) {
    const g = st();
    let idx = -1;
    for (let i = 0; i < g.custom.length; i++) if (g.custom[i].id === gfId) { idx = i; break; }
    if (idx < 0) return { ok: false, msg: '僅自創功法可遺忘' };
    const def = g.custom[idx];
    g.custom.splice(idx, 1);
    delete g.owned[gfId];
    const ai = g.active.indexOf(gfId);
    if (ai >= 0) g.active.splice(ai, 1);
    bump('gongfa_forget');
    pushNews('system', '你將自創功法《' + def.name + '》付之一炬，從此江湖再無此訣。', 0);
    invalidate();
    dirty();
    return { ok: true };
  }

  // ============ UI 視圖模型 ============
  function listGongfa() {
    const g = st();
    const out = [];
    const list = (XG.data.gongfa && XG.data.gongfa.list) || [];
    for (let i = 0; i < list.length; i++) {
      const def = list[i];
      const ow = g.owned[def.id];
      const unlocked = unlockOk(def);
      const full = !!ow && (ow.prof || 0) >= (def.profMax || 1000);
      out.push({
        id: def.id, name: def.name, icon: def.icon, grade: def.grade, hidden: !!def.hidden,
        root: def.root, desc: def.desc, getHint: def.getHint, idx: i,
        fragNeed: def.fragNeed || 0, fragHave: fragOf(def.id),
        unlocked: unlocked,
        visible: !def.hidden || unlocked || !!ow, // 隱藏功法未解鎖時 UI 顯示 ???
        learned: !!ow, lv: ow ? ow.lv : 0,
        prof: ow ? Math.floor(ow.prof || 0) : 0, profMax: def.profMax || 1000, profFull: full,
        active: g.active.indexOf(def.id) >= 0,
        learnable: !ow && unlocked && fragOf(def.id) >= (def.fragNeed || 0),
        upCost: ow ? upCost(def.id) : Infinity,
        effPerLv: def.eff, effLines: effLines(def.eff),
        effNow: ow ? effNow(def.id) : null,
        custom: false,
      });
    }
    for (let i = 0; i < g.custom.length; i++) {
      const def = g.custom[i];
      const ow = g.owned[def.id];
      const full = !!ow && (ow.prof || 0) >= (def.profMax || 1000);
      out.push({
        id: def.id, name: def.name, icon: def.icon, grade: def.grade, hidden: false,
        root: def.root, desc: def.desc, getHint: def.getHint, idx: -1,
        fragNeed: 0, fragHave: 0,
        unlocked: true, visible: true,
        learned: !!ow, lv: ow ? ow.lv : 0,
        prof: ow ? Math.floor(ow.prof || 0) : 0, profMax: def.profMax || 1000, profFull: full,
        active: g.active.indexOf(def.id) >= 0,
        learnable: false,
        upCost: ow ? upCost(def.id) : Infinity,
        effPerLv: def.eff, effLines: effLines(def.eff),
        effNow: ow ? effNow(def.id) : null,
        custom: true,
      });
    }
    return out;
  }

  function listBonds() {
    const g = st();
    const bonds = (XG.data.gongfa && XG.data.gongfa.bonds) || [];
    return bonds.map(function (b) {
      return {
        id: b.id, name: b.name, desc: b.desc, eff: b.eff, effLines: effLines(b.eff),
        need: b.need,
        needStatus: b.need.map(function (id) {
          const d = getDef(id);
          return { id: id, name: d ? d.name : id, owned: !!g.owned[id] };
        }),
        active: bondActive(b),
      };
    });
  }

  // ============ 模塊協議（契約 §10） ============
  XG.sys.gongfa = {
    id: 'gongfa',

    // 常量暴露（UI 用）
    LV_MAX: LV_MAX, MAX_ACTIVE: MAX_ACTIVE, MAX_CUSTOM: MAX_CUSTOM,
    PROF_PER_SEC: PROF_PER_SEC, PROF_BONUS: PROF_BONUS, CREATE_FRAG_COST: CREATE_FRAG_COST,

    init() {
      const g = st();
      // 自恢復：active 僅保留已習得、定義存在、不重複的 id，上限 4
      const seen = {};
      const na = [];
      for (let i = 0; i < g.active.length; i++) {
        const id = g.active[i];
        if (g.owned[id] && getDef(id) && !seen[id] && na.length < MAX_ACTIVE) {
          seen[id] = 1;
          na.push(id);
        }
      }
      g.active = na;
      // 羈絆播種：已激活的靜默標記，避免每次上線重複播報
      checkBonds(false);

      // —— 隱藏功法 5 條件事件訂閱（守則 4，防禦性判斷 payload）——
      XG.bus.on('alch:done', function (p) {
        if (p && p.explode) {
          const gg = st();
          gg.hiddenProg.explode = (gg.hiddenProg.explode || 0) + 1;
          if (condMet('alchemy_explode_10')) unlockByCond('alchemy_explode_10');
        }
      });
      XG.bus.on('tower:clear', function (p) {
        if (p && (p.layer || 0) >= 33) unlockByCond('tower_33');
      });
      XG.bus.on('fellow:gift', function (p) {
        if (p && (p.ouhuang || p.persona === 'ouhuang')) {
          st().hiddenProg.ouhuangGift = 1;
          unlockByCond('fellow_ouhuang_gift');
        }
      });
      XG.bus.on('reincarn:done', function (p) {
        if (!p || (p.count || 1) >= 1) unlockByCond('reincarn_1');
      });
      XG.bus.on('codex:new', function (p) {
        if (p && p.kind === 'pet' && condMet('codex_pet_20')) unlockByCond('codex_pet_20');
      });

      // 兜底：按當前 state 全量校驗一次（舊檔/輪迴後/事件漏發自恢復）
      checkConds();
    },

    tick(dt) {
      gainProf(dt); // 裝備中功法熟練度掛機增長
      _acc += dt;
      if (_acc >= 5) { // 每 5s 兜底校驗隱藏條件與羈絆（防止事件漏發）
        _acc = 0;
        checkConds();
        checkBonds(true);
      }
    },

    // 離線結算：裝備中功法按離線時長補熟練度，圓滿者進報告簡訊
    offline(dt) {
      if (!dt || dt <= 0) return null;
      const ev = [];
      gainProf(dt, ev);
      return ev.length ? { events: ev } : null;
    },

    // 屬性聚合：已裝備功法 eff 總和（lv 線性，熟練圓滿×1.5）+ 已激活羈絆 eff
    getMods() {
      const g = st();
      const mods = {};
      const add = function (eff, mult) {
        for (const k in eff) mods[k] = (mods[k] || 0) + eff[k] * mult;
      };
      for (let i = 0; i < g.active.length; i++) {
        const id = g.active[i];
        const ow = g.owned[id];
        const def = getDef(id);
        if (!ow || !def || !def.eff) continue;
        const full = (ow.prof || 0) >= (def.profMax || 1000);
        add(def.eff, ow.lv * (full ? PROF_BONUS : 1));
      }
      const bonds = (XG.data.gongfa && XG.data.gongfa.bonds) || [];
      for (let i = 0; i < bonds.length; i++) if (bondActive(bonds[i])) add(bonds[i].eff, 1);
      return mods;
    },

    // 跨系統 API + 查詢/操作接口（見文件頭 UI 對接面）
    addFrag: addFrag,
    fragOf: fragOf,
    getDef: getDef,
    unlockOk: unlockOk,
    learn: learn,

    // 一鍵合成：批量參悟全部殘篇已集滿且已解鎖的未學功法（契約 quick 操作口徑）
    combineAll() {
      const g = st();
      const list = (XG.data.gongfa && XG.data.gongfa.list) || [];
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const def = list[i];
        if (!def || g.owned[def.id]) continue;
        if (!unlockOk(def)) continue;
        const need = def.fragNeed || 0;
        if (need <= 0 || fragOf(def.id) < need) continue;
        const r = learn(def.id);
        if (r && r.ok) out.push(def.name);
      }
      if (!out.length) return { ok: false, msg: '暫無可合成的功法（殘篇不足或均已習得）。' };
      return { ok: true, count: out.length, msg: '合成參悟《' + out.join('》《') + '》，共 ' + out.length + ' 部。' };
    },
    upgrade: upgrade,
    upgradeMax: upgradeMax,
    upCost: upCost,
    equip: equip,
    unequip: unequip,
    toggle: toggle,
    effNow: effNow,
    effLines: effLines,
    listGongfa: listGongfa,
    listBonds: listBonds,
    canCreate: canCreate,
    createCustom: createCustom,
    forgetCustom: forgetCustom,
    checkConds: checkConds,
  };
  XG.sysOrder.push('gongfa');
})();
