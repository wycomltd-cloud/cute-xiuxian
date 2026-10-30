/* sys/pets.js：靈寵系統 —— 孵蛋/捕捉、資質/性格/技能 roll、升級、進化、血脈覺醒、繁殖、出戰加成、打工產出
 * ====================================================================================================
 * 【玩法對照任務書】
 *  · 獲得：孵蛋（耗 state.inv.egg，物種按 w 權重抽，高品階受玩家境界門檻過濾：g2 築基 / g3 金丹 / g4 化神）；
 *    捕捉與事件直給走 catchPet(spId)（供 expedition / adventure 調用，可給 w:0 隱藏物種）。
 *    隱藏物種 w:0 不入蛋池：饕餮=繁殖 2% 異變；白澤=歸墟偶遇事件（adventure 調 catchPet('pet_baize')）；
 *    神獸（蒼龍/丹凰/麒麟/玄武/白虎/鯤鵬）= 進化鏈終段。
 *  · 實例：資質 1~100 六檔（data aptTiers，倍率 0.6~2.0；三骰加權偏態 roll，天賜 ≈0.5%）；性格按 w 抽
 *    （data personas，workPct 影響打工、fightPct 影響出戰折算）；技能欄 1~3 個（data skills 按 w 抽，
 *    hidden 血脈技不進隨機池，work 類隻影響打工，buff 類出戰時併入主人面板）。
 *  · 養成：等級（出戰寵每秒得經驗；喂寵物經驗丹 feedPill；alchemy 服羣體獸丹調 addTeamExp）；
 *    進化（達 evo.lv + 耗 evo.item 材料，屬性隨新物種 base 暴漲，換 species 名/icon）；
 *    血脈覺醒（純度出生 roll 20~100，凡血恆 0；≥60 耗材料覺醒：全屬性 +50% + 解鎖 bloods[].skill 隱藏技）。
 *  · 繁殖（cfg.UNLOCKS.petBreed，元嬰1層）：兩隻 ≥lv30 耗靈石（異性不論），後代物種隨父母一方、
 *    資質繼承均值+0~20（不低於父母較低者）、血脈純度取高+0~10、2% 異變出饕餮；雙親各 30min 冷卻。
 *  · 出戰：team≤3；寵物最終屬性 ×0.2（CONVERT）折算 atkFlat/defFlat/hpFlat/spdFlat 進 getMods，
 *    再乘性格 fightPct；buff 技能 pct 原樣併入；cai 擅長出戰每隻 +3 dropPct；
 *    3 寵同血脈（非泛血）觸發【血脈共鳴】atkPct+5/defPct+5。
 *  · 打工：jobs 分配（lt 靈田→靈草/h；sl 獸欄→寵物經驗/h；explore 探索→靈石/h），
 *    產出 = 基礎率 ×(1+性格/打工技能 workPct) ×(1+全局 workPct，如力士丹) ×洞府建築加成（靈田/獸欄 +5%/級），
 *    tick 累積進「待領池」state.pets.jobGain，collect()/quickCollect() 一鍵領取；offline 同口徑入池並出報告。
 * ====================================================================================================
 * 【UI 對接面】（本文件純邏輯，以下即 UI 唯一接口依據；全部函數在 XG.sys.pets 上）
 *
 *  —— 數據結構 PetView（list/get/teamList 返回元素；均為普通對象，可直接渲染）——
 *  { uid, sp, spName, icon, grade, hidden, spDesc, blood, bloodName, bloodIcon,
 *    name, shiny, src, bornAt, breedCd,                       // breedCd: 繁殖冷卻截止 ts（0=無冷卻）
 *    lv, exp, expNeed, isMaxLv,                               // expNeed=當前級升下一級所需；滿級 expNeed=0
 *    apt, tier, tierName, aptMult,                            // 資質數值/檔位 id/檔位名/倍率
 *    persona, personaName, personaWorkPct, personaFightPct, personaDesc,
 *    purity, awaken, awakenSkillId,                           // 血脈純度/是否覺醒/血脈隱藏技 id（無則 null）
 *    skills: [{id,name,icon,type,desc,eff}],                  // 已學技能（覺醒技在第 4 位也正常）
 *    stats: {atk,def,hp,spd}, power,                          // 寵物最終面板與戰力（含資質/覺醒/性格擅長加成）
 *    inTeam, job }                                            // job: null|'lt'|'sl'|'explore'
 *
 *  —— 查詢 ——
 *  list()            → [PetView] 全部靈寵（獲得時間新→舊）
 *  get(uid)          → PetView | null
 *  teamList()        → [PetView] 出戰隊列（≤3）
 *  teamCap()         → 3
 *  eggs()            → 當前靈寵蛋數量
 *  codexPets()       → [speciesId] 已解鎖圖鑑（讀 state.codex.pet）
 *  speciesOf(spId)   → data 物種行 | null（含 getHint/desc/base/apt/evo/w）
 *  skillInfo(id)     → data 技能行 | null
 *  personaInfo(id)   → data 性格行 | null
 *  bloodInfo(id)     → data 血脈行 | null
 *  tierOf(apt)       → {id,name,min,max,mult} 資質檔
 *  jobDefs()         → { lt:{id,name,icon,desc}, sl:{...}, explore:{...} } 打工定義
 *  jobCap()          → 打工位上限（3 + 洞府獸欄等級/2 + 段位等級 + 境界等級）
 *  jobList()         → [{ uid, pet:PetView, job, jobName, icon }]
 *  ratesFor(uid)     → { herbPerH, expPerH, lingShiPerH } 該寵三種打工的小時產出（已含全部倍率）
 *  pending()         → { lingShi, mat:{matId:n} } 待領池原值（lingShi 為浮點，顯示請 fmtInt）
 *  powerOf(uid)      → number 單寵戰力（expedition 派遣校驗可用）
 *  teamPower()       → number 當前出戰合計戰力
 *  canEvolve(uid)    → { ok, reason, need:{lv, curLv, item, itemName, itemHave} }
 *  canAwaken(uid)    → { ok, reason, cost }
 *  canBreed(uidA,uidB) → { ok, reason, cost, cdUntil }      // cdUntil=雙方冷卻截止較大 ts
 *  hatchPoolInfo()   → [{ spId, name, icon, grade, w, pct }] 當前境界可孵池（pct=概率%，按 w 算）
 *  consts            → { TEAM_CAP, MAX_LV, CONVERT, BREED_COST, BREED_CD_H, AWAKEN_COST, SHINY_P, BREED_MUT_P }
 *
 *  —— 操作（返回 {ok, msg, ...}，msg 已可直接 toast）——
 *  hatch()           → {ok, msg, pet?}             孵蛋（耗 1 蛋；高品階受境界過濾）
 *  catchPet(spId, src?) → pet | null               【系統對接】捕捉/事件直給（可給隱藏物種），內部全 roll
 *  rename(uid, name) → {ok, msg}                   改名（≤12 字）
 *  addExp(uid, n)    → {ok, lvUps}                 加經驗（自動連升，滿級 100 截斷）
 *  feedPill(uid, pillId) → {ok, msg, lvUps}        喂單寵經驗丹（耗揹包丹藥，讀 pills.js eff.type=='exp'）
 *  addTeamExp(n)     → lvUps 合計                  【系統對接】alchemy 服獸用經驗丹：出戰每隻 +n
 *  evolve(uid)       → {ok, msg, from?, to?}       進化（校驗 canEvolve）
 *  awaken(uid)       → {ok, msg}                   血脈覺醒（校驗 canAwaken，耗 AWAKEN_COST）
 *  breed(uidA, uidB) → {ok, msg, child?}           繁殖（校驗 canBreed，耗靈石，雙親入 24h 冷卻）
 *  joinTeam(uid)     → {ok, msg}                   入隊（≤3；打工中的寵須先召回）
 *  leaveTeam(uid)    → {ok, msg}
 *  setTeam([uids])   → {ok, msg}                   整體換陣（非法項靜默剔除）
 *  assignJob(uid, jobId) → {ok, msg}               派工（'lt'|'sl'|'explore'；出戰中的寵不可派工）
 *  unassignJob(uid)  → {ok, msg}                   召回
 *  collect()         → {ok, msg, gain:{lingShi,mat}} 領取待領池
 *  quickCollect()    → {msg:[...]}                 契約一鍵接口（=collect 包裝）
 *
 * 【寫入的 state.stats 鍵】（snake，懶初始化 XG.state.stats）
 *  pet_hatch 孵化次數 | pet_catch 捕捉次數 | pet_own 累計獲得只數 | pet_grade5 五品神獸獲得數
 *  pet_shiny 閃光靈寵數 | pet_evo 進化次數 | pet_awaken 血脈覺醒次數（=check.k petAwaken）
 *  pet_breed 繁殖次數（=check.k petBreed）| pet_job_collect 打工領取次數 | pet_maxlv 百級圓滿數
 *
 * 【emit 事件】
 *  pet:awaken {uid}            血脈覺醒（契約標準事件）
 *  pet:breed {uid}             繁殖得子（uid=後代；契約標準事件）
 *  codex:new {kind:'pet', id}  圖鑑新增（同時自寫 state.codex.pet 去重，供 gongfa 隱藏條件 codex_pet_20 讀取）
 *  pets:changed                自定義：靈寵結構變化（獲得/進化/覺醒/繁殖/編隊/派工/領取），UI 可監聽刷新
 *  news                        傳聞（神獸降世/異變饕餮/閃光/覺醒/高品獲得/百級圓滿；pushNews 同步寫 state.news）
 *  res:changed / save:dirty    經 XG.addRes 或直接 emit
 *
 * 【offline 行為】offline(dt)：出戰寵與獸欄寵按在線秒率補經驗（自動升級）；
 *  打工按在線同口徑 ×dt 累積進待領池（靈草按期望值取整 + 零頭擲骰）；返回報告片段
 *  { petJob:{lingShi, mat:{id:n}, exp}, events:[簡訊…] }，無收益返回 null。
 *
 * 【隱藏內容】
 *  1. 饕餮 pet_taotie：繁殖 2% 異變（w:0 不入蛋池，不可進化）
 *  2. 白澤 pet_baize：僅歸墟偶遇事件直給（adventure 調 catchPet('pet_baize')）
 *  3. 六神獸走進化鏈終段（w:0；進化材料 beast_jingxue / beast_shenyu）
 *  4. 閃光靈寵 1%：資質保底 61+、非泛血脈純度拉滿 100，傳聞播報
 *  5. 血脈共鳴：出戰 3 寵同血脈（非泛）→ atkPct+5 / defPct+5（未寫在任何說明裏，待玩家自行發現）
 *  6. 血脈覺醒技 pskill_aw_*（w:0 不入隨機池，僅覺醒獲得；技能欄可因此突破 3 格到第 4 格）
 * ==================================================================================================== */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  /* ============================== 常量 ============================== */
  const TEAM_CAP = 3;                 // 出戰上限
  const MAX_LV = 100;                 // 等級上限
  const CONVERT = 0.5;                // 寵物屬性折算玩家 flat 的比例（原 0.2）
  const EXP_NEED_BASE = 30;           // 升級經驗基數：need(lv)=30*lv^1.5*(1+0.25*(grade-1)) / (1+realmIdx*0.3)（原 80）
  const LV_GROWTH = 0.08;             // 每級屬性成長基數：lvMul = 1 + LV_GROWTH*(lv-1)；品階越低成長越高 (gradeLvGrowth)
  // 品階成長倍率：低品階升級獲益更大，滿級縮小差距
  function lvGrowth(grade) { return LV_GROWTH + (5 - grade) * 0.04; } // g1=0.24 g2=0.20 g3=0.16 g4=0.12 g5=0.08
  const SHINY_P = 0.01;               // 閃光概率
  const BREED_COST = 1e5;             // 繁殖靈石消耗
  const BREED_CD_MS = 1800000;        // 繁殖雙親冷卻 30min（原 4h）
  const BREED_CD_H = 0.5;
  const BREED_MUT_P = 0.30;           // 異變饕餮概率（原 2%）
  const BREED_LV = 20;                // 繁殖等級門檻（原 30）
  const AWAKEN_COST = { lingShi: 5e4, mat: { beast_dan: 5, beast_jingxue: 1 } }; // 覺醒消耗
  const AWAKEN_PURITY = 60;           // 覺醒純度門檻（與 data awaken.purityNeed 一致）
  const GRADE_MIN_REALM = { 1: 0, 2: 1, 3: 2, 4: 4 }; // 蛋池品階→最低大境界（g2築基/g3金丹/g4化神；g5 不入池）
  const TEAM_EXP_PS = function (g) { return (40 + 20 * g) * (1 + ((XG.state.player || {}).realmIdx || 0)); };   // 出戰經驗/秒（原基數為20+10g，現翻倍）
  const SL_EXP_PS = function (g) { return (80 + 40 * g) * (1 + ((XG.state.player || {}).realmIdx || 0)); };     // 獸欄經驗/秒（原基數為40+20g，現翻倍）
  const HERB_PER_H = 30;              // 靈田靈草期望株數/小時（基礎值）
  const EXPLORE_LS_PS = 0.6;          // 探索靈石/秒 = 境界 rate × 0.6 × 品階
  const CAI_DROP_PCT = 3;             // cai 擅長出戰每隻 dropPct 加成
  const RESONANCE_PCT = 5;            // 血脈共鳴 atkPct/defPct
  // buff 技能可併入主人面板的 pct 鍵白名單（排除 dmgPct/healPct/cd/workPct）
  const BUFF_KEYS = ['atkPct', 'defPct', 'hpPct', 'spdPct', 'cultRatePct', 'dropPct', 'breakSuccPct', 'alchSuccPct', 'forgeSuccPct'];

  // 打工定義（lt 靈田→靈草；sl 獸欄→寵物經驗；explore 探索→靈石）
  const JOBS = {
    lt:      { id: 'lt', name: '靈田採藥', icon: '🌾', desc: '派駐靈田採擷靈草，每小時約 ' + HERB_PER_H + ' 株（品階隨靈寵品階提升）。' },
    sl:      { id: 'sl', name: '獸欄馴養', icon: '🏕️', desc: '入駐獸欄潛心修煉，持續獲得寵物經驗（效率高於出戰歷練）。' },
    explore: { id: 'explore', name: '外出探索', icon: '🧭', desc: '雲遊四方尋訪遺寶，持續帶回靈石（隨主人境界與靈寵品階提升）。' },
  };

  /* ============================== 內部助手 ============================== */
  const U = function () { return XG.util; };
  const D = function () { return XG.data.pets || { species: [], skills: [], personas: [], bloods: [], aptTiers: [], awaken: {} }; };

  let _spMap = null, _skillMap = null, _personaMap = null, _bloodMap = null, _herbPools = {};
  function spMap() {
    if (!_spMap) { _spMap = {}; D().species.forEach(function (s) { _spMap[s.id] = s; }); }
    return _spMap;
  }
  function skillMap() {
    if (!_skillMap) { _skillMap = {}; D().skills.forEach(function (s) { _skillMap[s.id] = s; }); }
    return _skillMap;
  }
  function personaMap() {
    if (!_personaMap) { _personaMap = {}; D().personas.forEach(function (p) { _personaMap[p.id] = p; }); }
    return _personaMap;
  }
  function bloodMap() {
    if (!_bloodMap) { _bloodMap = {}; D().bloods.forEach(function (b) { _bloodMap[b.id] = b; }); }
    return _bloodMap;
  }
  function bySp(id) { return spMap()[id] || null; }
  function skillOf(id) { return skillMap()[id] || null; }
  function personaOf(id) { return personaMap()[id] || { id: id, name: id, workPct: 0, fightPct: 0, desc: '' }; }
  function bloodOf(id) { return bloodMap()[id] || { id: id, name: '凡血', icon: '凡', grade: 1, skill: null, desc: '' }; }
  function tierOf(apt) {
    const tiers = D().aptTiers || [];
    for (let i = 0; i < tiers.length; i++) if (apt >= tiers[i].min && apt <= tiers[i].max) return tiers[i];
    return tiers[tiers.length - 1] || { id: 'liang', name: '良品', min: 41, max: 60, mult: 1 };
  }

  function P() { return XG.state.pets; }
  function byUid(uid) {
    const list = P().list;
    for (let i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
    return null;
  }

  // 統計累加（契約守則 3：懶初始化 state.stats，snake 鍵名）
  function addStat(k, n) {
    const st = (XG.state.stats = XG.state.stats || {});
    st[k] = (st[k] || 0) + (n || 1);
  }
  // 傳聞推送（emit + 自寫 state.news，按 NEWS_CAP 截斷）
  function pushNews(cat, text, imp) {
    const n = { t: Date.now(), cat: cat || 'system', text: text, imp: imp || 0 };
    XG.state.news = XG.state.news || [];
    XG.state.news.unshift(n);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (XG.state.news.length > cap) XG.state.news.length = cap;
    XG.bus.emit('news', n);
  }
  function emitChanged() {
    XG.bus.emit('pets:changed');
    XG.bus.emit('save:dirty');
  }
  function invalidate() { if (XG.stats && XG.stats.invalidate) XG.stats.invalidate(); }
  // 圖鑑登記（去重自寫 state.codex.pet + emit codex:new；供 gongfa 隱藏條件 codex_pet_20 讀取）
  function regCodex(spId) {
    const c = (XG.state.codex = XG.state.codex || {});
    c.pet = c.pet || [];
    if (c.pet.indexOf(spId) >= 0) return false;
    c.pet.push(spId);
    XG.bus.emit('codex:new', { kind: 'pet', id: spId });
    return true;
  }
  function matName(id) { const m = (XG.data.mats || {})[id]; return m ? m.name : id; }

  /* ============================== roll 管線 ============================== */
  // 資質：三骰加權偏態（均值≈50，天賜≈0.5%，廢材≈5%），區間 [1,100]
  function rollApt() {
    const r = (Math.random() + Math.random() + Math.random()) / 3;
    return U().clamp(1 + Math.floor(r * 100), 1, 100);
  }
  function rollPersonaId() {
    const p = U().weighted(D().personas, 'w');
    return p ? p.id : 'zhongcheng';
  }
  // 技能：1~3 個（1:50% / 2:37.5% / 3:12.5%），按 w 不放回抽，hidden（血脈技）不入池
  function rollSkills() {
    const n = 1 + (U().chance(0.5) ? 1 : 0) + (U().chance(0.25) ? 1 : 0);
    const pool = D().skills.filter(function (s) { return !s.hidden && (s.w || 0) > 0; });
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      const sk = U().weighted(pool, 'w');
      if (!sk) break;
      out.push(sk.id);
      pool.splice(pool.indexOf(sk), 1);
    }
    return out;
  }
  // 生成寵物實例（獲得統一入口：hatch/catch/breed 均走此）
  function makePet(spId, src) {
    const sp = bySp(spId);
    if (!sp) return null;
    let apt = rollApt();
    let purity = sp.blood === 'fan' ? 0 : U().randInt(20, 100);
    const shiny = U().chance(SHINY_P) ? 1 : 0;
    if (shiny) { // 閃光：資質保底 61+，非泛血脈純度拉滿
      apt = Math.max(apt, U().randInt(61, 100));
      if (sp.blood !== 'fan') purity = 100;
    }
    const names = XG.data.petNames || [];
    return {
      uid: U().uid(),
      sp: sp.id,
      name: names.length ? U().pick(names) : sp.name,
      lv: 1, exp: 0,
      apt: apt,
      persona: rollPersonaId(),
      purity: purity,
      awaken: false,
      skills: rollSkills(),
      shiny: shiny,
      src: src || 'hatch',
      bornAt: Date.now(),
      breedCd: 0,
    };
  }
  // 獲得後的統一收尾：登記圖鑑/統計/傳聞/刷新
  function onObtain(pet) {
    const sp = bySp(pet.sp);
    P().list.push(pet);
    regCodex(pet.sp);
    addStat('pet_own');
    if (sp.grade >= 5) addStat('pet_grade5');
    if (pet.shiny) addStat('pet_shiny');
    const tier = tierOf(pet.apt);
    if (pet.shiny) {
      pushNews('player', '【異象】' + pet.name + '（' + sp.name + '）降生時霞光繞體，乃百年一遇的閃光靈寵！', 2);
    } else if (sp.grade >= 5) {
      pushNews('player', '【神獸降世】' + sp.name + '現世，四海修士皆有所感。', 2);
    } else if (sp.grade >= 4 || tier.id === 'tianci') {
      pushNews('system', '道友喜得靈寵「' + sp.name + '」（' + tier.name + '資質），氣度不凡。', 1);
    }
    invalidate();
    emitChanged();
    return pet;
  }

  /* ============================== 屬性與等級 ============================== */
  function expNeed(lv, grade) {
    const base = EXP_NEED_BASE * Math.pow(lv, 1.5) * (1 + 0.25 * (grade - 1));
    const realmFactor = 1 + ((XG.state.player || {}).realmIdx || 0) * 0.3;
    return Math.max(1, Math.round(base / realmFactor));
  }
  // 寵物最終面板：base × 等級成長 × 資質倍率 ×(覺醒 1.5) ×擅長加成 ×境界倍率
  function petStats(pet) {
    const sp = bySp(pet.sp) || D().species[0];
    if (!sp) return { atk: 0, def: 0, hp: 0, spd: 0 };
    const grade = sp.grade || 1;
    const lvMul = 1 + lvGrowth(grade) * (pet.lv - 1);
    const aptMul = tierOf(pet.apt).mult;
    const aw = pet.awaken ? 1.5 : 1;
    const m = lvMul * aptMul * aw;
    const realmMul = 1 + ((XG.state.player || {}).realmIdx || 0); // 境界倍率：後期不掉隊
    const apt = sp.apt || [];
    const gong = apt.indexOf('gong') >= 0 ? 1.1 : 1;
    const shou = apt.indexOf('shou') >= 0 ? 1.1 : 1;
    const su = apt.indexOf('su') >= 0 ? 1.3 : 1;
    return {
      atk: sp.base.atk * m * gong * realmMul,
      def: sp.base.def * m * shou * realmMul,
      hp: sp.base.hp * m * shou * realmMul,
      spd: (sp.base.atk + sp.base.def) * 0.05 * m * su * realmMul,
    };
  }
  function powerOfPet(pet) {
    const s = petStats(pet);
    return XG.cfg.POWER({ atk: s.atk, def: s.def, hp: s.hp, spd: s.spd });
  }
  // 加經驗（內部）：返回升級數；滿級清零經驗；到頂發一次傳聞
  function applyExp(pet, n) {
    if (!pet || n <= 0 || pet.lv >= MAX_LV) { if (pet && pet.lv >= MAX_LV) pet.exp = 0; return 0; }
    const sp = bySp(pet.sp);
    const grade = sp ? sp.grade : 1;
    pet.exp += n;
    let ups = 0;
    while (pet.lv < MAX_LV) {
      const need = expNeed(pet.lv, grade);
      if (pet.exp < need) break;
      pet.exp -= need;
      pet.lv++;
      ups++;
    }
    if (pet.lv >= MAX_LV) {
      if (pet.exp > 0) pet.exp = 0;
      if (ups > 0) {
        addStat('pet_maxlv');
        pushNews('system', '靈寵「' + pet.name + '」勤修不輟，終臻百級圓滿！', 1);
      }
    }
    if (ups > 0) invalidate();
    return ups;
  }

  /* ============================== 打工 ============================== */
  function caveLv(id) { const c = XG.state.cave; return (c && c.lv && c.lv[id]) || 0; }
  // 段位等級：論劍段位 idx（青銅=0 遞增至仙尊=5），防禦性降級
  function pvpTierIdx() {
    try {
      const pvp = XG.sys.pvp;
      if (pvp && typeof pvp.getOverview === 'function') {
        const ov = pvp.getOverview();
        if (ov && ov.tier && typeof ov.tier.idx === 'number') return ov.tier.idx;
      }
    } catch (e) { /* ignore */ }
    return 0;
  }
  // 打工總倍率：1 +(性格 workPct + 打工技能 workPct + 全局 workPct，如力士丹)/100
  function workMult(pet) {
    let pct = personaOf(pet.persona).workPct || 0;
    (pet.skills || []).forEach(function (id) {
      const sk = skillOf(id);
      if (sk && sk.type === 'work' && sk.eff) pct += (sk.eff.workPct || 0);
    });
    let g = 0;
    try { g = (XG.stats && XG.stats.get().workPct) || 0; } catch (e) { g = 0; }
    return Math.max(0.1, 1 + (pct + g) / 100);
  }
  function jobCaveBonus(job) {
    if (job === 'lt') return 1 + 0.05 * caveLv('lt');
    if (job === 'sl') return 1 + 0.05 * caveLv('sl');
    return 1;
  }
  // 靈草池：按寵物品階封頂（g1-2→一階草；g3-4→≤二階；g5→≤三階），權重 = 6-品階
  function herbPool(grade) {
    const cap = grade <= 2 ? 1 : grade <= 4 ? 2 : 3;
    if (_herbPools[cap]) return _herbPools[cap];
    const mats = XG.data.mats || {};
    const pool = [];
    for (const id in mats) {
      if (id.indexOf('herb_') === 0 && (mats[id].grade || 1) <= cap) {
        pool.push({ id: id, w: Math.max(1, 6 - (mats[id].grade || 1)) });
      }
    }
    _herbPools[cap] = pool.length ? pool : [{ id: 'herb_qingling', w: 1 }];
    return _herbPools[cap];
  }
  function pickHerb(grade) {
    const it = U().weighted(herbPool(grade), 'w');
    return it ? it.id : 'herb_qingling';
  }
  function realmRate() {
    const p = XG.state.player || { realmIdx: 0 };
    const r = XG.cfg.REALMS[p.realmIdx] || XG.cfg.REALMS[0];
    return r.rate;
  }
  // 三種打工的小時速率（含全部倍率），供 tick/offline/UI 共用
  function jobRates(pet, job) {
    const sp = bySp(pet.sp);
    const grade = sp ? sp.grade : 1;
    const mult = workMult(pet) * jobCaveBonus(job);
    let herbPerH = 0, expPerH = 0, lingShiPerH = 0;
    if (job === 'lt') herbPerH = HERB_PER_H * mult;
    else if (job === 'sl') expPerH = SL_EXP_PS(grade) * 3600 * mult;
    else if (job === 'explore') {
      const cai = sp && (sp.apt || []).indexOf('cai') >= 0 ? 1.15 : 1; // cai 擅長探索加成
      lingShiPerH = realmRate() * EXPLORE_LS_PS * grade * 3600 * mult * cai;
    }
    return { herbPerH: herbPerH, expPerH: expPerH, lingShiPerH: lingShiPerH };
  }
  const _herbAcc = {}; // 靈草小數累積（運行時，不入存檔）
  function gainHerb(jobGain, pet) {
    const sp = bySp(pet.sp);
    const id = pickHerb(sp ? sp.grade : 1);
    jobGain.mat[id] = (jobGain.mat[id] || 0) + 1;
    return id;
  }

  /* ============================== 模塊協議 ============================== */
  XG.sys.pets = {
    id: 'pets',

    // 啓動自恢復：補全 state 結構、清洗失效引用、補全實例字段
    init() {
      const st = (XG.state.pets = XG.state.pets || {});
      st.list = st.list || [];
      st.team = st.team || [];
      st.jobs = st.jobs || {};
      st.jobGain = st.jobGain || { lingShi: 0, mat: {} };
      st.jobGain.lingShi = st.jobGain.lingShi || 0;
      st.jobGain.mat = st.jobGain.mat || {};
      const self = this;
      st.team = st.team.filter(function (uid) { return !!self._byUid(uid); });
      for (const uid in st.jobs) {
        if (!self._byUid(uid) || !JOBS[st.jobs[uid]]) delete st.jobs[uid];
      }
      st.list.forEach(function (p) {
        p.lv = p.lv || 1;
        p.exp = p.exp || 0;
        p.apt = p.apt || 50;
        p.persona = p.persona || 'zhongcheng';
        p.purity = p.purity || 0;
        p.skills = p.skills || [];
        p.awaken = !!p.awaken;
        p.shiny = p.shiny || 0;
        p.breedCd = p.breedCd || 0;
      });
      invalidate();
    },

    // 每秒：出戰寵得經驗 + 打工產出累積進待領池
    tick(dt) {
      if (!dt || dt <= 0) return;
      const st = P();
      if (!st) return;
      // 保底第一隻靈寵：靈寵系統解鎖（煉氣5層）後，若囊中無寵亦無蛋，贈靈寵蛋一枚——
      // 破「無寵不能歷練、無歷練不得寵蛋」的死循環（一次性，存 state 持久標記）
      if (!st.starterGiven && XG.cfg.isUnlocked('pets') && !st.list.length && !((XG.state.inv && XG.state.inv.egg) || 0)) {
        st.starterGiven = 1;
        XG.addRes({ egg: 1 });
        pushNews('system', '你于山中獨行，忽聞草間嚶鳴，俯身拾得一枚溫熱的靈寵蛋——且往靈寵頁孵化一試。', 1);
      }
      if (!st.list.length) return;
      // 出戰經驗
      for (let i = 0; i < st.team.length; i++) {
        const pet = this._byUid(st.team[i]);
        if (!pet) continue;
        const sp = bySp(pet.sp);
        applyExp(pet, TEAM_EXP_PS(sp ? sp.grade : 1) * dt);
      }
      // 打工
      for (const uid in st.jobs) {
        const pet = this._byUid(uid);
        if (!pet) continue;
        const job = st.jobs[uid];
        const sp = bySp(pet.sp);
        const grade = sp ? sp.grade : 1;
        const r = jobRates(pet, job);
        if (job === 'explore') {
          st.jobGain.lingShi += (r.lingShiPerH / 3600) * dt;
        } else if (job === 'sl') {
          applyExp(pet, (r.expPerH / 3600) * dt);
        } else if (job === 'lt') {
          _herbAcc[uid] = (_herbAcc[uid] || 0) + (r.herbPerH / 3600) * dt;
          while (_herbAcc[uid] >= 1) {
            _herbAcc[uid] -= 1;
            gainHerb(st.jobGain, pet);
          }
        }
      }
    },

    // 離線結算：同 tick 口徑 ×dt 入待領池；靈草期望取整 + 零頭擲骰；返回報告片段
    offline(dt) {
      if (!dt || dt <= 0) return null;
      const st = P();
      if (!st || !st.list.length) return null;
      let expSum = 0, lsSum = 0;
      const matSum = {};
      // 出戰經驗
      for (let i = 0; i < st.team.length; i++) {
        const pet = this._byUid(st.team[i]);
        if (!pet) continue;
        const sp = bySp(pet.sp);
        const e = TEAM_EXP_PS(sp ? sp.grade : 1) * dt;
        applyExp(pet, e);
        expSum += e;
      }
      // 打工
      for (const uid in st.jobs) {
        const pet = this._byUid(uid);
        if (!pet) continue;
        const job = st.jobs[uid];
        const r = jobRates(pet, job);
        if (job === 'explore') {
          const v = (r.lingShiPerH / 3600) * dt;
          st.jobGain.lingShi += v;
          lsSum += v;
        } else if (job === 'sl') {
          const e = (r.expPerH / 3600) * dt;
          applyExp(pet, e);
          expSum += e;
        } else if (job === 'lt') {
          const expect = (r.herbPerH / 3600) * dt;
          let n = Math.floor(expect);
          if (U().chance(expect - n)) n += 1; // 零頭擲骰，保留歐非體驗
          for (let i = 0; i < n; i++) {
            const id = gainHerb(st.jobGain, pet);
            matSum[id] = (matSum[id] || 0) + 1;
          }
        }
      }
      if (expSum <= 0 && lsSum <= 0 && !Object.keys(matSum).length) return null;
      const parts = [];
      if (lsSum > 0) parts.push('靈石 +' + U().fmtInt(lsSum));
      let herbN = 0;
      for (const id in matSum) herbN += matSum[id];
      if (herbN > 0) parts.push('靈草 ×' + herbN);
      if (expSum > 0) parts.push('靈寵經驗 +' + U().fmtInt(expSum));
      return {
        petJob: { lingShi: Math.round(lsSum), mat: matSum, exp: Math.round(expSum) },
        events: ['靈寵勤勉打工 ' + U().fmtTime(dt) + '：' + parts.join('，') + '（已存入待領池）'],
      };
    },

    // 屬性聚合：出戰寵 flat 折算 + buff 技能 + cai 擅長 + 血脈共鳴
    getMods() {
      const st = P();
      const mods = {};
      if (!st || !st.team || !st.team.length) return mods;
      const bloodCount = {};
      for (let i = 0; i < st.team.length; i++) {
        const pet = this._byUid(st.team[i]);
        if (!pet) continue;
        const sp = bySp(pet.sp);
        const s = petStats(pet);
        const fm = 1 + (personaOf(pet.persona).fightPct || 0) / 100;
        mods.atkFlat = (mods.atkFlat || 0) + s.atk * CONVERT * fm;
        mods.defFlat = (mods.defFlat || 0) + s.def * CONVERT * fm;
        mods.hpFlat = (mods.hpFlat || 0) + s.hp * CONVERT * fm;
        mods.spdFlat = (mods.spdFlat || 0) + s.spd * CONVERT * fm;
        (pet.skills || []).forEach(function (id) {
          const sk = skillOf(id);
          if (!sk || sk.type !== 'buff' || !sk.eff) return;
          BUFF_KEYS.forEach(function (k) {
            if (sk.eff[k]) mods[k] = (mods[k] || 0) + sk.eff[k];
          });
        });
        if (sp && (sp.apt || []).indexOf('cai') >= 0) mods.dropPct = (mods.dropPct || 0) + CAI_DROP_PCT;
        if (sp && sp.blood && sp.blood !== 'fan') bloodCount[sp.blood] = (bloodCount[sp.blood] || 0) + 1;
      }
      // 血脈共鳴：3 寵同血脈（非泛血）
      if (st.team.length >= TEAM_CAP) {
        for (const b in bloodCount) {
          if (bloodCount[b] >= TEAM_CAP) {
            mods.atkPct = (mods.atkPct || 0) + RESONANCE_PCT;
            mods.defPct = (mods.defPct || 0) + RESONANCE_PCT;
            break;
          }
        }
      }
      for (const k in mods) mods[k] = Math.round(mods[k] * 100) / 100;
      return mods;
    },

    // 契約一鍵接口：領取打工待領池
    quickCollect() {
      const r = this.collect();
      return { msg: [r.msg] };
    },

    /* ============================== 內部方法（掛對象便於 init/tick 用 this 調用） ============================== */
    _byUid: byUid,

    /* ============================== 查詢 API ============================== */
    consts: {
      TEAM_CAP: TEAM_CAP, MAX_LV: MAX_LV, CONVERT: CONVERT,
      BREED_COST: BREED_COST, BREED_CD_H: BREED_CD_H, AWAKEN_COST: AWAKEN_COST,
      SHINY_P: SHINY_P, BREED_MUT_P: BREED_MUT_P,
    },

    // PetView 組裝（UI 渲染唯一視圖結構）
    _view(p) {
      const sp = bySp(p.sp) || { name: p.sp, icon: '❓', grade: 1, hidden: false, blood: 'fan', desc: '', apt: [] };
      const blood = bloodOf(sp.blood);
      const tier = tierOf(p.apt);
      const persona = personaOf(p.persona);
      const s = petStats(p);
      const grade = sp.grade || 1;
      const need = p.lv >= MAX_LV ? 0 : expNeed(p.lv, grade);
      const st = P();
      return {
        uid: p.uid, sp: p.sp, spName: sp.name, icon: sp.icon, grade: grade,
        hidden: !!sp.hidden, spDesc: sp.desc || '',
        blood: sp.blood, bloodName: blood.name, bloodIcon: blood.icon,
        name: p.name, shiny: p.shiny || 0, src: p.src || 'hatch',
        bornAt: p.bornAt || 0, breedCd: p.breedCd || 0,
        lv: p.lv, exp: Math.floor(p.exp), expNeed: need, isMaxLv: p.lv >= MAX_LV,
        apt: p.apt, tier: tier.id, tierName: tier.name, aptMult: tier.mult,
        persona: p.persona, personaName: persona.name,
        personaWorkPct: persona.workPct || 0, personaFightPct: persona.fightPct || 0,
        personaDesc: persona.desc || '',
        purity: p.purity, awaken: !!p.awaken, awakenSkillId: blood.skill || null,
        skills: (p.skills || []).map(function (id) {
          const sk = skillOf(id);
          return sk ? { id: sk.id, name: sk.name, icon: sk.icon, type: sk.type, desc: sk.desc, eff: sk.eff }
                    : { id: id, name: id, icon: '❓', type: 'buff', desc: '', eff: {} };
        }),
        stats: { atk: Math.round(s.atk), def: Math.round(s.def), hp: Math.round(s.hp), spd: Math.round(s.spd) },
        power: Math.round(powerOfPet(p)),
        inTeam: st.team.indexOf(p.uid) >= 0,
        job: st.jobs[p.uid] || null,
      };
    },

    list() {
      const self = this;
      return P().list.slice().reverse().map(function (p) { return self._view(p); });
    },
    get(uid) { const p = byUid(uid); return p ? this._view(p) : null; },
    teamList() {
      const self = this;
      return P().team.map(function (uid) { return self._byUid(uid); })
        .filter(Boolean).map(function (p) { return self._view(p); });
    },
    teamCap() { return TEAM_CAP; },
    eggs() { return (XG.state.inv && XG.state.inv.egg) || 0; },
    codexPets() { return ((XG.state.codex || {}).pet || []).slice(); },
    speciesOf(spId) { return bySp(spId); },
    skillInfo(id) { return skillOf(id); },
    personaInfo(id) { return personaMap()[id] || null; },
    bloodInfo(id) { return bloodMap()[id] || null; },
    tierOf: tierOf,
    jobDefs() { return JOBS; },
    jobCap() { return 3 + Math.floor(caveLv('sl') / 2) + pvpTierIdx() + (XG.state.player.realmIdx || 0); }, // 打工位上限（基數3 + 洞府獸欄等級/2 + 段位等級 + 境界等級）
    jobList() {
      const st = P(), self = this, out = [];
      for (const uid in st.jobs) {
        const p = self._byUid(uid);
        if (!p) continue;
        const j = JOBS[st.jobs[uid]];
        if (!j) continue;
        out.push({ uid: uid, pet: self._view(p), job: j.id, jobName: j.name, icon: j.icon });
      }
      return out;
    },
    ratesFor(uid) {
      const p = byUid(uid);
      if (!p) return null;
      return {
        lt: this._rateView(p, 'lt'),
        sl: this._rateView(p, 'sl'),
        explore: this._rateView(p, 'explore'),
      };
    },
    _rateView(p, job) {
      const r = jobRates(p, job);
      return { herbPerH: r.herbPerH, expPerH: Math.round(r.expPerH), lingShiPerH: Math.round(r.lingShiPerH) };
    },
    pending() {
      const g = P().jobGain;
      return { lingShi: g.lingShi, mat: Object.assign({}, g.mat) };
    },
    powerOf(uid) { const p = byUid(uid); return p ? Math.round(powerOfPet(p)) : 0; },
    teamPower() {
      const st = P();
      let sum = 0;
      for (let i = 0; i < st.team.length; i++) {
        const p = this._byUid(st.team[i]);
        if (p) sum += powerOfPet(p);
      }
      return Math.round(sum);
    },
    canEvolve(uid) {
      const p = byUid(uid);
      if (!p) return { ok: false, reason: '靈寵不存在', need: null };
      const sp = bySp(p.sp);
      const evo = sp && sp.evo;
      if (!evo) return { ok: false, reason: '此靈寵已至化境，無可進化', need: null };
      const itemName = evo.item ? matName(evo.item) : null;
      const itemHave = evo.item ? ((XG.state.inv.mat || {})[evo.item] || 0) : 0;
      const need = { lv: evo.lv, curLv: p.lv, item: evo.item || null, itemName: itemName, itemHave: itemHave };
      if (p.lv < evo.lv) return { ok: false, reason: '等級不足（需 ' + evo.lv + ' 級）', need: need };
      if (evo.item && itemHave < 1) return { ok: false, reason: '缺少材料「' + itemName + '」', need: need };
      return { ok: true, reason: '', need: need };
    },
    canAwaken(uid) {
      const p = byUid(uid);
      if (!p) return { ok: false, reason: '靈寵不存在', cost: AWAKEN_COST };
      const sp = bySp(p.sp);
      if (!sp || sp.blood === 'fan') return { ok: false, reason: '凡血之軀，無覺醒之緣', cost: AWAKEN_COST };
      if (p.awaken) return { ok: false, reason: '血脈已然覺醒', cost: AWAKEN_COST };
      if ((p.purity || 0) < AWAKEN_PURITY) return { ok: false, reason: '血脈純度不足（需 ≥' + AWAKEN_PURITY + '，當前 ' + (p.purity || 0) + '）', cost: AWAKEN_COST };
      if (!XG.hasRes(AWAKEN_COST)) return { ok: false, reason: '材料不足（需靈石 ' + U().fmt(AWAKEN_COST.lingShi) + '、妖獸內丹×5、神獸精血×1）', cost: AWAKEN_COST };
      return { ok: true, reason: '', cost: AWAKEN_COST };
    },
    canBreed(uidA, uidB) {
      const res = { ok: false, reason: '', cost: BREED_COST, cdUntil: 0 };
      if (!XG.cfg.isUnlocked('petBreed')) { res.reason = '需元嬰一層方可解鎖靈寵繁殖'; return res; }
      const a = byUid(uidA), b = byUid(uidB);
      if (!a || !b) { res.reason = '靈寵不存在'; return res; }
      if (uidA === uidB) { res.reason = '不能與自己繁殖'; return res; }
      if (a.lv < BREED_LV || b.lv < BREED_LV) { res.reason = '雙方均需達 ' + BREED_LV + ' 級'; return res; }
      const now = Date.now();
      res.cdUntil = Math.max(a.breedCd || 0, b.breedCd || 0);
      if (now < res.cdUntil) { res.reason = '雙親元氣未復（' + U().fmtTime((res.cdUntil - now) / 1000) + ' 後可再行繁衍）'; return res; }
      if (!XG.hasRes({ lingShi: BREED_COST })) { res.reason = '靈石不足（需 ' + U().fmt(BREED_COST) + '）'; return res; }
      res.ok = true;
      return res;
    },
    // 當前境界可孵蛋池（含概率 pct）
    hatchPoolInfo() {
      const realmIdx = (XG.state.player || {}).realmIdx || 0;
      const pool = D().species.filter(function (s) {
        return (s.w || 0) > 0 && realmIdx >= (GRADE_MIN_REALM[s.grade] || 0);
      });
      let total = 0;
      pool.forEach(function (s) { total += s.w; });
      return pool.map(function (s) {
        return { spId: s.id, name: s.name, icon: s.icon, grade: s.grade, w: s.w, pct: total > 0 ? Math.round((s.w / total) * 1000) / 10 : 0 };
      });
    },

    /* ============================== 操作 API ============================== */
    // 孵蛋：耗 1 蛋，按 w 抽物種（高品階受境界過濾）
    hatch() {
      if (!XG.hasRes({ egg: 1 })) return { ok: false, msg: '囊中沒有靈寵蛋：歷練地圖、奇遇機緣、坊市貨攤皆有出落。' };
      const info = this.hatchPoolInfo();
      if (!info.length) return { ok: false, msg: '機緣未到，蛋中毫無動靜。' };
      const pool = info.map(function (it) { return { id: it.spId, w: it.w }; });
      const hit = U().weighted(pool, 'w');
      const spId = hit ? hit.id : pool[0].id;
      XG.addRes({ egg: -1 });
      const pet = makePet(spId, 'hatch');
      if (!pet) return { ok: false, msg: '孵化失敗，蛋殼歸於沉寂。' };
      addStat('pet_hatch');
      onObtain(pet);
      const sp = bySp(spId);
      const tier = tierOf(pet.apt);
      let msg = '靈光乍現，「' + sp.name + '」破殼而出！資質 ' + pet.apt + '（' + tier.name + '）';
      if (pet.shiny) msg += '，霞光繞體，竟是閃光靈寵！';
      return { ok: true, msg: msg, pet: this._view(pet) };
    },

    // 【系統對接】捕捉/事件直給（expedition/adventure 調用；可給 w:0 隱藏物種，如 catchPet('pet_baize')）
    catchPet(spId, src) {
      if (!bySp(spId)) return null;
      const pet = makePet(spId, src || 'catch');
      if (!pet) return null;
      addStat('pet_catch');
      return onObtain(pet);
    },

    rename(uid, name) {
      const p = byUid(uid);
      if (!p) return { ok: false, msg: '靈寵不存在' };
      name = String(name == null ? '' : name).trim().slice(0, 12);
      if (!name) return { ok: false, msg: '名字不可為空' };
      p.name = name;
      emitChanged();
      return { ok: true, msg: '已更名為「' + name + '」' };
    },

    addExp(uid, n) {
      const p = byUid(uid);
      if (!p) return { ok: false, lvUps: 0 };
      const ups = applyExp(p, Math.max(0, n || 0));
      return { ok: true, lvUps: ups };
    },

    // 喂單寵經驗丹（耗揹包丹藥；讀 pills.js eff.type=='exp'）
    feedPill(uid, pillId) {
      const p = byUid(uid);
      if (!p) return { ok: false, msg: '靈寵不存在', lvUps: 0 };
      const recipes = (XG.data.pills && XG.data.pills.recipes) || [];
      let r = null;
      for (let i = 0; i < recipes.length; i++) {
        if (recipes[i].id === pillId && recipes[i].eff && recipes[i].eff.type === 'exp') { r = recipes[i]; break; }
      }
      if (!r) return { ok: false, msg: '此丹非靈寵經驗丹', lvUps: 0 };
      if (((XG.state.inv.pill || {})[pillId] || 0) < 1) return { ok: false, msg: '囊中沒有「' + r.name + '」', lvUps: 0 };
      XG.addRes({ pill: { [pillId]: -1 } });
      const ups = applyExp(p, r.eff.val);
      let msg = p.name + ' 服下「' + r.name + '」，經驗 +' + U().fmtInt(r.eff.val);
      if (ups > 0) msg += '，連升 ' + ups + ' 級！';
      emitChanged();
      return { ok: true, msg: msg, lvUps: ups };
    },

    // 【系統對接】alchemy 服獸用經驗丹：出戰靈寵每隻 +n
    addTeamExp(n) {
      const st = P();
      let ups = 0;
      for (let i = 0; i < st.team.length; i++) {
        const p = this._byUid(st.team[i]);
        if (p) ups += applyExp(p, Math.max(0, n || 0));
      }
      if (ups > 0) emitChanged();
      return ups;
    },

    // 進化：達 lv + 耗材料，物種進階（屬性隨新 base 暴漲，換名換 icon）
    evolve(uid) {
      const chk = this.canEvolve(uid);
      if (!chk.ok) return { ok: false, msg: chk.reason };
      const p = byUid(uid);
      const from = bySp(p.sp);
      const evo = from.evo;
      if (evo.item) XG.addRes({ mat: { [evo.item]: -1 } });
      p.sp = evo.to;
      const to = bySp(evo.to);
      addStat('pet_evo');
      const isNew = regCodex(evo.to);
      if (to.grade >= 5) {
        addStat('pet_grade5');
        pushNews('player', '【神獸降世】' + p.name + '歷劫進化，化作「' + to.name + '」，瑞氣沖霄，四方皆聞！', 2);
      } else if (to.grade >= 4) {
        pushNews('system', '靈寵「' + p.name + '」進化為「' + to.name + '」，氣息暴漲，已入仙獸之列。', 1);
      }
      invalidate();
      emitChanged();
      return { ok: true, msg: '進化功成！「' + from.name + '」化作「' + to.name + '」，資質血脈盡數承繼。', from: from.id, to: to.id, isNewSpecies: isNew };
    },

    // 血脈覺醒：純度≥60 耗材料，全屬性 +50% + 解鎖血脈隱藏技
    awaken(uid) {
      const chk = this.canAwaken(uid);
      if (!chk.ok) return { ok: false, msg: chk.reason };
      const p = byUid(uid);
      XG.addRes({ lingShi: -AWAKEN_COST.lingShi, mat: { beast_dan: -5, beast_jingxue: -1 } });
      p.awaken = true;
      const sp = bySp(p.sp);
      const blood = bloodOf(sp.blood);
      if (blood.skill && p.skills.indexOf(blood.skill) < 0) p.skills.push(blood.skill);
      addStat('pet_awaken');
      XG.bus.emit('pet:awaken', { uid: p.uid });
      const skName = blood.skill ? (skillOf(blood.skill) || {}).name : null;
      pushNews(sp.grade >= 5 ? 'player' : 'system',
        '【血脈覺醒】' + p.name + '（' + sp.name + '）體內' + blood.name + '轟然甦醒，全屬性暴漲五成' +
        (skName ? '，悟得血脈祕技「' + skName + '」' : '') + '！', sp.grade >= 5 ? 2 : 1);
      invalidate();
      emitChanged();
      return { ok: true, msg: '血脈覺醒成功！全屬性 +50%' + (skName ? '，解鎖隱藏技「' + skName + '」' : '') + '。' };
    },

    // 繁殖：兩隻≥lv30 耗靈石，後代隨父母一方、資質均值±20、純度取高±10、2% 異變饕餮
    breed(uidA, uidB) {
      const chk = this.canBreed(uidA, uidB);
      if (!chk.ok) return { ok: false, msg: chk.reason };
      const a = byUid(uidA), b = byUid(uidB);
      XG.addRes({ lingShi: -BREED_COST });
      a.breedCd = b.breedCd = Date.now() + BREED_CD_MS;
      const mutated = U().chance(BREED_MUT_P);
      const childSp = mutated ? 'pet_taotie' : (U().chance(0.5) ? a.sp : b.sp);
      const child = makePet(childSp, 'breed');
      if (!child) return { ok: false, msg: '繁衍失敗，靈韻消散。' };
      if (!mutated) { // 異變保持野性 roll；正常後代按繼承公式（後代不比父母差）
        child.apt = U().clamp(Math.round((a.apt + b.apt) / 2 + U().randInt(0, 20)), Math.min(a.apt, b.apt), 100);
        const sp = bySp(childSp);
        child.purity = sp.blood === 'fan' ? 0 : U().clamp(Math.max(a.purity || 0, b.purity || 0) + U().randInt(0, 10), 1, 100);
      }
      addStat('pet_breed');
      onObtain(child);
      XG.bus.emit('pet:breed', { uid: child.uid });
      const csp = bySp(childSp);
      if (mutated) {
        pushNews('player', '【異變】' + a.name + '與' + b.name + '的後代竟生出血盆大口之形——兇獸「饕餮」降世！', 2);
      }
      const tier = tierOf(child.apt);
      let msg = '新生命呱呱墜地：「' + csp.name + '」，資質 ' + child.apt + '（' + tier.name + '）';
      if (mutated) msg += '——竟是異變饕餮！';
      else if (child.shiny) msg += '，霞光繞體，竟是閃光靈寵！';
      return { ok: true, msg: msg, child: this._view(child), mutated: mutated };
    },

    /* ============================== 出戰編隊 ============================== */
    joinTeam(uid) {
      const st = P();
      const p = byUid(uid);
      if (!p) return { ok: false, msg: '靈寵不存在' };
      if (st.team.indexOf(uid) >= 0) return { ok: false, msg: '已在出戰隊列之中' };
      if (st.team.length >= TEAM_CAP) return { ok: false, msg: '出戰隊列已滿（' + TEAM_CAP + '）' };
      if (st.jobs[uid]) return { ok: false, msg: '此寵正在' + JOBS[st.jobs[uid]].name + '，需先召回方可出戰' };
      st.team.push(uid);
      invalidate();
      emitChanged();
      return { ok: true, msg: p.name + ' 已入出戰隊列' };
    },
    leaveTeam(uid) {
      const st = P();
      const i = st.team.indexOf(uid);
      if (i < 0) return { ok: false, msg: '不在出戰隊列中' };
      st.team.splice(i, 1);
      invalidate();
      emitChanged();
      return { ok: true, msg: '已離隊休整' };
    },
    setTeam(uids) {
      const st = P();
      const self = this;
      const clean = (uids || []).filter(function (uid, i) {
        return self._byUid(uid) && !st.jobs[uid] && uids.indexOf(uid) === i;
      }).slice(0, TEAM_CAP);
      st.team = clean;
      invalidate();
      emitChanged();
      return { ok: true, msg: '出戰隊列已更新（' + clean.length + '/' + TEAM_CAP + '）' };
    },

    /* ============================== 打工 ============================== */
    assignJob(uid, jobId) {
      const st = P();
      const p = byUid(uid);
      if (!p) return { ok: false, msg: '靈寵不存在' };
      if (!JOBS[jobId]) return { ok: false, msg: '沒有這門差事' };
      if (st.team.indexOf(uid) >= 0) return { ok: false, msg: '出戰中的靈寵無暇打工，請先撤下戰陣' };
      if (st.jobs[uid] === jobId) return { ok: false, msg: '已在' + JOBS[jobId].name + '中' };
      if (!st.jobs[uid] && Object.keys(st.jobs).length >= this.jobCap()) {
        return { ok: false, msg: '工位已滿（' + this.jobCap() + '）' };
      }
      st.jobs[uid] = jobId;
      emitChanged();
      return { ok: true, msg: p.name + ' 已派往' + JOBS[jobId].name };
    },
    unassignJob(uid) {
      const st = P();
      if (!st.jobs[uid]) return { ok: false, msg: '此寵並無差事在身' };
      const name = JOBS[st.jobs[uid]].name;
      delete st.jobs[uid];
      delete _herbAcc[uid];
      emitChanged();
      return { ok: true, msg: '已從' + name + '召回' };
    },
    // 領取待領池（靈石取整，零頭留存）
    collect() {
      const st = P();
      const g = st.jobGain;
      const out = { lingShi: Math.floor(g.lingShi), mat: {} };
      for (const id in g.mat) {
        const n = Math.floor(g.mat[id]);
        if (n > 0) out.mat[id] = n;
      }
      if (out.lingShi <= 0 && !Object.keys(out.mat).length) {
        return { ok: false, msg: '靈寵尚在勞作，暫無產出可領取', gain: { lingShi: 0, mat: {} } };
      }
      XG.addRes(out);
      g.lingShi -= out.lingShi;
      for (const id in out.mat) {
        g.mat[id] -= out.mat[id];
        if (g.mat[id] <= 0) delete g.mat[id];
      }
      addStat('pet_job_collect');
      const parts = [];
      if (out.lingShi > 0) parts.push('靈石 +' + U().fmtInt(out.lingShi));
      for (const id in out.mat) parts.push(matName(id) + ' ×' + out.mat[id]);
      emitChanged();
      return { ok: true, msg: '打工收穫：' + parts.join('，'), gain: out };
    },
  };

  XG.sysOrder.push('pets');
})();
