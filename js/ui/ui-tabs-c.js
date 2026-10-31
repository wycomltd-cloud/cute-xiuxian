/* ui-tabs-c.js：道友 / 坊市 / 圖鑑 / 成就 / 輪迴 / 設置 六個 tab（契約 §12，均 main:false）
 * 消費系統：fellows（道友列表/求助/坊市/道侶）、collection（圖鑑+成就）、reincarn（輪迴）、save/state（設置）
 * 樣式：優先複用 style.css 主題類（card/btn/progress/grid/modal 等）；
 *       擴展樣式經 <style id="xtc-style"> 注入，類名統一 xtc- 前綴防衝突 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  /* ==================== 通用防禦小工具 ==================== */
  function sys(id) { return (XG.sys && XG.sys[id]) || null; }
  function esc(s) {
    s = (s == null ? '' : String(s));
    return (XG.util && XG.util.esc) ? XG.util.esc(s) : s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function genderBadge(g) { return XG.character && XG.character.valid(g) ? '<span class="cute-gender-badge cute-gender-' + g + '" aria-label="' + XG.character.label(g) + '">' + XG.character.symbol(g) + '</span>' : ''; }
  function fmt(n) { try { return XG.util.fmt(n || 0); } catch (e) { return String(n || 0); } }
  function fmtInt(n) { try { return XG.util.fmtInt(n || 0); } catch (e) { return String(Math.floor(n || 0)); } }
  function fmtTime(sec) { try { return XG.util.fmtTime(Math.max(0, sec | 0)); } catch (e) { return (sec | 0) + '秒'; } }
  function clampN(v, a, b) { v = Number(v) || 0; return Math.min(b, Math.max(a, v)); }
  function toast(msg, type) { if (XG.ui && XG.ui.toast) { try { XG.ui.toast(msg, type); } catch (e) {} } }
  function pop(text, cls) { if (XG.ui && XG.ui.pop) { try { XG.ui.pop(text, cls); } catch (e) {} } }
  function modal(opt) { if (XG.ui && XG.ui.modal) { try { XG.ui.modal(opt); } catch (e) {} } else toast(opt && opt.title || ''); }
  function closeModal() { if (XG.ui && XG.ui.closeModal) { try { XG.ui.closeModal(); } catch (e) {} } }
  function confirmBox(text, cb) {
    if (XG.ui && XG.ui.confirm) { try { XG.ui.confirm(text, cb); return; } catch (e) {} }
    if (window.confirm(text)) cb();
  }
  function unlocked(id) { try { return XG.cfg && XG.cfg.isUnlocked ? XG.cfg.isUnlocked(id) : true; } catch (e) { return true; } }
  function R(el, name) { return el ? el.querySelector('[data-r="' + name + '"]') : null; }
  function lockHtml(text) { return '<div class="card xtc-lock">🔒 ' + esc(text) + '</div>'; }

  // tab 註冊（防禦性：兼容 ui-core 後加載，契約 §12 守則 1）
  const reg = function (def) {
    if (window.XG && XG.ui && XG.ui.registerTab) XG.ui.registerTab(def);
    else { XG._pendingTabs = XG._pendingTabs || []; XG._pendingTabs.push(def); }
  };

  // 事件綁定/解綁（同一 el 重複 mount 不疊加監聽）
  function bindTab(tab, el, handler) {
    tab._el = el;
    tab._h = handler;
    el.removeEventListener('click', handler);
    el.addEventListener('click', handler);
  }
  function unbindTab(tab, el) {
    if (tab && tab._h && el) el.removeEventListener('click', tab._h);
    if (tab) tab._el = null;
  }
  // 點擊是否落在本 tab 根內（防同容器串 tab 觸發）
  function inRoot(e, id) {
    const t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) return null;
    const root = t.closest('[data-xtc="' + id + '"]');
    return root ? t : null;
  }

  /* ==================== 注入樣式（xtc- 前綴） ==================== */
  function injectStyle() {
    if (document.getElementById('xtc-style')) return;
    const st = document.createElement('style');
    st.id = 'xtc-style';
    st.textContent = [
      '/* ui-tabs-c 注入樣式：類名統一 xtc- 前綴 */',
      '.xtc-kv{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:2px 0}',
      '.xtc-kv b{color:var(--qing-d)}',
      '.xtc-rel{font-size:11px;border-radius:8px;padding:0 6px;margin-left:4px;white-space:nowrap}',
      '.xtc-rel-friend{color:var(--gold-d);border:1px solid var(--gold)}',
      '.xtc-rel-rival{color:var(--danger);border:1px solid var(--danger)}',
      '.xtc-rel-partner{color:#c05a7e;border:1px solid #d98aa5;background:rgba(217,138,165,.14)}',
      '.xtc-tag{font-size:11px;color:var(--ink-l);border:1px solid var(--line);border-radius:8px;padding:0 5px;white-space:nowrap}',
      '.xtc-fav{margin-top:5px}',
      '.xtc-click{cursor:pointer}',
      '.xtc-click:active{transform:translateY(1px)}',
      '.xtc-old{text-decoration:line-through;color:var(--ink-l);font-size:12px;margin-right:4px}',
      '.xtc-price{color:var(--gold-d);font-weight:bold}',
      '.xtc-say{background:rgba(58,125,107,.08);border-left:3px solid var(--qing);padding:8px 10px;border-radius:4px;white-space:pre-line;margin:8px 0;font-size:14px}',
      '.xtc-news-li{font-size:12px;color:var(--ink-l);padding:3px 0;border-bottom:1px dashed var(--line)}',
      '.xtc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
      '.xtc-tab-b{font-family:var(--font-kai);font-size:13px;padding:4px 12px;border-radius:14px;border:1px solid var(--line);background:var(--paper);color:var(--ink-l);cursor:pointer}',
      '.xtc-tab-b.on{background:var(--qing);color:#f9f5ea;border-color:var(--qing-d)}',
      '.xtc-badge-n{background:var(--danger);color:#fff;font-size:10px;border-radius:8px;padding:0 5px;margin-left:3px}',
      '.xtc-grid-icon{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
      '.xtc-cell{text-align:center;padding:8px 4px;border:1px solid var(--line);border-radius:8px;background:var(--paper);font-size:12px;cursor:pointer}',
      '.xtc-cell .xtc-ci{font-size:22px;display:block;line-height:1.3}',
      '.xtc-cell.dim{opacity:.45;cursor:default;filter:grayscale(1)}',
      '.xtc-ring{width:86px;height:86px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}',
      '.xtc-ring-in{width:66px;height:66px;border-radius:50%;background:var(--paper);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--qing-d);font-size:15px}',
      '.xtc-flash{animation:xtcFlash 1.2s ease-in-out infinite}',
      '.xtc-tcols{display:grid;grid-template-columns:1fr;gap:10px}',
      '.xtc-tnode{border:1px solid var(--line);border-radius:8px;padding:8px;margin-bottom:8px;background:var(--paper)}',
      '.xtc-tnode.dim{opacity:.5}',
      '.xtc-tnode.max{border-color:var(--gold)}',
      '.xtc-wave{display:flex;justify-content:space-between;gap:6px;font-size:13px;padding:5px 8px;border-bottom:1px dashed var(--line)}',
      '.xtc-wave.pre{opacity:.75}',
      '.xtc-wave.re{opacity:.3}',
      '.xtc-wave.re.show{opacity:1;animation:xtcWaveIn .3s ease}',
      '.xtc-wave.pass{color:var(--qing-d)}',
      '.xtc-wave.fail{color:var(--danger);font-weight:bold}',
      '.xtc-qty{display:inline-flex;align-items:center;gap:6px}',
      '.xtc-qty .btn{padding:2px 10px}',
      '.xtc-io{width:100%;font-family:var(--font-kai);font-size:12px;border:1px solid var(--line);border-radius:6px;background:#fbf7ec;color:var(--ink);padding:6px;resize:vertical}',
      '.xtc-lock{text-align:center;padding:28px 10px;color:var(--ink-l)}',
      '.xtc-mrow{display:flex;justify-content:space-between;font-size:12px;color:var(--ink-l)}',
      '@keyframes xtcFlash{0%,100%{box-shadow:0 0 0 0 rgba(201,160,99,0)}50%{box-shadow:0 0 12px 3px rgba(201,160,99,.8)}}',
      '@keyframes xtcWaveIn{from{transform:translateX(-8px);opacity:0}to{transform:none;opacity:1}}',
      '@media (min-width:768px){.xtc-grid-icon{grid-template-columns:repeat(4,1fr)}.xtc-tcols{grid-template-columns:repeat(3,1fr)}}',
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ==================== 數據小助手 ==================== */
  const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const PILL_TYPE = { atk: '攻', def: '防', hp: '血' };
  const EFF_NAME = {
    cultRatePct: '修煉速度', atkPct: '攻擊', defPct: '防禦', hpPct: '氣血', dropPct: '掉落',
    alchSuccPct: '煉丹成功率', forgeSuccPct: '煉器成功率', breakSuccPct: '突破成功率',
    offlineHours: '離線時長', workPct: '打工效率', atkFlat: '攻擊', defFlat: '防禦', hpFlat: '氣血',
  };
  function personaName(id) {
    const ps = (XG.data && XG.data.fellows && XG.data.fellows.personas) || [];
    for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].id === id) return ps[i].name;
    return id || '散修';
  }
  function gradeTxt(kind, g) {
    g = g | 0;
    if (kind === 'equip') return ['凡品', '靈品', '寶品', '仙品', '神品'][g] || (g + '品');
    if (kind === 'mat') return ['一階', '二階', '三階', '四階', '五階'][g] || (g + '階');
    if (kind === 'egg' || g <= 0) return '';
    return g + '品';
  }
  function daysAgo(ts) {
    if (!ts) return '—';
    const d = Math.floor((Date.now() - ts) / 86400000);
    return d <= 0 ? '今日相識' : ('相識 ' + d + ' 日');
  }
  function invCount(kind, id) {
    const inv = (XG.state && XG.state.inv) || {};
    const bag = kind === 'pill' ? inv.pill : inv.mat;
    return (bag && bag[id]) || 0;
  }
  function fellowNews(name, n) {
    const arr = (XG.state && XG.state.news) || [];
    const out = [];
    for (let i = 0; i < arr.length && out.length < n; i++) {
      const it = arr[i];
      if (it && it.text && String(it.text).indexOf(name) >= 0) out.push(it);
    }
    return out;
  }
  function rewardText(rw) {
    if (!rw) return '???';
    const parts = [];
    if (rw.lingYu) parts.push('靈玉×' + fmt(rw.lingYu));
    if (rw.lingShi) parts.push('靈石×' + fmt(rw.lingShi));
    if (rw.eff) {
      for (const k in rw.eff) {
        parts.push((EFF_NAME[k] || k) + '+' + rw.eff[k] + (/Pct$/.test(k) ? '%' : ''));
      }
    }
    return parts.length ? parts.join('、') : '無';
  }
  function popReward(rw) {
    if (!rw) return;
    if (rw.lingYu) pop('靈玉+' + fmt(rw.lingYu), 'pop-good');
    if (rw.lingShi) pop('靈石+' + fmt(rw.lingShi), 'pop-good');
  }

  /* ==================== 一、道友 tab ==================== */
  const REL_BADGE = {
    friend: ['摯友', 'xtc-rel-friend'],
    rival: ['宿敵', 'xtc-rel-rival'],
    partner: ['道侶', 'xtc-rel-partner'],
  };
  const F_STATE = { normal: '潛修', stuck: '卡關', surge: '頓悟', trib: '渡劫' };

  function renderFellows(el) {
    const body = R(el, 'body');
    if (!body) return;
    const fs = sys('fellows');
    if (!fs) { body.innerHTML = lockHtml('道友系統尚未載入。'); return; }
    if (!unlocked('fellows')) { body.innerHTML = lockHtml('道友：煉氣 8 層解鎖。下山之前，先夯實道基。'); return; }

    let html = '';
    /* ---- 求助卡置頂 ---- */
    let helps = [];
    try { helps = fs.listHelp() || []; } catch (e) { helps = []; }
    const pend = helps.filter(function (h) { return h && h.done === 0; });
    if (pend.length) {
      html += '<div class="card"><h3 class="card-title">📮 道友求助（' + pend.length + '）</h3>';
      pend.forEach(function (h) {
        html += '<div style="border-bottom:1px dashed var(--line);padding:6px 0;display:flex;gap:8px;align-items:flex-start">'
          + '<div style="flex:1;min-width:0"><div><b>' + esc(h.name) + '</b> ' + genderBadge(h.gender) + '：' + esc(h.text) + '</div>'
          + '<div class="muted">需 ' + esc(h.icon || '') + ' ' + esc(h.itemName) + ' ×' + h.n
          + '（現有 ' + fmtInt(invCount(h.kind, h.id)) + '）</div></div>'
          + '<div style="flex:none"><button class="btn btn-primary" data-act="help-ok" data-hid="' + esc(h.hid) + '">贈予</button> '
          + '<button class="btn btn-ghost" data-act="help-no" data-hid="' + esc(h.hid) + '">婉拒</button></div></div>';
      });
      html += '</div>';
    }
    /* ---- 道侶卡 ---- */
    let pi = null;
    try { pi = fs.partnerInfo(); } catch (e) { pi = null; }
    if (pi) {
      html += '<div class="card"><h3 class="card-title">💞 道侶 · ' + esc(pi.name) + ' ' + genderBadge(pi.gender) + '</h3>'
        + '<div class="xtc-kv"><span>境界</span><b>' + esc(pi.realmName) + '</b></div>'
        + '<div class="xtc-kv"><span>好感</span><b>' + fmtInt(pi.favor) + '/100</b></div>'
        + '<div class="muted">道侶在身，修煉速度 +10%。</div>'
        + '<div class="row" style="margin-top:6px">'
        + '<button class="btn btn-primary" data-act="f-dual"' + (pi.canDual ? '' : ' disabled') + '>'
        + (pi.canDual ? '雙修（每小時一次）' : '調息中，稍後再修') + '</button>'
        + '<button class="btn btn-ghost" data-act="f-story">劇情回顧</button></div></div>';
    }
    /* ---- 統計 + 道友列表（sys 已按 關係>好感>境界 排序） ---- */
    let cnt = { total: 0, friend: 0, rival: 0, partner: 0 };
    try { cnt = fs.count() || cnt; } catch (e) {}
    html += '<div class="card-sub" style="margin:4px 2px 8px">道友 ' + fmtInt(cnt.total)
      + ' 人 · 摯友 ' + fmtInt(cnt.friend) + ' · 宿敵 ' + fmtInt(cnt.rival) + ' · 道侶 ' + fmtInt(cnt.partner) + '</div>';
    html += '<div class="row" style="margin:0 2px 8px"><button class="btn btn-primary" data-act="f-discuss-all">🍵 一鍵煮茶論道</button></div>';
    const gift=fs.giftProgress();
    html+='<div class="card-sub">🎁 全體送禮累計 '+gift.totalSent+' 次，再送 '+gift.nextIn+' 次有一位道友回禮。可獲靈石／靈玉／裝備／丹藥／殘片。'+(gift.pendingReturns?'<button class="btn btn-primary" data-act="f-claim-gifts">領取待領回禮 ×'+gift.pendingReturns+'</button>':'')+'</div>';
    const used=XG.balance.daily().discuss||0;
    html+='<div class="muted">今日論道 '+used+' 次：前5次全額、6～10次三成，其後只增好感。高境界道友最多加成20%。</div>';
    let list = [];
    try { list = fs.list() || []; } catch (e) { list = []; }
    if (!list.length) html += '<div class="card xtc-lock">四下無人，待境界高深自有機緣結識。</div>';
    html += '<div class="grid">';
    list.forEach(function (f) {
      const rb = REL_BADGE[f.relation];
      html += '<div class="card xtc-click" data-act="f-detail" data-uid="' + esc(f.uid) + '" style="margin-bottom:0">'
        + '<div class="row" style="flex-wrap:nowrap">'
        + '<span style="font-size:24px;flex:none">' + esc(f.schoolIcon || '修') + '</span>'
        + '<div style="flex:1;min-width:0">'
        + '<div><b>' + esc(f.name) + '</b> ' + genderBadge(f.gender) + ' <span class="muted">' + esc(f.realmName) + '</span>'
        + (rb ? '<span class="xtc-rel ' + rb[1] + '">' + rb[0] + '</span>' : '') + '</div>'
        + '<div class="muted">' + esc(f.schoolName) + ' · ' + esc(f.personaName) + ' · '
        + esc(F_STATE[f.state] || '潛修') + (f.reincarn ? ' · ' + f.reincarn + '世' : '') + '</div>'
        + '<div class="progress xtc-fav"><div class="progress-fill" style="width:' + clampN(f.favor, 0, 100) + '%"></div>'
        + '<div class="progress-text">好感 ' + fmtInt(f.favor) + '/100</div></div>'
        + '<button class="btn btn-ghost" data-act="f-gift" data-uid="'+esc(f.uid)+'">送禮 🎁</button><span class="muted"> 全體再送'+f.giftReturnIn+'次有回禮</span>'
        + '</div></div></div>';
    });
    html += '</div>';
    body.innerHTML = html;
  }

  function showFellowDetail(el, uid, extraHtml) {
    const fs = sys('fellows');
    if (!fs) return;
    let f = null;
    try { f = fs.get(uid); } catch (e) { f = null; }
    if (!f) { toast('查無此人。', 'err'); return; }
    const rb = REL_BADGE[f.relation];
    let html = '<div class="xtc-kv"><span>性別</span><b>' + genderBadge(f.gender) + ' ' + esc(XG.character.label(f.gender)) + '</b></div><div class="xtc-kv"><span>流派</span><b>' + esc(f.schoolIcon || '') + ' ' + esc(f.schoolName) + '</b></div>'
      + '<div class="xtc-kv"><span>境界</span><b>' + esc(f.realmName) + '</b></div>'
      + '<div class="xtc-kv"><span>性格</span><b>' + esc(f.personaName) + '</b></div>'
      + '<div class="xtc-kv"><span>靈根</span><b>' + esc(f.rootName) + '</b></div>'
      + '<div class="xtc-kv"><span>天資</span><b>×' + (f.talent != null ? Number(f.talent).toFixed(2) : '—') + '</b></div>'
      + '<div class="xtc-kv"><span>戰力</span><b>' + fmt(f.power) + '</b></div>'
      + '<div class="xtc-kv"><span>狀態</span><b>' + esc(F_STATE[f.state] || '潛修') + '</b></div>'
      + '<div class="xtc-kv"><span>相識</span><b>' + esc(daysAgo(f.metAt)) + '</b></div>'
      + '<div class="progress xtc-fav"><div class="progress-fill" style="width:' + clampN(f.favor, 0, 100) + '%"></div>'
      + '<div class="progress-text">好感 ' + fmtInt(f.favor) + '/100</div></div>';
    html+='<p class="muted">此道友已收禮 '+(f.giftsReceived||0)+' 次；全體累計 '+f.globalGiftsSent+' 次，再送 '+f.giftReturnIn+' 次有一位道友回禮。</p>';
    if (f.lastNews && f.lastNews.text) html += '<div class="xtc-say">📜 ' + esc(f.lastNews.text) + '</div>';
    if (extraHtml) html += extraHtml;
    const news = fellowNews(f.name, 6);
    if (news.length) {
      html += '<div style="margin-top:8px;border-top:1px dashed var(--line);padding-top:6px"><b class="muted">近日傳聞</b>';
      news.forEach(function (n) { html += '<div class="xtc-news-li">' + esc(n.text) + '</div>'; });
      html += '</div>';
    }
    if (!XG.character.opposite(XG.state.player.gender, f.gender) && f.relation !== 'partner') html += '<p class="cute-relationship-note">同門情誼也很珍貴。道侶需要與主角性別相反，同性別道友可成為摯友。</p>';
    const hasP = !!(XG.state && XG.state.player && XG.state.player.partner);
    const btns = [];
    if (f.relation !== 'partner') {
      btns.push({
        text: f.canDiscuss ? '煮茶論道' : '靜思中，稍後再論',
        cls: f.canDiscuss ? 'btn-primary' : 'btn-ghost',
        cb: function () { doDiscuss(el, uid); },
      });
      if (!hasP && (f.favor || 0) >= 100 && XG.character.opposite(XG.state.player.gender, f.gender)) {
        btns.push({ text: '結為道侶', cls: 'btn-primary', cb: function () { doBecomePartner(el, uid); } });
      }
    }
    btns.push({text:'送禮 🎁',cls:'btn-primary',cb:function(){showGiftDialog(el,uid);return false;}});
    btns.push({ text: '告辭', cls: 'btn-ghost', cb: function () { closeModal(); } });
    modal({ title: (rb ? '【' + rb[0] + '】' : '') + f.name + ' ' + XG.character.symbol(f.gender), html: html, buttons: btns });
  }

  function showGiftDialog(el,uid,resultText) {
    const fs=sys('fellows'),f=fs.get(uid);if(!f)return;
    const items=fs.giftItems(),labels={equip:'裝備',pill:'丹藥',frag:'殘片'};
    let html=resultText?'<p class="xtc-say">'+esc(resultText)+'</p>':'';
    html+='<p>送給 '+esc(f.name)+'：此道友已收禮 '+(f.giftsReceived||0)+' 次；全體累計 '+f.globalGiftsSent+' 次，距下次回禮 '+f.giftReturnIn+' 次。</p>';
    html+='<p class="muted">每次送出1件，提高好感；送給不同道友的次數一起計算，每滿50次，由一位收過禮的道友隨機回贈靈石、靈玉、裝備、丹藥或殘片；回禮價值依這50件禮物估值控制。穿著的裝備不能送，鑲嵌寶石會隨裝備送出。</p>';
    if(items.length) {
      html+='<label for="fellow-gift-item">選擇禮物</label><select id="fellow-gift-item" style="width:100%;max-width:100%;padding:10px;margin:8px 0">';
      ['equip','pill','frag'].forEach(function(kind){
        const rows=items.map((it,index)=>({it:it,index:index})).filter(row=>row.it.kind===kind);if(!rows.length)return;
        html+='<optgroup label="'+labels[kind]+'">';
        rows.forEach(row=>{html+='<option value="'+row.index+'">'+esc(row.it.name)+' ×'+row.it.count+'</option>';});html+='</optgroup>';
      });html+='</select>';
    } else html+='<p>揹包暫時沒有可送的裝備、丹藥或殘片。</p>';
    const buttons=[{text:'返回道友',cb:function(){showFellowDetail(el,uid);return false;}}];
    if(items.length)buttons.push({text:'送出1件',cls:'btn-primary',cb:function(){
      const selector=document.getElementById('fellow-gift-item'),item=selector&&items[Number(selector.value)];
      if(!item)return false;const r=fs.sendGift(uid,item.kind,item.id);toast(r.msg,r.ok?'gold':'err');
      renderFellows(el);showGiftDialog(el,uid,r.msg);return false;
    }});
    modal({title:'送禮給'+f.name+' 🎁',html:html,buttons:buttons});
  }

  function doDiscuss(el, uid) {
    const fs = sys('fellows');
    if (!fs) return;
    let r = null;
    try { r = fs.discuss(uid); } catch (e) { r = null; }
    if (!r) { toast('論道未成。', 'err'); return; }
    toast(r.msg, r.ok ? undefined : 'err');
    if (r.ok) {
      if (r.cult) pop('修為+' + fmt(r.cult), 'pop-good');
      showFellowDetail(el, uid, r.text ? '<div class="xtc-say">' + esc(r.text) + '</div>' : '');
      renderFellows(el);
    }
  }

  function doBecomePartner(el, uid) {
    const fs = sys('fellows');
    if (!fs) return;
    let r = null;
    try { r = fs.becomePartner(uid); } catch (e) { r = null; }
    if (!r) { toast('結緣未成。', 'err'); return; }
    toast(r.msg, r.ok ? 'gold' : 'err');
    if (r.ok) {
      showFellowDetail(el, uid, r.text ? '<div class="xtc-say">' + esc(r.text) + '</div>' : '');
      renderFellows(el);
    }
  }

  function onFellowClick(e) {
    const t = inRoot(e, 'fellows');
    if (!t) return;
    const el = e.currentTarget;
    const act = t.getAttribute('data-act');
    const fs = sys('fellows');
    if (act === 'f-detail') {
      showFellowDetail(el, t.getAttribute('data-uid'));
    } else if(act==='f-claim-gifts') {
      const r=fs.claimGiftReturns();toast(r.msg,r.ok?'gold':'err');renderFellows(el);
    } else if(act==='f-gift') {
      showGiftDialog(el,t.getAttribute('data-uid'));
    } else if (act === 'f-discuss-all') {
      if (!fs) return;
      let r = null;
      // 批量論道期間靜音逐人跳字，結束後只跳一次總收益
      if (XG.ui && XG.ui.popMute) XG.ui.popMute(true);
      try { r = fs.discussAll(); } catch (err) { r = null; }
      if (XG.ui && XG.ui.popMute) XG.ui.popMute(false);
      if (!r) { toast('論道未成。', 'err'); return; }
      toast(r.msg, r.ok ? undefined : 'err');
      if (r.ok && r.cult) pop('修為+' + fmt(r.cult), 'pop-good');
      renderFellows(el);
    } else if (act === 'help-ok' || act === 'help-no') {
      if (!fs) return;
      const hid = t.getAttribute('data-hid');
      let r = null;
      try { r = act === 'help-ok' ? fs.satisfyHelp(hid) : fs.refuseHelp(hid); } catch (err) { r = null; }
      if (!r) { toast('操作未成。', 'err'); return; }
      toast(r.msg, r.ok ? undefined : 'err');
      if (r.ok && r.text) {
        modal({
          title: '道友回話',
          html: '<div class="xtc-say">' + esc(r.text) + '</div>'
            + (r.gift && r.gift.desc ? '<div class="muted">回贈：' + esc(r.gift.desc) + '</div>' : ''),
          buttons: [{ text: '收下', cls: 'btn-primary', cb: function () { closeModal(); } }],
        });
        if (r.gift && r.gift.ouhuang) pop('歐皇機緣！', 'pop-good');
      }
      renderFellows(el);
    } else if (act === 'f-dual') {
      if (!fs) return;
      let r = null;
      try { r = fs.dualCultivate(); } catch (err) { r = null; }
      if (!r) { toast('雙修未成。', 'err'); return; }
      toast(r.msg, r.ok ? 'gold' : 'err');
      if (r.ok) {
        if (r.cult) pop('修為+' + fmt(r.cult), 'pop-good');
        if (r.text) modal({ title: '雙修', html: '<div class="xtc-say">' + esc(r.text) + '</div>', buttons: [{ text: '好', cls: 'btn-primary', cb: function () { closeModal(); } }] });
      }
      renderFellows(el);
    } else if (act === 'f-story') {
      if (!fs) return;
      let pi = null;
      try { pi = fs.partnerInfo(); } catch (err) { pi = null; }
      if (!pi) return;
      const news = fellowNews(pi.name, 10);
      let html = news.length ? '' : '<div class="muted">紅綢初結，尚無太多故事。</div>';
      news.forEach(function (n) { html += '<div class="xtc-news-li">' + esc(n.text) + '</div>'; });
      modal({ title: '與 ' + pi.name + ' 的點滴', html: html, buttons: [{ text: '關閉', cls: 'btn-ghost', cb: function () { closeModal(); } }] });
    }
  }

  const fellowTab = {
    id: 'fellows', name: '道友', icon: '🤝', order: 60, main: false, sysId: 'fellows',
    mount(el) {
      injectStyle();
      el.innerHTML = '<div class="tab-page xtc-page" data-xtc="fellows"><div data-r="body"></div></div>';
      bindTab(this, el, onFellowClick);
      renderFellows(el);
    },
    update() { const el = this._el; if (el && R(el, 'body')) renderFellows(el); },
    unmount(el) { unbindTab(this, el); },
  };

  /* ==================== 二、坊市 tab ==================== */
  // 由 marketRules 基準價推算「原價」（性格/關係浮動前），用於劃線對比
  function marketBase(s) {
    const mr = (XG.data && XG.data.world && XG.data.world.marketRules) || {};
    const bp = (mr.stock && mr.stock.basePrice) || {};
    if (s.kind === 'recipe') return (s.grade || 1) * 3; // 丹方欄為靈玉固定價，無劃線對比
    let b = 0;
    if (s.kind === 'pill') b = (bp.pillPerGrade || 200) * (s.grade || 1);
    else if (s.kind === 'mat') b = bp['matG' + (s.grade || 0)] || 100;
    else if (s.kind === 'equip') b = (bp.equipPerGrade || 800) * Math.max(1, s.grade || 0);
    else if (s.kind === 'frag') b = (bp.fragPerGrade || 1500) * (s.grade || 1);
    else b = bp.egg || 3e4;
    if (s.cur === 'lingYu') b = Math.max(1, Math.round(b / 500));
    else b = Math.max(1, Math.round(b));
    return b;
  }

  function renderMarket(el) {
    const body = R(el, 'body');
    if (!body) return;
    const fs = sys('fellows');
    if (!fs) { body.innerHTML = lockHtml('坊市系統尚未載入。'); return; }
    if (!unlocked('market')) { body.innerHTML = lockHtml('坊市：築基 5 層解鎖。'); return; }
    let m = null;
    try { m = fs.market(); } catch (e) { m = null; }
    if (!m || !m.unlocked) { body.innerHTML = lockHtml('坊市未開，築基 5 層後再來。'); return; }

    const lingYu = (XG.state && XG.state.res && XG.state.res.lingYu) || 0;
    let html = '<div class="card"><div class="row" style="justify-content:space-between">'
      + '<div>今日換新：<b>'+m.refreshUsed+' / 5</b><div class="muted">每日免費首批；不再每10分鐘自動換新。距每日重置 '+fmtTime(m.nextInSec)+'</div></div>'
      + '<button class="btn btn-primary" data-act="m-refresh"' + (m.refreshLeft>0&&lingYu>=m.refreshCost ? '' : ' disabled') + '>'+(m.refreshLeft>0?'靈玉×'+m.refreshCost+' 換新（餘'+m.refreshLeft+'次）':'今日換新已用完')+'</button>'
      + '</div><p class="muted">換新費用5／10／20／40／80靈玉；付費換新整批加價：第1次+20%、第2次+30%、第3次+40%、第4／5次+50%。坊市購得物品沿用實付價六成回收上限。</p><p class="muted">本批依生成時境界與戰力估價；提高實力後，下次換新可出現更高級商品。</p></div>';
    if (!m.slots || !m.slots.length) html += '<div class="card xtc-lock">今日坊市冷清，暫無貨色。</div>';
    html += '<div class="grid grid-2">';
    (m.slots || []).forEach(function (s) {
      const base = s.basePrice||marketBase(s);
      const g = gradeTxt(s.kind, s.grade);
      html += '<div class="card" style="margin-bottom:0">'
        + '<div class="xtc-mrow"><span>賣家 · ' + esc(s.sellerName) + '</span><span class="xtc-tag">' + esc(personaName(s.persona)) + '</span></div>'
        + '<div class="row" style="margin:6px 0 2px;flex-wrap:nowrap"><span style="font-size:22px;flex:none">' + esc(s.icon || '📦') + '</span>'
        + '<div style="min-width:0"><b>' + esc(s.name) + '</b>' + (g ? '<div class="muted">' + esc(g) + '</div>' : '') + '</div></div>'
        + (s.line ? '<div class="muted" style="font-size:12px">' + esc(s.line) + '</div>' : '')
        + '<div style="margin:4px 0">'
        + (base && base > s.price ? '<span class="xtc-old">' + fmt(base) + '</span>' : '')
        + (s.markup>0?'<span class="xtc-tag">原價 '+fmt(s.originalPrice)+' '+esc(s.curName)+' ＋'+Math.round(s.markup*100)+'%</span> ':'')
        + '<span class="xtc-price">' + fmt(s.price) + '</span> <span class="muted">' + esc(s.curName) + '</span>'
        + (base && base < s.price ? '<span class="muted" style="font-size:12px">（本批統一加價）</span>' : '')
        + (s.kind==='pill'?'<div class="muted">今日還可購買 '+s.dailyLeft+' 顆（同品項每日3顆，刷新不重置）</div>':'')
        + '<span class="muted" style="float:right">餘量 ×' + fmtInt(s.n) + '</span></div>'
        + '<button class="btn btn-primary" style="width:100%" data-act="m-buy" data-sid="' + esc(s.sid) + '"'
        + (s.sold ? ' disabled' : '') + '>' + (s.sold ? '已售罄' : '買下') + '</button>'
        + '</div>';
    });
    html += '</div>';
    body.innerHTML = html;
  }

  function onMarketClick(e) {
    const t = inRoot(e, 'market');
    if (!t) return;
    const el = e.currentTarget;
    const act = t.getAttribute('data-act');
    const fs = sys('fellows');
    if (!fs) return;
    if (act === 'm-buy') {
      let r = null;
      try { r = fs.buyMarket(t.getAttribute('data-sid')); } catch (err) { r = null; }
      if (!r) { toast('買賣未成。', 'err'); return; }
      // msg 內含成交臺詞（marketLines.deal），直接 toast
      toast(r.msg, r.ok ? undefined : 'err');
      renderMarket(el);
    } else if (act === 'm-refresh') {
      let r = null;
      try { r = fs.refreshMarket(); } catch (err) { r = null; }
      if (!r) { toast('換新未成。', 'err'); return; }
      toast(r.msg, r.ok ? 'gold' : 'err');
      renderMarket(el);
    }
  }

  const marketTab = {
    id: 'market', name: '坊市', icon: '🏮', order: 61, main: false, sysId: 'market',
    mount(el) {
      injectStyle();
      el.innerHTML = '<div class="tab-page xtc-page" data-xtc="market"><div data-r="body"></div></div>';
      bindTab(this, el, onMarketClick);
      renderMarket(el);
    },
    update() { const el = this._el; if (el && R(el, 'body')) renderMarket(el); }, // 每秒刷新倒計時/貨欄
    unmount(el) { unbindTab(this, el); },
  };

  /* ==================== 三、圖鑑 tab（始終可見） ==================== */
  function renderCodex(el) {
    const body = R(el, 'body');
    if (!body) return;
    const col = sys('collection');
    if (!col) { body.innerHTML = lockHtml('圖鑑系統尚未載入。'); return; }
    const st = el._cx || (el._cx = { kind: 'gongfa', sig: '' });
    let sum = null;
    try { sum = col.getCodexSummary(); } catch (e) { sum = null; }
    if (!sum) { body.innerHTML = lockHtml('圖鑑空空如也。'); return; }

    let html = '<div class="card"><div class="row" style="flex-wrap:nowrap;align-items:center">'
      + '<div class="xtc-ring" style="background:conic-gradient(var(--gold) ' + clampN(sum.pct * 3.6, 0, 360) + 'deg, rgba(43,43,43,.12) 0)">'
      + '<div class="xtc-ring-in">' + sum.pct + '%</div></div>'
      + '<div style="flex:1;min-width:0"><b>圖鑑總完成度</b> <span class="muted">' + fmtInt(sum.collected) + '/' + fmtInt(sum.total) + '</span>';
    (sum.cats || []).forEach(function (c) {
      html += '<div class="xtc-mrow"><span>' + esc(c.icon) + ' ' + esc(c.name) + '</span><span>'
        + fmtInt(c.collected) + '/' + fmtInt(c.total) + '（' + c.pct + '%）</span></div>'
        + '<div class="progress" style="height:6px;margin-bottom:3px"><div class="progress-fill" style="width:' + clampN(c.pct, 0, 100) + '%"></div></div>';
    });
    html += '</div></div></div>';

    html += '<div class="xtc-tabs">';
    (sum.cats || []).forEach(function (c) {
      html += '<button class="xtc-tab-b' + (st.kind === c.kind ? ' on' : '') + '" data-act="cx-tab" data-kind="' + esc(c.kind) + '">'
        + esc(c.icon) + ' ' + esc(c.name) + '</button>';
    });
    html += '</div>';

    let list = [];
    try { list = col.getCodexList(st.kind) || []; } catch (e) { list = []; }
    if (!list.length) html += '<div class="card xtc-lock">此類尚無條目。</div>';
    html += '<div class="xtc-grid-icon">';
    list.forEach(function (it) {
      if (it.got) {
        html += '<div class="xtc-cell" data-act="cx-detail" data-id="' + esc(it.id) + '"><span class="xtc-ci">' + esc(it.icon) + '</span>' + esc(it.name) + (st.kind === 'fellow' ? genderBadge(((XG.state.fellows || []).find(function (f) { return f.uid === it.id; }) || {}).gender) : '') + '</div>';
      } else {
        html += '<div class="xtc-cell dim"><span class="xtc-ci">❓</span>???</div>';
      }
    });
    html += '</div>';
    body.innerHTML = html;
    st.sig = st.kind + '|' + sum.collected + '|' + sum.total;
  }

  function showCodexDetail(el, id) {
    const col = sys('collection');
    if (!col) return;
    const st = el._cx;
    let list = [];
    try { list = col.getCodexList(st.kind) || []; } catch (e) { list = []; }
    let it = null;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) { it = list[i]; break; }
    if (!it || !it.got) return;
    const catName = (st.kind === 'gongfa' ? '功法' : st.kind === 'pill' ? '丹方' : st.kind === 'pet' ? '靈寵' : st.kind === 'equip' ? '裝備' : '道友');
    const g = gradeTxt(st.kind === 'equip' ? 'equip' : st.kind, it.grade);
    let html = '<div style="text-align:center;font-size:40px">' + esc(it.icon) + '</div>'
      + '<div style="text-align:center;margin-bottom:6px"><b>' + esc(it.name) + (st.kind === 'fellow' ? ' ' + genderBadge(((XG.state.fellows || []).find(function (f) { return f.uid === it.id; }) || {}).gender) : '') + '</b>'
      + (g ? ' <span class="xtc-tag">' + esc(g) + '</span>' : '') + '</div>'
      + (it.desc ? '<div class="xtc-say">' + esc(it.desc) + '</div>' : '')
      + (it.getHint ? '<div class="muted">獲取途徑：' + esc(it.getHint) + '</div>' : '');
    modal({ title: '圖鑑 · ' + catName, html: html, buttons: [{ text: '關閉', cls: 'btn-ghost', cb: function () { closeModal(); } }] });
  }

  function onCodexClick(e) {
    const t = inRoot(e, 'codex');
    if (!t) return;
    const el = e.currentTarget;
    const act = t.getAttribute('data-act');
    if (act === 'cx-tab') {
      const st = el._cx || (el._cx = { kind: 'gongfa', sig: '' });
      st.kind = t.getAttribute('data-kind') || 'gongfa';
      renderCodex(el);
    } else if (act === 'cx-detail') {
      showCodexDetail(el, t.getAttribute('data-id'));
    }
  }

  const codexTab = {
    id: 'codex', name: '圖鑑', icon: '📖', order: 90, main: false,
    mount(el) {
      injectStyle();
      el._cx = { kind: 'gongfa', sig: '' };
      el.innerHTML = '<div class="tab-page xtc-page" data-xtc="codex"><div data-r="body"></div></div>';
      bindTab(this, el, onCodexClick);
      renderCodex(el);
      // 圖鑑新增即時刷新
      const self = this;
      this._off = XG.bus && XG.bus.on ? XG.bus.on('codex:new', function () { if (self._el) renderCodex(self._el); }) : null;
    },
    update() {
      const el = this._el;
      if (!el || !R(el, 'body')) return;
      const col = sys('collection');
      if (!col) return;
      let sum = null;
      try { sum = col.getCodexSummary(); } catch (e) { return; }
      const st = el._cx;
      const sig = st.kind + '|' + sum.collected + '|' + sum.total;
      if (sig !== st.sig) renderCodex(el); // 僅完成度變化時重繪
    },
    unmount(el) {
      if (this._off) { try { this._off(); } catch (e) {} this._off = null; }
      unbindTab(this, el);
    },
  };

  /* ==================== 四、成就 tab ==================== */
  function renderAch(el) {
    const body = R(el, 'body');
    if (!body) return;
    const col = sys('collection');
    if (!col) { body.innerHTML = lockHtml('成就係統尚未載入。'); return; }
    const st = el._ac || (el._ac = { cat: '', acc: 0 });
    let sum = null, cats = [], list = [];
    try { sum = col.getAchSummary(); cats = col.getAchCats() || []; list = col.getAchList(st.cat || undefined) || []; } catch (e) { return; }

    let html = '<div class="card"><div class="row" style="justify-content:space-between">'
      + '<div><b>成就</b> <span class="muted">' + fmtInt(sum.done) + '/' + fmtInt(sum.total) + '（' + sum.pct + '%）</span>'
      + '<div class="muted">可領嘉獎 ' + fmtInt(sum.claimable) + ' 項</div></div>'
      + '<button class="btn btn-primary' + (sum.claimable ? ' xtc-flash' : '') + '" data-act="ac-all"' + (sum.claimable ? '' : ' disabled') + '>一鍵領取</button></div>'
      + '<div class="progress" style="margin-top:6px"><div class="progress-fill" style="width:' + clampN(sum.pct, 0, 100) + '%"></div>'
      + '<div class="progress-text">' + sum.pct + '%</div></div></div>';

    html += '<div class="xtc-tabs"><button class="xtc-tab-b' + (!st.cat ? ' on' : '') + '" data-act="ac-tab" data-cat="">全部</button>';
    cats.forEach(function (c) {
      html += '<button class="xtc-tab-b' + (st.cat === c.cat ? ' on' : '') + '" data-act="ac-tab" data-cat="' + esc(c.cat) + '">'
        + esc(c.name) + (c.claimable ? '<span class="xtc-badge-n">' + c.claimable + '</span>' : '') + '</button>';
    });
    html += '</div>';

    // 可領置頂 → 未達成按進度 → 已領墊底
    list = list.slice().sort(function (a, b) {
      const ra = a.canClaim ? 0 : (a.done ? 2 : 1);
      const rb = b.canClaim ? 0 : (b.done ? 2 : 1);
      if (ra !== rb) return ra - rb;
      return (b.progress || 0) - (a.progress || 0);
    });
    if (!list.length) html += '<div class="card xtc-lock">此類暫無成就。</div>';
    list.forEach(function (a) {
      html += '<div class="card" style="margin-bottom:8px"><div class="row" style="flex-wrap:nowrap;align-items:flex-start">'
        + '<span style="font-size:22px;flex:none">' + esc(a.icon) + '</span>'
        + '<div style="flex:1;min-width:0"><div><b>' + esc(a.name) + '</b>' + (a.hidden ? ' <span class="xtc-tag">隱</span>' : '') + '</div>'
        + '<div class="muted">' + esc(a.desc) + '</div>';
      if (a.cur != null && a.target != null) {
        html += '<div class="progress" style="margin:4px 0"><div class="progress-fill" style="width:' + clampN(Math.round((a.progress || 0) * 100), 0, 100) + '%"></div>'
          + '<div class="progress-text">' + fmtInt(a.cur) + '/' + fmtInt(a.target) + '</div></div>';
      }
      html += '<div class="muted">嘉獎：' + esc(rewardText(a.reward)) + '</div></div>'
        + '<div style="flex:none">';
      if (a.canClaim) html += '<button class="btn btn-primary xtc-flash" data-act="ac-claim" data-id="' + esc(a.id) + '">領取</button>';
      else if (a.claimed) html += '<button class="btn btn-ghost" disabled>已領取</button>';
      html += '</div></div></div>';
    });
    body.innerHTML = html;
  }

  function onAchClick(e) {
    const t = inRoot(e, 'ach');
    if (!t) return;
    const el = e.currentTarget;
    const act = t.getAttribute('data-act');
    const col = sys('collection');
    if (!col) return;
    if (act === 'ac-tab') {
      const st = el._ac || (el._ac = { cat: '', acc: 0 });
      st.cat = t.getAttribute('data-cat') || '';
      renderAch(el);
    } else if (act === 'ac-claim') {
      let r = null;
      try { r = col.claim(t.getAttribute('data-id')); } catch (err) { r = null; }
      if (!r) { toast('領取未成。', 'err'); return; }
      toast(r.msg, r.ok ? 'gold' : 'err');
      if (r.ok) popReward(r.reward);
      renderAch(el);
    } else if (act === 'ac-all') {
      let r = null;
      try { r = col.claimAll(); } catch (err) { r = null; }
      if (!r) { toast('領取未成。', 'err'); return; }
      toast(r.msg, r.ok ? 'gold' : 'err');
      if (r.ok) popReward(r.reward);
      renderAch(el);
    }
  }

  const achTab = {
    id: 'ach', name: '成就', icon: '🏆', order: 91, main: false,
    mount(el) {
      injectStyle();
      el._ac = { cat: '', acc: 0 };
      el.innerHTML = '<div class="tab-page xtc-page" data-xtc="ach"><div data-r="body"></div></div>';
      bindTab(this, el, onAchClick);
      renderAch(el);
      const self = this;
      this._off = XG.bus && XG.bus.on ? XG.bus.on('ach:done', function () { if (self._el) renderAch(self._el); }) : null;
    },
    update(dt) {
      const el = this._el;
      if (!el || !R(el, 'body')) return;
      const st = el._ac;
      st.acc = (st.acc || 0) + (dt || 1);
      if (st.acc >= 2) { st.acc = 0; renderAch(el); } // 2s 節流刷新進度條
    },
    unmount(el) {
      if (this._off) { try { this._off(); } catch (e) {} this._off = null; }
      unbindTab(this, el);
    },
  };

  /* ==================== 五、輪迴 tab ==================== */
  function clearTimers(st) {
    if (!st || !st.timers) return;
    st.timers.forEach(function (id) { clearTimeout(id); });
    st.timers = [];
  }
  function pillSelCount(st) {
    let n = 0;
    for (const k in st.pillSel) n += st.pillSel[k] | 0;
    return n;
  }
  function realmNameOf(rl) {
    if (!rl) return '凡塵';
    const r = (XG.cfg && XG.cfg.REALMS && XG.cfg.REALMS[rl.realmIdx]) || null;
    return (r ? r.name : '?') + ' ' + (rl.layer || 1) + ' 層';
  }
  function rootText(root) {
    if (!root) return '—';
    const rs = (XG.data && XG.data.gongfa && XG.data.gongfa.roots) || [];
    function nm(id) {
      for (let i = 0; i < rs.length; i++) if (rs[i] && rs[i].id === id) return rs[i].name;
      return id || '?';
    }
    return nm(root.type) + ' ' + (root.grade || '?') + '品' + (root.mut ? ' · 變異·' + nm(root.mut) : '');
  }

  function renderReinHead(el) {
    const box = R(el, 'rnhead');
    if (!box) return;
    const rc = sys('reincarn');
    if (!rc) { box.innerHTML = lockHtml('輪迴系統尚未載入。'); return; }
    let rp = { rp: 0, rpTotal: 0, nextRpGain: 0, reincarn: 0 }, idt = null;
    try { rp = rc.getRpInfo() || rp; idt = rc.getIdentity ? rc.getIdentity() : null; } catch (e) {}
    let html = '<div class="card"><h3 class="card-title">☯️ 輪迴</h3>'
      + '<div class="xtc-kv"><span>輪迴次數</span><b>' + fmtInt(rp.reincarn) + ' 世</b></div>'
      + '<div class="xtc-kv"><span>輪迴點 rp</span><b>' + fmtInt(rp.rp) + '</b></div>'
      + '<div class="xtc-kv"><span>累計獲得 rp</span><b>' + fmtInt(rp.rpTotal) + '</b></div>'
      + '<div class="xtc-kv"><span>此刻轉世可得</span><b>+' + fmtInt(rp.nextRpGain) + ' rp</b></div>';
    if (idt) {
      html += '<div class="xtc-say">' + esc(idt.icon || '🎭') + ' <b>' + esc(idt.name) + '</b>（本世身份）<br>'
        + '<span class="muted">' + esc(idt.desc || '') + '</span>'
        + (idt.modsText ? '<br><span class="muted">' + esc(idt.modsText) + '</span>' : '') + '</div>';
    } else {
      html += '<div class="muted" style="margin-top:4px">尚未轉世。渡過九重天劫，方開啓輪迴。</div>';
    }
    html += '</div>';
    box.innerHTML = html;
  }

  function renderReinTalents(el) {
    const box = R(el, 'rntalent');
    if (!box) return;
    const rc = sys('reincarn');
    if (!rc) return;
    let tree = [];
    try { tree = rc.getTalentTree() || []; } catch (e) { tree = []; }
    if (!tree.length) { box.innerHTML = ''; return; }
    const byId = {};
    tree.forEach(function (n) { byId[n.id] = n; });
    const brs = [['cult', '修煉'], ['battle', '戰鬥'], ['luck', '機緣']];
    let html = '<div class="card"><h3 class="card-title">🌳 輪迴天賦</h3><div class="xtc-tcols">';
    brs.forEach(function (br) {
      html += '<div><div class="card-sub" style="text-align:center;margin-bottom:6px">【' + br[1] + '】</div>';
      tree.filter(function (n) { return n.br === br[0]; }).forEach(function (n) {
        const maxed = n.costNext == null;
        const dim = !n.needOk;
        html += '<div class="xtc-tnode' + (dim ? ' dim' : '') + (maxed ? ' max' : '') + '">'
          + '<div><b>' + esc(n.icon || '') + ' ' + esc(n.name) + '</b> <span class="muted">' + fmtInt(n.lv) + '/' + fmtInt(n.max) + '</span></div>'
          + (n.effText ? '<div class="muted" style="font-size:12px">' + esc(n.effText) + '</div>' : '')
          + (n.desc ? '<div class="muted" style="font-size:12px">' + esc(n.desc) + '</div>' : '');
        if (dim && n.need && n.need.length) {
          const nn = n.need.map(function (id) { return byId[id] ? byId[id].name : id; }).join('、');
          html += '<div class="muted" style="font-size:12px">前置：' + esc(nn) + ' 滿級</div>';
        }
        if (maxed) html += '<div class="muted" style="font-size:12px">已臻圓滿</div>';
        else {
          html += '<div class="row" style="margin-top:4px;justify-content:space-between"><span class="muted">消耗 ' + fmtInt(n.costNext) + ' rp</span>'
            + '<button class="btn btn-primary" data-act="rn-up" data-id="' + esc(n.id) + '"'
            + ((n.canUp && n.needOk) ? '' : ' disabled') + '>加點</button></div>';
        }
        html += '</div>';
      });
      html += '</div>';
    });
    html += '</div></div>';
    box.innerHTML = html;
  }

  function renderReinChallenge(el) {
    const box = R(el, 'rnchal');
    if (!box) return;
    const rc = sys('reincarn');
    if (!rc) return;
    const st = el._rn;
    let ci = null;
    try { ci = rc.getChallengeInfo(); } catch (e) { ci = null; }
    if (!ci || !ci.open) { box.innerHTML = '<div class="card xtc-lock">天劫未至，且修且行。</div>'; return; }
    let html = '<div class="card"><h3 class="card-title">⚡ 渡劫挑戰</h3>'
      + '<div class="xtc-kv"><span>當前戰力</span><b>' + fmt(ci.power) + '</b></div>'
      + '<div class="xtc-kv"><span>歷史最佳</span><b>' + fmtInt(ci.bestWave || 0) + '/9 重</b></div>'
      + '<div class="xtc-kv"><span>本世失敗</span><b>' + fmtInt(ci.fails || 0) + ' 次（保底 +' + (ci.pityPct || 0) + '%）</b></div>'
      + '<div style="margin:6px 0">';
    (ci.waves || []).forEach(function (w, i) {
      html += '<div class="xtc-wave pre"><span>第' + CN_NUM[i + 1] + '重 · ' + esc(w.name) + '</span>'
        + '<span>' + esc(w.reqFmt || fmt(w.req)) + ' · ' + Math.round((w.chance || 0) * 100) + '%</span></div>';
    });
    html += '</div>';
    // 祭丹選擇
    let pills = [];
    try { pills = rc.previewPills() || []; } catch (e) { pills = []; }
    const maxP = ci.maxPills || 0;
    html += '<div class="card-sub">祭丹（每顆臨時增益戰力，至多 ' + maxP + ' 顆）</div>';
    if (!pills.length) html += '<div class="muted">袋中無可用戰鬥丹藥。</div>';
    pills.forEach(function (p) {
      const q = st.pillSel[p.id] || 0;
      html += '<div class="xtc-kv" style="align-items:center"><span>' + esc(p.icon || '💊') + ' ' + esc(p.name) + (p.mut ? '★' : '')
        + ' <span class="muted">' + esc(PILL_TYPE[p.type] || p.type) + '+' + p.val + '% · 存 ' + fmtInt(p.count) + '</span></span>'
        + '<span class="xtc-qty"><button class="btn btn-ghost" data-act="rn-pill-minus" data-id="' + esc(p.id) + '">−</button>'
        + '<b>' + q + '</b>'
        + '<button class="btn btn-ghost" data-act="rn-pill-plus" data-id="' + esc(p.id) + '" data-max="' + p.count + '">＋</button></span></div>';
    });
    const selCount = pillSelCount(st);
    html += '<div class="muted" style="margin:4px 0">已選祭丹 ' + selCount + '/' + maxP + '</div>'
      + '<div class="row" style="margin-top:6px">'
      + '<button class="btn btn-danger" data-act="rn-go"' + (ci.canChallenge ? '' : ' disabled') + '>引動天劫</button>'
      + '<button class="btn btn-ghost" data-act="rn-keep">保留/重置預覽</button></div>';
    if (!ci.canChallenge && ci.reason) html += '<div class="muted" style="margin-top:4px">' + esc(ci.reason) + '</div>';
    html += '</div>';
    box.innerHTML = html;
  }

  function renderReincarn(el) {
    const rc = sys('reincarn');
    let open = unlocked('tribulation');
    if (rc && rc.isOpen) { try { open = rc.isOpen(); } catch (e) {} }
    if (!open) {
      const h = R(el, 'rnhead');
      if (h) h.innerHTML = lockHtml('輪迴：大乘 1 層方見渡劫之兆。');
      ['rntalent', 'rnchal', 'rnres'].forEach(function (r) { const b = R(el, r); if (b) b.innerHTML = ''; });
      return;
    }
    renderReinHead(el);
    renderReinTalents(el);
    renderReinChallenge(el);
  }

  // 逐波 reveal 動畫後展示結果
  function playWaves(el, r) {
    const st = el._rn;
    clearTimers(st);
    const box = R(el, 'rnres');
    if (!box) { st.animating = false; return; }
    const waves = r.waves || [];
    let html = '<div class="card"><h3 class="card-title">天劫九重 · 逐波印證</h3>';
    waves.forEach(function (w, i) {
      html += '<div class="xtc-wave re" data-w="' + i + '"><span>第' + CN_NUM[i + 1] + '重 · ' + esc(w.name) + '</span>'
        + '<span data-wt="' + i + '">雷雲積聚…</span></div>';
    });
    html += '<div data-r="rnsum"></div></div>';
    box.innerHTML = html;

    waves.forEach(function (w, i) {
      st.timers.push(setTimeout(function () {
        const row = box.querySelector('[data-w="' + i + '"]');
        const txt = box.querySelector('[data-wt="' + i + '"]');
        if (row) row.classList.add('show', w.pass ? 'pass' : 'fail');
        if (txt) {
          txt.textContent = w.pass
            ? '渡過（戰力 ' + fmt(w.pow) + '）'
            : '潰敗（天威 ' + Math.round((w.roll != null ? w.roll : 0) * 100) + '%）';
        }
        if (XG.ui && XG.ui.fx && XG.ui.fx.shake) { try { XG.ui.fx.shake(); } catch (e) {} }
      }, 550 * (i + 1)));
    });

    st.timers.push(setTimeout(function () {
      st.animating = false;
      const sum = box.querySelector('[data-r="rnsum"]');
      if (r.success) {
        if (sum) sum.innerHTML = '<div class="xtc-say">九雷盡渡，霞舉飛昇！</div>';
        if (XG.ui && XG.ui.fx && XG.ui.fx.breakthrough) { try { XG.ui.fx.breakthrough(); } catch (e) {} }
        toast('九雷盡渡，飛昇轉世！', 'gold');
        showReincarnResult(r);
      } else {
        const at = (r.failedAt != null ? r.failedAt : 0);
        if (sum) {
          sum.innerHTML = '<div class="xtc-say">第' + CN_NUM[Math.min(9, at + 1)] + '重天雷將你劈落凡塵……'
            + '跌落至 ' + esc(realmNameOf(r.dropTo)) + '，保底 +' + (r.pityPct || 0) + '%。</div>';
        }
        toast('渡劫失敗，道基受損。', 'err');
      }
      st.pillSel = {};
      renderReincarn(el); // 成功則已轉世：刷新頭卡/天賦/挑戰區
    }, 550 * waves.length + 700));
  }

  function showReincarnResult(r) {
    const rc = r.reincarn || {};
    const idt = rc.identity || {};
    let html = '<div style="text-align:center;font-size:38px">' + esc(idt.icon || '🌅') + '</div>'
      + '<div style="text-align:center;margin-bottom:6px"><b>第 ' + fmtInt(rc.count) + ' 世 · ' + esc(idt.name || '新生') + '</b></div>'
      + (idt.desc ? '<div class="xtc-say">' + esc(idt.desc) + '</div>' : '')
      + (rc.root ? '<div class="xtc-kv"><span>新生靈根</span><b>' + esc(rootText(rc.root)) + '</b></div>' : '')
      + '<div class="xtc-kv"><span>獲得輪迴點</span><b>+' + fmtInt(rc.rpGain) + ' rp</b></div>'
      + '<div class="xtc-kv"><span>繼承靈玉</span><b>' + fmt(rc.keepLingYu) + '</b></div>';
    if (rc.petReleased) html += '<div class="muted">靈寵 ' + fmtInt(rc.petReleased) + ' 只已放歸山林。</div>';
    if (rc.grants && rc.grants.length) {
      html += '<div style="margin-top:6px"><b>開局機緣</b>';
      rc.grants.forEach(function (g) { html += '<div class="xtc-news-li">' + esc(g) + '</div>'; });
      html += '</div>';
    }
    if (XG.ui.openGenderChoice) { closeModal(); XG.ui.openGenderChoice({ rebirthHtml: html }); return; }
    modal({ title: '飛昇成功 · 轉世輪迴', html: html, buttons: [{ text: '踏入新生', cls: 'btn-primary', cb: function () { closeModal(); } }] });
  }

  function doChallenge(el) {
    const rc = sys('reincarn');
    if (!rc) return;
    const st = el._rn;
    let ci = null;
    try { ci = rc.getChallengeInfo(); } catch (e) { ci = null; }
    if (!ci || !ci.canChallenge) { toast((ci && ci.reason) || '機緣未到。', 'err'); return; }
    const pillIds = [];
    for (const id in st.pillSel) {
      const q = st.pillSel[id] | 0;
      for (let i = 0; i < q; i++) pillIds.push(id);
    }
    let r = null;
    try { r = rc.startChallenge(pillIds); } catch (e) { r = null; }
    if (!r) { toast('天劫感應失敗。', 'err'); return; }
    if (!r.ok) { toast(r.msg || '無法引動天劫。', 'err'); return; }
    st.animating = true;
    playWaves(el, r);
  }

  function onReinClick(e) {
    const t = inRoot(e, 'reincarn');
    if (!t) return;
    const el = e.currentTarget;
    const act = t.getAttribute('data-act');
    const rc = sys('reincarn');
    if (!rc) return;
    const st = el._rn;
    if (st.animating && act !== 'rn-keep') return; // 動畫期間鎖定操作

    if (act === 'rn-up') {
      let r = null;
      try { r = rc.upgradeTalent(t.getAttribute('data-id')); } catch (err) { r = null; }
      if (!r) { toast('加點未成。', 'err'); return; }
      toast(r.msg, r.ok ? 'gold' : 'err');
      renderReincarn(el);
    } else if (act === 'rn-pill-plus' || act === 'rn-pill-minus') {
      const id = t.getAttribute('data-id');
      let maxP = 12;
      try { const ci = rc.getChallengeInfo(); if (ci && ci.maxPills) maxP = ci.maxPills; } catch (err) {}
      if (act === 'rn-pill-plus') {
        const ownMax = parseInt(t.getAttribute('data-max') || '0', 10) || 0;
        const q = st.pillSel[id] || 0;
        if (q >= ownMax) { toast('此丹存量不足。', 'err'); return; }
        if (pillSelCount(st) >= maxP) { toast('祭丹至多 ' + maxP + ' 顆。', 'err'); return; }
        st.pillSel[id] = q + 1;
      } else {
        const q = st.pillSel[id] || 0;
        if (q > 0) st.pillSel[id] = q - 1;
        if (!st.pillSel[id]) delete st.pillSel[id];
      }
      renderReinChallenge(el);
    } else if (act === 'rn-go') {
      confirmBox('引動天劫，九雷加身，成敗在此一舉。可要祭丹齊備？', function () { doChallenge(el); });
    } else if (act === 'rn-keep') {
      let k = null;
      try { k = rc.getKeepInfo(); } catch (err) { k = null; }
      if (!k) { toast('尚無法預覽。', 'err'); return; }
      let html = '<div class="xtc-kv"><span>靈玉保留</span><b>' + (k.lingYuKeepPct || 0) + '%</b></div>'
        + '<div class="xtc-kv"><span>此刻轉世可得 rp</span><b>+' + fmtInt(k.rpGain) + '</b></div>'
        + '<div class="xtc-kv"><span>境界累計 / 成就數</span><b>' + fmtInt(k.realmCount) + ' / ' + fmtInt(k.achCount) + '</b></div>'
        + '<div style="margin-top:6px"><b>轉世可保留</b>';
      (k.keep || []).forEach(function (s) { html += '<div class="xtc-news-li">' + esc(s) + '</div>'; });
      html += '</div><div style="margin-top:6px"><b>將被重置</b>';
      (k.reset || []).forEach(function (s) { html += '<div class="xtc-news-li">' + esc(s) + '</div>'; });
      html += '</div>';
      modal({ title: '保留與重置', html: html, buttons: [{ text: '知曉了', cls: 'btn-primary', cb: function () { closeModal(); } }] });
    }
  }

  const reinTab = {
    id: 'reincarn', name: '輪迴', icon: '☯️', order: 92, main: false, sysId: 'tribulation',
    mount(el) {
      injectStyle();
      el._rn = { pillSel: {}, animating: false, timers: [] };
      el.innerHTML = '<div class="tab-page xtc-page" data-xtc="reincarn">'
        + '<div data-r="rnhead"></div><div data-r="rntalent"></div><div data-r="rnchal"></div><div data-r="rnres"></div></div>';
      bindTab(this, el, onReinClick);
      renderReincarn(el);
    },
    update() {
      const el = this._el;
      if (!el || !el._rn) return;
      if (el._rn.animating) return; // 逐波動畫期間不重繪
      if (R(el, 'rnhead')) renderReincarn(el);
    },
    unmount(el) {
      if (el && el._rn) { clearTimers(el._rn); el._rn.animating = false; }
      unbindTab(this, el);
    },
  };

  /* ==================== 六、設置 tab ==================== */
  const SYS_LABEL = {
    gongfa: '功法', adventure: '奇遇', pets: '靈寵', fellows: '道友', cave: '洞府',
    expedition: '歷練派遣', alchemy: '煉丹', market: '坊市', forge: '煉器',
    dungeon_tower: '鎮妖塔', pvp: '論劍', petBreed: '靈寵繁殖', gongfaCreate: '自創功法',
    dungeon_guard: '守關', dungeon_hunt: '限時尋寶', hiddenMaps: '隱藏區域',
    tribulation: '渡劫', reincarn: '輪迴',
  };

  function unlockListHtml() {
    const u = (XG.cfg && XG.cfg.UNLOCKS) || {};
    let html = '';
    Object.keys(u).forEach(function (k) {
      const c = u[k] || {};
      let cond;
      if (c.days) cond = '創角 ' + c.days + ' 日';
      else {
        const r = XG.cfg && XG.cfg.REALMS && XG.cfg.REALMS[c.realmIdx];
        cond = (r ? r.name : '?') + ' ' + (c.layer || 1) + ' 層';
      }
      const ok = k === 'reincarn' ? XG.sys.reincarn.isOpen() : unlocked(k);
      if (k === 'reincarn') cond = '大乘 1 層可查看；10 層可挑戰';
      html += '<div class="xtc-kv"><span>' + (ok ? '🟢' : '⚪') + ' ' + esc(SYS_LABEL[k] || k) + '</span>'
        + '<span class="muted">' + esc(cond) + (ok ? '' : ' · 未解鎖') + '</span></div>';
    });
    return html;
  }

  function fillExport(el) {
    const ta = el.querySelector('[data-r="stexp"]');
    if (!ta) return;
    let s = '';
    try { s = XG.save && XG.save.export ? XG.save.export() : ''; } catch (e) { s = ''; }
    ta.value = s || '';
  }

  function copyText(text, ta) {
    function done(ok) { toast(ok ? '已複製到剪貼板。' : '複製失敗，請手動長按選擇複製。', ok ? undefined : 'err'); }
    function legacy() {
      try {
        if (ta) { ta.focus(); ta.select(); }
        document.execCommand('copy');
        done(true);
      } catch (e) { done(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
    } else legacy();
  }

  function renderSettings(el) {
    const body = R(el, 'body');
    if (!body) return;
    const p = (XG.state && XG.state.player) || {};
    const st = (XG.state && XG.state.settings) || {};
    let html = '<div class="card"><h3 class="card-title">✒️ 道號</h3>'
      + '<div class="row"><input class="xtc-io" style="flex:1" data-r="stname" maxlength="12" value="' + esc(p.name || '') + '" placeholder="請輸入新的道號">'
      + '<button class="btn btn-primary" data-act="st-rename">改名</button></div>'
      + '<div class="muted" style="margin-top:4px">傳聞中韓立、葉凡、王林、石昊、蕭炎等名諱，或藏一線天機……</div></div>';

    html += '<div class="card"><h3 class="card-title">💾 存檔</h3>'
      + '<div class="muted">導出（可抄寫轉移至他處）：</div>'
      + '<textarea class="xtc-io" rows="4" readonly data-r="stexp"></textarea>'
      + '<div class="row" style="margin:6px 0"><button class="btn btn-primary" data-act="st-export">生成/刷新導出</button>'
      + '<button class="btn btn-ghost" data-act="st-copy">複製</button></div>'
      + '<div class="muted">導入（粘貼存檔串，將覆蓋當前進度）：</div>'
      + '<textarea class="xtc-io" rows="3" data-r="stimp" placeholder="在此粘貼 base64 存檔串"></textarea>'
      + '<div class="row" style="margin-top:6px"><button class="btn btn-primary" data-act="st-import">導入存檔</button></div></div>';

    html += '<div class="card"><h3 class="card-title">📜 傳聞</h3>'
      + '<label class="row" style="cursor:pointer"><input type="checkbox" data-act="st-news"' + (st.newsCollapsed ? ' checked' : '') + '> 摺疊頂部傳聞滾動條</label></div>';

    html += '<div class="card"><h3 class="card-title">ℹ️ 關於</h3>'
      + '<div class="xtc-kv"><span>版本</span><b>摸魚修仙 Cute v1.9.2（存檔 ver ' + ((XG.state && XG.state.ver) || 1) + '）</b></div>'
      + '<div class="xtc-kv"><span>本世主角</span><b>' + genderBadge((XG.state.player || {}).gender) + ' ' + esc(XG.character.label((XG.state.player || {}).gender)) + '主角</b></div><div class="muted">成功輪回後可重新選擇性別。</div>'
      + '<div class="card-sub" style="margin:6px 0 4px">系統解鎖進度一覽</div>'
      + '<p class="cute-about">原作：shanawakiminouso-hub／xiuxian-idle，MIT 授權。可愛插畫與介面為本版新增。<a href="LICENSE" target="_blank">查看授權</a> · <a href="CUTE-README.md" target="_blank">遊戲說明</a></p><div data-r="stunlock">' + unlockListHtml() + '</div></div>';

    html += '<div class="card" style="border-color:var(--danger)"><h3 class="card-title" style="color:var(--danger)">⚠️ 危險操作</h3>'
      + '<button class="btn btn-danger" data-act="st-reset">重置存檔（重入輪迴）</button>'
      + '<div class="muted" style="margin-top:4px">將抹去全部修為、器物與機緣，不可挽回。</div></div>';

    body.innerHTML = html;
    fillExport(el);
  }

  function onSettingsClick(e) {
    const t = inRoot(e, 'settings');
    if (!t) return;
    const el = e.currentTarget;
    const act = t.getAttribute('data-act');

    if (act === 'st-rename') {
      const inp = el.querySelector('[data-r="stname"]');
      const v = ((inp && inp.value) || '').trim();
      if (!v) { toast('道號不可為空。', 'err'); return; }
      if (!XG.state || !XG.state.player) return;
      XG.state.player.name = v;
      try { XG.bus.emit('save:dirty'); XG.bus.emit('res:changed'); } catch (err) {}
      if (XG.ui && XG.ui.refreshTop) { try { XG.ui.refreshTop(); } catch (err) {} }
      const eggs = (XG.data && XG.data.names && XG.data.names.egg) || [];
      if (eggs.indexOf(v) >= 0) toast('此名諱似曾相識……似有玄機！', 'gold');
      else toast('已改道號為「' + v + '」。');
      if (inp) inp.value = v;
    } else if (act === 'st-export') {
      fillExport(el);
      toast('存檔串已生成。');
    } else if (act === 'st-copy') {
      const ta = el.querySelector('[data-r="stexp"]');
      const v = (ta && ta.value) || '';
      if (!v) { toast('請先生成導出串。', 'err'); return; }
      copyText(v, ta);
    } else if (act === 'st-import') {
      const ta = el.querySelector('[data-r="stimp"]');
      const v = ((ta && ta.value) || '').trim();
      if (!v) { toast('請先粘貼存檔串。', 'err'); return; }
      confirmBox('導入將覆蓋當前全部進度，確定導入？', function () {
        let r = null;
        try { r = XG.save.import(v); } catch (err) { r = { ok: false, err: '導入異常' }; }
        if (r && r.ok) {
          toast('導入成功，正在重開……', 'gold');
          setTimeout(function () { try { location.reload(); } catch (err) {} }, 900);
        } else {
          toast((r && r.err) || '導入失敗。', 'err');
        }
      });
    } else if (act === 'st-news') {
      const on = !!t.checked;
      XG.state.settings = XG.state.settings || {};
      XG.state.settings.newsCollapsed = on;
      try { XG.bus.emit('save:dirty'); } catch (err) {}
      try {
        const tk = document.getElementById('news-ticker');
        if (tk) tk.classList.toggle('collapsed', on);
      } catch (err) {}
      toast(on ? '傳聞條已摺疊。' : '傳聞條已展開。');
    } else if (act === 'st-reset') {
      confirmBox('確定要重置存檔？全部修為與機緣將煙消雲散。', function () {
        confirmBox('此操作不可挽回！真要重入輪迴？', function () {
          try { XG.save.reset(); } catch (err) {}
          toast('存檔已重置，正在重開……');
          setTimeout(function () { try { location.reload(); } catch (err) {} }, 900);
        });
      });
    }
  }

  const setTab = {
    id: 'settings', name: '設置', icon: '⚙️', order: 99, main: false,
    mount(el) {
      injectStyle();
      el.innerHTML = '<div class="tab-page xtc-page" data-xtc="settings"><div data-r="body"></div></div>';
      bindTab(this, el, onSettingsClick);
      renderSettings(el);
    },
    update() {
      const el = this._el;
      if (!el) return;
      // 輸入中不重繪任何區域（守則 3）
      const ae = document.activeElement;
      if (ae && el.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      const box = el.querySelector('[data-r="stunlock"]');
      if (box) box.innerHTML = unlockListHtml(); // 僅刷新解鎖一覽
    },
    unmount(el) { unbindTab(this, el); },
  };

  /* ==================== 註冊 ==================== */
  reg(fellowTab);
  reg(marketTab);
  reg(codexTab);
  reg(achTab);
  reg(reinTab);
  reg(setTab);
})();
