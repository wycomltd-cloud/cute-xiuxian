/* pills.js：煉丹數據表（契約 §9.3）——丹方 recipes / 丹爐 furnaces / 異火 fires / 靈草材料 herb_* 登記
 * —— 數據口徑約定（alchemy 等 sys 層實現時遵循）——
 * eff.type 語義：
 *   cult：無 dur → 立即獲得 val 點修為；有 dur → dur 秒內修煉速度 +val%
 *   break：val=大境界突破成功率加值（小數，0.15=+15%），服後存為一次性 buff，突破時消耗；
 *         同一突破最多疊 3 顆（見 cfg.BREAK_PILL_BONUS）；seg:[min,max] 限定可用 realmIdx 閉區間，段外不可服
 *   heal：val=回血比例(0~1)；無 dur 立即回覆，有 dur 為 dur 秒內持續回覆的總量
 *   tox ：val=丹毒變化量（負數為解毒）；解毒丹不受「丹毒>80 禁止服丹」限制
 *   root：val=1 重 roll 五行靈根（grade 不變）；val=2 靈根 grade+1（上限 5）；val=3 → dur 秒內靈根洗練變異率 +25%（數據約定常量）
 *   atk/def/hp：dur 秒內對應戰鬥屬性 +val%（爬塔/守關/論劍生效）
 *   work：dur 秒內靈寵打工產出 +val%（獸用丹）
 *   exp ：出戰靈寵每隻立即獲得 val 點經驗（獸用丹）
 * 丹方 tox 字段 = 玩家服用後丹毒增量，按品階遞增；獸用丹（work/exp）tox=0 不入丹毒。
 * hidden 丹方不進初始 known，解鎖 cond：'explode' 炸爐時概率頓悟 / 'merchant' 坊市神祕商人限售 / 'hiddenmap' 隱藏地圖（歸墟·龍淵）掉落殘方，由 alchemy 系統判定。
 * 非隱藏丹方 alchLv 達標即自動參悟。furnaces：succ=成功率百分點加值，speed=煉製耗時÷speed，cost=購置靈石，id:1 為初始持有。
 * fires：succ=成功率百分點加值，mutPct=變異概率百分點（變異極品效果×1.5、icon 加★）；須先獲取（XG.state.alchemy.fires[id]=1）方可裝備。
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  // ================= 靈草材料（合併進 XG.data.mats，契約 §6 命名空間 herb_*） =================
  // grade 1~9 品階梯度；desc 中暗示獲取渠道（靈田種植/山澤採擷/歷練掉落），供 world/cave 系統引用
  const mats = {
    // —— 一階凡草 ——
    herb_qingling: { name: '青靈草', icon: '🌿', grade: 1, desc: '山澤間最常見的靈草，葉含淡淡青氣。靈田亦可栽植，是百丹之基。 看似小小一株，仙界履歷卻很豐富。' },
    herb_ningxue:  { name: '凝血草', icon: '🌾', grade: 1, desc: '葉緣如鋸齒，斷口滲赤汁。止血良藥，散修行囊常備。 小草很忙，長大還得兼任丹方主角。' },
    herb_ningshen: { name: '寧神花', icon: '🌸', grade: 1, desc: '月夜綻放，幽香安神。沏茶或入藥，皆可定心靜氣。 夜裡不用找燈，先找找自己的行囊。' },
    herb_ziye:     { name: '紫葉蘭', icon: '🌷', grade: 1, desc: '葉背泛紫，生於陰溼巖縫。藥性和緩，多作丹方佐使。 丹爐點了點頭：這次看起來比較有把握。' },
    // —— 二階靈草 ——
    herb_juling:   { name: '聚靈草', icon: '☘️', grade: 2, desc: '葉脈天生聚靈紋路，晨昏之間吞吐靈氣。靈田豐年方得一茬。 小草很忙，長大還得兼任丹方主角。' },
    herb_yuehua:   { name: '月華草', icon: '🌙', grade: 2, desc: '滿月之夜凝露成珠，珠中有月華流轉。陰年陰月採之最佳。 夜裡不用找燈，先找找自己的行囊。' },
    herb_chiyang:  { name: '赤陽花', icon: '🌼', grade: 2, desc: '向陽而生，花色如燃。性烈如火，丹中用之可添三分猛勁。 脾氣偏熱，請溫柔對待。' },
    herb_bingxin:  { name: '冰心蓮', icon: '🪷', grade: 2, desc: '生於寒潭，蓮心一點冰晶。清熱敗毒，解丹毒之首選。 苦是苦了點，身體會默默幫你按讚。' },
    // —— 三階珍品 ——
    herb_xuanbing: { name: '玄冰花', icon: '❄️', grade: 3, desc: '雪嶺絕巔方開，觸手生寒。百年不謝，謝則化水。 冷靜一點，這句話對它倒是很多餘。' },
    herb_huolingzhi:{ name: '火靈芝', icon: '🍄', grade: 3, desc: '長於火山裂隙，芝蓋赤紅流霞。溫補火元，煉丹常用之君藥。 丹爐點了點頭：這次看起來比較有把握。' },
    herb_digen:    { name: '地根參', icon: '🌱', grade: 3, desc: '深埋地脈之處，參形如人。得地氣百年，大補元氣。 仙路漫漫，這點小可愛剛剛好。' },
    herb_jinxian:  { name: '金線蘭', icon: '🎋', grade: 3, desc: '葉脈如金絲纏繞，日光下熠熠生輝。淬體固元之妙品。 夜裡不用找燈，先找找自己的行囊。' },
    // —— 四階靈物 ——
    herb_longxu:   { name: '龍鬚草', icon: '🐉', grade: 4, desc: '傳為真龍鬚落地所生，草莖細長如須，韌不可折。續脈接氣，丹中上品。 龍族出品，排場通常比包裝大。' },
    herb_fengwei:  { name: '鳳尾花', icon: '🦚', grade: 4, desc: '花開如鳳尾舒展，五色流轉。霞光所至，百藥增輝。 輕飄飄的，身價可沒有跟著輕。' },
    herb_yusui:    { name: '玉髓芝', icon: '💮', grade: 4, desc: '芝體晶瑩剔透，內有玉髓流動。生死人肉白骨之輔藥。 小小一份補給，是身體等很久的好消息。' },
    herb_youming:  { name: '幽冥蘭', icon: '🌑', grade: 4, desc: '生於不見天日之谷，花色如墨。性極陰毒，善用者以毒攻毒。 看似小小一株，仙界履歷卻很豐富。' },
    // —— 五階地寶 ——
    herb_tianxing: { name: '天星草', icon: '⭐', grade: 5, desc: '夜映星輝而長，葉上有點點星斑。引星力入丹，可通造化。 漂亮得很低調，只是暗處特別難低調。' },
    herb_dihuo:    { name: '地心火蓮', icon: '🔥', grade: 5, desc: '地火深處千年一開，蓮瓣皆燃而不毀。火性丹藥之至寶。 脾氣偏熱，請溫柔對待。' },
    herb_hansui:   { name: '寒髓花', icon: '🧊', grade: 5, desc: '玄冰之下孕出，花芯一滴寒髓。洗髓煉骨，非此不可。 自帶涼感，仙界夏日人氣款。' },
    herb_leiming:  { name: '雷鳴藤', icon: '⚡', grade: 5, desc: '雷暴之夜瘋長，藤身時有電光遊走。淬靈蕩穢，勁道剛猛。 苦是苦了點，身體會默默幫你按讚。' },
    // —— 六階天材 ——
    herb_xueling:  { name: '血靈菇', icon: '🩸', grade: 6, desc: '生於古戰場血浸之地，菇蓋殷紅欲滴。補精養血，效力雄渾。 師父說有用，你先認真收好。' },
    herb_taiyin:   { name: '太陰芝', icon: '🌚', grade: 6, desc: '陰風洞中偶得，通體幽藍。太陰之精凝結，鎮魂定魄。 安全感很足，師弟看了都想靠近一點。' },
    herb_taiyang:  { name: '太陽精葵', icon: '🌻', grade: 6, desc: '終日逐日而轉，籽中蘊含太陽精火。至陽之品，陰寒丹方賴以調和。 涼到很有存在感，抱著記得加件外套。' },
    // —— 七階仙品 ——
    herb_zhuguo:   { name: '千年朱果', icon: '🍎', grade: 7, desc: '千年一熟，果如赤玉。傳聞食之可增一甲子修為，入丹更佳。 可靠到連蒲團都想請你幫忙看門。' },
    herb_xukong:   { name: '虛空蓮', icon: '🌀', grade: 7, desc: '開於虛空裂隙之畔，時隱時現。採之須趁其現身一瞬。 小小物件，大大修仙日常。' },
    herb_wudao:    { name: '悟道茶', icon: '🍵', grade: 7, desc: '古茶樹萬載成靈，茶葉含道韻。一品之下，玄機自現。 仙路漫漫，這點小可愛剛剛好。' },
    // —— 八階神物 ——
    herb_longxian: { name: '龍涎草', icon: '🐲', grade: 8, desc: '真龍涎液澆灌而生，草香沉鬱千年不散。定魂安魄，渡劫之佐。 龍族出品，排場通常比包裝大。' },
    herb_fengxue:  { name: '鳳血草', icon: '🌺', grade: 8, desc: '鳳凰滴血之地所生，草色殷紅如凝血。內含一絲鳳凰真血。 輕飄飄的，身價可沒有跟著輕。' },
    herb_xuanwu:   { name: '玄武苔', icon: '🐢', grade: 8, desc: '附於玄武遺甲之側，萬年不枯。服之如負玄甲，固若金湯。 穩得讓人安心，對手看了就沒那麼開心。' },
    herb_yaowang:  { name: '萬年藥王', icon: '🍀', grade: 8, desc: '萬年方成的藥中之王，出土時霞光沖霄，四方修士必爭。生死人肉白骨，丹家夢寐以求。 夜裡不用找燈，先找找自己的行囊。' },
    // —— 九階聖藥 ——
    herb_hundun:   { name: '混沌青蓮', icon: '🌌', grade: 9, desc: '天地初開時的一縷混沌氣所化，世間難尋。得之者，丹道可通神。 小小物件，大大修仙日常。' },
    herb_puti:     { name: '菩提子', icon: '📿', grade: 9, desc: '菩提古樹千年結一子。悟者視之見道，迷者視之如石。 鐵匠看見它，笑得比爐火還亮。' },
    herb_busi:     { name: '不死草', icon: '🌳', grade: 9, desc: '傳說中枯榮輪迴而不滅的神草。一葉入口，生死一線可挽回。 採藥時溫柔一點，這可是未來的丹道同事。' },
  };

  // ================= 丹方（34 張：修為 6 檔 / 破境 4 檔 / 療傷 4 / 解毒 3 / 靈根 3 / 靈寵 3 / 打工 2 / 悟性 3 / 戰鬥 6，含隱藏 4） =================
  // v1.9：六種立即修為丹於表後依適用境界整境需求的1%重算；破境丹及限時加速丹維持原效果。
  const recipes = [
    // —— 修為丹·六品階（type:cult 立即修為） ——
    { id: 'pill_juqi', name: '聚氣丹', icon: '💊', grade: 1, hidden: false, alchLv: 1,
      cost: { mat: { herb_qingling: 3, herb_ningxue: 2 }, lingShi: 200 }, time: 30,
      eff: { type: 'cult', val: 1e6 }, tox: 2,
      desc: '青靈與凝血草煉成的入門丹，入口修為立增。小小一顆，把今天的努力打包好了。',
      getHint: '丹房初啓即可參悟。' },
    { id: 'pill_ningyuan', name: '凝元丹', icon: '🔵', grade: 2, hidden: false, alchLv: 2,
      cost: { mat: { herb_juling: 3, herb_yuehua: 2 }, lingShi: 1500 }, time: 60,
      eff: { type: 'cult', val: 4.5e6 }, tox: 3,
      desc: '聚靈草和月華露凝成元丹，築基修士的心頭好。出爐會發光，丹房不用特地關燈表演。',
      getHint: '煉丹等級二階自悟。' },
    { id: 'pill_xuanzhi', name: '玄芝丹', icon: '🟣', grade: 3, hidden: false, alchLv: 3,
      cost: { mat: { herb_yusui: 2, herb_jinxian: 2, herb_juling: 3 }, lingShi: 6000 }, time: 120,
      eff: { type: 'cult', val: 1.8e7 }, tox: 4,
      desc: '玉髓芝配金線蘭，文火三日凝成玄元。聞起來像認真，喫下去也很認真。',
      getHint: '煉丹等級三階自悟。' },
    { id: 'pill_taiyi', name: '太一元丹', icon: '🟡', grade: 4, hidden: false, alchLv: 4,
      cost: { mat: { herb_tianxing: 2, herb_longxu: 2 }, lingShi: 2.5e4 }, time: 240,
      eff: { type: 'cult', val: 7.5e7 }, tox: 5,
      desc: '天星接地脈，丹成還會自己鳴響。這顆很會報到，連開飯鈴都省下了。',
      getHint: '煉丹等級四階自悟。' },
    { id: 'pill_jiuzhuan', name: '九轉金丹', icon: '🌕', grade: 5, hidden: false, alchLv: 5,
      cost: { mat: { herb_zhuguo: 1, herb_taiyang: 2, herb_tianxing: 2 }, lingShi: 1e5 }, time: 420,
      eff: { type: 'cult', val: 3.6e8 }, tox: 7,
      desc: '九轉方成的鎏金修為丹，一粒抵上多年苦坐。蒲團終於可以短暫休個假。',
      getHint: '煉丹等級五階自悟。' },
    { id: 'pill_hundun', name: '混沌一氣丹', icon: '🌌', grade: 6, hidden: true, alchLv: 7, cond: 'hiddenmap',
      cost: { mat: { herb_hundun: 1, herb_puti: 1, herb_zhuguo: 2 }, lingShi: 8e5 }, time: 900,
      eff: { type: 'cult', val: 7.5e9 }, tox: 10,
      desc: '以混沌青蓮為引，丹成如聞開天之音。煉得出這顆，隔壁師兄已經放下手邊的事來圍觀。',
      getHint: '傳聞龍淵深處沉有上古丹方殘頁，有機緣者方可參悟。' },

    // —— 破境丹·四檔（type:break，seg 限定境界段） ——
    { id: 'pill_zhuji', name: '築基丹', icon: '🧱', grade: 2, hidden: false, alchLv: 1,
      cost: { mat: { herb_ningxue: 3, herb_chiyang: 2 }, lingShi: 800 }, time: 90,
      eff: { type: 'break', val: 0.15 }, seg: [0, 0], tox: 3,
      desc: '煉氣圓滿時的破境幫手，護著氣血往築基關口衝。像一位小小啦啦隊，認真替道基加油。',
      getHint: '丹房初啓即可參悟。' },
    { id: 'pill_jiejin', name: '結金丹', icon: '🌰', grade: 4, hidden: false, alchLv: 3,
      cost: { mat: { herb_huolingzhi: 2, herb_jinxian: 2, herb_digen: 2 }, lingShi: 1.2e4 }, time: 300,
      eff: { type: 'break', val: 0.15 }, seg: [1, 1], tox: 5,
      desc: '火靈芝與地根參煉出一點金性，衝擊金丹多一分把握。先喫丹，再練習成功後的鎮定表情。',
      getHint: '煉丹等級三階自悟。' },
    { id: 'pill_huaying', name: '化嬰丹', icon: '👶', grade: 6, hidden: false, alchLv: 5,
      cost: { mat: { herb_fengwei: 2, herb_youming: 2, herb_xueling: 1 }, lingShi: 8e4 }, time: 600,
      eff: { type: 'break', val: 0.15 }, seg: [2, 3], tox: 8,
      desc: '金丹碎、元嬰生的關鍵時刻，替道心加一層守護。重要場合的小護身符，這次是圓的。',
      getHint: '煉丹等級五階自悟。' },
    { id: 'pill_due', name: '渡厄丹', icon: '🛡️', grade: 8, hidden: false, alchLv: 7,
      cost: { mat: { herb_longxian: 1, herb_taiyin: 2, herb_fengxue: 1 }, lingShi: 5e5 }, time: 1200,
      eff: { type: 'break', val: 0.15 }, seg: [4, 8], tox: 12,
      desc: '化神以上步步有劫，以龍涎定魂、太陰鎮魔。陪你走險路，出發前請把心跳放慢一點。',
      getHint: '煉丹等級七階自悟。' },

    // —— 療傷（type:heal） ——
    { id: 'pill_xiaohuan', name: '小還丹', icon: '🟢', grade: 1, hidden: false, alchLv: 1,
      cost: { mat: { herb_ningxue: 2, herb_qingling: 2 }, lingShi: 150 }, time: 20,
      eff: { type: 'heal', val: 0.2 }, tox: 1,
      desc: '散修常備的止血生肌小丸，容易煉、也很實在。師父說行囊可以少帶鏡子，不能少帶這個。',
      getHint: '丹房初啓即可參悟。' },
    { id: 'pill_huichun', name: '回春丹', icon: '💚', grade: 3, hidden: false, alchLv: 2,
      cost: { mat: { herb_ningshen: 2, herb_digen: 2, herb_bingxin: 1 }, lingShi: 3000 }, time: 90,
      eff: { type: 'heal', val: 0.5 }, tox: 3,
      desc: '寧神定魄、幫生機重新發芽的療傷丹。身體低電量時，替你亮起一盞小綠燈。',
      getHint: '煉丹等級二階自悟。' },
    { id: 'pill_yulu', name: '玉露回生丹', icon: '💧', grade: 5, hidden: false, alchLv: 4,
      cost: { mat: { herb_yusui: 2, herb_hansui: 2 }, lingShi: 3e4 }, time: 300,
      eff: { type: 'heal', val: 0.8, dur: 60 }, tox: 5,
      desc: '玉髓與寒髓帶來綿長藥力，一炷香內逐漸續骨療傷。身體正在維修，請耐心等候。',
      getHint: '煉丹等級四階自悟。' },
    { id: 'pill_huanhun', name: '九轉還魂丹', icon: '✨', grade: 8, hidden: true, alchLv: 8, cond: 'explode',
      cost: { mat: { herb_busi: 1, herb_xukong: 1, herb_longxian: 1 }, lingShi: 1e6 }, time: 1500,
      eff: { type: 'heal', val: 1.0 }, tox: 10,
      desc: '九轉還魂的珍稀丹藥，氣若遊絲時仍有生機可求。這顆小圓球，背著非常大的責任。',
      getHint: '炸爐之際偶有所悟——焦煙之中，或窺生死之機。' },

    // —— 解毒（type:tox，val 為負） ——
    { id: 'pill_qingdu', name: '清毒散', icon: '🍵', grade: 1, hidden: false, alchLv: 1,
      cost: { mat: { herb_bingxin: 2, herb_qingling: 1 }, lingShi: 100 }, time: 20,
      eff: { type: 'tox', val: -10 }, tox: 0,
      desc: '冰心蓮研末沖服，幫你清一清初積丹毒。苦得眉毛打結，喝完再來一口溫水抱抱自己。',
      getHint: '丹房初啓即可參悟。' },
    { id: 'pill_bingxinhu', name: '冰心玉壺丹', icon: '🧊', grade: 4, hidden: false, alchLv: 3,
      cost: { mat: { herb_bingxin: 3, herb_xuanbing: 2 }, lingShi: 8000 }, time: 120,
      eff: { type: 'tox', val: -40 }, tox: 0,
      desc: '清涼藥力一路化去丹毒，如雪遇暖湯。身體終於覺得，這次的丹藥不是來添亂。',
      getHint: '煉丹等級三階自悟。' },
    { id: 'pill_wandu', name: '萬毒歸元丹', icon: '☠️', grade: 7, hidden: false, alchLv: 6,
      cost: { mat: { herb_youming: 3, herb_leiming: 2, herb_xueling: 1 }, lingShi: 2e5 }, time: 600,
      eff: { type: 'tox', val: -100 }, tox: 0,
      desc: '幽冥蘭配雷鳴藤，以毒攻毒、蕩去丹毒。配方很有膽量，服用時請相信專業丹方。',
      getHint: '煉丹等級六階自悟。' },

    // —— 靈根（type:root：1 洗靈根 / 2 根骨提升 / 3 變異淬鍊） ——
    { id: 'pill_xisui', name: '洗髓丹', icon: '🫧', grade: 5, hidden: false, alchLv: 4,
      cost: { mat: { herb_hansui: 2, herb_yusui: 2, herb_bingxin: 2 }, lingShi: 5e4 }, time: 480,
      eff: { type: 'root', val: 1 }, tox: 6,
      desc: '洗髓重塑靈根五行，資質不變、路線換一條。身體沒有重開，只是重新選了一門主修。',
      getHint: '煉丹等級四階自悟。' },
    { id: 'pill_zhuanggu', name: '補天壯骨丹', icon: '🦴', grade: 6, hidden: false, alchLv: 5,
      cost: { mat: { herb_digen: 4, herb_xueling: 2, herb_zhuguo: 1 }, lingShi: 1.5e5 }, time: 720,
      eff: { type: 'root', val: 2 }, tox: 8,
      desc: '地根參與朱果補本培元，讓根骨再進一步。先天資質很重要，後天小補丁也不含糊。',
      getHint: '煉丹等級五階自悟。' },
    { id: 'pill_cuiling', name: '淬靈丹', icon: '🌩️', grade: 7, hidden: false, alchLv: 6,
      cost: { mat: { herb_leiming: 2, herb_fengwei: 2, herb_taiyin: 1 }, lingShi: 2.5e5 }, time: 720,
      eff: { type: 'root', val: 3, dur: 1800 }, tox: 9,
      desc: '雷藤淬形、鳳羽引靈，一炷香內洗靈根更有變異機緣。五行之外的小驚喜，請保持期待、保持冷靜。',
      getHint: '煉丹等級六階自悟。' },

    // —— 靈寵經驗（type:exp，獸用無丹毒） ——
    { id: 'pill_lingshou', name: '靈獸丹', icon: '🐾', grade: 2, hidden: false, alchLv: 1,
      cost: { mat: { herb_qingling: 2, herb_chiyang: 1 }, lingShi: 300 }, time: 30,
      eff: { type: 'exp', val: 500 }, tox: 0,
      desc: '靈草和赤陽花搓成的靈寵小丸，聞到就搖尾巴。獸用！主人看起來再想喫，也請忍住。',
      getHint: '丹房初啓即可參悟。' },
    { id: 'pill_zhuangshou', name: '壯獸丹', icon: '🍖', grade: 4, hidden: false, alchLv: 3,
      cost: { mat: { herb_huolingzhi: 2, herb_digen: 2 }, lingShi: 5000 }, time: 120,
      eff: { type: 'exp', val: 5000 }, tox: 0,
      desc: '溫補筋肉、啟發靈智的靈寵丹。小傢伙長大一點，飯盆也很有意見。',
      getHint: '煉丹等級三階自悟。' },
    { id: 'pill_tianshou', name: '天獸真丹', icon: '🦄', grade: 7, hidden: false, alchLv: 6,
      cost: { mat: { herb_fengxue: 1, herb_zhuguo: 2, herb_taiyang: 1 }, lingShi: 1.8e5 }, time: 600,
      eff: { type: 'exp', val: 5e4 }, tox: 0,
      desc: '鳳血與朱果煉成的靈寵補給，連聖獸幼崽都喜歡。高級小點心，餵完記得收好空罐。',
      getHint: '煉丹等級六階自悟。' },

    // —— 打工效率（type:work，獸用無丹毒） ——
    { id: 'pill_lishi', name: '力士丹', icon: '💪', grade: 3, hidden: false, alchLv: 2,
      cost: { mat: { herb_digen: 2, herb_chiyang: 2 }, lingShi: 2000 }, time: 90,
      eff: { type: 'work', val: 30, dur: 3600 }, tox: 0,
      desc: '一個時辰內提升勞作效率，靈寵幹活前的小幫手。力氣變大了，點心獎勵也請準時。',
      getHint: '煉丹等級二階自悟。' },
    { id: 'pill_shengong', name: '神工丹', icon: '⚙️', grade: 6, hidden: false, alchLv: 5,
      cost: { mat: { herb_tianxing: 2, herb_leiming: 2 }, lingShi: 9e4 }, time: 480,
      eff: { type: 'work', val: 60, dur: 7200 }, tox: 0,
      desc: '星草醒神、雷藤壯力，兩個時辰內靈田獸欄皆受益。今天的小隊員，忙得像踩著小風輪。',
      getHint: '煉丹等級五階自悟。' },

    // —— 悟性（type:cult + dur：限時修煉速度加成） ——
    { id: 'pill_wudao', name: '悟道丹', icon: '🍂', grade: 4, hidden: false, alchLv: 3,
      cost: { mat: { herb_wudao: 1, herb_ningshen: 3 }, lingShi: 1e4 }, time: 240,
      eff: { type: 'cult', val: 50, dur: 1800 }, tox: 4,
      desc: '悟道茶配寧神花，半個時辰內幫心神更清明、吐納更得力。腦袋擦亮了，悟性正在排隊進門。',
      getHint: '煉丹等級三階自悟。' },
    { id: 'pill_tihu', name: '醍醐丹', icon: '🥛', grade: 6, hidden: false, alchLv: 5,
      cost: { mat: { herb_wudao: 2, herb_xukong: 1 }, lingShi: 1.2e5 }, time: 600,
      eff: { type: 'cult', val: 120, dur: 3600 }, tox: 7,
      desc: '醍醐灌頂的一個時辰，靈氣湧入、悟性勝過平日。突然想通的感覺，連眉毛都想揚起來。',
      getHint: '煉丹等級五階自悟。' },
    { id: 'pill_puti', name: '菩提醍醐丹', icon: '📿', grade: 9, hidden: true, alchLv: 8, cond: 'merchant',
      cost: { mat: { herb_puti: 2, herb_wudao: 3, herb_hundun: 1 }, lingShi: 1.2e6 }, time: 1800,
      eff: { type: 'cult', val: 250, dur: 7200 }, tox: 12,
      desc: '菩提樹下悟出的丹方，兩個時辰內修行一日千里。腦袋像被輕輕拍了一下：原來如此！',
      getHint: '坊市之中有神祕行商，行蹤不定，或售此丹方，售價不菲。' },

    // —— 戰鬥增益（type:atk/def/hp + dur） ——
    { id: 'pill_zhanyi', name: '戰意丹', icon: '⚔️', grade: 3, hidden: false, alchLv: 2,
      cost: { mat: { herb_chiyang: 3, herb_ningxue: 2 }, lingShi: 2500 }, time: 90,
      eff: { type: 'atk', val: 25, dur: 1800 }, tox: 3,
      desc: '半個時辰內激發戰血、提升攻勢，適合登塔論劍前準備。熱血有了，招式還是得自己記。',
      getHint: '煉丹等級二階自悟。' },
    { id: 'pill_jingang', name: '金剛丹', icon: '🔰', grade: 3, hidden: false, alchLv: 2,
      cost: { mat: { herb_jinxian: 2, herb_digen: 2 }, lingShi: 2500 }, time: 90,
      eff: { type: 'def', val: 25, dur: 1800 }, tox: 3,
      desc: '金線蘭與地根參淬體，半個時辰內提升防護。軟萌外表，也可以有硬派的小底氣。',
      getHint: '煉丹等級二階自悟。' },
    { id: 'pill_xueyuan', name: '血元丹', icon: '❤️', grade: 4, hidden: false, alchLv: 3,
      cost: { mat: { herb_xueling: 2, herb_ningxue: 3 }, lingShi: 9000 }, time: 150,
      eff: { type: 'hp', val: 30, dur: 1800 }, tox: 4,
      desc: '血靈菇熬七日凝成的補血丹，讓氣血更充盈。圓圓一顆，裡面裝著身體想要的踏實感。',
      getHint: '煉丹等級三階自悟。' },
    { id: 'pill_sanmei', name: '三昧真火丹', icon: '🔥', grade: 7, hidden: false, alchLv: 6,
      cost: { mat: { herb_huolingzhi: 3, herb_dihuo: 2, herb_taiyang: 1 }, lingShi: 2.2e5 }, time: 660,
      eff: { type: 'atk', val: 60, dur: 3600 }, tox: 8,
      desc: '地心火蓮封存一縷真火，一個時辰內攻勢帶焰。戰力變熱情了，袖口請離爐火遠一點。',
      getHint: '煉丹等級六階自悟。' },
    { id: 'pill_xuanwudan', name: '玄武鎮嶽丹', icon: '🐢', grade: 6, hidden: false, alchLv: 5,
      cost: { mat: { herb_xuanwu: 1, herb_hansui: 2, herb_digen: 3 }, lingShi: 1e5 }, time: 540,
      eff: { type: 'def', val: 50, dur: 3600 }, tox: 7,
      desc: '玄武苔化成護體藥力，一個時辰內穩穩鎮守。像披上一件看不見的小龜甲，安心加倍。',
      getHint: '煉丹等級五階自悟。' },
    { id: 'pill_duhuo', name: '毒火罡丹', icon: '🧪', grade: 7, hidden: true, alchLv: 6, cond: 'explode',
      cost: { mat: { herb_youming: 3, herb_taiyin: 2, herb_xueling: 2 }, lingShi: 2e5 }, time: 600,
      eff: { type: 'atk', val: 80, dur: 1800 }, tox: 18,
      desc: '炸爐餘燼悟出的邪門丹，以毒養火、威力霸道而丹毒也烈。強歸強，身體的抗議請認真聽。',
      getHint: '炸爐時概率頓悟——邪火入爐，歪打正着。' },
  ];
  recipes.forEach(function(r) {
    if (XG.balance.instantPill(r)) {
      r.eff.val=Math.floor(XG.balance.stageCost(XG.balance.pillRealm(r))*.01);
      r.desc += ' 適用'+XG.cfg.REALMS[XG.balance.pillRealm(r)].name+'起；每顆藥效固定，丹毒另計。';
    }
  });


  // ================= 丹爐（7 座：succ 成功率百分點 / speed 耗時倍率 / cost 靈石，均遞增；id:1 初始持有） =================
  const furnaces = [
    { id: 1, name: '粗陶丹爐', icon: '🏺', succ: 0, speed: 1.0, cost: 0,
      desc: '山間土窯粗陶所制，火候難控，聊勝於無。丹道修行，皆自此爐始。 丹爐點了點頭：這次看起來比較有把握。' },
    { id: 2, name: '青銅丹爐', icon: '⚱️', succ: 3, speed: 1.1, cost: 5e3,
      desc: '青銅鑄身，紋路古樸。火力平穩，丹成之數稍增。 丹爐點了點頭：這次看起來比較有把握。' },
    { id: 3, name: '玄鐵丹爐', icon: '🔩', succ: 6, speed: 1.2, cost: 3e4,
      desc: '北冥玄鐵千錘百煉，爐身沉黑如夜。鎖溫極佳，藥性不泄。 丹爐點了點頭：這次看起來比較有把握。' },
    { id: 4, name: '紫金丹爐', icon: '🔮', succ: 10, speed: 1.35, cost: 2e5,
      desc: '紫金為骨，爐腹暗藏聚火紋。開爐時紫氣氤氳，丹成率頗可觀。 丹爐點了點頭：這次看起來比較有把握。' },
    { id: 5, name: '九龍離火爐', icon: '🐉', succ: 15, speed: 1.5, cost: 1.2e6,
      desc: '爐鑄九龍銜珠，離火自竅中吞吐。相傳為離火宮鎮宮之物，後流轉散仙之手。 請勿拿來煮宵夜，師父會知道。' },
    { id: 6, name: '太乙乾坤爐', icon: '☯️', succ: 21, speed: 1.75, cost: 6e6,
      desc: '內有乾坤，自分陰陽。藥材入爐各歸其位，火候由心，幾近道器。 丹爐點了點頭：這次看起來比較有把握。' },
    { id: 7, name: '太上八卦爐', icon: '🌟', succ: 28, speed: 2.0, cost: 3e7,
      desc: '八卦方位暗合天機，文武火自在流轉。傳說老君爐中煅過石猴——此爐縱非彼爐，亦是人間極致。 丹房裡最安靜、也最燙手的同事。' },
  ];

  // ================= 異火（7 種：succ 成功率百分點 / mutPct 變異率百分點；含 2 種隱藏獲取） =================
  const fires = [
    { id: 'fire_fan', name: '凡火', icon: '🕯️', grade: 0, succ: 0, mutPct: 0,
      getHint: '丹房初啓即有，人人使得。',
      desc: '柴薪之火，最尋常不過。雖無靈性，亦曾煮出無數入門丹藥。 脾氣偏熱，請溫柔對待。' },
    { id: 'fire_difu', name: '地肺真火', icon: '🌋', grade: 2, succ: 5, mutPct: 1,
      getHint: '洞府引地火入丹房，即可馭使。',
      desc: '引地肺之火，溫而不燥，善養藥性。取之不盡，用之不竭。 丹爐點了點頭：這次看起來比較有把握。' },
    { id: 'fire_ziwu', name: '子午天火', icon: '☄️', grade: 3, succ: 9, mutPct: 2,
      getHint: '鎮妖塔每過三十三層，有概率拾得火種。',
      desc: '子午之交，天火墜世。得其一縷，可熔金化玉。 脾氣偏熱，請溫柔對待。' },
    { id: 'fire_qinglian', name: '青蓮淨火', icon: '🪷', grade: 4, succ: 14, mutPct: 3,
      getHint: '歷練地火深澤，偶見青蓮浴火而生，採得火種。',
      desc: '火中生蓮，蓮心吐焰。焰色青碧，最能淬去藥中雜質。 脾氣偏熱，請溫柔對待。' },
    { id: 'fire_jiuyou', name: '九幽冥火', icon: '👻', grade: 5, succ: 18, mutPct: 5,
      getHint: '守關鏖戰至深處，於妖潮餘燼中採得。',
      desc: '九幽之下的冷焰，燃而不熱，專焚藥中戾氣，丹成自有一番幽光。 丹爐點了點頭：這次看起來比較有把握。' },
    { id: 'fire_liuding', name: '六丁神火', icon: '🀄', grade: 6, succ: 24, mutPct: 7, hidden: true,
      getHint: '歸墟之眼，潮退之夜，神火自現。',
      desc: '六丁六甲，神火無質。丹藥過此火一遍，凡胎盡去，時有異變。 脾氣偏熱，請溫柔對待。' },
    { id: 'fire_hundun', name: '混沌虛火', icon: '🌀', grade: 7, succ: 32, mutPct: 10, hidden: true,
      getHint: '炸爐百次，爐火通靈，或自燃成精。',
      desc: '無形無相，似有似無。相傳是爐中百鍊之餘的一點火靈，性喜變異，丹成多出奇品。 丹爐點了點頭：這次看起來比較有把握。' },
  ];

  // 登記掛載（純數據，不觸碰 XG.state）
  XG.data = XG.data || {};
  XG.data.mats = Object.assign(XG.data.mats || {}, mats);
  XG.data.pills = { recipes, furnaces, fires, mats };
})();
