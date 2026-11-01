/* scene-photo.js：目前造型的乾淨全圖；只讀展示，不改進度與存檔。 */
(function () {
  'use strict';
  const XG = window.XG;
  let dialog = null, returnFocus = null, oldOverflow = '';

  function close() { if (dialog && dialog.open) dialog.close(); }
  function toggleChrome() {
    const hidden = dialog.classList.toggle('is-clean');
    const btn = dialog.querySelector('[data-photo-clean]');
    btn.textContent = hidden ? '顯示操作' : '隱藏操作，方便截圖';
    btn.setAttribute('aria-pressed', String(hidden));
  }
  XG.ui.openScenePhoto = function (photo) {
    if (!photo || !photo.src) return;
    returnFocus = document.activeElement;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'cute-photo-dialog';
      dialog.setAttribute('aria-label', '仙界照相館：乾淨完整圖片');
      document.body.appendChild(dialog);
      dialog.addEventListener('close', function () {
        document.body.style.overflow = oldOverflow;
        if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
      });
      dialog.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-photo-close]')) close();
        else if (ev.target.closest('[data-photo-clean],.cute-photo-picture')) toggleChrome();
      });
      dialog.addEventListener('keydown', function (ev) {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('cute-photo-picture')) {
          ev.preventDefault(); toggleChrome();
        }
      });
    }
    // 點相機時固定當下已顯示的插畫；看照片期間升境也不會突然換圖。
    const src = XG.util.esc(photo.src), alt = XG.util.esc(photo.alt || '小仙人的完整修行插畫');
    const schoolInfo = XG.schoolArt && XG.schoolArt.info(photo.school, photo.realmIdx);
    const schoolMarkup = XG.schoolArt ? XG.schoolArt.render(photo.school, photo.realmIdx) : '';
    const sect=XG.sectArt?XG.sectArt.info(photo.sect):null;
    const sectMarkup=sect?'<img class="cute-photo-sect-art" src="'+XG.util.esc(sect.src)+'" alt="" aria-hidden="true" width="1536" height="1024">':'';
    dialog.classList.remove('is-clean');
    dialog.innerHTML = '<div class="cute-photo-toolbar"><span>仙界照相館 <small>今天的可愛，值得留底。</small></span><div><button data-photo-clean aria-pressed="false">隱藏操作，方便截圖</button><button data-photo-close aria-label="關閉圖片，返回遊戲">✕</button></div></div>'
      + '<div class="cute-photo-picture" role="button" tabindex="0" aria-label="完整插畫，點一下切換操作顯示"><img class="cute-scene-art" src="' + src + '" alt="' + alt + (schoolInfo ? '・' + XG.util.esc(schoolInfo.name) : '')+(sect?'・'+XG.util.esc(sect.name):'') + '" width="1536" height="1024">'+sectMarkup+'<div class="cute-photo-school-art" aria-hidden="true">' + schoolMarkup + '</div></div>'
      + '<p class="cute-photo-tip">完整圖片已去除遊戲按鈕與文字。截圖後可自行裁切保存。<br><small>點一下圖片可隱藏／顯示操作；按 Esc 返回遊戲。</small></p>';
    if (!dialog.open) { oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal(); }
    dialog.querySelector('[data-photo-close]').focus({ preventScroll: true });
  };
})();
