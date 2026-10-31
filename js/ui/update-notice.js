/* update-notice.js：每個版本首次載入時公告一次，與遊戲存檔分開保存。 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  // 發佈新版時更新 id 與 notes，並同步 index.html 的快取版本。
  const release = {
    id: '1.9',
    notes: [
      '修仙節奏重新校準！閉關1.3倍；吐納改為3秒一次、每次5秒修為，前100次全額，其後一成。',
      '論道前5次全額、6～10次三成，其後只增好感；修為丹依境界服用，每日前2顆全效、3～4顆半效，其後一成。',
      '坊市統一估價，修正買入再出售的價差；同種成品丹每日限購3顆，刷新不重置。',
      '靈寵探索收入調整；論劍改為每日結算。奇遇／秘境／派遣靈玉每日合計最多20；奇遇／秘境／論劍／雙修修為每日合計最多4小時標準收益。',
      '重複活動靈石每日額度改為同境一階靈寵12小時收入，剩餘額度在首頁顯示；掛機打工與出售另計。',
      '現有境界、裝備、背包與貨幣全部保留。仙界整頓物價，不查封你的存款！'

    ]
  };
  const key = 'cute_xiuxian_seen_release';
  let shown = false, observer = null;
  function seen() {
    try { return localStorage.getItem(key) === release.id; }
    catch (e) { return false; }
  }
  function tryShow() {
    if (shown || seen()) { if (observer) observer.disconnect(); return; }
    // 先完成選角、離線收益及其他彈窗，避免蓋住玩家正在看的內容。
    if (document.hidden || (XG.character && XG.character.needsChoice())) return;
    const modal = document.getElementById('modal-root');
    if ((modal && modal.children.length) || document.querySelector('dialog[open]')) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'cute-update-dialog';
    dialog.setAttribute('aria-labelledby', 'cute-update-title');
    const esc = XG.util.esc;
    dialog.innerHTML = '<span class="cute-update-kicker">仙界更新小紙條</span><h2 id="cute-update-title">修仙日常，更新啦！ 🌿</h2><p class="cute-update-version">Cute v' + esc(release.id) + '</p><ul>' + release.notes.map(function (note) { return '<li>' + esc(note) + '</li>'; }).join('') + '</ul><button class="btn btn-primary" autofocus>知道了，繼續修仙</button>';
    dialog.querySelector('button').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { dialog.remove(); });
    document.body.appendChild(dialog);
    dialog.showModal();
    shown = true;
    // 顯示成功才記錄；不修改修為、角色或匯出存檔。
    try { localStorage.setItem(key, release.id); } catch (e) { /* 禁用儲存時，本次載入仍只顯示一次。 */ }
    if (observer) observer.disconnect();
  }
  function boot() {
    if (seen()) return;
    observer = new MutationObserver(tryShow);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });
    document.addEventListener('visibilitychange', tryShow);
    tryShow();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
