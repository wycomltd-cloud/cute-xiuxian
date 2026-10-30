/* data/gongfa.js —— 功法總表：功法/羈絆/自創詞庫/靈根/經脈穴位（契約 §9.2，純數據登記，不含任何邏輯） */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.data = XG.data || {};

  XG.data.gongfa = {

    /* ============ 功法 list ============
     * eff 為「每級成長」，鍵名嚴格取契約 §7 的 mods 鍵，每功法任選 2~3 項。
     * 普通功法以 unlock:{realmIdx,layer} 解鎖；隱藏功法（hidden:true，grade≥8）以 cond 條件 id 解鎖，
     * cond 五選一：alchemy_explode_10 / tower_33 / fellow_ouhuang_gift / reincarn_1 / codex_pet_20（由 gongfa 系統監聽判定）。
     * 另有 2 部連鎖獎勵隱藏功法 gf_xuanyuan / gf_guixu（grade 9，hidden:true 但走 unlock 大乘1層解鎖，
     * 殘篇僅出自 events_b 對應隱藏連鎖終點，不佔上述 5 個 cond 名額）。
     * 品階與解鎖梯度：g1~g3 煉氣築基 → g4~g5 金丹 → g6 元嬰 → g7 化神 → g8 合體 → g9 大乘，殘篇數隨品階遞增。 */
    list: [
      // —— 一品 · 煉氣入門 ——
      { id: 'gf_qingxin', name: '清心訣', icon: '清', grade: 1, hidden: false, root: 'wuxing',
        desc: '散修人手一本的入門心法。先把心靜下來，再把想喫點心的念頭放下——後者比較難。',
        eff: { cultRatePct: 1, hpPct: 0.5 }, profMax: 1000, fragNeed: 4,
        unlock: { realmIdx: 0, layer: 1 }, getHint: '坊市地攤常見，新手歷練亦可拾得殘篇。' },
      { id: 'gf_changchun', name: '長春功', icon: '春', grade: 1, hidden: false, root: 'mu',
        desc: '像小草一樣慢慢長大的功法，養氣養血養耐心。至少不用每天幫自己澆水。',
        eff: { cultRatePct: 0.8, hpFlat: 30 }, profMax: 1000, fragNeed: 4,
        unlock: { realmIdx: 0, layer: 1 }, getHint: '雲夢澤畔的採藥人，常以殘篇換些靈石。' },
      { id: 'gf_liehuo', name: '烈火功', icon: '焰', grade: 1, hidden: false, root: 'huo',
        desc: '把胸中小火苗練成大火力。出招很熱情，脾氣也要記得降溫。',
        eff: { atkPct: 1, cultRatePct: 0.5 }, profMax: 1000, fragNeed: 4,
        unlock: { realmIdx: 0, layer: 2 }, getHint: '低階歷練之地多有流出，殘篇易得。' },

      // —— 二品 · 煉氣精進 ——
      { id: 'gf_houtu', name: '厚土訣', icon: '嶽', grade: 2, hidden: false, root: 'tu',
        desc: '把自己練得像座小山，風吹雨打都不動。師父說這叫穩重，師兄說是懶得起來。',
        eff: { defPct: 1.2, hpPct: 0.8 }, profMax: 1000, fragNeed: 6,
        unlock: { realmIdx: 0, layer: 4 }, getHint: '坊市偶有成冊，歷練殘篇亦可拼湊。' },
      { id: 'gf_shuilan', name: '水瀾訣', icon: '瀾', grade: 2, hidden: false, root: 'shui',
        desc: '真氣像流水繞過石頭，柔柔的也能很有力。遇到難題，先學水轉個彎。',
        eff: { cultRatePct: 1.2, defPct: 0.6 }, profMax: 1000, fragNeed: 6,
        unlock: { realmIdx: 0, layer: 4 }, getHint: '江河湖澤之畔歷練，時有殘篇出水。' },
      { id: 'gf_jinfeng', name: '金鋒訣', icon: '鋒', grade: 2, hidden: false, root: 'jin',
        desc: '在指尖凝出庚金之氣，劍修入門必備。切磋很俐落，削水果請另外拿刀。',
        eff: { atkPct: 1.2, atkFlat: 6 }, profMax: 1000, fragNeed: 6,
        unlock: { realmIdx: 0, layer: 5 }, getHint: '劍廬外門弟子流落之物，坊市可購。' },

      // —— 三品 · 煉氣圓滿 ——
      { id: 'gf_qingmu', name: '青木長生功', icon: '木', grade: 3, hidden: false, root: 'mu',
        desc: '青木養百脈，修為和靈田一起欣欣向榮。練成後像行走的小盆栽，只是比較會打架。',
        eff: { cultRatePct: 1.6, hpPct: 1, workPct: 1.5 }, profMax: 1000, fragNeed: 9,
        unlock: { realmIdx: 0, layer: 8 }, getHint: '靈田深處偶得殘篇，丹修手中亦有抄本。' },
      { id: 'gf_xuanbing', name: '玄冰真解', icon: '冰', grade: 3, hidden: false, root: 'shui',
        desc: '以寒潭玄冰練出攻守兼備的真氣。氣場很冷，對朋友還是要暖一點。',
        eff: { defPct: 1.8, atkPct: 1, hpPct: 1 }, profMax: 1000, fragNeed: 9,
        unlock: { realmIdx: 0, layer: 9 }, getHint: '極北寒潭之底，封着半卷真解。' },
      { id: 'gf_leiyin', name: '雷引訣', icon: '雷', grade: 3, hidden: false, root: 'jin',
        desc: '引九天雷氣入體，運功自帶轟隆聲。氣勢很足，隔壁洞府已經開始敲牆。',
        eff: { atkPct: 2, cultRatePct: 0.8 }, profMax: 1000, fragNeed: 9,
        unlock: { realmIdx: 1, layer: 1 }, getHint: '雷雨夜歷練高山之巔，或可遇雷紋石壁。' },

      // —— 四品 · 築基佳品 ——
      { id: 'gf_wanjian', name: '萬劍朝元訣', icon: '劍', grade: 4, hidden: false, root: 'jin',
        desc: '萬劍朝宗的劍修聖典，打怪尋寶都拿手。劍很多，收納也是門大學問。',
        eff: { atkPct: 2.5, dropPct: 1.5 }, profMax: 1000, fragNeed: 12,
        unlock: { realmIdx: 1, layer: 3 }, getHint: '劍冢深處殘篇散落，需以劍意引之。' },
      { id: 'gf_huanyuan', name: '浣元妙典', icon: '浣', grade: 4, hidden: false, root: 'wuxing',
        desc: '洗一洗真氣，修一修丹道。內在清爽很重要，丹爐還是得自己刷。',
        eff: { cultRatePct: 2.2, alchSuccPct: 1.5 }, profMax: 1000, fragNeed: 12,
        unlock: { realmIdx: 1, layer: 5 }, getHint: '浣花谷舊址歷練，溪底偶見蠟封殘卷。' },
      { id: 'gf_bihai', name: '碧海潮生功', icon: '潮', grade: 4, hidden: false, root: 'shui',
        desc: '內力如海，氣機像潮水綿綿不絕。心胸要寬，至少比靈石袋寬一點。',
        eff: { hpPct: 2, defPct: 1.5, cultRatePct: 1 }, profMax: 1000, fragNeed: 12,
        unlock: { realmIdx: 1, layer: 7 }, getHint: '東海之濱聽潮十年者，或能悟得一二。' },

      // —— 五品 · 金丹典藏 ——
      { id: 'gf_taiqing', name: '太清玄元經', icon: '太', grade: 5, hidden: false, root: 'wuxing',
        desc: '太清正統道經，幫道心站穩腳跟。突破時多一分底氣，少一分假裝鎮定。',
        eff: { cultRatePct: 2.8, breakSuccPct: 0.5 }, profMax: 1000, fragNeed: 16,
        unlock: { realmIdx: 2, layer: 1 }, getHint: '太清觀藏經閣遺散之書，坊市中一頁千金。' },
      { id: 'gf_fenyan', name: '焚炎九轉功', icon: '焚', grade: 5, hidden: false, root: 'huo',
        desc: '九轉火功，一轉比一轉熱鬧。練到高深能焚山煮海，別順便把晚餐煮焦。',
        eff: { atkPct: 3, atkFlat: 20 }, profMax: 1000, fragNeed: 16,
        unlock: { realmIdx: 2, layer: 3 }, getHint: '火焰山秘境深處，岩漿之下埋着赤玉殘簡。' },
      { id: 'gf_cangling', name: '藏靈納海訣', icon: '藏', grade: 5, hidden: false, root: 'wuxing',
        desc: '把百川靈氣好好存起來，神遊時也慢慢入帳。仙界版小豬撲滿，存的是修為。',
        eff: { cultRatePct: 2, offlineHours: 0.25, hpPct: 1.5 }, profMax: 1000, fragNeed: 16,
        unlock: { realmIdx: 2, layer: 5 }, getHint: '歸墟舊聞中提及此訣，隱世散修或藏抄本。' },

      // —— 六品 · 元嬰真傳 ——
      { id: 'gf_longxiang', name: '龍象鎮嶽功', icon: '象', grade: 6, hidden: false, root: 'tu',
        desc: '把龍象之力練進氣血筋骨。看起來圓滾滾，實際上是很結實的圓滾滾。',
        eff: { defPct: 3.2, hpPct: 2.5, hpFlat: 120 }, profMax: 1000, fragNeed: 20,
        unlock: { realmIdx: 3, layer: 1 }, getHint: '大漠古剎的壁畫之後，藏着完整的功法石刻。' },
      { id: 'gf_zixiao', name: '紫霄神雷策', icon: '霄', grade: 6, hidden: false, root: 'jin',
        desc: '御雷如揮手，雷光一到羣魔讓路。出場音效太豪華，想低調都有點難。',
        eff: { atkPct: 3.5, cultRatePct: 1.5 }, profMax: 1000, fragNeed: 20,
        unlock: { realmIdx: 3, layer: 5 }, getHint: '雷澤秘境九死一生，策文刻於避雷古木之上。' },

      // —— 七品 · 化神祕典 ——
      { id: 'gf_yimu', name: '乙木造化書', icon: '乙', grade: 7, hidden: false, root: 'mu',
        desc: '乙木滋養靈植，也讓丹道受益。你的綠手指，現在連丹爐都想握一下。',
        eff: { alchSuccPct: 2.5, cultRatePct: 2.5, hpPct: 2 }, profMax: 1000, fragNeed: 25,
        unlock: { realmIdx: 4, layer: 1 }, getHint: '萬年靈木心液浸過的書頁，唯丹道大家識得。' },
      { id: 'gf_taixuan', name: '太玄洞真錄', icon: '玄', grade: 7, hidden: false, root: 'wuxing',
        desc: '觀太玄、看本真，參悟突破的門道。大道很深，先別看到一半就睡著。',
        eff: { cultRatePct: 3.5, breakSuccPct: 0.8, dropPct: 2 }, profMax: 1000, fragNeed: 25,
        unlock: { realmIdx: 4, layer: 3 }, getHint: '太玄山崩裂後露出的洞府石匣，有緣者得之。' },

      // —— 八品 · 合體奇經（含 3 種隱藏） ——
      { id: 'gf_honglian', name: '紅蓮業火經', icon: '蓮', grade: 8, hidden: false, root: 'huo',
        desc: '紅蓮業火煉體，攻勢火力全開。定力要夠，不然先燒掉的可能是自己的瀏海。',
        eff: { atkPct: 4.5, atkFlat: 80, hpPct: 2 }, profMax: 1000, fragNeed: 32,
        unlock: { realmIdx: 6, layer: 1 }, getHint: '幽冥血海之畔，紅蓮開處自有傳承現世。' },
      { id: 'gf_danjie', name: '丹劫焚心訣', icon: '丹', grade: 8, hidden: true, root: 'huo',
        desc: '炸過十次丹爐，終於從灰裡悟出丹武真意。學費很貴，掃地也掃得很熟練。',
        eff: { alchSuccPct: 4, atkPct: 3, cultRatePct: 2.5 }, profMax: 1000, fragNeed: 32,
        cond: 'alchemy_explode_10', getHint: '丹道多舛——炸爐十次之後，灰燼中或有玄機。' },
      { id: 'gf_qingtian', name: '擎天鎮獄功', icon: '柱', grade: 8, hidden: true, root: 'tu',
        desc: '承接古塔巨擘的意志，練出撐天柱般的防禦。安全感十足，借你靠一下也可以。',
        eff: { defPct: 5, hpPct: 4, hpFlat: 300 }, profMax: 1000, fragNeed: 32,
        cond: 'tower_33', getHint: '鎮妖塔三十三層，塔心深處藏着不為人知的傳承。' },
      { id: 'gf_wanling', name: '萬靈朝宗訣', icon: '靈', grade: 8, hidden: true, root: 'mu',
        desc: '通曉萬靈之語，百獸幫忙、百鳥送芝。看似仙風道骨，其實每天都在開寵物家長會。',
        eff: { cultRatePct: 4, workPct: 4, hpPct: 3 }, profMax: 1000, fragNeed: 32,
        cond: 'codex_pet_20', getHint: '靈寵圖鑑集至二十種，萬靈感念其誠，自有機緣。' },

      // —— 九品 · 大乘道典（含 4 種隱藏：2 種 cond + 2 種連鎖獎勵） ——
      { id: 'gf_hongmeng', name: '鴻蒙開闢經', icon: '鴻', grade: 9, hidden: false, root: 'wuxing',
        desc: '開天初始的一縷道音化成的經卷。內容從宇宙第一頁講起，沒有懶人包。',
        eff: { cultRatePct: 6, breakSuccPct: 1.2, atkPct: 4 }, profMax: 1000, fragNeed: 40,
        unlock: { realmIdx: 7, layer: 1 }, getHint: '大乘之後，於絕域深處參悟太古石壁遺刻。' },
      { id: 'gf_xuanyuan', name: '軒轅劍經', icon: '轅', grade: 9, hidden: true, root: 'jin',
        desc: '日月山川盡藏劍意，萬劍見了都低頭。這把劍的輩分，比整個宗門都大。',
        eff: { atkPct: 6, atkFlat: 200, breakSuccPct: 1 }, profMax: 1000, fragNeed: 40,
        unlock: { realmIdx: 7, layer: 1 }, getHint: '隱藏連鎖「軒轅劍冢」（夜夢劍冢→劍冢現世→萬劍朝宗→軒轅一劍）終點可得殘篇。' },
      { id: 'gf_guixu', name: '歸墟萬法經', icon: '墟', grade: 9, hidden: true, root: 'wuxing',
        desc: '萬水歸墟，萬法歸一；老人垂釣萬載才送一頁。不是印刷慢，是機緣真的很慢。',
        eff: { cultRatePct: 6, breakSuccPct: 1.5, defPct: 4 }, profMax: 1000, fragNeed: 40,
        unlock: { realmIdx: 7, layer: 1 }, getHint: '隱藏連鎖「歸墟」（歸墟龜甲→海眼吞星→墟中老人→歸墟之眼）終點可得殘篇。' },
      { id: 'gf_hongyun', name: '鴻運通寶錄', icon: '運', grade: 9, hidden: true, root: 'wuxing',
        desc: '出門遇寶、打鐵順手的好運寶典。道友都想借你摸一下自己的抽籤筒。',
        eff: { dropPct: 6, cultRatePct: 4, forgeSuccPct: 3 }, profMax: 1000, fragNeed: 40,
        cond: 'fellow_ouhuang_gift', getHint: '那位氣運逆天的道友，興許願意割愛一卷天書。' },
      { id: 'gf_wangsheng', name: '往生涅槃經', icon: '槃', grade: 9, hidden: true, root: 'wuxing',
        desc: '走過一世輪回，才讀得懂死生之間的逍遙。人生重來一次，這次記得帶筆記。',
        eff: { cultRatePct: 7, breakSuccPct: 1.5, hpPct: 5 }, profMax: 1000, fragNeed: 40,
        cond: 'reincarn_1', getHint: '歷一次輪迴之後，前世記憶碎片中將浮現此經。' },
    ],

    /* ============ 功法羈絆 bonds ============
     * 集齊 need 中全部功法即激活額外加成（eff 鍵名同契約 §7）。 */
    bonds: [
      { id: 'bond_wuxingyi', name: '五行歸一',
        need: ['gf_changchun', 'gf_liehuo', 'gf_houtu', 'gf_shuilan', 'gf_jinfeng'],
        eff: { cultRatePct: 15, hpPct: 10 },
        desc: '五行一起轉，真氣自己排好班。五位師兄終於學會團隊合作。' },
      { id: 'bond_leihuo', name: '雷火燎原',
        need: ['gf_leiyin', 'gf_fenyan'],
        eff: { atkPct: 20 },
        desc: '雷借火勢、火助雷威。兩位熱血隊友同框，對手先收到一份焦香警告。' },
      { id: 'bond_canglang', name: '滄浪濯纓',
        need: ['gf_xuanbing', 'gf_bihai'],
        eff: { defPct: 18, hpPct: 12 },
        desc: '玄冰守骨，碧海藏心。防禦像冰箱一樣可靠，但不能真的把點心放進去。' },
      { id: 'bond_jianlei', name: '劍雷雙絕',
        need: ['gf_wanjian', 'gf_zixiao'],
        eff: { atkPct: 25, dropPct: 8 },
        desc: '劍氣引來紫霄雷光，鋒芒再升級。對手耳邊只剩一句：這音效有點太大。' },
      { id: 'bond_danmu', name: '丹木同源',
        need: ['gf_qingmu', 'gf_yimu'],
        eff: { alchSuccPct: 12, workPct: 15 },
        desc: '青木乙木一起養丹，種田與煉丹兩頭受益。真正的自產自銷，連小草都有參與感。' },
      { id: 'bond_taitai', name: '太清太玄',
        need: ['gf_taiqing', 'gf_taixuan'],
        eff: { cultRatePct: 25, breakSuccPct: 3 },
        desc: '太清太玄一起讀，突破更有把握。兩本都很玄，至少考前不用臨時抱佛腳。' },
      { id: 'bond_kaitian', name: '開天遺音',
        need: ['gf_honglian', 'gf_hongmeng'],
        eff: { atkPct: 30, hpPct: 30, cultRatePct: 20 },
        desc: '紅蓮清舊世，鴻蒙開新天。兩門奇經一起共鳴，宗門隔音工程急需升級。' },
      { id: 'bond_xiangsi', name: '向死而生',
        need: ['gf_danjie', 'gf_wangsheng'],
        eff: { breakSuccPct: 5, cultRatePct: 30 },
        desc: '炸爐不倒、輪回再來，越練越懂重生。堅強的道心，也需要一把耐用掃帚。' },
    ],

    /* ============ 自創功法詞庫 createPool ============
     * 規則（由 gongfa 系統實現）：化神 1 層解鎖（XG.cfg.UNLOCKS.gongfaCreate）；
     * 消耗功法殘篇 roll 詞條——prefix / core / suffix 各取一詞，按「前綴+核心+後綴」拼合功法名，
     * 再按消耗殘篇的品階與數量 roll 成品 grade 與 eff 詞條。 */
    createPool: {
      prefix: ['太清', '玉清', '上清', '太玄', '紫霄', '九霄', '玄冥', '赤霄', '碧落', '青冥', '白虹', '蒼梧', '燭龍', '鴻蒙', '混元', '無極', '太乙', '玄黃'],
      core: ['玄元', '神雷', '靈汐', '星斗', '山河', '雲霞', '風雷', '水火', '陰陽', '五行', '乾坤', '造化', '生死', '輪迴', '天龍', '元磁', '空明', '滄海'],
      suffix: ['真經', '寶籙', '祕典', '玄功', '心法', '劍經', '丹書', '靈篇', '道藏', '古卷', '天書', '神章', '妙訣', '遺篇', '禁典', '仙錄'],
    },

    /* ============ 靈根 roots ============
     * 五行常見（w 高 mult 低）；變異（冰/雷/風/暗/光）稀有；混沌為隱藏靈根（權重極低）。
     * mult=修煉速率加成倍率，稀有度越高 mult 越大、w 越小。洗練規則由 cultivation 系統實現。 */
    roots: [
      { id: 'jin', name: '金靈根', w: 20, mult: 1.0, hidden: false, desc: '鋒利的庚金靈根，劍修常見。嘴上說隨和，出劍倒是很有自己的想法。' },
      { id: 'mu', name: '木靈根', w: 20, mult: 1.0, hidden: false, desc: '生機滿滿的乙木靈根，適合丹道與靈植。連窗邊快枯的小草都想認你當親戚。' },
      { id: 'shui', name: '水靈根', w: 20, mult: 1.0, hidden: false, desc: '真氣綿長的壬水靈根，韌性一流。慢慢來，水滴都能把石頭說服。' },
      { id: 'huo', name: '火靈根', w: 20, mult: 1.0, hidden: false, desc: '火力十足的丙火靈根，攻伐修行都熱情。先深呼吸，仙人也要管理脾氣。' },
      { id: 'tu', name: '土靈根', w: 20, mult: 1.0, hidden: false, desc: '穩穩當當的戊土靈根，擅長守護根基。不容易被撼動，也不容易被叫出被窩。' },
      { id: 'bing', name: '冰靈根', w: 6, mult: 1.5, hidden: false, desc: '水行變異的冰靈根，攻守都冷靜。出場自帶涼風，夏天很受道友歡迎。' },
      { id: 'lei', name: '雷靈根', w: 5, mult: 1.6, hidden: false, desc: '金行變異的雷靈根，攻伐格外俐落。請勿靠近晾衣架，師父說真的。' },
      { id: 'feng', name: '風靈根', w: 4, mult: 1.7, hidden: false, desc: '木行變異的風靈根，身法輕快。走路像一陣風，髮型像另一陣風。' },
      { id: 'an', name: '暗靈根', w: 3, mult: 1.85, hidden: false, desc: '幽冥之氣化成的暗靈根，深藏不露。適合夜行，找鑰匙時就沒那麼方便。' },
      { id: 'guang', name: '光靈根', w: 2, mult: 2.0, hidden: false, desc: '曜靈護身的光靈根，諸邪難近。走到哪都亮晶晶，想躲點名有點困難。' },
      { id: 'hundun', name: '混沌靈根', w: 1, mult: 3.0, hidden: true, desc: '五行未分的稀有混沌靈根。師父看了沉默半天，最後只說：這孩子的說明書呢？' },
    ],

    /* ============ 經脈穴位 meridians ============
     * 三條支線：手太陰（吐納養氣，主修煉速率）/ 足少陽（強筋壯骨，主戰鬥屬性）/ 任督（貫通天地，主破境機緣）。
     * need 為前置穴位 id 列表，線內鏈式推進；cost 為點亮所需修為，沿鏈遞增（量級對齊 XG.cfg.REALMS 各境界 rate，
     * 手太陰≈煉氣築基、足少陽≈築基金丹、任督≈金丹至化神，保證無法一蹴而就）。 */
    meridians: [
      // —— 手太陰（肺經九穴）：養氣歸元，主 cultRatePct ——
      { id: 'm_st1', name: '中府', branch: '手太陰', cost: 50, eff: { cultRatePct: 2 }, need: [] },
      { id: 'm_st2', name: '雲門', branch: '手太陰', cost: 150, eff: { cultRatePct: 2.5 }, need: ['m_st1'] },
      { id: 'm_st3', name: '天府', branch: '手太陰', cost: 400, eff: { cultRatePct: 3, hpPct: 1 }, need: ['m_st2'] },
      { id: 'm_st4', name: '俠白', branch: '手太陰', cost: 1e3, eff: { cultRatePct: 3.5 }, need: ['m_st3'] },
      { id: 'm_st5', name: '尺澤', branch: '手太陰', cost: 2.5e3, eff: { cultRatePct: 4, hpPct: 2 }, need: ['m_st4'] },
      { id: 'm_st6', name: '孔最', branch: '手太陰', cost: 6e3, eff: { cultRatePct: 4.5, workPct: 3 }, need: ['m_st5'] },
      { id: 'm_st7', name: '列缺', branch: '手太陰', cost: 1.5e4, eff: { cultRatePct: 5 }, need: ['m_st6'] },
      { id: 'm_st8', name: '經渠', branch: '手太陰', cost: 4e4, eff: { cultRatePct: 5.5, alchSuccPct: 2 }, need: ['m_st7'] },
      { id: 'm_st9', name: '太淵', branch: '手太陰', cost: 1e5, eff: { cultRatePct: 7, hpPct: 3 }, need: ['m_st8'] },

      // —— 足少陽（膽經九穴）：強筋壯骨，主攻防氣血 ——
      { id: 'm_sy1', name: '瞳子髎', branch: '足少陽', cost: 1e3, eff: { atkPct: 2 }, need: [] },
      { id: 'm_sy2', name: '風池', branch: '足少陽', cost: 3e3, eff: { atkPct: 2.5, defPct: 1 }, need: ['m_sy1'] },
      { id: 'm_sy3', name: '肩井', branch: '足少陽', cost: 8e3, eff: { atkPct: 3, hpPct: 1.5 }, need: ['m_sy2'] },
      { id: 'm_sy4', name: '居髎', branch: '足少陽', cost: 2e4, eff: { defPct: 3, hpPct: 2 }, need: ['m_sy3'] },
      { id: 'm_sy5', name: '環跳', branch: '足少陽', cost: 6e4, eff: { atkPct: 3.5, hpFlat: 200 }, need: ['m_sy4'] },
      { id: 'm_sy6', name: '陽陵泉', branch: '足少陽', cost: 1.5e5, eff: { atkPct: 4, defPct: 2 }, need: ['m_sy5'] },
      { id: 'm_sy7', name: '光明', branch: '足少陽', cost: 4e5, eff: { atkPct: 4.5, hpPct: 2.5 }, need: ['m_sy6'] },
      { id: 'm_sy8', name: '懸鐘', branch: '足少陽', cost: 1e6, eff: { atkPct: 5, defPct: 2.5 }, need: ['m_sy7'] },
      { id: 'm_sy9', name: '丘墟', branch: '足少陽', cost: 3e6, eff: { atkPct: 6, hpPct: 4 }, need: ['m_sy8'] },

      // —— 任督（二脈九穴）：貫通天地，主破境與綜合 ——
      { id: 'm_rd1', name: '關元', branch: '任督', cost: 5e4, eff: { cultRatePct: 5, breakSuccPct: 0.5 }, need: [] },
      { id: 'm_rd2', name: '氣海', branch: '任督', cost: 1.5e5, eff: { cultRatePct: 6, hpPct: 3 }, need: ['m_rd1'] },
      { id: 'm_rd3', name: '神闕', branch: '任督', cost: 5e5, eff: { breakSuccPct: 0.8, defPct: 3 }, need: ['m_rd2'] },
      { id: 'm_rd4', name: '膻中', branch: '任督', cost: 1.5e6, eff: { cultRatePct: 7, atkPct: 3 }, need: ['m_rd3'] },
      { id: 'm_rd5', name: '命門', branch: '任督', cost: 5e6, eff: { breakSuccPct: 1, hpPct: 4 }, need: ['m_rd4'] },
      { id: 'm_rd6', name: '大椎', branch: '任督', cost: 1.5e7, eff: { cultRatePct: 8, atkPct: 4 }, need: ['m_rd5'] },
      { id: 'm_rd7', name: '風府', branch: '任督', cost: 5e7, eff: { breakSuccPct: 1.2, defPct: 4 }, need: ['m_rd6'] },
      { id: 'm_rd8', name: '百會', branch: '任督', cost: 2e8, eff: { cultRatePct: 10, breakSuccPct: 1.5 }, need: ['m_rd7'] },
      { id: 'm_rd9', name: '神庭', branch: '任督', cost: 8e8, eff: { cultRatePct: 12, breakSuccPct: 2, hpPct: 5 }, need: ['m_rd8'] },
    ],
  };
})();
