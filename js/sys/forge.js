/* forge.js：煉器系統 —— 打造 / 強化 / 洗練 / 鑲嵌（寶石三合一）/ 升星 / 套裝 / 器靈
 *
 * ============================ UI 對接面（js/ui 唯一接口依據） ============================
 * 說明：所有「操作類」接口統一返回 { ok:true, ... } 或 { ok:false, err:'失敗原因文案' }；
 *       所有「查詢類」接口純讀取、無副作用。裝備實例結構見「裝備實例 Schema」。
 *
 * ---- 裝備實例 Schema（存於 XG.state.equips.list，slots 存 uid 引用） ----
 * { uid, baseId, grade, slot, affixes:[{id,kind,val,locked}], enh, enhFails,
 *   star, gems:[gemInstId|null, gemInstId|null], spirit:null|{name,persona,lv,exp,skills:[{id,lv}]} }
 *
 * ---- 查詢接口 ----
 * getBaseInfo(baseId)        → data 底材對象 {id,name,icon,slot,grade,base,desc} | null
 * getEquip(uid)              → 裝備實例 | null
 * getInv()                   → 揹包（未裝備）裝備實例數組
 * getEquipped()              → { weapon:實例|null, head:…, body:…, boots:…, ring:…, talisman:… }
 * getCraftList()             → 可打造底材列表 [{base, cost, can, err}]（隱藏底材不出現在此列表）
 * craftCost(baseId)          → { lingShi, mat:{ore_*:n} } | null
 * getEquipDetail(uid)        → 裝備全量視圖 { uid, baseId, name, icon, slot, grade, gradeName, hidden,
 *                                enh, enhFails, star, affixes:[{id,name,kind,kindName,val,locked}],
 *                                gems:[gemInstId|null], gemView:[{instId,name,icon,lv,eff}|null],
 *                                spirit, setId, setName, equipped, flat:{atk,def,hp},
 *                                totalAffixPct:{修飾鍵:合計%}, power } | null
 * disposalInfo(uid)        → 回爐材料、寶石、坊市靈玉基準價與60%售價、道友買家、阻擋原因
 * enhanceInfo(uid)           → { lv, max, cost, rate, doubled, pity, pityMax } | null
 * reforgeCost(uid)           → { base, perLock, locked, total } | null（total=本次洗練靈玉總價）
 * starInfo(uid)              → { star, max, cost, needDup, dupCandidates:[uid…] } | null
 * getGemBag()                → 揹包寶石列表 [{instId, gemId, lv, name, icon, eff, count, canMerge, mergeCost}]
 * getSetInfo()               → 套裝檢測 [{id, name, icon, count, eff2on, eff4on, eff2, eff4, desc}]
 * spiritInfo(uid)            → { spirit, personaDef, skillView:[{id,name,icon,lv,eff,desc}],
 *                                expNeed, feedable:[uid…], canWake } | null
 * canWakeSpirit(uid)         → { ok, err }
 * enhRate(lv)                → 當前等級強化成功率（0~1）
 * getMods()                  → §7 flat 加成對象（本系統全部裝備/套裝/器靈加成彙總）
 *
 * ---- 操作接口（ok/err 結構；成功均自動寫存檔標記 + 刷新屬性緩存） ----
 * craft(baseId)              → { ok, uid, equip } 打造指定底材（耗 ore_* + 靈石）
 * equip(uid)                 → { ok, swapped } 穿上（同槽舊件自動回背包）
 * unequip(slot)              → { ok } 卸下指定槽位
 * recycle(uid)             → { ok, reward, name } 回爐未穿戴裝備，返還50%原始材料與寶石
 * sell(uid)                → { ok, reward, buyerName, name } 出售未穿戴裝備，獲60%基準靈玉與寶石
 * enhance(uid)               → { ok, success, lv, rate, pity } 強化一次（失敗不掉級）
 * reforge(uid, affixIdx)     → { ok, affix } 重 roll 單條詞條（鎖定的詞條每條加價，且不可被洗）
 * toggleLock(uid, affixIdx)  → { ok, locked } 切換詞條鎖定（免費）
 * inlay(uid, slotIdx, gemInstId) → { ok } 鑲嵌（slotIdx 0|1，消耗揹包寶石 1 枚）
 * removeGem(uid, slotIdx)    → { ok, gemInstId } 卸下寶石（不損，返還揹包）
 * mergeGem(gemId, lv)        → { ok, to } 寶石 3 合 1 升階（lv1~4 → lv+1，耗靈石）
 * starUp(uid, dupUid?)       → { ok, star } 升星（5 星起需吞同名底材，dupUid 缺省自動選首件候選）
 * wakeSpirit(uid)            → { ok, spirit } 孕育器靈（grade4 且 +15，耗靈玉）
 * feedSpirit(uid, fodderUid) → { ok, lv, learned } 餵食同名裝備升級器靈
 *
 * ============================ 寫入的統計鍵（XG.state.stats，snake_case） ============================
 * forge_make     累計打造裝備件數   ← 成就 check.k = forgeMake
 * equip_enh_max  單件裝備最高強化等級 ← 成就 check.k = equipEnhMax
 * equip_god      當前持有神品(grade4)件數 ← 成就 check.k = equipGod（list 變動時重算）
 * forge_enh      強化嘗試次數       forge_reforge  洗練次數
 * forge_gem_merge 寶石合成次數      forge_star     升星次數
 * spirit_wake    器靈喚醒次數       spirit_feed    器靈餵食次數
 *
 * ============================ emit 事件 ============================
 * forge:done  {uid, grade}            打造成功（契約約定事件）
 * equip:gain  {uid, baseId, grade, via} 任何裝備入手（createEquip/makeDrop/craft 統一出口，via: create|drop|craft）
 * news        傳聞（神兵出世/歐氣沖天/器靈覺醒/+20 等，自行 push 進 state.news 並截斷）
 *
 * ============================ offline 行為 ============================
 * 煉器無時間型產出，offline(dt) 返回 null（不參與離線結算）。
 * ============================================================================
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  /* ==================== 內部常量 ==================== */
  const SLOTS = ['weapon', 'head', 'body', 'boots', 'ring', 'talisman'];
  const GEM_SLOTS = 2;        // 每件裝備鑲嵌槽數
  const ENH_DOUBLE_LV = 15;   // 強化 +15 起每次消耗翻倍
  const ENH_PITY = 3;         // +15 後連續失敗 3 次，下次必定成功（保底次數）
  const SPIRIT_MAX_LV = 30;   // 器靈等級上限
  const FEED_EXP = 1000;      // 餵食一件同名裝備獲得的經驗
  const GRADE_NAME = ['凡品', '靈品', '寶品', '仙品', '神品'];

  // 詞條 kind → XG.stats 修飾鍵映射（契約 §7 與 data/equips.js 頭部註釋一致）
  const KIND_KEY = {
    atk: 'atkPct', def: 'defPct', hp: 'hpPct',
    crit: 'critPct', spd: 'spdPct', drop: 'dropPct',
    cult: 'cultRatePct', work: 'workPct', alch: 'alchSuccPct',
  };
  const KIND_NAME = {
    atk: '攻擊', def: '防禦', hp: '氣血', crit: '暴擊', spd: '速度',
    drop: '掉落', cult: '修煉', work: '打工', alch: '煉丹',
  };

  /* ==================== 內部小工具 ==================== */
  function D() { return XG.data.equips || { bases: [], affixes: [], sets: [], gems: [], spirits: { personas: [], skills: [] }, formula: {} }; }
  function equ() {
    const s = XG.state;
    s.equips = s.equips || { list: [], slots: {} };
    s.equips.list = s.equips.list || [];
    s.equips.slots = s.equips.slots || {};
    return s.equips;
  }
  function baseOf(baseId) {
    const bs = D().bases || [];
    for (const b of bs) if (b.id === baseId) return b;
    return null;
  }
  function affixDef(id) {
    const as = D().affixes || [];
    for (const a of as) if (a.id === id) return a;
    return null;
  }
  function gemDef(gemId) {
    const gs = D().gems || [];
    for (const g of gs) if (g.id === gemId) return g;
    return null;
  }
  // 寶石實例 id = `${gemId}_${lv}`（gemId 本身含下劃線，按最後一個下劃線拆分）
  function parseGemInst(instId) {
    if (!instId || typeof instId !== 'string') return null;
    const i = instId.lastIndexOf('_');
    if (i < 0) return null;
    const def = gemDef(instId.slice(0, i));
    const lv = parseInt(instId.slice(i + 1), 10);
    if (!def || !(lv >= 1 && lv <= (def.lv || 5))) return null;
    return { def: def, lv: lv };
  }
  // 各品階對應礦石（取自 data 公式內部用礦，避免在 sys 重複登記數據）
  function oreOfGrade(grade) {
    const c = D().formula.enhanceCost(0, grade || 0);
    const ids = Object.keys(c.mat || {});
    return ids[0] || 'ore_jingtie';
  }
  function getEquip(uid) {
    const ls = equ().list;
    for (const e of ls) if (e.uid === uid) return e;
    return null;
  }
  function isEquipped(uid) {
    const sl = equ().slots;
    for (const k in sl) if (sl[k] === uid) return true;
    return false;
  }
  function removeItem(uid) {
    const e = equ();
    const i = e.list.findIndex(function (x) { return x.uid === uid; });
    if (i >= 0) e.list.splice(i, 1);
    for (const k in e.slots) if (e.slots[k] === uid) e.slots[k] = null;
  }
  function statAdd(k, n) {
    const s = (XG.state.stats = XG.state.stats || {});
    s[k] = (s[k] || 0) + n;
  }
  function statMax(k, v) {
    const s = (XG.state.stats = XG.state.stats || {});
    if ((s[k] || 0) < v) s[k] = v;
  }
  // 神品件數 / 最高強化 重算（list 變動後調用）
  function recount() {
    const s = (XG.state.stats = XG.state.stats || {});
    let god = 0, enhMax = 0;
    for (const e of equ().list) {
      if (e.grade >= 4) god++;
      if ((e.enh || 0) > enhMax) enhMax = e.enh;
    }
    s.equip_god = god;
    s.equip_enh_max = Math.max(s.equip_enh_max || 0, enhMax);
  }
  function invalidate() { if (XG.stats) XG.stats.invalidate(); }
  function dirty() { XG.bus.emit('save:dirty'); }
  // 傳聞助手：unshift 入 state.news 並按上限截斷，同時 emit
  function pushNews(text, cat, imp) {
    const n = { t: Date.now(), cat: cat || 'system', text: text, imp: imp == null ? 0 : imp };
    const s = XG.state;
    s.news = s.news || [];
    s.news.unshift(n);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (s.news.length > cap) s.news.length = cap;
    XG.bus.emit('news', n);
  }
  function negCost(cost) {
    const d = {};
    if (cost.lingShi) d.lingShi = -cost.lingShi;
    if (cost.lingYu) d.lingYu = -cost.lingYu;
    if (cost.mat) { d.mat = {}; for (const id in cost.mat) d.mat[id] = -cost.mat[id]; }
    return d;
  }
  function scaleCost(cost, mult) {
    const c = { lingShi: Math.floor((cost.lingShi || 0) * mult), mat: {} };
    for (const id in (cost.mat || {})) c.mat[id] = Math.ceil(cost.mat[id] * mult);
    return c;
  }

  /* ==================== 詞條 roll ==================== */
  // 各品階詞條數（data 註釋口徑）：g0→1，g1→1~2，g2→2，g3→3，g4→4
  function affixCount(grade) {
    if (grade <= 0) return 1;
    if (grade === 1) return XG.util.randInt(1, 2);
    return Math.min(4, grade);
  }
  function mkAffix(def) {
    let val = XG.util.rand(def.min, def.max);
    // 隱藏彩蛋：2%「天工」直接滿值
    if (XG.util.chance(0.02)) val = def.max;
    return { id: def.id, kind: def.kind, val: Math.round(val * 10) / 10, locked: false };
  }
  // 從候選池按權重抽 count 條詞條，kind 不重複；excludeKinds 為需排除的 kind
  function rollAffixes(grade, count, excludeKinds) {
    const used = (excludeKinds || []).slice();
    const out = [];
    for (let i = 0; i < count; i++) {
      const cand = (D().affixes || []).filter(function (a) {
        return a.grades && a.grades.indexOf(grade) >= 0 && used.indexOf(a.kind) < 0;
      });
      if (!cand.length) break;
      const a = XG.util.weighted(cand);
      used.push(a.kind);
      out.push(mkAffix(a));
    }
    return out;
  }

  /* ==================== 裝備生成（全項目通用） ==================== */
  // createEquip(baseId, grade?)：按底材+品階 roll 詞條生成裝備實例併入揹包；底材不存在返回 null
  function createEquip(baseId, grade) {
    const b = baseOf(baseId);
    if (!b) return null;
    grade = grade == null ? b.grade : XG.util.clamp(grade | 0, 0, 4);
    const eq = {
      uid: XG.util.uid(),
      baseId: baseId,
      grade: grade,
      slot: b.slot,
      affixes: rollAffixes(grade, affixCount(grade), []),
      enh: 0,
      enhFails: 0,
      star: 0,
      gems: [null, null],
      spirit: null,
    };
    equ().list.push(eq);
    recount();
    XG.bus.emit('equip:gain', { uid: eq.uid, baseId: baseId, grade: grade, via: 'create' });
    dirty();
    return eq;
  }

  // makeDrop(targetGrade, opts?)：按權重隨機選底材並生成裝備（供爬塔/歷練等掉落調用）
  // opts.includeHidden=true 時纔可能出隱藏底材（歸墟/龍淵/半頁天書，留給隱藏地圖）；
  // 目標品階無候選時返回 null（調用方自行降級處理）。
  // 隱藏彩蛋：1%「歐氣沖天」品階 +1（不超過 4）。
  function makeDrop(targetGrade, opts) {
    opts = opts || {};
    const setPiece = {};
    (D().sets || []).forEach(function (s) { s.pieces.forEach(function (p) { setPiece[p] = 1; }); });
    let grade = targetGrade | 0;
    let cand = (D().bases || []).filter(function (b) {
      return b.grade === grade && (opts.includeHidden || !b.hidden);
    });
    // 歐氣彩蛋：升一品重抽（同樣遵守 hidden 過濾）
    let lucky = false;
    if (grade < 4 && XG.util.chance(0.01)) {
      const up = (D().bases || []).filter(function (b) {
        return b.grade === grade + 1 && (opts.includeHidden || !b.hidden);
      });
      if (up.length) { grade++; cand = up; lucky = true; }
    }
    if (!cand.length) return null;
    const pool = cand.map(function (b) { return { b: b, w: setPiece[b.id] ? 55 : 100 }; }); // 套裝件略稀有
    const picked = XG.util.weighted(pool).b;
    const eq = createEquip(picked.id, grade);
    if (eq) {
      XG.bus.emit('equip:gain', { uid: eq.uid, baseId: picked.id, grade: grade, via: 'drop' });
      if (lucky) pushNews('歐氣沖天！' + XG.state.player.name + ' 獲得 ' + GRADE_NAME[grade] + '「' + picked.name + '」，氣運之盛令人側目。', 'player', 1);
    }
    return eq;
  }

  /* ==================== 打造 ==================== */
  // 打造配方：靈石 300×6^grade + 對應品階礦石 (8+6×grade)（隱藏底材不可打造）
  function craftCost(baseId) {
    const b = baseOf(baseId);
    if (!b) return null;
    const cost = { lingShi: Math.floor(300 * Math.pow(6, b.grade)), mat: {} };
    cost.mat[oreOfGrade(b.grade)] = 8 + b.grade * 6;
    return cost;
  }
  function craftErr(baseId) {
    const b = baseOf(baseId);
    if (!b) return '底材不存在';
    if (b.hidden) return '「' + b.name + '」乃秘境機緣之物，非凡火可鑄';
    if (!XG.hasRes(craftCost(baseId))) return '材料或靈石不足';
    return null;
  }
  function craft(baseId) {
    const err = craftErr(baseId);
    if (err) return { ok: false, err: err };
    const b = baseOf(baseId);
    XG.addRes(negCost(craftCost(baseId)));
    const eq = createEquip(baseId, b.grade);
    statAdd('forge_make', 1);
    XG.bus.emit('forge:done', { uid: eq.uid, grade: eq.grade });
    XG.bus.emit('equip:gain', { uid: eq.uid, baseId: baseId, grade: eq.grade, via: 'craft' });
    if (eq.grade >= 4) {
      pushNews('神兵出世！' + XG.state.player.name + ' 親手鑄就神品「' + b.name + '」，霞光沖霄，百里可見。', 'player', 1);
    } else if (eq.grade >= 3) {
      pushNews(XG.state.player.name + ' 鑄就仙品「' + b.name + '」，爐火純青，技藝大進。', 'player', 0);
    }
    return { ok: true, uid: eq.uid, equip: eq };
  }
  function getCraftList() {
    const out = [];
    for (const b of (D().bases || [])) {
      if (b.hidden) continue;
      const cost = craftCost(b.id);
      const err = craftErr(b.id);
      out.push({ base: b, cost: cost, can: !err, err: err });
    }
    return out;
  }

  /* ==================== 回爐 / 出售（僅揹包裝備） ==================== */
  function disposalInfo(uid) {
    const eq = getEquip(uid);
    if (!eq) return null;
    const cost = craftCost(eq.baseId);
    if (!cost) return null;
    const mat = {};
    // 原始打造配方的材料返還一半；靈石與後續強化、升星投入不在返還範圍。
    for (const id in cost.mat) {
      const n = Math.floor(cost.mat[id] * 0.5);
      if (n > 0) mat[id] = n;
    }
    const gems = {};
    (eq.gems || []).forEach(function (id) {
      if (parseGemInst(id)) gems[id] = (gems[id] || 0) + 1;
    });
    const mr = XG.data.world && XG.data.world.marketRules;
    const bp = mr && mr.stock && mr.stock.basePrice;
    // 與坊市同一基準與靈石→靈玉換算；不採隨機賣家的浮動報價。
    const marketLingYu = XG.balance.equipYu(eq.grade);
    const buyer = (XG.state.fellows || []).find(function (f) { return f.alive; });
    const err = isEquipped(uid) ? '這件還穿在身上，請先卸下再處理。' : null;
    return { mat: mat, gems: gems, marketLingYu: marketLingYu,
      lingYu: Math.floor(marketLingYu * 0.6), buyerName: buyer ? buyer.name : null,
      recycleErr: err, sellErr: err || (!buyer ? '暫時沒有道友可收購，稍後再來。' : null) };
  }
  function dispose(uid, kind) {
    const info = disposalInfo(uid);
    if (!info) return { ok: false, err: '裝備已不在揹包，不能重複領取收益。' };
    const err = kind === 'recycle' ? info.recycleErr : info.sellErr;
    if (err) return { ok: false, err: err };
    const eq = getEquip(uid), b = baseOf(eq.baseId);
    const reward = kind === 'recycle' ? { mat: Object.assign({}, info.mat) } : { lingYu: info.lingYu, mat: {} };
    for (const id in info.gems) reward.mat[id] = (reward.mat[id] || 0) + info.gems[id];
    // 先移除實例，再發資源；舊詳情或重複點擊都不能重複結算。
    removeItem(uid);
    recount();
    invalidate();
    XG.addRes(reward);
    dirty();
    return { ok: true, reward: reward, buyerName: info.buyerName, name: b.name };
  }
  function recycle(uid) { return dispose(uid, 'recycle'); }
  function sell(uid) { return dispose(uid, 'sell'); }

  /* ==================== 穿脫 ==================== */
  function equip(uid) {
    const eq = getEquip(uid);
    if (!eq) return { ok: false, err: '裝備不存在' };
    const sl = equ().slots;
    const old = sl[eq.slot] || null;
    if (old === uid) return { ok: false, err: '已穿戴中' };
    sl[eq.slot] = uid;
    invalidate();
    dirty();
    return { ok: true, swapped: old };
  }
  function unequip(slot) {
    const sl = equ().slots;
    if (SLOTS.indexOf(slot) < 0) return { ok: false, err: '部位不存在' };
    if (!sl[slot]) return { ok: false, err: '該部位本就空着' };
    sl[slot] = null;
    invalidate();
    dirty();
    return { ok: true };
  }

  /* ==================== 強化（+1..+20） ==================== */
  // 成功率隨等級遞減：1 - 4.5%×lv，下限 20%
  function enhRate(lv) {
    return XG.util.clamp(1 - 0.045 * (lv || 0), 0.2, 1);
  }
  function enhanceInfo(uid) {
    const eq = getEquip(uid);
    if (!eq) return null;
    const F = D().formula;
    const lv = eq.enh || 0;
    let cost = F.enhanceCost(lv, eq.grade);
    const doubled = lv >= ENH_DOUBLE_LV;
    if (doubled) cost = scaleCost(cost, 2); // +15 後消耗翻倍
    return { lv: lv, max: F.maxEnh || 20, cost: cost, rate: enhRate(lv), doubled: doubled, pity: eq.enhFails || 0, pityMax: ENH_PITY };
  }
  function enhance(uid) {
    const eq = getEquip(uid);
    if (!eq) return { ok: false, err: '裝備不存在' };
    const F = D().formula;
    const lv = eq.enh || 0;
    if (lv >= (F.maxEnh || 20)) return { ok: false, err: '已臻化境，強化已達上限 +20' };
    const info = enhanceInfo(uid);
    if (!XG.hasRes(info.cost)) return { ok: false, err: '靈石或礦石不足' };
    XG.addRes(negCost(info.cost));
    statAdd('forge_enh', 1);
    // 保底：+15 後連續失敗滿 3 次，本次必成
    const guaranteed = info.doubled && (eq.enhFails || 0) >= ENH_PITY;
    const success = guaranteed || XG.util.chance(info.rate);
    const b = baseOf(eq.baseId);
    if (success) {
      eq.enh = lv + 1;
      eq.enhFails = 0;
      statMax('equip_enh_max', eq.enh);
      let msg = '強化成功，「' + b.name + '」+' + eq.enh + '！';
      if (eq.enh === (F.maxEnh || 20)) {
        msg = '鬼斧神工！「' + b.name + '」強化至 +20 圓滿！';
        pushNews(XG.state.player.name + ' 將「' + b.name + '」強化至 +20 大圓滿，匠道造詣驚動四方。', 'player', 1);
      } else if (eq.enh === 15 && eq.grade >= 4 && !eq.spirit) {
        pushNews('「' + b.name + '」強化至 +15，器身輕顫，隱有靈智胎動之象。（可孕育器靈）', 'system', 0);
      }
      invalidate();
      dirty();
      return { ok: true, success: true, lv: eq.enh, rate: info.rate, pity: 0, msg: msg };
    }
    // 失敗不掉級；+15 後累計保底次數
    if (info.doubled) eq.enhFails = (eq.enhFails || 0) + 1;
    dirty();
    return { ok: true, success: false, lv: eq.enh, rate: info.rate, pity: eq.enhFails || 0, msg: '強化失敗，爐火一滯，所幸器物無損。（不掉級）' };
  }

  // 連續強化 n 次：滿級/材料不足即停；返回成功次數與最終等級
  function enhanceTimes(uid, n) {
    n = Math.max(1, Math.min(20, n | 0));
    let done = 0, wins = 0, last = null;
    for (let i = 0; i < n; i++) {
      const r = enhance(uid);
      if (!r || !r.ok) { last = r; break; }
      done++;
      if (r.success) wins++;
      last = r;
      const eq = getEquip(uid);
      if (eq && (eq.enh || 0) >= 20) break;
    }
    const eq = getEquip(uid);
    const lv = eq ? (eq.enh || 0) : 0;
    if (!done) return { ok: false, err: (last && (last.err || last.msg)) || '無法強化' };
    return {
      ok: true, times: done, wins: wins, lv: lv,
      msg: '連錘 ' + done + ' 次，成 ' + wins + ' 次，「' + (eq ? baseOf(eq.baseId).name : '裝備') + '」現 +' + lv + '。',
    };
  }

  /* ==================== 洗練（重 roll 單條詞條） ==================== */
  // 費用：基礎 (2+2×grade) 靈玉 + 每條已鎖定詞條加收 (1+grade)
  function reforgeCost(uid) {
    const eq = getEquip(uid);
    if (!eq) return null;
    const base = 2 + eq.grade * 2;
    const perLock = 1 + eq.grade;
    let locked = 0;
    for (const a of eq.affixes) if (a.locked) locked++;
    return { base: base, perLock: perLock, locked: locked, total: base + perLock * locked };
  }
  function toggleLock(uid, affixIdx) {
    const eq = getEquip(uid);
    if (!eq || !eq.affixes[affixIdx]) return { ok: false, err: '詞條不存在' };
    eq.affixes[affixIdx].locked = !eq.affixes[affixIdx].locked;
    dirty();
    return { ok: true, locked: eq.affixes[affixIdx].locked };
  }
  function reforge(uid, affixIdx) {
    const eq = getEquip(uid);
    if (!eq) return { ok: false, err: '裝備不存在' };
    const cur = eq.affixes[affixIdx];
    if (!cur) return { ok: false, err: '詞條不存在' };
    if (cur.locked) return { ok: false, err: '該詞條已鎖定，先解鎖方可洗練' };
    const c = reforgeCost(uid);
    if ((XG.state.res.lingYu || 0) < c.total) return { ok: false, err: '靈玉不足（需 ' + c.total + '）' };
    XG.addRes({ lingYu: -c.total });
    // 新詞條：排除其他詞條的 kind（允許同 id 重 roll 數值）
    const otherKinds = eq.affixes.filter(function (a, i) { return i !== affixIdx; }).map(function (a) { return a.kind; });
    const cand = (D().affixes || []).filter(function (a) {
      return a.grades && a.grades.indexOf(eq.grade) >= 0 && otherKinds.indexOf(a.kind) < 0;
    });
    if (!cand.length) return { ok: false, err: '無可洗詞條（詞條庫不足）' };
    const picked = XG.util.weighted(cand);
    const na = mkAffix(picked);
    eq.affixes[affixIdx] = na;
    statAdd('forge_reforge', 1);
    invalidate();
    dirty();
    return { ok: true, affix: na };
  }

  /* ==================== 鑲嵌 / 寶石三合一 ==================== */
  function inlay(uid, slotIdx, gemInstId) {
    const eq = getEquip(uid);
    if (!eq) return { ok: false, err: '裝備不存在' };
    if (!(slotIdx >= 0 && slotIdx < GEM_SLOTS)) return { ok: false, err: '鑲槽不存在' };
    if (eq.gems[slotIdx]) return { ok: false, err: '該鑲槽已有寶石，先卸下' };
    const g = parseGemInst(gemInstId);
    if (!g) return { ok: false, err: '寶石不存在' };
    if ((XG.state.inv.mat[gemInstId] || 0) < 1) return { ok: false, err: '揹包中沒有這枚寶石' };
    XG.addRes({ mat: { [gemInstId]: -1 } });
    eq.gems[slotIdx] = gemInstId;
    invalidate();
    dirty();
    return { ok: true };
  }
  function removeGem(uid, slotIdx) {
    const eq = getEquip(uid);
    if (!eq) return { ok: false, err: '裝備不存在' };
    const inst = eq.gems[slotIdx];
    if (!inst) return { ok: false, err: '該鑲槽是空的' };
    eq.gems[slotIdx] = null;
    XG.addRes({ mat: { [inst]: 1 } }); // 卸下不損，返還揹包
    invalidate();
    dirty();
    return { ok: true, gemInstId: inst };
  }
  // 3 枚同級 + 靈石 → 1 枚高一級（lv5 封頂）
  function mergeGem(gemId, lv) {
    const def = gemDef(gemId);
    if (!def) return { ok: false, err: '寶石不存在' };
    lv = lv | 0;
    if (!(lv >= 1 && lv < (def.lv || 5))) return { ok: false, err: '已達五階上限，不可再合' };
    const instId = gemId + '_' + lv;
    const need = (def.cost && def.cost.merge) || 3;
    if ((XG.state.inv.mat[instId] || 0) < need) return { ok: false, err: def.name + '·' + lv + '階不足 ' + need + ' 枚' };
    const lingShi = (def.cost && def.cost.lingShi && def.cost.lingShi[lv]) || 0;
    if ((XG.state.res.lingShi || 0) < lingShi) return { ok: false, err: '靈石不足' };
    const delta = { lingShi: -lingShi, mat: { [instId]: -need } };
    delta.mat[gemId + '_' + (lv + 1)] = 1;
    XG.addRes(delta);
    statAdd('forge_gem_merge', 1);
    return { ok: true, to: gemId + '_' + (lv + 1) };
  }
  // 揹包寶石清單（供鑲嵌/合成界面）
  function getGemBag() {
    const out = [];
    const bag = XG.state.inv.mat || {};
    for (const instId in bag) {
      const g = parseGemInst(instId);
      if (!g) continue;
      const need = (g.def.cost && g.def.cost.merge) || 3;
      const canMerge = g.lv < (g.def.lv || 5) && bag[instId] >= need &&
        (XG.state.res.lingShi || 0) >= ((g.def.cost && g.def.cost.lingShi && g.def.cost.lingShi[g.lv]) || 0);
      out.push({
        instId: instId, gemId: g.def.id, lv: g.lv, name: g.def.name, icon: g.def.icon,
        eff: g.def.eff, count: bag[instId], canMerge: canMerge,
        mergeCost: { need: need, lingShi: (g.def.cost && g.def.cost.lingShi && g.def.cost.lingShi[g.lv]) || 0 },
      });
    }
    out.sort(function (a, b) { return a.gemId < b.gemId ? -1 : a.gemId > b.gemId ? 1 : a.lv - b.lv; });
    return out;
  }

  /* ==================== 升星（1..10 星） ==================== */
  function starInfo(uid) {
    const eq = getEquip(uid);
    if (!eq) return null;
    const F = D().formula;
    const star = eq.star || 0;
    const cost = F.starCost(star, eq.grade); // {lingYu, mat:{ore_xingsha}, dup}
    const dupCandidates = [];
    if (cost.dup) {
      for (const e of equ().list) {
        if (e.uid !== uid && e.baseId === eq.baseId && !isEquipped(e.uid) && !e.spirit) dupCandidates.push(e.uid);
      }
    }
    return { star: star, max: F.maxStar || 10, cost: cost, needDup: !!cost.dup, dupCandidates: dupCandidates };
  }
  function starUp(uid, dupUid) {
    const eq = getEquip(uid);
    if (!eq) return { ok: false, err: '裝備不存在' };
    const info = starInfo(uid);
    if (info.star >= info.max) return { ok: false, err: '十星圓滿，不可再升' };
    if (!XG.hasRes({ lingYu: info.cost.lingYu, mat: info.cost.mat })) return { ok: false, err: '靈玉或星砂不足' };
    let fodder = null;
    if (info.needDup) {
      fodder = dupUid ? getEquip(dupUid) : (info.dupCandidates.length ? getEquip(info.dupCandidates[0]) : null);
      if (!fodder) return { ok: false, err: '五星之後，需吞噬一件同名底材方可升星' };
      if (fodder.uid === uid || fodder.baseId !== eq.baseId) return { ok: false, err: '吞噬材料須為同名底材' };
      if (isEquipped(fodder.uid)) return { ok: false, err: '吞噬材料正穿在身上' };
      if (fodder.spirit) return { ok: false, err: '器靈相噬，有傷天和，不可取' };
    }
    XG.addRes({ lingYu: -info.cost.lingYu, mat: (function () { const m = {}; for (const id in info.cost.mat) m[id] = -info.cost.mat[id]; return m; })() });
    if (fodder) removeItem(fodder.uid);
    eq.star = info.star + 1;
    statAdd('forge_star', 1);
    recount();
    const b = baseOf(eq.baseId);
    if (eq.star >= info.max) {
      pushNews('「' + b.name + '」十星圓滿，星輝繚繞，如握蒼穹一角。', 'player', 1);
    }
    invalidate();
    dirty();
    return { ok: true, star: eq.star };
  }

  /* ==================== 套裝檢測 ==================== */
  function getSetInfo() {
    const equippedBase = {};
    const sl = equ().slots;
    for (const k in sl) {
      const e = sl[k] ? getEquip(sl[k]) : null;
      if (e) equippedBase[e.baseId] = 1;
    }
    return (D().sets || []).map(function (s) {
      let count = 0;
      for (const p of s.pieces) if (equippedBase[p]) count++;
      return {
        id: s.id, name: s.name, icon: s.icon, count: count,
        eff2on: count >= 2, eff4on: count >= 4,
        eff2: s.eff2, eff4: s.eff4, desc: s.desc, hidden: !!s.hidden,
      };
    });
  }
  function setOfBase(baseId) {
    for (const s of (D().sets || [])) {
      if (s.pieces.indexOf(baseId) >= 0) return s;
    }
    return null;
  }

  /* ==================== 器靈 ==================== */
  function canWakeSpirit(uid) {
    const eq = getEquip(uid);
    if (!eq) return { ok: false, err: '裝備不存在' };
    const cond = (D().spirits && D().spirits.wakeCond) || { grade: 4, enh: 15, lingYu: 100 };
    if (eq.spirit) return { ok: false, err: '器靈已孕育' };
    if (eq.grade < cond.grade) return { ok: false, err: '唯神品（grade4）可孕靈' };
    if ((eq.enh || 0) < cond.enh) return { ok: false, err: '需強化至 +' + cond.enh + ' 方可孕靈' };
    if ((XG.state.res.lingYu || 0) < cond.lingYu) return { ok: false, err: '靈玉不足（需 ' + cond.lingYu + '）' };
    return { ok: true };
  }
  function wakeSpirit(uid) {
    const chk = canWakeSpirit(uid);
    if (!chk.ok) return chk;
    const eq = getEquip(uid);
    const SP = D().spirits;
    const cond = SP.wakeCond;
    XG.addRes({ lingYu: -cond.lingYu });
    const persona = XG.util.weighted(SP.personas || []);
    const name = XG.util.pick(XG.data.spiritNames || ['太虛']);
    const skill0 = XG.util.weighted(SP.skills || []);
    const skills = [{ id: skill0.id, lv: 1 }];
    // 隱藏彩蛋：5%「天眷」開局即攜雙技
    let blessed = false;
    if (XG.util.chance(0.05)) {
      const rest = (SP.skills || []).filter(function (s) { return s.id !== skill0.id; });
      if (rest.length) { skills.push({ id: XG.util.weighted(rest).id, lv: 1 }); blessed = true; }
    }
    eq.spirit = { name: name, persona: persona.id, lv: 1, exp: 0, skills: skills };
    statAdd('spirit_wake', 1);
    const b = baseOf(eq.baseId);
    if (blessed) {
      pushNews('天眷之人！「' + b.name + '」器靈「' + name + '」覺醒即攜雙技，' + XG.state.player.name + ' 福緣深厚，羨煞旁人。', 'player', 1);
    } else {
      pushNews('「' + b.name + '」器靈「' + name + '」（' + persona.name + '）覺醒，睜開了懵懂的第一眼。', 'player', 1);
    }
    invalidate();
    dirty();
    return { ok: true, spirit: eq.spirit };
  }
  function spiritExpNeed(lv) { return (lv || 1) * 100; }
  // 器靈升級：每 10 級習得新技能（未滿 3 個）或強化已有技能
  function spiritLevelUp(eq) {
    const sp = eq.spirit;
    const SP = D().spirits;
    let learned = null;
    if (sp.lv % 10 === 0) {
      const known = {};
      sp.skills.forEach(function (s) { known[s.id] = 1; });
      const rest = (SP.skills || []).filter(function (s) { return !known[s.id]; });
      if (sp.skills.length < 3 && rest.length) {
        const ns = XG.util.weighted(rest);
        sp.skills.push({ id: ns.id, lv: 1 });
        learned = { id: ns.id, name: ns.name, isNew: true };
      } else {
        const t = XG.util.pick(sp.skills);
        t.lv++;
        const sd = (SP.skills || []).find(function (s) { return s.id === t.id; });
        learned = { id: t.id, name: sd ? sd.name : t.id, isNew: false };
      }
    }
    return learned;
  }
  function feedSpirit(uid, fodderUid) {
    const eq = getEquip(uid);
    if (!eq) return { ok: false, err: '裝備不存在' };
    if (!eq.spirit) return { ok: false, err: '此器尚未孕育器靈' };
    if (eq.spirit.lv >= SPIRIT_MAX_LV) return { ok: false, err: '器靈已臻圓滿（' + SPIRIT_MAX_LV + ' 級）' };
    const fodder = getEquip(fodderUid);
    if (!fodder) return { ok: false, err: '口糧裝備不存在' };
    if (fodder.uid === uid) return { ok: false, err: '器靈不能自噬' };
    if (fodder.baseId !== eq.baseId) return { ok: false, err: '器靈只食同名之器' };
    if (isEquipped(fodderUid)) return { ok: false, err: '口糧正穿在身上' };
    if (fodder.spirit) return { ok: false, err: '器靈相噬，有傷天和，不可取' };
    removeItem(fodderUid);
    const sp = eq.spirit;
    sp.exp += FEED_EXP;
    let learned = null;
    while (sp.lv < SPIRIT_MAX_LV && sp.exp >= spiritExpNeed(sp.lv)) {
      sp.exp -= spiritExpNeed(sp.lv);
      sp.lv++;
      const l = spiritLevelUp(eq);
      if (l) learned = l;
    }
    if (sp.lv >= SPIRIT_MAX_LV) sp.exp = 0;
    statAdd('spirit_feed', 1);
    recount();
    invalidate();
    dirty();
    return { ok: true, lv: sp.lv, learned: learned };
  }
  function spiritInfo(uid) {
    const eq = getEquip(uid);
    if (!eq) return null;
    const SP = D().spirits;
    const wake = canWakeSpirit(uid);
    if (!eq.spirit) return { spirit: null, canWake: wake.ok, wakeErr: wake.err || null, wakeCond: SP.wakeCond };
    const sp = eq.spirit;
    const personaDef = (SP.personas || []).find(function (p) { return p.id === sp.persona; }) || null;
    const skillView = sp.skills.map(function (s) {
      const sd = (SP.skills || []).find(function (x) { return x.id === s.id; }) || { id: s.id, name: s.id, eff: {} };
      return { id: s.id, name: sd.name, icon: sd.icon, lv: s.lv, eff: sd.eff, desc: sd.desc };
    });
    const feedable = [];
    for (const e of equ().list) {
      if (e.uid !== uid && e.baseId === eq.baseId && !isEquipped(e.uid) && !e.spirit) feedable.push(e.uid);
    }
    return {
      spirit: sp, personaDef: personaDef, skillView: skillView,
      expNeed: spiritExpNeed(sp.lv), maxLv: SPIRIT_MAX_LV, feedable: feedable, canWake: false,
    };
  }

  /* ==================== 屬性計算 ==================== */
  // 單件底材白值 ×強化倍率 ×升星倍率 ×境界倍率 → flat
  function calcFlat(eq) {
    const b = baseOf(eq.baseId);
    const F = D().formula;
    const mul = F.enhMul(eq.enh || 0) * F.starMul(eq.star || 0);
    // 境界倍率：金丹及以下不變，化神起逐步加乘，讓裝備後期不掉隊
    const realmIdx = (XG.state.player || {}).realmIdx || 0;
    const realmMul = realmIdx <= 3 ? 1 : 1 + Math.pow(realmIdx - 3, 2);
    const out = { atk: 0, def: 0, hp: 0 };
    if (b && b.base) {
      if (b.base.atk) out.atk = Math.round(b.base.atk * mul * realmMul);
      if (b.base.def) out.def = Math.round(b.base.def * mul * realmMul);
      if (b.base.hp) out.hp = Math.round(b.base.hp * mul * realmMul);
    }
    return out;
  }
  // 器靈加成彙總進 mods（persona 常駐 ×(1+5%/級)，技能 ×(1+20%/技能級)）
  function addSpiritMods(eq, mods) {
    const sp = eq.spirit;
    if (!sp) return;
    const SP = D().spirits;
    const add = function (k, v) { if (typeof v === 'number' && v) mods[k] = (mods[k] || 0) + v; };
    const persona = (SP.personas || []).find(function (p) { return p.id === sp.persona; });
    if (persona && persona.eff) {
      const m = 1 + 0.05 * (sp.lv - 1);
      for (const k in persona.eff) add(k, persona.eff[k] * m);
    }
    for (const s of sp.skills) {
      const sd = (SP.skills || []).find(function (x) { return x.id === s.id; });
      if (!sd || !sd.eff) continue;
      const m = 1 + 0.2 * (s.lv - 1);
      for (const k in sd.eff) add(k, sd.eff[k] * m);
    }
  }
  // §7 屬性聚合：已裝備 6 件的 base(flat×強化×升星) + 詞條 + 寶石 + 套裝 + 器靈
  function getMods() {
    const mods = {};
    const add = function (k, v) { if (typeof v === 'number' && v) mods[k] = (mods[k] || 0) + v; };
    const sl = equ().slots;
    for (const slot of SLOTS) {
      const uid = sl[slot];
      if (!uid) continue;
      const eq = getEquip(uid);
      if (!eq) continue;
      const flat = calcFlat(eq);
      add('atkFlat', flat.atk);
      add('defFlat', flat.def);
      add('hpFlat', flat.hp);
      for (const a of eq.affixes) {
        const key = KIND_KEY[a.kind];
        if (key) add(key, a.val);
      }
      for (const inst of eq.gems) {
        const g = parseGemInst(inst);
        if (!g) continue;
        for (const k in g.def.eff) add(k, g.def.eff[k] * g.lv);
      }
      addSpiritMods(eq, mods);
    }
    // 套裝 2/4 件效果
    for (const s of getSetInfo()) {
      if (s.eff2on) for (const k in s.eff2) add(k, s.eff2[k]);
      if (s.eff4on) for (const k in s.eff4) add(k, s.eff4[k]);
    }
    return mods;
  }

  /* ==================== 查詢 ==================== */
  function getInv() {
    return equ().list.filter(function (e) { return !isEquipped(e.uid); });
  }
  function getEquipped() {
    const sl = equ().slots;
    const out = {};
    for (const s of SLOTS) out[s] = sl[s] ? getEquip(sl[s]) : null;
    return out;
  }
  // 裝備全量視圖（UI 渲染用）
  function getEquipDetail(uid) {
    const eq = getEquip(uid);
    if (!eq) return null;
    const b = baseOf(eq.baseId) || { name: eq.baseId, icon: '❓', base: {} };
    const set = setOfBase(eq.baseId);
    const flat = calcFlat(eq);
    const affixes = eq.affixes.map(function (a) {
      const def = affixDef(a.id) || { name: a.id };
      return { id: a.id, name: def.name, kind: a.kind, kindName: KIND_NAME[a.kind] || a.kind, val: a.val, locked: !!a.locked };
    });
    const gemView = eq.gems.map(function (inst) {
      const g = parseGemInst(inst);
      if (!g) return null;
      return { instId: inst, name: g.def.name, icon: g.def.icon, lv: g.lv, eff: g.def.eff };
    });
    // 單件詞條+寶石合計百分數（展示用）
    const totalAffixPct = {};
    for (const a of eq.affixes) {
      const key = KIND_KEY[a.kind];
      if (key) totalAffixPct[key] = Math.round(((totalAffixPct[key] || 0) + a.val) * 10) / 10;
    }
    for (const inst of eq.gems) {
      const g = parseGemInst(inst);
      if (!g) continue;
      for (const k in g.def.eff) totalAffixPct[k] = Math.round(((totalAffixPct[k] || 0) + g.def.eff[k] * g.lv) * 10) / 10;
    }
    const power = XG.cfg.POWER({ atk: flat.atk, def: flat.def, hp: flat.hp, spd: 0 });
    return {
      uid: eq.uid, baseId: eq.baseId, name: b.name, icon: b.icon, slot: eq.slot,
      grade: eq.grade, gradeName: GRADE_NAME[eq.grade] || '凡品', hidden: !!b.hidden, desc: b.desc,
      enh: eq.enh || 0, enhFails: eq.enhFails || 0, star: eq.star || 0,
      affixes: affixes, gems: eq.gems.slice(), gemView: gemView,
      spirit: eq.spirit, setId: set ? set.id : null, setName: set ? set.name : null,
      equipped: isEquipped(uid), flat: flat, totalAffixPct: totalAffixPct, power: power,
    };
  }

  /* ==================== 模塊註冊（契約 §10） ==================== */
  XG.sys.forge = {
    id: 'forge',

    init() {
      // 自恢復：補全結構字段（讀檔/舊檔容錯）
      const e = equ();
      for (const s of SLOTS) if (!(s in e.slots)) e.slots[s] = null;
      for (const eq of e.list) {
        eq.affixes = eq.affixes || [];
        for (const a of eq.affixes) a.locked = !!a.locked;
        eq.enh = eq.enh || 0;
        eq.enhFails = eq.enhFails || 0;
        eq.star = eq.star || 0;
        eq.gems = Array.isArray(eq.gems) ? eq.gems.slice(0, GEM_SLOTS) : [null, null];
        while (eq.gems.length < GEM_SLOTS) eq.gems.push(null);
        eq.spirit = eq.spirit || null;
      }
      // 清理 slots 裏指向已不存在裝備的懸空引用
      for (const s of SLOTS) if (e.slots[s] && !getEquip(e.slots[s])) e.slots[s] = null;
      const st = (XG.state.stats = XG.state.stats || {});
      st.forge_make = st.forge_make || 0;
      st.equip_enh_max = st.equip_enh_max || 0;
      st.forge_enh = st.forge_enh || 0;
      st.forge_reforge = st.forge_reforge || 0;
      st.forge_gem_merge = st.forge_gem_merge || 0;
      st.forge_star = st.forge_star || 0;
      st.spirit_wake = st.spirit_wake || 0;
      st.spirit_feed = st.spirit_feed || 0;
      recount();
      invalidate();
    },

    tick(dt) { /* 煉器為即時操作型系統，無每秒邏輯 */ },

    offline(dt) { return null; }, // 無時間型產出，不參與離線結算

    getMods: getMods,

    // 全項目通用生成接口
    createEquip: createEquip,
    makeDrop: makeDrop,

    // 打造
    craft: craft,
    craftCost: craftCost,
    getCraftList: getCraftList,

    // 回爐 / 出售
    disposalInfo: disposalInfo,
    recycle: recycle,
    sell: sell,

    // 穿脫
    equip: equip,
    unequip: unequip,

    // 強化
    enhance: enhance,
    enhanceTimes: enhanceTimes,
    enhanceInfo: enhanceInfo,
    enhRate: enhRate,

    // 洗練
    reforge: reforge,
    reforgeCost: reforgeCost,
    toggleLock: toggleLock,

    // 鑲嵌 / 寶石
    inlay: inlay,
    removeGem: removeGem,
    mergeGem: mergeGem,
    getGemBag: getGemBag,

    // 升星
    starUp: starUp,
    starInfo: starInfo,

    // 套裝
    getSetInfo: getSetInfo,

    // 器靈
    wakeSpirit: wakeSpirit,
    feedSpirit: feedSpirit,
    spiritInfo: spiritInfo,
    canWakeSpirit: canWakeSpirit,

    // 查詢
    getBaseInfo: baseOf,
    getEquip: getEquip,
    getInv: getInv,
    getEquipped: getEquipped,
    getEquipDetail: getEquipDetail,
  };

  XG.sysOrder.push('forge');
})();
