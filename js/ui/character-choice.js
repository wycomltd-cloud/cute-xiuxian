/* character-choice.js：開局與輪回成功後的主角選擇，獨立覆蓋層不搶佔離線收益彈窗。 */
(function () {
  'use strict';
  const XG = window.XG;
  let root = null, draft = null, schoolDraft = null, inertNodes = [];
  function restore() { inertNodes.forEach(function (entry) { entry.el.inert = entry.value; }); inertNodes = []; }
  function open(options) {
    if (!XG.character.needsChoice()) return;
    options = options || {};
    const p = XG.state.player;
    const returning = p.realmIdx > 0 || XG.state.totalOnlineSec > 30;
    if (!root) { root = document.createElement('div'); root.id = 'character-choice-root'; document.body.appendChild(root); }
    restore();
    document.querySelectorAll('.cute-shell,.cute-masthead,#modal-root').forEach(function (el) { inertNodes.push({ el: el, value: el.inert }); el.inert = true; });
    draft = XG.character.valid(p.gender) ? p.gender : null;
    schoolDraft = XG.character.validSchool(p.school) ? p.school : null;
    const title = options.rebirthHtml ? '輪回成功，新一世選個新模樣' : returning ? '歡迎回來，為這一世選個主角' : '這一世，你想怎樣修仙？';
    const sub = options.rebirthHtml || p.reincarn > 0 ? '前世的修為已結算，這一世的可愛重新開始。' : returning ? '補選本世修行即可繼續，已選性別、境界與資源都會保留。' : '選好性別與修行，再一起把修仙過成慢生活。';
    root.hidden = false;
    root.innerHTML = '<div class="character-choice-screen" role="dialog" aria-modal="true" aria-labelledby="character-choice-title" aria-describedby="character-choice-sub"><section class="character-choice-panel"><span class="character-choice-kicker">A NEW LIFE, A LITTLE MAGIC</span><h2 id="character-choice-title">' + XG.util.esc(title) + '</h2><p id="character-choice-sub">' + XG.util.esc(sub) + '</p><div class="character-choice-cards"><button class="character-choice-card" data-character-gender="male" aria-pressed="false" aria-label="選擇男主角"><div class="character-choice-art"><img src="assets/genders/male/00-lianqi.webp" alt="男主角的青綠仙袍與簡潔髮髻造型" width="1536" height="1024"></div><strong><span class="cute-gender-badge cute-gender-male">♂</span> 男主角</strong><span>青衣小散仙 · 仙氣也要有精神</span></button><button class="character-choice-card" data-character-gender="female" aria-pressed="false" aria-label="選擇女主角"><div class="character-choice-art"><img src="assets/genders/female/00-lianqi.webp" alt="女主角的長髮披肩、青綠仙袍與珠玉髮飾造型" width="1536" height="1024"></div><strong><span class="cute-gender-badge cute-gender-female">♀</span> 女主角</strong><span>青衣小散仙 · 可愛也是修行</span></button></div><p class="character-choice-rules">每個大境界都有對應造型。這一世選定後，成功輪回可再選；結為道侶需雙方性別相反。</p>' + (options.rebirthHtml ? '<details class="character-rebirth-details"><summary>查看這次輪回的收穫</summary>' + options.rebirthHtml + '</details>' : '') + '<button class="btn btn-primary character-choice-confirm" data-character-confirm disabled>先選一位主角</button><p class="character-choice-error" aria-live="polite"></p></section></div>';
    const rule = root.querySelector('.character-choice-rules');
    rule.insertAdjacentHTML('beforebegin', '<h3 class="character-school-title">這一世，你專修哪一道？</h3><div class="character-school-cards">' + XG.character.schools.map(function (s) { return '<button class="character-school-card" data-character-school="' + s.id + '" aria-pressed="false">' + s.icon + '<strong>' + s.name + '</strong></button>'; }).join('') + '</div><p class="character-school-hint">劍 → 符 → 陣 → 丹 → 體 → 劍<br>順向第一修 +20%、第二修 +10%；反向 −20%、−10%；同修 0%。</p>');
    rule.textContent = '性別與修行選定後鎖定一世，成功輪回後才可重選。金丹後可選散修或宗門道路；道侶需與主角性別相反。';
    function refreshChoice() {
      root.querySelectorAll('[data-character-gender]').forEach(function (b) { const on = b.dataset.characterGender === draft; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); b.disabled = XG.character.valid(p.gender); });
      root.querySelectorAll('[data-character-school]').forEach(function (b) { const on = b.dataset.characterSchool === schoolDraft; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); b.disabled = XG.character.validSchool(p.school); });
      const btn = root.querySelector('[data-character-confirm]');
      btn.disabled = !draft || !schoolDraft;
      const school = XG.character.schools.find(function (s) { return s.id === schoolDraft; });
      btn.textContent = !draft ? '先選一位主角' : !schoolDraft ? '再選這一世的修行' : '就用' + (draft === 'male' ? '男主角' : '女主角') + '・' + school.name + '，開始這一世';
    }
    refreshChoice();
    root.onclick = function (ev) {
      const card = ev.target.closest('[data-character-gender]');
      if (card && !XG.character.valid(p.gender)) { draft = card.dataset.characterGender; refreshChoice(); }
      const schoolCard = ev.target.closest('[data-character-school]');
      if (schoolCard && !XG.character.validSchool(p.school)) { schoolDraft = schoolCard.dataset.characterSchool; refreshChoice(); }
      if (ev.target.closest('[data-character-confirm]')) {
        const r = XG.character.choose(draft, schoolDraft);
        if (!r.ok) { root.querySelector('.character-choice-error').textContent = r.msg; return; }
        root.hidden = true; root.innerHTML = ''; restore();
        XG.ui.showTab('home'); XG.ui.renderActive(); XG.ui.refreshTop();
        XG.ui.toast('這一世的主角選好了，仙氣準備開工！', 'gold');
        const app = document.getElementById('app'); app.setAttribute('tabindex', '-1'); app.focus({ preventScroll: true });
      }
    };
    root.onkeydown = function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); return; }
      if (ev.key !== 'Tab') return;
      const buttons = Array.from(root.querySelectorAll('button:not(:disabled),summary'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    };
    root.querySelector('button:not(:disabled)').focus({ preventScroll: true });
  }
  XG.ui.openGenderChoice = open;
  // 即使玩家在天劫動畫期間切換分頁，也會出現新世選角，避免停留在待選狀態。
  XG.bus.on('reincarn:done', function () {
    setTimeout(function () { if (XG.character.needsChoice() && (!root || root.hidden)) open(); }, 6500);
  });
  function boot() { if (XG.character.needsChoice()) open(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
