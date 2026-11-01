/* cultivation.js：放置核心系統（契約 §10）——修為累積 / 三種修煉狀態 / 突破 / 靈根洗練 / 經脈點亮 / 離線收益
 *
 * ============================ UI 對接面（下一批 UI 代理唯一接口依據） ============================
 * 全部通過 XG.sys.cultivation 調用；所有函數均可隨時安全調用（內部做防禦性校驗）。
 *
 * 【修煉主頁聚合】
 *   getCultView() → {
 *     realmIdx, realmName, layer, layers(=10), cult, cultText, cultRate, cultRateText,
 *     mode:'dazuo|biguan', modeName, modeMult, locked(閉關鎖脈中), lockRemain(秒),
 *     dunwu:{ active, remain, mult, chancePerSec },
 *   }
 * 【模式切換】（打坐×1.0 / 閉關×1.3；入閉關即鎖脈 2 分鐘，鎖內不可切出；頓悟非模式不可手選）
 *   getModeInfo()  → { mode, modeName, mult, modes:[{id,name,mult,desc}], locked, lockRemain }
 *   canSetMode(mode) → { can, err?, lockRemain? }
 *   setMode(mode)  → { ok, msg?, err?, lockRemain? }   // err 文案可直接 toast
 * 【突破】（小境界 100%；大境界 layer10 按 stats.breakRate + 破境丹，失敗保底 +8%、只扣一半消耗）
 *   getBreakInfo() → {
 *     big(是否大境界突破), realmIdx, realmName, layer, targetText(目標文案), cost, costText,
 *     cult, enough(修為是否夠), canBreak, err?,
 *     baseRate(大境界基礎成功率含保底/功法), failBonus(breakFails*0.08),
 *     pills:[{ id, name, icon, grade, count }](seg 匹配當前境界的破境丹), pillMax(=3),
 *     rateWith(n) → 用 n 顆破境丹後的總成功率(0~0.98),
 *     tribulationCount(0/3/6/9), tribulationWith(n) → 各重預覽 [{i,name,chance}],
 *   }
 *   tryBreakthrough(pillIds) → { ok:false, err } | { ok:true, big, success, rate?, cost, msg }
 *     // pillIds 為選用的破境丹 id 數組（≤3，可空/省略）；小境界忽略丹藥。msg 可直接 toast/pop。
 * 【靈根洗練】（耗靈玉+靈草重 roll 五行；小概率變異冰雷風暗光；混沌隱藏；變異 emit spirit:mutated）
 *   getRootInfo() → {
 *     type, typeName, mut, mutName, effId, effName, grade, mult, hidden, desc,
 *     washCost:{ lingYu, mat:{id:n} }, washCostText, canWash, washErr?,
 *     washBoost:{ active, pct, remain }(淬靈丹變異率加成),
 *   }
 *   washRoot() → { ok:false, err } | { ok:true, rootId, name, mutated, isHundun, mult, msg }
 * 【經脈點亮】（耗修為，need 前置校驗；三條支線見 data/gongfa.js meridians）
 *   getMeridians() → [{ id, name, branch, cost, costText, eff, need, lit, can, err? }]（按表序）
 *   lightMeridian(id) → { ok:false, err } | { ok:true, id, name, msg }
 * 【頓悟】（隨機觸發，30 秒 ×5；受靈根/悟性丹加成）
 *   getDunwuInfo() → { active, remain, mult, chancePerSec, boost:{ active, pct, remain } }
 *
 * ============================ 跨系統接口（其他系統防禦性調用） ============================
 *   addCult(n, src)            // 發修為獎勵：加修為 + 屏幕跳字；src=來源文案（可省）
 *   addDunwuBoost(pct, durSec) // 悟性丹等：durSec 秒內頓悟觸發率 +pct%（alchemy 服悟性丹後調用）
 *   addRootWashBoost(pct, durSec) // 淬靈丹(eff root val=3)：durSec 秒內洗練變異率 +pct 百分點
 *   tuona()                    // 手動吐納（美術場景點擊小人調用）：全局 3s 冷卻，
 *                              // gain=當前 cultRate×1（每次固定收益） → { ok:true, gain }；冷卻中 → { ok:false, cd(秒) }
 *
 * ============================ 寫入的 state.stats 鍵（snake，成就統計器讀） ============================
 *   total_cult(累計獲得修為) / news_count(本系統傳聞條數) / dunwu_count(頓悟次數)
 *   break_success(大境界突破成功) / break_fail(大境界突破失敗) / break_fail_streak_max(連敗峯值)
 *   layer_up(小境界提升次數) / layer_max(小境界歷史峯值) / realm_max(大境界歷史峯值)
 *   spirit_wash(靈根洗練次數) / spirit_root_mut(靈根變異次數) / meridian_lit(點亮穴位數)
 *   tuona_count(手動吐納次數)
 *
 * ============================ emit 的事件 ============================
 *   realm:layer {realmIdx, layer}（小境界提升）｜ realm:break {realmIdx, ok}（大境界結果）
 *   fx:breakthrough {realmIdx}（大境界成功特效）｜ spirit:mutated {rootId}（靈根變異）
 *   dunwu:start {until, mult} / dunwu:end {}（頓悟起止，自定義事件，供 UI/道友系統聯動）
 *   tuona {gain}（手動吐納一次，自定義事件，供美術場景監聽聯動）
 *   news {t,cat,text,imp}（頓悟/靈根變異；玩家突破高光由 fellows 系統統一播報，本系統不發）
 *   res:changed（每秒 tick 與修為變動）｜ save:dirty（突破/洗練/點穴後）
 *
 * offline 行為：dt 秒全額修為收益（無衰減，沿用當前模式倍率；離線頓悟按觸發率折算次數，單次至多 3 次並補償超額修為），返回 {cultGain, dunwuProcs}。
 * 隱藏內容：混沌靈根（hundun）僅在洗練變異池中權重 1 隱藏產出，mult×3 為全遊戲最強靈根。
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  // ============================ 常量（數值紀律：口徑對齊契約 §5/§9.3） ============================
  const MODES = {
    dazuo:  { name: '打坐・發呆', mult: 1.0, desc: '表面在發呆，體內正在努力。基礎修煉 ×1。' },
    biguan: { name: '閉關・認真躺', mult: 1.3, desc: '掛上請勿打擾，修煉 ×1.3；切換後鎖定兩分鐘，仙人也需要專注時間。' },
  };
  const BIGUAN_LOCK_SEC = 120;   // 閉關鎖脈時長（秒）
  const DUNWU_DUR_SEC = 30;      // 頓悟持續（秒）
  const DUNWU_MULT = 5;          // 頓悟修煉倍率
  const DUNWU_BASE_P = 1 / 900;  // 頓悟基礎觸發率（每秒，期望約 15 分鐘一次；掛機三分鐘內約兩成幾率遇見）
  const DUNWU_OFFLINE_CAP = 3;   // 單次離線結算最多折算頓悟次數
  const GRADE_COEF = 0.05;       // 靈根 grade 每超 1 級修煉 +5%（grade 上限 5，見 pills.js 補天壯骨丹）
  const WUXING = ['jin', 'mu', 'shui', 'huo', 'tu'];             // 五行靈根
  const MUT_IDS = ['bing', 'lei', 'feng', 'an', 'guang', 'hundun']; // 變異靈根（混沌隱藏）
  const WASH_MUT_BASE = 0.08;    // 洗練變異基礎概率
  const PILL_CAP = 3;            // 單次突破最多服用破境丹數
  const BREAK_RATE_CAP = 0.98;   // 破境丹加持後的成功率封頂
  // 僅五次指定的跨境突破新增天劫；輪回系統的九重天劫獨立維持原樣。
  const BREAK_TRIBULATIONS = { 2: 3, 3: 3, 4: 6, 5: 6, 6: 9 };
  const BREAK_THUNDERS = ['青木神雷', '丙火神雷', '玄水神雷', '庚金神雷', '戊土神雷', '陰火焚神', '贔風散魂', '心魔問心', '紫霄神雷'];
  function tribulationWaves(count, rate) {
    // 各重獨立判定、後段略難；權重總和為 1，全部通過率的乘積恰等於原突破率。
    const sum = count * (count + 1) / 2;
    const waves = [];
    for (let i = 1; i <= count; i++) waves.push({ i: i, name: BREAK_THUNDERS[i - 1], chance: Math.pow(rate, i / sum) });
    return waves;
  }
  const TUONA_CD_MS = 3000;       // 手動吐納全局冷卻（毫秒）
  const TUONA_SEC = 1;          // 手動吐納單次收益 = 當前 cultRate × 秒數

  // 頓悟傳聞文案池（古風，隨機取一）
  const DUNWU_NEWS = [
    '叮！腦袋突然連上仙界 Wi-Fi，頓悟啟動，修為加速下載！',
    '你觀檐前雨滴，忽有所感，經脈中真元自轉不息，竟是頓悟之兆！',
    '夜半靜坐，你忽聞心中一聲清鳴，如撥雲見日，修為精進迅猛！',
    '你偶讀殘卷半句，豁然貫通，靈臺清明，吐納之效暴增數倍！',
    '你於夢中得高人指點一二，醒來只覺大道在眼前徐徐展開，頓悟陡生！',
    '你見庭前花開花落，忽悟枯榮之理，體內真元澎湃如潮，修行勢如破竹！',
  ];

  // ============================ 內部輔助 ============================

  let tuonaLastAt = 0; // 手動吐納上次觸發時間戳（閉包態，不入存檔）

  // stats 計數累加（懶初始化；snake 鍵名，成就統計器直接讀）
  function bumpStat(k, n) {
    const st = XG.state;
    st.stats = st.stats || {};
    st.stats[k] = (st.stats[k] || 0) + (n || 1);
  }

  // stats 取歷史峯值（只增不減）
  function setStatMax(k, v) {
    const st = XG.state;
    st.stats = st.stats || {};
    if ((st.stats[k] || 0) < v) st.stats[k] = v;
  }

  // 內部傳聞助手：push 進 state.news（unshift，按 NEWS_CAP 截斷）並 emit 'news'
  function pushNews(cat, text, imp) {
    const st = XG.state;
    st.news = st.news || [];
    const item = { t: Date.now(), cat: cat, text: text, imp: imp || 0 };
    st.news.unshift(item);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (st.news.length > cap) st.news.length = cap;
    XG.bus.emit('news', item);
    bumpStat('news_count', 1);
  }

  // 屏幕中央浮動跳字（UI 未接入時靜默跳過）
  function pop(text, cls) {
    if (XG.ui && typeof XG.ui.pop === 'function') XG.ui.pop(text, cls);
  }

  // 靈根表查詢（防禦性：數據層缺失時返回 null）
  function rootDef(id) {
    const roots = XG.data && XG.data.gongfa && XG.data.gongfa.roots;
    if (!roots) return null;
    for (const r of roots) if (r.id === id) return r;
    return null;
  }

  // 當前生效靈根 id（變異優先於五行）
  function effRootId() {
    const sr = XG.state.player.spiritRoot;
    return (sr && sr.mut) || (sr && sr.type) || 'jin';
  }

  // 當前生效靈根倍率（數據缺失按 1.0）
  function effRootMult() {
    const def = rootDef(effRootId());
    return def ? def.mult || 1 : 1;
  }

  // 靈根 grade 修煉係數
  function gradeCoef() {
    const g = (XG.state.player.spiritRoot && XG.state.player.spiritRoot.grade) || 1;
    return 1 + GRADE_COEF * (Math.max(1, g) - 1);
  }

  // 頓悟是否進行中
  function dunwuActive() {
    const u = XG.state.player.dunwuUntil || 0;
    return u > Date.now();
  }

  // 頓悟每秒觸發率：基礎 × 靈根倍率 × 根骨係數 × (1+悟性丹加成/100) × (1+輪迴頓悟率/100)
  function dunwuChancePerSec() {
    const p = XG.state.player;
    let boost = 0;
    const b = p.dunwuBoost;
    if (b && b.until > Date.now()) boost = b.pct || 0;
    // 輪迴天賦/轉世身份頓悟率加成（reincarn.getMods 輸出、stats.calc 透傳鍵 dunwuRatePct；防禦性缺省 0）
    let talentPct = 0;
    try { talentPct = (XG.stats && XG.stats.get().dunwuRatePct) || 0; } catch (e) { talentPct = 0; }
    if (!isFinite(talentPct)) talentPct = 0;
    return DUNWU_BASE_P * effRootMult() * gradeCoef() * (1 + boost / 100) * (1 + talentPct / 100);
  }

  // 結束頓悟（到點調用）：清狀態 + 刷新面板 + 提示
  function endDunwu() {
    XG.state.player.dunwuUntil = 0;
    if (XG.stats) XG.stats.invalidate();
    pop('頓悟結束，靈臺復歸清明。', '');
    XG.bus.emit('dunwu:end', {});
  }

  // 觸發頓悟：30 秒 ×5 + news + pop
  function startDunwu() {
    const p = XG.state.player;
    p.dunwuUntil = Date.now() + DUNWU_DUR_SEC * 1000;
    if (XG.stats) XG.stats.invalidate();
    bumpStat('dunwu_count', 1);
    pushNews('player', XG.util.pick(DUNWU_NEWS), 1);
    pop('頓悟！' + DUNWU_DUR_SEC + '秒內修煉速度 ×' + DUNWU_MULT, 'gold');
    XG.bus.emit('dunwu:start', { until: p.dunwuUntil, mult: DUNWU_MULT });
    XG.bus.emit('save:dirty');
  }

  // 破境丹數據查詢：返回 { recipeMap, avail:[{id,name,icon,grade,count}] }（eff.type='break' 且 seg 匹配當前 realmIdx）
  function breakPillInfo() {
    const recipes = (XG.data && XG.data.pills && XG.data.pills.recipes) || [];
    const map = {};
    for (const r of recipes) map[r.id] = r;
    const p = XG.state.player;
    const bag = XG.state.inv.pill || {};
    const avail = [];
    for (const id in bag) {
      const r = map[id];
      if (!r || !r.eff || r.eff.type !== 'break' || !r.seg) continue;
      if (p.realmIdx < r.seg[0] || p.realmIdx > r.seg[1]) continue;
      if ((bag[id] || 0) <= 0) continue;
      avail.push({ id: id, name: r.name, icon: r.icon, grade: r.grade, count: bag[id] });
    }
    avail.sort(function (a, b) { return a.grade - b.grade; });
    return { recipeMap: map, avail: avail };
  }

  // ============================ 系統模塊 ============================
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  XG.sys.cultivation = {
    id: 'cultivation',

    // 啓動自恢復：補齊本系統附加字段、矯正非法模式/靈根/穴位數據
    init() {
      const st = XG.state;
      const p = st.player;
      // 模式矯正（頓悟非模式，舊檔殘留一律歸打坐）
      if (!MODES[p.cultivateMode]) p.cultivateMode = 'dazuo';
      // 附加瞬態字段（存檔深合併會保留，缺省補 0）
      if (typeof p.biguanUntil !== 'number') p.biguanUntil = 0;   // 閉關鎖脈截止 ts
      if (typeof p.dunwuUntil !== 'number') p.dunwuUntil = 0;     // 頓悟截止 ts
      if (!p.dunwuBoost || typeof p.dunwuBoost !== 'object') p.dunwuBoost = { pct: 0, until: 0 };
      if (!p.rootWashBoost || typeof p.rootWashBoost !== 'object') p.rootWashBoost = { pct: 0, until: 0 };
      // 靈根合法性
      p.spiritRoot = p.spiritRoot || { type: 'jin', grade: 3, mut: null };
      if (WUXING.indexOf(p.spiritRoot.type) < 0) p.spiritRoot.type = 'jin';
      if (p.spiritRoot.mut && MUT_IDS.indexOf(p.spiritRoot.mut) < 0) p.spiritRoot.mut = null;
      p.spiritRoot.grade = XG.util.clamp(p.spiritRoot.grade || 3, 1, 5);
      // 經脈列表合法性（剔除數據層已不存在的穴位）
      const table = (XG.data && XG.data.gongfa && XG.data.gongfa.meridians) || [];
      const known = {};
      for (const m of table) known[m.id] = 1;
      p.meridians = p.meridians || { lit: [] };
      if (!Array.isArray(p.meridians.lit)) p.meridians.lit = [];
      p.meridians.lit = p.meridians.lit.filter(function (id) { return known[id]; });
      // 歷史峯值補登（老檔兼容）
      setStatMax('layer_max', p.layer || 1);
      setStatMax('realm_max', p.realmIdx || 0);
    },

    // 每秒主循環：修為累積 + 頓悟狀態機
    tick(dt) {
      const p = XG.state.player;
      // 頓悟到期結算
      if ((p.dunwuUntil || 0) > 0 && p.dunwuUntil <= Date.now()) endDunwu();
      // 修為累積（cultRate 已含模式/頓悟/靈根/經脈加成，見 getMods）
      const rate = XG.stats ? XG.stats.get().cultRate : 0;
      if (rate > 0 && dt > 0) {
        const gain = rate * dt;
        p.cult = (p.cult || 0) + gain;
        bumpStat('total_cult', gain);
      }
      // 頓悟隨機觸發（進行中不重複觸發）
      if (!dunwuActive()) {
        const prob = dunwuChancePerSec() * dt;
        if (XG.util.chance(prob)) startDunwu();
      }
      XG.bus.emit('res:changed'); // 頂欄節流刷新點
    },

    // 離線結算：全額修為收益（無衰減，沿用當前模式倍率）+ 離線頓悟按機率折算，返回 {cultGain, dunwuProcs}
    offline(dt) {
      if (!dt || dt <= 0) return { cultGain: 0 };
      let rate = XG.stats ? XG.stats.get().cultRate : 0;
      const player=XG.state.player,tox=player.toxicity||0;
      if(tox>50){
        const decay=XG.sys.alchemy?XG.sys.alchemy.getToxInfo().decayPerSec:1/60;
        const toxicSeconds=Math.min(dt,(tox-50)/decay);
        const realm=XG.cfg.REALMS[player.realmIdx],base=realm.rate*(1+.12*(player.layer-1));
        rate+=base*.2*(1-toxicSeconds/dt);
      }
      const gain = rate * dt;
      if (gain > 0) {
        XG.state.player.cult = (XG.state.player.cult || 0) + gain;
        bumpStat('total_cult', gain);
      }
      // 離線頓悟（夢中機緣）：按每秒觸發率 × 離線時長折算次數（單次結算至多 DUNWU_OFFLINE_CAP 次），
      // 每次補償頓悟超出常速的部分修為 = rate × 持續秒 × (倍率-1)
      let procs = 0;
      let bonus = 0;
      if (rate > 0) {
        const exp = dunwuChancePerSec() * dt;
        procs = Math.floor(exp);
        if (XG.util.chance(exp - procs)) procs++;
        procs = Math.min(procs, DUNWU_OFFLINE_CAP);
        if (procs > 0) {
          bonus = procs * rate * DUNWU_DUR_SEC * (DUNWU_MULT - 1);
          XG.state.player.cult = (XG.state.player.cult || 0) + bonus;
          bumpStat('total_cult', bonus);
          bumpStat('dunwu_count', procs);
          pushNews('player', '你閉關靜修，神遊太虛之際靈光頻現，夢中頓悟 ' + procs + ' 次，修為大進！', 1);
        }
      }
      return { cultGain: gain + bonus, dunwuProcs: procs, events: procs > 0 ? ['夢中頓悟 ×' + procs] : [] };
    },

    // 屬性聚合（契約 §7）：穴位 eff 之和 + 靈根 mult 換算 + 模式加成 + 頓悟加成
    getMods() {
      const p = XG.state.player;
      const mods = {};
      // 經脈：全部已點亮穴位 eff 累加（cultRatePct/atkPct/defPct/hpPct/breakSuccPct/workPct/alchSuccPct/hpFlat 等）
      const table = (XG.data && XG.data.gongfa && XG.data.gongfa.meridians) || [];
      const lit = (p.meridians && p.meridians.lit) || [];
      const litSet = {};
      for (const id of lit) litSet[id] = 1;
      let meridianCultPct = 0;
      for (const m of table) {
        if (!litSet[m.id]) continue;
        for (const k in m.eff) {
          if (k === 'cultRatePct') meridianCultPct += m.eff[k]; // 修煉項單獨處理（與倍率合併）
          else if (typeof m.eff[k] === 'number') mods[k] = (mods[k] || 0) + m.eff[k];
        }
      }
      // 修煉總倍率 = 靈根 mult × 根骨係數 × 模式倍率 × 頓悟倍率，換算為 cultRatePct 後疊加穴位平加項
      const modeMult = (MODES[p.cultivateMode] || MODES.dazuo).mult;
      const totalMult = effRootMult() * gradeCoef() * modeMult * (dunwuActive() ? DUNWU_MULT : 1);
      mods.cultRatePct = (mods.cultRatePct || 0) + (totalMult - 1) * 100 + meridianCultPct;
      return mods;
    },

    // ============================ 跨系統接口 ============================

    // 全項目統一發修為入口：加修為 + 跳字提示（契約·共同守則 5）
    addCult(n, src) {
      n = Number(n) || 0;
      if (n <= 0) return 0;
      const p = XG.state.player;
      p.cult = (p.cult || 0) + n;
      bumpStat('total_cult', n);
      pop('+' + XG.util.fmt(n) + ' 修為' + (src ? '（' + src + '）' : ''), 'cult');
      XG.bus.emit('res:changed');
      return n;
    },

    // 手動吐納：全局 3s 冷卻；收益 = 當前 cultRate × 1 秒（走 addCult 統一入口）
    tuona() {
      const now = Date.now();
      if (now - tuonaLastAt < TUONA_CD_MS) {
        return { ok: false, cd: Math.ceil((TUONA_CD_MS - (now - tuonaLastAt)) / 100) / 10 };
      }
      tuonaLastAt = now;
      const rate = XG.stats ? XG.stats.get().cultRate : 0;
      const d=XG.balance.daily();
      d.taps=(d.taps||0)+1;
      const gain = this.addCult(rate * TUONA_SEC, '吐納');
      XG.bus.emit('save:dirty');
      bumpStat('tuona_count', 1);
      XG.bus.emit('tuona', { gain: gain }); // 美術場景監聽聯動
      return { ok: true, gain: gain };
    },

    // 悟性丹等臨時頓悟率加成（alchemy 服用後調用；重複調用覆蓋為較優者）
    addDunwuBoost(pct, durSec) {
      const p = XG.state.player;
      pct = Number(pct) || 0;
      durSec = Number(durSec) || 0;
      if (pct <= 0 || durSec <= 0) return false;
      const now = Date.now();
      const cur = p.dunwuBoost || { pct: 0, until: 0 };
      // 已有更高加成且未到期則只順延時間，否則覆蓋
      if (cur.until > now && (cur.pct || 0) > pct) p.dunwuBoost = { pct: cur.pct, until: now + durSec * 1000 };
      else p.dunwuBoost = { pct: pct, until: now + durSec * 1000 };
      return true;
    },

    // 淬靈丹（eff root val=3）洗練變異率加成（數據約定 +25 百分點）
    addRootWashBoost(pct, durSec) {
      const p = XG.state.player;
      pct = Number(pct) || 0;
      durSec = Number(durSec) || 0;
      if (pct <= 0 || durSec <= 0) return false;
      const now = Date.now();
      const cur = p.rootWashBoost || { pct: 0, until: 0 };
      if (cur.until > now && (cur.pct || 0) > pct) p.rootWashBoost = { pct: cur.pct, until: now + durSec * 1000 };
      else p.rootWashBoost = { pct: pct, until: now + durSec * 1000 };
      return true;
    },

    // ============================ 修煉模式 ============================

    getModeInfo() {
      const p = XG.state.player;
      const now = Date.now();
      const locked = (p.biguanUntil || 0) > now;
      const modes = [];
      for (const id in MODES) modes.push({ id: id, name: MODES[id].name, mult: MODES[id].mult, desc: MODES[id].desc });
      return {
        mode: p.cultivateMode,
        modeName: (MODES[p.cultivateMode] || MODES.dazuo).name,
        mult: (MODES[p.cultivateMode] || MODES.dazuo).mult,
        modes: modes,
        locked: locked,
        lockRemain: locked ? Math.ceil((p.biguanUntil - now) / 1000) : 0,
      };
    },

    canSetMode(mode) {
      const p = XG.state.player;
      if (!MODES[mode]) return { can: false, err: '未知修煉方式' };
      if (mode === p.cultivateMode) return { can: true };
      const now = Date.now();
      if ((p.biguanUntil || 0) > now) {
        return { can: false, err: '閉關鎖脈未解，尚需 ' + XG.util.fmtTime(Math.ceil((p.biguanUntil - now) / 1000)), lockRemain: Math.ceil((p.biguanUntil - now) / 1000) };
      }
      return { can: true };
    },

    // 切換模式；切入閉關即鎖脈 2 分鐘（UI 提示接口：err/lockRemain/msg 直接展示）
    setMode(mode) {
      const chk = this.canSetMode(mode);
      if (!chk.can) return { ok: false, err: chk.err, lockRemain: chk.lockRemain };
      const p = XG.state.player;
      if (mode === p.cultivateMode) return { ok: true, msg: '已是' + MODES[mode].name + '之中' };
      p.cultivateMode = mode;
      let msg = '改修「' + MODES[mode].name + '」，修煉速度 ×' + MODES[mode].mult;
      if (mode === 'biguan') {
        p.biguanUntil = Date.now() + BIGUAN_LOCK_SEC * 1000;
        msg += '；鎖脈 ' + XG.util.fmtTime(BIGUAN_LOCK_SEC) + '，期間不可切換';
      }
      if (XG.stats) XG.stats.invalidate();
      XG.bus.emit('res:changed');
      XG.bus.emit('save:dirty');
      return { ok: true, msg: msg };
    },

    // ============================ 頓悟 ============================

    getDunwuInfo() {
      const p = XG.state.player;
      const now = Date.now();
      const b = p.dunwuBoost || { pct: 0, until: 0 };
      return {
        active: dunwuActive(),
        remain: dunwuActive() ? Math.ceil((p.dunwuUntil - now) / 1000) : 0,
        mult: DUNWU_MULT,
        chancePerSec: dunwuChancePerSec(),
        boost: { active: b.until > now, pct: b.pct || 0, remain: b.until > now ? Math.ceil((b.until - now) / 1000) : 0 },
      };
    },

    // ============================ 突破 ============================

    getBreakInfo() {
      const p = XG.state.player;
      const realms = XG.cfg.REALMS;
      const realm = realms[p.realmIdx] || realms[0];
      const big = (p.layer || 1) >= XG.cfg.LAYERS;
      const info = {
        big: big,
        realmIdx: p.realmIdx,
        realmName: realm.name,
        layer: p.layer,
        cult: p.cult || 0,
        pills: [],
        pillMax: PILL_CAP,
        tribulationCount: big ? (BREAK_TRIBULATIONS[p.realmIdx] || 0) : 0,
        failBonus: (p.breakFails || 0) * XG.cfg.BREAK_FAIL_BONUS,
      };
      // 飛昇（末位境界）前無去路
      if (p.realmIdx >= realms.length - 1) {
        info.canBreak = false;
        info.err = '已至飛昇絕巔，進無可進';
        info.targetText = '—';
        info.cost = Infinity;
        info.costText = '∞';
        info.enough = false;
        info.baseRate = 0;
        info.rateWith = function () { return 0; };
        return info;
      }
      const cost = XG.cfg.layerCost(p.realmIdx, p.layer);
      info.cost = cost;
      info.costText = XG.util.fmt(cost);
      info.enough = (p.cult || 0) >= cost;
      info.targetText = big ? ((realms[p.realmIdx + 1] || {}).name || '?') + '之境' : realm.name + ' ' + ((p.layer || 1) + 1) + ' 層';
      if (big) {
        const base = XG.stats ? XG.stats.get().breakRate : realm.breakRate + info.failBonus;
        info.baseRate = base;
        info.pills = breakPillInfo().avail;
        info.rateWith = function (n) {
          n = XG.util.clamp(Math.floor(n || 0), 0, PILL_CAP);
          return Math.min(BREAK_RATE_CAP, base + n * XG.cfg.BREAK_PILL_BONUS);
        };
      } else {
        info.baseRate = 1; // 小境界水到渠成，必成
        info.rateWith = function () { return 1; };
      }
      info.canBreak = info.enough;
      info.tribulationWith = function (n) { return tribulationWaves(info.tribulationCount, info.rateWith(n)); };
      if (!info.enough) info.err = '修為不足，尚需 ' + XG.util.fmt(cost - (p.cult || 0));
      return info;
    },

    // 執行突破：消耗修為=cfg.layerCost(realmIdx,layer)；大境界按成功率判定，失敗保底 +8%、只扣一半消耗
    tryBreakthrough(pillIds) {
      const p = XG.state.player;
      const info = this.getBreakInfo();
      if (!info.canBreak) return { ok: false, err: info.err || '機緣未至' };
      const cost = info.cost;

      // —— 小境界：100% 成功 ——
      if (!info.big) {
        p.cult -= cost;
        p.layer += 1;
        bumpStat('layer_up', 1);
        setStatMax('layer_max', p.layer);
        if (XG.stats) XG.stats.invalidate();
        XG.bus.emit('realm:layer', { realmIdx: p.realmIdx, layer: p.layer });
        XG.bus.emit('res:changed');
        XG.bus.emit('save:dirty');
        pop('突破至 ' + info.realmName + ' ' + p.layer + ' 層！', 'gold');
        return { ok: true, big: false, success: true, cost: cost, msg: '突破至 ' + info.realmName + ' ' + p.layer + ' 層！' };
      }

      // —— 大境界：校驗並服用破境丹（≤3 顆，成敗皆耗） ——
      const pillData = breakPillInfo();
      const useIds = [];
      if (Array.isArray(pillIds)) {
        for (const id of pillIds) {
          if (useIds.length >= PILL_CAP) break;
          if (useIds.indexOf(id) >= 0) continue;
          const found = pillData.avail.find(function (a) { return a.id === id; });
          if (found) useIds.push(id);
        }
      }
      for (const id of useIds) XG.addRes({ pill: { [id]: -1 } });

      const rate = info.rateWith(useIds.length);
      let success = true, tribulation = null;
      if (info.tribulationCount) {
        const waves = info.tribulationWith(useIds.length);
        tribulation = { count: info.tribulationCount, totalRate: rate, targetText: info.targetText, waves: waves, failedAt: null };
        for (const wave of waves) {
          wave.roll = Math.random();
          wave.pass = wave.roll < wave.chance;
          if (!wave.pass) { success = false; tribulation.failedAt = wave.i; break; }
        }
      } else success = XG.util.chance(rate);
      if (success) {
        p.cult -= cost;
        p.breakFails = 0;
        p.realmIdx += 1;
        p.layer = 1;
        bumpStat('break_success', 1);
        setStatMax('realm_max', p.realmIdx);
        setStatMax('layer_max', 1);
        if (XG.stats) XG.stats.invalidate();
        // 玩家突破高光的 news 由 fellows 系統統一播報（共同守則 7），本系統只發事件
        XG.bus.emit('realm:break', { realmIdx: p.realmIdx, ok: true });
        XG.bus.emit('fx:breakthrough', { realmIdx: p.realmIdx, tribulation: !!tribulation });
        XG.bus.emit('res:changed');
        XG.bus.emit('save:dirty');
        const name = (XG.cfg.REALMS[p.realmIdx] || {}).name || '?';
        return { ok: true, big: true, success: true, rate: rate, cost: cost, tribulation: tribulation, msg: tribulation ? '渡過 ' + tribulation.count + ' 重天劫，正式踏入 ' + name + ' 之境！雷公下班，你升班。' : '升級面試通過！正式踏入 ' + name + ' 之境，蒲團也該換大一點了！' };
      }
      // 失敗：不清零修為只扣一半，保底成功率 +8%
      p.cult = Math.max(0, p.cult - cost / 2);
      p.breakFails = (p.breakFails || 0) + 1;
      bumpStat('break_fail', 1);
      setStatMax('break_fail_streak_max', p.breakFails);
      if (XG.stats) XG.stats.invalidate();
      XG.bus.emit('realm:break', { realmIdx: p.realmIdx, ok: false });
      XG.bus.emit('res:changed');
      XG.bus.emit('save:dirty');
      if (!tribulation) pop('突破失敗，修為折損半數；道心愈堅，下次成功率 +' + Math.round(XG.cfg.BREAK_FAIL_BONUS * 100) + '%', 'warn');
      return { ok: true, big: true, success: false, rate: rate, cost: cost, tribulation: tribulation, msg: tribulation ? '止步第 ' + tribulation.failedAt + ' 重天劫，雷公這次沒放水。境界不變，扣本次需求的一半修為，下次整場成功率保底增加。' : '仙界面試差一點！已扣本次需求的一半修為，下次成功率增加。' };
    },

    // ============================ 靈根洗練 ============================

    // 洗練消耗：靈玉隨大境界遞增 + 五階靈草（對齊洗髓丹成本量級）
    _washCost() {
      const p = XG.state.player;
      return { lingYu: 40 + 30 * (p.realmIdx || 0), mat: { herb_hansui: 1, herb_yusui: 1 } };
    },

    getRootInfo() {
      const p = XG.state.player;
      const sr = p.spiritRoot;
      const effId = effRootId();
      const def = rootDef(effId) || { name: '未知靈根', mult: 1, desc: '' };
      const tDef = rootDef(sr.type) || { name: '未知' };
      const mDef = sr.mut ? rootDef(sr.mut) : null;
      const cost = this._washCost();
      const canWash = XG.hasRes(cost);
      const matNames = [];
      const mats = (XG.data && XG.data.mats) || {};
      for (const id in cost.mat) matNames.push(((mats[id] || {}).name || id) + '×' + cost.mat[id]);
      const b = p.rootWashBoost || { pct: 0, until: 0 };
      const now = Date.now();
      return {
        type: sr.type, typeName: tDef.name,
        mut: sr.mut, mutName: mDef ? mDef.name : null,
        effId: effId, effName: def.name,
        grade: sr.grade, mult: def.mult || 1,
        hidden: !!def.hidden, desc: def.desc || '',
        washCost: cost,
        washCostText: '靈玉×' + cost.lingYu + '、' + matNames.join('、'),
        canWash: canWash,
        washErr: canWash ? null : '靈玉或靈草不足（需 ' + ('靈玉×' + cost.lingYu + '、' + matNames.join('、')) + '）',
        washBoost: { active: b.until > now, pct: b.pct || 0, remain: b.until > now ? Math.ceil((b.until - now) / 1000) : 0 },
      };
    },

    // 洗練：重 roll 五行；小概率變異（冰雷風暗光，混沌隱藏）；變異 emit spirit:mutated
    washRoot() {
      const p = XG.state.player;
      const cost = this._washCost();
      if (!XG.hasRes(cost)) return { ok: false, err: '靈玉或靈草不足，無法行洗練之禮' };
      // 扣費（靈玉 + 靈草）
      const delta = { lingYu: -cost.lingYu, mat: {} };
      for (const id in cost.mat) delta.mat[id] = -cost.mat[id];
      XG.addRes(delta);

      // 變異判定：基礎 8% + 淬靈丹加成（數據約定 +25 百分點）
      const b = p.rootWashBoost || { pct: 0, until: 0 };
      const mutP = WASH_MUT_BASE + (b.until > Date.now() ? (b.pct || 0) / 100 : 0);
      const mutated = XG.util.chance(mutP);
      const sr = p.spiritRoot;
      let msg;
      if (mutated) {
        // 變異池按數據表權重 roll（冰6/雷5/風4/暗3/光2/混沌1——混沌隱藏，萬中無一）
        const pool = [];
        for (const id of MUT_IDS) {
          const d = rootDef(id);
          if (d) pool.push(d);
        }
        const got = XG.util.weighted(pool, 'w') || pool[0];
        sr.type = XG.util.pick(WUXING); // 變異後五行基底重 roll
        sr.mut = got.id;
        bumpStat('spirit_root_mut', 1);
        XG.bus.emit('spirit:mutated', { rootId: got.id });
        if (got.id === 'hundun') {
          pushNews('player', '天現異象！你洗練靈根之際混沌氣入體，竟覺醒傳說中萬中無一的【混沌靈根】！', 2);
          msg = '鴻蒙初判，混沌入體——覺醒【混沌靈根】！修煉加成 ×' + got.mult;
        } else {
          pushNews('player', '你洗練靈根時五行逆亂，竟變異覺醒【' + got.name + '】，修煉天賦脫胎換骨！', 1);
          msg = '靈根變異，覺醒【' + got.name + '】！修煉加成 ×' + got.mult;
        }
      } else {
        sr.type = XG.util.pick(WUXING); // 重 roll 五行（允許與原相同，歐非各安天命）
        sr.mut = null;
        const d = rootDef(sr.type) || { name: sr.type, mult: 1 };
        msg = '洗練已畢，靈根重塑為【' + d.name + '】';
      }
      bumpStat('spirit_wash', 1);
      if (XG.stats) XG.stats.invalidate();
      XG.bus.emit('res:changed');
      XG.bus.emit('save:dirty');
      pop(msg, mutated ? 'gold' : '');
      const effId = effRootId();
      const effDef = rootDef(effId) || { mult: 1 };
      return { ok: true, rootId: effId, name: effDef.name || effId, mutated: mutated, isHundun: sr.mut === 'hundun', mult: effDef.mult || 1, msg: msg };
    },

    // ============================ 經脈點亮 ============================

    getMeridians() {
      const p = XG.state.player;
      const table = (XG.data && XG.data.gongfa && XG.data.gongfa.meridians) || [];
      const lit = (p.meridians && p.meridians.lit) || [];
      const litSet = {};
      for (const id of lit) litSet[id] = 1;
      const cult = p.cult || 0;
      return table.map(function (m) {
        const isLit = !!litSet[m.id];
        let can = true, err = null;
        if (isLit) { can = false; err = '已點亮'; }
        else {
          for (const n of m.need) {
            if (!litSet[n]) { can = false; err = '前置穴位未通'; break; }
          }
          if (can && cult < m.cost) { can = false; err = '修為不足（需 ' + XG.util.fmt(m.cost) + '）'; }
        }
        return { id: m.id, name: m.name, branch: m.branch, cost: m.cost, costText: XG.util.fmt(m.cost), eff: m.eff, need: m.need, lit: isLit, can: can, err: err };
      });
    },

    // 點亮穴位：耗修為，need 前置校驗
    lightMeridian(id) {
      const p = XG.state.player;
      const table = (XG.data && XG.data.gongfa && XG.data.gongfa.meridians) || [];
      const m = table.find(function (x) { return x.id === id; });
      if (!m) return { ok: false, err: '查無此穴' };
      const lit = (p.meridians && p.meridians.lit) || [];
      if (lit.indexOf(id) >= 0) return { ok: false, err: '此穴已通' };
      for (const n of m.need) {
        if (lit.indexOf(n) < 0) return { ok: false, err: '前置穴位未通，須循序漸進' };
      }
      if ((p.cult || 0) < m.cost) return { ok: false, err: '修為不足，尚需 ' + XG.util.fmt(m.cost - (p.cult || 0)) };
      p.cult -= m.cost;
      p.meridians.lit.push(id);
      bumpStat('meridian_lit', 1);
      if (XG.stats) XG.stats.invalidate();
      XG.bus.emit('res:changed');
      XG.bus.emit('save:dirty');
      const msg = '衝開「' + m.name + '」穴，' + m.branch + '經氣又通一分';
      pop(msg, '');
      return { ok: true, id: id, name: m.name, msg: msg };
    },

    // ============================ 修煉主頁聚合視圖 ============================

    getCultView() {
      const p = XG.state.player;
      const realm = XG.cfg.REALMS[p.realmIdx] || XG.cfg.REALMS[0];
      const rate = XG.stats ? XG.stats.get().cultRate : 0;
      const mi = this.getModeInfo();
      const di = this.getDunwuInfo();
      return {
        realmIdx: p.realmIdx,
        realmName: realm.name,
        layer: p.layer,
        layers: XG.cfg.LAYERS,
        cult: p.cult || 0,
        cultText: XG.util.fmt(p.cult || 0),
        cultRate: rate,
        cultRateText: XG.util.fmt(rate) + '/秒',
        mode: mi.mode,
        modeName: mi.modeName,
        modeMult: mi.mult,
        locked: mi.locked,
        lockRemain: mi.lockRemain,
        dunwu: { active: di.active, remain: di.remain, mult: di.mult, chancePerSec: di.chancePerSec },
      };
    },
  };

  XG.sysOrder.push('cultivation');
})();
