/* stats.js：屬性聚合面板（契約 §7：聚合各系統 getMods，緩存 + invalidate） */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  XG.stats = {
    _cache: null, // calc 結果緩存

    // 遍歷 XG.sys 中所有實現了 getMods 的模塊，同名數值鍵跨系統累加，返回 flat 加成對象
    _collect() {
      const mods = {};
      const sys = XG.sys || {};
      for (const id in sys) {
        const m = sys[id];
        if (!m || typeof m.getMods !== 'function') continue;
        let part = null;
        try {
          part = m.getMods();
        } catch (e) {
          console.error('[stats] ' + id + '.getMods() 執行出錯', e);
        }
        if (!part) continue;
        for (const k in part) {
          if (typeof part[k] === 'number') mods[k] = (mods[k] || 0) + part[k];
          else mods[k] = part[k]; // 非數值鍵後寫覆蓋（約定一般不用）
        }
      }
      return mods;
    },

    // 計算最終面板（契約 §7 公式）
    calc() {
      const p = XG.state.player;
      const mods = this._collect();
      const realm = XG.cfg.REALMS[p.realmIdx] || XG.cfg.REALMS[0];
      const base = XG.cfg.REALM_BASE[p.realmIdx] || XG.cfg.REALM_BASE[0];
      // 取某加成百分數（缺省 0）
      const pct = function (k) { return mods[k] || 0; };

      // 以聚合加成為底，其餘鍵原樣透傳（dropPct/workPct/alchSuccPct 等）
      const r = Object.assign({}, mods);

      // 修為/秒 = 境界rate * layer係數(1+0.12*(layer-1)) * (1+cultRatePct/100)
      const layerCoef = 1 + 0.12 * (p.layer - 1);
      r.cultRate = realm.rate * layerCoef * (1 + pct('cultRatePct') / 100);

      // atk/def/hp/spd = 境界基值 * (1+pct/100) + flat
      r.atk = base.atk * (1 + pct('atkPct') / 100) + (mods.atkFlat || 0);
      r.def = base.def * (1 + pct('defPct') / 100) + (mods.defFlat || 0);
      r.hp = base.hp * (1 + pct('hpPct') / 100) + (mods.hpFlat || 0);
      r.spd = base.spd * (1 + pct('spdPct') / 100) + (mods.spdFlat || 0);

      // 戰力（唯一公式）
      r.power = XG.cfg.POWER(r);

      // 突破成功率 = 大境界breakRate + breakFails*8%（保底）+ breakSuccPct/100，封頂 95%
      r.breakRate = Math.min(
        0.95,
        realm.breakRate + (p.breakFails || 0) * XG.cfg.BREAK_FAIL_BONUS + pct('breakSuccPct') / 100
      );

      // 離線收益上限秒數 = (48 + offlineHours) * 3600
      r.offlineCapSec = (XG.cfg.OFFLINE_CAP_H + (mods.offlineHours || 0)) * 3600;

      return r;
    },

    // 獲取緩存面板；無緩存則現算
    get() {
      if (!this._cache) this._cache = this.calc();
      return this._cache;
    },

    // 任何 getMods 來源變化後調用：清空緩存，下次 get 時重算
    invalidate() {
      this._cache = null;
    },
  };
})();
