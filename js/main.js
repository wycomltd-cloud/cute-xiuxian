/* main.js：啓動引導與 1s 主循環（契約 §13；UI 未接入時渲染核心佔位面板） */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  let curDay = '';        // 當前日期串（每日 0 點判定用）
  let saveCountdown = 0;  // 距下次自動存檔的累計秒數
  let dirtyTimer = null;  // save:dirty 延遲存檔句柄
  let suspended = document.hidden; // 背景期間改由離線結算，避免手機休眠漏算。
  let lastTick = 0;       // 上次 tick 時間戳

  // 本地日期串 'YYYY/M/D'（跨 0 點判定）
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  }

  // 每日 0 點重置 state.daily（論道/求助/免費贈禮記錄）
  function resetDaily() {
    XG.state.daily = { day: curDay, discuss: {}, help: {}, gift: 0 };
    XG.bus.emit('save:dirty');
  }

  // save:dirty 響應：2s 內合併為一次存檔（避免高頻寫 localStorage）
  function scheduleDirtySave() {
    if (suspended) return;
    if (dirtyTimer) return;
    dirtyTimer = setTimeout(function () {
      dirtyTimer = null;
      if (!suspended) XG.save.save();
    }, 2000);
  }

  // 1s 主循環：emit tick、累加在線時長、每日 0 點重置、15s 自動存檔
  function onTick() {
    if (suspended) return;
    if (XG.character && XG.character.needsChoice()) { lastTick = Date.now(); return; }
    const now = Date.now();
    let dt = Math.round((now - lastTick) / 1000);
    lastTick = now;
    if (dt <= 0) dt = 1;
    if (dt > 5) dt = 5; // 頁面休眠恢復丟棄異常大步長（離線收益歸 offline.settle 管）
    XG.state.totalOnlineSec += dt;

    // 每日 0 點檢測
    const dk = dayKey();
    if (dk !== curDay) {
      curDay = dk;
      resetDaily();
    }

    XG.bus.emit('tick', { dt: dt });

    // 每 15s 自動存檔
    saveCountdown += dt;
    if (saveCountdown >= 15) {
      saveCountdown = 0;
      XG.save.save();
    }
  }

  // 階段 0 佔位渲染：UI 層未接入時輸出「核心加載完成」+ JSON 化 stats 面板（保證本階段可驗證）
  function renderCorePlaceholder() {
    const el = document.getElementById('tab-container');
    if (!el) return;
    const s = XG.stats.get();
    const p = XG.state.player;
    const realm = XG.cfg.REALMS[p.realmIdx] || XG.cfg.REALMS[0];
    el.innerHTML =
      '<div class="tab-page">' +
        '<div class="card">' +
          '<h2 class="card-title">核心加載完成</h2>' +
          '<p>道友：' + XG.util.esc(p.name) + '　境界：' + XG.util.esc(realm.name) + ' ' + p.layer + ' 層</p>' +
          '<pre class="core-stats-pre">' + XG.util.esc(JSON.stringify(s, null, 2)) + '</pre>' +
        '</div>' +
      '</div>';
  }

  // 啓動流程（契約 §13）
  function boot() {
    // 1. 讀檔（默認值深合併容錯）
    XG.save.load();
    if (XG.character) XG.character.normalize();

    // 2. 各系統按註冊順序 init（讀 XG.state 自恢復）
    const order = XG.sysOrder || [];
    for (const id of order) {
      const m = XG.sys && XG.sys[id];
      if (m && typeof m.init === 'function') {
        try {
          m.init();
        } catch (e) {
          console.error('[main] ' + id + '.init() 出錯', e);
        }
      }
    }

    // 3. 重建屬性緩存
    XG.stats.invalidate();

    // 4. 離線結算並廣播彈窗（報告由 ui-core 監聽 modal:offline 展示）
    let report = null;
    try {
      report = XG.offline.settle();
    } catch (e) {
      console.error('[main] 離線結算出錯', e);
    }
    if (report && report.dt >= 60) XG.bus.emit('modal:offline', report);

    // 5. 每日記錄初始化（跨天補重置）
    curDay = dayKey();
    if (XG.state.daily.day !== curDay) resetDaily();

    // 6. 啓動 1s 主循環
    lastTick = Date.now();
    setInterval(onTick, 1000);

    // 7. 存檔鉤子：beforeunload / 頁面切後臺 / save:dirty
    window.addEventListener('beforeunload', function () { if (!suspended) XG.save.save(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        XG.save.save();
        suspended = true;
        if (dirtyTimer) { clearTimeout(dirtyTimer); dirtyTimer = null; }
      } else if (suspended) {
        suspended = false;
        const dk = dayKey();
        if (dk !== curDay) { curDay = dk; resetDaily(); }
        XG.stats.invalidate();
        const report = XG.offline.settle();
        lastTick = Date.now();
        saveCountdown = 0;
        XG.stats.invalidate();
        XG.save.save();
        XG.bus.emit('res:changed');
        if (report && report.dt >= 60) XG.bus.emit('modal:offline', report);
      }
    });
    XG.bus.on('save:dirty', scheduleDirtySave);

    // 8. UI 啓動：存在 XG.ui 則走正常 UI 流程，否則渲染核心佔位面板
    if (XG.ui) {
      if (typeof XG.ui.boot === 'function') {
        try {
          XG.ui.boot();
        } catch (e) {
          console.error('[main] XG.ui.boot() 出錯', e);
        }
      }
    } else {
      renderCorePlaceholder();
    }
  }

  // 腳本在 body 末尾加載時 DOM 已就緒；保險起見仍做 readyState 判斷
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
