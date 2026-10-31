/* world.js：世界地圖、秘境副本與坊市規則數據（契約 §9.6）—— 純數據登記，不含邏輯 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.data = XG.data || {};
  XG.data.mats = XG.data.mats || {};

  /* ==================== 材料登記（併入 XG.data.mats） ====================
   * 本文件負責登記：ore_*（礦石 12 種）、gem_*（寶石 10 種）、beast_*（妖獸材料 13 種）、sp_*（地圖特產 9 種）。
   * herb_* 由煉丹批次（pills.js）主登記；此處僅對本圖掉落引用到的 9 種低階 herb 做「保底登記」：
   *   一律「存在則不覆蓋」，絕不改寫他人條目，保證與煉丹批次不衝突。
   *   中高階地圖（萬妖嶺起）掉落表另直接引用 pills.js 主登記的丹方靈草（四~九階），
   *   按圖階配品：萬妖嶺g4 / 北海g4~5 / 焚天g5~6 / 幽冥g6 / 歸墟g5~9 / 龍淵g8~9，無需重複登記。
   * grade 口徑（材料表自定義）：0 凡 / 1 靈 / 2 寶 / 3 仙 / 4 神。
   */
  const MATS = {
    /* ---- herb_* 保底登記（主登記在 pills.js，若煉丹批次已登記則跳過） ---- */
    herb_lingzhi:    { name: '靈芝',   icon: '芝', grade: 1, desc: '深山朽木所生，霞蓋雲紋，益氣養神，丹家最常用。 看似小小一株，仙界履歷卻很豐富。' },
    herb_fuling:     { name: '茯苓',   icon: '苓', grade: 1, desc: '抱松根而生，質白如玉，寧心安神，可入百般丹方。 小草很忙，長大還得兼任丹方主角。' },
    herb_huangjing:  { name: '黃精',   icon: '精', grade: 1, desc: '得坤土之氣，九蒸九曬後甘美如飴，食之延年。 師父說有用，你先認真收好。' },
    herb_renshen:    { name: '人蔘',   icon: '參', grade: 2, desc: '形如嬰孩，藏精納靈，百年者已屬難得。 小小物件，大大修仙日常。' },
    herb_heshouwu:   { name: '何首烏', icon: '烏', grade: 2, desc: '藤蔓夜交，塊根似人形，烏髮固精之聖藥。 小草很忙，長大還得兼任丹方主角。' },
    herb_xuelian:    { name: '雪蓮',   icon: '蓮', grade: 2, desc: '生於萬仞冰崖，凌寒獨放，清火解毒有奇效。 苦是苦了點，身體會默默幫你按讚。' },
    herb_chiyancao:  { name: '赤焰草', icon: '焰', grade: 3, desc: '葉脈如火紋遊走，觸之灼手，唯焚天谷地熱可育。 脾氣偏熱，請溫柔對待。' },
    herb_longxiancao:{ name: '龍涎草', icon: '涎', grade: 3, desc: '傳為蛟龍涎液滴落所生，異香經月不散。 龍族出品，排場通常比包裝大。' },
    herb_hunyuancao: { name: '混元草', icon: '混', grade: 4, desc: '一莖三葉，葉分五色，暗合混元之理，丹家求之難得。 師父說有用，你先認真收好。' },

    /* ---- ore_* 礦石（12 種，本文件主登記） ---- */
    ore_qingtong:    { name: '青銅',     icon: '銅', grade: 0, desc: '山間常見之礦，鑄器入門之材，百鍊亦可成鋒。 出場很有氣勢，收招記得看路。' },
    ore_heite:       { name: '黑鐵',     icon: '鐵', grade: 0, desc: '色沉如墨，質堅而脆，煉去雜質方堪大用。 穩得讓人安心，對手看了就沒那麼開心。' },
    ore_xuantie:     { name: '玄鐵',     icon: '玄', grade: 1, desc: '色玄而重逾常鐵三倍，劍修夢寐以求。 氣勢到位，旁邊的師弟已經坐直。' },
    ore_wuxingsha:   { name: '五行砂',   icon: '砂', grade: 1, desc: '五色礦砂相生相剋，佈陣鑄器兩宜。 修仙也要穿搭，仙氣請自行加滿。' },
    ore_miyin:       { name: '祕銀',     icon: '銀', grade: 2, desc: '月華所淬，輕若鴻羽而韌逾精鋼。 輕飄飄的，身價可沒有跟著輕。' },
    ore_jingjin:     { name: '精金',     icon: '金', grade: 2, desc: '百鍊之精，金光內蘊，凡火難熔。 脾氣偏熱，請溫柔對待。' },
    ore_hantie:      { name: '萬年寒鐵', icon: '寒', grade: 3, desc: '沉於北海玄冰之下萬載，入手幾欲凍裂筋骨。 自帶涼感，仙界夏日人氣款。' },
    ore_chijing:     { name: '赤晶銅',   icon: '赤', grade: 3, desc: '地火熔漿中結晶而成，赤光灼灼，導熱極佳。 脾氣偏熱，請溫柔對待。' },
    ore_mingtie:     { name: '幽冥玄鐵', icon: '冥', grade: 3, desc: '幽冥澗底陰煞所孕，黝黑無光，煉器可附蝕魂之威。 夜裡不用找燈，先找找自己的行囊。' },
    ore_xingchenjin: { name: '星辰金',   icon: '星', grade: 4, desc: '傳為星屑墜地所化，夜觀之有銀輝流轉。 夜裡亮晶晶，照路與擺帥兩相宜。' },
    ore_longwenjin:  { name: '龍紋金',   icon: '紋', grade: 4, desc: '金紋如龍游走，乃龍氣浸潤千年之寶。 龍族出品，排場通常比包裝大。' },
    ore_hundunjin:   { name: '混沌母金', icon: '沌', grade: 4, desc: '天地未分時一點精金，可孕萬器之胚。 行囊變重一點，未來就閃亮一點。' },

    /* ---- gem_* 寶石（10 種，本文件主登記） ---- */
    gem_lingcui: { name: '靈翠',   icon: '翠', grade: 0, desc: '青山靈氣凝成之翠石，微光瑩然。 夜裡亮晶晶，照路與擺帥兩相宜。' },
    gem_biyu:    { name: '碧玉',   icon: '碧', grade: 1, desc: '蒼梧深澗所產，色如春水，溫潤養人。 仙路漫漫，這點小可愛剛剛好。' },
    gem_zijing:  { name: '紫晶',   icon: '紫', grade: 1, desc: '紫氣東來之象，蘊雷光於內。 亮晶晶的，摸之前請先深呼吸。' },
    gem_xuepo:   { name: '血珀',   icon: '珀', grade: 2, desc: '古獸精血封於松脂萬載而成，殷紅欲滴。 身體說謝謝，道心說再來一點。' },
    gem_hanyu:   { name: '寒玉',   icon: '玉', grade: 2, desc: '觸手生寒，佩之可定心神、闢火毒。 涼到很有存在感，抱著記得加件外套。' },
    gem_xinghui: { name: '星輝石', icon: '輝', grade: 3, desc: '夜半自生微光，如掬一捧星河。 夜裡不用找燈，先找找自己的行囊。' },
    gem_yanxin:  { name: '焰心石', icon: '焰', grade: 3, desc: '地火之心凝就，內有一絲不滅之焰。 脾氣偏熱，請溫柔對待。' },
    gem_mingzhu: { name: '幽冥珠', icon: '珠', grade: 3, desc: '陰華凝聚，幽光泠泠，可照九泉之路。 漂亮得很低調，只是暗處特別難低調。' },
    gem_guixuyu: { name: '歸墟玉', icon: '墟', grade: 4, desc: '萬水歸處沉澱之玉，內有潮汐之聲。 師父說有用，你先認真收好。' },
    gem_longmu:  { name: '龍目珠', icon: '目', grade: 4, desc: '傳為真龍瞑目所化，珠中豎瞳隱隱欲睜。 龍族出品，排場通常比包裝大。' },

    /* ---- beast_* 妖獸材料（13 種，本文件主登記） ---- */
    beast_huya:        { name: '青狼牙',   icon: '牙', grade: 0, desc: '青雲青狼之銳齒，堅逾精鐵，可磨作刃。 穩得讓人安心，對手看了就沒那麼開心。' },
    beast_tuling:      { name: '土靈鬃',   icon: '鬃', grade: 0, desc: '土靈獸頸後硬鬃，內含厚土之氣。 可靠到連蒲團都想請你幫忙看門。' },
    beast_shelin:      { name: '青蟒鱗',   icon: '鱗', grade: 1, desc: '蒼梧青蟒蛻下之鱗，柔韌刀槍難入。 小小物件，大大修仙日常。' },
    beast_xiongdan:    { name: '熊羆膽',   icon: '膽', grade: 1, desc: '山野熊羆之膽，苦極而大補，丹家珍視。 仙路漫漫，這點小可愛剛剛好。' },
    beast_yaodan:      { name: '妖獸內丹', icon: '丹', grade: 2, desc: '妖獸百年修為所凝，丹光內蘊，煉器服丹兩宜。 夜裡不用找燈，先找找自己的行囊。' },
    beast_jiaowei:     { name: '蛟尾筋',   icon: '筋', grade: 2, desc: '惡蛟尾上大筋，抽之可制弓弦鞭索。 小小物件，大大修仙日常。' },
    beast_bingjiao_lin:{ name: '冰蛟鱗',   icon: '冰', grade: 3, desc: '北海冰蛟之鱗，寒光湛湛，水火不侵。 涼到很有存在感，抱著記得加件外套。' },
    beast_yanlang_gu:  { name: '炎狼脊骨', icon: '骨', grade: 3, desc: '焚天炎狼脊骨，餘溫經年不熄。 師父說有用，你先認真收好。' },
    beast_mingdie_yi:  { name: '冥蝶翼',   icon: '蝶', grade: 3, desc: '幽冥冥蝶之翼，薄如幽紗，隱現魂光。 夜裡亮晶晶，照路與擺帥兩相宜。' },
    beast_kun_yu:      { name: '鯤羽',     icon: '鯤', grade: 4, desc: '北溟巨鯤脫落的翎羽，一片可覆小舟。 輕飄飄的，身價可沒有跟著輕。' },
    beast_longlin:     { name: '龍鱗',     icon: '麟', grade: 4, desc: '真龍之鱗，萬金難求，刀槍術法皆難傷。 龍族出品，排場通常比包裝大。' },
    beast_longgu:      { name: '龍骨',     icon: '骸', grade: 4, desc: '龍骸之骨，歷經萬劫而不腐，沉重如山。 龍族出品，排場通常比包裝大。' },
    beast_longjiao:    { name: '龍角',     icon: '角', grade: 4, desc: '龍角崢嶸，蘊一絲真龍威壓，鎮邪辟易。 龍族出品，排場通常比包裝大。' },

    /* ---- sp_* 地圖特產（9 種，每圖一種，本文件主登記） ---- */
    sp_qingyun_tea:  { name: '青雲雲霧茶', icon: '茶', grade: 1, desc: '青雲之巔雲霧滋養的靈茶，一盞清心明目，贈友最宜。 師父說有用，你先認真收好。' },
    sp_luoxia_jing:  { name: '落霞晶',     icon: '霞', grade: 1, desc: '落霞谷暮色所凝的晶簇，握之如掬一抹殘霞，佩之安神定魄。 小小物件，大大修仙日常。' },
    sp_cangwu_wood:  { name: '蒼梧靈木',   icon: '木', grade: 1, desc: '蒼梧古木之心，紋理天然成陣，煉器造屋皆為良材。 小草很忙，長大還得兼任丹方主角。' },
    sp_yaoling_guo:  { name: '妖靈果',     icon: '果', grade: 2, desc: '萬妖嶺深處異果，妖氣氤氳，靈寵食之助長靈性。 師父說有用，你先認真收好。' },
    sp_beihai_sui:   { name: '玄冰髓',     icon: '髓', grade: 2, desc: '玄冰萬載凝出的一點冰髓，降火定丹有奇效。 自帶涼感，仙界夏日人氣款。' },
    sp_fentian_huo:  { name: '焚天火種',   icon: '火', grade: 3, desc: '焚天地火凝出的一縷火種，馴之可為丹爐異火之引。 丹房裡最安靜、也最燙手的同事。' },
    sp_youming_hua:  { name: '彼岸花',     icon: '花', grade: 3, desc: '花開不見葉，葉生不見花，幽冥澗畔接引幽魂之卉。 採藥時溫柔一點，這可是未來的丹道同事。' },
    sp_guixu_bi:     { name: '歸墟殘璧',   icon: '璧', grade: 4, desc: '上古祭器之殘片，潮聲中隱有龍吟，集齊五枚可啓龍淵。 龍族出品，排場通常比包裝大。' },
    sp_longyuan_lin: { name: '龍淵逆鱗',   icon: '逆', grade: 4, desc: '龍有逆鱗，觸之必怒；此鱗乃龍淵鎮淵之寶，萬邪不侵。 龍族出品，排場通常比包裝大。' },
  };

  // 保底合併：一律不覆蓋既有條目（防與煉丹批次的 herb_* 衝突）
  for (const id in MATS) {
    if (Object.prototype.hasOwnProperty.call(MATS, id) && !XG.data.mats[id]) {
      XG.data.mats[id] = MATS[id];
    }
  }

  /* ==================== 歷練地圖 ====================
   * drops 字段口徑（由 expedition 系統實現）：
   *   mat：{ 材料id: [數量下限, 數量上限, 權重] }；
   *   pill / frag：{ 'g1'~'g9': [數量下限, 數量上限, 權重] } —— 按品階掉「隨機成品丹 / 隨機功法殘篇」，
   *     品階池分別見 pills.js / gongfa.js，故本文件不直接引用其 id，避免跨批次懸空引用。
   *   結算規則（註釋）：按權重抽取 3/4/5 種（時長檔 1分/3分/10分鐘），每種數量在上下限間取整，
   *     再乘時長係數 ×1 / ×3.2 / ×6；sp 特產按 min(1, 時長/1h) 概率判定，得 1/1/2 件；
   *     eggChance / recipeChance 為每次派遣獨立判定的概率（靈寵蛋 / 隨機丹方），
   *     結算時按 min(1, 時長/1h) 縮放，時產口徑與舊 1h 檔一致。
   *   power 為建議戰力：參照 cfg.REALM_BASE 戰力基值（金丹≈5.5e3，每大境界×6）×約 1.5 設定。
   * events：各地圖專屬事件 id 為「預留位」（evb_<mapId>_01~03，每圖 3 條），
   *   由 events_b 批次按 id + mapId 落地實現；未實現前 expedition 可安全跳過。
   */
  const maps = [
    {
      id: 'qingyun', name: '青雲山', icon: '⛰️', hidden: false,
      unlock: { realmIdx: 1, layer: 1 }, power: 1e3, dur: [60, 180, 600],
      drops: {
        mat: {
          herb_lingzhi: [1, 3, 10], herb_fuling: [1, 2, 9], herb_ningshen: [1, 2, 7], herb_ziye: [1, 2, 6],
          ore_qingtong: [1, 3, 9], ore_heite: [1, 2, 7],
          beast_huya: [1, 2, 5], beast_tuling: [1, 2, 5],
          gem_lingcui: [1, 1, 3],
          herb_qingling: [1, 2, 8], herb_ningxue: [1, 2, 7],
          ore_jingtie: [1, 2, 8],
        },
        pill: { g1: [1, 1, 5] }, frag: { g1: [1, 1, 4] },
        eggChance: 0.06, recipeChance: 0.03,
      },
      sp: 'sp_qingyun_tea',
      events: ['evb_qingyun_01', 'evb_qingyun_02', 'evb_qingyun_03'],
      desc: '雲霧軟綿綿、靈草到處長的入門仙山。適合第一次出遊，請別把採藥當成喫到飽。',
    },
    {
      id: 'luoxia', name: '落霞谷', icon: '🌄', hidden: false,
      unlock: { realmIdx: 1, layer: 6 }, power: 3e3, dur: [60, 180, 600],
      drops: {
        mat: {
          herb_fuling: [1, 3, 9], herb_huangjing: [1, 2, 8],
          herb_juling: [1, 2, 7], herb_yuehua: [1, 2, 6],
          ore_wuxingsha: [1, 2, 8], ore_qingtong: [1, 3, 7],
          beast_shelin: [1, 2, 5], beast_xiongdan: [1, 1, 5],
          gem_zijing: [1, 1, 4],
          herb_ningshen: [1, 2, 5], herb_ziye: [1, 1, 4],
          ore_jingtie: [1, 2, 7],
          beast_yaodan: [1, 1, 3],
        },
        pill: { g1: [1, 1, 4], g2: [1, 1, 2] }, frag: { g1: [1, 1, 3], g2: [1, 1, 1] },
        eggChance: 0.05, recipeChance: 0.04,
      },
      sp: 'sp_luoxia_jing',
      events: ['evb_luoxia_01', 'evb_luoxia_02', 'evb_luoxia_03'],
      desc: '晚霞把山谷染成蜜桃色，紫晶和靈草都很上相。築基中期再來，熊和青蟒可不負責幫你拍照。',
    },
    {
      id: 'cangwu', name: '蒼梧之野', icon: '🌳', hidden: false,
      unlock: { realmIdx: 2, layer: 1 }, power: 8e3, dur: [60, 180, 600],
      drops: {
        mat: {
          herb_huangjing: [1, 3, 9], herb_renshen: [1, 2, 8],
          herb_xuanbing: [1, 2, 6], herb_digen: [1, 2, 5],
          ore_xuantie: [1, 3, 9], ore_wuxingsha: [1, 2, 7],
          beast_shelin: [1, 2, 6], beast_xiongdan: [1, 1, 4],
          gem_biyu: [1, 1, 4],
          ore_zijin: [1, 2, 7], ore_xingsha: [1, 1, 4],
        },
        pill: { g2: [1, 1, 5] }, frag: { g2: [1, 1, 4], g3: [1, 1, 1] },
        eggChance: 0.05, recipeChance: 0.04,
      },
      sp: 'sp_cangwu_wood',
      events: ['evb_cangwu_01', 'evb_cangwu_02', 'evb_cangwu_03'],
      desc: '金丹才能探訪的古木荒野，鳳棲木和兇獸各有地盤。樹很高，迷路的自尊心也很高。',
    },
    {
      id: 'wanyao', name: '萬妖嶺', icon: '🐍', hidden: false,
      unlock: { realmIdx: 3, layer: 1 }, power: 5e4, dur: [60, 180, 600],
      drops: {
        mat: {
          herb_renshen: [1, 3, 8], herb_heshouwu: [1, 2, 8],
          herb_jinxian: [1, 2, 6], herb_longxu: [1, 1, 4],
          ore_miyin: [1, 2, 8], ore_jingjin: [1, 2, 7],
          beast_yaodan: [1, 2, 7], beast_jiaowei: [1, 2, 6],
          gem_zijing: [1, 1, 5], gem_xuepo: [1, 1, 4],
          herb_youming: [1, 2, 7], herb_fengwei: [1, 1, 5], herb_zhuguo: [1, 1, 3],
          herb_tianxing: [1, 1, 4], ore_xingchen: [1, 2, 7],
          herb_qingling: [1, 2, 3], herb_ningxue: [1, 2, 3], // 低級靈草偶有遺落
        },
        pill: { g3: [1, 1, 5] }, frag: { g3: [1, 1, 4] },
        eggChance: 0.07, recipeChance: 0.04,
      },
      sp: 'sp_yaoling_guo',
      events: ['evb_wanyao_01', 'evb_wanyao_02', 'evb_wanyao_03'],
      desc: '羣妖開夜間同樂會的山嶺，妖火、內丹和危險都不少。你是來歷練，別誤闖對方點名。',
    },
    {
      id: 'beihai', name: '北海冰原', icon: '🧊', hidden: false,
      unlock: { realmIdx: 4, layer: 1 }, power: 3e5, dur: [60, 180, 600],
      drops: {
        mat: {
          herb_xuelian: [1, 2, 9], herb_heshouwu: [1, 2, 6],
          herb_tianxing: [1, 2, 5], herb_dihuo: [1, 1, 4],
          ore_hantie: [1, 2, 8], ore_jingjin: [1, 2, 6],
          beast_bingjiao_lin: [1, 2, 7], beast_jiaowei: [1, 2, 5],
          gem_hanyu: [1, 1, 5], gem_xinghui: [1, 1, 3],
          herb_longxu: [1, 2, 7], herb_hansui: [1, 1, 5], herb_yusui: [1, 1, 4],
          herb_wudao: [1, 1, 4], ore_longjin: [1, 1, 5],
          herb_juling: [1, 2, 3], herb_bingxin: [1, 1, 3], // 低級靈草偶有遺落
          ore_xuantie: [1, 2, 3], // 低級礦石偶見
        },
        pill: { g4: [1, 1, 4] }, frag: { g4: [1, 1, 3] },
        eggChance: 0.04, recipeChance: 0.05,
      },
      sp: 'sp_beihai_sui',
      events: ['evb_beihai_01', 'evb_beihai_02', 'evb_beihai_03'],
      desc: '化神以下都嫌冷的北海冰原，深處藏著冰蛟與寒鐵。行前提醒：帥氣不能代替圍巾。',
    },
    {
      id: 'fentian', name: '焚天谷', icon: '🔥', hidden: false,
      unlock: { realmIdx: 5, layer: 1 }, power: 1.8e6, dur: [60, 180, 600],
      drops: {
        mat: {
          herb_chiyancao: [1, 2, 8], herb_longxiancao: [1, 1, 5],
          herb_xueling: [1, 2, 5], herb_taiyin: [1, 1, 4],
          ore_chijing: [1, 3, 9], ore_jingjin: [2, 3, 7],
          beast_yanlang_gu: [1, 2, 8],
          gem_yanxin: [1, 1, 6], gem_xinghui: [1, 1, 3],
          herb_dihuo: [1, 2, 7], herb_leiming: [1, 1, 5], herb_taiyang: [1, 1, 4],
          ore_mingtie: [1, 1, 4],
          herb_huolingzhi: [1, 2, 3], herb_digen: [1, 2, 3], // 低級靈草偶有遺落
          ore_miyin: [1, 2, 3], // 低級礦石偶見
        },
        pill: { g5: [1, 1, 4] }, frag: { g5: [1, 1, 3] },
        eggChance: 0.05, recipeChance: 0.06,
      },
      sp: 'sp_fentian_huo',
      events: ['evb_fentian_01', 'evb_fentian_02', 'evb_fentian_03'],
      desc: '赤晶閃亮、炎狼熱情的地火裂谷，谷底還睡著上古火種。風景很辣，鞋底壓力很大。',
    },
    {
      id: 'youming', name: '幽冥澗', icon: '🌑', hidden: false,
      unlock: { realmIdx: 6, layer: 1 }, power: 1.1e7, dur: [60, 180, 600],
      drops: {
        mat: {
          herb_hunyuancao: [1, 2, 7], herb_longxiancao: [1, 2, 5],
          herb_xukong: [1, 1, 5], herb_wudao: [1, 1, 4],
          ore_mingtie: [1, 3, 9], ore_chijing: [1, 2, 5],
          beast_mingdie_yi: [1, 2, 8], beast_yaodan: [1, 3, 6],
          gem_mingzhu: [1, 1, 6],
          herb_xueling: [1, 2, 7], herb_taiyin: [1, 1, 5],
          ore_xingchenjin: [1, 1, 4],
          herb_jinxian: [1, 2, 3], herb_digen: [1, 2, 3], // 低級靈草偶有遺落
          ore_jingjin: [1, 2, 3], // 低級礦石偶見
        },
        pill: { g6: [1, 1, 4] }, frag: { g6: [1, 1, 3] },
        eggChance: 0.04, recipeChance: 0.06,
      },
      sp: 'sp_youming_hua',
      events: ['evb_youming_01', 'evb_youming_02', 'evb_youming_03'],
      desc: '冥蝶帶路、彼岸花開的陰陽交界。記得以純陽護心脈，深呼吸就好，先別自己配恐怖音效。',
    },
    /* ---- 隱藏地圖（hiddenMaps 系統提示：煉虛1層；實際進入須滿足 cond，由 expedition 判定） ---- */
    {
      id: 'guixu', name: '歸墟', icon: '🌊', hidden: true,
      unlock: { realmIdx: 7, layer: 1 }, power: 6.5e7, dur: [60, 180, 600],
      cond: 'youming_exp_30',
      condText: '於幽冥澗派遣累計滿三十次，且臻大乘之境；夜半潮落時，歸墟路口自現。',
      drops: {
        mat: {
          herb_hunyuancao: [1, 3, 8], herb_longxiancao: [1, 2, 6],
          herb_fengxue: [1, 1, 5], herb_xuanwu: [1, 1, 4],
          ore_xingchenjin: [1, 2, 9], ore_mingtie: [1, 2, 5],
          beast_kun_yu: [1, 2, 8],
          gem_guixuyu: [1, 1, 6], gem_xinghui: [1, 2, 5],
          herb_xukong: [1, 2, 6], herb_tianxing: [1, 1, 5], herb_wudao: [1, 1, 4], herb_hundun: [1, 1, 2],
          ore_longwenjin: [1, 1, 4],
          herb_youming: [1, 2, 3], herb_fengwei: [1, 1, 3], // 中級靈草偶有遺落
          ore_chijing: [1, 2, 3], // 中級礦石偶見
        },
        pill: { g7: [1, 1, 4] }, frag: { g7: [1, 1, 3], g8: [1, 1, 1] },
        eggChance: 0.08, recipeChance: 0.08,
      },
      sp: 'sp_guixu_bi',
      events: ['evb_guixu_01', 'evb_guixu_02', 'evb_guixu_03'],
      desc: '萬水匯聚的神祕歸墟，潮間偶爾漂出上古殘器。海邊撿寶很浪漫，前提是別被浪先撿走。',
    },
    {
      id: 'longyuan', name: '龍淵', icon: '🐉', hidden: true,
      unlock: { realmIdx: 8, layer: 1 }, power: 4e8, dur: [60, 180, 600],
      cond: 'guixu_bi_5',
      condText: '集「歸墟殘璧」五枚，于歸墟深處祭壇獻祭，渡劫之境方啓龍淵之門。',
      drops: {
        mat: {
          herb_hunyuancao: [2, 3, 7],
          herb_zhuguo: [1, 2, 5], herb_hundun: [1, 1, 3],
          ore_longwenjin: [1, 2, 9], ore_xingchenjin: [1, 2, 6], ore_hundunjin: [1, 1, 3],
          beast_longlin: [1, 2, 8], beast_longgu: [1, 2, 7], beast_longjiao: [1, 1, 5],
          gem_longmu: [1, 1, 5], gem_guixuyu: [1, 1, 3],
          herb_longxian: [1, 2, 6], herb_fengxue: [1, 1, 5], herb_xuanwu: [1, 1, 4],
          herb_puti: [1, 1, 3], herb_busi: [1, 1, 2],
          herb_tianxing: [1, 2, 3], herb_dihuo: [1, 1, 3], // 中級靈草偶有遺落
          ore_mingtie: [1, 2, 3], // 中級礦石偶見
        },
        pill: { g8: [1, 1, 4] }, frag: { g8: [1, 1, 3], g9: [1, 1, 1] },
        eggChance: 0.1, recipeChance: 0.08,
      },
      sp: 'sp_longyuan_lin',
      events: ['evb_longyuan_01', 'evb_longyuan_02', 'evb_longyuan_03'],
      desc: '真龍打盹的深淵，逆鱗鎮守，龍紋金與龍骨藏在腳邊。撿寶請輕聲，龍的起牀氣沒有寫在地圖上。',
    },
  ];

  /* ==================== 秘境副本 ==================== */
  const dungeons = {
    /* ---- 鎮妖塔（爬塔，金丹1層開啓，無盡層數） ---- */
    tower: {
      // 周詞綴池：dungeon 系統以 mulberry32(weekId) 每週從中抽 3 條生效。
      // eff 鍵口徑：foe*Pct=塔內妖邪屬性加成百分數（負值=利好玩家）；rw*Pct=通關獎勵加成百分數。
      affixPool: [
        { id: 'af_liren',    name: '利刃', eff: { foeAtkPct: 25 },                          desc: '塔中妖邪刃口淬毒，攻勢大漲。 氣勢到位，旁邊的師弟已經坐直。' },
        { id: 'af_tiejia',   name: '鐵甲', eff: { foeDefPct: 30 },                          desc: '妖邪披上玄鐵重甲，刀槍難入。 安全感很足，師弟看了都想靠近一點。' },
        { id: 'af_xuehai',   name: '血海', eff: { foeHpPct: 40 },                           desc: '血海滔天，妖邪氣血綿延不絕。 保養做得好，修仙路上少皺眉。' },
        { id: 'af_jifeng',   name: '疾風', eff: { foeSpdPct: 20 },                          desc: '罡風助陣，妖邪來去如電。 亮晶晶的，摸之前請先深呼吸。' },
        { id: 'af_shixue',   name: '嗜血', eff: { foeAtkPct: 15, foeHpPct: 15 },            desc: '妖邪嗅到血氣，愈發兇狂。 身體說謝謝，道心說再來一點。' },
        { id: 'af_cuihun',   name: '摧魂', eff: { foeAtkPct: 45, foeDefPct: -10 },          desc: '摧魂魔音貫耳，敵攻極盛而守備空虛。 穩得讓人安心，對手看了就沒那麼開心。' },
        { id: 'af_xuanming', name: '玄冥', eff: { foeDefPct: 50, foeSpdPct: -10 },          desc: '玄冥寒氣護體，敵堅如磐石而行動遲緩。 冷靜一點，這句話對它倒是很多餘。' },
        { id: 'af_hundun',   name: '混沌', eff: { foeAtkPct: 20, foeDefPct: 20, foeHpPct: 20, rwCultPct: 20 }, desc: '混沌之氣瀰漫全塔，兇險倍增，所得修為亦厚。 安全感很足，師弟看了都想靠近一點。' },
        { id: 'af_yinguo',   name: '因果', eff: { rwCultPct: 30 },                          desc: '一念因果，本週登塔所得修為大增。 仙路漫漫，這點小可愛剛剛好。' },
        { id: 'af_jinyu',    name: '金玉', eff: { rwLingShiPct: 50 },                       desc: '金玉滿堂，塔中靈石藏量翻湧。 你的錢袋，對此非常有興趣。' },
        { id: 'af_tianji',   name: '天機', eff: { rwDropPct: 35 },                          desc: '天機一線，奇珍掉落較往日頻繁。 小小物件，大大修仙日常。' },
        { id: 'af_lingji',   name: '靈機', eff: { rwFragPct: 40 },                          desc: '靈機一動，功法殘篇更易現世。 仙路漫漫，這點小可愛剛剛好。' },
        { id: 'af_ruishou',  name: '瑞獸', eff: { rwEggPct: 60 },                           desc: '瑞獸銜蛋而過，靈寵蛋緣法大增。 師父說有用，你先認真收好。' },
        { id: 'af_qingping', name: '清平', eff: { foeAtkPct: -10, foeDefPct: -10 },         desc: '清氣上升，妖邪蟄伏，本週登塔順遂。 小小物件，大大修仙日常。' },
      ],
      // 隱藏 BOSS：每 33 層（33/66/99…）現身，戰力 = 當層基準 × powerMul，按輪次循環 bosses 名單。
      hiddenBossEvery: 33,
      hiddenBoss: {
        powerMul: 2.5,
        bosses: [
          { id: 'tb_xuangui',  name: '玄甲冥龜', icon: '🐢', desc: '鎮塔四靈之一，揹負玄甲，萬年不動如山。 穩得讓人安心，對手看了就沒那麼開心。' },
          { id: 'tb_luosha',   name: '赤發羅剎', icon: '👹', desc: '赤發覆面，食人魂魄，塔底冤魂奉其為主。 氣氛很神祕，別在睡前講太詳細。' },
          { id: 'tb_gulong',   name: '九幽骨龍', icon: '🐉', desc: '隕落古龍之骸為煞氣所驅，骨翼蔽日。 龍族出品，排場通常比包裝大。' },
          { id: 'tb_jianling', name: '無量劍靈', icon: '⚔️', desc: '上古劍仙一縷劍意所化，出劍則無量生、無量滅。 實力要練，帥氣姿勢可以順便練。' },
        ],
        // 擊殺獎勵（註釋，由 dungeon 實現）：靈玉 = 20 + 5×輪次；必掉裝備 grade = min(2+輪次, 5)；
        // 功法殘篇 g(min(3+輪次, 9))×2；另贈寶石箱（gem_* 隨機 2~4 件，品階隨輪次提升）。
        rewardsNote: '靈玉=20+5*輪次；必掉裝備 grade=min(2+輪次,5)；殘篇 g(min(3+輪次,9))x2；gem 隨機 2~4 件',
      },
      // 塔層獎勵公式（註釋，由 dungeon 實現）：
      //   第 N 層基準戰力 ≈ 5e3 × N^1.35（金丹一層可戰，約 200 層抵合體，400 層後非大乘莫入）；
      //   通關靈石 = 100 × N^1.5；通關修為 = 當前境界 rate × (60 + 12×N) 秒等值；
      //   裝備掉率逐層提升，每 10 層保底一件，grade = min(1 + ⌊N/20⌋, 5)；
      //   材料 = ore_*/gem_* 隨機 1~3 種，每種 [1, 2+⌊N/15⌋] 件，品階隨層數解鎖；
      //   掃蕩（每日免費 3 次，其後靈玉 5/次）按歷史最高層獎勵 ×0.6 折算。
      rewardsNote: '戰力=5e3*N^1.35；靈石=100*N^1.5；修為=rate*(60+12N)秒；裝備每10層保底 grade=min(1+N/20取整,5)；材料1~3種×[1,2+N/15取整]；掃蕩=最高層獎勵x0.6',
    },

    /* ---- 守關（化神1層開啓，波次生存；每檔戰力校驗，失敗不計進度，首通全額、復刷 1/3） ---- */
    guard: {
      note: '化神1層開啓；逐檔迎擊獸潮，戰力達標方可挑戰；第 5/10/15 檔追加靈玉、殘篇等厚賞。',
      waves: [
        { n: 1,  name: '遊魂散卒', icon: '👻', power: 2e5,   reward: { lingShi: 5e3,   mat: { beast_huya: [1, 2, 8] } },        desc: '山外陰風驟起，零星遊魂循陽氣而來。 夜裡不用找燈，先找找自己的行囊。' },
        { n: 2,  name: '山魈成羣', icon: '🙈', power: 3e5,   reward: { lingShi: 2e4,   mat: { ore_heite: [1, 2, 8] } },         desc: '山魈結隊叩關，尖嘯聲震林樾。 小小物件，大大修仙日常。' },
        { n: 3,  name: '狼煙四起', icon: '🐺', power: 4.5e5, reward: { lingShi: 4.5e4, mat: { beast_shelin: [1, 2, 8] } },      desc: '青狼銜枚疾走，四野狼煙同時燃起。 脾氣偏熱，請溫柔對待。' },
        { n: 4,  name: '蟒潮翻湧', icon: '🐍', power: 7e5,   reward: { lingShi: 8e4,   mat: { gem_biyu: [1, 1, 6] } },         desc: '青蟒如潮漫過關牆，腥風撲面。 動作要快，髮型就隨緣了。' },
        { n: 5,  name: '百獸夜行', icon: '🌙', power: 1.1e6, reward: { lingShi: 1.25e5, lingYu: 10, mat: { beast_xiongdan: [1, 2, 8] } }, desc: '月黑風高，百獸傾巢，此乃第一重死關。 夜裡亮晶晶，照路與擺帥兩相宜。' },
        { n: 6,  name: '血鴉蔽日', icon: '🦅', power: 1.7e6, reward: { lingShi: 1.8e5, mat: { ore_miyin: [1, 2, 8] } },        desc: '血鴉萬點遮蔽天日，啄人雙目。 仙路漫漫，這點小可愛剛剛好。' },
        { n: 7,  name: '屍傀列陣', icon: '🧟', power: 2.6e6, reward: { lingShi: 2.6e5, mat: { beast_yaodan: [1, 2, 8] } },     desc: '魔修驅屍為傀，列陣而進，刀槍不懼。 師父說有用，你先認真收好。' },
        { n: 8,  name: '蛟影裂空', icon: '🌊', power: 4e6,   reward: { lingShi: 3.6e5, mat: { beast_jiaowei: [1, 2, 8] } },    desc: '惡蛟破空而至，尾掃之處關牆傾頹。 小小物件，大大修仙日常。' },
        { n: 9,  name: '魔修結隊', icon: '🥷', power: 6e6,   reward: { lingShi: 5e5,   mat: { gem_xuepo: [1, 1, 6] } },        desc: '黑袍魔修聯袂而來，所過之處寸草不生。 小草很忙，長大還得兼任丹方主角。' },
        { n: 10, name: '千妖壓境', icon: '🏔️', power: 9e6,   reward: { lingShi: 6.5e5, lingYu: 20, frag: { g4: [1, 1, 1] } },  desc: '千妖壓境，黑雲摧關，此乃第二重死關。 師父說有用，你先認真收好。' },
        { n: 11, name: '羅剎巡山', icon: '👹', power: 1.4e7, reward: { lingShi: 8.5e5, mat: { ore_hantie: [1, 2, 8] } },       desc: '羅剎踏夜巡山，生人魂魄為其所攝。 氣氛很神祕，別在睡前講太詳細。' },
        { n: 12, name: '冥鳳唳天', icon: '🔥', power: 2.2e7, reward: { lingShi: 1.1e6, mat: { gem_yanxin: [1, 1, 6] } },       desc: '冥鳳一聲長唳，九泉之火燎盡長空。 脾氣偏熱，請溫柔對待。' },
        { n: 13, name: '骨龍甦醒', icon: '🐉', power: 3.4e7, reward: { lingShi: 1.4e6, mat: { beast_yanlang_gu: [1, 2, 8] } }, desc: '地底骨龍睜目，萬骸隨之而起。 龍族出品，排場通常比包裝大。' },
        { n: 14, name: '九幽門開', icon: '🚪', power: 5.2e7, reward: { lingShi: 1.8e6, mat: { gem_mingzhu: [1, 1, 6] } },      desc: '九幽之門轟然中開，陰煞如潮倒灌人間。 氣氛很神祕，別在睡前講太詳細。' },
        { n: 15, name: '混沌魔尊', icon: '👿', power: 8e7,   reward: { lingShi: 2.4e6, lingYu: 40, frag: { g5: [1, 1, 1] }, egg: 1 }, desc: '混沌魔尊親率羣魔叩關，守得此關，當世可稱一流。 穩得讓人安心，對手看了就沒那麼開心。' },
      ],
    },

    /* ---- 限時尋寶（煉虛1層開啓，300 秒探寶） ---- */
    hunt: {
      dur: 300,
      note: '煉虛1層開啓；300 秒內上古遺府中刷新寶箱（每 4~8 秒一隻，場上至多 4 只），點擊或自動尋取；每日免費 1 次，其後靈玉 10/次；按 pools 權重抽取箱品。',
      pools: [
        { id: 'hu_muxia',    name: '青木匣',   icon: '🪵', w: 50, loot: { lingShi: [2e3, 5e3],    mat: { herb_xuelian: [1, 2, 6], ore_hantie: [1, 2, 6], gem_hanyu: [1, 1, 3] } } },
        { id: 'hu_tonghan',  name: '青銅函',   icon: '🥉', w: 28, loot: { lingShi: [5e3, 1.2e4],  mat: { ore_chijing: [1, 2, 6], gem_yanxin: [1, 1, 4] }, pill: { g4: [1, 1, 3] } } },
        { id: 'hu_yinxia',   name: '白銀匣',   icon: '🥈', w: 14, loot: { lingShi: [1e4, 2.5e4],  lingYu: [2, 5], mat: { ore_mingtie: [1, 2, 6], gem_mingzhu: [1, 1, 4] }, frag: { g5: [1, 1, 2] } } },
        { id: 'hu_jinxia',   name: '紫金匣',   icon: '🥇', w: 6,  loot: { lingShi: [2e4, 5e4],    lingYu: [5, 10], mat: { ore_xingchenjin: [1, 2, 6], gem_guixuyu: [1, 1, 4], beast_kun_yu: [1, 2, 4] }, pill: { g6: [1, 1, 2] }, eggChance: 0.15 } },
        { id: 'hu_guixuhan', name: '歸墟寶函', icon: '🎁', w: 2,  loot: { lingShi: [5e4, 1e5],    lingYu: [10, 20], mat: { ore_longwenjin: [1, 2, 6], gem_longmu: [1, 1, 4], beast_longlin: [1, 2, 4] }, frag: { g7: [1, 1, 2] }, eggChance: 0.3 } },
      ],
    },
  };

  /* ==================== 坊市規則（築基5層開啓） ==================== */
  const marketRules = {
    refreshSec: 600, // 每 600 秒（10 分鐘）自動刷新；耗靈玉 5 可立即刷新
    slots: 6,         // 6 欄貨位
    note: '每欄由在售道友（fellows 系統取其冗餘揹包物）掛售生成；先按 kindW 抽品類，再按玩家當前境界 ±1 品階抽具體貨。'
        + '售價 = 基準價 × priceByPersona[賣家性格] × priceByRelation[與賣家關係]；丹藥回收為煉製靈石六成，裝備回收為標準靈玉價六成；core/balance.js 統一估價與最低售價。'
        + '同種成品丹每日限購 3 顆；若賣家為「歐皇」，其貨欄有小概率刷出超一階的貨（依新物品重新估價）——此乃坊市傳聞，信不信由你。',
    // 性格價格倍率（奸商 ×1.3，話癆好侃價 ×1.15，鹹魚懶得多要 ×0.9……）
    priceByPersona: {
      rexin: 0.95, gaoleng: 1.1, aojiao: 1.05, jianshang: 1.3, juanwang: 1.0,
      xianyu: 0.9, ouhuang: 1.0, hualao: 1.15, chenwen: 1.0, fuhei: 1.2,
    },
    // 關係價格折讓（摯友八折、道侶七五折、宿敵加價兩成）
    priceByRelation: { stranger: 1.0, friend: 0.8, rival: 1.2, partner: 0.75 },
    stock: {
      kindW: { pill: 30, mat: 30, equip: 20, frag: 15, egg: 5, recipe: 8 }, // 品類抽取權重：丹藥/材料/裝備/殘篇/靈寵蛋/丹方
      // 基準價（靈石；售價在此基礎上乘性格與關係倍率）
      basePrice: {
        matG0: 50, matG1: 300, matG2: 2e3, matG3: 1.5e4, matG4: 1e5, // 材料按 grade
        pillPerGrade: 200,   // 舊版欄位；成品丹實價由 balance.pillPrice 按成本與材料估值計算
        equipPerGrade: 800,  // 裝備 = 800 × 品階
        fragPerGrade: 1500,  // 功法殘篇 = 1500 × 品階
        egg: 3e4,            // 靈寵蛋統一基準價
      },
      currencyW: { lingShi: 8, lingYu: 2 }, // 標價貨幣權重：約兩成貨品以靈玉標價
    },
  };

  /* ==================== 登記 ==================== */
  XG.data.world = { maps: maps, dungeons: dungeons, marketRules: marketRules };
})();
