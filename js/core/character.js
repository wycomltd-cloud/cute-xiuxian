/* character.js：本世主角性別與舊存檔補齊；管理本世性別與修行流派，不改養成進度。 */
(function () {
  'use strict';
  const XG = window.XG = window.XG || {};
  const schools = [{id:'jian',name:'劍修',icon:'⚔️'}, {id:'fu',name:'符修',icon:'📜'}, {id:'zhen',name:'陣修',icon:'🔮'}, {id:'dan',name:'丹修',icon:'🫖'}, {id:'ti',name:'體修',icon:'💪'}];
  function validSchool(id) { return schools.some(function (s) { return s.id === id; }); }
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
    if (!validSchool(p.school)) p.school = null; // 舊檔需自行補選，不沿用可隨時改的舊論劍流派。
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
  function choose(gender, school) {
    if (!valid(gender)) return { ok: false, msg: '請選擇男主角或女主角。' };
    const p = XG.state.player;
    if (valid(p.gender) && validSchool(p.school)) return { ok: false, msg: '這一世已選好主角與修行，成功輪回後可以重新選擇。' };
    if (valid(p.gender) && p.gender !== gender) return { ok: false, msg: '本世性別已選定，只需補選修行。' };
    if (!validSchool(school)) return { ok: false, msg: '請選擇劍、符、陣、丹或體其中一修。' };
    if (validSchool(p.school) && p.school !== school) return { ok: false, msg: '本世修行已選定，成功輪回後才能更換。' };
    p.school = school;
    p.gender = gender;
    for (const f of XG.state.fellows || []) {
      if (!f || typeof f !== 'object') continue;
      if (f.legacyPartnerGender && f.uid === p.partner && f.relation === 'partner') f.gender = gender === 'male' ? 'female' : 'male';
      delete f.legacyPartnerGender;
    }
    XG.bus.emit('character:chosen', { gender: gender, school: school, life: p.reincarn || 0 });
    XG.bus.emit('res:changed'); XG.bus.emit('save:dirty');
    if (XG.save) XG.save.save();
    return { ok: true, gender: gender, school: school };
  }
  XG.character = { schools: schools, validSchool: validSchool, valid: valid, symbol: symbol, label: label, opposite: opposite, legacyGender: legacyGender, normalize: normalize, choose: choose,
    needsChoice: function () { return !XG.state || !XG.state.player || (!valid(XG.state.player.gender) || !validSchool(XG.state.player.school)); } };
})();
