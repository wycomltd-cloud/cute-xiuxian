/* update-notice.js：每個版本首次載入時公告一次，與遊戲存檔分開保存。 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  // 發佈新版時更新 id 與 notes，並同步 index.html 的快取版本。
  const release = {
    id: '1.6',
    notes: [
      '裝備揹包新增「回爐」：退回原始打造材料的 50%，讓舊裝備換個方式發光。',
      '新增「出售」：賣給道友，獲得坊市靈玉基準價的 60%。兩種操作都會先顯示收益，鑲嵌寶石完整退回。'
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
