/* equips.js：裝備體系數據表（契約 §9.5）——底材/詞條/套裝/寶石/器靈/強化公式 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.data = XG.data || {}; // data 層掛載點（各數據文件任意順序加載，須自建）

  /* ==================== 通用規則註釋 ====================
   * 品階 grade：0凡品 1靈品 2寶品 3仙品 4神品（與契約 §9 一致）。
   * 詞條數值 min/max 一律為「百分數」，roll 出的值寫入裝備實例；
   * kind → XG.stats 修飾鍵映射：atk→atkPct, def→defPct, hp→hpPct,
   *   cult→cultRatePct, drop→dropPct, work→workPct, alch→alchSuccPct,
   *   crit→critPct / spd→spdPct（§7 透傳鍵，由戰鬥/歷練系統讀取）。
   * 每件裝備 roll 詞條數：grade0→1 條，grade1→1~2 條，grade2→2 條，
   *   grade3→3 條，grade4→4 條；同一件裝備詞條 kind 不可重複；
   *   候選詞條須滿足 grades 含該裝備品階，再按 w 權重抽取（好詞條更稀有）。
   * 裝備底材掉落品階建議（由 dungeon/forge 系統實現）：
   *   煉氣~築基出 grade0~1，金丹~元嬰出 grade1~2，
   *   化神~煉虛出 grade2~3，合體以上出 grade3~4。
   * 礦石材料（ore_*）對應 world.js 各地圖掉落；歸墟/龍淵兩套
   *   對應隱藏地圖「歸墟」「龍淵」，形成跨系統收集閉環。
   * ===================================================== */

  /* ---- 礦石材料登記（併入 XG.data.mats，供 inventory/forge 使用） ---- */
  const mats = {
    ore_jingtie:  { name: '精鐵礦', icon: '鐵', grade: 0, desc: '凡鐵千錘百煉，去蕪存菁，可為凡器之基。 看起來只是材料，師父卻抱得很緊。' },
    ore_xuantie:  { name: '玄鐵',   icon: '玄', grade: 1, desc: '色沉如墨，墜手異常，凡火難熔。 脾氣偏熱，請溫柔對待。' },
    ore_zijin:    { name: '紫金',   icon: '紫', grade: 2, desc: '紫氣氤氳，金性至堅，煉器上品之材。 可靠到連蒲團都想請你幫忙看門。' },
    ore_xingchen: { name: '星辰鐵', icon: '星', grade: 3, desc: '天外隕星所遺，內蘊一縷星辰之力。 夜裡亮晶晶，照路與擺帥兩相宜。' },
    ore_longjin:  { name: '龍紋金', icon: '龍', grade: 4, desc: '金生龍紋，傳為真龍涎水點化，舉世難求。 龍族出品，排場通常比包裝大。' },
    ore_xingsha:  { name: '星砂',   icon: '砂', grade: 2, desc: '夜半北斗垂光，凝沙而成，升星必備之物。 夜裡不用找燈，先找找自己的行囊。' },
  };

  /* ==================== 底材 bases（48+1 件） ====================
   * 數值口徑：參照 XG.cfg.REALM_BASE（煉氣 atk10/hp100，每大境界 ×6）。
   * 凡品 ≈ 煉氣期過渡，靈品 ≈ 築基，寶品 ≈ 金丹，仙品 ≈ 元嬰~化神，
   * 神品 ≈ 化神以上；強化+20（×2.6）與 10 星（×2.5）另計，故高品階
   * 底材刻意留有餘量，避免單系統速通畢業。
   * slot：weapon 武器 / head 冠 / body 衣甲 / boots 履靴 / ring 戒 / talisman 符
   * ================================================================== */
  const bases = [
    /* ---- 凡品 grade 0（6 件，煉氣期入門裝） ---- */
    { id: 'eq_tiejian',      name: '精鐵劍',   icon: '🗡', slot: 'weapon',   grade: 0, base: { atk: 8 },          desc: '精鐵百鍊而成，凡俗武夫亦可驅使。 看起來只是材料，師父卻抱得很緊。' },
    { id: 'eq_qingbujin',    name: '青布巾',   icon: '👑', slot: 'head',     grade: 0, base: { def: 5, hp: 60 },  desc: '青布束髮，遮塵蔽日，行走江湖的尋常裝扮。 動作要快，髮型就隨緣了。' },
    { id: 'eq_mayi',         name: '粗麻道衣', icon: '🥋', slot: 'body',     grade: 0, base: { def: 8, hp: 120 }, desc: '麻布粗織，冬暖夏涼，散修入門之物。 修仙也要穿搭，仙氣請自行加滿。' },
    { id: 'eq_mangxie',      name: '芒鞋',     icon: '🥾', slot: 'boots',    grade: 0, base: { def: 4, hp: 40 },  desc: '草莖編就，踏遍青山不覺累。 看似小小一株，仙界履歷卻很豐富。' },
    { id: 'eq_tongjie',      name: '黃銅戒',   icon: '💍', slot: 'ring',     grade: 0, base: { atk: 5 },          desc: '黃銅所鑄，內刻微小聚靈紋，聊勝於無。 鐵匠看見它，笑得比爐火還亮。' },
    { id: 'eq_taomufu',      name: '桃木符',   icon: '🎴', slot: 'talisman', grade: 0, base: { atk: 3, hp: 50 },  desc: '桃木辟邪，硃砂點睛，可擋低階陰邪。 採藥時溫柔一點，這可是未來的丹道同事。' },

    /* ---- 靈品 grade 1（6 件，築基期主流裝） ---- */
    { id: 'eq_hanguangjian', name: '寒光劍',   icon: '🗡', slot: 'weapon',   grade: 1, base: { atk: 64 },          desc: '寒光凜凜，削鐵如泥，劍身隱有霜紋。 自帶涼感，仙界夏日人氣款。' },
    { id: 'eq_qingyuguan',   name: '青玉冠',   icon: '👑', slot: 'head',     grade: 1, base: { def: 40, hp: 480 }, desc: '青玉溫潤，凝神靜氣，於修行小有裨益。 動作要快，髮型就隨緣了。' },
    { id: 'eq_yunsipao',     name: '雲絲道袍', icon: '🥋', slot: 'body',     grade: 1, base: { def: 64, hp: 960 }, desc: '天蠶絲織，輕若流雲，水火難侵。 脾氣偏熱，請溫柔對待。' },
    { id: 'eq_jifengxue',    name: '疾風靴',   icon: '🥾', slot: 'boots',    grade: 1, base: { def: 32, hp: 320 }, desc: '靴底納風，行之無聲，一日千里。 動作要快，髮型就隨緣了。' },
    { id: 'eq_baiyinjie',    name: '白銀戒',   icon: '💍', slot: 'ring',     grade: 1, base: { atk: 40 },          desc: '白銀通靈，內蘊一縷靈機。 仙路漫漫，這點小可愛剛剛好。' },
    { id: 'eq_zhushafu',     name: '硃砂符',   icon: '🎴', slot: 'talisman', grade: 1, base: { atk: 24, hp: 400 }, desc: '硃砂混以靈獸之血，符成之日隱有雷鳴。 亮晶晶的，摸之前請先深呼吸。' },

    /* ---- 寶品 grade 2（6 件，金丹期追求裝） ---- */
    { id: 'eq_zihongjian',   name: '紫虹劍',   icon: '🗡', slot: 'weapon',   grade: 2, base: { atk: 480 },          desc: '劍出如紫虹貫日，金丹修士亦珍視之。 出場很有氣勢，收招記得看路。' },
    { id: 'eq_zijinguan',    name: '紫金冠',   icon: '👑', slot: 'head',     grade: 2, base: { def: 300, hp: 3600 }, desc: '紫金為骨，明珠為飾，氣度儼然。 鐵匠看見它，笑得比爐火還亮。' },
    { id: 'eq_xuanlinjia',   name: '玄鱗寶甲', icon: '🥋', slot: 'body',     grade: 2, base: { def: 480, hp: 7200 }, desc: '玄鱷之鱗層層綴成，刀劍難傷分毫。 氣勢到位，旁邊的師弟已經坐直。' },
    { id: 'eq_dengyunlv',    name: '登雲履',   icon: '🥾', slot: 'boots',    grade: 2, base: { def: 240, hp: 2400 }, desc: '履下生雲，登萍渡水，踏雪無痕。 自帶涼感，仙界夏日人氣款。' },
    { id: 'eq_feicuijie',    name: '翡翠戒',   icon: '💍', slot: 'ring',     grade: 2, base: { atk: 300 },          desc: '翡翠含翠，靈光內蘊，可安神魂。 漂亮得很低調，只是暗處特別難低調。' },
    { id: 'eq_wuleifu',      name: '五雷符',   icon: '🎴', slot: 'talisman', grade: 2, base: { atk: 180, hp: 3000 }, desc: '符藏五雷，擲出則霹靂隨行。 亮晶晶的，摸之前請先深呼吸。' },

    /* ---- 仙品 grade 3 ·「太玄」套（6 件，均衡/修煉向） ---- */
    { id: 'eq_taixuan_jian',  name: '太玄·無名劍',   icon: '☯', slot: 'weapon',   grade: 3, base: { atk: 3600 },            desc: '道可道，非常道。此劍無名，鋒芒自斂。 出場很有氣勢，收招記得看路。' },
    { id: 'eq_taixuan_guan',  name: '太玄·束髮冠',   icon: '☯', slot: 'head',     grade: 3, base: { def: 2250, hp: 27000 }, desc: '冠正而心正，心正而道存。 修仙也要穿搭，仙氣請自行加滿。' },
    { id: 'eq_taixuan_pao',   name: '太玄·雲紋道袍', icon: '☯', slot: 'body',     grade: 3, base: { def: 3600, hp: 54000 }, desc: '雲紋舒捲，暗合天道流轉之序。 師父說有用，你先認真收好。' },
    { id: 'eq_taixuan_lv',    name: '太玄·踏雲履',   icon: '☯', slot: 'boots',    grade: 3, base: { def: 1800, hp: 18000 }, desc: '履雲而行，不染塵埃。 動作要快，髮型就隨緣了。' },
    { id: 'eq_taixuan_jie',   name: '太玄·清心戒',   icon: '☯', slot: 'ring',     grade: 3, base: { atk: 2250 },            desc: '清心寡慾，方見本真。 仙路漫漫，這點小可愛剛剛好。' },
    { id: 'eq_taixuan_fu',    name: '太玄·鎮妖符',   icon: '☯', slot: 'talisman', grade: 3, base: { atk: 1350, hp: 22500 }, desc: '一符鎮萬邪，浩然正氣長存。 可靠到連蒲團都想請你幫忙看門。' },

    /* ---- 仙品 grade 3 ·「滄浪」套（4 件，氣血/防禦向） ---- */
    { id: 'eq_canglang_jian', name: '滄浪·聽雨劍', icon: '🌊', slot: 'weapon', grade: 3, base: { atk: 3600 },            desc: '劍鳴如雨打芭蕉，聲聲入夢。 出場很有氣勢，收招記得看路。' },
    { id: 'eq_canglang_jia',  name: '滄浪·潮汐甲', icon: '🌊', slot: 'body',   grade: 3, base: { def: 3600, hp: 54000 }, desc: '甲光如潮，層層疊疊，御力於無形。 漂亮得很低調，只是暗處特別難低調。' },
    { id: 'eq_canglang_lv',   name: '滄浪·踏波履', icon: '🌊', slot: 'boots',  grade: 3, base: { def: 1800, hp: 18000 }, desc: '履波不沉，踏浪而行。 動作要快，髮型就隨緣了。' },
    { id: 'eq_canglang_jie',  name: '滄浪·明珠戒', icon: '🌊', slot: 'ring',   grade: 3, base: { atk: 2250 },            desc: '滄海遺珠，光華內蘊而不炫。 夜裡亮晶晶，照路與擺帥兩相宜。' },

    /* ---- 仙品 grade 3 ·「赤霄」套（4 件，攻擊/暴擊向） ---- */
    { id: 'eq_chixiao_jian', name: '赤霄·焚天劍', icon: '🔥', slot: 'weapon',   grade: 3, base: { atk: 3600 },            desc: '劍身赤紅如火，揮之則烈焰焚空。 脾氣偏熱，請溫柔對待。' },
    { id: 'eq_chixiao_guan', name: '赤霄·焰紋冠', icon: '🔥', slot: 'head',     grade: 3, base: { def: 2250, hp: 27000 }, desc: '焰紋灼灼，如帝冠臨塵。 脾氣偏熱，請溫柔對待。' },
    { id: 'eq_chixiao_jie',  name: '赤霄·流火戒', icon: '🔥', slot: 'ring',     grade: 3, base: { atk: 2250 },            desc: '戒蘊流火，觸之溫熱，鬥法時助漲三分兇焰。 脾氣偏熱，請溫柔對待。' },
    { id: 'eq_chixiao_fu',   name: '赤霄·焚心符', icon: '🔥', slot: 'talisman', grade: 3, base: { atk: 1350, hp: 22500 }, desc: '符火焚心，邪祟不近。 脾氣偏熱，請溫柔對待。' },

    /* ---- 仙品 grade 3 ·「青冥」套（4 件，速度/掉落向） ---- */
    { id: 'eq_qingming_ren', name: '青冥·逐風刃', icon: '🍃', slot: 'weapon',   grade: 3, base: { atk: 3600 },            desc: '刃薄如蟬翼，逐風而無影。 氣勢到位，旁邊的師弟已經坐直。' },
    { id: 'eq_qingming_lv',  name: '青冥·御風履', icon: '🍃', slot: 'boots',    grade: 3, base: { def: 1800, hp: 18000 }, desc: '御風而行，直上青冥。 動作要快，髮型就隨緣了。' },
    { id: 'eq_qingming_jie', name: '青冥·流雲戒', icon: '🍃', slot: 'ring',     grade: 3, base: { atk: 2250 },            desc: '流雲繞指，聚散隨心。 仙路漫漫，這點小可愛剛剛好。' },
    { id: 'eq_qingming_fu',  name: '青冥·神行符', icon: '🍃', slot: 'talisman', grade: 3, base: { atk: 1350, hp: 22500 }, desc: '神行千里，朝北海而暮蒼梧。 動作要快，髮型就隨緣了。' },

    /* ---- 仙品 grade 3 ·「瑤光」套（4 件，煉丹/打工向） ---- */
    { id: 'eq_yaoguang_guan', name: '瑤光·星砂冠', icon: '⭐', slot: 'head',     grade: 3, base: { def: 2250, hp: 27000 }, desc: '星砂綴冠，入夜則熒熒生輝。 夜裡亮晶晶，照路與擺帥兩相宜。' },
    { id: 'eq_yaoguang_yi',   name: '瑤光·織星衣', icon: '⭐', slot: 'body',     grade: 3, base: { def: 3600, hp: 54000 }, desc: '傳為織女遺梭所織，星光滿襟。 漂亮得很低調，只是暗處特別難低調。' },
    { id: 'eq_yaoguang_jie',  name: '瑤光·凝露戒', icon: '⭐', slot: 'ring',     grade: 3, base: { atk: 2250 },            desc: '晨露凝於戒面，久而不晞。 師父說有用，你先認真收好。' },
    { id: 'eq_yaoguang_fu',   name: '瑤光·引星符', icon: '⭐', slot: 'talisman', grade: 3, base: { atk: 1350, hp: 22500 }, desc: '符引星輝，照徹丹爐，火候自分。 丹爐點了點頭：這次看起來比較有把握。' },

    /* ---- 神品 grade 4 ·「歸墟」套（4 件，隱藏，生存/修煉向） ---- */
    { id: 'eq_guixu_jian', name: '歸墟·溟海劍', icon: '🌑', slot: 'weapon',   grade: 4, hidden: true, base: { atk: 24000 },            desc: '溟海之底千年寒鐵所鑄，劍氣森然如深淵。 涼到很有存在感，抱著記得加件外套。', getHint: '歸墟秘境深處，偶有劍光破水而出。' },
    { id: 'eq_guixu_jia',  name: '歸墟·玄溟甲', icon: '🌑', slot: 'body',     grade: 4, hidden: true, base: { def: 24000, hp: 360000 }, desc: '玄溟重水淬甲，萬鈞之力加身亦如無物。 可靠到連蒲團都想請你幫忙看門。', getHint: '歸墟秘境深處，或可遇之。' },
    { id: 'eq_guixu_jie',  name: '歸墟·潮生戒', icon: '🌑', slot: 'ring',     grade: 4, hidden: true, base: { atk: 15000 },            desc: '潮生潮落，戒面水光千年不散。 夜裡亮晶晶，照路與擺帥兩相宜。', getHint: '歸墟秘境深處，或可遇之。' },
    { id: 'eq_guixu_zhu',  name: '歸墟·定海珠', icon: '🌑', slot: 'talisman', grade: 4, hidden: true, base: { atk: 9000, hp: 150000 }, desc: '海珠定波，佩之則四海無瀾。 仙路漫漫，這點小可愛剛剛好。', getHint: '歸墟秘境最深處，潮眼之下。' },

    /* ---- 神品 grade 4 ·「龍淵」套（4 件，隱藏，攻伐向） ---- */
    { id: 'eq_longyuan_jian', name: '龍淵·吟龍劍', icon: '🐉', slot: 'weapon', grade: 4, hidden: true, base: { atk: 24000 },            desc: '劍吟如龍，潛修淵底千年方出。 龍族出品，排場通常比包裝大。', getHint: '龍淵秘境，潛龍之地，非大勇不可得。' },
    { id: 'eq_longyuan_guan', name: '龍淵·角龍冠', icon: '🐉', slot: 'head',   grade: 4, hidden: true, base: { def: 15000, hp: 180000 }, desc: '角龍蛻角所制，威儀自生。 龍族出品，排場通常比包裝大。', getHint: '龍淵秘境，潛龍之地。' },
    { id: 'eq_longyuan_lv',   name: '龍淵·躍淵履', icon: '🐉', slot: 'boots',  grade: 4, hidden: true, base: { def: 12000, hp: 120000 }, desc: '金鱗豈是池中物，一遇風雲便化龍。 龍族出品，排場通常比包裝大。', getHint: '龍淵秘境，潛龍之地。' },
    { id: 'eq_longyuan_jie',  name: '龍淵·銜珠戒', icon: '🐉', slot: 'ring',   grade: 4, hidden: true, base: { atk: 15000 },            desc: '龍銜明珠，暗夜生輝。 龍族出品，排場通常比包裝大。', getHint: '龍淵秘境，潛龍之地。' },

    /* ---- 彩蛋底材（隱藏，不入任何套裝） ---- */
    { id: 'eq_tianshu', name: '半頁天書', icon: '📜', slot: 'talisman', grade: 4, hidden: true, base: { atk: 9000, hp: 150000 }, desc: '殘卷半頁，字跡如蟻。非歷輪迴者，讀之茫然。 小小物件，大大修仙日常。', getHint: '渡劫之後，雷池之畔偶有焦頁。' },
  ];

  /* ==================== 詞條 affixes（40 條） ====================
   * min/max 為百分數；grades 限定可出現的裝備品階；w 越小越稀有。
   * ============================================================ */
  const affixes = [
    /* 攻 atk */
    { id: 'aff_fengrui',   name: '鋒銳', kind: 'atk', min: 3,  max: 6,  grades: [0, 1, 2, 3, 4], w: 100 },
    { id: 'aff_pojia',     name: '破甲', kind: 'atk', min: 5,  max: 9,  grades: [1, 2, 3, 4],    w: 70 },
    { id: 'aff_zhanyue',   name: '斬嶽', kind: 'atk', min: 8,  max: 12, grades: [2, 3, 4],       w: 40 },
    { id: 'aff_tianxing',  name: '天刑', kind: 'atk', min: 12, max: 18, grades: [3, 4],          w: 18 },
    { id: 'aff_zhuxian',   name: '誅仙', kind: 'atk', min: 18, max: 25, grades: [4],             w: 6 },
    /* 防 def */
    { id: 'aff_panshi',    name: '磐石', kind: 'def', min: 3,  max: 6,  grades: [0, 1, 2, 3, 4], w: 100 },
    { id: 'aff_tiebi',     name: '鐵壁', kind: 'def', min: 5,  max: 9,  grades: [1, 2, 3, 4],    w: 70 },
    { id: 'aff_zhenyue',   name: '鎮嶽', kind: 'def', min: 8,  max: 12, grades: [2, 3, 4],       w: 40 },
    { id: 'aff_budong',    name: '不動', kind: 'def', min: 12, max: 18, grades: [3, 4],          w: 18 },
    { id: 'aff_qiankunhu', name: '乾坤', kind: 'def', min: 18, max: 25, grades: [4],             w: 6 },
    /* 血 hp */
    { id: 'aff_huoxue',    name: '活血', kind: 'hp', min: 4,  max: 8,  grades: [0, 1, 2, 3, 4], w: 100 },
    { id: 'aff_changchun', name: '長春', kind: 'hp', min: 7,  max: 12, grades: [1, 2, 3, 4],    w: 70 },
    { id: 'aff_canghai',   name: '滄海', kind: 'hp', min: 10, max: 16, grades: [2, 3, 4],       w: 40 },
    { id: 'aff_niepan',    name: '涅槃', kind: 'hp', min: 15, max: 22, grades: [3, 4],          w: 18 },
    { id: 'aff_buxiu',     name: '不朽', kind: 'hp', min: 22, max: 30, grades: [4],             w: 6 },
    /* 暴擊 crit（透傳鍵 critPct） */
    { id: 'aff_huixin',    name: '會心', kind: 'crit', min: 2, max: 4,  grades: [0, 1, 2, 3, 4], w: 80 },
    { id: 'aff_zhiming',   name: '致命', kind: 'crit', min: 3, max: 6,  grades: [1, 2, 3, 4],    w: 55 },
    { id: 'aff_jueying',   name: '絕影', kind: 'crit', min: 5, max: 8,  grades: [2, 3, 4],       w: 32 },
    { id: 'aff_lushen',    name: '戮神', kind: 'crit', min: 8, max: 12, grades: [3, 4],          w: 14 },
    /* 速度 spd（透傳鍵 spdPct） */
    { id: 'aff_jifeng',    name: '疾風', kind: 'spd', min: 2, max: 4,  grades: [0, 1, 2, 3, 4], w: 80 },
    { id: 'aff_liuyun',    name: '流雲', kind: 'spd', min: 3, max: 6,  grades: [1, 2, 3, 4],    w: 55 },
    { id: 'aff_suodi',     name: '縮地', kind: 'spd', min: 5, max: 8,  grades: [2, 3, 4],       w: 32 },
    { id: 'aff_shunxi',    name: '瞬息', kind: 'spd', min: 8, max: 12, grades: [3, 4],          w: 14 },
    /* 掉落 drop */
    { id: 'aff_jucai',     name: '聚財', kind: 'drop', min: 4,  max: 8,  grades: [0, 1, 2, 3, 4], w: 90 },
    { id: 'aff_nabao',     name: '納寶', kind: 'drop', min: 7,  max: 12, grades: [1, 2, 3, 4],    w: 60 },
    { id: 'aff_tianku',    name: '天庫', kind: 'drop', min: 10, max: 16, grades: [2, 3, 4],       w: 35 },
    { id: 'aff_jubao',     name: '聚寶', kind: 'drop', min: 15, max: 22, grades: [3, 4],          w: 15 },
    /* 修煉 cult */
    { id: 'aff_jingxin',   name: '靜心', kind: 'cult', min: 3,  max: 6,  grades: [0, 1, 2, 3, 4], w: 90 },
    { id: 'aff_wudao',     name: '悟道', kind: 'cult', min: 5,  max: 9,  grades: [1, 2, 3, 4],    w: 60 },
    { id: 'aff_tongming',  name: '通明', kind: 'cult', min: 8,  max: 12, grades: [2, 3, 4],       w: 35 },
    { id: 'aff_tianren',   name: '天人', kind: 'cult', min: 12, max: 18, grades: [3, 4],          w: 15 },
    /* 打工 work */
    { id: 'aff_qinmian',   name: '勤勉', kind: 'work', min: 4,  max: 8,  grades: [0, 1, 2, 3, 4], w: 90 },
    { id: 'aff_qiaojiang', name: '巧匠', kind: 'work', min: 7,  max: 12, grades: [1, 2, 3, 4],    w: 60 },
    { id: 'aff_guifu',     name: '鬼斧', kind: 'work', min: 10, max: 16, grades: [2, 3, 4],       w: 35 },
    { id: 'aff_zaohua',    name: '造化', kind: 'work', min: 15, max: 22, grades: [3, 4],          w: 15 },
    /* 煉丹 alch */
    { id: 'aff_shiyao',    name: '識藥', kind: 'alch', min: 3,  max: 5,  grades: [0, 1, 2, 3, 4], w: 80 },
    { id: 'aff_konghuo',   name: '控火', kind: 'alch', min: 4,  max: 7,  grades: [1, 2, 3, 4],    w: 55 },
    { id: 'aff_danxin',    name: '丹心', kind: 'alch', min: 6,  max: 10, grades: [2, 3, 4],       w: 30 },
    { id: 'aff_yaowang',   name: '藥王', kind: 'alch', min: 10, max: 14, grades: [3, 4],          w: 12 },
    /* 彩蛋詞條（神品專屬，萬中無一） */
    { id: 'aff_dadao',     name: '大道至簡', kind: 'cult', min: 20, max: 28, grades: [4], w: 2, hidden: true, desc: '大道至簡，衍化至繁。得此紋者，如聞道祖親授。 小傢伙的成長，總是很有儀式感。' },
  ];

  /* ==================== 套裝 sets（7 套） ====================
   * pieces 為底材 id；穿滿 2 件激活 eff2，4 件激活 eff4。
   * 歸墟/龍淵為隱藏套裝，產自對應隱藏地圖（world.js）。
   * ============================================================ */
  const sets = [
    { id: 'set_taixuan', name: '太玄', icon: '☯', grade: 3,
      pieces: ['eq_taixuan_jian', 'eq_taixuan_guan', 'eq_taixuan_pao', 'eq_taixuan_lv', 'eq_taixuan_jie', 'eq_taixuan_fu'],
      eff2: { cultRatePct: 12 }, eff4: { atkPct: 15, breakSuccPct: 5 },
      desc: '太玄者，道之極也。傳為道祖講道時所遺之器，六器同鳴，如聞天籟。 小傢伙的成長，總是很有儀式感。' },
    { id: 'set_canglang', name: '滄浪', icon: '🌊', grade: 3,
      pieces: ['eq_canglang_jian', 'eq_canglang_jia', 'eq_canglang_lv', 'eq_canglang_jie'],
      eff2: { hpPct: 15 }, eff4: { defPct: 18, hpPct: 10 },
      desc: '滄浪之水清兮，可以濯吾纓。水德之器，綿延不絕。 修仙也要穿搭，仙氣請自行加滿。' },
    { id: 'set_chixiao', name: '赤霄', icon: '🔥', grade: 3,
      pieces: ['eq_chixiao_jian', 'eq_chixiao_guan', 'eq_chixiao_jie', 'eq_chixiao_fu'],
      eff2: { atkPct: 15 }, eff4: { atkPct: 18, critPct: 6 },
      desc: '赤霄出鞘，白蛇授首。帝王之器，殺伐果斷。 實力要練，帥氣姿勢可以順便練。' },
    { id: 'set_qingming', name: '青冥', icon: '🍃', grade: 3,
      pieces: ['eq_qingming_ren', 'eq_qingming_lv', 'eq_qingming_jie', 'eq_qingming_fu'],
      eff2: { spdPct: 12 }, eff4: { spdPct: 15, dropPct: 12 },
      desc: '青冥浩蕩不見底，日月照耀金銀臺。 夜裡不用找燈，先找找自己的行囊。' },
    { id: 'set_yaoguang', name: '瑤光', icon: '⭐', grade: 3,
      pieces: ['eq_yaoguang_guan', 'eq_yaoguang_yi', 'eq_yaoguang_jie', 'eq_yaoguang_fu'],
      eff2: { alchSuccPct: 8 }, eff4: { workPct: 15, alchSuccPct: 7 },
      desc: '瑤光者，北斗第七星也，主福壽，佑丹成。 丹爐點了點頭：這次看起來比較有把握。' },
    { id: 'set_guixu', name: '歸墟', icon: '🌑', grade: 4, hidden: true,
      pieces: ['eq_guixu_jian', 'eq_guixu_jia', 'eq_guixu_jie', 'eq_guixu_zhu'],
      eff2: { hpPct: 25, defPct: 15 }, eff4: { atkPct: 25, cultRatePct: 20 },
      desc: '歸墟者，衆水所歸，尾閭泄之而不竭。得之者，如負滄海。 仙路漫漫，這點小可愛剛剛好。' },
    { id: 'set_longyuan', name: '龍淵', icon: '🐉', grade: 4, hidden: true,
      pieces: ['eq_longyuan_jian', 'eq_longyuan_guan', 'eq_longyuan_lv', 'eq_longyuan_jie'],
      eff2: { atkPct: 25 }, eff4: { atkPct: 20, critPct: 10, spdPct: 10 },
      desc: '龍潛於淵，鱗爪不現。一劍既出，風雲變色。 龍族出品，排場通常比包裝大。' },
  ];

  /* ==================== 寶石 gems（7 種 × lv1~5） ====================
   * eff 為「每級」加成（百分數），lv n 實際加成 = eff × n。
   * 合成規則（cost）：3 枚同級寶石 + lingShi[當前lv] 靈石 → 1 枚高一級；
   * lv5 為上限，不可再合。揹包中各級寶石 id 為 `${id}_${lv}`（gem_* 命名空間）。
   * 獲取：lv1 坊市有售 / 爬塔與歷練掉落；高階寶石亦可於限時尋寶中偶得。
   * 鑲嵌規則註釋：每件裝備至多嵌 2 枚，卸下不損（由 forge 系統實現）。
   * ============================================================ */
  const gems = [
    { id: 'gem_chiyu',    name: '赤玉',   icon: '🔴', eff: { atkPct: 3 },      lv: 5, cost: { merge: 3, lingShi: [0, 500, 5000, 50000, 500000] }, desc: '赤玉如燃，嵌之助漲攻伐之勢。 脾氣偏熱，請溫柔對待。' },
    { id: 'gem_qingyu',   name: '青玉',   icon: '🟢', eff: { defPct: 3 },      lv: 5, cost: { merge: 3, lingShi: [0, 500, 5000, 50000, 500000] }, desc: '青玉堅潤，護體為上。 穩得讓人安心，對手看了就沒那麼開心。' },
    { id: 'gem_yangzhi',  name: '羊脂玉', icon: '⚪', eff: { hpPct: 4 },       lv: 5, cost: { merge: 3, lingShi: [0, 500, 5000, 50000, 500000] }, desc: '溫潤如凝脂，佩之氣血綿長。 小小一份補給，是身體等很久的好消息。' },
    { id: 'gem_zijing',   name: '紫晶',   icon: '🟣', eff: { critPct: 2 },     lv: 5, cost: { merge: 3, lingShi: [0, 800, 8000, 80000, 800000] }, desc: '紫晶蘊雷光，得之者目明手快。 亮晶晶的，摸之前請先深呼吸。' },
    { id: 'gem_fengling', name: '風靈石', icon: '💨', eff: { spdPct: 2 },      lv: 5, cost: { merge: 3, lingShi: [0, 800, 8000, 80000, 800000] }, desc: '石竅生風，嵌之身法愈疾。 保養做得好，修仙路上少皺眉。' },
    { id: 'gem_huangyu',  name: '黃玉',   icon: '🟡', eff: { dropPct: 3 },     lv: 5, cost: { merge: 3, lingShi: [0, 600, 6000, 60000, 600000] }, desc: '黃玉招財，商賈與歷練者皆愛之。 你的錢袋，對此非常有興趣。' },
    { id: 'gem_bingxin',  name: '冰心玉', icon: '🧊', eff: { cultRatePct: 3 }, lv: 5, cost: { merge: 3, lingShi: [0, 600, 6000, 60000, 600000] }, desc: '冰心一片，塵慮盡消，修行自速。 自帶涼感，仙界夏日人氣款。' },
  ];
  /* 各級寶石同步登記為材料（gem_chiyu_1 … gem_bingxin_5），供揹包顯示 */
  const CN_LV = ['一', '二', '三', '四', '五'];
  gems.forEach(function (g) {
    for (let lv = 1; lv <= 5; lv++) {
      mats[g.id + '_' + lv] = {
        name: g.name + '·' + CN_LV[lv - 1],
        icon: g.icon,
        grade: Math.min(4, lv),
        desc: g.desc + '（' + lv + ' 階，可鑲嵌；三枚同級可熔鍊升階。）',
      };
    }
  });

  /* ==================== 器靈 spirits ====================
   * 器靈者，器之魂也。神器通靈，可孕靈智。
   * 喚醒條件 wakeCond：神器（grade4）強化至 +15，耗靈玉×100 喚醒。
   * 器靈名由 XG.data.spiritNames 提供（names.js）。
   * 養成規則註釋：以靈玉/礦石餵養升親密；每 10 級親密隨機習得或強化
   *   1 個技能；persona 的性格加成常駐，技能加成隨器靈等級成長。
   * ============================================================ */
  const spirits = {
    desc: '器靈者，器之魂也。神器久沐靈氣，自生靈智，可語可戰。 氣氛很神祕，別在睡前講太詳細。',
    wakeCond: { grade: 4, enh: 15, lingYu: 100, text: '神器（grade4）強化至 +15，耗靈玉×100 可喚醒器靈。' },
    personas: [
      { id: 'spt_guao',    name: '孤傲', w: 20, eff: { atkPct: 5 },      desc: '孤高自持，劍不染塵。 氣勢到位，旁邊的師弟已經坐直。' },
      { id: 'spt_wenwan',  name: '溫婉', w: 20, eff: { cultRatePct: 5 }, desc: '輕聲細語，如沐春風。 動作要快，髮型就隨緣了。' },
      { id: 'spt_kuangfang', name: '狂放', w: 15, eff: { critPct: 3 },   desc: '快意恩仇，肆意汪洋。 仙路漫漫，這點小可愛剛剛好。' },
      { id: 'spt_chenwen', name: '沉穩', w: 20, eff: { defPct: 5 },      desc: '淵渟嶽峙，不動如山。 師父說有用，你先認真收好。' },
      { id: 'spt_lingdong', name: '靈動', w: 15, eff: { spdPct: 4 },     desc: '活潑跳脫，神出鬼沒。 小小物件，大大修仙日常。' },
      { id: 'spt_guayan',  name: '寡言', w: 10, eff: { hpPct: 6 },       desc: '惜字如金，大音希聲。 鐵匠看見它，笑得比爐火還亮。' },
    ],
    skills: [
      { id: 'sps_jianming', name: '劍鳴九天', icon: '⚔', eff: { atkPct: 10 },               w: 100, desc: '劍鳴之聲上徹九天，敵膽俱裂。 氣勢到位，旁邊的師弟已經坐直。' },
      { id: 'sps_tiexin',   name: '鐵心護主', icon: '🛡', eff: { defPct: 10 },               w: 100, desc: '器靈護主，臨危自鳴，刀槍不入。 安全感很足，師弟看了都想靠近一點。' },
      { id: 'sps_xueyong',  name: '血湧如潮', icon: '🌊', eff: { hpPct: 12 },                w: 100, desc: '氣血如潮，生生不息。 保養做得好，修仙路上少皺眉。' },
      { id: 'sps_jiying',   name: '疾影追風', icon: '🍃', eff: { spdPct: 8 },                w: 90,  desc: '影隨身動，追風逐電。 亮晶晶的，摸之前請先深呼吸。' },
      { id: 'sps_juling',   name: '聚靈納氣', icon: '☯', eff: { cultRatePct: 8 },            w: 90,  desc: '器靈吐納，靈氣自來投懷。 小小物件，大大修仙日常。' },
      { id: 'sps_tongxuan', name: '通玄識寶', icon: '👁', eff: { dropPct: 10 },               w: 80,  desc: '器靈通玄，寶物所在，纖毫畢現。 仙路漫漫，這點小可愛剛剛好。' },
      { id: 'sps_danyin',   name: '丹引靈香', icon: '🌸', eff: { alchSuccPct: 5 },           w: 70,  desc: '靈香一縷入丹爐，火候自分，丹成有望。 丹爐點了點頭：這次看起來比較有把握。' },
      { id: 'sps_pojun',    name: '破軍臨陣', icon: '💥', eff: { critPct: 5 },               w: 60,  desc: '破軍星動，一擊必殺之機乍現。 夜裡亮晶晶，照路與擺帥兩相宜。' },
      { id: 'sps_shihun',   name: '噬魂奪魄', icon: '🌑', eff: { atkPct: 6, dropPct: 4 },    w: 40,  desc: '器靈噬敵之魂以養己身，殺敵愈多，靈性愈盛。 保養做得好，修仙路上少皺眉。' },
    ],
  };

  /* ==================== 強化/升星公式（純計算函數） ==================== */
  const ORE_BY_GRADE = ['ore_jingtie', 'ore_xuantie', 'ore_zijin', 'ore_xingchen', 'ore_longjin'];
  const formula = {
    maxStar: 10, // 升星上限（契約 §9.5）
    maxEnh: 20,  // 強化上限 +20（器靈 +15 喚醒條件在其內）

    /* 強化屬性倍率：每級 +8% 底材白值，+20 時 ×2.6 */
    enhMul(lv) { return 1 + 0.08 * (lv || 0); },

    /* 升星屬性倍率：每星 +15% 底材白值，10 星時 ×2.5 */
    starMul(star) { return 1 + 0.15 * (star || 0); },

    /* 強化 lv→lv+1 消耗：靈石 + 對應品階礦石（數量隨等級遞增）。
       lv 為當前強化等級（0 起），grade 缺省 0。靈石曲線 1.45^lv（原 1.65^lv 過陡，強滿≈單寵 18 天靈石） */
    enhanceCost(lv, grade) {
      grade = grade || 0;
      const cost = { lingShi: Math.floor(120 * Math.pow(1.45, lv) * Math.pow(6, grade)), mat: {} };
      cost.mat[ORE_BY_GRADE[grade] || 'ore_jingtie'] = 2 + lv;
      return cost;
    },

    /* 升星 star→star+1 消耗：靈玉 + 星砂；5 星及以上另需同名底材 1 件
       （dup 僅為標記，由 forge 系統校驗並消耗，本函數不改任何狀態）。 */
    starCost(star, grade) {
      grade = grade || 0;
      return {
        lingYu: (star + 1) * 3 * (grade + 1),
        mat: { ore_xingsha: star + 1 },
        dup: star >= 5 ? 1 : 0,
      };
    },
  };

  /* ==================== 登記 ==================== */
  XG.data.equips = { bases: bases, affixes: affixes, sets: sets, gems: gems, spirits: spirits, formula: formula };
  XG.data.mats = Object.assign(XG.data.mats || {}, mats);
})();
