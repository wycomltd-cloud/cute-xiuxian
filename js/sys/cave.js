/* cave.js：洞府經營系統（建築升級 / 3x3 風水相生 / 靈田產出暫存池與一鍵領取 / 離線結算）
 *
 * ============================ UI 對接面（供 UI 代理調用，全部為同步函數） ============================
 *
 * ▶ 總覽
 *   getInfo() → {
 *     unlocked: bool,                 // 是否已解鎖（築基1層，UI 也可自調 XG.cfg.isUnlocked('cave')）
 *     buildings: [BuildingView...],   // 6 棟建築，順序固定 jlz/lt/df/qs/sl/lm
 *     layout: LayoutView,             // 見下
 *     pool: PoolView,                 // 見下
 *   }
 *
 *   BuildingView = {
 *     id, name, icon, wx:'jin|mu|shui|huo|tu', wxName:'金木水火土',
 *     lv, cap,                        // 當前等級 / 當前等級上限（非靈脈=靈脈lv×2，另有硬頂 40；靈脈硬頂 25）
 *     built: bool,                    // lv≥1
 *     cell: -1|0..8,                  // 已擺放的格位，-1=未擺放
 *     fsPct,                          // 風水加成百分數（0/5/10…，相鄰相生每對 +5）
 *     effText,                        // 當前生效效果文案（已含風水加成），如 '修煉速度 +12.6%'
 *     nextCost: {lingShi, mat:{id:n}} | null,   // 升至下一級消耗；滿級為 null
 *     costText,                       // 消耗可讀文案，如 '靈石1150 玄鐵×2'
 *     canUp: bool,                    // 是否可升級（未滿級且資材充足）
 *     upTip,                          // 不可升級原因文案（滿級/靈脈不足/資材不足；可升級為 ''）
 *   }
 *
 *   LayoutView = {
 *     cells: [ {cell:0..8, id|null, name, icon, wx, wxName} ×9 ],   // 按格位 0~8 順序（0 1 2 / 3 4 5 / 6 7 8）
 *     bonus: {buildingId: pct},      // 每棟建築的風水總加成
 *     pairs: [PairView...],          // 全部相生對明細
 *     totalPairs: n,                 // 相生對數
 *   }
 *   PairView = { aCell, aId, aName, aWx, bCell, bId, bName, bWx, recv: buildingId, pct: 5 }
 *              // 語義：a 生 b（recv=bId），b 棟建築效果 +5%
 *
 *   PoolView = { acc: 小數, whole: 整數(可收株數), ratePerHour, etaSec(下一株還需秒數,未建靈田為 null) }
 *
 * ▶ 操作（均返回 {ok, msg}，UI 直接 toast msg；quickCollect 返回 {msg:[...]}）
 *   upgrade(id)          升級/建造（0→1 即建造，自動擺入空格）。自動扣資材。
 *   place(id, cell)      把建築擺到格位 0..8；目標格有建築則互換；已擺放則移動。
 *   unplace(id)          從風水盤取下（建築效果仍在，僅失去/改變相生關係）。
 *   autoLayout()         一鍵按五行相生自動排布全部已建建築。
 *   quickCollect() → {msg:[...], empty?}   一鍵領取靈田暫存池，發放草藥入揹包。
 *
 * ▶ 查詢
 *   fengshuiReport() → {pairs:[PairView...], bonus:{id:pct}, totalPairs}   // 風水加成明細
 *   getPool() → PoolView
 *   costFor(id) → {lingShi, mat:{id:n}} | null                             // 當前升級消耗預覽
 *   effOf(id) → {cultRatePct?|alchSuccPct?|forgeSuccPct?|herbPerHour?|petCap?|workSlots?}  // 單建築生效值（含風水）
 *
 * ▶ 供其他系統（pets 等）調用
 *   isBuilt(id) → bool                 // 靈田崗解鎖：isBuilt('lt')
 *   getPetCapAdd() → int               // 獸欄提供的寵物上限加成（含風水取整）
 *   getWorkSlots() → int               // 獸欄提供的打工位總數（含風水取整）
 *   herbRatePerHour() → float          // 靈田自身每小時產草株數（含風水）
 *
 * ============================ 寫入的 stats 鍵（state.stats，snake 懶初始化） ============================
 *   cave_upgrade   建築升級/建造累計次數
 *   cave_collect   靈田一鍵領取累計次數
 *   cave_herb      靈田累計產出草藥株數
 * （成就 caveLvSum 由 collection 統計器直接讀 state.cave.lv 求和，本系統不寫）
 *
 * ============================ emit 的事件 ============================
 *   'news'        {t, cat:'system', text, imp}   // 首建/逢5級/風水大成祥瑞（同時 push 進 state.news）
 *   'res:changed' / 'save:dirty'                  // 經 XG.addRes 自動發出
 *
 * ============================ 隱藏內容 ============================
 *   藏風聚氣：風水相生對 ≥5 時一次性觸發祥瑞（靈玉+8、傳聞 imp:1），存檔標記 state.cave.fsDone。
 *   靈田歐皇：每株草藥 8% 為二階、2% 為三階靈草，領到三階會額外上傳聞；
 *   靈田精深：靈田 lv≥10 可育四階靈草（權重 G1/G2/G4/G3 = 70/20/8/2）。
 * ===================================================================================================
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  // ---------- 常量 ----------
  const WX_NAME = { jin: '金', mu: '木', shui: '水', huo: '火', tu: '土' };
  const GEN = { jin: 'shui', shui: 'mu', mu: 'huo', huo: 'tu', tu: 'jin' }; // 五行相生：金生水生木生火生土生金
  const FS_PAIR_PCT = 5;     // 每對相鄰相生 +5% 建築效果
  const MAX_LM = 25;         // 靈脈硬頂
  const MAX_OTHER = 40;      // 其餘建築硬頂（同時受靈脈 lv×2 限制）
  const LS_GROWTH = 2.2;     // 靈石消耗遞增倍率

  // 建築定義：costMat 為等級段材料表 [起始lv, 材料id1, 材料id2?]（數量統一 1+floor(lv/2)，取 lv 命中最後一段）
  const BUILDINGS = {
    jlz: {
      name: '聚靈陣', icon: '陣', wx: 'tu', lsBase: 500,
      desc: '鐫刻聚靈符文，聚攏四方靈氣，提升修煉速度。',
      effDesc: '修煉速度 +4%/級',
      costMat: [[0, 'ore_wuxingsha'], [5, 'ore_jingjin'], [10, 'ore_hantie'], [15, 'ore_xingchen']],
    },
    lt: {
      name: '靈田', icon: '田', wx: 'mu', lsBase: 800,
      desc: '引靈泉灌溉的藥圃，自行孕育低階靈草；建成後靈寵可來此打工。',
      effDesc: '每小時產靈草 12 株/級，並解鎖靈寵靈田崗',
      costMat: [[0, 'herb_lingzhi'], [5, 'herb_renshen'], [10, 'herb_chiyancao'], [15, 'herb_hunyuancao']],
    },
    df: {
      name: '丹房', icon: '丹', wx: 'huo', lsBase: 1500,
      desc: '地火引入丹室，火候綿長穩定，煉丹成功率提升。',
      effDesc: '煉丹成功率 +2%/級',
      costMat: [[0, 'herb_qingling'], [5, 'herb_chiyang'], [10, 'herb_huolingzhi'], [15, 'herb_dihuo']],
    },
    qs: {
      name: '器室', icon: '器', wx: 'jin', lsBase: 2000,
      desc: '金石之氣充盈的煉器之所，錘焰相濟，煉器成功率提升。',
      effDesc: '煉器成功率 +2%/級',
      costMat: [[0, 'ore_xuantie'], [5, 'ore_miyin'], [10, 'ore_hantie'], [15, 'ore_xingchen']],
    },
    sl: {
      name: '獸欄', icon: '獸', wx: 'shui', lsBase: 1200,
      desc: '以靈木圍欄、清泉飲獸，提升靈寵容納上限與打工崗位。',
      effDesc: '靈寵上限 +1/級，打工位 +1/級',
      costMat: [[0, 'herb_huangjing'], [5, 'herb_heshouwu'], [10, 'herb_longxiancao'], [15, 'herb_hunyuancao']],
    },
    lm: {
      name: '靈脈', icon: '脈', wx: 'tu', lsBase: 3000,
      desc: '洞府地脈之眼，滋養全局修煉，並決定其餘建築的等級上限。',
      effDesc: '全局修煉速度 +2%/級；其餘建築等級上限 = 靈脈Lv×2',
      costMat: [[0, 'ore_xuantie', 'herb_lingzhi'], [5, 'ore_jingjin', 'herb_renshen'], [10, 'ore_hantie', 'herb_hunyuancao'], [15, 'ore_xingchen', 'herb_dihuo']],
    },
  };
  const BUILDING_IDS = ['jlz', 'lt', 'df', 'qs', 'sl', 'lm'];

  // 靈田產出池（按品階分檔；lv<10 權重 90/8/2，lv≥10 可育四階草、權重 70/20/8/2）
  const POOL_G1 = ['herb_qingling', 'herb_ningxue', 'herb_ningshen', 'herb_ziye', 'herb_lingzhi', 'herb_fuling', 'herb_huangjing'];
  const POOL_G2 = ['herb_renshen', 'herb_heshouwu', 'herb_xuelian', 'herb_juling', 'herb_yuehua', 'herb_chiyang', 'herb_bingxin'];
  const POOL_G3 = ['herb_chiyancao', 'herb_longxiancao', 'herb_xuanbing', 'herb_huolingzhi', 'herb_digen', 'herb_jinxian'];
  const POOL_G4 = ['herb_longxu', 'herb_fengwei', 'herb_yusui', 'herb_youming'];

  // 自動排布優選格位（金→水→木→火→土連環相生，可得 5 對）
  const AUTO_CELLS = { qs: 0, sl: 1, lt: 2, df: 5, lm: 4, jlz: 8 };

  // ---------- 內部工具 ----------
  function caveState() {
    const st = XG.state;
    st.cave = st.cave || {};
    const c = st.cave;
    c.lv = c.lv || {};
    for (const id of BUILDING_IDS) {
      if (typeof c.lv[id] !== 'number') c.lv[id] = (id === 'jlz' || id === 'lm') ? 1 : 0;
    }
    c.pool = c.pool || { acc: 0 };
    c.layout = c.layout || {};
    return c;
  }
  function getLv(id) { return caveState().lv[id] || 0; }
  function capOf(id) {
    if (id === 'lm') return MAX_LM;
    return Math.min(MAX_OTHER, getLv('lm') * 2);
  }
  function bumpStat(k, n) {
    const st = XG.state;
    st.stats = st.stats || {};
    st.stats[k] = (st.stats[k] || 0) + (n || 1);
  }
  function pushNews(text, imp) {
    const news = { t: Date.now(), cat: 'system', text: text, imp: imp || 0 };
    const st = XG.state;
    st.news = st.news || [];
    st.news.unshift(news);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (st.news.length > cap) st.news.length = cap;
    XG.bus.emit('news', news);
  }
  function invalidate() {
    if (XG.stats && typeof XG.stats.invalidate === 'function') XG.stats.invalidate();
    XG.bus.emit('save:dirty');
  }
  function matName(id) {
    const m = (XG.data && XG.data.mats && XG.data.mats[id]) || null;
    return m ? m.name : id;
  }
  function matIcon(id) {
    const m = (XG.data && XG.data.mats && XG.data.mats[id]) || null;
    return m ? m.icon : '草';
  }

  // ---------- 升級消耗 ----------
  function costFor(id) {
    const b = BUILDINGS[id];
    if (!b) return null;
    const lv = getLv(id);
    if (lv >= capOf(id)) return null;
    const cost = { lingShi: Math.round(b.lsBase * Math.pow(LS_GROWTH, lv)), mat: {} };
    let band = b.costMat[0];
    for (const seg of b.costMat) { if (lv >= seg[0]) band = seg; }
    const n = 1 + Math.floor(lv / 2);
    for (let i = 1; i < band.length; i++) cost.mat[band[i]] = n;
    return cost;
  }
  function costText(cost) {
    if (!cost) return '—';
    const parts = ['靈石' + XG.util.fmt(cost.lingShi)];
    for (const id in cost.mat) parts.push(matName(id) + '×' + cost.mat[id]);
    return parts.join(' ');
  }

  // ---------- 風水（3x3 相鄰相生） ----------
  // 格位：0 1 2 / 3 4 5 / 6 7 8；相鄰=上下左右
  const ADJ = [[0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [0, 3], [1, 4], [2, 5], [3, 6], [4, 7], [5, 8]];
  function computeFengshui() {
    const c = caveState();
    const pairs = [];
    const bonus = {};
    for (const e of ADJ) {
      const aId = c.layout[e[0]];
      const bId = c.layout[e[1]];
      if (!aId || !bId || !BUILDINGS[aId] || !BUILDINGS[bId]) continue;
      const wa = BUILDINGS[aId].wx, wb = BUILDINGS[bId].wx;
      let recv = null;
      if (GEN[wa] === wb) recv = bId;       // a 生 b → b +5%
      else if (GEN[wb] === wa) recv = aId;  // b 生 a → a +5%
      if (!recv) continue;
      bonus[recv] = (bonus[recv] || 0) + FS_PAIR_PCT;
      pairs.push({
        aCell: e[0], aId: aId, aName: BUILDINGS[aId].name, aWx: wa,
        bCell: e[1], bId: bId, bName: BUILDINGS[bId].name, bWx: wb,
        recv: recv, pct: FS_PAIR_PCT,
      });
    }
    return { pairs: pairs, bonus: bonus, totalPairs: pairs.length };
  }
  function fsPctOf(id) { return computeFengshui().bonus[id] || 0; }

  // ---------- 單建築生效值（含風水） ----------
  function effOf(id) {
    const lv = getLv(id);
    if (lv < 1) return {};
    const mult = 1 + fsPctOf(id) / 100;
    switch (id) {
      case 'jlz': return { cultRatePct: 4 * lv * mult };
      case 'lm': return { cultRatePct: 2 * lv * mult };
      case 'df': return { alchSuccPct: 2 * lv * mult };
      case 'qs': return { forgeSuccPct: 2 * lv * mult };
      case 'lt': return { herbPerHour: 12 * lv * mult };
      case 'sl': return { petCap: lv + Math.floor(lv * fsPctOf(id) / 100), workSlots: lv + Math.floor(lv * fsPctOf(id) / 100) };
    }
    return {};
  }
  function effTextOf(id) {
    const e = effOf(id);
    if (id === 'jlz' && e.cultRatePct) return '修煉速度 +' + XG.util.fmt(e.cultRatePct) + '%';
    if (id === 'lm' && e.cultRatePct) return '全局修煉 +' + XG.util.fmt(e.cultRatePct) + '%，上限 Lv' + capOf('jlz');
    if (id === 'df' && e.alchSuccPct) return '煉丹成功率 +' + XG.util.fmt(e.alchSuccPct) + '%';
    if (id === 'qs' && e.forgeSuccPct) return '煉器成功率 +' + XG.util.fmt(e.forgeSuccPct) + '%';
    if (id === 'lt' && e.herbPerHour) return '每小時產靈草 ' + XG.util.fmt(e.herbPerHour) + ' 株';
    if (id === 'sl' && e.petCap) return '靈寵上限 +' + e.petCap + '，打工位 +' + e.workSlots;
    return '未建成';
  }

  // ---------- 擺放 ----------
  function cellOf(id) {
    const layout = caveState().layout;
    for (const k in layout) if (layout[k] === id) return Number(k);
    return -1;
  }
  function firstFreeCell() {
    const layout = caveState().layout;
    for (let i = 0; i < 9; i++) if (!layout[i]) return i;
    return -1;
  }
  function placeInternal(id, cell) {
    const c = caveState();
    const old = cellOf(id);
    const occ = c.layout[cell];
    if (old >= 0) delete c.layout[old];
    if (occ && occ !== id && old >= 0) c.layout[old] = occ; // 互換
    c.layout[cell] = id;
  }
  // 隱藏：藏風聚氣——相生對 ≥5 一次性祥瑞
  function checkFsSecret() {
    const c = caveState();
    if (c.fsDone) return;
    const fs = computeFengshui();
    if (fs.totalPairs >= 5) {
      c.fsDone = 1;
      XG.addRes({ lingYu: 8 });
      pushNews('洞府五行連環相生，藏風聚氣，一夜之間靈霧凝露，天降祥瑞（靈玉+8）。', 1);
    }
  }

  // ---------- 靈田產出 ----------
  function herbRatePerHour() {
    const e = effOf('lt');
    return e.herbPerHour || 0;
  }
  function rollHerb() {
    const r = Math.random();
    if (getLv('lt') >= 10) {
      // 靈田精深（lv≥10）：可育四階靈草，權重 G1/G2/G4/G3 = 70/20/8/2
      if (r < 0.02) return XG.util.pick(POOL_G3);
      if (r < 0.10) return XG.util.pick(POOL_G4);
      if (r < 0.30) return XG.util.pick(POOL_G2);
      return XG.util.pick(POOL_G1);
    }
    if (r < 0.02) return XG.util.pick(POOL_G3);
    if (r < 0.10) return XG.util.pick(POOL_G2);
    return XG.util.pick(POOL_G1);
  }

  // ---------- 模塊 ----------
  XG.sys.cave = {
    id: 'cave',

    init() {
      const c = caveState();
      // 清洗 layout：去未知建築/重複擺放/越界格位
      const seen = {};
      for (const k in c.layout) {
        const id = c.layout[k];
        const cell = Number(k);
        if (!BUILDINGS[id] || seen[id] || isNaN(cell) || cell < 0 || cell > 8) delete c.layout[k];
        else seen[id] = 1;
      }
      // 無擺放時自動把已建建築放上風水盤
      if (Object.keys(c.layout).length === 0) {
        for (const id of BUILDING_IDS) {
          if (getLv(id) >= 1) {
            const cell = firstFreeCell();
            if (cell < 0) break;
            c.layout[cell] = id;
          }
        }
      }
    },

    tick(dt) {
      const c = caveState();
      const rate = herbRatePerHour();
      if (rate > 0) c.pool.acc += rate * dt / 3600;
    },

    offline(dt) {
      const rate = herbRatePerHour();
      if (rate <= 0) return null;
      const gain = rate * dt / 3600;
      caveState().pool.acc += gain;
      return { cave: { herb: gain, note: '靈田積蓄靈草約 ' + XG.util.fmt(gain) + ' 株' } };
    },

    getMods() {
      const mods = {};
      const j = effOf('jlz'); if (j.cultRatePct) mods.cultRatePct = (mods.cultRatePct || 0) + j.cultRatePct;
      const l = effOf('lm'); if (l.cultRatePct) mods.cultRatePct = (mods.cultRatePct || 0) + l.cultRatePct;
      const d = effOf('df'); if (d.alchSuccPct) mods.alchSuccPct = d.alchSuccPct;
      const q = effOf('qs'); if (q.forgeSuccPct) mods.forgeSuccPct = q.forgeSuccPct;
      return mods;
    },

    // ===== 操作 =====
    upgrade(id) {
      const b = BUILDINGS[id];
      if (!b) return { ok: false, msg: '無此建築。' };
      const lv = getLv(id);
      const cap = capOf(id);
      if (lv >= cap) {
        return { ok: false, msg: id === 'lm' ? '靈脈已至當前極致。' : b.name + '已達上限，請先提升靈脈等級（上限=靈脈Lv×2）。' };
      }
      const cost = costFor(id);
      if (!XG.hasRes(cost)) return { ok: false, msg: '資材不足：需 ' + costText(cost) + '。' };
      const neg = { lingShi: -cost.lingShi, mat: {} };
      for (const m in cost.mat) neg.mat[m] = -cost.mat[m];
      XG.addRes(neg);
      caveState().lv[id] = lv + 1;
      bumpStat('cave_upgrade');
      // 建造（0→1）自動擺入空格
      if (lv === 0) {
        const cell = firstFreeCell();
        if (cell >= 0) caveState().layout[cell] = id;
        pushNews('洞府新起' + b.name + '，' + b.desc, 0);
      } else if ((lv + 1) % 5 === 0) {
        pushNews('洞府' + b.name + '已至 ' + (lv + 1) + ' 級，氣象愈發不凡。', 0);
      }
      invalidate();
      checkFsSecret();
      return { ok: true, msg: b.name + '升至 Lv' + (lv + 1) + '。' };
    },

    place(id, cell) {
      const b = BUILDINGS[id];
      if (!b) return { ok: false, msg: '無此建築。' };
      cell = Number(cell);
      if (isNaN(cell) || cell < 0 || cell > 8) return { ok: false, msg: '格位須在 0~8 之間。' };
      if (getLv(id) < 1) return { ok: false, msg: b.name + '尚未建成，無法擺放。' };
      if (cellOf(id) === cell) return { ok: true, msg: b.name + '已在此處。' };
      placeInternal(id, cell);
      invalidate();
      checkFsSecret();
      return { ok: true, msg: b.name + '已移至' + WX_NAME[b.wx] + '位（格' + cell + '）。' };
    },

    unplace(id) {
      const b = BUILDINGS[id];
      if (!b) return { ok: false, msg: '無此建築。' };
      const cell = cellOf(id);
      if (cell < 0) return { ok: false, msg: b.name + '本就不在風水盤上。' };
      delete caveState().layout[cell];
      invalidate();
      return { ok: true, msg: b.name + '已自風水盤取下。' };
    },

    autoLayout() {
      const c = caveState();
      c.layout = {};
      // 先按優選格位放（五行連環相生），衝突/未建者順延空格
      for (const id of BUILDING_IDS) {
        if (getLv(id) < 1) continue;
        const want = AUTO_CELLS[id];
        if (want != null && !c.layout[want]) c.layout[want] = id;
        else {
          const cell = firstFreeCell();
          if (cell >= 0) c.layout[cell] = id;
        }
      }
      invalidate();
      checkFsSecret();
      const fs = computeFengshui();
      return { ok: true, msg: '已按五行相生自動排布，當前相生 ' + fs.totalPairs + ' 對。' };
    },

    quickCollect() {
      const c = caveState();
      const n = Math.floor(c.pool.acc);
      if (n < 1) return { msg: ['靈田之中暫無積蓄，稍安勿躁。'], empty: true };
      c.pool.acc -= n;
      const gain = {};
      let rare = 0;
      for (let i = 0; i < n; i++) {
        const id = rollHerb();
        gain[id] = (gain[id] || 0) + 1;
        if (POOL_G3.indexOf(id) >= 0) rare++;
      }
      XG.addRes({ mat: gain });
      bumpStat('cave_collect');
      bumpStat('cave_herb', n);
      // 彙總文案（按數量從多到少展示前 4 種）
      const ids = Object.keys(gain).sort((a, b) => gain[b] - gain[a]);
      const parts = ids.slice(0, 4).map(function (id) { return matIcon(id) + matName(id) + '×' + gain[id]; });
      if (ids.length > 4) parts.push('等' + ids.length + '種');
      const msg = ['靈田收穫靈草 ' + n + ' 株：' + parts.join('、') + '。'];
      if (rare > 0) {
        msg.push('其中竟有 ' + rare + ' 株三階靈草，藥香沖鼻！');
        pushNews('洞府靈田豐產，收穫三階靈草 ' + rare + ' 株，頗為難得。', 0);
      }
      return { msg: msg };
    },

    // ===== 查詢 =====
    costFor: costFor,

    effOf: effOf,

    fengshuiReport() { return computeFengshui(); },

    getPool() {
      const acc = caveState().pool.acc;
      const rate = herbRatePerHour();
      return {
        acc: acc,
        whole: Math.floor(acc),
        ratePerHour: rate,
        etaSec: rate > 0 ? Math.max(0, (1 - (acc - Math.floor(acc))) * 3600 / rate) : null,
      };
    },

    isBuilt(id) { return getLv(id) >= 1; },

    getPetCapAdd() {
      const e = effOf('sl');
      return e.petCap || 0;
    },

    getWorkSlots() {
      const e = effOf('sl');
      return e.workSlots || 0;
    },

    herbRatePerHour: herbRatePerHour,

    getInfo() {
      const fs = computeFengshui();
      const buildings = BUILDING_IDS.map(function (id) {
        const b = BUILDINGS[id];
        const lv = getLv(id);
        const cost = costFor(id);
        const cap = capOf(id);
        let upTip = '';
        if (lv >= cap) upTip = id === 'lm' ? '已至極致' : '靈脈等級不足（上限 Lv' + cap + '）';
        else if (cost && !XG.hasRes(cost)) upTip = '資材不足';
        return {
          id: id, name: b.name, icon: b.icon, wx: b.wx, wxName: WX_NAME[b.wx],
          lv: lv, cap: cap, built: lv >= 1, cell: cellOf(id),
          fsPct: fs.bonus[id] || 0,
          effText: lv >= 1 ? effTextOf(id) : '未建成（' + b.effDesc + '）',
          desc: b.desc,
          nextCost: cost, costText: costText(cost),
          canUp: !!cost && XG.hasRes(cost), upTip: upTip,
        };
      });
      const cells = [];
      const layout = caveState().layout;
      for (let i = 0; i < 9; i++) {
        const id = layout[i] || null;
        cells.push(id
          ? { cell: i, id: id, name: BUILDINGS[id].name, icon: BUILDINGS[id].icon, wx: BUILDINGS[id].wx, wxName: WX_NAME[BUILDINGS[id].wx] }
          : { cell: i, id: null, name: '', icon: '', wx: '', wxName: '' });
      }
      return {
        unlocked: XG.cfg && typeof XG.cfg.isUnlocked === 'function' ? XG.cfg.isUnlocked('cave') : true,
        buildings: buildings,
        layout: { cells: cells, bonus: fs.bonus, pairs: fs.pairs, totalPairs: fs.totalPairs },
        pool: this.getPool(),
      };
    },
  };

  XG.sysOrder.push('cave');
})();
