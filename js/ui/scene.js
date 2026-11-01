/* scene.js：依大境界換裝換景；所有進度仍由既有遊戲系統與存檔決定。 */
(function () {
  'use strict';
  const XG = window.XG = window.XG || {};
  let root = null, scene = null, unsubs = [], count = 0, schoolKey = null;
  let requestedArt = null, displayedArt = null, loadSerial = 0, retryAt = 0, failedArt = null;
  const preloaded = new Set();
  let sectController=null;
  const sayings = ['今天的努力，先從坐好開始。', '靈氣吸進來，煩惱吐出去。', '別看我在發呆，我在載入仙氣。', '師父說要放下。我先放下工作。', '離飛升還很遠，離午睡很近。', '坐得住，也是另一種超能力。', '修為慢慢長，肚子不能餓。', '我的道心很穩，除了開飯的時候。'];

  function cleanup() {
    if(sectController){sectController.stop();sectController=null;}
    unsubs.forEach(function (f) { if (typeof f === 'function') f(); });
    unsubs = []; root = scene = null; requestedArt = displayedArt = null;
    retryAt = 0; failedArt = null; schoolKey = null; loadSerial++; // 離開分頁後，舊圖片完成載入也不可覆寫新場景。
  }

  function describe(art) {
    const realm = XG.cfg.REALMS.find(function (r) { return r.id === art.id; });
    return (art.gender === 'male' ? '男主角 ♂・' : '女主角 ♀・') + (realm ? realm.name : '') + '境界・' + art.outfit + '，同一位Q版小仙人在' + art.scene + '打坐';
  }

  function setCaption(art) {
    if (!scene) return;
    const badge = scene.querySelector('#cute-scene-place');
    const realm = XG.cfg.REALMS.find(function (r) { return r.id === art.id; });
    badge.textContent = (realm ? realm.name : '') + '・' + art.scene;
    badge.title = art.outfit;
    scene.style.setProperty('--cute-realm-color', art.color);
    scene.dataset.realm = art.id; scene.dataset.gender = art.gender;
  }

  // 法器依「已顯示的境界」切換，避免新插畫尚未載入就配上下一境的法器。
  function syncSchool() {
    if (!scene || !XG.schoolArt) return;
    const level = Math.max(0, XG.cfg.REALMS.findIndex(function (r) { return r.id === scene.dataset.realm; }));
    const school = XG.state.player.school;
    const info = XG.schoolArt.info(school, level), key = info ? info.key : '';
    if (key === schoolKey) return;
    const box = scene.querySelector('.cute-scene-school-art');
    if (box) box.innerHTML = XG.schoolArt.render(school, level);
    schoolKey = key; scene.dataset.school = info ? info.school : '';
    scene.dataset.schoolLevel = String(level);
    const badge = scene.querySelector('#cute-scene-place');
    const art = XG.sceneArt.forRealm(level, scene.dataset.gender);
    badge.textContent = XG.cfg.REALMS[level].name + '・' + (info ? info.name : art.scene);
    badge.title = art.scene + '・' + art.outfit + (info ? '・' + info.name : '');
  }

  function renderSect(art) {
    if(!scene)return;
    const img=scene.querySelector('.cute-scene-sect-art');
    img.hidden=!art;
    if(art){img.src=art.src;scene.dataset.sect=art.id;}
    else{img.removeAttribute('src');delete scene.dataset.sect;}
    schoolKey=null;syncSchool();
    if(art)scene.querySelector('#cute-scene-place').textContent=art.name+'・'+art.place;
  }
  function syncSect(){const art=XG.sectArt.currentForPlayer();if(sectController)sectController.sync(art?art.id:null);}

  function preloadNext(art) {
    const list = XG.sceneArt.listForGender(art.gender);
    const idx = list.indexOf(art);
    const next = list[idx + 1];
    if (!next || preloaded.has(next.src)) return;
    preloaded.add(next.src);
    const img = new Image(); img.src = next.src; // 只預載下一境界，避免一次下載整套美術。
  }

  function updateArt(immediate) {
    if (!scene) return;
    const art = XG.sceneArt.forRealm(XG.state.player.realmIdx, XG.state.player.gender);
    if (!immediate && (requestedArt === art.key || (!requestedArt && failedArt === art.key && Date.now() < retryAt))) return;
    requestedArt = art.key;
    const token = ++loadSerial;
    const target = scene;
    const img = scene.querySelector('.cute-scene-art');
    let finished = false;
    const finish = function () {
      if (finished) return;
      if (!scene || scene !== target || token !== loadSerial) return;
      finished = true; retryAt = 0; failedArt = null;
      const changed = displayedArt !== null && displayedArt !== art.key;
      img.src = art.src; img.alt = describe(art); img.title = art.outfit;
      setCaption(art); displayedArt = art.key; schoolKey = null; syncSchool();
      scene.classList.remove('is-changing');
      if (changed) {
        void scene.offsetWidth; scene.classList.add('is-changing');
        scene.querySelector('#cute-scene-speech').textContent = art.quip;
      }
      preloadNext(art);
    };
    const pending = new Image();
    pending.onload = finish;
    pending.onerror = function () {
      if (!scene || scene !== target || token !== loadSerial) return;
      // 網路暫時中斷時保留最後成功畫面；重新連線後可重試，既有操作不受影響。
      requestedArt = null; failedArt = art.key; retryAt = Date.now() + 15000;
      if (!displayedArt || scene.dataset.gender !== art.gender) { img.src = XG.sceneArt.forRealm(0, art.gender).src; img.alt = (art.gender === 'male' ? '男主角' : '女主角') + '的桃花修行場景，境界造型載入中'; }
    };
    pending.src = art.src;
    if (pending.complete && pending.naturalWidth > 0) finish();
  }

  function mount(el) {
    cleanup(); root = el;
    const art = XG.sceneArt.forRealm(XG.state.player.realmIdx, XG.state.player.gender);
    el.innerHTML = '<div class="cute-scene"><img class="cute-scene-art" src="' + XG.util.esc(art.src) + '" alt="' + XG.util.esc(describe(art)) + '" width="1536" height="1024"><img class="cute-scene-sect-art" hidden alt="" aria-hidden="true" width="1536" height="1024"><div class="cute-scene-school-art" aria-hidden="true"></div><button class="cute-scene-camera" aria-label="查看乾淨完整圖片" title="仙界照相館：只留可愛，不留按鈕"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h4l1.5-2h5L16 7h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="4"/></svg></button><div class="cute-scene-top"><span class="cute-scene-badge" id="cute-scene-mode">仙氣自動補貨中</span><span class="cute-scene-badge" id="cute-scene-place"></span></div><span class="cute-sparkle s1">✦</span><span class="cute-sparkle s2">✧</span><span class="cute-sparkle s3">✦</span><button class="cute-person-hit" aria-label="點小仙人吐納靈氣"></button><button class="cute-adventure" hidden>✨ 奇遇來敲門</button><div class="cute-scene-pets"></div><div class="cute-scene-bottom"><div class="cute-scene-speech" id="cute-scene-speech"></div><button class="cute-tap-btn">戳我一下，吸口仙氣 <small>＋1秒修為</small></button></div></div>';
    scene = el.firstElementChild; setCaption(art);
    sectController=XG.sectArt.controller(renderSect);
    scene.querySelector('.cute-scene-camera').addEventListener('click', function () {
      syncSchool();
      const img = scene.querySelector('.cute-scene-art');
      if (XG.ui.openScenePhoto) XG.ui.openScenePhoto({ src: img.getAttribute('src'), alt: img.alt, school: scene.dataset.school, realmIdx: Number(scene.dataset.schoolLevel), sect: scene.dataset.sect||null });
    });
    scene.querySelector('.cute-person-hit').addEventListener('click', tap);
    scene.querySelector('.cute-tap-btn').addEventListener('click', tap);
    scene.querySelector('.cute-adventure').addEventListener('click', function () { if(XG.sys.sect&&XG.sys.sect.active()){XG.ui.showTab('sect');return;} const b = document.querySelector('[data-act="adv-open"]'); if (b) b.click(); });
    scene.querySelector('#cute-scene-speech').textContent = art.quip;
    unsubs.push(XG.bus.on('fx:breakthrough', function () {
      if (!scene) return;
      scene.classList.add('is-break');
      setTimeout(function () { if (scene) scene.classList.remove('is-break'); }, 1800);
    }));
    unsubs.push(XG.bus.on('realm:break', function () { updateArt(false); }));
    unsubs.push(XG.bus.on('character:chosen', function () { updateArt(false); }));
    unsubs.push(XG.bus.on('reincarn:done', function () { updateArt(false); }));
    updateArt(true); sync();
  }

  function tap() {
    if (!scene) return;
    const r = XG.sys.cultivation.tuona(); if (!r || !r.ok) return;
    scene.classList.remove('is-tapping'); void scene.offsetWidth; scene.classList.add('is-tapping');
    const n = document.createElement('span'); n.className = 'cute-float'; n.textContent = '修為 ＋' + XG.util.fmt(r.gain); scene.appendChild(n);
    setTimeout(function () { n.remove(); }, 1450);
    scene.querySelector('#cute-scene-speech').textContent = ['收到！這口仙氣很新鮮。', '咻——修為又長了一點！', '別戳太快，我會打仙嗝。', '深呼吸五秒，仙氣剛剛好。'][Math.floor(Math.random() * 4)];
    XG.ui.refreshTop();
  }

  function sync() {
    if (!scene) return;
    updateArt(false); syncSchool(); syncSect();
    scene.querySelector('.cute-tap-btn small').textContent='＋1秒修為';
    const p = XG.state.player, dw = XG.sys.cultivation.getDunwuInfo(), big = p.cultivateMode === 'biguan';
    scene.classList.toggle('is-biguan', big); scene.classList.toggle('is-dunwu', !!dw.active);
    scene.querySelector('#cute-scene-mode').textContent = dw.active ? '靈感插隊！頓悟 ×5' : big ? '認真躺平中 · 修煉 ×1.3' : '仙氣自動補貨中';
    const inSect=XG.sys.sect&&XG.sys.sect.active();
    const advButton=scene.querySelector('.cute-adventure');advButton.hidden=inSect?!XG.sys.sect.info().task:!XG.sys.adventure.getPending();advButton.textContent=inSect?'📋 宗門事務 ×'+XG.sys.sect.info().taskPending:'✨ 奇遇來敲門';
    if(inSect)scene.querySelector('#cute-scene-place').textContent=XG.sys.sect.school().name+'・'+XG.sys.sect.school().place;
    const pets = XG.sys.pets.teamList() || [];
    const html = pets.slice(0, 3).map(function (p) { return '<span class="cute-scene-pet" title="' + XG.util.esc(p.name || '靈寵') + '">' + XG.util.esc(p.icon || '🐾') + '</span>'; }).join('');
    const box = scene.querySelector('.cute-scene-pets'); if (box.innerHTML !== html) box.innerHTML = html;
    if (++count % 30 === 0) scene.querySelector('#cute-scene-speech').textContent = sayings[Math.floor(Math.random() * sayings.length)];
  }

  function tick() {
    const el = document.getElementById('scene-root');
    if (el && el !== root) mount(el); else if (!el && root) cleanup();
    if (scene) sync();
  }
  setInterval(tick, 750);
})();
