/* collection.js：圖鑑與成就係統（契約 §10 sys/collection.js；§9.8 成就統計器）
   =========================================================================
   【職責】
   1. 圖鑑（state.codex）：每 tick 節流 3s 掃描登記——
        功法  state.gongfa.owned 的功法 id（含自創功法）
        丹方  state.alchemy.known 的丹方 id
        靈寵  擁有過的物種 id（state.codex.pet 只增不減，天然即歷史並集）
        裝備  state.equips.list 出現過的 baseId
        道友  已 met 的 uid → name（名字快照存 codex.fellowNames，輪迴後仍可展示）
      新收錄 emit 'codex:new' {kind,id} + 發 news（圖鑑+1）；
      完成度 pct = 五類（功法25/丹方20/靈寵25/裝備20/道友10）已收集/總量加權。
   2. 成就（state.ach）：實現 DATA_NOTES §2.2 全部 42 種 check.k 統計器（函數表導出為
      XG.sys.collection.metrics 供調試）；每 tick 節流 3s 遍歷未達成成就，
      check 達成 → 置 done + 發 news + emit 'ach:done' {id}；
      玩家手動 claim 領獎（lingYu/lingShi 走 XG.addRes；eff 永久屬性併入
      state.player.permEff，經 getMods 參與屬性聚合）。
   =========================================================================
   【state 擴展鍵（本系統新增；save.js 默認值深合併自動保留多出的鍵）】
   - state.stats（守則3 共享計數表，全體系統懶初始化 snake 鍵）——本系統寫入：
       news_count          累計傳聞條數（訂閱 'news' 事件自增；首次 init 以 state.news 長度為基線）
       night_login_last    最近一次計入子夜上線的日期串 'YYYY-M-D'
       night_login_streak  連續 0~6 點上線天數（nightLogin 統計源）
       layer_max           小境界層數歷史峯值（layer 統計源：突破回落後峯值不丟）
       break_fail_max      連續突破失敗歷史峯值（breakFailStreak 統計源）
       pvp_pts_max         論劍積分歷史峯值（pvpPts 統計源）
       tox_max             丹毒歷史峯值（tox100 統計源）
       rich_ever           靈石曾 >1e6 則為 1（rich 統計源）
       equip_enh_max       裝備強化等級歷史峯值（equipEnhMax 統計源：裝備銷燬後峯值不丟）
     ——本系統只讀（由對應系統按守則3 寫入；缺失時容錯為 0 或從 state 子樹推導）：
       total_cult(cultivation 累計修為) / pill_make·pill_explode(alchemy) /
       forge_make(forge) / expedition_count(expedition) / tower_hidden_boss(dungeon) /
       help_fellow(fellows) / pet_breed·pet_awaken(pets)
   - state.codex.fellowNames = {uid:name} 道友圖鑑名字快照
   - state.player.permEff  = {} 成就嘉獎給的永久屬性（契約 §7 mods 鍵，getMods 輸出）
   =========================================================================
   【缺失數據的推導約定（其他系統代理請對齊；本系統按下述口徑兜底）】
   - 寵物實例物種字段：按 sp → species → spId → sid 順序探測；
     血脈覺醒標記按 awaken → awakened → bloodAwake 探測，再與 stats.pet_awaken 取大。
   - 裝備實例：底材讀 baseId；品階讀 grade（缺則回查底材表 grade）；
     強化等級按 enh → enhance → lv 探測。
   - 地圖解鎖判定：普通圖按 unlock 境界條件；隱藏圖須 state.expedition.unlocked[mapId] 為真，
     或派遣日誌/進行中派遣出現該圖；cond 'youming_exp_30' 另以幽冥澗派遣日誌≥30 次兜底直判
     （'guixu_bi_5' 因殘璧獻祭消耗無痕，僅以 unlocked/日誌為準）。
   - nightLogin 由本系統在 init 與每次掃描時判定：0~6 點在線記一天，同日不重複，
     昨日有記錄則連續天數+1，否則重置為 1。
   =========================================================================
   【UI 對接面】（本系統純邏輯不含渲染；UI 一律經下列函數讀寫，事件見契約 §4）
   ■ 圖鑑
   - getCodexSummary() → {
       pct:number,            // 總完成度 0~100（加權，保留 1 位小數）
       collected:number, total:number,                     // 五類合計
       cats:[{kind:'gongfa|pill|pet|equip|fellow', name:'功法|丹方|靈寵|裝備|道友',
              icon:string, collected:number, total:number, pct:number}]  // pct 0~100 保留 1 位
     }
   - getCodexList(kind) → [{   // kind 見上；未收錄且數據 hidden=true 的條目 name/icon/desc/getHint 佔位為 ???
       id, name, icon, grade:number, hidden:bool, got:bool, desc:string, getHint:string
     }]                        // fellow 類：id=uid，grade 恆 0，未結識的當前道友以 ??? 佔位
   ■ 成就
   - getAchCats() → [{cat, name, total, done, claimable}]   // claimable=可領標記數（done 且未領）
   - getAchSummary() → {total, done, claimed, claimable, pct}  // pct=done/total*100 取整
   - getAchList(cat?) → [{    // 傳 cat 過濾；hidden 且未達成：name/icon/desc 顯示 ???，
       id, cat, hidden, name, icon, desc,      //   cur/target/reward 置 null（隱藏成就佔位）
       done:bool, claimed:bool, canClaim:bool, // canClaim=可領標記
       cur:number|null, target:number|null, progress:number,  // progress 0~1
       reward:{lingYu?,lingShi?,eff?}|null
     }]
   - claim(id)   → {ok:bool, msg:string, reward?}   // 手動領獎；未達成/已領取 ok:false
   - claimAll()  → {ok, count, reward:{lingYu,lingShi,eff}, msg}  // 一鍵領取全部可領
   ■ 調試
   - metricValue(k) → number          // 任一 check.k 當前值（非法 k 返回 0）
   - XG.sys.collection.metrics        // 42 種統計器函數表 {k: fn(state)→number}
   ■ 事件（bus，UI 訂閱刷新角標/彈喜報）
   - 'codex:new' {kind,id} 圖鑑新增；'ach:done' {id} 成就達成；'news' 傳聞播報
   ========================================================================= */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  const SCAN_SEC = 3; // 圖鑑掃描 / 成就評估節流（秒）

  // 圖鑑五類定義：kind → 展示名 / 圖標 / 數據源（fellow 為動態生成，無靜態表）
  const KIND_ORDER = ['gongfa', 'pill', 'pet', 'equip', 'fellow'];
  const KINDS = {
    gongfa: { name: '功法', icon: '📜', data: function () { return (XG.data.gongfa && XG.data.gongfa.list) || []; } },
    pill:   { name: '丹方', icon: '⚗️', data: function () { return (XG.data.pills && XG.data.pills.recipes) || []; } },
    pet:    { name: '靈寵', icon: '🐾', data: function () { return (XG.data.pets && XG.data.pets.species) || []; } },
    equip:  { name: '裝備', icon: '🗡️', data: function () { return (XG.data.equips && XG.data.equips.bases) || []; } },
    fellow: { name: '道友', icon: '🤝', data: null },
  };
  // 完成度加權（合計 100）
  const WEIGHTS = { gongfa: 25, pill: 20, pet: 25, equip: 20, fellow: 10 };

  // 成就分類展示名
  const ACH_CATS = [
    { cat: 'cult', name: '修煉' }, { cat: 'gongfa', name: '功法' }, { cat: 'pill', name: '煉丹' },
    { cat: 'equip', name: '裝備' }, { cat: 'pet', name: '靈寵' }, { cat: 'cave', name: '洞府' },
    { cat: 'explore', name: '歷練' }, { cat: 'dungeon', name: '秘境' }, { cat: 'pvp', name: '論劍' },
    { cat: 'fellow', name: '道友' }, { cat: 'reincarn', name: '輪迴' }, { cat: 'fun', name: '雜趣' },
  ];

  /* ---------------- 內部小工具 ---------------- */

  // 數值容錯：非有限數一律歸 0
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

  // 懶初始化共享計數表（守則3）
  function lazyStats() { const st = XG.state; return (st.stats = st.stats || {}); }
  // 讀共享計數（容錯 0）
  function statN(k) { const s = XG.state && XG.state.stats; return num(s && s[k]); }

  // 懶初始化圖鑑結構（容錯舊檔缺鍵）
  function lazyCodex() {
    const st = XG.state;
    const cd = (st.codex = st.codex || {});
    cd.gongfa = cd.gongfa || [];
    cd.pill = cd.pill || [];
    cd.pet = cd.pet || [];
    cd.equip = cd.equip || [];
    cd.fellow = cd.fellow || [];
    cd.fellowNames = cd.fellowNames || {}; // 擴展：道友名字快照
    return cd;
  }

  // 傳聞推送助手（守則7）：unshift 進 state.news 按 NEWS_CAP 截斷，並 emit 'news'
  function pushNews(n) {
    const st = XG.state;
    st.news = st.news || [];
    st.news.unshift(n);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (st.news.length > cap) st.news.length = cap;
    XG.bus.emit('news', n);
  }

  // 數據表 id → 元素 索引（data 層靜態，構建一次緩存）
  let _maps = null;
  function dataMaps() {
    if (_maps) return _maps;
    const gf = {}, pill = {}, sp = {}, eqb = {}, persona = {}, school = {};
    KINDS.gongfa.data().forEach(function (g) { if (g) gf[g.id] = g; });
    KINDS.pill.data().forEach(function (r) { if (r) pill[r.id] = r; });
    KINDS.pet.data().forEach(function (s) { if (s) sp[s.id] = s; });
    KINDS.equip.data().forEach(function (b) { if (b) eqb[b.id] = b; });
    const fd = XG.data.fellows || {};
    (fd.personas || []).forEach(function (p) { if (p) persona[p.id] = p; });
    (fd.schools || []).forEach(function (s) { if (s) school[s.id] = s; });
    _maps = { gf: gf, pill: pill, sp: sp, eqb: eqb, persona: persona, school: school };
    return _maps;
  }

  // 功法名解析（數據表查不到時回查自創功法）
  function gongfaName(id) {
    const g = dataMaps().gf[id];
    if (g) return g.name;
    const cus = (XG.state.gongfa && XG.state.gongfa.custom) || [];
    for (let i = 0; i < cus.length; i++) if (cus[i] && cus[i].id === id) return cus[i].name || id;
    return id;
  }

  // 寵物實例物種 id 探測（sp → species → spId → sid）
  function petSpId(pt) {
    if (!pt) return null;
    return pt.sp || pt.species || pt.spId || pt.sid || null;
  }

  // 裝備實例強化等級探測（enh → enhance → lv）
  function equipEnh(e) {
    if (!e) return 0;
    return num(e.enh != null ? e.enh : (e.enhance != null ? e.enhance : e.lv));
  }

  // 裝備實例品階探測（實例 grade → 底材表 grade）
  function equipGrade(e) {
    if (!e) return 0;
    const g = num(e.grade);
    if (g) return g;
    const b = e.baseId && dataMaps().eqb[e.baseId];
    return b ? num(b.grade) : 0;
  }

  // 地圖是否已解鎖（隱藏圖判定見文件頭推導約定）
  function mapUnlocked(m, st) {
    if (!m) return false;
    const p = st.player || {};
    const u = m.unlock || { realmIdx: 0, layer: 1 };
    const rIdx = num(p.realmIdx), lay = num(p.layer);
    const realmOk = rIdx > num(u.realmIdx) || (rIdx === num(u.realmIdx) && lay >= num(u.layer));
    if (!realmOk) return false;
    if (!m.hidden) return true;
    const ex = st.expedition || {};
    if (ex.unlocked && ex.unlocked[m.id]) return true; // expedition 系統登記為準
    const log = ex.log || [];
    let youmingCnt = 0;
    for (let i = 0; i < log.length; i++) {
      if (!log[i]) continue;
      if (log[i].mapId === m.id) return true; // 去過即視為已解鎖
      if (log[i].mapId === 'youming') youmingCnt++;
    }
    const act = ex.active || [];
    for (let i = 0; i < act.length; i++) if (act[i] && act[i].mapId === m.id) return true;
    if (m.cond === 'youming_exp_30' && youmingCnt >= 30) return true; // cond 兜底直判
    return false;
  }

  /* ---------------- 峯值追蹤（歷史峯值類成就統計源） ---------------- */
  function trackPeaks() {
    const st = XG.state;
    const ss = lazyStats();
    const p = st.player || {};
    ss.layer_max = Math.max(num(ss.layer_max), num(p.layer));
    ss.break_fail_max = Math.max(num(ss.break_fail_max), num(p.breakFails));
    ss.pvp_pts_max = Math.max(num(ss.pvp_pts_max), num(st.pvp && st.pvp.pts));
    ss.tox_max = Math.max(num(ss.tox_max), num(p.toxicity));
    if (num(st.res && st.res.lingShi) > 1e6) ss.rich_ever = 1;
    let enh = num(ss.equip_enh_max);
    const list = (st.equips && st.equips.list) || [];
    for (let i = 0; i < list.length; i++) enh = Math.max(enh, equipEnh(list[i]));
    ss.equip_enh_max = enh;
  }

  /* ---------------- 子夜上線（nightLogin） ---------------- */
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function trackNightLogin() {
    const h = new Date().getHours();
    if (h >= 6) return; // 0~5 點計為子夜在線
    const ss = lazyStats();
    const today = dayKey(new Date());
    if (ss.night_login_last === today) return; // 當日已計
    const yest = dayKey(new Date(Date.now() - 864e5));
    ss.night_login_streak = (ss.night_login_last === yest) ? num(ss.night_login_streak) + 1 : 1;
    ss.night_login_last = today;
  }

  /* ---------------- 圖鑑掃描登記 ---------------- */
  function scanCodex() {
    const st = XG.state;
    const cd = lazyCodex();
    const added = [];
    const reg = function (kind, id, name) {
      if (!id || cd[kind].indexOf(id) >= 0) return;
      cd[kind].push(id);
      added.push({ kind: kind, id: id, name: name || id });
    };

    // 功法：已習得（含自創功法——自創功法一經創出即視為收錄，不論是否已習得）
    const owned = (st.gongfa && st.gongfa.owned) || {};
    for (const id in owned) reg('gongfa', id, gongfaName(id));
    const cus = (st.gongfa && st.gongfa.custom) || [];
    for (let ci = 0; ci < cus.length; ci++) {
      if (cus[ci] && cus[ci].id) reg('gongfa', cus[ci].id, cus[ci].name || cus[ci].id);
    }

    // 丹方：已習得
    const known = (st.alchemy && st.alchemy.known) || [];
    for (let i = 0; i < known.length; i++) {
      const r = dataMaps().pill[known[i]];
      reg('pill', known[i], r ? r.name : known[i]);
    }

    // 靈寵：擁有過的物種（codex.pet 只增不減 = 歷史並集）
    const pets = (st.pets && st.pets.list) || [];
    for (let i = 0; i < pets.length; i++) {
      const spId = petSpId(pets[i]);
      if (!spId) continue;
      const sp = dataMaps().sp[spId];
      reg('pet', spId, sp ? sp.name : spId);
    }

    // 裝備：出現過的底材 baseId
    const eqs = (st.equips && st.equips.list) || [];
    for (let i = 0; i < eqs.length; i++) {
      const b = eqs[i] && eqs[i].baseId;
      if (!b) continue;
      const bd = dataMaps().eqb[b];
      reg('equip', b, bd ? bd.name : b);
    }

    // 道友：已 met（metAt / 有好感 / 贈過禮 任一佐證）
    const fellows = st.fellows || [];
    for (let i = 0; i < fellows.length; i++) {
      const f = fellows[i];
      if (!f || !f.uid) continue;
      if (!f.metAt && num(f.favor) <= 0 && num(f.gifts) <= 0) continue;
      if (f.name) cd.fellowNames[f.uid] = f.name; // 名字快照
      reg('fellow', f.uid, f.name);
    }

    // 廣播：逐個 emit codex:new；news 少量逐條、批量合併（防首次補錄刷屏）
    if (added.length) {
      for (let i = 0; i < added.length; i++) {
        XG.bus.emit('codex:new', { kind: added[i].kind, id: added[i].id });
      }
      const now = Date.now();
      if (added.length <= 3) {
        for (let i = 0; i < added.length; i++) {
          const a = added[i];
          pushNews({
            t: now, cat: 'system', imp: 0,
            text: '【圖鑑】新收錄「' + a.name + '」，' + KINDS[a.kind].name + '圖鑑+1。',
          });
        }
      } else {
        pushNews({
          t: now, cat: 'system', imp: 0,
          text: '【圖鑑】一舉新收錄 ' + added.length + ' 項，完成度已達 ' + codexPct() + '%。',
        });
      }
      XG.bus.emit('save:dirty');
    }
    return added;
  }

  /* ---------------- 圖鑑完成度 ---------------- */
  // 單類總量（fellow 動態；gongfa 含自創）
  function codexTotal(kind) {
    const cd = lazyCodex();
    if (kind === 'fellow') {
      return Math.max((XG.state.fellows || []).length, (cd.fellow || []).length);
    }
    let t = KINDS[kind].data().length;
    if (kind === 'gongfa') t += ((XG.state.gongfa && XG.state.gongfa.custom) || []).length;
    return t;
  }
  // 單類完成情況
  function codexCat(kind) {
    const got = (lazyCodex()[kind] || []).length;
    const total = codexTotal(kind);
    const pct = total > 0 ? Math.min(100, Math.round(got / total * 1000) / 10) : 0;
    return { kind: kind, name: KINDS[kind].name, icon: KINDS[kind].icon, collected: got, total: total, pct: pct };
  }
  // 總完成度（加權，0~100 保留 1 位）
  function codexPct() {
    let sum = 0, wsum = 0;
    for (const k in WEIGHTS) {
      const c = codexCat(k);
      sum += WEIGHTS[k] * (c.total > 0 ? Math.min(100, c.collected / c.total * 100) : 0);
      wsum += WEIGHTS[k];
    }
    return wsum > 0 ? Math.round(sum / wsum * 10) / 10 : 0;
  }

  /* ---------------- 42 種成就統計器（DATA_NOTES §2.2 全清單） ---------------- */
  const metrics = {
    /* ===== 契約 §9.8 原列 24 種 ===== */
    realmIdx: function (st) { return num(st.player && st.player.realmIdx); },
    layer: function (st) { return Math.max(num(st.player && st.player.layer), statN('layer_max')); },
    totalCult: function () { return statN('total_cult'); }, // cultivation 記 stats.total_cult
    gongfaOwn: function (st) { return Object.keys((st.gongfa && st.gongfa.owned) || {}).length; },
    gongfaMaxLv: function (st) {
      let m = 0;
      const o = (st.gongfa && st.gongfa.owned) || {};
      for (const id in o) m = Math.max(m, num(o[id] && o[id].lv));
      return m;
    },
    pillMake: function () { return statN('pill_make'); },
    pillExplode: function () { return statN('pill_explode'); },
    equipEnhMax: function (st) {
      let m = statN('equip_enh_max');
      const list = (st.equips && st.equips.list) || [];
      for (let i = 0; i < list.length; i++) m = Math.max(m, equipEnh(list[i]));
      return m;
    },
    equipGod: function (st) {
      let c = 0;
      const list = (st.equips && st.equips.list) || [];
      for (let i = 0; i < list.length; i++) if (equipGrade(list[i]) >= 4) c++;
      return c;
    },
    petOwn: function (st) { return ((st.pets && st.pets.list) || []).length; },
    petGrade5: function (st) {
      let c = 0;
      const list = (st.pets && st.pets.list) || [];
      for (let i = 0; i < list.length; i++) {
        const pt = list[i];
        if (!pt) continue;
        if (num(pt.grade) === 5) { c++; continue; } // 實例自帶品階優先
        const sp = dataMaps().sp[petSpId(pt)];
        if (sp && num(sp.grade) === 5) c++;
      }
      return c;
    },
    caveLvSum: function (st) {
      let s = 0;
      const lv = (st.cave && st.cave.lv) || {};
      for (const k in lv) s += num(lv[k]);
      return s;
    },
    mapUnlock: function (st) {
      let c = 0;
      const maps = (XG.data.world && XG.data.world.maps) || [];
      for (let i = 0; i < maps.length; i++) if (mapUnlocked(maps[i], st)) c++;
      return c;
    },
    towerLayer: function (st) {
      const d = st.dungeon || {};
      return Math.max(num(d.towerBest), num(d.tower));
    },
    pvpWins: function (st) { return num(st.pvp && st.pvp.wins); },
    fellowFavorMax: function (st) {
      let m = 0;
      const fs = st.fellows || [];
      for (let i = 0; i < fs.length; i++) if (fs[i]) m = Math.max(m, num(fs[i].favor));
      return m;
    },
    fellowPartner: function (st) {
      if (st.player && st.player.partner) return 1;
      const fs = st.fellows || [];
      for (let i = 0; i < fs.length; i++) if (fs[i] && fs[i].relation === 'partner') return 1;
      return 0;
    },
    reincarn: function (st) { return num(st.player && st.player.reincarn); },
    codexPct: function () { return codexPct(); },
    newsCount: function (st) { return Math.max(statN('news_count'), (st.news || []).length); },
    helpFellow: function () { return statN('help_fellow'); },
    nightLogin: function () { return statN('night_login_streak'); },
    rich: function (st) { return (num(st.res && st.res.lingShi) > 1e6 || statN('rich_ever')) ? 1 : 0; },
    tox100: function (st) { return (num(st.player && st.player.toxicity) >= 100 || statN('tox_max') >= 100) ? 1 : 0; },

    /* ===== achievements.js 新增 18 種 ===== */
    alchLv: function (st) { return num(st.alchemy && st.alchemy.lv); },
    advDone: function (st) { return Object.keys((st.adventure && st.adventure.done) || {}).length; },
    breakFailStreak: function (st) { return Math.max(statN('break_fail_max'), num(st.player && st.player.breakFails)); },
    expeditionCount: function (st) {
      return Math.max(statN('expedition_count'), ((st.expedition && st.expedition.log) || []).length);
    },
    fellowEggFavorMax: function (st) {
      const egg = (XG.data.names && XG.data.names.egg) || [];
      let m = 0;
      const fs = st.fellows || [];
      for (let i = 0; i < fs.length; i++) {
        if (fs[i] && egg.indexOf(fs[i].name) >= 0) m = Math.max(m, num(fs[i].favor));
      }
      return m;
    },
    fellowRival: function (st) {
      let c = 0;
      const fs = st.fellows || [];
      for (let i = 0; i < fs.length; i++) if (fs[i] && fs[i].relation === 'rival') c++;
      return c;
    },
    forgeMake: function () { return statN('forge_make'); },
    gongfaCreateCount: function (st) { return ((st.gongfa && st.gongfa.custom) || []).length; },
    gongfaHidden: function (st) {
      let c = 0;
      const o = (st.gongfa && st.gongfa.owned) || {};
      for (const id in o) { const g = dataMaps().gf[id]; if (g && g.hidden) c++; }
      return c;
    },
    guardWave: function (st) { return num(st.dungeon && st.dungeon.guard); },
    hiddenMapUnlock: function (st) {
      let c = 0;
      const maps = (XG.data.world && XG.data.world.maps) || [];
      for (let i = 0; i < maps.length; i++) if (maps[i].hidden && mapUnlocked(maps[i], st)) c++;
      return c;
    },
    petAwaken: function (st) {
      let c = 0;
      const list = (st.pets && st.pets.list) || [];
      for (let i = 0; i < list.length; i++) {
        const pt = list[i];
        if (pt && (pt.awaken || pt.awakened || pt.bloodAwake)) c++;
      }
      return Math.max(c, statN('pet_awaken'));
    },
    petBreed: function () { return statN('pet_breed'); },
    playerEggName: function (st) {
      const egg = (XG.data.names && XG.data.names.egg) || [];
      return (st.player && egg.indexOf(st.player.name) >= 0) ? 1 : 0;
    },
    pvpPts: function (st) { return Math.max(num(st.pvp && st.pvp.pts), statN('pvp_pts_max')); },
    spiritRootMut: function (st) { return (st.player && st.player.spiritRoot && st.player.spiritRoot.mut) ? 1 : 0; },
    towerHiddenBoss: function () { return statN('tower_hidden_boss'); },
    totalOnlineH: function (st) { return Math.floor(num(st.totalOnlineSec) / 3600); },
  };

  /* ---------------- 成就評估 ---------------- */
  function evalAch() {
    const st = XG.state;
    st.ach = st.ach || {};
    const list = XG.data.ach || [];
    const newly = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a || !a.id || !a.check) continue;
      const rec = st.ach[a.id];
      if (rec && rec.done) continue; // 只評估未達成
      const fn = metrics[a.check.k];
      if (!fn) continue;
      let cur = 0;
      try { cur = num(fn(st)); } catch (e) { cur = 0; }
      if (cur >= num(a.check.v)) {
        st.ach[a.id] = { done: 1, claimed: rec && rec.claimed ? 1 : 0 };
        newly.push(a);
      }
    }
    for (let i = 0; i < newly.length; i++) {
      const a = newly[i];
      pushNews({
        t: Date.now(), cat: 'system', imp: a.hidden ? 2 : 1,
        text: a.hidden
          ? '【成就】隱藏成就「' + a.name + '」達成！天機已現，速去領取嘉獎。'
          : '【成就】「' + a.name + '」達成！可前往領取嘉獎。',
      });
      XG.bus.emit('ach:done', { id: a.id });
    }
    if (newly.length) XG.bus.emit('save:dirty');
    return newly;
  }

  /* ---------------- 獎勵發放 ---------------- */
  function grantReward(rw) {
    if (!rw) return;
    const delta = {};
    if (num(rw.lingYu)) delta.lingYu = rw.lingYu;
    if (num(rw.lingShi)) delta.lingShi = rw.lingShi;
    if (delta.lingYu || delta.lingShi) XG.addRes(delta);
    if (rw.eff && Object.keys(rw.eff).length) {
      const st = XG.state;
      const pe = (st.player.permEff = st.player.permEff || {});
      for (const k in rw.eff) pe[k] = num(pe[k]) + num(rw.eff[k]);
      if (XG.stats && XG.stats.invalidate) XG.stats.invalidate();
    }
    XG.bus.emit('save:dirty');
  }

  /* ---------------- 系統註冊 ---------------- */
  XG.sys.collection = {
    id: 'collection',
    metrics: metrics, // 統計器函數表導出（調試 / UI 進度查詢用）

    _acc: 0,       // 掃描節流累積
    _newsBound: false, // news 訂閱防重複

    init() {
      const st = XG.state;
      lazyStats();
      lazyCodex();
      st.ach = st.ach || {};
      st.player = st.player || {};
      st.player.permEff = st.player.permEff || {};
      // 傳聞計數：首次以存量 news 長度為基線，此後訂閱 'news' 自增
      const ss = lazyStats();
      if (typeof ss.news_count !== 'number') ss.news_count = (st.news || []).length;
      if (!this._newsBound) {
        this._newsBound = true;
        XG.bus.on('news', function () {
          const s2 = XG.state && XG.state.stats;
          if (s2) s2.news_count = num(s2.news_count) + 1;
        });
      }
      trackNightLogin();
      trackPeaks();
      scanCodex(); // 老檔補錄
      evalAch();   // 已滿足條件的成就即補達成
    },

    tick(dt) {
      this._acc += num(dt) || 1;
      if (this._acc < SCAN_SEC) return;
      this._acc = 0;
      trackNightLogin(); // 跨零點在線亦可計入（當日去重）
      trackPeaks();
      scanCodex();
      evalAch();
    },

    // 離線結算：補一次掃描+評估，把離線期間達成的成就/圖鑑收入報告簡訊
    offline(dt) {
      trackNightLogin();
      trackPeaks();
      const added = scanCodex();
      const newly = evalAch();
      const ev = [];
      if (newly.length) {
        ev.push('成就達成：' + newly.map(function (a) { return '「' + a.name + '」'; }).join('、'));
      }
      if (added.length) ev.push('圖鑑新收錄 ' + added.length + ' 項。');
      return ev.length ? { events: ev } : null;
    },

    // 永久屬性參與屬性聚合（契約 §7）
    getMods() {
      const pe = XG.state && XG.state.player && XG.state.player.permEff;
      return pe || {};
    },

    /* ================= UI 對接面 ================= */

    // 圖鑑總覽：{pct, collected, total, cats:[{kind,name,icon,collected,total,pct}]}
    getCodexSummary() {
      const cats = [];
      let collected = 0, total = 0;
      for (let i = 0; i < KIND_ORDER.length; i++) {
        const c = codexCat(KIND_ORDER[i]);
        cats.push(c);
        collected += c.collected;
        total += c.total;
      }
      return { pct: codexPct(), collected: collected, total: total, cats: cats };
    },

    // 圖鑑分類列表：[{id,name,icon,grade,hidden,got,desc,getHint}]（hidden 未收錄佔位 ???）
    getCodexList(kind) {
      const cd = lazyCodex();
      if (kind === 'fellow') return this._fellowCodexList();
      if (!KINDS[kind]) return [];
      const gotSet = {};
      (cd[kind] || []).forEach(function (id) { gotSet[id] = 1; });
      const out = KINDS[kind].data().map(function (it) {
        const got = !!gotSet[it.id];
        const masked = it.hidden && !got;
        return {
          id: it.id,
          name: masked ? '???' : it.name,
          icon: masked ? '❓' : it.icon,
          grade: num(it.grade),
          hidden: !!it.hidden,
          got: got,
          desc: masked ? '???' : (it.desc || ''),
          getHint: masked ? '???' : (it.getHint || ''),
        };
      });
      // 自創功法（表外條目）已收錄的補列於末
      if (kind === 'gongfa') {
        const cus = (XG.state.gongfa && XG.state.gongfa.custom) || [];
        for (let i = 0; i < cus.length; i++) {
          const c = cus[i];
          if (!c || !c.id || !gotSet[c.id]) continue;
          out.push({
            id: c.id, name: c.name || c.id, icon: c.icon || '🖋️', grade: num(c.grade),
            hidden: false, got: true, desc: c.desc || '自創功法。', getHint: '自創功法（化神解鎖）。',
          });
        }
      }
      return out;
    },

    // 道友圖鑑列表（內部）：已收錄按快照/在冊信息展示，未結識的當前道友 ??? 佔位
    _fellowCodexList() {
      const st = XG.state;
      const cd = lazyCodex();
      const maps = dataMaps();
      const byUid = {};
      const fs = st.fellows || [];
      for (let i = 0; i < fs.length; i++) if (fs[i] && fs[i].uid) byUid[fs[i].uid] = fs[i];
      const out = [];
      for (let i = 0; i < cd.fellow.length; i++) {
        const uid = cd.fellow[i];
        const f = byUid[uid];
        const name = (f && f.name) || cd.fellowNames[uid] || uid;
        let desc = '舊識道友（此界已難覓其蹤）。';
        if (f) {
          const pn = (maps.persona[f.persona] || {}).name || f.persona || '未知';
          const sn = (maps.school[f.school] || {}).name || f.school || '散修';
          desc = pn + ' · ' + sn + ' · 好感 ' + num(f.favor);
        }
        out.push({ id: uid, name: name, icon: '🤝', grade: 0, hidden: false, got: true, desc: desc, getHint: '' });
        delete byUid[uid];
      }
      for (const uid in byUid) {
        out.push({
          id: uid, name: '???', icon: '❓', grade: 0, hidden: false, got: false,
          desc: '尚未結識。', getHint: '論道、相助或坊市往來皆可結識。',
        });
      }
      return out;
    },

    // 成就分類總覽：[{cat,name,total,done,claimable}]
    getAchCats() {
      const st = XG.state;
      const agg = {};
      const list = XG.data.ach || [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (!a) continue;
        const g = (agg[a.cat] = agg[a.cat] || { total: 0, done: 0, claimable: 0 });
        g.total++;
        const rec = st.ach && st.ach[a.id];
        if (rec && rec.done) {
          g.done++;
          if (!rec.claimed) g.claimable++;
        }
      }
      return ACH_CATS.map(function (c) {
        const g = agg[c.cat] || { total: 0, done: 0, claimable: 0 };
        return { cat: c.cat, name: c.name, total: g.total, done: g.done, claimable: g.claimable };
      });
    },

    // 成就總覽：{total, done, claimed, claimable, pct}
    getAchSummary() {
      const st = XG.state;
      let total = 0, done = 0, claimed = 0, claimable = 0;
      const list = XG.data.ach || [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (!a) continue;
        total++;
        const rec = st.ach && st.ach[a.id];
        if (rec && rec.done) {
          done++;
          if (rec.claimed) claimed++;
          else claimable++;
        }
      }
      return { total: total, done: done, claimed: claimed, claimable: claimable, pct: total ? Math.floor(done / total * 100) : 0 };
    },

    // 成就列表（可按 cat 過濾；hidden 未達成 name/desc/reward/進度佔位 ???/null）
    getAchList(cat) {
      const st = XG.state;
      const out = [];
      const list = XG.data.ach || [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (!a || (cat && a.cat !== cat)) continue;
        const rec = (st.ach && st.ach[a.id]) || {};
        const done = !!rec.done, claimed = !!rec.claimed;
        const masked = a.hidden && !done; // 隱藏成就達成前佔位
        let cur = 0;
        if (!masked) {
          const fn = metrics[a.check && a.check.k];
          if (fn) { try { cur = num(fn(st)); } catch (e) { cur = 0; } }
        }
        const target = a.check ? num(a.check.v) : 0;
        out.push({
          id: a.id, cat: a.cat, hidden: !!a.hidden,
          name: masked ? '???' : a.name,
          icon: masked ? '❓' : a.icon,
          desc: masked ? '???' : a.desc,
          done: done, claimed: claimed, canClaim: done && !claimed,
          cur: masked ? null : cur,
          target: masked ? null : target,
          progress: masked ? 0 : (target > 0 ? XG.util.clamp(cur / target, 0, 1) : 0),
          reward: masked ? null : (a.reward || null),
        });
      }
      return out;
    },

    // 領取單個成就嘉獎
    claim(id) {
      const st = XG.state;
      st.ach = st.ach || {};
      const list = XG.data.ach || [];
      let a = null;
      for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id) { a = list[i]; break; }
      if (!a) return { ok: false, msg: '成就不存在。' };
      const rec = st.ach[id];
      if (!rec || !rec.done) return { ok: false, msg: '成就尚未達成。' };
      if (rec.claimed) return { ok: false, msg: '嘉獎已領取。' };
      rec.claimed = 1;
      grantReward(a.reward);
      return { ok: true, msg: '領取「' + a.name + '」嘉獎。', reward: a.reward || {} };
    },

    // 一鍵領取全部可領嘉獎
    claimAll() {
      const st = XG.state;
      st.ach = st.ach || {};
      const agg = { lingYu: 0, lingShi: 0, eff: {} };
      let count = 0;
      const list = XG.data.ach || [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (!a) continue;
        const rec = st.ach[a.id];
        if (!rec || !rec.done || rec.claimed) continue;
        rec.claimed = 1;
        count++;
        const rw = a.reward || {};
        agg.lingYu += num(rw.lingYu);
        agg.lingShi += num(rw.lingShi);
        if (rw.eff) for (const k in rw.eff) agg.eff[k] = num(agg.eff[k]) + num(rw.eff[k]);
      }
      if (!count) return { ok: false, count: 0, reward: agg, msg: '暫無可領取的成就嘉獎。' };
      grantReward({ lingYu: agg.lingYu, lingShi: agg.lingShi, eff: agg.eff });
      return { ok: true, count: count, reward: agg, msg: '共領取 ' + count + ' 項成就嘉獎。' };
    },

    // 調試：任一 check.k 當前值
    metricValue(k) {
      const fn = metrics[k];
      if (!fn) return 0;
      try { return num(fn(XG.state)); } catch (e) { return 0; }
    },
  };

  XG.sysOrder.push('collection');
})();
