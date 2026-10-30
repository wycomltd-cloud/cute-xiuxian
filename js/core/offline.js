/* offline.js：離線收益結算（契約 §8；settle 須在 sys init 之後由 main.js 調用，本文件只提供函數） */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  XG.offline = {
    // 啓動時離線結算：dt = min(now - lastSeen, cap)；依次調用各系統 offline(dt) 合併報告；
    // 返回 {dt, capped, cultGain, resGain:{}, pillGain:{}, events:[], fellowNews:[], truncated}；dt<60s 返回 null
    settle() {
      const st = XG.state;
      const now = Date.now();
      const last = st.lastSeen || 0;
      if (!last) { st.lastSeen = now; return null; } // 無時間基準（新檔）不結算
      let dt = Math.floor((now - last) / 1000);
      if (dt <= 0) return null; // 短暫切換也結算；是否顯示彈窗由主程式決定。

      // 超上限截斷並標記（上限讀 stats 面板 offlineCapSec，含各系統 offlineHours 加成）
      const capSec = (XG.stats ? XG.stats.get().offlineCapSec : XG.cfg.OFFLINE_CAP_H * 3600);
      const capped = dt > capSec;
      if (capped) dt = capSec;

      const report = {
        dt: dt, capped: capped,
        cultGain: 0, resGain: {}, pillGain: {},
        events: [], fellowNews: [],
        truncated: capped, // 收益被離線上限截斷（與 capped 同義，供彈窗展示）
      };

      // 依次調用各系統 offline(dt)，合併報告片段
      const order = XG.sysOrder || [];
      for (const id of order) {
        const m = XG.sys && XG.sys[id];
        if (!m || typeof m.offline !== 'function') continue;
        let part = null;
        try {
          part = m.offline(dt);
        } catch (e) {
          console.error('[offline] ' + id + '.offline() 結算出錯', e);
        }
        if (part) this._merge(report, part);
      }

      st.lastSeen = now; // 結算完成，推進時間基準避免重複結算
      return report;
    },

    // 合併系統報告片段到總報告（數值累加、數組拼接、未知鍵透傳）
    _merge(rep, part) {
      if (part.cultGain) rep.cultGain += part.cultGain;
      if (part.resGain) {
        for (const k in part.resGain) rep.resGain[k] = (rep.resGain[k] || 0) + part.resGain[k];
      }
      if (part.pillGain) {
        for (const k in part.pillGain) rep.pillGain[k] = (rep.pillGain[k] || 0) + part.pillGain[k];
      }
      if (part.events) rep.events.push.apply(rep.events, part.events);
      if (part.fellowNews) rep.fellowNews.push.apply(rep.fellowNews, part.fellowNews);
      // 其餘未佔用鍵原樣併入（不覆蓋總報告已有字段）
      for (const k in part) {
        if (!(k in rep)) rep[k] = part[k];
      }
    },
  };
})();
