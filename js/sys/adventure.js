/* 文件名：adventure.js —— 隨機奇遇引擎（契約 §9.7 / §10；事件源 XG.data.events，98 條）
 *
 * 玩法實現對照（任務書深度 6 條）：
 * 1. 修煉觸發：修煉中每 5~15 分鐘（300~900s，state.adventure.cd 倒計時）roll 一次，
 *    池 = trigger 'cultivate'|'any' 且無 mapId，按 w 權重 + minRealm + cond 過濾；
 *    w<=0 與「被 chain 指向的事件」不進隨機池（連鎖專屬）；once 事件做完永不重複。
 * 2. 探索觸發：triggerOnMap(mapId) —— 該圖專屬事件（mapId 相同）+ 通用池
 *    （trigger 'explore'|'any' 且無 mapId），四級回退保證必出 1 條；有 pending 時插隊為下一樁。
 * 3. 連鎖：choice.out.chain 指向的事件進 state.adventure.queue，當前事件結算完立即優先觸發；
 *    鏈上每一步都可再 chain（軒轅/龍淵/歸墟 4 段鏈如此串成）。
 * 4. 條件 cond 九種全部實現：night(0~6點)/tox50/stuck3d(3天未破境)/power10m/fellow_partner/
 *    reincarn1/explode5(炸爐5次)/rich(靈石>1e6)/poor(靈石<100)。未知 cond 一律判 false（不誤放稀有事件）。
 * 5. 結算 out 全鍵：cult→cultivation.addCult（降級直接 cult+=）、lingShi/lingYu/mat/pill/egg→XG.addRes、
 *    frag→gongfa.addFrag（降級 addRes）、toxicity 正加負減 clamp 0~100、rootWash→免費洗靈根
 *    （優先 cultivation.washRootFree，降級本地按 roots 權重重洗）、meridian→免費點亮下一可點穴位
 *    （優先 cultivation.lightMeridianFree，降級本地直接點亮）、news→pushNews、ach→忽略（成就靠 stats 自動達成）、
 *    hiddenEnd→stats.hidden_end++ + 結界彈窗標記 + 豪華獎勵（靈玉 5~10 + 修為 rate×1800）+ imp:2 傳聞。
 * 6. 隨機性/數值：獎勵數值完全按數據表（已按 minRealm 境界 rate×秒數刻度），不打額外倍率；
 *    once/連鎖/隱藏結局均為一次性稀有體驗，歐非差異來自權重池與 9 種條件門。
 *
 * ==================== UI 對接面（本系統對外的全部查詢/操作函數） ====================
 * XG.sys.adventure.isUnlocked()
 *   → bool 奇遇系統是否已解鎖（煉氣2層，XG.cfg.isUnlocked('adventure')）。
 *
 * XG.sys.adventure.getPending()
 *   → null | { id, title, icon, text, via, choices:[{i, text, reqOk, reqText}] }
 *     當前待決事件（玩家三選一/二選一）。via: 'cultivate'修煉|'explore'探索|'chain'連鎖|'offline'離線歸來。
 *     choices[i].reqOk=false 時 UI 應置灰該選項；reqText 為可讀消耗串（如 '靈石×200、境界≥築基'）。
 *     UI 可輪詢本函數，或監聽 'adv:pending' 事件主動彈窗。
 *
 * XG.sys.adventure.choose(choiceIdx)
 *   → { ok:true, eventId, title, icon, msg:[結算文案…], rewards:{cult,lingShi,lingYu,mat,pill,frag,egg,
 *        toxicity,rootWash,meridian}, hiddenEnd:'結界文案'|undefined, chained:'後繼事件id'|undefined,
 *        next: getPending()|null（連鎖的下一樁，已自動置頂） }
 *     失敗 → { ok:false, err:'no_pending'|'bad_choice'|'req_not_met'|'event_gone' }
 *     （err='req_not_met' 時附 msg 文案）。調用即扣 req、發獎勵、記 once、emit 'adv:done'。
 *
 * XG.sys.adventure.triggerOnMap(mapId)
 *   → { ok:true, immediate:bool, queued:bool, event:{id,title,icon,text} }
 *     | { ok:false, err:'no_event' }
 *     探索/歷練到某圖時調用：必出 1 條。immediate=true 表示立即成為待決；否則排入隊列最前（queued=true）。
 *
 * XG.sys.adventure.getQueue()
 *   → [{id, title, icon}] 連鎖排隊中的事件（按觸發順序）。
 *
 * XG.sys.adventure.getCdLeft()  → int 秒，距下次修煉奇遇 roll 的倒計時（pending 期間暫停）。
 * XG.sys.adventure.getCdRange() → {min:300, max:900} 供 UI 展示「約 5~15 分鐘一樁」。
 *
 * XG.sys.adventure.getDoneInfo() → { count:int（done 記錄的不同事件數）, ids:[事件id…] }
 *
 * XG.sys.adventure.getHiddenEnd()   → null | {eventId, text, t} 未展示的隱藏結局結界彈窗標記。
 * XG.sys.adventure.clearHiddenEnd() → 清除該標記（UI 彈窗關閉後調用）。
 *
 * ==================== 寫入的 stats 鍵（XG.state.stats，snake） ====================
 *   adv_done    每結算一樁奇遇 +1（對應 check.k advDone；collection 亦可讀 state.adventure.done 計數）
 *   hidden_end  每達成一處隱藏結局 +1
 *
 * ==================== emit / on 事件 ====================
 *   emit 'adv:done'      {eventId}            結算完成（契約規定）
 *   emit 'adv:pending'   {eventId, via}       新待決事件產生（roll/探索/連鎖/離線）
 *   emit 'adv:hiddenEnd' {eventId, text}      達成隱藏結局（UI 可據此直接彈結界彈窗）
 *   on   'tick'                               主循環驅動 cd 倒計時（init 內訂閱）
 *   on   'realm:break' / 'realm:layer'        更新 lastBreakTs（stuck3d 判定基準）
 *   on   'alch:done'                          炸爐兜底計數（explode5 判定兜底）
 *
 * offline 行為：cd 照常流逝；若離線期間 cd 歸零且當前無待決，則補 roll 一樁作為「歸來機緣」
 * （至多 1 樁，via='offline'），並往總報告 events 裏塞一條簡訊。連鎖隊列離線不自動消化（需玩家抉擇）。
 *
 * 埋藏的隱藏內容（數據側已備，本引擎負責放出）：8 組連鎖（merchant/ruhuo/古洞遺府/靈狐報恩/鮫人/
 * 軒轅劍冢/龍淵/歸墟）+ 6 處 hiddenEnd 隱藏結局（ merchant_3 / eva_yifu / eva_baihu_3 /
 * evb_xuanyuan_3 / evb_longyuan_3 / evb_gui_xu_3，獎勵含隱藏功法 gf_xuanyuan / gf_guixu 殘篇）。
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  const CD_MIN = 60;    // 修煉奇遇最小間隔（秒）= 1 分鐘
  const CD_MAX = 180;   // 最大間隔（秒）= 3 分鐘
  const STUCK_MS = 3 * 86400000; // stuck3d：3 天未破境

  /* ---------------- 狀態存取（懶初始化，讀檔合併後自恢復） ---------------- */
  function adv() {
    const st = XG.state;
    const a = (st.adventure = st.adventure || {});
    a.done = a.done || {};          // {eventId: 完成次數}（once 判定 & advDone 口徑）
    a.chains = a.chains || {};      // 契約保留位：連鎖進度（本實現用 queue 承載，此處兼容存檔）
    if (typeof a.cd !== 'number') a.cd = 0; // 距下次修煉 roll 的倒計時（秒）
    a.queue = a.queue || [];        // 連鎖優先隊列 [eventId]
    if (a.pending === undefined) a.pending = null; // 當前待決 {id, via}
    if (typeof a.lastBreakTs !== 'number') a.lastBreakTs = 0; // 上次破境時間（stuck3d）
    if (typeof a.explodeSeen !== 'number') a.explodeSeen = 0; // 炸爐兜底計數（explode5）
    if (a.hiddenEnd === undefined) a.hiddenEnd = null; // 結界彈窗標記 {eventId, text, t}
    return a;
  }
  function stats() { return (XG.state.stats = XG.state.stats || {}); }

  /* ---------------- 事件索引（id 表 + 連鎖目標集合，帶緩存） ---------------- */
  let _cache = null;
  function index() {
    const evs = XG.data.events || [];
    if (_cache && _cache.evs === evs && _cache.size === evs.length) return _cache;
    const byId = {}, chainT = {};
    for (const e of evs) {
      if (!e || !e.id) continue;
      byId[e.id] = e;
      const cs = e.choices || [];
      for (const c of cs) {
        if (c && c.out && c.out.chain) chainT[c.out.chain] = 1;
      }
    }
    _cache = { evs: evs, size: evs.length, byId: byId, chainT: chainT };
    return _cache;
  }

  /* ---------------- cond 九種條件判定（未知 cond 判 false，不誤放稀有事件） ---------------- */
  const _condWarned = {};
  function condOk(cond) {
    if (!cond) return true;
    const st = XG.state, p = st.player, a = adv();
    switch (cond) {
      case 'night': { const h = new Date().getHours(); return h >= 0 && h < 6; }
      case 'tox50': return (p.toxicity || 0) >= 50;
      case 'stuck3d': {
        const base = a.lastBreakTs || st.createdAt || Date.now();
        return Date.now() - base >= STUCK_MS;
      }
      case 'power10m': {
        try { return (XG.stats.get().power || 0) > 1e7; } catch (e) { return false; }
      }
      case 'fellow_partner': {
        if (p.partner) return true;
        const fs = st.fellows || [];
        for (const f of fs) { if (f && f.relation === 'partner') return true; }
        return false;
      }
      case 'reincarn1': return (p.reincarn || 0) >= 1;
      case 'explode5': {
        const s = stats();
        return Math.max(s.pill_explode || 0, a.explodeSeen || 0) >= 5;
      }
      case 'rich': return (st.res.lingShi || 0) > 1e6;
      case 'poor': return (st.res.lingShi || 0) < 100;
      default:
        if (!_condWarned[cond]) { _condWarned[cond] = 1; console.warn('[adventure] 未知 cond：' + cond); }
        return false;
    }
  }

  /* ---------------- 隨機池過濾：w>0、非連鎖目標、once 未做、境界達標、cond 通過 ---------------- */
  function passBase(e) {
    const idx = index(), a = adv();
    if (!e || !e.id) return false;
    if ((e.w || 0) <= 0) return false;                 // w:0 = 連鎖專屬
    if (idx.chainT[e.id]) return false;                // 被 chain 指向 = 連鎖專屬
    if (e.once && a.done[e.id]) return false;          // once 永不重複
    if ((e.minRealm || 0) > XG.state.player.realmIdx) return false;
    return condOk(e.cond);
  }

  // 修煉池：trigger cultivate|any 且無 mapId（mapId 事件只在對應地圖出）
  function poolCultivate() {
    return index().evs.filter(function (e) {
      return !e.mapId && (e.trigger === 'cultivate' || e.trigger === 'any') && passBase(e);
    });
  }

  // 探索池：該圖專屬 + 通用（explore|any 無 mapId）；relax 逐級放寬保證「必出 1 條」
  function poolExplore(mapId, relax) {
    relax = relax || 0;
    return index().evs.filter(function (e) {
      if (!e || !e.id) return false;
      const isMap = e.mapId === mapId;
      const isGeneric = !e.mapId && (e.trigger === 'explore' || e.trigger === 'any');
      if (!isMap && !isGeneric) return false;
      if (relax >= 3) return true;                     // 兜底：只看歸屬
      if (relax < 2 && e.once && adv().done[e.id]) return false;
      if (relax < 1) {
        if ((e.w || 0) <= 0 || index().chainT[e.id]) return false;
        if ((e.minRealm || 0) > XG.state.player.realmIdx) return false;
        if (!condOk(e.cond)) return false;
      }
      return true;
    });
  }

  function rollCultivateEvent() {
    const pool = poolCultivate();
    if (!pool.length) return null;
    return XG.util.weighted(pool, 'w');
  }

  function rollExploreEvent(mapId) {
    for (let relax = 0; relax <= 3; relax++) {
      const pool = poolExplore(mapId, relax);
      if (pool.length) return XG.util.weighted(pool, 'w');
    }
    return null;
  }

  /* ---------------- 傳聞推送（emit 'news' + push 進 state.news，按 NEWS_CAP 截斷） ---------------- */
  function pushNews(text, cat, imp) {
    if (!text) return;
    const st = XG.state;
    st.news = st.news || [];
    const n = { t: Date.now(), cat: cat || 'world', text: text, imp: imp || 0 };
    st.news.unshift(n);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (st.news.length > cap) st.news.length = cap;
    XG.bus.emit('news', n);
  }

  /* ---------------- 跨系統發獎助手（全部防禦性，目標不在則降級不報錯） ---------------- */
  function giveCult(n, src) {
    if (!n) return;
    const cu = XG.sys.cultivation;
    if (cu && typeof cu.addCult === 'function') {
      try { cu.addCult(n, src); return; } catch (e) { /* 降級 */ }
    }
    XG.state.player.cult = (XG.state.player.cult || 0) + n;
    const s = stats();
    s.total_cult = (s.total_cult || 0) + n;
  }

  function giveFrag(gfId, n) {
    if (!gfId || !n) return;
    const gf = XG.sys.gongfa;
    if (gf && typeof gf.addFrag === 'function') {
      try { gf.addFrag(gfId, n); return; } catch (e) { /* 降級 */ }
    }
    const d = { frag: {} };
    d.frag[gfId] = n;
    XG.addRes(d);
  }

  // 免費洗靈根：優先 cultivation.washRootFree()；不在則本地按 roots 權重重洗（含變異/混沌小概率）
  function freeRootWash() {
    const cu = XG.sys.cultivation;
    if (cu && typeof cu.washRootFree === 'function') {
      try { return cu.washRootFree() || '靈根已重洗'; } catch (e) { /* 降級 */ }
    }
    const p = XG.state.player;
    const roots = (XG.data.gongfa && XG.data.gongfa.roots) || [];
    const commons = roots.filter(function (r) { return !r.hidden && ['jin', 'mu', 'shui', 'huo', 'tu'].indexOf(r.id) >= 0; });
    const muts = roots.filter(function (r) { return !r.hidden && ['bing', 'lei', 'feng', 'an', 'guang'].indexOf(r.id) >= 0; });
    const hundun = roots.filter(function (r) { return r.id === 'hundun'; })[0];
    p.spiritRoot = p.spiritRoot || { type: 'jin', grade: 3, mut: null };
    let name = '';
    if (hundun && XG.util.chance(0.01)) {
      p.spiritRoot.mut = 'hundun'; name = hundun.name;
    } else if (muts.length && XG.util.chance(0.15)) {
      const m = XG.util.weighted(muts, 'w');
      p.spiritRoot.mut = m.id; name = m.name;
    } else {
      const c = commons.length ? XG.util.weighted(commons, 'w') : { id: 'jin', name: '金靈根' };
      p.spiritRoot.type = c.id; p.spiritRoot.mut = null; name = c.name;
    }
    // 品相 1~5，低品常見高品稀有
    p.spiritRoot.grade = XG.util.weighted([{ g: 1, w: 30 }, { g: 2, w: 30 }, { g: 3, w: 20 }, { g: 4, w: 12 }, { g: 5, w: 8 }], 'w').g;
    if (XG.stats) XG.stats.invalidate();
    XG.bus.emit('save:dirty');
    return '靈根重洗為「' + name + '·' + p.spiritRoot.grade + '品」';
  }

  // 免費點亮下一可點穴位（need 前置全亮、自身未亮，按表序取第一個）；優先 cultivation API
  function freeMeridian() {
    const cu = XG.sys.cultivation;
    if (cu && typeof cu.lightMeridianFree === 'function') {
      try { return cu.lightMeridianFree(1) || '穴位已點亮'; } catch (e) { /* 降級 */ }
    }
    const p = XG.state.player;
    p.meridians = p.meridians || { lit: [] };
    const lit = p.meridians.lit;
    const table = (XG.data.gongfa && XG.data.gongfa.meridians) || [];
    for (const m of table) {
      if (lit.indexOf(m.id) >= 0) continue;
      const needs = m.need || [];
      let ok = true;
      for (const nd of needs) { if (lit.indexOf(nd) < 0) { ok = false; break; } }
      if (!ok) continue;
      lit.push(m.id);
      if (XG.stats) XG.stats.invalidate();
      XG.bus.emit('save:dirty');
      return '點亮穴位「' + m.name + '」（' + (m.branch || '經脈') + '）';
    }
    // 經脈全通：折成修為補償（30 分鐘檔）
    const rate = realmRate();
    giveCult(rate * 1800, '奇遇·經脈圓滿');
    return '經脈俱已貫通，化作修為 +' + XG.util.fmt(rate * 1800);
  }

  function realmRate() {
    const rs = XG.cfg.REALMS, p = XG.state.player;
    const r = rs[p.realmIdx] || rs[0];
    if (r.rate > 0) return r.rate;
    return (rs[p.realmIdx - 1] || rs[0]).rate; // 飛昇 rate=0 時按渡劫計
  }

  /* ---------------- 材料/丹藥/功法名查詢（reqText 與結算文案用，防禦性） ---------------- */
  function matName(id) { const m = XG.data.mats && XG.data.mats[id]; return (m && m.name) || id; }
  function pillName(id) {
    const rs = (XG.data.pills && XG.data.pills.recipes) || [];
    for (const r of rs) { if (r.id === id) return r.name; }
    return id;
  }
  function gfName(id) {
    const ls = (XG.data.gongfa && XG.data.gongfa.list) || [];
    for (const g of ls) { if (g.id === id) return g.name; }
    return id;
  }

  // choice.req 是否滿足（realmIdx 為境界校驗，其餘走 XG.hasRes）
  function reqOk(req) {
    if (!req) return true;
    if (req.realmIdx && XG.state.player.realmIdx < req.realmIdx) return false;
    return XG.hasRes(req);
  }

  function reqText(req) {
    if (!req) return '';
    const parts = [];
    if (req.lingShi) parts.push('靈石×' + XG.util.fmt(req.lingShi));
    if (req.lingYu) parts.push('靈玉×' + XG.util.fmt(req.lingYu));
    const bags = { mat: matName, pill: pillName, frag: gfName };
    for (const k in bags) {
      if (req[k]) for (const id in req[k]) parts.push(bags[k](id) + '×' + req[k][id]);
    }
    if (req.realmIdx) {
      const r = XG.cfg.REALMS[req.realmIdx];
      parts.push('境界≥' + (r ? r.name : req.realmIdx));
    }
    return parts.join('、');
  }

  /* ---------------- 待決事件 ---------------- */
  function setPending(id, via) {
    const a = adv();
    a.pending = { id: id, via: via };
    XG.bus.emit('adv:pending', { eventId: id, via: via });
    XG.bus.emit('save:dirty');
  }

  // 連鎖隊列優先：無待決時取出下一個有效連鎖事件置為待決
  function promoteQueue() {
    const a = adv();
    if (a.pending) return false;
    const idx = index();
    while (a.queue.length) {
      const id = a.queue.shift();
      const e = idx.byId[id];
      if (!e) continue;
      if (e.once && a.done[id]) continue; // 已完成的一次性連鎖不再出
      setPending(id, 'chain');
      return true;
    }
    return false;
  }

  function rollCd() { return XG.util.randInt(CD_MIN, CD_MAX); }

  function isUnlocked() {
    try { return XG.cfg.isUnlocked('adventure'); } catch (e) { return true; }
  }

  /* ---------------- 奇遇獎勵縮放 ---------------- */
  // 按玩家當前境界 rate 與事件 minRealm 基準 rate 的比例縮放數值獎勵
  function rewardScale(e) {
    const p = XG.state.player;
    const baseRate = XG.cfg.REALMS[(e.minRealm || 0)] ? XG.cfg.REALMS[e.minRealm || 0].rate : 10;
    const currRate = XG.cfg.REALMS[p.realmIdx] ? XG.cfg.REALMS[p.realmIdx].rate : baseRate;
    if (baseRate <= 0) return 1;
    return currRate / baseRate;
  }

  // 結果彈窗以完整整數顯示，不改動實際獎勵與丹毒精度。
  function resultInt(n) { return Math.round(n).toLocaleString('en-US'); }

  /* ---------------- out 結算 ---------------- */
  function settleOut(e, choice, result) {
    const out = choice.out || {};
    const p = XG.state.player;
    const msg = result.msg, rw = result.rewards;
    const src = '奇遇·' + e.title;
    // 奇遇獎勵隨境界縮放
    const scale = rewardScale(e);
    const sc = function (v) { return Math.max(1, Math.floor((v || 0) * scale)); };

    if (out.cult) { const v = sc(out.cult); giveCult(v, src); rw.cult = (rw.cult || 0) + v; msg.push('修為 +' + resultInt(v)); }
    if (out.lingShi || out.lingYu || out.mat || out.pill || out.egg) {
      const d = {};
      const ls = out.lingShi ? sc(out.lingShi) : 0;
      const ly = out.lingYu ? sc(out.lingYu) : 0;
      if (ls) d.lingShi = ls;
      if (ly) d.lingYu = ly;
      if (out.mat) d.mat = out.mat;
      if (out.pill) d.pill = out.pill;
      if (out.egg) d.egg = out.egg;
      XG.addRes(d);
      if (ls) { rw.lingShi = (rw.lingShi || 0) + ls; msg.push('靈石 +' + resultInt(ls)); }
      if (ly) { rw.lingYu = (rw.lingYu || 0) + ly; msg.push('靈玉 +' + resultInt(ly)); }
      if (out.mat) { rw.mat = rw.mat || {}; for (const id in out.mat) { rw.mat[id] = (rw.mat[id] || 0) + out.mat[id]; msg.push(matName(id) + '×' + out.mat[id]); } }
      if (out.pill) { rw.pill = rw.pill || {}; for (const id in out.pill) { rw.pill[id] = (rw.pill[id] || 0) + out.pill[id]; msg.push(pillName(id) + '×' + out.pill[id]); } }
      if (out.egg) { rw.egg = (rw.egg || 0) + out.egg; msg.push('靈寵蛋 +' + out.egg); }
    }
    if (out.frag) {
      rw.frag = rw.frag || {};
      for (const id in out.frag) {
        giveFrag(id, out.frag[id]);
        rw.frag[id] = (rw.frag[id] || 0) + out.frag[id];
        msg.push('《' + gfName(id) + '》殘篇×' + out.frag[id]);
      }
    }
    if (out.toxicity) {
      const old = p.toxicity || 0;
      p.toxicity = XG.util.clamp(old + out.toxicity, 0, 100); // 正加負減，clamp 0~100
      const real = p.toxicity - old;
      rw.toxicity = (rw.toxicity || 0) + real;
      if (real) msg.push(real > 0 ? '丹毒 +' + resultInt(real) : '丹毒 ' + resultInt(real));
      XG.bus.emit('res:changed');
    }
    if (out.rootWash) {
      const t = freeRootWash();
      rw.rootWash = (rw.rootWash || 0) + 1;
      msg.push(t);
    }
    if (out.meridian) {
      for (let i = 0; i < out.meridian; i++) {
        const t = freeMeridian();
        rw.meridian = (rw.meridian || 0) + 1;
        msg.push(t);
      }
    }
    if (out.news) pushNews(out.news, 'world', out.chain || out.hiddenEnd ? 1 : 0);
    if (out.ach) { /* 忽略：成就靠 stats 自動達成（契約 §9.7 口徑） */ }

    if (out.chain) {
      const a = adv(), idx = index();
      const te = idx.byId[out.chain];
      if (te && !(te.once && a.done[out.chain]) && a.queue.indexOf(out.chain) < 0) {
        a.queue.push(out.chain);
        result.chained = out.chain;
      }
    }

    if (out.hiddenEnd) {
      // 隱藏結局：結界彈窗標記 + stats.hidden_end++ + 豪華獎勵 + 高亮傳聞
      const a = adv(), s = stats();
      s.hidden_end = (s.hidden_end || 0) + 1;
      a.hiddenEnd = { eventId: e.id, text: out.hiddenEnd, t: Date.now() };
      const bonusYu = XG.util.randInt(5, 10);
      const bonusCult = realmRate() * 1800;
      XG.addRes({ lingYu: bonusYu });
      giveCult(bonusCult, '奇遇·隱藏結局');
      rw.lingYu = (rw.lingYu || 0) + bonusYu;
      rw.cult = (rw.cult || 0) + bonusCult;
      msg.push('隱藏結局達成！靈玉 +' + bonusYu + '，修為 +' + XG.util.fmt(bonusCult));
      pushNews(out.hiddenEnd, 'player', 2);
      result.hiddenEnd = out.hiddenEnd;
      XG.bus.emit('adv:hiddenEnd', { eventId: e.id, text: out.hiddenEnd });
    }
  }

  /* ---------------- 系統註冊（契約 §10 模塊協議） ---------------- */
  XG.sys.adventure = {
    id: 'adventure',

    init() {
      const a = adv();
      if (!(a.cd > 0)) a.cd = rollCd();                 // 新檔/異常檔自愈
      if (!a.lastBreakTs) a.lastBreakTs = XG.state.createdAt || Date.now();
      // 讀檔自恢復：清掉指向已不存在事件的待決/隊列項
      const idx = index();
      if (a.pending && !idx.byId[a.pending.id]) a.pending = null;
      a.queue = a.queue.filter(function (id) { return !!idx.byId[id]; });
      // 訂閱主循環與判定基準事件（冪等）
      if (!this._subbed) {
        this._subbed = true;
        const self = this;
        XG.bus.on('tick', function (p) { self.tick((p && p.dt) || 1); });
        XG.bus.on('realm:break', function (p2) { if (p2 && p2.ok) adv().lastBreakTs = Date.now(); });
        XG.bus.on('realm:layer', function () { adv().lastBreakTs = Date.now(); });
        XG.bus.on('alch:done', function (p2) { if (p2 && p2.explode) adv().explodeSeen++; });
      }
    },

    // 每秒：cd 倒計時 → roll 修煉奇遇；無待決時連鎖隊列優先
    tick(dt) {
      if (!isUnlocked()) return;
      const a = adv();
      if (a.pending) return;                  // 待決期間暫停 cd（玩家抉擇不計時）
      if (promoteQueue()) return;             // 連鎖優先觸發
      a.cd -= dt;
      if (a.cd <= 0) {
        const e = rollCultivateEvent();
        a.cd = rollCd();                      // 無論是否 roll 到都重置倒計時
        if (e) setPending(e.id, 'cultivate');
      }
    },

    // 離線結算：cd 流逝；歸零且無待決時補一樁「歸來機緣」（至多 1 樁），附簡訊進總報告
    offline(dt) {
      if (!isUnlocked()) return null;
      const a = adv();
      if (a.pending) return null;
      a.cd -= dt;
      if (a.cd > 0) return null;
      const e = rollCultivateEvent();
      a.cd = rollCd();
      if (!e) return null;
      setPending(e.id, 'offline');
      return { events: ['雲遊歸來，恰逢一樁機緣等候多時：' + (e.icon || '') + '「' + e.title + '」'] };
    },

    /* ============ UI 對接面（見文件頭註釋） ============ */
    isUnlocked: isUnlocked,

    getPending() {
      const a = adv();
      if (!a.pending) return null;
      const e = index().byId[a.pending.id];
      if (!e) { a.pending = null; return null; }
      return {
        id: e.id, title: e.title, icon: e.icon, text: e.text, via: a.pending.via,
        choices: (e.choices || []).map(function (c, i) {
          return { i: i, text: c.text, reqOk: reqOk(c.req), reqText: reqText(c.req) };
        }),
      };
    },

    choose(choiceIdx) {
      const a = adv();
      if (!a.pending) return { ok: false, err: 'no_pending' };
      const e = index().byId[a.pending.id];
      if (!e) { a.pending = null; return { ok: false, err: 'event_gone' }; }
      const c = (e.choices || [])[choiceIdx];
      if (!c) return { ok: false, err: 'bad_choice' };
      if (!reqOk(c.req)) {
        return { ok: false, err: 'req_not_met', msg: '條件不足：' + (reqText(c.req) || '境界未至') };
      }
      // 扣 req（realmIdx 僅校驗不消耗）
      if (c.req) {
        const cost = {};
        if (c.req.lingShi) cost.lingShi = -c.req.lingShi;
        if (c.req.lingYu) cost.lingYu = -c.req.lingYu;
        if (c.req.mat) { cost.mat = {}; for (const id in c.req.mat) cost.mat[id] = -c.req.mat[id]; }
        if (c.req.pill) { cost.pill = {}; for (const id in c.req.pill) cost.pill[id] = -c.req.pill[id]; }
        if (cost.lingShi || cost.lingYu || cost.mat || cost.pill) XG.addRes(cost);
      }
      // 結算
      const result = { ok: true, eventId: e.id, title: e.title, icon: e.icon, msg: [], rewards: {} };
      settleOut(e, c, result);
      // 記檔：done 計數（once 永不重複的判定源 & advDone 統計口徑）+ stats.adv_done
      a.done[e.id] = (a.done[e.id] || 0) + 1;
      stats().adv_done = (stats().adv_done || 0) + 1;
      a.pending = null;
      XG.bus.emit('adv:done', { eventId: e.id });
      XG.bus.emit('res:changed');
      XG.bus.emit('save:dirty');
      // 連鎖優先：立即置頂下一樁
      promoteQueue();
      result.next = this.getPending();
      return result;
    },

    triggerOnMap(mapId) {
      const e = rollExploreEvent(mapId);
      if (!e) return { ok: false, err: 'no_event' };
      const a = adv();
      if (a.pending) {
        // 當前有待決：插隊到最前，當前事件結算完立即出
        a.queue.unshift(e.id);
        XG.bus.emit('save:dirty');
        return { ok: true, immediate: false, queued: true, event: { id: e.id, title: e.title, icon: e.icon, text: e.text } };
      }
      setPending(e.id, 'explore');
      return { ok: true, immediate: true, queued: false, event: { id: e.id, title: e.title, icon: e.icon, text: e.text } };
    },

    getQueue() {
      const idx = index();
      return adv().queue.map(function (id) {
        const e = idx.byId[id];
        return e ? { id: id, title: e.title, icon: e.icon } : { id: id, title: id, icon: '？' };
      });
    },

    getCdLeft() { return Math.max(0, Math.ceil(adv().cd)); },
    getCdRange() { return { min: CD_MIN, max: CD_MAX }; },

    getDoneInfo() {
      const d = adv().done;
      return { count: Object.keys(d).length, ids: Object.keys(d) };
    },

    getHiddenEnd() { return adv().hiddenEnd || null; },
    clearHiddenEnd() { adv().hiddenEnd = null; XG.bus.emit('save:dirty'); },
  };

  XG.sysOrder.push('adventure');
})();
