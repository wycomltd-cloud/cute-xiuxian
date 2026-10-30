/* cfg.js：全部數值/平衡常量（契約 §5：境界、層數、解鎖、戰力公式、存檔鍵等） */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  XG.cfg = {
    // 大境界表（順序即進度；baseCost=每層突破修為基數；rate=基礎修為/秒；breakRate=突破基礎成功率）
    // 節奏校準（2026 重調）：baseCost 按「裸速全境耗時目標」反推（Σ layer^2.2/(1+0.12(l-1)) ≈ 320），
    // 目標：煉氣≈5分鐘 / 築基≈9小時 / 金丹≈1天 / 元嬰≈2天 / 化神≈3天 / 煉虛≈3.5天 / 合體≈4天 / 大乘≈4天 / 渡劫≈4天；
    // 舊檔 baseCost 每境 ×250（速率僅 ×4.3，每境耗時 ×58，元嬰起曲線斷裂），故壓縮至每境 ×4~11。
    REALMS: [
      // 煉氣 baseCost 20→10（QA 節奏校準）：首日煉氣→築基純掛機 19.2 分鐘 → 9.6 分鐘（口徑：Σcost/基礎rate）
      { id: 'lianqi',   name: '煉氣', baseCost: 10,     rate: 10,    breakRate: 0.65 },
      { id: 'zhuji',    name: '築基', baseCost: 4e3,    rate: 40,    breakRate: 0.60 },
      { id: 'jindan',   name: '金丹', baseCost: 4.3e4,  rate: 160,   breakRate: 0.55 },
      { id: 'yuanying', name: '元嬰', baseCost: 3.8e5,  rate: 700,   breakRate: 0.50 },
      { id: 'huashen',  name: '化神', baseCost: 2.4e6,  rate: 3e3,   breakRate: 0.45 },
      { id: 'lianxu',   name: '煉虛', baseCost: 1.23e7, rate: 1.3e4, breakRate: 0.40 },
      { id: 'heti',     name: '合體', baseCost: 6.5e7,  rate: 6e4,   breakRate: 0.35 },
      { id: 'dacheng',  name: '大乘', baseCost: 2.7e8,  rate: 2.5e5, breakRate: 0.30 },
      { id: 'dujie',    name: '渡劫', baseCost: 1.08e9, rate: 1e6,   breakRate: 0.25 },
      { id: 'feisheng', name: '飛昇', baseCost: Infinity, rate: 0,   breakRate: 0 },
    ],

    LAYERS: 10, // 每個大境界 10 層小境界

    // 某大境界第 layer 層突破所需修為 = baseCost * layer^2.2（返回 number）
    layerCost(realmIdx, layer) {
      const r = this.REALMS[realmIdx] || this.REALMS[0];
      return r.baseCost * Math.pow(layer, 2.2);
    },

    OFFLINE_CAP_H: 48,       // 離線收益上限 48 小時
    BREAK_FAIL_BONUS: 0.08,  // 突破失敗保底成功率逐次 +8%（成功清零）
    BREAK_PILL_BONUS: 0.15,  // 每顆破境丹 +15%（最多用 3 顆）
    NEWS_CAP: 200,           // 傳聞緩存上限
    FELLOW_COUNT: [30, 50],  // 開局道友數量區間

    // 戰力公式（唯一）：攻*2 + 防*1.5 + 血*0.2 + 速*10
    POWER: function (s) { return s.atk * 2 + s.def * 1.5 + s.hp * 0.2 + s.spd * 10; },

    SAVE_KEY: 'cute_xiuxian_v1', // localStorage 存檔鍵

    // 境界戰鬥基值表（atk/def/hp/spd 按 realmIdx 遞增；煉氣 10/8/100/10，每大境界約 ×6，供 stats 使用）
    REALM_BASE: [
      { atk: 10,        def: 8,        hp: 100,         spd: 10 },        // 煉氣
      { atk: 60,        def: 48,       hp: 600,         spd: 60 },        // 築基
      { atk: 360,       def: 288,      hp: 3.6e3,       spd: 360 },       // 金丹
      { atk: 2160,      def: 1728,     hp: 2.16e4,      spd: 2160 },      // 元嬰
      { atk: 12960,     def: 10368,    hp: 1.296e5,     spd: 12960 },     // 化神
      { atk: 77760,     def: 62208,    hp: 7.776e5,     spd: 77760 },     // 煉虛
      { atk: 466560,    def: 373248,   hp: 4.66656e6,   spd: 466560 },    // 合體
      { atk: 2799360,   def: 2239488,  hp: 2.79936e7,   spd: 2799360 },   // 大乘
      { atk: 16796160,  def: 13436928, hp: 1.679616e8,  spd: 16796160 },  // 渡劫
      { atk: 100776960, def: 80621568, hp: 1.0077696e9, spd: 100776960 }, // 飛昇
    ],

    // 系統解鎖條件表：key=系統 id，value={realmIdx, layer} 或 {days:N}（創角天數）
    UNLOCKS: {
      gongfa:        { realmIdx: 0, layer: 1 },  // 功法：煉氣1層
      adventure:     { realmIdx: 0, layer: 2 },  // 奇遇：煉氣2層
      pets:          { realmIdx: 0, layer: 5 },  // 靈寵：煉氣5層
      fellows:       { realmIdx: 0, layer: 3 },  // 道友：煉氣3層（體驗迭代：由8層提前，前期即有傳聞流與論道）
      cave:          { realmIdx: 1, layer: 1 },  // 洞府：築基1層
      expedition:    { realmIdx: 1, layer: 1 },  // 歷練派遣：築基1層
      alchemy:       { realmIdx: 1, layer: 5 },  // 煉丹：築基5層
      market:        { realmIdx: 1, layer: 5 },  // 坊市：築基5層（體驗迭代：由金丹1層提前，緩解築基期靈石/靈玉無處可花）
      forge:         { realmIdx: 2, layer: 1 },  // 煉器：金丹1層
      dungeon_tower: { realmIdx: 2, layer: 1 },  // 爬塔：金丹1層
      pvp:           { realmIdx: 2, layer: 5 },  // 論劍：金丹5層
      petBreed:      { realmIdx: 3, layer: 1 },  // 靈寵繁殖：元嬰1層
      gongfaCreate:  { realmIdx: 4, layer: 1 },  // 自創功法：化神1層
      dungeon_guard: { realmIdx: 4, layer: 1 },  // 守關：化神1層
      dungeon_hunt:  { realmIdx: 5, layer: 1 },  // 限時尋寶：煉虛1層
      hiddenMaps:    { realmIdx: 5, layer: 1 },  // 隱藏區域提示：煉虛1層
      tribulation:   { realmIdx: 7, layer: 1 },  // 渡劫預告：大乘1層
      reincarn:      { realmIdx: 8, layer: 10 }, // 輪迴：渡劫10層
    },

    // 系統可見性統一判定（讀 XG.state 玩家境界/創角天數；未登記的系統默認解鎖）
    isUnlocked(sysId) {
      const u = this.UNLOCKS[sysId];
      if (!u) return true;
      const st = XG.state;
      if (!st || !st.player) return false;
      // 創角天數類條件
      if (u.days) {
        const days = (Date.now() - (st.createdAt || Date.now())) / 86400000;
        return days >= u.days;
      }
      // 境界層數類條件：大境界更高，或同境界層數達標
      const p = st.player;
      return p.realmIdx > u.realmIdx || (p.realmIdx === u.realmIdx && p.layer >= u.layer);
    },
  };
})();
