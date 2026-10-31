/* reincarn.js：輪迴飛昇系統（渡劫挑戰 → 轉世輪迴 → 天賦樹 → 轉世身份）
 * ============================================================================
 * 【玩法鏈路】
 *   1. 飛昇挑戰（渡劫）：大乘十層圓滿（或渡劫境）可引動天劫，天劫共 9 波，
 *      每波戰力需求逐波遞增（waveReq = WAVE_BASE × WAVE_GROW^(i-1)），按
 *      「當前戰力(含祭丹加成)/需求」折算每波通過率，逐波 roll 點校驗；
 *      挑戰前可「祭丹」——消耗揹包中 atk/def/hp 類戰鬥丹藥，臨時堆高本次挑戰戰力；
 *      失敗 → 跌落回大乘 9 層（境界受損，但修為/資源/裝備等一概不清空），
 *      且每次失敗為本輪迴內後續挑戰累積 +5%/波 的保底通過率（成功清零）；
 *      九波全過 → 飛昇轉世。
 *   2. 轉世輪迴：reincarn+1；保留 codex/ach(含永久 eff)/靈玉×20%(+天賦加成)/
 *      天賦樹/輪迴點/道友好感×50%；重置 境界/修為/靈石/揹包/裝備/功法/丹道/
 *      寵物(放生返祖,圖鑑保留)/洞府/派遣/秘境/論劍/奇遇；
 *      發放 rp 輪迴點 = 本世累計大境界數×2 + 已達成成就數/10（向下取整）。
 *   3. 天賦樹（數據內嵌本文件 TALENTS）：15 節點 3 支（修煉系 cultRatePct/offlineHours/頓悟率，
 *      戰鬥系 atkPct/hpPct/暴擊，機緣系 dropPct/坊市折扣/奇遇率），每節點 3 級，耗 rp 逐級遞增，
 *      支內鏈式前置（前一節點滿級方可點下一節點）。
 *   4. 轉世身份（IDENTITIES，14 種隨機表）：每次轉世 roll 一個，影響開局——
 *      書香門第→初始功法殘篇、獵戶之子→atk、商賈之家→靈石、丹童→丹方、
 *      流浪兒/天棄之子→高變異靈根率（天棄之子為隱藏稀有，混沌靈根率極高）……
 *      身份 mods 持續生效至下次轉世。
 *
 * 【與契約的差異說明】契約 §5 UNLOCKS.reincarn=渡劫10層 管 tab 可見性；按任務書
 *   「渡劫（大乘 10 層後）」，本系統挑戰資格 canChallenge() 以「大乘10層或渡劫境」為準，
 *   isOpen() 自大乘1層起可見（預告），轉世過一次後永久可見。UI 請以本系統查詢函數為準。
 *
 * ============================================================================
 * 【UI 對接面】（UI 代理唯一接口依據；除 getMods 外均為查詢/操作函數）
 *
 *  ▸ XG.sys.reincarn.isOpen()
 *      → bool。輪迴 tab 是否可見（大乘1層起可見作預告；轉世過則永久可見）。
 *  ▸ XG.sys.reincarn.canChallenge()
 *      → {ok:bool, reason:string}。是否可發起飛昇挑戰（大乘10層/渡劫境）。
 *  ▸ XG.sys.reincarn.getChallengeInfo()
 *      → { open, canChallenge, reason, power(當前面板戰力), fails(本世已失敗次數),
 *          pityPct(保底加成百分點), bestWave(歷史最佳波數,0~9), waveCount:9,
 *          waves:[{i, name, desc, req, reqFmt, chance(0~1,含保底)}],
 *          maxPills, lingYuKeepPct(轉世靈玉保留百分比) }
 *  ▸ XG.sys.reincarn.previewPills()
 *      → [{id, name, icon, count, type:'atk|def|hp', val(每顆戰力加成%,變異已×1.5), mut}]，
 *        揹包中可用於祭丹的戰鬥丹藥清單。
 *  ▸ XG.sys.reincarn.startChallenge(pillIds)
 *      pillIds: 丹藥 id 數組（每個元素=祭 1 顆，可重複；最多 maxPills 顆；可為空數組）。
 *      → 校驗失敗 {ok:false, msg}
 *      → 挑戰失敗 {ok:true, success:false, failedAt, waves:[{i,name,desc,req,pow,chance,roll,pass}],
 *                   pillPct, invalid:[被跳過丹藥id], pityPct(新的保底百分點), dropTo:{realmIdx,layer}}
 *      → 飛昇成功 {ok:true, success:true, waves:[同上9波全pass], pillPct, invalid,
 *                   reincarn:{count, rpGain, realmCount, achCount, keepLingYu, petReleased,
 *                             identity:{id,name,icon,desc}, grants:[開局獎勵文案…], root:{type,grade,mut}}}
 *      （UI 可按 waves 逐波播放渡劫動畫後再展示結果）
 *  ▸ XG.sys.reincarn.getTalentTree()
 *      → [{id, br:'cult|battle|luck', brName, name, icon, lv, max, costNext(滿級為null),
 *          canUp, needOk(前置是否滿足), need:[前置id], effNow:{鍵:值}, effNext:{鍵:值}|null,
 *          effText, desc}]（15 節點 flat，按 br 分三組，UI 自行分列）
 *  ▸ XG.sys.reincarn.upgradeTalent(id)
 *      → {ok:bool, msg, lv}。消耗 rp 升 1 級（校驗前置滿級/等級上限/rp 足夠）。
 *  ▸ XG.sys.reincarn.getRpInfo()
 *      → {rp(當前可用), rpTotal(累計獲得), nextRpGain(此刻轉世可得的 rp 預覽), reincarn(次數)}
 *  ▸ XG.sys.reincarn.getIdentity()
 *      → null | {id, name, icon, desc, mods, modsText}（本世身份；未轉世過為 null）
 *  ▸ XG.sys.reincarn.getIdentityPool()
 *      → [{id, name, icon, desc, modsText, rare}]（身份圖鑑式展示；rare=隱藏稀有，
 *        未獲得過稀有身份時 UI 可顯示 ???）
 *  ▸ XG.sys.reincarn.getKeepInfo()
 *      → {keep:[保留項文案…], reset:[重置項文案…], lingYuKeepPct, rpGain(預覽),
 *          realmCount, achCount}
 *  ▸ XG.sys.reincarn.getMods() → flat 加成對象（契約 §7 協議；屬性聚合用，UI 一般不直調）
 *
 * 【寫入的 stats 鍵】（XG.state.stats，snake，懶初始化）
 *   reincarn     輪迴次數（= player.reincarn，成就 check.k 'reincarn' 用）
 *   trib_try     累計發起飛昇挑戰次數
 *   trib_fail    累計渡劫失敗次數
 *   trib_best    歷史最佳波數（0~9，9=渡過）
 *   rp_total     累計獲得輪迴點
 *
 * 【emit 事件】
 *   reincarn:done {count}         轉世完成（契約標準事件；隱藏功法 reincarn_1 等訂閱方消費）
 *   news {t,cat,text,imp}         傳聞（渡劫失敗/飛昇轉世/靈寵放生，同時落 state.news）
 *   res:changed / save:dirty      資源與存檔鉤子
 *
 * 【自定義透傳 mods 鍵】（stats.calc 原樣透傳，其他系統從 XG.stats.get() 讀取，缺省 0）
 *   dunwuRatePct   頓悟率加成百分點（cultivation 頓悟模式消費）
 *   critPct        暴擊率百分點（戰鬥/爬塔/論劍消費）
 *   critDmgPct     暴擊傷害加成百分點（同上）
 *   marketDiscPct  坊市價格折扣百分點（market 消費）
 *   advRatePct     奇遇觸發率加成百分點（adventure 消費）
 *   lingYuKeepPct  轉世靈玉額外保留百分點（本系統自用）
 *
 * 【offline 行為】無離線收益（飛昇挑戰為即時手動玩法，轉世不產時間收益），offline(dt) 恆返回 null。
 * 【tick 行為】無逐秒邏輯，空實現（協議佔位）。
 * ============================================================================
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  /* ===================== 數值常量 ===================== */
  const WAVE_COUNT = 9;          // 天劫波數
  const WAVE_BASE = 8e7;         // 第 1 波需求戰力（大乘基值戰力約 4.3e7 的 2 倍）
  const WAVE_GROW = 1.5;         // 逐波遞增倍率（第 9 波 ≈ 2.05e9）
  const PASS_BASE = 0.55;        // 戰力=需求時的基準通過率
  const PASS_SLOPE = 0.9;        // 戰力比每超 1，通過率增量
  const PASS_FLOOR = 0.05;       // 每波通過率地板（歐皇一線生機）
  const PASS_CAP = 0.95;         // 不含保底的每波通過率上限（天劫無常）
  const PITY_PER_FAIL = 0.05;    // 每次失敗保底 +5%/波
  const PITY_CAP = 0.75;         // 保底加成上限
  const TOTAL_CAP = 0.97;        // 含保底的每波通過率總上限
  const MAX_PILLS = 12;          // 單次挑戰最多祭丹數
  const LINGYU_KEEP = 0.2;       // 轉世靈玉基礎保留比例 20%
  const FAIL_DROP = { realmIdx: 7, layer: 9 }; // 渡劫失敗跌落：大乘 9 層

  /* ===================== 天劫 9 波（名稱/描述，內嵌數據） ===================== */
  const WAVES = [
    { name: '青木神雷', desc: '乙木之雷，生生不息，磨人道基。' },
    { name: '丙火神雷', desc: '丙火燎原，焚經灼脈，酷烈非常。' },
    { name: '玄水神雷', desc: '玄水蝕骨，無聲無息，銷魂蝕魄。' },
    { name: '庚金神雷', desc: '庚金肅殺，萬鈞加身，硬撼者骨斷筋折。' },
    { name: '戊土神雷', desc: '戊土鎮獄，厚土壓頂，幾令人窒息道崩。' },
    { name: '陰火焚神', desc: '陰火自湧泉起，直焚神魂，道心稍動即成飛灰。' },
    { name: '贔風散魂', desc: '贔風自囟門入，吹散三魂七魄，肉身如沙而逝。' },
    { name: '心魔問心', desc: '心魔乘虛而入，問心問道，一念之差萬劫不復。' },
    { name: '紫霄神雷', desc: '紫霄落處，萬法俱滅——渡過，便是仙門。' },
  ];

  /* ===================== 天賦樹（15 節點 3 支，內嵌數據） =====================
   * eff 數值數組為「累計生效值」：lv 級時取 eff[k][lv-1]；cost 數組為升至 1/2/3 級各自 rp 消耗。
   * need 為前置節點 id（需滿級）。br: cult 修煉系 / battle 戰鬥系 / luck 機緣系 */
  const BRANCHES = {
    cult:   { name: '修煉系', icon: '🧘' },
    battle: { name: '戰鬥系', icon: '⚔️' },
    luck:   { name: '機緣系', icon: '🍀' },
  };

  const TALENTS = [
    // —— 修煉系 ——
    { id: 'tx_daoxin', br: 'cult', name: '道心通明', icon: '🧘', max: 3, cost: [1, 2, 3], need: [],
      eff: { cultRatePct: [4, 9, 15] },
      desc: '道心澄澈，萬念歸一，吐納之間靈氣自生。修為速度 +4%/9%/15%。' },
    { id: 'tx_shenyou', br: 'cult', name: '神遊太虛', icon: '🌌', max: 3, cost: [2, 3, 4], need: ['tx_daoxin'],
      eff: { offlineHours: [1, 2, 4] },
      desc: '神魂離體遊於太虛，縱不在此間，修行亦不止。離線收益上限 +1/2/4 小時。' },
    { id: 'tx_huigen', br: 'cult', name: '慧根天成', icon: '💡', max: 3, cost: [2, 3, 5], need: ['tx_shenyou'],
      eff: { dunwuRatePct: [10, 20, 35] },
      desc: '天生慧根，時有靈光貫頂。頓悟概率 +10%/20%/35%。' },
    { id: 'tx_du_e', br: 'cult', name: '渡厄道體', icon: '🛡️', max: 3, cost: [3, 4, 6], need: ['tx_huigen'],
      eff: { breakSuccPct: [2, 4, 7] },
      desc: '道體天成，破境之時心魔不侵。突破成功率 +2%/4%/7%。' },
    { id: 'tx_tianren', br: 'cult', name: '天人合一', icon: '☯️', max: 3, cost: [4, 6, 8], need: ['tx_du_e'],
      eff: { cultRatePct: [6, 12, 20], dunwuRatePct: [5, 10, 15] },
      desc: '人身小天地，天地大人身。修為速度 +6%/12%/20%，頓悟概率 +5%/10%/15%。' },
    // —— 戰鬥系 ——
    { id: 'tz_gengjin', br: 'battle', name: '庚金劍意', icon: '⚔️', max: 3, cost: [1, 2, 3], need: [],
      eff: { atkPct: [5, 10, 16] },
      desc: '劍意淬於庚金，鋒芒所指無堅不摧。攻擊 +5%/10%/16%。' },
    { id: 'tz_xuanwu', br: 'battle', name: '玄武霸體', icon: '🐢', max: 3, cost: [2, 3, 4], need: ['tz_gengjin'],
      eff: { hpPct: [6, 12, 20] },
      desc: '玄武血脈護體，氣血如淵。氣血 +6%/12%/20%。' },
    { id: 'tz_shafa', br: 'battle', name: '殺伐果決', icon: '🗡️', max: 3, cost: [2, 3, 5], need: ['tz_xuanwu'],
      eff: { critPct: [3, 6, 10] },
      desc: '出手即是殺招，攻敵必救。暴擊率 +3%/6%/10%。' },
    { id: 'tz_pojun', br: 'battle', name: '破軍之勢', icon: '💥', max: 3, cost: [3, 4, 6], need: ['tz_shafa'],
      eff: { critDmgPct: [15, 30, 50] },
      desc: '破軍入命，殺氣盈野。暴擊傷害 +15%/30%/50%。' },
    { id: 'tz_zhanshen', br: 'battle', name: '戰神臨世', icon: '👹', max: 3, cost: [4, 6, 8], need: ['tz_pojun'],
      eff: { atkPct: [6, 12, 20], hpPct: [6, 12, 20] },
      desc: '戰神臨世，萬夫莫敵。攻擊與氣血各 +6%/12%/20%。' },
    // —— 機緣系 ——
    { id: 'ty_jinchan', br: 'luck', name: '金蟾銜財', icon: '🐸', max: 3, cost: [1, 2, 3], need: [],
      eff: { dropPct: [5, 10, 16] },
      desc: '金蟾吐寶，財緣廣進。掉落 +5%/10%/16%。' },
    { id: 'ty_shanjia', br: 'luck', name: '善賈之緣', icon: '⚖️', max: 3, cost: [2, 3, 4], need: ['ty_jinchan'],
      eff: { marketDiscPct: [4, 8, 12] },
      desc: '與商道有緣，坊市人人願結個善緣。坊市價格 -4%/8%/12%。' },
    { id: 'ty_qiyuan', br: 'luck', name: '奇遇天成', icon: '🌈', max: 3, cost: [2, 3, 5], need: ['ty_shanjia'],
      eff: { advRatePct: [10, 20, 35] },
      desc: '福至心靈，機緣自至。奇遇觸發率 +10%/20%/35%。' },
    { id: 'ty_fuyuan', br: 'luck', name: '福緣深厚', icon: '🍀', max: 3, cost: [3, 4, 6], need: ['ty_qiyuan'],
      eff: { lingYuKeepPct: [5, 10, 15] },
      desc: '福緣深厚，轉世時靈玉多攜幾分。靈玉保留比例 +5%/10%/15%。' },
    { id: 'ty_tianchong', br: 'luck', name: '天寵之運', icon: '🎲', max: 3, cost: [4, 6, 8], need: ['ty_fuyuan'],
      eff: { dropPct: [6, 12, 20], advRatePct: [10, 20, 30] },
      desc: '天之所寵，運道昌隆。掉落 +6%/12%/20%，奇遇觸發率 +10%/20%/30%。' },
  ];

  /* ===================== 轉世身份隨機表（14 種，內嵌數據） =====================
   * mods：本世常駐加成（經 getMods 輸出）；rootBias：靈根重 roll 修正
   *   （'mutHigh' 變異率高 / 'chaos' 變異+混沌率極高）；grant(st)：開局一次性獎勵，
   *   返回獎勵文案數組。跨系統調用一律防禦性（守則 §5）。 */
  const IDENTITIES = [
    { id: 'sf_shuxiang', name: '書香門第', icon: '📜', w: 10, mods: { cultRatePct: 3 },
      desc: '世代簪纓，滿門皆是讀書人。家中藏書樓三層，最底層壓着一卷無人識得的修仙殘篇。',
      grant(st, grants) {
        // 初始功法：發《清心訣》殘篇×12（fragNeed=4，足夠合成並升級）；防禦性走 gongfa.addFrag
        if (XG.sys.gongfa && typeof XG.sys.gongfa.addFrag === 'function') {
          try { XG.sys.gongfa.addFrag('gf_qingxin', 12); } catch (e) { XG.addRes({ frag: { gf_qingxin: 12 } }); }
        } else XG.addRes({ frag: { gf_qingxin: 12 } });
        grants.push('家傳《清心訣》殘篇 ×12');
      } },
    { id: 'sf_liehu', name: '獵戶之子', icon: '🏹', w: 10, mods: { atkPct: 6 },
      desc: '生於深山獵戶之家，七歲能開硬弓，十五歲獨搏山君。骨子裏淌着獵手的血。',
      grant(st, grants) { grants.push('獵手血脈：攻擊 +6%'); } },
    { id: 'sf_shanggu', name: '商賈之家', icon: '💰', w: 10, mods: { marketDiscPct: 3 },
      desc: '祖上三代行商，南貨北販，算盤打得比劍還快。投胎前爹孃塞了一把壓箱底的靈石。',
      grant(st, grants) {
        XG.addRes({ lingShi: 2000 });
        grants.push('壓箱底靈石 ×2000');
      } },
    { id: 'sf_dantong', name: '丹童', icon: '🧪', w: 8, mods: { alchSuccPct: 4 },
      desc: '前世是丹房外門的燒火童子，偷師學來半冊丹方，今世猶記得爐火溫度。',
      grant(st, grants) {
        // 學丹方：alchemy.learnRandomRecipe（防禦性，不在則降級發成品丹）
        let learnt = false;
        if (XG.sys.alchemy && typeof XG.sys.alchemy.learnRandomRecipe === 'function') {
          try { learnt = !!XG.sys.alchemy.learnRandomRecipe(2); } catch (e) { learnt = false; }
        }
        if (learnt) grants.push('偷師丹方 ×1（已習得）');
        else { XG.addRes({ pill: { pill_juqi: 3 } }); grants.push('聚氣丹 ×3'); }
      } },
    { id: 'sf_liulang', name: '流浪兒', icon: '🍂', w: 8, mods: { dropPct: 4 }, rootBias: 'mutHigh',
      desc: '無父無母，討飯度日。襤褸之中，一身靈根卻在流浪裏磨出了異變之機。',
      grant(st, grants) { grants.push('流浪磨礪：靈根高變異率'); } },
    { id: 'sf_tiejiang', name: '鐵匠之子', icon: '⚒️', w: 8, mods: { forgeSuccPct: 6 },
      desc: '鐵砧邊長大，錘聲作搖籃曲。爹說打鐵的火候，和修仙是一個道理。',
      grant(st, grants) {
        XG.addRes({ mat: { ore_hantie: 5, ore_xuantie: 2 } });
        grants.push('寒鐵 ×5、玄鐵 ×2');
      } },
    { id: 'sf_yaonong', name: '藥農之後', icon: '🌿', w: 8, mods: { alchSuccPct: 3 },
      desc: '祖輩以種藥採藥為生，識得百草性味。自幼在藥田裏打滾，草木皆親。',
      grant(st, grants) {
        XG.addRes({ mat: { herb_chiyang: 5, herb_ningxue: 5 } });
        grants.push('赤陽花 ×5、凝血草 ×5');
      } },
    { id: 'sf_jiangmen', name: '將門之後', icon: '🛡️', w: 8, mods: { defPct: 6, hpPct: 4 },
      desc: '將門虎子，世代戍邊。家學不在詩書在兵戈，一身橫練筋骨鐵打一般。',
      grant(st, grants) { grants.push('將門筋骨：防禦 +6%、氣血 +4%'); } },
    { id: 'sf_youfang', name: '遊方道童', icon: '☯️', w: 8, mods: { advRatePct: 8 },
      desc: '前世隨遊方老道雲遊四海，聽慣了山精鬼怪的傳說，走到哪都有三分奇遇緣。',
      grant(st, grants) { grants.push('雲遊之緣：奇遇率 +8%'); } },
    { id: 'sf_yujia', name: '漁家兒女', icon: '🎣', w: 10, mods: { cultRatePct: 4, hpPct: 3 },
      desc: '水鄉漁家出身，風波里討生活。水性極好，耐性更好，撒網如吐納，一收一放皆有節律。',
      grant(st, grants) { grants.push('漁家耐性：修為速度 +4%、氣血 +3%'); } },
    { id: 'sf_kuangnu', name: '礦奴出身', icon: '⛏️', w: 8, mods: { workPct: 5 },
      desc: '曾在靈石礦底做了十年礦奴，暗無天日。逃出那日，懷裏只揣着幾塊帶血的礦石。',
      grant(st, grants) {
        XG.addRes({ lingShi: 1000, mat: { ore_hantie: 3 } });
        grants.push('帶血靈石 ×1000、寒鐵 ×3');
      } },
    { id: 'sf_luopo', name: '落魄書生', icon: '📖', w: 8, mods: { dunwuRatePct: 12 },
      desc: '屢試不第，窮得只剩滿肚子文章。誰知文章無用，悟道卻有聲——讀書人的頓悟，總是來得突然。',
      grant(st, grants) { grants.push('滿腹文章：頓悟率 +12%'); } },
    { id: 'sf_nongjia', name: '農家子弟', icon: '🌾', w: 10, mods: { workPct: 8 },
      desc: '面朝黃土背朝天，一分耕耘一分收穫。莊稼人的勤勉，放在修仙路上也一樣使。',
      grant(st, grants) { grants.push('莊稼勤勉：打工效率 +8%'); } },
    { id: 'sf_tianqi', name: '天棄之子', icon: '⚡', w: 2, rare: true, mods: { critPct: 3, dropPct: 6 }, rootBias: 'chaos',
      desc: '天厭之，天亦妒之。生而被天道遺棄之人，靈根異變莫測，或出混沌——古往今來，不過一掌之數。',
      grant(st, grants) { grants.push('天棄之命：靈根異變莫測（混沌可期）'); } },
  ];

  // 變異靈根 → 母系五行（spiritRoot.type 必須是五行 id，變異記入 mut）
  const MUT_PARENT = { bing: 'shui', lei: 'jin', feng: 'mu', an: 'tu', guang: 'huo' };
  // 靈根表兜底（data/gongfa.js 未加載時防禦用；正常流程走 XG.data.gongfa.roots）
  const FALLBACK_ROOTS = [
    { id: 'jin', w: 20 }, { id: 'mu', w: 20 }, { id: 'shui', w: 20 }, { id: 'huo', w: 20 }, { id: 'tu', w: 20 },
    { id: 'bing', w: 6 }, { id: 'lei', w: 5 }, { id: 'feng', w: 4 }, { id: 'an', w: 3 }, { id: 'guang', w: 2 }, { id: 'hundun', w: 1 },
  ];

  /* ===================== 內部助手 ===================== */

  // stats 懶初始化
  function stats() { return (XG.state.stats = XG.state.stats || {}); }

  // 傳聞推送（守則 §7）：emit 'news' + 落 state.news（unshift，NEWS_CAP 截斷）
  function pushNews(text, imp, cat) {
    const news = { t: Date.now(), cat: cat || 'player', text: text, imp: imp == null ? 1 : imp };
    const arr = (XG.state.news = XG.state.news || []);
    arr.unshift(news);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (arr.length > cap) arr.length = cap;
    if (XG.bus && typeof XG.bus.emit === 'function') XG.bus.emit('news', news);
  }

  function talentById(id) {
    for (const t of TALENTS) if (t.id === id) return t;
    return null;
  }

  function identityOf(id) {
    if (!id) return null;
    for (const it of IDENTITIES) if (it.id === id) return it;
    return null;
  }

  // 第 i 波（1-based）天劫需求戰力
  function waveReq(i) { return WAVE_BASE * Math.pow(WAVE_GROW, i - 1); }

  // 單波通過率：按 戰力/需求 折算，加失敗保底，多重封頂
  function waveChance(pow, req, fails) {
    const ratio = req > 0 ? pow / req : 1;
    let c = Math.min(PASS_CAP, Math.max(PASS_FLOOR, PASS_BASE + PASS_SLOPE * (ratio - 1)));
    c = Math.min(TOTAL_CAP, c + Math.min(PITY_CAP, (fails || 0) * PITY_PER_FAIL));
    return c;
  }

  // 祭丹：解析丹藥 id → 戰鬥加成（僅接受 atk/def/hp 類；兼容變異後綴 id，效果 ×1.5）
  function pillEffOf(pid) {
    const recipes = (XG.data.pills && XG.data.pills.recipes) || [];
    let mut = false;
    let r = null;
    for (const x of recipes) if (x.id === pid) { r = x; break; }
    if (!r) {
      const base = String(pid).replace(/_(m|mut|mutated)$/, '');
      if (base !== pid) {
        for (const x of recipes) if (x.id === base) { r = x; mut = true; break; }
      }
    }
    if (!r || !r.eff) return null;
    const t = r.eff.type;
    if (t !== 'atk' && t !== 'def' && t !== 'hp') return null;
    return { type: t, val: (r.eff.val || 0) * (mut ? 1.5 : 1), name: r.name, icon: r.icon, mut: mut };
  }

  // 靈根重 roll（轉世開局）：rootBias 修正變異/混沌權重；返回 spiritRoot 結構
  function rollRoot(bias) {
    const roots = (XG.data.gongfa && XG.data.gongfa.roots) || FALLBACK_ROOTS;
    const arr = roots.map(function (r) {
      let w = r.w || 1;
      const isMut = !!MUT_PARENT[r.id];
      if (bias === 'mutHigh') { if (isMut) w *= 6; if (r.id === 'hundun') w *= 3; }
      else if (bias === 'chaos') { if (isMut) w *= 6; if (r.id === 'hundun') w *= 30; }
      return { r: r, w: w };
    });
    const picked = (XG.util.weighted(arr, 'w') || arr[0]).r;
    if (picked.id === 'hundun') {
      return { type: XG.util.pick(['jin', 'mu', 'shui', 'huo', 'tu']), grade: XG.util.randInt(3, 5), mut: 'hundun' };
    }
    if (MUT_PARENT[picked.id]) {
      return { type: MUT_PARENT[picked.id], grade: XG.util.randInt(2, 5), mut: picked.id };
    }
    return { type: picked.id, grade: XG.util.randInt(1, 5), mut: null };
  }

  // 已達成成就數（rp 結算用；state.ach={id:{done:1,claimed:1}}）
  function achDoneCount() {
    const ach = XG.state.ach || {};
    let n = 0;
    for (const id in ach) if (ach[id] && ach[id].done) n++;
    return n;
  }

  // rp 預覽：本世累計大境界數（realmIdx+1，煉氣=1…渡劫=9）×2 + 成就數/10（向下取整）
  function rpPreview() {
    const realmCount = (XG.state.player.realmIdx || 0) + 1;
    const achCount = achDoneCount();
    return { realmCount: realmCount, achCount: achCount, rp: realmCount * 2 + Math.floor(achCount / 10) };
  }

  // 靈玉保留比例（基礎 20% + 天賦 lingYuKeepPct）
  function lingYuKeepPct() {
    let pct = LINGYU_KEEP * 100;
    const lv = (XG.state.player.talents || {}).ty_fuyuan | 0;
    const node = talentById('ty_fuyuan');
    if (node && lv > 0) pct += node.eff.lingYuKeepPct[Math.min(node.max, lv) - 1];
    return pct;
  }

  // mods 數值 → 展示文案（UI 用）
  const MOD_LABEL = {
    cultRatePct: '修為速度', offlineHours: '離線時長(h)', dunwuRatePct: '頓悟率',
    breakSuccPct: '突破成功率', atkPct: '攻擊', defPct: '防禦', hpPct: '氣血',
    critPct: '暴擊率', critDmgPct: '暴傷', dropPct: '掉落', marketDiscPct: '坊市折扣',
    advRatePct: '奇遇率', workPct: '打工效率', alchSuccPct: '煉丹成功率',
    forgeSuccPct: '煉器成功率', lingYuKeepPct: '靈玉保留',
  };
  function modsText(mods) {
    const parts = [];
    for (const k in mods) {
      const label = MOD_LABEL[k] || k;
      if (k === 'marketDiscPct') parts.push(label + ' -' + mods[k] + '%');
      else if (k === 'offlineHours') parts.push(label + ' +' + mods[k]);
      else parts.push(label + ' +' + mods[k] + '%');
    }
    return parts.join('，');
  }

  /* ===================== 轉世主流程（飛昇成功後調用） ===================== */
  function doReincarn() {
    const st = XG.state;
    const p = st.player;
    const def = XG.newState(); // 默認子樹工廠，保證重置結構與 state.js 一致

    // —— 結算（重置前取數） ——
    const pre = rpPreview();                       // {realmCount, achCount, rp}
    const keepPct = lingYuKeepPct();
    const keepLingYu = Math.floor((st.res.lingYu || 0) * keepPct / 100);
    const petReleased = (st.pets && st.pets.list ? st.pets.list.length : 0);
    const rpGain = pre.rp;

    // —— 輪迴計數與輪迴點 ——
    p.reincarn = (p.reincarn || 0) + 1;
    p.rp = (p.rp || 0) + rpGain;
    const S = stats();
    S.reincarn = p.reincarn;                       // 成就 check.k 'reincarn' 統計源
    S.rp_total = (S.rp_total || 0) + rpGain;
    S.trib_best = WAVE_COUNT;

    // —— roll 轉世身份 + 靈根 ——
    const ident = XG.util.weighted(IDENTITIES, 'w') || IDENTITIES[0];
    const newRoot = rollRoot(ident.rootBias);

    // —— 重置：境界/修為/資源/裝備/功法/丹道/寵物/洞府/派遣/秘境/論劍/奇遇 ——
    // player 保留：名字/輪迴四件套/新身份/新靈根；其餘回默認
    const keepPlayer = {
      name: p.name, reincarn: p.reincarn, talents: p.talents || {}, rp: p.rp,
      identity: ident.id, spiritRoot: newRoot, tribFails: 0, gender: null, school: null,
    };
    st.player = Object.assign(def.player, keepPlayer);
    st.res = { lingShi: 0, lingYu: keepLingYu };   // 靈石清空，靈玉×保留比例
    st.inv = def.inv;                              // 材料/丹藥/殘篇/蛋 清空
    st.equips = def.equips;                        // 裝備重置
    st.gongfa = def.gongfa;                        // 功法重置
    st.alchemy = def.alchemy;                      // 丹道重置
    st.pets = def.pets;                            // 靈寵放生（圖鑑 codex.pet 保留）
    st.cave = def.cave;                            // 洞府建築重置
    st.expedition = def.expedition;
    st.dungeon = def.dungeon;
    const keptPvp={season:st.pvp.season,pending:st.pvp.pending||[],balanceVersion:st.pvp.balanceVersion};
    st.pvp = Object.assign(def.pvp,keptPvp);
    st.adventure = def.adventure;
    st.daily = def.daily;
    // 保留不碰：codex / ach(含永久 eff) / fellows(見下) / news / stats / settings /
    //          createdAt / totalOnlineSec

    // —— 道友：好感 ×50%，關係降級（宿敵因果不消；道侶緣盡降為摯友） ——
    if (Array.isArray(st.fellows)) {
      for (const f of st.fellows) {
        f.favor = Math.floor((f.favor || 0) * 0.5);
        if (f.relation === 'partner') f.relation = 'friend';
        else if (f.relation === 'rival') { /* 宿敵保留 */ }
        else f.relation = (f.favor >= 60) ? 'friend' : 'stranger';
      }
    }

    // —— 身份開局獎勵（跨系統調用全部防禦性） ——
    const grants = [];
    try { ident.grant(st, grants); } catch (e) { console.error('[reincarn] 身份獎勵發放出錯', e); }

    // —— 傳聞與事件 ——
    if (petReleased > 0) {
      pushNews('【輪迴】' + petReleased + ' 只靈寵放歸山林，返祖歸源，圖鑑長存。', 1, 'player');
    }
    const rootName = (function () {
      const roots = (XG.data.gongfa && XG.data.gongfa.roots) || [];
      const id = newRoot.mut || newRoot.type;
      for (const r of roots) if (r.id === id) return r.name;
      return id;
    })();
    pushNews(
      '【輪迴】九重天劫盡數渡過，霞舉飛昇！轉世為「' + ident.name + '」，身負 ' + rootName +
      '，攜 ' + rpGain + ' 點輪迴造化再入塵寰。',
      2, 'player'
    );

    XG.bus.emit('reincarn:done', { count: p.reincarn });
    XG.stats.invalidate();
    XG.bus.emit('res:changed');
    XG.bus.emit('save:dirty');

    return {
      count: p.reincarn, rpGain: rpGain, realmCount: pre.realmCount, achCount: pre.achCount,
      keepLingYu: keepLingYu, petReleased: petReleased,
      identity: { id: ident.id, name: ident.name, icon: ident.icon, desc: ident.desc },
      grants: grants, root: newRoot,
    };
  }

  /* ===================== 系統模塊（契約 §10 協議） ===================== */
  XG.sys.reincarn = {
    id: 'reincarn',

    // 啓動自恢復：字段兜底 + 髒數據校驗 + stats 同步
    init() {
      const p = XG.state.player;
      p.talents = p.talents || {};
      if (typeof p.rp !== 'number' || isNaN(p.rp)) p.rp = 0;
      if (typeof p.reincarn !== 'number' || isNaN(p.reincarn)) p.reincarn = 0;
      if (typeof p.tribFails !== 'number' || isNaN(p.tribFails)) p.tribFails = 0;
      // 天賦髒數據清理：未知節點剔除、等級 clamp 到 [0,max]
      for (const id in p.talents) {
        const node = talentById(id);
        if (!node) { delete p.talents[id]; continue; }
        const lv = Math.floor(p.talents[id]);
        if (lv <= 0) delete p.talents[id];
        else p.talents[id] = Math.min(node.max, lv);
      }
      // 身份失效容錯（表更新後舊檔身份被移除的情況）
      if (p.identity && !identityOf(p.identity)) p.identity = null;
      // stats 同步（以 player.reincarn 為準）
      const S = stats();
      S.reincarn = p.reincarn;
      XG.stats.invalidate();
    },

    // 無逐秒邏輯（飛昇挑戰為即時手動玩法）
    tick(dt) {},

    // 無離線收益：挑戰需手動發起，轉世不產生時間收益
    offline(dt) { return null; },

    // 屬性聚合：天賦樹 + 本世身份
    getMods() {
      const out = {};
      const p = XG.state.player;
      const t = p.talents || {};
      for (const node of TALENTS) {
        const lv = Math.min(node.max, t[node.id] | 0);
        if (lv <= 0) continue;
        for (const k in node.eff) out[k] = (out[k] || 0) + node.eff[k][lv - 1];
      }
      const ident = identityOf(p.identity);
      if (ident && ident.mods) {
        for (const k in ident.mods) out[k] = (out[k] || 0) + ident.mods[k];
      }
      return out;
    },

    /* ---------- 查詢：可見性與挑戰 ---------- */

    // tab 可見性：轉世過永久可見；否則大乘1層起可見（天劫預告）
    isOpen() {
      const p = XG.state.player;
      if ((p.reincarn || 0) > 0) return true;
      return p.realmIdx >= 7;
    },

    // 飛昇挑戰資格：大乘10層圓滿，或已入渡劫境
    canChallenge() {
      const p = XG.state.player;
      if (p.realmIdx > 7 || (p.realmIdx === 7 && p.layer >= 10)) return { ok: true, reason: '' };
      return { ok: false, reason: '需臻至大乘十層圓滿，方可引動九重天劫。' };
    },

    // 挑戰信息總覽（UI 渲染渡劫面板）
    getChallengeInfo() {
      const p = XG.state.player;
      const gate = this.canChallenge();
      const fails = p.tribFails || 0;
      const power = XG.stats.get().power;
      const waves = [];
      for (let i = 1; i <= WAVE_COUNT; i++) {
        const req = waveReq(i);
        waves.push({
          i: i, name: WAVES[i - 1].name, desc: WAVES[i - 1].desc,
          req: req, reqFmt: XG.util.fmt(req),
          chance: gate.ok ? waveChance(power, req, fails) : 0,
        });
      }
      return {
        open: this.isOpen(), canChallenge: gate.ok, reason: gate.reason,
        power: power, fails: fails, pityPct: Math.min(PITY_CAP, fails * PITY_PER_FAIL) * 100,
        bestWave: stats().trib_best || 0, waveCount: WAVE_COUNT, waves: waves,
        maxPills: MAX_PILLS, lingYuKeepPct: lingYuKeepPct(),
      };
    },

    // 揹包中可祭丹的戰鬥丹藥清單
    previewPills() {
      const bag = XG.state.inv.pill || {};
      const out = [];
      for (const pid in bag) {
        if ((bag[pid] || 0) <= 0) continue;
        const eff = pillEffOf(pid);
        if (!eff) continue;
        out.push({ id: pid, name: eff.name, icon: eff.icon, count: bag[pid], type: eff.type, val: eff.val, mut: eff.mut });
      }
      out.sort(function (a, b) { return b.val - a.val; });
      return out;
    },

    /* ---------- 操作：發起飛昇挑戰（一次結算 9 波） ---------- */
    startChallenge(pillIds) {
      const gate = this.canChallenge();
      if (!gate.ok) return { ok: false, msg: gate.reason };

      const S = stats();
      S.trib_try = (S.trib_try || 0) + 1;

      // 祭丹聚合：逐顆校驗持有量與類型，非法/超量/超出上限的一律記入 invalid 並跳過
      pillIds = Array.isArray(pillIds) ? pillIds : [];
      const used = {}, invalid = [];
      let pillPct = 0, accepted = 0;
      for (const pid of pillIds) {
        if (accepted >= MAX_PILLS) { invalid.push(pid); continue; } // 單次最多祭 MAX_PILLS 顆
        const eff = pillEffOf(pid);
        if (!eff) { invalid.push(pid); continue; }
        if ((used[pid] || 0) + 1 > (XG.state.inv.pill[pid] || 0)) { invalid.push(pid); continue; }
        used[pid] = (used[pid] || 0) + 1;
        pillPct += eff.val;
        accepted++;
      }
      if (Object.keys(used).length) {
        const delta = { pill: {} };
        for (const pid in used) delta.pill[pid] = -used[pid];
        XG.addRes(delta); // 祭丹祭天，成敗不退
      }

      const p = XG.state.player;
      const fails = p.tribFails || 0;
      const power = XG.stats.get().power * (1 + pillPct / 100);

      // 逐波校驗
      const log = [];
      let passAll = true, failedAt = 0;
      for (let i = 1; i <= WAVE_COUNT; i++) {
        const req = waveReq(i);
        const chance = waveChance(power, req, fails);
        const roll = Math.random();
        const pass = roll < chance;
        log.push({ i: i, name: WAVES[i - 1].name, desc: WAVES[i - 1].desc, req: req, pow: power, chance: chance, roll: roll, pass: pass });
        if (!pass) { passAll = false; failedAt = i; break; }
      }

      if (passAll) {
        const rep = doReincarn();
        return { ok: true, success: true, waves: log, pillPct: pillPct, invalid: invalid, reincarn: rep };
      }

      // —— 渡劫失敗：跌落大乘 9 層，修為/資源一概不清空；保底 +5% ——
      p.realmIdx = FAIL_DROP.realmIdx;
      p.layer = FAIL_DROP.layer;
      p.tribFails = fails + 1;
      S.trib_fail = (S.trib_fail || 0) + 1;
      S.trib_best = Math.max(S.trib_best || 0, failedAt - 1);

      // 彩蛋文案：連敗觸發天劫圍觀梗（隱藏內容）
      let text = '【天劫】道友于天劫第 ' + failedAt + ' 波「' + WAVES[failedAt - 1].name +
        '」之下道基受損，跌落回大乘九層。幸而修為未散，來日可再渡。（保底 +' +
        Math.round(Math.min(PITY_CAP, p.tribFails * PITY_PER_FAIL) * 100) + '%）';
      if (p.tribFails === 3) text = '【天劫】三渡天劫而不果，坊間已有好事者開盤設賭：這一回，過還是不過？';
      else if (p.tribFails === 5) text = '【天劫】五渡五敗。守劫天將見了道友，拱手道：又是你？';
      else if (p.tribFails === 7) text = '【天劫】七渡七敗，天劫雷雲見道友便自發聚攏——雷部已將其引為編外熟人。';
      pushNews(text, 2, 'player');

      XG.stats.invalidate();
      XG.bus.emit('res:changed');
      XG.bus.emit('save:dirty');
      return {
        ok: true, success: false, failedAt: failedAt, waves: log, pillPct: pillPct, invalid: invalid,
        pityPct: Math.min(PITY_CAP, p.tribFails * PITY_PER_FAIL) * 100,
        dropTo: { realmIdx: FAIL_DROP.realmIdx, layer: FAIL_DROP.layer },
      };
    },

    /* ---------- 天賦樹 ---------- */

    // 天賦樹總覽（15 節點 flat；effNow/effNext 為累計生效值）
    getTalentTree() {
      const p = XG.state.player;
      const t = p.talents || {};
      return TALENTS.map(function (node) {
        const lv = Math.min(node.max, t[node.id] | 0);
        const needOk = node.need.every(function (nid) {
          const nn = talentById(nid);
          return nn && Math.min(nn.max, t[nid] | 0) >= nn.max;
        });
        const costNext = lv < node.max ? node.cost[lv] : null;
        const effNow = {}, effNext = {};
        for (const k in node.eff) {
          if (lv > 0) effNow[k] = node.eff[k][lv - 1];
          if (lv < node.max) effNext[k] = node.eff[k][lv];
        }
        return {
          id: node.id, br: node.br, brName: BRANCHES[node.br].name, name: node.name, icon: node.icon,
          lv: lv, max: node.max, costNext: costNext,
          canUp: needOk && lv < node.max && (p.rp || 0) >= costNext,
          needOk: needOk, need: node.need,
          effNow: effNow, effNext: lv < node.max ? effNext : null,
          effText: modsText(effNow), desc: node.desc,
        };
      });
    },

    // 升級天賦（耗 rp，逐級遞增；前置需滿級）
    upgradeTalent(id) {
      const p = XG.state.player;
      const node = talentById(id);
      if (!node) return { ok: false, msg: '無此天賦。', lv: 0 };
      p.talents = p.talents || {};
      const lv = Math.min(node.max, p.talents[id] | 0);
      if (lv >= node.max) return { ok: false, msg: '此天賦已臻圓滿。', lv: lv };
      const needOk = node.need.every(function (nid) {
        const nn = talentById(nid);
        return nn && Math.min(nn.max, p.talents[nid] | 0) >= nn.max;
      });
      if (!needOk) return { ok: false, msg: '前置天賦尚未圓滿，不可點悟。', lv: lv };
      const cost = node.cost[lv];
      if ((p.rp || 0) < cost) return { ok: false, msg: '輪迴點不足（需 ' + cost + ' 點）。', lv: lv };
      p.rp -= cost;
      p.talents[id] = lv + 1;
      XG.stats.invalidate();
      XG.bus.emit('save:dirty');
      return { ok: true, msg: node.name + ' 提升至 ' + (lv + 1) + ' 級。', lv: lv + 1 };
    },

    /* ---------- 輪迴點 / 身份 / 保留清單 ---------- */

    getRpInfo() {
      const p = XG.state.player;
      const pre = rpPreview();
      return {
        rp: p.rp || 0, rpTotal: stats().rp_total || 0,
        nextRpGain: pre.rp, reincarn: p.reincarn || 0,
      };
    },

    getIdentity() {
      const ident = identityOf(XG.state.player.identity);
      if (!ident) return null;
      return {
        id: ident.id, name: ident.name, icon: ident.icon, desc: ident.desc,
        mods: ident.mods || {}, modsText: modsText(ident.mods || {}),
      };
    },

    // 身份全表（圖鑑式展示；rare=隱藏稀有，UI 未獲得時可顯示 ???）
    getIdentityPool() {
      return IDENTITIES.map(function (it) {
        return {
          id: it.id, name: it.name, icon: it.icon, desc: it.desc,
          modsText: modsText(it.mods || {}), rare: !!it.rare,
        };
      });
    },

    // 轉世保留/重置清單預覽（UI 確認彈窗用）
    getKeepInfo() {
      const pre = rpPreview();
      return {
        keep: [
          '圖鑑（codex）全部保留',
          '成就（含永久屬性）全部保留',
          '靈玉 ×' + Math.round(lingYuKeepPct()) + '%',
          '天賦樹與輪迴點全部保留',
          '道友好感 ×50%（宿敵因果不消）',
          '靈寵圖鑑保留（靈寵放歸山林，返祖歸源）',
        ],
        reset: [
          '境界 / 修為 / 突破保底',
          '靈石與揹包（材料 / 丹藥 / 殘篇 / 靈寵蛋）',
          '裝備 / 功法 / 丹道',
          '洞府建築 / 歷練派遣 / 秘境進度 / 論劍積分',
          '奇遇記錄 / 靈根（轉世重鑄）',
        ],
        lingYuKeepPct: lingYuKeepPct(),
        rpGain: pre.rp, realmCount: pre.realmCount, achCount: pre.achCount,
      };
    },
  };

  XG.sysOrder.push('reincarn');
})();
