/* ui-tabs-b.js：洞府 / 歷練 / 秘境 / 鬥法 四個玩法 tab（契約 §12 UI 規範）
 * 依賴各 sys 文件頭註釋的「UI 對接面」同步函數：
 *   cave（洞府）/ expedition（歷練）/ dungeon（秘境）/ pvp（鬥法）。
 * 渲染約定：mount 搭骨架 + el 事件委託（data-act 分發）；update 每秒只刷動態分區；
 * 打開中的框架彈窗位於 el 之外，不受重繪影響；動畫/連挑進行中以忙碌標記跳過重繪。 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  /* ==================== 通用小工具（全部防禦性） ==================== */
  function sys(id) { return (XG.sys && XG.sys[id]) || null; }
  function toast(msg, type) { try { if (XG.ui && XG.ui.toast) XG.ui.toast(msg, type); } catch (e) { /* 忽略 */ } }
  function pop(t, cls) { try { if (XG.ui && XG.ui.pop) XG.ui.pop(t, cls); } catch (e) { /* 忽略 */ } }
  function closeModal() { try { if (XG.ui && XG.ui.closeModal) XG.ui.closeModal(); } catch (e) { /* 忽略 */ } }
  function esc(s) { return (XG.util && XG.util.esc) ? XG.util.esc(s) : String(s == null ? '' : s); }
  function fmt(n) { return (XG.util && XG.util.fmt) ? XG.util.fmt(n) : String(n); }
  function fmtI(n) { return (XG.util && XG.util.fmtInt) ? XG.util.fmtInt(n) : String(Math.floor(Number(n) || 0)); }
  function fmtT(sec) { return (XG.util && XG.util.fmtTime) ? XG.util.fmtTime(Math.max(0, sec)) : Math.floor(sec) + '秒'; }
  function pct(x, d) { return ((Number(x) || 0) * 100).toFixed(d == null ? 1 : d) + '%'; }
  function realmName(ri) { const rs = XG.cfg && XG.cfg.REALMS; return (rs && rs[ri]) ? rs[ri].name : '未知'; }
  function realmTxt(ri, layer) { return realmName(ri) + ' ' + layer + '層'; }
  function myPower() { try { const s = XG.stats && XG.stats.get && XG.stats.get(); return (s && s.power) || 0; } catch (e) { return 0; } }
  function isUnlocked(id) { try { return XG.cfg && XG.cfg.isUnlocked ? XG.cfg.isUnlocked(id) : true; } catch (e) { return true; } }
  function matOf(id) { return (XG.data && XG.data.mats && XG.data.mats[id]) || null; }
  function pillName(id) {
    const r = XG.data && XG.data.pills && XG.data.pills.recipes;
    if (r) for (let i = 0; i < r.length; i++) if (r[i].id === id) return r[i].name;
    return id;
  }
  function gfName(id) {
    const l = XG.data && XG.data.gongfa && XG.data.gongfa.list;
    if (l) for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i].name;
    return id;
  }
  function dateTxt(t) {
    const d = new Date(t);
    const p = (x) => (x < 10 ? '0' + x : '' + x);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  // {id:n} 或 {id,n} 兩種形態的鍵值彙總 → 文案行
  function pushKV(out, obj, nameFn, label) {
    if (!obj) return;
    if (obj.id !== undefined && obj.n !== undefined) { out.push((label || '') + nameFn(obj.id) + '×' + obj.n); return; }
    for (const k in obj) out.push((label || '') + nameFn(k) + '×' + obj[k]);
  }
  // 收益對象 → 文案數組（兼容 cave/expedition/dungeon/pvp 各口徑）
  function gainLines(g) {
    const out = [];
    if (!g) return out;
    if (g.lingShi) out.push('靈石 ' + fmtI(g.lingShi));
    if (g.lingYu) out.push('靈玉 ' + fmtI(g.lingYu));
    if (g.cult) out.push('修為 ' + fmtI(g.cult));
    if (g.exp) out.push('靈寵經驗 ' + fmtI(g.exp));
    pushKV(out, g.mat, (k) => { const m = matOf(k); return m ? m.name : k; }, '');
    pushKV(out, g.pill, pillName, '');
    pushKV(out, g.frag, gfName, '殘篇·');
    if (g.egg) out.push('靈寵蛋×' + g.egg);
    if (g.equip && g.equip.name) out.push('裝備·' + g.equip.name);
    if (g.recipe) out.push('新丹方' + (typeof g.recipe === 'string' ? '·' + pillName(g.recipe) : ''));
    return out;
  }
  function weekLeftDays() { const dow = new Date().getDay(); return dow === 0 ? 0 : 7 - dow; }
  // 打開框架彈窗並掛事件委託（onClick(mact, dataset, ev)）
  function openModal(title, html, onClick) {
    if (!(XG.ui && XG.ui.modal)) { toast('界面尚未就緒，請稍候'); return false; }
    try {
      XG.ui.modal({
        title: title,
        html: html,
        buttons: [{ text: '關閉', cb: closeModal }],
      });
      const m = document.querySelector('.modal');
      if (m && onClick) {
        m.onclick = function (ev) {
          const t = ev.target.closest('[data-mact]');
          if (t) onClick(t.getAttribute('data-mact'), t.dataset, ev);
        };
      }
      return true;
    } catch (e) { return false; }
  }

  /* ==================== 注入樣式（前綴 tbb- 防衝突） ==================== */
  function injectStyle() {
    if (document.getElementById('tbb-style')) return;
    const st = document.createElement('style');
    st.id = 'tbb-style';
    st.textContent = `
/* ---- ui-tabs-b 專用（洞府/歷練/秘境/鬥法） ---- */
.tbb-wx { display:inline-block; font-size:10px; line-height:14px; padding:0 4px; border-radius:4px; color:#f9f5ea; }
.tbb-wx-jin { background:#b8912f; } .tbb-wx-mu { background:#4d7c43; } .tbb-wx-shui { background:#3e6f8e; }
.tbb-wx-huo { background:#a5452f; } .tbb-wx-tu { background:#8a6d3b; }
.tbb-fsgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.tbb-cell { position:relative; aspect-ratio:1/1; border:1px dashed var(--line); border-radius:8px;
  background:rgba(43,43,43,.03); display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:1px; cursor:pointer; user-select:none; overflow:hidden; }
.tbb-cell-emp { color:var(--ink-l); font-size:12px; }
.tbb-cell-emp .tbb-cell-plus { font-size:18px; opacity:.5; }
.tbb-cell-center::after { content:'中宮'; position:absolute; bottom:2px; right:4px; font-size:9px; color:var(--gold-d); opacity:.8; }
.tbb-cell-pair { border:1.5px solid var(--gold); box-shadow:0 0 6px rgba(201,160,99,.45) inset; }
.tbb-cell-ico { font-size:22px; line-height:1.2; }
.tbb-cell-name { font-size:11px; color:var(--ink); }
.tbb-fs-badge { position:absolute; top:2px; right:2px; background:var(--gold); color:#fff; font-size:9px;
  padding:0 4px; border-radius:7px; line-height:14px; }
.tbb-wx-dot { position:absolute; top:3px; left:3px; }
.tbb-pairs-tag { display:inline-block; border:1px solid var(--gold); color:var(--gold-d); border-radius:10px;
  font-size:11px; padding:0 8px; line-height:18px; }
.tbb-bld { border:1px solid var(--line); border-radius:8px; padding:8px 10px; background:rgba(255,252,244,.5); }
.tbb-bld-head { display:flex; align-items:center; gap:6px; }
.tbb-bld-ico { font-size:20px; width:30px; height:30px; border-radius:6px; border:1px solid var(--line);
  display:flex; align-items:center; justify-content:center; background:var(--paper-d); flex:none; }
.tbb-cost-ok { color:var(--qing-d); } .tbb-cost-no { color:var(--danger); }
.tbb-mini { font-size:12px; padding:3px 10px; }
.tbb-rowline { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.tbb-sp { flex:1; min-width:0; }
.tbb-map-lock { opacity:.55; filter:grayscale(.6); }
.tbb-map-hidden { border:1.5px solid var(--gold); }
.tbb-tag-yin { background:var(--gold); color:#fff; font-size:9px; border-radius:7px; padding:0 5px; line-height:14px; }
.tbb-pets { display:flex; gap:6px; flex-wrap:wrap; }
.tbb-pet { display:flex; flex-direction:column; align-items:center; width:52px; }
.tbb-pet-ico { width:36px; height:36px; border-radius:50%; border:1px solid var(--gold); background:var(--paper-d);
  display:flex; align-items:center; justify-content:center; font-size:18px; }
.tbb-pet-name { font-size:10px; color:var(--ink-l); max-width:52px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tbb-log { max-height:220px; overflow-y:auto; font-size:12px; }
.tbb-log-item { padding:5px 2px; border-bottom:1px dashed var(--line); }
.tbb-pick { border:1px solid var(--line); border-radius:8px; padding:6px; cursor:pointer; text-align:center; background:rgba(255,252,244,.5); }
.tbb-pick-on { border:1.5px solid var(--qing); background:rgba(58,125,107,.12); }
.tbb-subbar { display:flex; gap:6px; margin-bottom:10px; }
.tbb-sub { flex:1; text-align:center; padding:7px 0; border:1px solid var(--line); border-radius:6px;
  color:var(--ink-l); cursor:pointer; background:rgba(255,252,244,.4); }
.tbb-sub-on { border-color:var(--qing-d); color:var(--qing-d); background:rgba(58,125,107,.12); font-weight:bold; }
.tbb-affix { display:inline-block; border:1px solid var(--gold); border-radius:6px; padding:2px 7px; margin:2px 4px 2px 0;
  font-size:12px; color:var(--gold-d); background:rgba(201,160,99,.08); }
.tbb-boss-warn { border:1.5px solid var(--gold); border-radius:8px; padding:8px 10px; margin:8px 0;
  background:rgba(201,160,99,.12); color:var(--gold-d); }
.tbb-hunt-count { font-size:44px; color:var(--gold-d); text-align:center; line-height:1.3;
  text-shadow:0 1px 3px rgba(255,255,255,.7); font-variant-numeric:tabular-nums; }
.tbb-guard { border:1px solid var(--line); border-radius:8px; padding:7px 10px; margin-bottom:6px; }
.tbb-guard-done { border-color:var(--gold); background:rgba(201,160,99,.10); }
.tbb-guard-cur { border:1.5px solid var(--qing); background:rgba(58,125,107,.08); }
.tbb-guard-future { opacity:.55; }
.tbb-round { display:inline-flex; width:40px; height:40px; border-radius:50%; border:1.5px solid var(--line);
  align-items:center; justify-content:center; font-size:18px; margin:0 6px; background:var(--paper-d); }
.tbb-round-win { border-color:var(--qing-d); color:var(--qing-d); animation:tbbReveal .45s ease; }
.tbb-round-lose { border-color:var(--danger); color:var(--danger); animation:tbbReveal .45s ease; }
.tbb-round-wait { color:var(--ink-l); opacity:.4; }
@keyframes tbbReveal { 0% { transform:scale(.3); opacity:0; } 60% { transform:scale(1.2); } 100% { transform:scale(1); opacity:1; } }
.tbb-pts-jump { display:inline-block; font-weight:bold; animation:tbbPts .8s ease; }
@keyframes tbbPts { 0% { transform:translateY(8px) scale(.6); opacity:0; } 40% { transform:translateY(-4px) scale(1.3); opacity:1; }
  100% { transform:translateY(0) scale(1); } }
.tbb-ring { display:flex; align-items:center; justify-content:center; gap:4px; flex-wrap:wrap; font-size:13px; }
.tbb-ring-node { border:1px solid var(--line); border-radius:14px; padding:2px 9px; cursor:pointer; background:rgba(255,252,244,.5); }
.tbb-ring-on { border:1.5px solid var(--gold); color:var(--gold-d); font-weight:bold; background:rgba(201,160,99,.12); }
.tbb-ring-arrow { color:var(--gold-d); }
.tbb-tier { font-size:26px; }
.tbb-opp { border:1.5px solid var(--gold); border-radius:8px; padding:10px; background:rgba(201,160,99,.07); }
.tbb-win { color:var(--qing-d); font-weight:bold; } .tbb-lose { color:var(--danger); font-weight:bold; }
.tbb-hist-round { font-size:10px; letter-spacing:1px; }
`;
    document.head.appendChild(st);
  }

  // tab 註冊（防禦性，兼容 ui-core 後加載）
  const reg = (def) => {
    if (window.XG && XG.ui && XG.ui.registerTab) XG.ui.registerTab(def);
    else { XG._pendingTabs = XG._pendingTabs || []; XG._pendingTabs.push(def); }
  };
  function lockHtml(cond) {
    return '<div class="tab-page"><div class="card"><h3 class="card-title">尚未開啓</h3>'
      + '<div class="card-sub">' + esc(cond) + '</div></div></div>';
  }

  /* ================================================================
   * Tab 1：洞府（sysId 'cave'，主欄 order 2）
   * ================================================================ */
  const cav = { el: null, handler: null };

  function caveZones() {
    const c = sys('cave');
    if (!c || !c.getInfo) return null;
    try { return c.getInfo(); } catch (e) { return null; }
  }

  function renderCaveGrid(info) {
    const z = cav.el && cav.el.querySelector('#tbb-cave-grid');
    if (!z || !info) return;
    const L = info.layout || { cells: [], pairs: [], totalPairs: 0 };
    const pairCells = {};
    (L.pairs || []).forEach((p) => { pairCells[p.aCell] = 1; pairCells[p.bCell] = 1; });
    let h = '<div class="tbb-rowline" style="margin-bottom:8px">'
      + '<span class="card-sub">風水相生</span>'
      + '<span class="tbb-pairs-tag">相生 ' + (L.totalPairs || 0) + ' 對</span>'
      + '<span class="tbb-sp"></span>'
      + '<button class="btn btn-ghost btn-mini tbb-mini" data-act="cave-report">風水報告</button>'
      + '<button class="btn btn-mini tbb-mini" data-act="cave-auto">一鍵佈陣</button>'
      + '</div><div class="tbb-fsgrid">';
    (L.cells || []).forEach((cell) => {
      const i = cell.cell;
      const cls = ['tbb-cell'];
      if (i === 4) cls.push('tbb-cell-center');
      if (!cell.id) {
        h += '<div class="' + cls.join(' ') + ' tbb-cell-emp" data-act="cave-cell" data-cell="' + i + '">'
          + '<span class="tbb-cell-plus">＋</span><span>空置</span></div>';
      } else {
        if (pairCells[i]) cls.push('tbb-cell-pair');
        h += '<div class="' + cls.join(' ') + '" data-act="cave-cell" data-cell="' + i + '">'
          + '<span class="tbb-wx-dot tbb-wx tbb-wx-' + esc(cell.wx) + '">' + esc(cell.wxName) + '</span>'
          + '<span class="tbb-cell-ico">' + esc(cell.icon) + '</span>'
          + '<span class="tbb-cell-name">' + esc(cell.name) + '</span>'
          + ((info.layout.bonus && info.layout.bonus[cell.id])
              ? '<span class="tbb-fs-badge">+' + info.layout.bonus[cell.id] + '%</span>' : '')
          + '</div>';
      }
    });
    h += '</div><div class="muted" style="margin-top:6px">點空格安放建築，相鄰五行相生每對 +5% 建築效果（金描邊即相生之局）。</div>';
    z.innerHTML = h;
  }

  function renderCavePool(info) {
    const z = cav.el && cav.el.querySelector('#tbb-cave-pool');
    if (!z || !info) return;
    const p = info.pool || {};
    const frac = p.whole > 0 ? 0 : Math.max(0, Math.min(1, (p.acc || 0) % 1));
    const built = p.ratePerHour != null && p.etaSec !== null;
    z.innerHTML = '<h3 class="card-title">靈田產出池</h3>'
      + (built
        ? '<div class="tbb-rowline"><span>暫存靈草 <b style="color:var(--gold-d)">' + (p.whole || 0) + '</b> 株</span>'
          + '<span class="muted">產量 ' + (p.ratePerHour || 0).toFixed(1) + ' 株/時</span><span class="tbb-sp"></span>'
          + '<button class="btn btn-primary tbb-mini" data-act="cave-collect"' + (p.whole > 0 ? '' : ' disabled') + '>一鍵領取</button></div>'
          + '<div class="progress" style="margin-top:6px"><div class="progress-fill" style="width:' + (frac * 100).toFixed(1) + '%"></div>'
          + '<div class="progress-text">' + (p.whole > 0 ? '又可收穫 1 株' : '下一株約需 ' + fmtT(p.etaSec || 0)) + '</div></div>'
        : '<div class="card-sub">尚未開闢靈田，建成「靈田」後此處自產靈草。</div>');
  }

  function renderCaveBlds(info) {
    const z = cav.el && cav.el.querySelector('#tbb-cave-blds');
    if (!z || !info) return;
    let h = '';
    (info.buildings || []).forEach((b) => {
      h += '<div class="tbb-bld">'
        + '<div class="tbb-bld-head"><span class="tbb-bld-ico">' + esc(b.icon) + '</span>'
        + '<b>' + esc(b.name) + '</b><span class="tbb-wx tbb-wx-' + esc(b.wx) + '">' + esc(b.wxName) + '</span>'
        + '<span class="tbb-sp"></span><span class="muted">Lv.' + b.lv + ' / ' + b.cap + '</span></div>'
        + '<div class="card-sub" style="margin:4px 0">' + esc(b.effText || '')
        + (b.fsPct ? ' <span style="color:var(--gold-d)">（風水 +' + b.fsPct + '%）</span>' : '') + '</div>'
        + '<div class="tbb-rowline">'
        + (b.nextCost
            ? '<span class="' + (b.canUp ? 'tbb-cost-ok' : 'tbb-cost-no') + '" style="font-size:12px">消耗：' + esc(b.costText) + '</span>'
            : '<span style="color:var(--gold-d);font-size:12px">已臻滿級</span>')
        + '<span class="tbb-sp"></span>'
        + (b.nextCost ? '<button class="btn tbb-mini" data-act="cave-up" data-id="' + esc(b.id) + '"' + (b.canUp ? '' : ' disabled') + '>升級</button>' : '')
        + '</div>'
        + ((!b.canUp && b.upTip) ? '<div class="muted" style="color:var(--danger)">' + esc(b.upTip) + '</div>' : '')
        + (b.id !== 'lm' ? '<div class="muted" style="font-size:11px">上限隨靈脈而漲（靈脈×2，頂 40 級）</div>' : '')
        + '</div>';
    });
    z.innerHTML = h;
  }

  function renderCaveAll() {
    const info = caveZones();
    if (!info) return;
    renderCaveGrid(info);
    renderCavePool(info);
    renderCaveBlds(info);
  }

  // 空格 → 可擺放建築列表；佔用格 → 建築詳情（可取下）
  function caveCellModal(cellIdx) {
    const c = sys('cave');
    const info = caveZones();
    if (!c || !info) return;
    const cell = (info.layout.cells || [])[cellIdx];
    if (!cell) return;
    if (!cell.id) {
      const built = (info.buildings || []).filter((b) => b.built);
      if (!built.length) { toast('尚無已建成的建築可安放'); return; }
      let h = '<div class="grid">';
      built.forEach((b) => {
        h += '<div class="tbb-pick tbb-rowline" data-mact="place" data-id="' + esc(b.id) + '">'
          + '<span class="tbb-bld-ico">' + esc(b.icon) + '</span><b>' + esc(b.name) + '</b>'
          + '<span class="tbb-wx tbb-wx-' + esc(b.wx) + '">' + esc(b.wxName) + '</span>'
          + '<span class="muted">Lv.' + b.lv + '</span><span class="tbb-sp"></span>'
          + '<span class="muted">' + (b.cell >= 0 ? '挪至此處' : '安放此處') + '</span></div>';
      });
      h += '</div>';
      openModal('安放建築（格位 ' + (cellIdx + 1) + '）', h, (act, ds) => {
        if (act !== 'place') return;
        try {
          const r = c.place(ds.id, cellIdx);
          toast((r && r.msg) || '已安放');
        } catch (e) { toast('安放失敗'); }
        closeModal();
        renderCaveAll();
      });
    } else {
      const b = (info.buildings || []).filter((x) => x.id === cell.id)[0];
      const h = '<div class="tbb-rowline"><span class="tbb-bld-ico">' + esc(cell.icon) + '</span>'
        + '<b>' + esc(cell.name) + '</b><span class="tbb-wx tbb-wx-' + esc(cell.wx) + '">' + esc(cell.wxName) + '</span></div>'
        + '<div class="card-sub" style="margin:6px 0">' + esc(b ? b.effText : '')
        + (b && b.fsPct ? '（風水 +' + b.fsPct + '%）' : '') + '</div>'
        + '<div style="text-align:center;margin-top:8px"><button class="btn btn-ghost tbb-mini" data-mact="unplace" data-id="' + esc(cell.id) + '">取下此建築</button></div>';
      openModal('格位 ' + (cellIdx + 1) + ' · ' + cell.name, h, (act, ds) => {
        if (act !== 'unplace') return;
        try {
          const r = c.unplace(ds.id);
          toast((r && r.msg) || '已取下');
        } catch (e) { toast('操作失敗'); }
        closeModal();
        renderCaveAll();
      });
    }
  }

  function caveReportModal() {
    const c = sys('cave');
    if (!c || !c.fengshuiReport) return;
    let r;
    try { r = c.fengshuiReport(); } catch (e) { return; }
    let h = '<div class="card-sub" style="margin-bottom:6px">相生 ' + (r.totalPairs || 0) + ' 對，每對使受生建築效果 +5%。</div>';
    if (!r.pairs || !r.pairs.length) {
      h += '<div class="muted">盤中尚無相生之局，可點「一鍵佈陣」或手動相鄰安放相生五行。</div>';
    } else {
      r.pairs.forEach((p) => {
        h += '<div class="tbb-log-item">'
          + '<span class="tbb-wx tbb-wx-' + esc(p.aWx) + '">' + esc(realmWx(p.aWx)) + '</span> ' + esc(p.aName)
          + ' <span style="color:var(--gold-d)">生</span> '
          + '<span class="tbb-wx tbb-wx-' + esc(p.bWx) + '">' + esc(realmWx(p.bWx)) + '</span> ' + esc(p.bName)
          + ' <span class="tbb-sp"></span><span style="color:var(--gold-d)">+' + p.pct + '%</span></div>';
      });
      h += '<div class="card-sub" style="margin-top:8px">各建築風水總加成：';
      for (const id in (r.bonus || {})) {
        const b = (caveZones().buildings || []).filter((x) => x.id === id)[0];
        h += '<br>' + esc(b ? b.name : id) + ' +' + r.bonus[id] + '%';
      }
      h += '</div>';
    }
    openModal('風水報告', h, null);
  }
  function realmWx(wx) { return { jin: '金', mu: '木', shui: '水', huo: '火', tu: '土' }[wx] || wx; }

  const caveTab = {
    id: 'cave', name: '洞府', icon: '🏯', order: 2, main: true, sysId: 'cave',
    mount(el) {
      injectStyle();
      cav.el = el;
      el.innerHTML = '<div class="tab-page"><h2>洞府</h2>'
        + '<div class="card" id="tbb-cave-grid"></div>'
        + '<div class="card" id="tbb-cave-pool"></div>'
        + '<div class="card"><h3 class="card-title">洞府建築</h3><div class="grid grid-2" id="tbb-cave-blds"></div></div>'
        + '</div>';
      cav.handler = function (ev) {
        const t = ev.target.closest('[data-act]');
        if (!t) return;
        const act = t.getAttribute('data-act');
        const c = sys('cave');
        if (!c) return;
        try {
          if (act === 'cave-cell') caveCellModal(Number(t.dataset.cell));
          else if (act === 'cave-up') { const r = c.upgrade(t.dataset.id); toast((r && r.msg) || ''); renderCaveAll(); }
          else if (act === 'cave-auto') { const r = c.autoLayout(); toast((r && r.msg) || '佈陣已畢'); renderCaveAll(); }
          else if (act === 'cave-report') caveReportModal();
          else if (act === 'cave-collect') {
            const r = c.quickCollect();
            if (r && r.msg && r.msg.length) toast(r.msg.join('；'));
            else toast(r && r.empty ? '靈田暫無可收之草' : '顆粒無收');
            if (r && !r.empty) pop('靈草入庫', 'pop-good');
            renderCaveAll();
          }
        } catch (e) { toast('操作失敗，請重試'); }
      };
      el.addEventListener('click', cav.handler);
      renderCaveAll();
    },
    update() {
      if (!cav.el) return;
      if (!isUnlocked('cave')) { return; }
      renderCaveAll();
    },
    unmount() {
      if (cav.el && cav.handler) cav.el.removeEventListener('click', cav.handler);
      cav.el = null; cav.handler = null;
    },
  };

  /* ================================================================
   * Tab 2：歷練（sysId 'expedition'，主欄 order 3）
   * ================================================================ */
  const exp = { el: null, handler: null, sel: null };

  function expSys() { const s = sys('expedition'); return (s && s.getMaps) ? s : null; }

  function renderExpSlots() {
    const z = exp.el && exp.el.querySelector('#tbb-exp-slots');
    const s = expSys();
    if (!z || !s) return;
    let info;
    try { info = s.getSlots(); } catch (e) { return; }
    let h = '<div class="tbb-rowline"><span>隊伍欄位 <b>' + info.used + ' / ' + info.max + '</b></span><span class="tbb-sp"></span>'
      + '<button class="btn btn-primary tbb-mini" data-act="exp-quick">一鍵派遣</button></div><div class="grid grid-3" style="margin-top:6px">';
    (info.list || []).forEach((sl) => {
      h += '<div class="tbb-bld" style="text-align:center">';
      if (sl.unlocked) {
        h += '<b>第 ' + (sl.idx + 1) + ' 隊</b><div class="muted">已開啓</div>';
      } else {
        h += '<b>第 ' + (sl.idx + 1) + ' 隊</b><div class="muted">未開啓</div>'
          + '<div class="muted" style="font-size:11px">條件：' + esc(sl.realmText || '') + '<br>或 靈玉 ' + (sl.lingYu || 0) + '</div>'
          + '<button class="btn tbb-mini" data-act="exp-slot" data-idx="' + sl.idx + '">靈玉開啓</button>';
      }
      h += '</div>';
    });
    h += '</div>';
    let auto = null;
    try { auto = s.getAuto ? s.getAuto() : null; } catch (e) { auto = null; }
    if (auto) {
      h += '<div class="tbb-rowline" style="margin-top:6px"><span style="color:var(--qing-d)">🔁 連續歷練中：'
        + esc(auto.mapName) + '（' + esc(auto.durLabel) + '），歸來自動再派</span><span class="tbb-sp"></span>'
        + '<button class="btn tbb-mini" data-act="exp-auto-stop">停止</button></div>';
    }
    z.innerHTML = h;
  }

  function renderExpActive() {
    const z = exp.el && exp.el.querySelector('#tbb-exp-active');
    const s = expSys();
    if (!z || !s) return;
    let list;
    try { list = s.getActive(); } catch (e) { return; }
    if (!list || !list.length) { z.innerHTML = '<div class="card-sub">暫無隊伍在外歷練。</div>'; return; }
    let h = '';
    list.forEach((t) => {
      h += '<div class="tbb-bld" style="margin-bottom:6px">'
        + '<div class="tbb-rowline"><span style="font-size:18px">' + esc(t.icon || '🗺️') + '</span><b>' + esc(t.mapName) + '</b>'
        + '<span class="muted">' + esc((s.DUR_OPTS[t.durIdx] || {}).label || fmtT(t.dur)) + '</span><span class="tbb-sp"></span>'
        + '<span style="color:var(--qing-d)">餘 ' + fmtT(t.remainSec) + '</span></div>'
        + '<div class="tbb-pets" style="margin:4px 0">';
      (t.pets || []).forEach((p) => {
        h += '<span class="tbb-pet"><span class="tbb-pet-ico">' + esc(p.icon || '🐾') + '</span>'
          + '<span class="tbb-pet-name">' + esc(p.name) + '</span></span>';
      });
      h += '</div><div class="progress"><div class="progress-fill" style="width:' + ((t.progress || 0) * 100).toFixed(1) + '%"></div></div>'
        + '<div class="muted" style="font-size:11px">跋涉途中，無法召回，靜候佳音。</div></div>';
    });
    z.innerHTML = h;
  }

  function renderExpMaps() {
    const z = exp.el && exp.el.querySelector('#tbb-exp-maps');
    const s = expSys();
    if (!z || !s) return;
    let maps, slots;
    try { maps = s.getMaps(); slots = s.getSlots(); } catch (e) { return; }
    const full = slots && slots.used >= slots.max;
    let h = '';
    (maps || []).forEach((m) => {
      const sp = matOf(m.sp);
      const cls = ['tbb-bld'];
      if (!m.unlocked) cls.push('tbb-map-lock');
      if (m.hidden) cls.push('tbb-map-hidden');
      h += '<div class="' + cls.join(' ') + '">'
        + '<div class="tbb-bld-head"><span class="tbb-bld-ico">' + esc(m.icon || '⛰️') + '</span><b>' + esc(m.name) + '</b>'
        + (m.hidden ? '<span class="tbb-tag-yin">隱</span>' : '')
        + '<span class="tbb-sp"></span><span class="muted">已遣 ' + (m.dispatchCount || 0) + ' 次</span></div>'
        + '<div class="card-sub" style="margin:3px 0">建議戰力 <b style="color:var(--gold-d)">' + fmt(m.power) + '</b>'
        + (sp ? '　特產：' + esc(sp.icon || '') + ' ' + esc(sp.name) : '') + '</div>'
        + (m.unlocked
            ? '<div class="tbb-rowline"><span class="muted">' + (full ? '隊伍皆在外，候其歸來' : '') + '</span><span class="tbb-sp"></span>'
              + '<button class="btn tbb-mini" data-act="exp-open" data-id="' + esc(m.id) + '"' + (full ? ' disabled' : '') + '>派遣</button></div>'
            : '<div class="muted">🔒 ' + esc(m.lockedReason || m.condText || '機緣未到') + '</div>')
        + '</div>';
    });
    z.innerHTML = h || '<div class="card-sub">世界數據未就緒。</div>';
  }

  function renderExpLog() {
    const z = exp.el && exp.el.querySelector('#tbb-exp-log');
    const s = expSys();
    if (!z || !s) return;
    let log;
    try { log = s.getLog(); } catch (e) { return; }
    if (!log || !log.length) { z.innerHTML = '<div class="card-sub">尚無歷練收穫。</div>'; return; }
    let h = '';
    log.slice(0, 20).forEach((r) => {
      const lines = gainLines(r);
      h += '<div class="tbb-log-item"><span class="muted">' + dateTxt(r.t) + '</span> '
        + '<b>' + esc(r.mapName || '') + '</b>'
        + (r.hongyun ? ' <span style="color:var(--gold-d)">鴻運當頭</span>' : '')
        + (r.factor != null && r.factor < 1 ? ' <span class="muted">（力有不逮 ×' + r.factor.toFixed(2) + '）</span>' : '')
        + '<br><span style="color:var(--qing-d)">' + esc(lines.join('、') || '空手而歸') + '</span></div>';
    });
    z.innerHTML = h;
  }

  function renderExpAll() {
    renderExpSlots();
    renderExpActive();
    renderExpMaps();
    renderExpLog();
  }

  // 派遣彈窗：選 1~3 寵 + 時長檔 + 預計收益係數
  function renderDispatchBody() {
    const s = expSys();
    const body = document.querySelector('#tbb-disp-body');
    if (!s || !body || !exp.sel) return;
    const m = s.getMap(exp.sel.mapId);
    const idle = s.getIdlePets ? s.getIdlePets() : [];
    const uids = Object.keys(exp.sel.pets).filter((k) => exp.sel.pets[k]);
    let est = null;
    try { est = s.estimateFactor(exp.sel.mapId, uids); } catch (e) { est = null; }
    let h = '<div class="card-sub" style="margin-bottom:6px">'
      + esc(m ? (m.icon + ' ' + m.name) : '') + ' · 建議戰力 ' + fmt(m ? m.power : 0) + '</div>'
      + '<div class="muted" style="margin-bottom:4px">擇 1~3 只靈寵隨行（已選 ' + uids.length + '）；不遣靈寵則獨自歷練，收益以自身戰力半數折算</div>'
      + '<div class="grid grid-3">';
    if (!idle.length) h += '<div class="muted">暫無空閒靈寵——可直接啓程獨自歷練，或先往靈寵頁孵育、解派。</div>';
    (idle || []).forEach((p) => {
      const on = !!exp.sel.pets[p.uid];
      h += '<div class="tbb-pick' + (on ? ' tbb-pick-on' : '') + '" data-mact="pet" data-uid="' + esc(p.uid) + '">'
        + '<div style="font-size:20px">' + esc(p.icon || '🐾') + '</div>'
        + '<div style="font-size:12px">' + esc(p.name) + '</div>'
        + '<div class="muted" style="font-size:10px">Lv.' + p.lv + ' · 戰力 ' + fmt(p.power) + '</div></div>';
    });
    h += '</div><div class="muted" style="margin:8px 0 4px">歷練時長</div><div class="tbb-rowline">';
    (s.DUR_OPTS || []).forEach((d, i) => {
      h += '<button class="btn tbb-mini' + (exp.sel.durIdx === i ? ' btn-primary' : '') + '" data-mact="dur" data-i="' + i + '">'
        + esc(d.label) + '（×' + d.mul + '）</button>';
    });
    h += '</div>';
    h += '<div class="tbb-rowline" style="margin-top:8px"><span class="muted">連續歷練：歸來後按同配置自動再派</span><span class="tbb-sp"></span>'
      + '<button class="btn tbb-mini' + (exp.sel.auto ? ' btn-primary' : '') + '" data-mact="auto">'
      + (exp.sel.auto ? '🔁 已開啓' : '已關閉') + '</button></div>';
    if (est) {
      h += '<div class="card-sub" style="margin-top:8px">隊伍戰力 ' + fmt(est.teamPower) + ' / 需求 ' + fmt(est.need)
        + ' · 預計收益係數 <b style="color:' + (est.factor >= 1 ? 'var(--qing-d)' : 'var(--danger)') + '">' + pct(est.factor) + '</b></div>';
    }
    h += '<div style="text-align:center;margin-top:10px">'
      + '<button class="btn btn-primary" data-mact="go">' + (uids.length ? '啓程' : '獨自啓程') + '</button></div>';
    body.innerHTML = h;
  }

  function openDispatch(mapId) {
    const s = expSys();
    if (!s) return;
    exp.sel = { mapId: mapId, pets: {}, durIdx: 1, auto: false };
    if (!openModal('派遣歷練', '<div id="tbb-disp-body"></div>', (act, ds) => {
      if (!exp.sel) return;
      if (act === 'pet') {
        const uid = ds.uid;
        if (exp.sel.pets[uid]) delete exp.sel.pets[uid];
        else {
          if (Object.keys(exp.sel.pets).length >= 3) { toast('一隊至多三隻靈寵'); return; }
          exp.sel.pets[uid] = true;
        }
        renderDispatchBody();
      } else if (act === 'dur') {
        exp.sel.durIdx = Number(ds.i) || 0;
        renderDispatchBody();
      } else if (act === 'auto') {
        exp.sel.auto = !exp.sel.auto;
        renderDispatchBody();
      } else if (act === 'go') {
        const uids = Object.keys(exp.sel.pets).filter((k) => exp.sel.pets[k]);
        try {
          const r = s.dispatch(exp.sel.mapId, uids, exp.sel.durIdx);
          toast((r && r.msg) || (r && r.ok ? '隊伍已啓程' : '派遣失敗'));
          if (r && r.ok) {
            if (exp.sel.auto && s.setAuto) s.setAuto({ mapId: exp.sel.mapId, petUids: uids, durIdx: exp.sel.durIdx });
            closeModal(); exp.sel = null; renderExpAll();
          }
        } catch (e) { toast('派遣失敗'); }
      }
    })) { exp.sel = null; return; }
    renderDispatchBody();
  }

  const expeditionTab = {
    id: 'expedition', name: '歷練', icon: '🗺️', order: 3, main: true, sysId: 'expedition',
    mount(el) {
      injectStyle();
      exp.el = el;
      el.innerHTML = '<div class="tab-page"><h2>歷練</h2>'
        + '<div class="card" id="tbb-exp-slots"></div>'
        + '<div class="card"><h3 class="card-title">進行中的隊伍</h3><div id="tbb-exp-active"></div></div>'
        + '<div class="card"><h3 class="card-title">歷練地圖</h3><div class="grid" id="tbb-exp-maps"></div></div>'
        + '<div class="card"><h3 class="card-title">派遣日誌</h3><div class="tbb-log" id="tbb-exp-log"></div></div>'
        + '</div>';
      exp.handler = function (ev) {
        const t = ev.target.closest('[data-act]');
        if (!t) return;
        const act = t.getAttribute('data-act');
        const s = expSys();
        if (!s) return;
        try {
          if (act === 'exp-open') openDispatch(t.dataset.id);
          else if (act === 'exp-quick') {
            const r = s.quickDispatch();
            toast(r && r.msg && r.msg.length ? r.msg.join('；') : '無隊可遣（欄位已滿或靈寵不足）');
            renderExpAll();
          } else if (act === 'exp-slot') {
            const r = s.unlockSlot(Number(t.dataset.idx));
            toast((r && r.msg) || '');
            renderExpAll();
          } else if (act === 'exp-auto-stop') {
            if (s.setAuto) { const r = s.setAuto(null); toast((r && r.msg) || '連續歷練已停止。'); }
            renderExpAll();
          }
        } catch (e) { toast('操作失敗，請重試'); }
      };
      el.addEventListener('click', exp.handler);
      renderExpAll();
    },
    update() {
      if (!exp.el || !isUnlocked('expedition')) return;
      renderExpAll();
    },
    unmount() {
      if (exp.el && exp.handler) exp.el.removeEventListener('click', exp.handler);
      exp.el = null; exp.handler = null; exp.sel = null;
    },
  };

  /* ================================================================
   * Tab 3：秘境（sysId 'dungeon_tower'，三頁籤：爬塔/守關/尋寶）
   * ================================================================ */
  const dg = { el: null, handler: null, sub: 'tower', chain: null, auto: false, lastRes: null, huntGains: [], wasActive: false };

  function dgSys() { const s = sys('dungeon'); return (s && s.towerInfo) ? s : null; }

  function renderDgSub() {
    const z = dg.el && dg.el.querySelector('#tbb-dg-sub');
    if (!z) return;
    const tabs = [['tower', '鎮妖塔'], ['guard', '守關'], ['hunt', '尋寶']];
    z.innerHTML = tabs.map((t) =>
      '<div class="tbb-sub' + (dg.sub === t[0] ? ' tbb-sub-on' : '') + '" data-act="dg-sub" data-s="' + t[0] + '">' + t[1] + '</div>'
    ).join('');
  }

  function fmtRewards(rw) {
    return gainLines(rw).join('、');
  }

  function renderTower() {
    const z = dg.el && dg.el.querySelector('#tbb-dg-body');
    const s = dgSys();
    if (!z || !s) return;
    let info, sw;
    try { info = s.towerInfo(); sw = s.sweepInfo ? s.sweepInfo() : null; } catch (e) { return; }
    const pow = myPower();
    let h = '<div class="card"><h3 class="card-title">鎮妖塔 · 第 ' + info.layer + ' 層'
      + '<span class="muted" style="font-weight:normal">（最高 ' + info.best + ' 層）</span></h3>'
      + (info.feisheng
          ? '<div class="card-sub" style="color:var(--gold-d)">已臻飛昇，無限挑戰，無損耗。</div>'
          : '<div class="muted" style="font-size:11px">挑戰失敗折損修為 ' + fmtI(info.penalty) + '（不足則不可挑戰）</div>')
      + '<div class="tbb-rowline"><span>守層妖邪戰力 <b style="color:var(--danger)">' + fmt(info.need) + '</b></span>'
      + '<span>我方戰力 <b style="color:var(--qing-d)">' + fmt(pow) + '</b></span>'
      + '<span class="tbb-sp"></span><span>預估勝率 <b style="color:' + (info.winP >= 0.5 ? 'var(--qing-d)' : 'var(--danger)') + '">' + pct(info.winP) + '</b></span></div>'
      + '<div style="margin:6px 0"><span class="muted">本週詞綴（' + esc(info.week || '') + '）：</span><br>';
    (info.affixes || []).forEach((a) => {
      h += '<span class="tbb-affix" title="' + esc(a.desc || '') + '">' + esc(a.name) + '</span>';
    });
    if (!(info.affixes || []).length) h += '<span class="muted">無</span>';
    h += '</div>';
    if (info.hiddenBoss && info.boss) {
      h += '<div class="tbb-boss-warn">' + esc(info.boss.icon || '👹') + ' 隱藏 BOSS「' + esc(info.boss.name) + '」坐鎮此層，妖威暴漲，勝之必有重寶！</div>';
    } else {
      h += '<div class="muted">每 33 層有隱藏 BOSS 現身，掉落遠勝尋常。</div>';
    }
    h += '<div class="tbb-rowline" style="margin-top:8px">'
      + '<button class="btn btn-primary" data-act="dg-tower"' + (dg.chain || !info.penaltyOk ? ' disabled' : '') + '>' + (info.penaltyOk ? '挑戰本層' : '修為不足') + '</button>'
      + '<button class="btn' + (dg.chain ? ' btn-danger' : '') + '" data-act="dg-chain">' + (dg.chain ? '鳴金收兵（已連勝 ' + dg.chain.wins + '）' : '快速連挑') + '</button>'
      + '</div>'
      + '<div id="tbb-dg-tres" style="margin-top:6px">'
      + (dg.chain ? '<div class="muted">連挑進行中……每 800 息一戰，直至敗北。</div>' : '')
      + (dg.lastRes
          ? '<div class="card-sub">' + (dg.lastRes.win
              ? '<span class="tbb-win">勝！</span> 所得：' + esc(fmtRewards(dg.lastRes.rewards) || '無')
              : '<span class="tbb-lose">敗北。</span>全身而退，毫髮無損。') + '</div>'
          : '')
      + '</div></div>';
    // 掃蕩卡
    if (sw) {
      h += '<div class="card"><h3 class="card-title">塔域掃蕩</h3>'
        + '<div class="tbb-rowline"><span>今日免費 <b style="color:var(--gold-d)">' + sw.freeLeft + '</b> / ' + sw.perDay + ' 次</span>'
        + '<span class="muted">其後靈玉 ' + sw.payCost + '/次</span><span class="tbb-sp"></span>'
        + '<button class="btn tbb-mini" data-act="dg-sweep"' + (sw.canSweep ? '' : ' disabled') + '>一鍵掃蕩</button></div>'
        + '<div class="card-sub" style="margin-top:4px">按歷史最高 ' + sw.best + ' 層折算，預估可得：靈石 ' + fmt(sw.est.lingShi) + '、修為 ' + fmt(sw.est.cult) + '，附材料/靈草/殘篇若干</div></div>';
    }
    z.innerHTML = h;
  }

  function guardRewardText(rw) {
    if (!rw) return '';
    const out = [];
    if (rw.lingShi) out.push('靈石 ' + fmt(rw.lingShi));
    if (rw.lingYu) out.push('靈玉 ' + rw.lingYu);
    if (rw.mat) for (const k in rw.mat) { const m = matOf(k); out.push((m ? m.name : k) + '×' + rw.mat[k][1]); }
    if (rw.frag) for (const k in rw.frag) out.push('殘篇（' + k.replace('g', '') + '品）');
    if (rw.egg) out.push('靈寵蛋×' + rw.egg);
    return out.join('、');
  }

  function renderGuard() {
    const z = dg.el && dg.el.querySelector('#tbb-dg-body');
    const s = dgSys();
    if (!z || !s) return;
    let info;
    try { info = s.guardInfo(); } catch (e) { return; }
    if (!info || !info.unlocked) {
      z.innerHTML = '<div class="card"><h3 class="card-title">守關未啓</h3><div class="card-sub">化神 1 層方可鎮守關隘，抵禦獸潮。</div></div>';
      return;
    }
    const waves = (XG.data && XG.data.world && XG.data.world.dungeons && XG.data.world.dungeons.guard.waves) || [];
    let h = '<div class="card"><h3 class="card-title">守關 · 已退敵 ' + info.cleared + ' / ' + info.total + ' 檔</h3>'
      + (info.done
          ? '<div class="card-sub">十五檔皆通，真乃當世雄關！仍可復刷末檔（1/3 靈石）。</div>'
          : '<div class="card-sub">下一檔「' + esc(info.next ? info.next.name : '') + '」戰力 ' + fmt(info.next ? info.next.power : 0)
            + ' · 我方 ' + fmt(myPower()) + ' · 預估勝率 ' + pct(info.winP) + '</div>')
      + '<div style="text-align:center;margin:8px 0"><button class="btn btn-primary" data-act="dg-guard">'
      + (info.done ? '復刷末檔' : '迎戰第 ' + (info.next ? info.next.n : '') + ' 檔') + '</button></div></div>'
      + '<div class="card"><h3 class="card-title">十五檔獸潮</h3>';
    waves.forEach((w) => {
      const st = w.n <= info.cleared ? 'done' : (w.n === info.cleared + 1 && !info.done ? 'cur' : 'future');
      h += '<div class="tbb-guard tbb-guard-' + st + '"><div class="tbb-rowline">'
        + '<span style="font-size:17px">' + esc(w.icon) + '</span><b>' + w.n + ' · ' + esc(w.name) + '</b>'
        + (st === 'done' ? '<span style="color:var(--gold-d)">已退敵</span>' : '')
        + (st === 'cur' ? '<span style="color:var(--qing-d)">當前可挑戰</span>' : '')
        + '<span class="tbb-sp"></span><span class="muted">戰力 ' + fmt(w.power) + '</span></div>'
        + '<div class="muted" style="font-size:11px">賞：' + esc(guardRewardText(w.reward)) + '</div></div>';
    });
    h += '</div>';
    z.innerHTML = h;
  }

  function huntSeek() {
    const s = dgSys();
    if (!s) return;
    try {
      const r = s.seek();
      if (!r || !r.ok) { if (r && r.err) toast(r.err); return; }
      const lines = gainLines(r.gains);
      dg.huntGains.unshift({
        t: Date.now(),
        box: r.box ? (r.box.icon + ' ' + r.box.name) : '寶箱',
        text: lines.join('、') || '空空如也',
      });
      if (dg.huntGains.length > 30) dg.huntGains.length = 30;
      if (r.gains && (r.gains.lingYu || r.gains.egg)) pop(lines.join('、'), 'pop-good');
    } catch (e) { /* 忽略 */ }
  }

  function renderHunt() {
    const z = dg.el && dg.el.querySelector('#tbb-dg-body');
    const s = dgSys();
    if (!z || !s) return;
    let info;
    try { info = s.huntInfo(); } catch (e) { return; }
    if (!info || !info.unlocked) {
      z.innerHTML = '<div class="card"><h3 class="card-title">尋寶未啓</h3><div class="card-sub">煉虛 1 層方可入上古遺府探尋祕寶。</div></div>';
      return;
    }
    let h = '<div class="card"><h3 class="card-title">上古遺府 · 限時尋寶</h3>';
    if (!info.active) {
      h += '<div class="card-sub">每場 ' + Math.floor(info.dur / 60) + ' 分鐘，府內寶箱連綿而出（每 4~8 息一隻）。</div>'
        + '<div class="tbb-rowline" style="margin-top:6px"><span>今日免費次數 <b style="color:var(--gold-d)">' + info.freeLeft + '</b> / 10</span>'
        + '<span class="muted">其後門票 靈玉 ' + info.payCost + '/次</span><span class="tbb-sp"></span>'
        + '<button class="btn btn-primary" data-act="dg-hunt-enter">' + (info.freeLeft > 0 ? '免費入府' : '購票入府') + '</button></div>';
      if (dg.huntGains.length) {
        h += '<div class="muted" style="margin-top:6px">上局斬獲 ' + dg.huntGains.length + ' 箱，可再入府續緣。</div>';
      }
    } else {
      const left = Math.max(0, Math.floor(info.left));
      const mm = Math.floor(left / 60), ss = left % 60;
      h += '<div class="tbb-hunt-count">' + mm + ':' + (ss < 10 ? '0' : '') + ss + '</div>'
        + '<div class="tbb-rowline"><span>已開寶箱 <b style="color:var(--gold-d)">' + info.boxes + '</b> 只</span><span class="tbb-sp"></span>'
        + '<button class="btn tbb-mini' + (dg.auto ? ' btn-primary' : '') + '" data-act="dg-hunt-auto">自動模式：' + (dg.auto ? '開' : '關') + '</button>'
        + '<button class="btn btn-ghost tbb-mini" data-act="dg-hunt-end">提前離場</button></div>'
        + '<div style="text-align:center;margin:8px 0"><button class="btn btn-primary" data-act="dg-hunt-seek"'
        + (info.cdLeft > 0 ? ' disabled' : '') + '>' + (info.cdLeft > 0 ? '調息 ' + info.cdLeft.toFixed(1) + 's' : '探尋') + '</button></div>'
        + '<h3 class="card-title">本局收穫</h3><div class="tbb-log">';
      if (!dg.huntGains.length) h += '<div class="muted">尚未有所獲，點「探尋」或靜候自動開箱。</div>';
      dg.huntGains.forEach((g) => {
        h += '<div class="tbb-log-item">' + esc(g.box) + '：<span style="color:var(--qing-d)">' + esc(g.text) + '</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    z.innerHTML = h;
  }

  function renderDg() {
    renderDgSub();
    if (dg.sub === 'tower') renderTower();
    else if (dg.sub === 'guard') renderGuard();
    else renderHunt();
  }

  function stopChain(msg) {
    if (dg.chain && dg.chain.timer) clearTimeout(dg.chain.timer);
    dg.chain = null;
    if (msg) toast(msg);
    if (dg.sub === 'tower') renderTower();
  }

  function chainStep() {
    const s = dgSys();
    if (!s || !dg.chain) return;
    let r;
    try { r = s.challengeTower(); } catch (e) { stopChain('連挑中斷'); return; }
    if (!r || !r.ok) { stopChain((r && r.err) || '連挑中斷'); return; }
    dg.lastRes = r;
    if (r.win) {
      dg.chain.wins++;
      pop('第 ' + r.layer + ' 層 · 勝', 'pop-good');
      renderTower();
      dg.chain.timer = setTimeout(chainStep, 800);
    } else {
      stopChain('連挑止於第 ' + r.layer + ' 層，共連勝 ' + dg.chain.wins + ' 場');
    }
  }

  const dungeonTab = {
    id: 'dungeon', name: '秘境', icon: '🗼', order: 22, main: false, sysId: 'dungeon_tower',
    mount(el) {
      injectStyle();
      dg.el = el;
      el.innerHTML = '<div class="tab-page"><h2>秘境</h2>'
        + '<div class="tbb-subbar" id="tbb-dg-sub"></div><div id="tbb-dg-body"></div></div>';
      dg.handler = function (ev) {
        const t = ev.target.closest('[data-act]');
        if (!t) return;
        const act = t.getAttribute('data-act');
        const s = dgSys();
        if (!s) return;
        try {
          if (act === 'dg-sub') {
            dg.sub = t.dataset.s;
            if (dg.sub !== 'tower') stopChain();
            dg.lastRes = null;
            renderDg();
          } else if (act === 'dg-tower') {
            const r = s.challengeTower();
            if (!r || !r.ok) { toast((r && r.err) || '挑戰失敗'); return; }
            dg.lastRes = r;
            if (r.win) pop('鎮妖塔第 ' + r.layer + ' 層 · 破', 'pop-good');
            else toast('惜敗於第 ' + r.layer + ' 層' + (r.penalty > 0 ? '，折損修為 ' + fmtI(r.penalty) : '') + (r.feisheng ? '，飛昇之身無損分毫。' : '，且再礪劍。'), 'err');
            renderTower();
          } else if (act === 'dg-chain') {
            if (dg.chain) { stopChain('鳴金收兵，連勝 ' + dg.chain.wins + ' 場'); return; }
            dg.chain = { wins: 0, timer: null };
            renderTower();
            chainStep();
          } else if (act === 'dg-guard') {
            const r = s.challengeGuard();
            if (!r || !r.ok) { toast((r && r.err) || '挑戰失敗'); return; }
            if (r.win) {
              pop('擊退「' + (r.wave ? r.wave.name : '獸潮') + '」', 'pop-good');
              toast('守關大捷！' + (r.rewards ? fmtRewards(r.rewards) : ''));
            } else toast('防線告破……整軍再來。', 'err');
            renderGuard();
          } else if (act === 'dg-sweep') {
            const r = s.quickSweep();
            if (!r || !r.ok) { toast((r && r.err) || '掃蕩未成'); return; }
            if (r.msg && r.msg.length) toast(r.msg.join('；'));
            if (r.gains && r.gains.lingShi) pop('靈石 +' + fmtI(r.gains.lingShi), 'pop-good');
            renderTower();
          } else if (act === 'dg-hunt-enter') {
            const r = s.enterHunt();
            if (!r || !r.ok) { toast((r && r.err) || '入府未成'); return; }
            dg.huntGains = [];
            dg.wasActive = true;
            toast(r.free ? '承每日免費之緣，入府尋寶！' : '靈玉易票，入府尋寶！');
            renderHunt();
          } else if (act === 'dg-hunt-seek') {
            huntSeek();
            renderHunt();
          } else if (act === 'dg-hunt-auto') {
            dg.auto = !dg.auto;
            renderHunt();
          } else if (act === 'dg-hunt-end') {
            const r = s.endHunt();
            if (r && r.ok) { toast('離場結算，共開寶箱 ' + (r.boxes || 0) + ' 只'); dg.wasActive = false; }
            else if (r && r.err) toast(r.err);
            renderHunt();
          }
        } catch (e) { toast('操作失敗，請重試'); }
      };
      el.addEventListener('click', dg.handler);
      dg.sub = 'tower';
      dg.lastRes = null;
      renderDg();
    },
    update() {
      if (!dg.el) return;
      if (!isUnlocked('dungeon_tower')) return;
      // 尋寶自動模式：CD 一好即自動探尋（UI 側加速，sys 另有 5s 自動開箱）
      if (dg.sub === 'hunt' && dg.auto) {
        const s = dgSys();
        if (s) {
          try {
            const hi = s.huntInfo();
            if (hi && hi.active && hi.cdLeft <= 0) huntSeek();
            if (dg.wasActive && hi && !hi.active) { dg.wasActive = false; toast('遺府之行已畢，所獲盡歸囊中'); }
          } catch (e) { /* 忽略 */ }
        }
      }
      renderDg();
    },
    unmount() {
      stopChain();
      if (dg.el && dg.handler) dg.el.removeEventListener('click', dg.handler);
      dg.el = null; dg.handler = null;
    },
  };

  /* ================================================================
   * Tab 4：鬥法（sysId 'pvp'）
   * ================================================================ */
  const pv = { el: null, handler: null, opp: null, busy: false, timers: [], lastRes: null, auto: false, mySchool: '' };
  const TIER_ICONS = { qingtong: '🥉', baiyin: '🥈', huangjin: '🥇', bojin: '💠', zuanshi: '💎', xianzun: '👑' };
  const COUNTER = { jian: 'fu', fu: 'zhen', zhen: 'dan', dan: 'ti', ti: 'jian' }; // 與 pvp.js 剋制環一致
  const SCHOOL_ORDER = ['jian', 'fu', 'zhen', 'dan', 'ti'];

  function pvpSys() { const s = sys('pvp'); return (s && s.getOverview) ? s : null; }
  function schoolList() {
    const l = (XG.data && XG.data.fellows && XG.data.fellows.schools) || [];
    const map = {};
    l.forEach((s) => { map[s.id] = s; });
    return SCHOOL_ORDER.map((id) => map[id] || { id: id, name: id, icon: '⚔️' });
  }
  function schoolName(id) {
    const l = schoolList();
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i].name;
    return id;
  }

  function renderPvpTop() {
    const z = pv.el && pv.el.querySelector('#tbb-pvp-top');
    const s = pvpSys();
    if (!z || !s) return;
    let o;
    try { o = s.getOverview(); } catch (e) { return; }
    if (!o.unlocked) { z.innerHTML = '<div class="card-sub">金丹 5 層方可登臺論劍。</div>'; return; }
    let h = '<div class="tbb-rowline"><span class="tbb-tier">' + (TIER_ICONS[o.tier.id] || '🏅') + '</span>'
      + '<div><b style="font-size:16px">' + esc(o.tier.name) + '</b>'
      + '<div class="muted">積分 <b style="color:var(--gold-d)">' + fmtI(o.pts) + '</b></div></div>'
      + '<span class="tbb-sp"></span><div style="text-align:right"><div class="muted">每 10 分鐘結算</div></div></div>';
    if (o.nextTier) {
      h += '<div class="progress" style="margin:6px 0"><div class="progress-fill" style="width:' + ((o.progress || 0) * 100).toFixed(1) + '%"></div>'
        + '<div class="progress-text">距「' + esc(o.nextTier.name) + '」還需 ' + fmtI(Math.max(0, o.nextTier.min - o.pts)) + ' 分</div></div>';
    } else {
      h += '<div class="card-sub" style="margin:6px 0">已臻仙尊之位，睥睨羣倫。</div>';
    }
    h += '<div class="tbb-rowline" style="font-size:12px">'
      + '<span class="muted">戰績 ' + (o.wins || 0) + ' 勝 / ' + (o.losses || 0) + ' 負</span>'
      + (o.streak >= 2 ? '<span style="color:var(--gold-d)">' + o.streak + ' 連勝（下場勝 +' + Math.min(30, 3 * o.streak) + '）</span>' : '')
      + '<span class="tbb-sp"></span><span class="muted">今日有獎場次 ' + o.dailyLeft + ' / ' + o.dailyMax + '</span></div>';
    // 週期結算
    h += '<div style="margin-top:8px;border-top:1px dashed var(--line);padding-top:6px">'
      + '<div class="tbb-rowline"><b style="font-size:13px">週期結算獎勵</b><span class="tbb-sp"></span>'
      + '<button class="btn tbb-mini" data-act="pvp-claim"' + ((o.pending || []).length ? '' : ' disabled') + '>一鍵補領</button></div>';
    if (!(o.pending || []).length) {
      h += '<div class="muted">暫無待領週期獎勵。</div>';
    } else {
      o.pending.forEach((p) => {
        h += '<div class="tbb-log-item">' + esc(p.season) + ' · ' + esc(p.tierName)
          + ' <span class="tbb-sp"></span><span style="color:var(--gold-d)">靈玉 ' + p.lingYu + '、殘篇 ' + p.frags + '</span></div>';
      });
    }
    h += '</div>';
    z.innerHTML = h;
  }

  function estWinP(opp) {
    const me = myPower();
    if (!me || !opp || !opp.power) return 0.5;
    let a = me, b = opp.power;
    const mySch = pv.mySchool;
    if (mySch && COUNTER[mySch] === opp.school) a *= 1.15;
    else if (mySch && COUNTER[opp.school] === mySch) b *= 1.15;
    return a / (a + b);
  }

  function renderPvpMatch() {
    const z = pv.el && pv.el.querySelector('#tbb-pvp-match');
    const s = pvpSys();
    if (!z || !s) return;
    if (pv.busy) return; // 戰鬥動畫進行中，不重繪
    let cf;
    try { cf = s.canFight ? s.canFight() : { ok: true }; } catch (e) { cf = { ok: false, reason: '系統未就緒' }; }
    let h = '';
    if (!cf.ok) {
      h = '<div class="card-sub">' + esc(cf.reason || '暫不可論劍') + '</div>';
    } else if (!pv.opp) {
      h = '<div class="tbb-rowline"><span class="muted">匹配戰力相近之道友，三局兩勝定高下。</span><span class="tbb-sp"></span>'
        + '<button class="btn btn-primary" data-act="pvp-match">尋敵論劍</button></div>'
        + '<div class="tbb-rowline" style="margin-top:4px">'
        + '<button class="btn tbb-mini' + (pv.auto ? ' btn-primary' : '') + '" data-act="pvp-auto">⚔ 連戰：' + (pv.auto ? '開' : '關') + '</button>'
        + '</div>'
        + (pv.lastRes ? pvpLastResHtml() : '');
    } else {
      const o = pv.opp;
      const wp = estWinP(o);
      h = '<div class="tbb-opp"><div class="tbb-rowline"><b style="font-size:15px">' + esc(o.name) + ' ' + esc(XG.character.symbol(o.gender)) + '</b>'
        + '<span class="muted">' + esc(realmTxt(o.realmIdx, o.layer)) + '</span>'
        + '<span class="tbb-wx tbb-wx-huo">' + esc(o.schoolName || schoolName(o.school)) + '</span>'
        + (o.relation === 'rival' ? '<span class="tbb-tag-yin" style="background:var(--danger)">宿敵</span>' : '')
        + (o.relation === 'partner' ? '<span class="tbb-tag-yin">道侶</span>' : '')
        + (o.relation === 'friend' ? '<span class="tbb-tag-yin">摯友</span>' : '')
        + '</div><div class="card-sub" style="margin:4px 0">戰力 ' + fmt(o.power)
        + ' · 預估勝率 <b style="color:' + (wp >= 0.5 ? 'var(--qing-d)' : 'var(--danger)') + '">' + pct(wp) + '</b></div>'
        + '<div class="tbb-rowline"><button class="btn btn-primary" data-act="pvp-fight">開戰</button>'
        + '<button class="btn btn-ghost" data-act="pvp-match">另尋對手</button></div></div>'
        + '<div id="tbb-pvp-rounds" style="text-align:center;margin-top:8px"></div>'
        + '<div id="tbb-pvp-result" style="text-align:center"></div>';
    }
    z.innerHTML = h;
  }

  function pvpLastResHtml() {
    const r = pv.lastRes;
    if (!r) return '';
    return '<div class="card-sub" style="margin-top:6px">上一場：' + (r.win ? '<span class="tbb-win">勝</span>' : '<span class="tbb-lose">負</span>')
      + ' ' + esc(r.opp ? r.opp.name + ' ' + XG.character.symbol(r.opp.gender) : '') + '　積分 <span style="color:' + (r.delta >= 0 ? 'var(--qing-d)' : 'var(--danger)') + '">'
      + (r.delta >= 0 ? '+' : '') + r.delta + '</span></div>';
  }

  function renderPvpSchool() {
    const z = pv.el && pv.el.querySelector('#tbb-pvp-school');
    const s = pvpSys();
    if (!z || !s) return;
    let cur;
    try { cur = s.getSchool ? s.getSchool() : null; } catch (e) { cur = null; }
    pv.mySchool = cur ? cur.id : null;
    const counterMe = pv.mySchool ? COUNTER[pv.mySchool] : null;
    let counteredBy = null;
    if (pv.mySchool) for (const k in COUNTER) if (COUNTER[k] === pv.mySchool) counteredBy = k;
    let h = '<div class="tbb-ring">';
    schoolList().forEach((sc, i) => {
      if (i > 0) h += '<span class="tbb-ring-arrow">→</span>';
      h += '<span class="tbb-ring-node' + (cur && cur.id === sc.id ? ' tbb-ring-on' : '') + '" data-act="pvp-sch" data-id="' + esc(sc.id) + '">'
        + esc(sc.icon || '') + ' ' + esc(sc.name) + '</span>';
    });
    h += '<span class="tbb-ring-arrow">↺</span></div>'
      + '<div class="muted" style="text-align:center;margin-top:4px">剋制環循環相剋，克敵一方戰力 +15%。當前：'
      + (cur ? '<b style="color:var(--gold-d)">' + esc(cur.name) + '</b>'
        + (counterMe ? '（克 ' + esc(schoolName(counterMe)) + '，忌 ' + esc(schoolName(counteredBy)) + '）' : '')
        : '未擇流派') + '</div>';
    z.innerHTML = h;
  }

  function renderPvpHist() {
    const z = pv.el && pv.el.querySelector('#tbb-pvp-hist');
    const s = pvpSys();
    if (!z || !s) return;
    let list;
    try { list = s.getHistory(); } catch (e) { return; }
    if (!list || !list.length) { z.innerHTML = '<div class="card-sub">尚無戰報。</div>'; return; }
    let h = '';
    list.slice(0, 20).forEach((r) => {
      const rounds = (r.rounds || []).map((x) => (x ? '✓' : '✗')).join(' ');
      h += '<div class="tbb-log-item"><span class="muted">' + dateTxt(r.t) + '</span> '
        + (r.win ? '<span class="tbb-win">勝</span>' : '<span class="tbb-lose">負</span>') + ' '
        + esc(r.name) + (r.rival ? ' <span class="tbb-tag-yin" style="background:var(--danger)">宿敵</span>' : '')
        + ' <span class="tbb-hist-round muted">' + rounds + '</span>'
        + '<span class="tbb-sp" style="float:right;color:' + (r.delta >= 0 ? 'var(--qing-d)' : 'var(--danger)') + '">'
        + (r.delta >= 0 ? '+' : '') + r.delta + '</span></div>';
    });
    z.innerHTML = h;
  }

  function renderPvpAll() {
    renderPvpTop();
    renderPvpMatch();
    renderPvpSchool();
    renderPvpHist();
  }

  function clearPvTimers() {
    pv.timers.forEach((t) => clearTimeout(t));
    pv.timers = [];
  }

  function pvpFightAnim(res) {
    pv.busy = true;
    clearPvTimers();
    const rounds = res.rounds || [];
    const total = Math.max(1, rounds.length); // 三局兩勝可能 2 局終結，按實際局數渲染
    const rz = pv.el && pv.el.querySelector('#tbb-pvp-rounds');
    const zz = pv.el && pv.el.querySelector('#tbb-pvp-result');
    if (zz) zz.innerHTML = '';
    if (rz) rz.innerHTML = new Array(total + 1).join('<span class="tbb-round tbb-round-wait">?</span>');
    // 逐局 reveal（600ms/局）
    for (let i = 0; i < total; i++) {
      pv.timers.push(setTimeout(() => {
        const el2 = pv.el && pv.el.querySelector('#tbb-pvp-rounds');
        if (!el2) return;
        let h = '';
        for (let j = 0; j < total; j++) {
          if (j <= i && j < rounds.length) {
            h += '<span class="tbb-round ' + (rounds[j] ? 'tbb-round-win' : 'tbb-round-lose') + '">' + (rounds[j] ? '勝' : '負') + '</span>';
          } else {
            h += '<span class="tbb-round tbb-round-wait">?</span>';
          }
        }
        el2.innerHTML = h;
      }, i * 600));
    }
    // 結果與積分跳動
    pv.timers.push(setTimeout(() => {
      pv.busy = false;
      pv.opp = null;
      pv.lastRes = res;
      const el3 = pv.el && pv.el.querySelector('#tbb-pvp-result');
      if (el3) {
        let h = '<div style="font-size:18px;margin:6px 0">' + (res.win ? '<span class="tbb-win">論劍得勝！</span>' : '<span class="tbb-lose">技不如人</span>');
        h += '　<span class="tbb-pts-jump" style="color:' + (res.delta >= 0 ? 'var(--qing-d)' : 'var(--danger)') + '">'
          + (res.delta >= 0 ? '+' : '') + res.delta + ' 分</span></div>';
        const tags = [];
        if (res.counter === 'win') tags.push('流派相剋，順勢 +15%');
        if (res.counter === 'lose') tags.push('流派被克，逆勢苦戰');
        if (res.tierUp) tags.push('段位晉升！');
        if (res.tierDown) tags.push('段位跌落……');
        if (res.upset) tags.push('越階挑戰，額外 +5 分');
        if (res.streakBonus > 0) tags.push(res.streak + ' 連勝，加成 +' + res.streakBonus + ' 分');
        if (res.reward) tags.push('日賞：' + gainLines(res.reward).join('、'));
        if (tags.length) h += '<div class="card-sub">' + tags.map(esc).join('　') + '</div>';
        el3.innerHTML = h;
      }
      if (res.win) pop('論劍勝 ' + (res.delta >= 0 ? '+' : '') + res.delta + ' 分', 'pop-good');
      else pop('論劍負 ' + res.delta + ' 分', 'pop-bad');
      // 延遲全量刷新段位/戰報
      pv.timers.push(setTimeout(() => { renderPvpTop(); renderPvpHist(); }, 900));
    }, total * 600 + 200));
  }

  const pvpTab = {
    id: 'pvp', name: '鬥法', icon: '⚔️', order: 23, main: false, sysId: 'pvp',
    mount(el) {
      injectStyle();
      pv.el = el;
      pv.opp = null; pv.busy = false; pv.lastRes = null;
      try { const s2 = pvpSys(); if (s2 && typeof s2.getAuto === 'function') pv.auto = s2.getAuto(); } catch (e) { pv.auto = false; }
      el.innerHTML = '<div class="tab-page"><h2>鬥法 · 論劍</h2>'
        + '<div class="card" id="tbb-pvp-top"></div>'
        + '<div class="card"><h3 class="card-title">論劍臺</h3><div id="tbb-pvp-match"></div></div>'
        + '<div class="card"><h3 class="card-title">論劍流派</h3><div id="tbb-pvp-school"></div></div>'
        + '<div class="card"><h3 class="card-title">戰報</h3><div class="tbb-log" id="tbb-pvp-hist"></div></div>'
        + '</div>';
      pv.handler = function (ev) {
        const t = ev.target.closest('[data-act]');
        if (!t) return;
        const act = t.getAttribute('data-act');
        const s = pvpSys();
        if (!s) return;
        try {
          if (act === 'pvp-match') {
            if (pv.busy) return;
            const o = s.match();
            if (!o) { toast('茫茫九州，竟無可戰之敵'); return; }
            pv.opp = o;
            renderPvpMatch();
          } else if (act === 'pvp-fight') {
            if (pv.busy || !pv.opp) return;
            const r = s.fight(pv.opp.uid);
            if (!r || !r.ok) { toast((r && r.reason) || '此戰未成'); return; }
            pvpFightAnim(r);
          } else if (act === 'pvp-sch') {
            const ok = s.setSchool(t.dataset.id);
            toast(ok ? '已擇「' + schoolName(t.dataset.id) + '」之道' : '流派未改');
            renderPvpSchool();
            renderPvpMatch();
          } else if (act === 'pvp-claim') {
            const r = s.claimSeason();
            if (!r || !r.ok) { toast((r && r.reason) || '無可補領'); return; }
            toast('補領 ' + r.count + ' 期週期賞：靈玉 ' + r.lingYu + '、殘篇若干');
            pop('靈玉 +' + r.lingYu, 'pop-good');
            renderPvpAll();
          } else if (act === 'pvp-auto') {
            if (typeof s.setAuto === 'function') { pv.auto = !pv.auto; s.setAuto(pv.auto); }
            toast(pv.auto ? '自動連戰已開啓，每 3 秒一戰。' : '自動連戰已停止。');
            renderPvpAll();
          }
        } catch (e) { toast('操作失敗，請重試'); }
      };
      el.addEventListener('click', pv.handler);
      // 自動連戰結果刷新
      pv._resHandler = function (data) {
        if (!pv.el) return;
        pv.lastRes = data;
        pv.opp = null;
        // 播一條簡短 toast
        toast((data.win ? '勝' : '負') + ' ' + (data.opp ? data.opp.name : '') + '，積分 ' + (data.delta >= 0 ? '+' : '') + data.delta);
        renderPvpAll();
      };
      XG.bus.on('pvp:result', pv._resHandler);
      renderPvpAll();
    },
    update() {
      if (!pv.el || !isUnlocked('pvp')) return;
      renderPvpTop();
      renderPvpMatch(); // busy 時內部跳過
      renderPvpHist();
    },
    unmount() {
      clearPvTimers();
      pv.busy = false;
      if (pv.el && pv.handler) pv.el.removeEventListener('click', pv.handler);
      if (pv._resHandler) { XG.bus.off('pvp:result', pv._resHandler); pv._resHandler = null; }
      pv.el = null; pv.handler = null; pv.opp = null;
    },
  };

  /* ==================== 註冊四個 tab ==================== */
  reg(caveTab);
  reg(expeditionTab);
  reg(dungeonTab);
  reg(pvpTab);
})();
