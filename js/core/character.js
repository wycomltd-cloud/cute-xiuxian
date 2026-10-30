/* character.js：本世主角性別與舊存檔補齊；只管理性別，不改角色進度。 */
(function () {
  'use strict';
  const XG = window.XG = window.XG || {};
  function valid(g) { return g === 'male' || g === 'female'; }
  function symbol(g) { return g === 'male' ? '♂' : g === 'female' ? '♀' : ''; }
  function label(g) { return g === 'male' ? '男' : g === 'female' ? '女' : '未選擇'; }
  function opposite(a, b) { return valid(a) && valid(b) && a !== b; }
  // 舊 NPC 用穩定雜湊補上性別，重新整理不會重新抽選。
  function legacyGender(f) {
    let hash = 2166136261;
    if (XG.data && XG.data.names && XG.data.names.egg.indexOf(f.name) >= 0) return 'male';
    const key = String(f.uid || f.name || 'fellow');
    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    return (hash >>> 0) % 2 ? 'female' : 'male';
  }
  function normalize() {
    const st = XG.state;
    if (!st || !st.player) return;
    const p = st.player;
    if (!valid(p.gender)) p.gender = null;
    for (const f of st.fellows || []) {
      if (!f || typeof f !== 'object') continue;
      if (!valid(f.gender)) {
        // 原版沒有性別：保留既有道侶，待首次選擇時配成相反性別。
        if (p.partner === f.uid && f.relation === 'partner') {
          if (valid(p.gender)) f.gender = p.gender === 'male' ? 'female' : 'male';
          else f.legacyPartnerGender = true;
        }
        if (!valid(f.gender)) f.gender = legacyGender(f);
      }
    }
  }
  function choose(gender) {
    if (!valid(gender)) return { ok: false, msg: '請選擇男主角或女主角。' };
    const p = XG.state.player;
    if (valid(p.gender)) return { ok: false, msg: '這一世已選好性別，成功輪回後可以重新選擇。' };
    p.gender = gender;
    for (const f of XG.state.fellows || []) {
      if (!f || typeof f !== 'object') continue;
      if (f.legacyPartnerGender && f.uid === p.partner && f.relation === 'partner') f.gender = gender === 'male' ? 'female' : 'male';
      delete f.legacyPartnerGender;
    }
    XG.bus.emit('character:chosen', { gender: gender, life: p.reincarn || 0 });
    XG.bus.emit('res:changed'); XG.bus.emit('save:dirty');
    if (XG.save) XG.save.save();
    return { ok: true, gender: gender };
  }
  XG.character = { valid: valid, symbol: symbol, label: label, opposite: opposite, legacyGender: legacyGender, normalize: normalize, choose: choose,
    needsChoice: function () { return !XG.state || !XG.state.player || !valid(XG.state.player.gender); } };
})();
