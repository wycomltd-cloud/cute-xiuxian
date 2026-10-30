/* ui-core.js：UI 框架（契約 §12 的 XG.ui 全部 API）+ 修煉主頁 tab（id:'home'）
 * 框架：registerTab（含 XG._pendingTabs 隊列消費）/ boot / refreshTop / 傳聞輪播 /
 *       底部導航 + 「更多」彈層 / toast / modal / confirm / pop / fx 三件套 / news
 * 主頁：境界大卡（突破+破境丹）/ 修煉模式 / 一鍵操作 / 修仙待辦小紙條（新手目標）/ 下一個小目標 / 靈根經脈 / 每日提醒角標
 * 約定：全部系統調用防禦性（判存 + try/catch）；數字一律 XG.util.fmt*；時間 XG.util.fmtTime；
 *       擴展樣式全部在本文件注入式 <style> 塊內，類名統一 xgh- 前綴防衝突。
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  // ============================ 內部狀態 ============================
  const tabs = [];              // 已註冊 tab 定義（按 order 排序）
  let activeId = null;          // 當前活躍 tab id
  let booted = false;           // boot 是否已完成
  let pendingOffline = null;    // boot 之前到達的離線結算報告（main.js 先 emit 後 boot）
  let moreOpen = false;         // 「更多」彈層開合
  let tickerIdx = 0;            // 傳聞輪播遊標
  let navSig = '';              // 底欄渲染簽名（防每秒重繪吞點擊）
  let moreSig = '';
  let topTimer = 0;             // res:changed 頂欄節流句柄

  // ============================ 小工具 ============================
  function $(id) { return document.getElementById(id); }
  function esc(s) { return XG.util.esc(s); }
  function fmt(n) { return XG.util.fmt(n); }
  function fmtInt(n) { return XG.util.fmtInt(n); }
  function fmtTime(s) { return XG.util.fmtTime(s); }
  function S() { return XG.state; }
  function settings() {
    const st = S();
    st.settings = st.settings || { newsCollapsed: false, sound: false };
    return st.settings;
  }
  function sys(id) { return (XG.sys && XG.sys[id]) || null; }
  // 防禦性調用系統函數：系統不存在/拋錯均返回 null，絕不白屏
  function call(sysId, fn, args) {
    try {
      const m = sys(sysId);
      if (!m || typeof m[fn] !== 'function') return null;
      return m[fn].apply(m, args || []);
    } catch (e) {
      console.error('[ui] ' + sysId + '.' + fn + ' 調用出錯', e);
      return null;
    }
  }

  // ============================ 注入樣式（xgh- 前綴） ============================
  const CSS = `
  /* —— 突破特效時長對齊契約 2.5s —— */
  .fx-breakthrough::before { animation-duration: 2.5s; }
  .fx-breakthrough-text { animation-duration: 2.5s; }
  /* —— 傳聞條摺疊後留一細條（含展開鈕），避免完全消失無法恢復 —— */
  #news-ticker.collapsed { max-height: 22px; border-bottom: 1px solid var(--line); }
  #news-ticker.collapsed .news-label, #news-ticker.collapsed .news-viewport { display: none; }
  #news-ticker.collapsed .news-ticker-inner { height: 22px; justify-content: center; }
  /* —— 屏幕震動 —— */
  @keyframes xghShake {
    0%,100% { transform: translateX(0); }
    20% { transform: translateX(-6px); } 40% { transform: translateX(5px); }
    60% { transform: translateX(-4px); } 80% { transform: translateX(3px); }
  }
  .xgh-shake { animation: xghShake .45s ease; }
  /* —— 底欄鎖定態 —— */
  .xgh-lock { opacity: .45; }
  /* —— 「更多」底部彈層 —— */
  .xgh-sheet-mask {
    position: fixed; inset: 0; z-index: 90; background: rgba(30,28,24,.5);
    animation: xghFadeIn .18s ease;
  }
  @keyframes xghFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .xgh-sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 95;
    max-width: 720px; margin: 0 auto;
    background: radial-gradient(circle at 20% 10%, rgba(201,160,99,.08), transparent 45%), var(--paper);
    border-top: 2px solid var(--gold); border-radius: 14px 14px 0 0;
    box-shadow: 0 -6px 24px rgba(0,0,0,.25);
    padding: 12px 12px 18px; max-height: 62vh; overflow-y: auto;
    animation: xghSheetUp .22s ease;
  }
  @keyframes xghSheetUp { from { transform: translateY(40px); opacity: .4; } to { transform: translateY(0); opacity: 1; } }
  .xgh-sheet-title { text-align: center; color: var(--qing-d); font-size: 15px; margin: 0 0 10px; }
  .xgh-more-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .xgh-more-item {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 10px 2px 7px; border: 1px solid var(--line); border-radius: 8px;
    background: var(--paper-d); cursor: pointer; user-select: none; font-size: 12px;
  }
  .xgh-more-item:active { transform: translateY(1px); }
  .xgh-more-item .xgh-mi-ico { font-size: 21px; line-height: 1.2; }
  .xgh-more-item .xgh-mi-cond { font-size: 10px; color: var(--ink-l); text-align: center; line-height: 1.3; }
  .xgh-more-item.xgh-lock { filter: grayscale(.6); }
  .xgh-more-item .badge-new { top: 3px; right: 4px; }
  /* —— 主頁：每日提醒角標 —— */
  .xgh-reminds { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .xgh-chip {
    position: relative; display: inline-flex; align-items: center; gap: 4px;
    font-size: 12px; color: var(--qing-d); background: var(--paper);
    border: 1px solid var(--line); border-radius: 14px; padding: 3px 10px; cursor: pointer;
  }
  .xgh-chip .xgh-dot {
    width: 7px; height: 7px; border-radius: 50%; background: var(--danger); flex: none;
    animation: xghDot 1.2s ease infinite;
  }
  @keyframes xghDot { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  /* —— 主頁：修煉模式三選 —— */
  .xgh-modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .xgh-mode {
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 4px; text-align: center;
    background: var(--paper-d); cursor: pointer; user-select: none;
  }
  .xgh-mode .xgh-mode-name { font-size: 14px; color: var(--ink); }
  .xgh-mode .xgh-mode-sub { font-size: 11px; color: var(--ink-l); line-height: 1.35; margin-top: 2px; }
  .xgh-mode.xgh-on { border-color: var(--gold); background: rgba(201,160,99,.14); box-shadow: inset 0 0 0 1px var(--gold); }
  .xgh-mode.xgh-off { cursor: not-allowed; }
  /* —— 主頁：一鍵操作 —— */
  .xgh-quick { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  @media (min-width: 768px) { .xgh-quick { grid-template-columns: repeat(4, 1fr); } }
  /* —— 主頁：目標/靈根明細行 —— */
  .xgh-line { display: flex; align-items: baseline; gap: 6px; font-size: 13px; padding: 3px 0; }
  .xgh-line .xgh-li { flex: none; width: 20px; text-align: center; }
  .xgh-line .xgh-lt { flex: none; color: var(--ink-l); }
  .xgh-line .xgh-lv { flex: 1; min-width: 0; }
  .xgh-gold { color: var(--gold-d); font-weight: bold; }
  .xgh-warn { color: var(--danger); }
  .xgh-dunwu-on { color: var(--gold-d); font-weight: bold; }
  /* —— 主頁：修仙待辦小紙條領取按鈕金閃 —— */
  @keyframes xghGoldFlash {
    0%,100% { box-shadow: 0 0 0 0 rgba(201,160,99,0); }
    50% { box-shadow: 0 0 12px 3px rgba(201,160,99,.8); }
  }
  .xgh-guide-claim { margin-top: 6px; animation: xghGoldFlash 1.2s ease infinite; }
  /* —— 彈窗通用 —— */
  .xgh-modal-body { font-size: 14px; line-height: 1.7; }
  .xgh-modal-body ul { margin: 6px 0; padding-left: 20px; }
  .xgh-hr { border: none; border-top: 1px dashed var(--line); margin: 8px 0; }
  /* —— 破境丹選擇 —— */
  .xgh-pill {
    display: flex; align-items: center; gap: 8px; border: 1px solid var(--line);
    border-radius: 8px; padding: 7px 10px; margin-bottom: 6px; cursor: pointer; background: var(--paper-d);
  }
  .xgh-pill.xgh-on { border-color: var(--gold); background: rgba(201,160,99,.16); box-shadow: inset 0 0 0 1px var(--gold); }
  .xgh-pill.xgh-off { opacity: .45; cursor: not-allowed; }
  .xgh-pill .xgh-pi { font-size: 20px; }
  .xgh-pill .xgh-pn { flex: 1; }
  .xgh-pill .xgh-pc { color: var(--gold-d); font-weight: bold; }
  /* —— 經脈樹 —— */
  .xgh-branch { margin-bottom: 10px; }
  .xgh-branch-name { color: var(--qing-d); font-size: 14px; border-bottom: 1px dashed var(--line); padding-bottom: 3px; margin-bottom: 6px; }
  .xgh-acus { display: flex; flex-wrap: wrap; gap: 6px; }
  .xgh-acu {
    border: 1px solid var(--line); border-radius: 16px; padding: 3px 10px; font-size: 12px;
    background: var(--paper-d); color: var(--ink-l); cursor: default; user-select: none;
  }
  .xgh-acu.xgh-lit { background: rgba(201,160,99,.2); border-color: var(--gold); color: #7a5b1e; }
  .xgh-acu.xgh-can { background: rgba(58,125,107,.12); border-color: var(--qing); color: var(--qing-d); cursor: pointer; }
  .xgh-acu.xgh-can:active { transform: translateY(1px); }
  .xgh-chip-adv { border-color: var(--gold-d) !important; color: var(--gold-d) !important; font-weight: bold; animation: xghAdvPulse 1.6s ease-in-out infinite; }
  @keyframes xghAdvPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(201,160,99,0); } 50% { box-shadow: 0 0 8px 2px rgba(201,160,99,.55); } }
  .xgh-adv-hidden { margin-top:8px; padding:8px 10px; border:1px solid var(--gold-d); border-radius:8px; background:rgba(201,160,99,.12); color:#7a5b1e; line-height:1.6; }
  `;
  function injectCss() {
    const el = document.createElement('style');
    el.id = 'xgh-style';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  // ============================ tab 註冊（含 _pendingTabs 消費） ============================
  function sortTabs() { tabs.sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function findTab(id) { for (const t of tabs) if (t.id === id) return t; return null; }
  function registerTab(def) {
    if (!def || !def.id || typeof def.mount !== 'function') return;
    const old = findTab(def.id);
    if (old) tabs.splice(tabs.indexOf(old), 1, def);
    else tabs.push(def);
    sortTabs();
    navSig = ''; moreSig = '';
  }

  // ============================ 解鎖判定 ============================
  function unlockText(sysId) {
    const u = XG.cfg && XG.cfg.UNLOCKS && XG.cfg.UNLOCKS[sysId];
    if (!u) return '';
    if (u.days) return '創角滿 ' + u.days + ' 日方可開啓';
    const r = XG.cfg.REALMS[u.realmIdx];
    return '達 ' + (r ? r.name : '?') + ' ' + u.layer + ' 層開啓';
  }
  function tabLocked(def) {
    return !!(def && def.sysId && XG.cfg && XG.cfg.isUnlocked && !XG.cfg.isUnlocked(def.sysId));
  }
  // NEW 角標：解鎖後未點過
  function isNew(def) {
    if (!def || tabLocked(def)) return false;
    return !settings().seenTabs || !settings().seenTabs[def.id];
  }
  function markSeen(id) {
    const s = settings();
    s.seenTabs = s.seenTabs || {};
    if (!s.seenTabs[id]) {
      s.seenTabs[id] = 1;
      try { XG.bus.emit('save:dirty'); } catch (e) { /* 忽略 */ }
    }
  }

  // ============================ toast（頂部輕提示） ============================
  function toast(msg, type) {
    const root = $('toast-root');
    if (!root) return;
    while (root.children.length >= 5) root.removeChild(root.firstChild);
    const el = document.createElement('div');
    el.className = 'toast';
    if (type === 'gold') el.classList.add('toast-gold');
    else if (type === 'red' || type === 'err' || type === 'error') el.classList.add('toast-err');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2700);
  }

  // ============================ modal / confirm ============================
  let modalBtns = [];
  let lastModalTitle = null; // 上一次彈窗標題（同題重繪時保持滾動位置）
  function closeModal() {
    const root = $('modal-root');
    if (root) root.innerHTML = '';
    modalBtns = [];
    lastModalTitle = null;
  }
  function modal(opt) {
    opt = opt || {};
    const root = $('modal-root');
    if (!root) return;
    // 同標題重繪（裝備/靈寵詳情操作後刷新彈窗）時保持 .modal 滾動位置，避免跳回頂部
    const oldBox = root.querySelector('.modal');
    const keepScroll = !!(oldBox && lastModalTitle != null && lastModalTitle === (opt.title || ''));
    const oldTop = keepScroll ? oldBox.scrollTop : 0;
    const btns = (opt.buttons && opt.buttons.length) ? opt.buttons : [{ text: '告辭' }];
    modalBtns = btns;
    root.innerHTML =
      '<div class="modal-mask" data-mmask="1"><div class="modal ' + esc(opt.cls || '') + '">' +
      '<h3 class="modal-title">' + esc(opt.title || '') + '</h3>' +
      '<div class="xgh-modal-body">' + (opt.html || '') + '</div>' +
      '<div class="modal-btns">' +
      btns.map(function (b, i) {
        return '<button class="btn ' + esc(b.cls || '') + '" data-mbtn="' + i + '">' + esc(b.text) + '</button>';
      }).join('') +
      '</div></div></div>';
    lastModalTitle = opt.title || '';
    if (keepScroll) {
      const nb = root.querySelector('.modal');
      if (nb) nb.scrollTop = oldTop;
    }
  }
  function confirm(text, cb) {
    modal({
      title: '請道友定奪',
      html: '<p style="text-align:center;margin:6px 0">' + esc(text) + '</p>',
      buttons: [
        { text: '確定', cls: 'btn-primary', cb: function () { if (cb) cb(); } },
        { text: '再想想', cls: 'btn-ghost' },
      ],
    });
  }
  // modal-root 事件委託（掛一次，元素常駐）
  function bindModalRoot() {
    const root = $('modal-root');
    if (!root || root._xghBound) return;
    root._xghBound = true;
    root.addEventListener('click', function (ev) {
      const t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-mmask')) { closeModal(); return; }
      const btn = t && t.closest ? t.closest('[data-mbtn]') : null;
      if (btn) {
        const b = modalBtns[Number(btn.getAttribute('data-mbtn'))];
        if (!b) { closeModal(); return; }
        if (b.cb && b.cb() === false) return; // cb 返回 false 保持彈窗
        closeModal();
      }
    });
  }

  // ============================ pop（屏幕中央浮動跳字） ============================
  function pop(text, cls) {
    if (pop._muted) return; // 批量操作（一鍵論道等）期間靜音，由調用方聚合跳字
    const root = $('pop-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'pop-num';
    if (cls === 'good' || cls === 'green') el.classList.add('pop-good');
    else if (cls === 'bad' || cls === 'red' || cls === 'warn') el.classList.add('pop-bad');
    // 隨機散佈，防止多次跳字完全重疊
    el.style.left = (42 + Math.random() * 16) + '%';
    el.style.top = (38 + Math.random() * 10) + '%';
    el.textContent = text;
    root.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1500);
  }

  // ============================ fx 三件套 ============================
  const fx = {
    // 突破：全屏金光徑向擴散 + 大字，2.5s
    breakthrough: function () {
      const root = $('fx-root');
      if (!root) return;
      const el = document.createElement('div');
      el.className = 'fx-breakthrough';
      el.innerHTML = '<span class="fx-breakthrough-text">突破成功</span>';
      root.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
    },
    // 掉落光柱（grade≥3 觸發）：按品階着色
    drop: function (grade) {
      grade = Number(grade) || 0;
      if (grade < 3) return;
      const root = $('fx-root');
      if (!root) return;
      const colors = { 3: 'rgba(142,108,201,.85)', 4: 'rgba(233,196,106,.9)', 5: 'rgba(217,79,61,.9)' };
      const el = document.createElement('div');
      el.className = 'fx-drop-beam';
      el.style.setProperty('--beam-color', colors[grade] || colors[5]);
      root.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1700);
    },
    // 屏幕震動
    shake: function () {
      const app = $('app');
      if (!app) return;
      app.classList.remove('xgh-shake');
      void app.offsetWidth;
      app.classList.add('xgh-shake');
      setTimeout(function () { app.classList.remove('xgh-shake'); }, 500);
    },
  };

  // ============================ 傳聞輪播 ============================
  const NEWS_CAT = { fellow: '道友', player: '修行', system: '聽聞', market: '坊市', dungeon: '秘境', world: '軼聞' };
  function newsList() { return (S().news || []).slice(0, 30); }
  function tickerText(item) {
    if (!item) return '仙界羣組很安靜，可能都在午睡。';
    const tag = NEWS_CAT[item.cat];
    return (tag ? '【' + tag + '】' : '') + (item.text || '');
  }
  function setTickerItem() {
    const el = $('xgh-news-text');
    if (!el) return;
    const list = newsList();
    if (!list.length) { el.textContent = tickerText(null); return; }
    tickerIdx = ((tickerIdx % list.length) + list.length) % list.length;
    const text = tickerText(list[tickerIdx]);
    el.textContent = text;
    el.style.animationDuration = Math.min(30, Math.max(9, 5 + text.length * 0.3)) + 's';
  }
  function restartTicker() {
    const el = $('xgh-news-text');
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth; // 強制 reflow 重啓動畫
    el.style.animation = '';
    setTickerItem();
  }
  // 新傳聞推入輪播（跳到最新一條）
  function news(obj) {
    // 系統經 pushNews 已落 state.news 併發 bus；ui.news 供直接調用：未落檔則補錄
    if (obj && obj.text) {
      const arr = S().news = S().news || [];
      if (arr[0] !== obj) {
        arr.unshift(obj);
        const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
        if (arr.length > cap) arr.length = cap;
      }
    }
    tickerIdx = 0;
    if (booted) restartTicker();
  }
  function buildTicker() {
    const t = $('news-ticker');
    if (!t) return;
    t.innerHTML =
      '<div class="news-ticker-inner">' +
      '<span class="news-label">傳聞</span>' +
      '<div class="news-viewport"><span class="news-scroll" id="xgh-news-text"></span></div>' +
      '<button class="news-toggle" id="xgh-news-toggle"></button>' +
      '</div>';
    const scroll = $('xgh-news-text');
    if (scroll) {
      scroll.addEventListener('animationiteration', function () {
        tickerIdx += 1;
        setTickerItem();
      });
    }
    const btn = $('xgh-news-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        const s = settings();
        s.newsCollapsed = !s.newsCollapsed;
        applyTickerCollapse();
        try { XG.bus.emit('save:dirty'); } catch (e) { /* 忽略 */ }
      });
    }
    applyTickerCollapse();
    setTickerItem();
  }
  function applyTickerCollapse() {
    const t = $('news-ticker');
    const btn = $('xgh-news-toggle');
    if (!t) return;
    const collapsed = !!settings().newsCollapsed;
    t.classList.toggle('collapsed', collapsed);
    if (btn) btn.textContent = collapsed ? '傳聞 ▾' : '收起 ▴';
  }

  // ============================ 頂欄 ============================
  function buildTopbar() {
    const tb = $('topbar');
    if (!tb) return;
    tb.innerHTML =
      '<div class="topbar">' +
      '<div class="topbar-row">' +
      '<div class="topbar-avatar" id="xgh-avatar">煉</div>' +
      '<div class="topbar-main">' +
      '<div><span class="topbar-name" id="xgh-name"></span><span class="topbar-realm" id="xgh-realm"></span></div>' +
      '<div class="progress"><div class="progress-fill" id="xgh-top-fill"></div><div class="progress-text" id="xgh-top-ptext"></div></div>' +
      '<div class="topbar-rate" id="xgh-top-rate"></div>' +
      '</div></div>' +
      '<div class="res-bar">' +
      '<span class="res-item"><span class="res-ico">⚔️</span><span class="res-num" id="xgh-power" style="color:var(--gold-d)">0</span> 戰力</span>' +
      '<span class="res-item"><span class="res-ico">🪙</span><span class="res-num" id="xgh-lingshi">0</span> 靈石</span>' +
      '<span class="res-item"><span class="res-ico">💎</span><span class="res-num" id="xgh-lingyu">0</span> 靈玉</span>' +
      '</div></div>';
  }
  function refreshTop() {
    if (!booted) return;
    const p = S().player;
    if (!p) return;
    const realm = XG.cfg.REALMS[p.realmIdx] || XG.cfg.REALMS[0];
    const last = p.realmIdx >= XG.cfg.REALMS.length - 1;
    const cost = last ? Infinity : XG.cfg.layerCost(p.realmIdx, p.layer || 1);
    const cult = p.cult || 0;
    const pct = last ? 100 : Math.max(0, Math.min(100, cult / cost * 100));
    let rate = 0;
    try { rate = (XG.stats && XG.stats.get().cultRate) || 0; } catch (e) { rate = 0; }
    const set = function (id, txt) { const el = $(id); if (el && el.textContent !== txt) el.textContent = txt; };
    set('xgh-avatar', (realm.name || '煉').charAt(0));
    set('xgh-name', (p.name || '無名散修') + (XG.character ? ' ' + XG.character.symbol(p.gender) : ''));
    set('xgh-realm', realm.name + (last ? '' : ' ' + (p.layer || 1) + ' 層'));
    const fill = $('xgh-top-fill');
    if (fill) fill.style.width = pct.toFixed(1) + '%';
    set('xgh-top-ptext', last ? '已至絕巔' : fmt(cult) + ' / ' + fmt(cost));
    set('xgh-top-rate', '修為 +' + fmt(rate) + '/秒');
    let power = 0;
    try { power = (XG.stats && XG.stats.get().power) || 0; } catch (e) { power = 0; }
    set('xgh-power', fmt(power));
    set('xgh-lingshi', fmtInt((S().res && S().res.lingShi) || 0));
    set('xgh-lingyu', fmtInt((S().res && S().res.lingYu) || 0));
  }

  // ============================ 底部導航 ============================
  function mainTabs() { return tabs.filter(function (t) { return t.main; }).slice(0, 4); }
  function moreTabs() { return tabs.filter(function (t) { return !t.main; }); }
  function buildNav() {
    const nav = $('bottom-nav');
    if (!nav) return;
    nav.innerHTML = '<div class="bottom-nav" id="xgh-nav-inner"></div>';
    if (!nav._xghBound) {
      nav._xghBound = true;
      nav.addEventListener('click', function (ev) {
        const item = ev.target && ev.target.closest ? ev.target.closest('[data-tab]') : null;
        if (!item) return;
        const id = item.getAttribute('data-tab');
        if (id === '__more') { toggleMore(); return; }
        showTab(id);
      });
    }
    navSync(true);
  }
  function navSync(force) {
    const inner = $('xgh-nav-inner');
    if (!inner) return;
    const items = mainTabs();
    let sig = activeId + '|';
    let html = '';
    for (const def of items) {
      const locked = tabLocked(def);
      const isNewB = !locked && isNew(def);
      sig += def.id + (locked ? 'L' : '') + (isNewB ? 'N' : '') + ';';
      html += '<div class="nav-item' + (def.id === activeId ? ' active' : '') + (locked ? ' xgh-lock' : '') + '"' +
        ' data-tab="' + esc(def.id) + '"' + (locked ? ' title="' + esc(unlockText(def.sysId)) + '"' : '') + '>' +
        '<span class="nav-ico">' + esc(def.icon || '·') + '</span><span>' + esc(def.name) + '</span>' +
        (isNewB ? '<span class="badge-new">NEW</span>' : '') +
        '</div>';
    }
    // 「更多」固定末格：有任意未解鎖/新解鎖的非 main tab 時帶角標
    const anyNew = moreTabs().some(function (t) { return isNew(t); });
    sig += '__more' + (anyNew ? 'N' : '') + (moreOpen ? 'O' : '');
    html += '<div class="nav-item' + (moreOpen ? ' active' : '') + '" data-tab="__more">' +
      '<span class="nav-ico">✦</span><span>更多</span>' +
      (anyNew ? '<span class="badge-new">NEW</span>' : '') +
      '</div>';
    if (!force && sig === navSig) return;
    navSig = sig;
    inner.innerHTML = html;
  }

  // ============================ 「更多」底部彈層 ============================
  function toggleMore() { moreOpen ? closeMore() : openMore(); }
  function openMore() {
    moreOpen = true;
    moreSig = '';
    renderMore(true);
    navSync();
  }
  function closeMore() {
    moreOpen = false;
    const root = $('xgh-more-root');
    if (root) root.innerHTML = '';
    navSync();
  }
  function renderMore(force) {
    if (!moreOpen) return;
    let root = $('xgh-more-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'xgh-more-root';
      document.body.appendChild(root);
      root.addEventListener('click', function (ev) {
        if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-sheetmask')) { closeMore(); return; }
        const item = ev.target && ev.target.closest ? ev.target.closest('[data-mtab]') : null;
        if (!item) return;
        const id = item.getAttribute('data-mtab');
        const def = findTab(id);
        if (!def) return;
        if (tabLocked(def)) { toast(unlockText(def.sysId) || '機緣未至', 'info'); return; }
        closeMore();
        showTab(id);
      });
    }
    const list = moreTabs();
    let sig = '';
    let html = '<div class="xgh-sheet-mask" data-sheetmask="1"></div><div class="xgh-sheet">' +
      '<p class="xgh-sheet-title">☁️ 仙界生活百貨 ☁️</p><div class="xgh-more-grid">';
    for (const def of list) {
      const locked = tabLocked(def);
      const isNewB = !locked && isNew(def);
      sig += def.id + (locked ? 'L' : '') + (isNewB ? 'N' : '') + ';';
      html += '<div class="xgh-more-item' + (locked ? ' xgh-lock' : '') + '" data-mtab="' + esc(def.id) + '">' +
        '<span class="xgh-mi-ico">' + esc(def.icon || '·') + '</span>' +
        '<span>' + esc(def.name) + '</span>' +
        (locked ? '<span class="xgh-mi-cond">' + esc(unlockText(def.sysId)) + '</span>' : '') +
        (isNewB ? '<span class="badge-new">NEW</span>' : '') +
        '</div>';
    }
    if (!list.length) html += '<div class="muted" style="grid-column:1/-1;text-align:center">機緣未至，萬象未開。</div>';
    html += '</div></div>';
    if (!force && sig === moreSig) return;
    moreSig = sig;
    root.innerHTML = html;
  }

  // ============================ tab 切換 ============================
  function showTab(id) {
    const def = findTab(id);
    if (!def) return false;
    if (tabLocked(def)) { toast(unlockText(def.sysId) || '機緣未至，此處尚未開啓', 'info'); return false; }
    if (activeId === id) return true;
    const old = findTab(activeId);
    if (old && typeof old.unmount === 'function') {
      try { old.unmount(); } catch (e) { console.error('[ui] ' + old.id + '.unmount 出錯', e); }
    }
    activeId = id;
    markSeen(id);
    const c = $('tab-container');
    if (!c) return false;
    c.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'tab-page';
    wrap.setAttribute('data-tab-page', id);
    c.appendChild(wrap);
    try {
      def.mount(wrap);
    } catch (e) {
      console.error('[ui] ' + id + '.mount 出錯', e);
      wrap.innerHTML = '<div class="card"><h2 class="card-title">此處風水不佳</h2><p class="card-sub">界面渲染受阻，請稍後再試。</p></div>';
    }
    navSync();
    return true;
  }
  function renderActive() {
    const def = findTab(activeId);
    if (!def) return;
    if (typeof def.unmount === 'function') {
      try { def.unmount(); } catch (e) { /* 忽略 */ }
    }
    const keep = activeId;
    activeId = null;
    showTab(keep);
  }

  // ============================ 離線結算彈窗（modal:offline） ============================
  function pillName(id) {
    const base = String(id).replace(/_star$/, '');
    const list = (XG.data && XG.data.pills && XG.data.pills.recipes) || [];
    for (const r of list) if (r.id === base) return r.name + (/_star$/.test(id) ? '★' : '');
    return base;
  }
  function showOfflineModal(rep) {
    if (!rep) return;
    let html = '<p style="text-align:center;margin:2px 0">你去忙生活，修為偷偷加了班。<br>這次離開了 <b class="xgh-gold">' + fmtTime(rep.dt || 0) + '</b>，，歡迎回來摸魚。</p>';
    if (rep.capped || rep.truncated) {
      let capSec = 0;
      try { capSec = XG.stats.get().offlineCapSec || 0; } catch (e) { capSec = 0; }
      html += '<p class="xgh-warn" style="text-align:center;margin:2px 0">閉關機緣已至上限' + (capSec ? '（' + fmtTime(capSec) + '）' : '') + '，溢出歲月隨風而散。</p>';
    }
    html += '<hr class="xgh-hr"><ul>';
    if (rep.cultGain) html += '<li>修為 <span class="xgh-gold">+' + fmt(rep.cultGain) + '</span></li>';
    const RES_NAMES = { lingShi: '靈石', lingYu: '靈玉' };
    if (rep.resGain) {
      for (const k in rep.resGain) {
        if (!rep.resGain[k]) continue;
        html += '<li>' + esc(RES_NAMES[k] || k) + ' <span class="xgh-gold">+' + fmt(rep.resGain[k]) + '</span></li>';
      }
    }
    if (rep.pillGain) {
      for (const id in rep.pillGain) {
        if (!rep.pillGain[id]) continue;
        html += '<li>丹藥「' + esc(pillName(id)) + '」×' + fmtInt(rep.pillGain[id]) + '</li>';
      }
    }
    if (rep.cave && rep.cave.note) html += '<li>' + esc(rep.cave.note) + '</li>';
    html += '</ul>';
    if (rep.expedition && rep.expedition.items && rep.expedition.items.length) {
      html += '<hr class="xgh-hr"><p style="margin:2px 0"><b>歷練歸報</b></p><ul>';
      rep.expedition.items.slice(0, 6).forEach(function (s) { html += '<li>' + esc(s) + '</li>'; });
      html += '</ul>';
    }
    if (rep.events && rep.events.length) {
      html += '<hr class="xgh-hr"><p style="margin:2px 0"><b>閉關簡訊</b></p><ul>';
      rep.events.slice(0, 8).forEach(function (s) { html += '<li>' + esc(s) + '</li>'; });
      if (rep.events.length > 8) html += '<li class="muted">……另有 ' + (rep.events.length - 8) + ' 樁小事，不足掛齒。</li>';
      html += '</ul>';
    }
    if (rep.fellowNews && rep.fellowNews.length) {
      html += '<hr class="xgh-hr"><p style="margin:2px 0"><b>道友動態</b></p><ul>';
      rep.fellowNews.slice(0, 6).forEach(function (s) { html += '<li>' + esc(s) + '</li>'; });
      html += '</ul>';
    }
    modal({ title: '你不在的時候，我有乖乖修仙', html: html, buttons: [{ text: '收好，都是我的！', cls: 'btn-primary' }] });
  }

  // ============================ boot（main.js 調用） ============================
  function boot() {
    if (booted) return;
    booted = true;
    injectCss();
    bindModalRoot();
    // 消費先於此文件加載的 tab 隊列（防禦：其他 ui 文件可能先加載）
    const pend = XG._pendingTabs || [];
    XG._pendingTabs = [];
    pend.forEach(registerTab);

    buildTopbar();
    buildTicker();
    buildNav();

    // 默認打開首個 main tab（修煉）
    const first = mainTabs()[0] || tabs[0];
    if (first) showTab(first.id);
    refreshTop();

    // boot 前到達的離線報告：UI 就緒後補彈
    if (pendingOffline) {
      const r = pendingOffline;
      pendingOffline = null;
      setTimeout(function () { showOfflineModal(r); }, 350);
    }

    // 1s UI 刷新循環（契約 §12：僅活躍 tab 的 update 被調）
    setInterval(function () {
      try {
        refreshTop();
        navSync();
        renderMore();
        const def = findTab(activeId);
        if (def && typeof def.update === 'function') def.update(1);
      } catch (e) {
        console.error('[ui] 刷新循環出錯', e);
      }
    }, 1000);
  }

  // ============================ 總線訂閱（文件級：modal:offline 先於 boot 到達） ============================
  XG.bus.on('modal:offline', function (rep) {
    if (booted) showOfflineModal(rep);
    else pendingOffline = rep;
  });
  XG.bus.on('fx:breakthrough', function (payload) {
    if (booted && !(payload && payload.tribulation)) fx.breakthrough();
  });
  XG.bus.on('ach:done', function (p) {
    if (!booted || !p) return;
    let name = p.id || '';
    const list = XG.data && XG.data.ach;
    if (list && list.length) {
      for (const a of list) if (a.id === p.id) { name = (a.icon ? a.icon + ' ' : '') + a.name; break; }
    }
    toast('成就達成 · ' + name, 'gold');
  });
  // 新奇遇臨門：金色輕提示引至頁首提醒條（頻率天然剋制：1~3 分鐘一樁）
  XG.bus.on('adv:pending', function () {
    if (!booted) return;
    toast('奇遇臨門，且見頁首提醒', 'gold');
    try { refreshReminds(); } catch (e) { /* 不在主頁亦無妨 */ }
  });
  XG.bus.on('codex:new', function (p) {
    if (!booted || !p) return;
    const KIND_NAMES = { gongfa: '功法', pill: '丹方', pet: '靈寵', equip: '裝備', fellow: '道友' };
    let name = '';
    try {
      if (p.kind === 'gongfa') {
        const pool = ((XG.data.gongfa && XG.data.gongfa.list) || []).concat((S().gongfa && S().gongfa.custom) || []);
        for (const g of pool) if (g.id === p.id) { name = g.name; break; }
      } else if (p.kind === 'pill') {
        for (const r of (XG.data.pills && XG.data.pills.recipes) || []) if (r.id === p.id) { name = r.name; break; }
      } else if (p.kind === 'pet') {
        for (const sp of (XG.data.pets && XG.data.pets.species) || []) if (sp.id === p.id) { name = sp.name; break; }
      } else if (p.kind === 'equip') {
        for (const b of (XG.data.equips && XG.data.equips.bases) || []) if (b.id === p.id) { name = b.name; break; }
      } else if (p.kind === 'fellow') {
        const fn = S().codex && S().codex.fellowNames;
        name = (fn && fn[p.id]) || '';
      }
    } catch (e) { name = ''; }
    toast('圖鑑新收錄 · ' + (KIND_NAMES[p.kind] || '萬物') + (name ? '「' + name + '」' : ''), 'gold');
  });
  XG.bus.on('news', function (item) {
    if (!booted) return;
    tickerIdx = 0;
    restartTicker();
  });
  // 資源/修為變動 → 節流刷新頂欄
  XG.bus.on('res:changed', function () {
    if (!booted || topTimer) return;
    topTimer = setTimeout(function () { topTimer = 0; refreshTop(); }, 300);
  });

  // ============================================================
  // 修煉主頁 tab（id:'home', main:true, order:0）
  // ============================================================
  const H = { el: null, sig: {}, brkSelected: [] };

  function setT(id, txt) {
    const el = H.el && H.el.querySelector('#' + id);
    if (el && el.textContent !== txt) el.textContent = txt;
  }
  function sigHTML(key, html) {
    if (H.sig[key] === html) return;
    H.sig[key] = html;
    const el = H.el && H.el.querySelector('#xgh-' + key);
    if (el) el.innerHTML = html;
  }
  function effText(eff) {
    if (!eff) return '';
    const NAMES = {
      cultRatePct: '修煉速度', atkPct: '攻擊', defPct: '防禦', hpPct: '氣血', spdPct: '身法',
      dropPct: '掉落', alchSuccPct: '煉丹成功率', forgeSuccPct: '鍛造成功率', breakSuccPct: '破境成功率',
      workPct: '雜務效率', offlineHours: '離線收益', atkFlat: '攻擊', defFlat: '防禦', hpFlat: '氣血', spdFlat: '身法',
    };
    const parts = [];
    for (const k in eff) {
      const v = eff[k];
      if (!v) continue;
      if (k === 'offlineHours') parts.push(NAMES[k] + ' +' + v + ' 小時');
      else if (/Pct$/.test(k)) parts.push(NAMES[k] + ' +' + v + '%');
      else parts.push((NAMES[k] || k) + ' +' + fmt(v));
    }
    return parts.join('，');
  }

  // ---------- ① 境界大卡 ----------
  function refreshRealm() {
    const p = S().player;
    if (!p) return;
    const cv = call('cultivation', 'getCultView');
    const bi = call('cultivation', 'getBreakInfo');
    const realm = XG.cfg.REALMS[p.realmIdx] || XG.cfg.REALMS[0];
    const last = p.realmIdx >= XG.cfg.REALMS.length - 1;
    const cost = bi ? bi.cost : (last ? Infinity : XG.cfg.layerCost(p.realmIdx, p.layer || 1));
    const cult = p.cult || 0;
    const pct = last ? 100 : Math.max(0, Math.min(100, cult / cost * 100));

    setT('xgh-r-name', realm.name + (last ? '' : ' ' + (p.layer || 1) + ' / ' + XG.cfg.LAYERS + ' 層'));
    setT('xgh-r-mode', cv ? (cv.modeName + ' ×' + cv.modeMult) : '');
    const fill = H.el.querySelector('#xgh-r-fill');
    if (fill) fill.style.width = pct.toFixed(1) + '%';
    setT('xgh-r-ptext', last ? '已至飛昇絕巔' : fmt(cult) + ' / ' + fmt(cost));
    setT('xgh-r-rate', cv ? ('吐納修為 +' + cv.cultRateText) : '');
    // 頓悟狀態行
    let dw = '';
    if (cv && cv.dunwu) {
      dw = cv.dunwu.active ? ('頓悟中！修煉 ×' + cv.dunwu.mult + ' · 餘 ' + fmtTime(cv.dunwu.remain)) : '';
    }
    setT('xgh-r-dunwu', dw);
    const dwEl = H.el.querySelector('#xgh-r-dunwu');
    if (dwEl) dwEl.className = dw ? 'xgh-dunwu-on' : 'muted';

    // 突破按鈕（小境界「精進」/ 大境界「突破」）
    const btn = H.el.querySelector('#xgh-brk-btn');
    if (btn && bi) {
      btn.textContent = bi.tribulationCount ? '引動 ' + bi.tribulationCount + ' 重天劫 ⚡' : bi.big ? '突破！仙界我來了' : '精進一下 ↑';
      btn.disabled = !bi.canBreak;
      btn.title = bi.canBreak ? '' : (bi.err || '');
    }
    let info = '';
    if (bi) {
      if (last) info = '已至絕巔，進無可進';
      else if (bi.big) {
        info = '衝擊「' + bi.targetText + '」· 需修為 ' + bi.costText + ' · 成功率 ' + Math.round(bi.baseRate * 100) + '%';
        if (bi.tribulationCount) info = bi.tribulationCount + ' 重天劫 · ' + info.replace('成功率', '整場成功率');
        if (bi.failBonus > 0) info += '（保底 +' + Math.round(bi.failBonus * 100) + '%）';
      } else {
        info = '下一層需修為 ' + bi.costText + '，水到渠成';
      }
    }
    setT('xgh-brk-info', info);
  }

  // ---------- ② 修煉模式三選 ----------
  function refreshModes() {
    const mi = call('cultivation', 'getModeInfo');
    if (!mi) return;
    const di = call('cultivation', 'getDunwuInfo');
    // 網格僅在關鍵狀態變化時重繪（防吞點擊）；倒計時提示每秒文字刷新
    const gsig = mi.mode + '|' + (mi.locked ? 1 : 0) + '|' + (di && di.active ? 1 : 0) + '|' + (di && di.boost && di.boost.active ? 1 : 0);
    if (H.sig.modes !== gsig) {
      H.sig.modes = gsig;
      let html = '';
      for (const m of mi.modes) {
        const on = m.id === mi.mode;
        html += '<div class="xgh-mode' + (on ? ' xgh-on' : '') + (mi.locked && !on ? ' xgh-off' : '') + '" data-act="mode" data-mode="' + esc(m.id) + '" title="' + esc(m.desc) + '">' +
          '<div class="xgh-mode-name">' + esc(m.name) + '</div>' +
          '<div class="xgh-mode-sub">修煉 ×' + m.mult + '</div></div>';
      }
      // 頓悟格：非可選模式，點擊彈出機制說明（防誤以為「沒生效」）
      let dwSub = '隨機降臨 · 降臨×' + ((di && di.mult) || 5);
      if (di && di.active) dwSub = '降臨中！餘 ' + fmtTime(di.remain);
      else if (di && di.chancePerSec > 0) dwSub = '約 ' + fmtTime(1 / di.chancePerSec) + ' 一遇';
      if (di && di.boost && di.boost.active) dwSub += ' · 悟性丹 +' + di.boost.pct + '%';
      html += '<div class="xgh-mode' + (di && di.active ? ' xgh-on' : '') + '" data-act="dunwu-info" style="cursor:pointer" title="頓悟不可強求，隨機降臨；降臨時 30 秒修煉 ×5。悟性丹可提升降臨幾率。點擊查看詳情。">' +
        '<div class="xgh-mode-name">頓悟 · 機緣</div><div class="xgh-mode-sub">' + esc(dwSub) + '</div></div>';
      const grid = H.el.querySelector('#xgh-modes');
      if (grid) grid.innerHTML = html;
    }
    let tip = '';
    if (mi.locked) tip = '閉關鎖脈中，尚需 ' + fmtTime(mi.lockRemain) + ' 方可改修他法。';
    else {
      const cur = (mi.modes || []).filter(function (m) { return m.id === mi.mode; })[0];
      tip = cur ? cur.desc : '';
      if (tip) tip += '點擊場景中的小人可手動吐納（每次約得20秒修為）。';
    }
    setT('xgh-mode-tip', tip);
  }

  // ---------- ③ 一鍵操作行 ----------
  function countCultPills() {
    const bag = (S().inv && S().inv.pill) || {};
    const TYPES = { cult: 1, atk: 1, def: 1, hp: 1, work: 1 };
    const recipes = (XG.data && XG.data.pills && XG.data.pills.recipes) || [];
    const map = {};
    for (const r of recipes) map[r.id] = r;
    let n = 0;
    for (const id in bag) {
      const r = map[String(id).replace(/_star$/, '')];
      if (r && r.eff && TYPES[r.eff.type] && (bag[id] || 0) > 0) n += bag[id];
    }
    return n;
  }
  function refreshQuick() {
    const st = {};
    // 一鍵領取：洞府靈田池 / 靈寵打工池 任一有貨
    let collect = false, collectWhy = '各處倉廩皆空，暫無進項';
    try {
      const pool = call('cave', 'getPool');
      if (pool && pool.whole > 0) collect = true;
      const pend = call('pets', 'pending');
      if (!collect && pend && (pend.lingShi >= 1 || (pend.mat && Object.keys(pend.mat).length))) collect = true;
    } catch (e) { /* 忽略 */ }
    st.collect = { can: collect, why: collectWhy };
    // 一鍵修煉：有修為丹/增益丹
    const pillN = countCultPills();
    st.cult = { can: pillN > 0, why: '囊中沒有修為丹或增益丹' };
    // 一鍵派遣
    let disp = false, dispWhy = '';
    if (!(XG.cfg.isUnlocked && XG.cfg.isUnlocked('expedition'))) dispWhy = unlockText('expedition');
    else {
      const slots = call('expedition', 'getSlots');
      const act = call('expedition', 'getActive') || [];
      const idle = call('expedition', 'getIdlePets') || [];
      if (slots && act.length >= slots.max) dispWhy = '遠征隊伍盡數在外';
      else if (!idle.length) dispWhy = '無空閒靈寵可使（煉氣5層解鎖靈寵）';
      else disp = true;
    }
    st.dispatch = { can: disp, why: dispWhy };
    // 一鍵掃蕩
    let sweep = false, sweepWhy = '';
    if (!(XG.cfg.isUnlocked && XG.cfg.isUnlocked('dungeon_tower'))) sweepWhy = unlockText('dungeon_tower');
    else {
      const si = call('dungeon', 'sweepInfo');
      if (!si) sweepWhy = '秘境未開';
      else if (si.best <= 1) sweepWhy = '尚未登頂任何層數';
      else if (!si.canSweep) sweepWhy = '今日免費次數已盡，靈玉亦不足';
      else sweep = true;
    }
    st.sweep = { can: sweep, why: sweepWhy };
    H.quick = st;
    const patch = function (id, v) {
      const b = H.el.querySelector('#' + id);
      if (!b) return;
      b.disabled = !v.can;
      b.title = v.can ? '' : v.why;
    };
    patch('xgh-q-collect', st.collect);
    patch('xgh-q-cult', st.cult);
    patch('xgh-q-dispatch', st.dispatch);
    patch('xgh-q-sweep', st.sweep);
  }

  // ---------- ③.5 修仙待辦小紙條卡（新手目標，防禦性讀 XG.sys.guide） ----------
  function refreshGuide() {
    const card = H.el && H.el.querySelector('#xgh-guide-card');
    if (!card) return;
    const g = sys('guide');
    if (!g) { card.style.display = 'none'; return; }
    card.style.display = '';
    const goal = call('guide', 'nextGoal');
    // 主體（目標名/描述/獎勵/領取按鈕）僅在狀態簽名變化時重繪——進度條走下方安全刷新，不打斷領取點擊
    const sig = goal ? (goal.id + '|' + (goal.done ? 1 : 0) + '|' + (goal.claimed ? 1 : 0)) : 'all';
    if (H.sig.guide !== sig) {
      H.sig.guide = sig;
      let html = '';
      if (!goal) {
        html = '<div class="xgh-line"><span class="xgh-li">🏅</span><span class="xgh-lv"><span class="xgh-gold">修仙待辦小紙條已圓滿</span>，仙途漫漫，此後且看你自己走了。</span></div>';
      } else {
        html = '<div class="xgh-line"><span class="xgh-li">📜</span><span class="xgh-lt">目標</span>' +
          '<span class="xgh-lv"><b>' + esc(goal.name) + '</b> · ' + esc(goal.desc) + '</span></div>' +
          '<div class="xgh-line"><span class="xgh-li">🎁</span><span class="xgh-lt">酬賞</span><span class="xgh-lv">' + esc(goal.rewardText) + '</span></div>';
        if (goal.done && !goal.claimed) {
          html += '<button class="btn btn-primary xgh-guide-claim" data-act="guide-claim" data-id="' + esc(goal.id) + '">領取酬賞</button>';
        }
      }
      const body = H.el.querySelector('#xgh-guide-body');
      if (body) body.innerHTML = html;
    }
    // 進度條：每秒只改寬度與文字（不重寫按鈕 DOM）
    const fill = H.el.querySelector('#xgh-guide-fill');
    const pct = goal && goal.target > 0 ? Math.min(100, goal.progress / goal.target * 100) : 100;
    if (fill) fill.style.width = pct.toFixed(1) + '%';
    setT('xgh-guide-ptext', goal ? (fmt(Math.min(goal.progress, goal.target)) + ' / ' + fmt(goal.target)) : '');
  }

  // ---------- ④ 下一個小目標卡 ----------
  function refreshGoals() {
    const p = S().player;
    if (!p) return;
    const lines = [];
    // 下一境界：還差多少修為 / 預計時間
    const bi = call('cultivation', 'getBreakInfo');
    if (bi && bi.cost !== Infinity) {
      const need = Math.max(0, bi.cost - (p.cult || 0));
      let rate = 0;
      try { rate = XG.stats.get().cultRate || 0; } catch (e) { rate = 0; }
      if (need <= 0) {
        lines.push({ i: '🎯', t: '下一境界', v: '修為已足，可隨時' + (bi.big ? '衝擊「' + bi.targetText + '」' : '精進一步') });
      } else {
        const eta = rate > 0 ? fmtTime(need / rate) : '遙遙無期';
        lines.push({ i: '🎯', t: '下一境界', v: '距「' + bi.targetText + '」尚缺修為 ' + fmt(need) + '，約需 ' + eta });
      }
    } else {
      lines.push({ i: '🎯', t: '下一境界', v: '已至飛昇絕巔，進無可進' });
    }
    // 圖鑑完成度
    const cs = call('collection', 'getCodexSummary');
    if (cs) lines.push({ i: '📖', t: '萬靈圖鑑', v: '完成度 ' + cs.pct + '%（' + cs.collected + ' / ' + cs.total + '）' });
    // 秘境層數
    let towerTxt = '';
    const ti = call('dungeon', 'towerInfo');
    if (ti && ti.unlocked) towerTxt = '鎮妖塔 第 ' + ti.layer + ' 層 · 歷史最佳 ' + ti.best + ' 層';
    else if (XG.cfg.isUnlocked && !XG.cfg.isUnlocked('dungeon_tower')) towerTxt = '鎮妖塔 · ' + unlockText('dungeon_tower');
    if (towerTxt) lines.push({ i: '🗼', t: '秘境', v: towerTxt });
    // 輪迴次數
    const rn = p.reincarn || 0;
    let reinTxt = '已歷 ' + rn + ' 世輪迴';
    if (!rn) {
      const open = call('reincarn', 'isOpen');
      reinTxt = open ? '飛昇在望，可引天劫' : '大乘一層可查看；大乘十層可挑戰天劫';
    }
    lines.push({ i: '🔄', t: '輪迴', v: reinTxt });

    const html = lines.map(function (l) {
      return '<div class="xgh-line"><span class="xgh-li">' + l.i + '</span><span class="xgh-lt">' + esc(l.t) + '</span><span class="xgh-lv">' + esc(l.v) + '</span></div>';
    }).join('');
    sigHTML('goals', html);
  }

  // ---------- ⑤ 靈根卡 ----------
  function refreshRoot() {
    const ri = call('cultivation', 'getRootInfo');
    if (!ri) return;
    const rsig = [ri.effId, ri.grade, ri.mult, ri.canWash, ri.washBoost && ri.washBoost.active, ri.mut].join('|');
    if (H.sig.root !== rsig) {
      H.sig.root = rsig;
      let html = '<div class="xgh-line"><span class="xgh-li">☯️</span><span class="xgh-lt">靈根</span>' +
        '<span class="xgh-lv"><b>' + esc(ri.effName) + '</b>（' + ri.grade + ' 品）· 修煉加成 ×' + ri.mult +
        (ri.mut ? ' · <span class="xgh-gold">已變異</span>' : '') + '</span></div>';
      if (ri.mut && ri.typeName) html += '<div class="xgh-line"><span class="xgh-li"></span><span class="xgh-lt">基底</span><span class="xgh-lv muted">' + esc(ri.typeName) + '</span></div>';
      if (ri.desc) html += '<div class="xgh-line"><span class="xgh-li"></span><span class="xgh-lv muted">' + esc(ri.desc) + '</span></div>';
      html += '<div class="xgh-line"><span class="xgh-li">🧪</span><span class="xgh-lt">洗練</span><span class="xgh-lv muted">耗 ' + esc(ri.washCostText) + '，重鑄五行，小概率變異（冰雷風暗光，乃至傳說中的混沌）</span></div>';
      const el = H.el.querySelector('#xgh-root');
      if (el) el.innerHTML = html;
    }
    // 變異加成倒計時（淬靈丹）
    let boost = '';
    if (ri.washBoost && ri.washBoost.active) boost = '淬靈丹加持：洗練變異率 +' + ri.washBoost.pct + '%（餘 ' + fmtTime(ri.washBoost.remain) + '）';
    setT('xgh-root-tip', boost);
    const btn = H.el.querySelector('#xgh-wash-btn');
    if (btn) {
      btn.disabled = !ri.canWash;
      btn.title = ri.canWash ? '' : (ri.washErr || '');
    }
  }

  // ---------- ⑥ 每日提醒角標 ----------
  function refreshReminds() {
    const chips = [];
    // 奇遇待決置頂（金框脈衝，此前無入口會導致奇遇系統卡死，務必醒目）
    if (XG.cfg.isUnlocked && XG.cfg.isUnlocked('adventure')) {
      const pd = call('adventure', 'getPending');
      if (pd) chips.push({ adv: 1, label: '奇遇 · ' + (pd.title || '待決') });
    }
    if (XG.cfg.isUnlocked && XG.cfg.isUnlocked('fellows')) {
      const list = call('fellows', 'list') || [];
      let dn = 0;
      for (const f of list) if (f.canDiscuss) dn++;
      if (dn > 0) chips.push({ tab: 'fellows', label: '論道 ×' + dn });
      const helps = call('fellows', 'listHelp') || [];
      let hn = 0;
      for (const h of helps) if (!h.done) hn++;
      if (hn > 0) chips.push({ tab: 'fellows', label: '求助 ×' + hn });
    }
    if (XG.cfg.isUnlocked && XG.cfg.isUnlocked('dungeon_tower')) {
      const si = call('dungeon', 'sweepInfo');
      if (si && si.freeLeft > 0 && si.best > 1) chips.push({ tab: 'dungeon', label: '免費掃蕩 ×' + si.freeLeft });
    }
    if (XG.cfg.isUnlocked && XG.cfg.isUnlocked('market')) {
      const mk = call('fellows', 'market');
      if (mk && mk.unlocked && (mk.refreshAt || 0) > (settings().mktSeen || 0)) {
        chips.push({ tab: 'market', label: '坊市新貨', mkt: 1 });
      }
    }
    const html = chips.map(function (c) {
      if (c.adv) return '<span class="xgh-chip xgh-chip-adv" data-act="adv-open"><span class="xgh-dot"></span>' + esc(c.label) + '</span>';
      return '<span class="xgh-chip" data-act="remind" data-tab="' + esc(c.tab) + '"' + (c.mkt ? ' data-mkt="1"' : '') + '><span class="xgh-dot"></span>' + esc(c.label) + '</span>';
    }).join('');
    sigHTML('reminds', html);
  }

  // ---------- 奇遇決斷彈窗 ----------
  const ADV_VIA = { cultivate: '靜坐偶得', explore: '歷練偶遇', offline: '歸來機緣', chain: '連鎖後緣' };
  // 打開當前待決奇遇（無待決則提示）
  function openAdventure() {
    const p = call('adventure', 'getPending');
    if (!p) { toast('奇遇還在路上，可能塞在雲裡。', 'info'); return; }
    let h = '<div style="text-align:center;font-size:26px;margin:2px 0">' + esc(p.icon || '✨') + '</div>'
      + (p.via ? '<div class="muted" style="text-align:center;margin-bottom:4px">' + esc(ADV_VIA[p.via] || '機緣') + '</div>' : '')
      + '<p style="margin:6px 0;line-height:1.7">' + esc(p.text || '') + '</p>';
    const btns = (p.choices || []).map(function (c, i) {
      return {
        text: c.reqOk === false ? (c.text + '（' + (c.reqText || '條件未足') + '）') : c.text,
        cls: c.reqOk === false ? 'btn-ghost' : (i === 0 ? 'btn-primary' : ''),
        cb: function () {
          if (c.reqOk === false) { toast('條件未足：' + (c.reqText || '境界未至'), 'red'); return false; }
          const r = call('adventure', 'choose', [c.i != null ? c.i : i]);
          if (!r || !r.ok) { toast((r && r.msg) || (r && r.err) || '抉擇失敗', 'red'); return false; }
          showAdventureResult(r);
          return false; // 彈窗鏈式複用，不關閉
        },
      };
    });
    modal({ title: '奇遇 · ' + (p.title || ''), html: h, buttons: btns.length ? btns : [{ text: '告辭' }] });
  }
  // 抉擇結果展示；有連鎖則「一探究竟」接續下一樁
  function showAdventureResult(r) {
    let h = '';
    (r.msg || []).forEach(function (m) { h += '<p style="margin:4px 0;line-height:1.6">' + esc(m) + '</p>'; });
    if (r.hiddenEnd) h += '<div class="xgh-adv-hidden">【隱藏結局】' + esc(r.hiddenEnd) + '</div>';
    try { homeUpdate(); } catch (e) { /* 刷新主頁資源/提醒 */ }
    if (r.next) {
      modal({
        title: '餘波未平', html: h,
        buttons: [{ text: '一探究竟', cls: 'btn-primary', cb: function () { openAdventure(); return false; } }],
      });
    } else {
      modal({ title: '奇遇已了', html: h || '<p>事已畢，你收束心神，繼續修行。</p>', buttons: [{ text: '收好，都是我的！', cls: 'btn-primary' }] });
    }
  }

  // ---------- 主頁聚合刷新 ----------
  function homeUpdate() {
    if (!H.el) return;
    try { refreshRealm(); } catch (e) { console.error('[home] 境界卡', e); }
    try { refreshModes(); } catch (e) { console.error('[home] 模式', e); }
    try { refreshQuick(); } catch (e) { console.error('[home] 一鍵', e); }
    try { refreshGuide(); } catch (e) { console.error('[home] 修仙待辦小紙條', e); }
    try { refreshGoals(); } catch (e) { console.error('[home] 目標', e); }
    try { refreshRoot(); } catch (e) { console.error('[home] 靈根', e); }
    try { refreshReminds(); } catch (e) { console.error('[home] 提醒', e); }
  }

  // ---------- 突破交互 ----------
  function openBreak() {
    const bi = call('cultivation', 'getBreakInfo');
    if (!bi) return;
    if (!bi.canBreak) { toast(bi.err || '修為未足，機緣未至', 'red'); return; }
    if (!bi.big) {
      const r = call('cultivation', 'tryBreakthrough');
      if (r && r.ok) toast(r.msg || '境界精進！', 'gold');
      else if (r) toast(r.err || r.msg || '突破受阻', 'red');
      homeUpdate();
      return;
    }
    H.brkSelected = [];
    renderBreakModal();
  }
  function renderBreakModal() {
    const bi = call('cultivation', 'getBreakInfo');
    if (!bi) { closeModal(); return; }
    const n = H.brkSelected.length;
    const rate = bi.rateWith(n);
    let html = '<p style="text-align:center;margin:2px 0">衝擊「' + esc(bi.targetText) + '」· ' + (bi.tribulationCount ? '整場' : '當前') + '成功率 <b class="xgh-gold">' + Math.round(rate * 100) + '%</b></p>' +
      '<p class="muted" style="text-align:center;margin:2px 0">基礎 ' + Math.round((bi.baseRate - bi.failBonus) * 100) + '%' +
      (bi.failBonus > 0 ? ' + 保底 ' + Math.round(bi.failBonus * 100) + '%' : '') +
      ' · 每顆破境丹 +' + Math.round((XG.cfg.BREAK_PILL_BONUS || 0.15) * 100) + '%（至多 ' + bi.pillMax + ' 顆）· 失敗扣本次需求的一半修為</p>' +
      '<hr class="xgh-hr">';
    if (bi.tribulationCount) {
      html += '<div class="cute-trib-intro"><b>⚡ ' + bi.tribulationCount + ' 重天劫，全過才升境</b><p>雷公已打卡，請道友帶好破境丹。每重獨立判定，整場難度沿用原突破計算。</p></div>';
      html += '<div class="cute-trib-waves">' + bi.tribulationWith(n).map(function (w) {
        return '<div class="cute-trib-row"><span>第 ' + w.i + ' 重 · ' + esc(w.name) + '</span><span>' + (w.chance * 100).toFixed(1) + '%</span></div>';
      }).join('') + '</div><p class="muted">以上為各重通過率；全部通過的機率為 ' + Math.round(rate * 100) + '%。失敗保底加在整場突破率，重新分配到各重。</p>';
    }
    if (bi.pills && bi.pills.length) {
      for (const pl of bi.pills) {
        const on = H.brkSelected.indexOf(pl.id) >= 0;
        const off = !on && n >= bi.pillMax;
        html += '<div class="xgh-pill' + (on ? ' xgh-on' : '') + (off ? ' xgh-off' : '') + '" data-pill="' + esc(pl.id) + '">' +
          '<span class="xgh-pi">' + esc(pl.icon || '💊') + '</span>' +
          '<span class="xgh-pn">' + esc(pl.name) + '（' + pl.grade + ' 品）</span>' +
          '<span class="xgh-pc">×' + pl.count + '</span></div>';
      }
    } else {
      html += '<p class="muted" style="text-align:center">沒有合用的破境丹。這次靠實力，還有一點點運氣。</p>';
    }
    modal({
      title: bi.tribulationCount ? '破境天劫 · ' + bi.tribulationCount + ' 重雷關' : '仙界升級面試',
      html: html,
      buttons: [
        {
          text: (bi.tribulationCount ? '開始渡劫（整場 ' : '逆天突破（') + Math.round(rate * 100) + '%）', cls: 'btn-primary', cb: function () {
            const r = call('cultivation', 'tryBreakthrough', [H.brkSelected.slice()]);
            if (!r) return;
            if (!r.ok) { toast(r.err || '突破受阻', 'red'); return; }
            if (r.tribulation) { playBreakTribulation(r); return false; }
            if (r.success) toast(r.msg || '突破成功！', 'gold'); // 全屏特效由 bus 'fx:breakthrough' 播放
            else { toast(r.msg || '突破失敗', 'red'); fx.shake(); }
          },
        },
        { text: '先回去練練', cls: 'btn-ghost' },
      ],
    });
  }
  // 結果由系統一次結算，逐重播放僅供呈現；略過動畫不會重抽或重複扣資源。
  function playBreakTribulation(result) {
    const trial = result.tribulation;
    let timer = null, done = false;
    function rows(revealed) {
      return '<div class="cute-trib-waves" aria-live="polite">' + trial.waves.map(function (w, index) {
        const seen = index < revealed, rolled = typeof w.pass === 'boolean';
        const status = !seen ? '雷雲排隊中…' : !rolled ? '未抵達' : w.pass ? '⚡ 已渡過' : '☁ 未渡過';
        return '<div class="cute-trib-row' + (seen ? !rolled ? ' is-unreached' : w.pass ? ' is-pass' : ' is-fail' : '') + '"><span>第 ' + w.i + ' 重 · ' + esc(w.name) + '<small>通過率 ' + (w.chance * 100).toFixed(1) + '%</small></span><b>' + status + '</b></div>';
      }).join('') + '</div>';
    }
    function finish() {
      if (done) return;
      done = true; clearTimeout(timer);
      if (!body || !body.isConnected) return;
      modal({ title: result.success ? '天劫全渡，破境成功！' : '雷公留了一道課後題',
        html: rows(trial.count) + '<p class="cute-trib-result" role="status">' + esc(result.msg) + '</p>',
        buttons: [{ text: result.success ? '穿新仙袍去！' : '回去蓄力，再戰雷公', cls: 'btn-primary' }] });
      if (result.success) fx.breakthrough(); else fx.shake();
      homeUpdate(); refreshTop();
    }
    modal({ title: '⚡ ' + trial.count + ' 重破境天劫 · ' + trial.targetText,
      html: '<p class="muted">整場成功率 ' + Math.round(trial.totalRate * 100) + '% · 天雷正在依序報到</p><div data-trib-playback>' + rows(0) + '</div>',
      buttons: [{ text: '略過動畫，查看結果', cb: function () { finish(); return false; } }] });
    const body = $('modal-root').querySelector('[data-trib-playback]');
    let revealed = 0;
    function step() {
      if (done || !body.isConnected) return;
      revealed++;
      body.innerHTML = rows(revealed);
      const last = trial.failedAt || trial.count;
      timer = setTimeout(revealed >= last ? finish : step, 550);
    }
    timer = setTimeout(step, 350);
  }
  function toggleBrkPill(id) {
    const bi = call('cultivation', 'getBreakInfo');
    if (!bi) return;
    const i = H.brkSelected.indexOf(id);
    if (i >= 0) H.brkSelected.splice(i, 1);
    else {
      if (H.brkSelected.length >= bi.pillMax) { toast('破境丹至多服 ' + bi.pillMax + ' 顆', 'info'); return; }
      H.brkSelected.push(id);
    }
    renderBreakModal();
  }

  // ---------- 靈根洗練 ----------
  function doWash() {
    const ri = call('cultivation', 'getRootInfo');
    if (!ri) return;
    if (!ri.canWash) { toast(ri.washErr || '資材不足', 'red'); return; }
    confirm('洗練靈根將耗 ' + ri.washCostText + '；靈根重鑄五行，變異難測（或有冰雷風暗光之機緣）。確定洗練？', function () {
      const r = call('cultivation', 'washRoot');
      if (!r) return;
      if (r.ok) {
        toast(r.msg || '洗練已畢', r.mutated ? 'gold' : 'info');
        if (r.mutated) fx.drop(3);
      } else toast(r.err || '洗練不成', 'red');
      H.sig.root = '';
      refreshRoot();
    });
  }

  // ---------- 經脈彈窗 ----------
  function meridianHtml() {
    const list = call('cultivation', 'getMeridians') || [];
    if (!list.length) return '<p class="muted">經脈圖譜尚未現世，且待後緣。</p>';
    const branches = [];
    const byBranch = {};
    for (const m of list) {
      const b = m.branch || '任脈';
      if (!byBranch[b]) { byBranch[b] = []; branches.push(b); }
      byBranch[b].push(m);
    }
    const litN = list.filter(function (m) { return m.lit; }).length;
    let html = '<p class="muted" style="text-align:center;margin:2px 0">已通 ' + litN + ' / ' + list.length + ' 穴 · 點穴耗修為，須循序漸進</p>';
    for (const b of branches) {
      html += '<div class="xgh-branch"><div class="xgh-branch-name">' + esc(b) + '</div><div class="xgh-acus">';
      for (const m of byBranch[b]) {
        const cls = m.lit ? 'xgh-lit' : (m.can ? 'xgh-can' : '');
        const title = m.name + ' · 耗修為 ' + m.costText + (m.eff ? '\n' + effText(m.eff) : '') + (m.err ? '\n' + m.err : '');
        html += '<span class="xgh-acu ' + cls + '"' + (m.can ? ' data-acu="' + esc(m.id) + '"' : '') + ' title="' + esc(title) + '">' +
          (m.lit ? '✦ ' : '') + esc(m.name) + '</span>';
      }
      html += '</div></div>';
    }
    return html;
  }
  function setModalBody(html) {
    const b = document.querySelector('#modal-root .xgh-modal-body');
    if (b) b.innerHTML = html;
  }
  function openMeridian() {
    modal({ title: '經脈穴位', html: meridianHtml(), buttons: [{ text: '收功', cls: 'btn-ghost' }] });
  }
  function doLightAcu(id) {
    const r = call('cultivation', 'lightMeridian', [id]);
    if (!r) return;
    toast(r.ok ? r.msg : (r.err || '點穴不成'), r.ok ? 'gold' : 'red');
    setModalBody(meridianHtml());
    homeUpdate();
  }

  // ---------- 一鍵操作 ----------
  function quickCollect() {
    const lines = [];
    for (const id of (XG.sysOrder || [])) {
      const m = sys(id);
      if (!m || typeof m.quickCollect !== 'function') continue;
      try {
        const r = m.quickCollect();
        if (r && r.msg && r.msg.length) lines.push.apply(lines, r.msg);
      } catch (e) { console.error('[home] ' + id + '.quickCollect 出錯', e); }
    }
    if (!lines.length) { toast('各處倉廩皆空，暫無進項可領', 'info'); return; }
    modal({
      title: '一鍵領取',
      html: '<ul>' + lines.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>',
      buttons: [{ text: '收好，都是我的！', cls: 'btn-primary' }],
    });
  }
  function quickCultivate() {
    const bag = (S().inv && S().inv.pill) || {};
    const TYPES = { cult: 1, atk: 1, def: 1, hp: 1, work: 1 };
    const recipes = (XG.data && XG.data.pills && XG.data.pills.recipes) || [];
    const map = {};
    for (const r of recipes) map[r.id] = r;
    const plan = [];
    for (const id in bag) {
      const base = String(id).replace(/_star$/, '');
      const r = map[base];
      if (!r || !r.eff || !TYPES[r.eff.type] || (bag[id] || 0) <= 0) continue;
      plan.push({ id: id, n: bag[id], eff: r.eff, star: /_star$/.test(id) });
    }
    if (!plan.length) { toast('囊中沒有修為丹或增益丹可服', 'info'); return; }
    if (!sys('alchemy') || typeof sys('alchemy').usePill !== 'function') { toast('丹道未開，無法服丹', 'red'); return; }
    let ate = 0, cultSum = 0, blocked = 0;
    for (const it of plan) {
      for (let i = 0; i < it.n; i++) {
        const r = call('alchemy', 'usePill', [it.id]);
        if (r && r.ok) {
          ate++;
          if (it.eff.type === 'cult' && !it.eff.dur) cultSum += it.eff.val * (it.star ? 1.5 : 1);
        } else { blocked += it.n - i; break; }
      }
    }
    if (ate > 0) {
      pop('連服 ' + ate + ' 枚丹藥，藥力通達百脈', 'gold');
      if (cultSum > 0) pop('+' + fmt(cultSum) + ' 修為', '');
    }
    let msg = ate > 0 ? ('服下 ' + ate + ' 枚丹藥') : '一枚也未服下';
    if (blocked > 0) msg += '，' + blocked + ' 枚因丹毒淤積受阻';
    if (ate > 0) msg += '（丹毒 ' + Math.round((S().player && S().player.toxicity) || 0) + '）';
    toast(msg, ate > 0 ? 'gold' : 'red');
    homeUpdate();
  }
  function quickDispatch() {
    const r = call('expedition', 'quickDispatch');
    if (!r) return;
    if (!r.ok) { toast((r.msg && r.msg[0]) || '此刻無可派遣', 'red'); return; }
    const lines = r.msg || [];
    modal({
      title: '一鍵派遣',
      html: '<ul>' + lines.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>',
      buttons: [{ text: '一路順風', cls: 'btn-primary' }],
    });
  }
  function quickSweep() {
    const r = call('dungeon', 'quickSweep');
    if (!r) return;
    if (!r.ok) { toast(r.err || '掃蕩不成', 'red'); return; }
    const lines = r.msg || [];
    if (r.gains && r.gains.cult) pop('+' + fmt(r.gains.cult) + ' 修為', '');
    modal({
      title: '掃蕩秘境',
      html: '<ul>' + lines.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>',
      buttons: [{ text: '收好，都是我的！', cls: 'btn-primary' }],
    });
  }
  function goRemind(tabId, isMkt) {
    if (isMkt) settings().mktSeen = Date.now();
    if (tabId && findTab(tabId)) { if (showTab(tabId)) return; }
    toast('此處尚未開闢，且待後緣', 'info');
  }

  // ---------- 主頁事件委託 ----------
  function onHomeClick(ev) {
    const t = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!t) return;
    const act = t.getAttribute('data-act');
    if (act === 'break') openBreak();
    else if (act === 'mode') {
      const r = call('cultivation', 'setMode', [t.getAttribute('data-mode')]);
      if (r) toast(r.ok ? r.msg : (r.err || '不可改修'), r.ok ? 'info' : 'red');
      H.sig.modes = '';
      refreshModes();
    } else if (act === 'qc') quickCollect();
    else if (act === 'dunwu-info') {
      // 頓悟機制說明（玩家常誤以為「頓悟沒生效」，點擊給出當前概率與狀態）
      const di = call('cultivation', 'getDunwuInfo');
      if (!di) { toast('頓悟之道尚未參透', 'info'); return; }
      const msg = di.active
        ? '頓悟降臨中！30 秒內修煉 ×' + di.mult + '，尚餘 ' + fmtTime(di.remain) + '，且看修為奔湧。'
        : '頓悟不可強求：靜坐修行時每秒約 ' + (di.chancePerSec * 100).toFixed(2) + '% 幾率降臨（約 ' + fmtTime(1 / di.chancePerSec) + ' 一遇），降臨時 30 秒修煉 ×' + di.mult + '。悟性丹可提升降臨幾率，離線閉關亦有夢中頓悟折算。';
      toast(msg, di.active ? 'gold' : 'info');
    }
    else if (act === 'qx') quickCultivate();
    else if (act === 'qd') quickDispatch();
    else if (act === 'qs') quickSweep();
    else if (act === 'wash') doWash();
    else if (act === 'meridian') openMeridian();
    else if (act === 'remind') goRemind(t.getAttribute('data-tab'), t.getAttribute('data-mkt'));
    else if (act === 'guide-claim') {
      const r = call('guide', 'claim', [t.getAttribute('data-id')]);
      if (r) toast(r.ok ? r.msg : (r.err || '領取失敗'), r.ok ? 'gold' : 'red');
      H.sig.guide = '';
      refreshGuide();
    }
    else if (act === 'adv-open') openAdventure();
  }

  // ---------- 主頁 tab 定義 ----------
  const homeDef = {
    id: 'home', name: '修煉', icon: '🧘', order: 0, main: true, sysId: null,
    mount: function (el) {
      H.el = el;
      H.sig = {};
      el.innerHTML =
        '<div class="cute-page-head"><div><h2>修行日常 <span style="font-size:17px">🌿</span></h2><p>不急著成仙，先把今天過得可愛一點。</p></div><span class="cute-page-tag">SLOW DAYS, LITTLE MAGIC</span></div>' +
        '<div class="xgh-reminds" id="xgh-reminds"></div>' +
        // ⓪ 修煉場景（scene.js 掛載點：盤坐小人+靈氣動畫+事件聯動）
        '<div id="scene-root" class="xgh-scene"></div>' +
        // ① 境界大卡
        '<div class="card cute-realm-card"><h2 class="card-title">今日修仙進度</h2>' +
        '<div class="row" style="justify-content:space-between"><b id="xgh-r-name" style="font-size:17px;color:var(--qing-d)"></b><span class="muted" id="xgh-r-mode"></span></div>' +
        '<div class="progress" style="margin:8px 0 4px"><div class="progress-fill" id="xgh-r-fill"></div><div class="progress-text" id="xgh-r-ptext"></div></div>' +
        '<div class="row"><span class="muted" id="xgh-r-rate"></span><span class="muted" id="xgh-r-dunwu"></span></div>' +
        '<div class="row" style="margin-top:8px"><button class="btn btn-primary" id="xgh-brk-btn" data-act="break">精進</button>' +
        '<span class="muted" id="xgh-brk-info"></span></div></div>' +
        // ② 修煉模式
        '<div class="card cute-mode-card"><h2 class="card-title">選個舒服的姿勢</h2>' +
        '<div class="xgh-modes" id="xgh-modes"></div>' +
        '<div class="muted" id="xgh-mode-tip" style="margin-top:6px"></div></div>' +
        // ③ 一鍵操作
        '<div class="card"><h2 class="card-title">懶人專用小幫手</h2>' +
        '<div class="xgh-quick">' +
        '<button class="btn" id="xgh-q-collect" data-act="qc">一鍵領取</button>' +
        '<button class="btn" id="xgh-q-cult" data-act="qx">一鍵修煉</button>' +
        '<button class="btn" id="xgh-q-dispatch" data-act="qd">一鍵派遣</button>' +
        '<button class="btn" id="xgh-q-sweep" data-act="qs">一鍵掃蕩</button>' +
        '</div></div>' +
        // ③.5 修仙待辦小紙條（新手目標卡，guide.js 驅動；系統缺失時整卡隱藏）
        '<div class="card" id="xgh-guide-card"><h2 class="card-title">修仙待辦小紙條</h2>' +
        '<div id="xgh-guide-body"></div>' +
        '<div class="progress" style="margin-top:6px"><div class="progress-fill" id="xgh-guide-fill"></div><div class="progress-text" id="xgh-guide-ptext"></div></div></div>' +
        // ④ 下一個小目標
        '<div class="card"><h2 class="card-title">下一個小目標</h2><div id="xgh-goals"></div></div>' +
        // ⑤ 靈根與經脈
        '<div class="card"><h2 class="card-title">我的仙人出廠設定</h2>' +
        '<div id="xgh-root"></div>' +
        '<div class="muted xgh-gold" id="xgh-root-tip"></div>' +
        '<div class="row" style="margin-top:8px">' +
        '<button class="btn" id="xgh-wash-btn" data-act="wash">洗練靈根</button>' +
        '<button class="btn btn-ghost" data-act="meridian">經脈穴位</button>' +
        '</div></div>';
      el.addEventListener('click', onHomeClick);
      homeUpdate();
    },
    update: function () { homeUpdate(); },
    unmount: function () {
      if (H.el) H.el.removeEventListener('click', onHomeClick);
      H.el = null;
      H.sig = {};
    },
  };

  // ============================ XG.ui 導出 + 主頁註冊 ============================
  XG.ui = {
    registerTab: registerTab,
    boot: boot,
    refreshTop: refreshTop,
    renderActive: renderActive,
    showTab: showTab,
    toast: toast,
    modal: modal,
    closeModal: closeModal,
    confirm: confirm,
    pop: pop,
    popMute: function (m) { pop._muted = !!m; }, // 批量操作期間靜音跳字（try/finally 成對調用）
    fx: fx,
    news: news,
  };
  registerTab(homeDef);

  // 破境丹選擇 / 經脈點穴：彈窗內交互的文檔級委託（modal-root 每次重建，掛 document 常駐）
  document.addEventListener('click', function (ev) {
    const pill = ev.target && ev.target.closest ? ev.target.closest('[data-pill]') : null;
    if (pill) { toggleBrkPill(pill.getAttribute('data-pill')); return; }
    const acu = ev.target && ev.target.closest ? ev.target.closest('[data-acu]') : null;
    if (acu) doLightAcu(acu.getAttribute('data-acu'));
  });
})();
