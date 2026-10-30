/* achievements.js：成就表（契約 §9.8）
   —— XG.data.ach = [...]；元素 {id:'ac_*', name, icon, desc, hidden, cat, check:{k,v}, reward:{lingYu?, lingShi?, eff?}}
   —— reward.eff 為永久屬性加成，鍵名取契約 §7 mods 鍵（cultRatePct/atkPct/defPct/hpPct/dropPct/
      alchSuccPct/forgeSuccPct/breakSuccPct/offlineHours/workPct），單項數值剋制 ≤5。
   —— check.k 由 collection.js 統計器實現。本文件用到的 key 一覽：
      【契約原列】layer / realmIdx / totalCult / gongfaOwn / gongfaMaxLv / pillMake / pillExplode /
        tox100 / equipEnhMax / equipGod / petOwn / petGrade5 / caveLvSum / mapUnlock / towerLayer /
        pvpWins / fellowFavorMax / fellowPartner / reincarn / codexPct / newsCount / helpFellow /
        nightLogin / rich
      【本文件新增，collection.js 需實現同名統計器】
        alchLv            煉丹師等級（state.alchemy.lv）
        advDone           已完成奇遇事件數（state.adventure.done 計數）
        breakFailStreak   當前連續突破失敗次數（突破成功清零；取歷史峯值）
        expeditionCount   累計派遣次數（expedition 系統累加）
        fellowEggFavorMax 彩蛋名道友（names.js egg 表）中的最高好感
        fellowRival       當前宿敵（relation='rival'）數量
        forgeMake         累計打造裝備件數（forge 系統累加）
        gongfaCreateCount 自創功法數量（state.gongfa.custom.length）
        gongfaHidden      已習得隱藏功法數量（owned 中 hidden=true 的功法數）
        guardWave         守關歷史最高波次（dungeon.guard 最佳紀錄）
        hiddenMapUnlock   已解鎖隱藏地圖數（world.maps 中 hidden=true 且已解鎖）
        petAwaken         血脈覺醒寵物數（pets.list 中已覺醒計數）
        petBreed          靈寵繁殖次數（pets 系統累加）
        playerEggName     玩家名字命中彩蛋名錶（names.js egg）則為 1，否則 0
        pvpPts            論劍當前積分（state.pvp.pts 歷史峯值）
        spiritRootMut     靈根為變異（spiritRoot.mut 非 null）則為 1，否則 0
        towerHiddenBoss   擊敗爬塔隱藏 BOSS 次數（每 33 層一隻，dungeon 系統累加）
        totalOnlineH      累計在線小時數（totalOnlineSec/3600 向下取整）
*/
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.data = XG.data || {}; // data 層掛載點由數據文件自建（加載順序任意，兜底）

  XG.data.ach = [
    /* ==================== cult 修煉 ==================== */
    { id: 'ac_cult_01', name: '引氣入體', icon: '🌱', cat: 'cult', hidden: false,
      check: { k: 'layer', v: 5 }, reward: { lingYu: 5 },
      desc: '煉氣五層，成功引氣入體。恭喜，你的深呼吸終於有了專業證照。' },
    { id: 'ac_cult_02', name: '煉氣圓滿', icon: '💮', cat: 'cult', hidden: false,
      check: { k: 'layer', v: 10 }, reward: { lingYu: 10 },
      desc: '煉氣十層圓滿，只待築基。氣海滿了，仙途還有好多頁沒翻。' },
    { id: 'ac_cult_03', name: '聚沙成塔', icon: '⏳', cat: 'cult', hidden: false,
      check: { k: 'totalCult', v: 1e5 }, reward: { lingYu: 8 },
      desc: '累計修為十萬。每天一點點，終於把小水杯存成了大水缸。' },
    { id: 'ac_cult_04', name: '築基立業', icon: '🏔', cat: 'cult', hidden: false,
      check: { k: 'realmIdx', v: 1 }, reward: { lingYu: 30, eff: { cultRatePct: 2 } },
      desc: '築基成功，道基站穩。人生第一個穩固工程，沒有偷工減料。' },
    { id: 'ac_cult_05', name: '金丹一粒', icon: '🟡', cat: 'cult', hidden: false,
      check: { k: 'realmIdx', v: 2 }, reward: { lingYu: 80 },
      desc: '凝成金丹一粒。肚子裡這顆很珍貴，請不要誤認成糯米丸。' },
    { id: 'ac_cult_06', name: '元嬰出竅', icon: '🧘', cat: 'cult', hidden: false,
      check: { k: 'realmIdx', v: 3 }, reward: { lingYu: 150, eff: { hpPct: 2 } },
      desc: '元嬰凝形，神魂能出竅。現在的你，連發呆都可以離體進行。' },
    { id: 'ac_cult_07', name: '化神悟道', icon: '🌟', cat: 'cult', hidden: false,
      check: { k: 'realmIdx', v: 4 }, reward: { lingYu: 300, eff: { atkPct: 3 } },
      desc: '化神悟道，天地之勢隨身。舉手有氣場，拿筷子請控制力道。' },
    { id: 'ac_cult_08', name: '煉虛還樸', icon: '🌫', cat: 'cult', hidden: false,
      check: { k: 'realmIdx', v: 5 }, reward: { lingYu: 500 },
      desc: '煉虛還樸，虛實相生。師弟聽完點了頭，其實一句也沒聽懂。' },
    { id: 'ac_cult_09', name: '合體歸一', icon: '☯', cat: 'cult', hidden: false,
      check: { k: 'realmIdx', v: 6 }, reward: { lingYu: 800, eff: { defPct: 3 } },
      desc: '合體歸一，形神與道相合。你和大道，終於把合作條款談好了。' },
    { id: 'ac_cult_10', name: '大乘圓滿', icon: '🪷', cat: 'cult', hidden: false,
      check: { k: 'realmIdx', v: 7 }, reward: { lingYu: 1500 },
      desc: '大乘功行漸足。天劫還沒敲門，先別急著貼歡迎光臨。' },
    { id: 'ac_cult_11', name: '渡劫問天', icon: '⚡', cat: 'cult', hidden: false,
      check: { k: 'realmIdx', v: 8 }, reward: { lingYu: 2500, eff: { breakSuccPct: 3 } },
      desc: '九霄雷動，進入渡劫之境。修仙進度更新：即將接受天空面試。' },
    { id: 'ac_cult_12', name: '飛昇證道', icon: '🌈', cat: 'cult', hidden: false,
      check: { k: 'realmIdx', v: 9 }, reward: { lingYu: 5000, eff: { cultRatePct: 5 } },
      desc: '白日飛升，霞舉成仙。恭喜畢業，下一張報到表也準備好了。' },
    { id: 'ac_cult_13', name: '功行萬貫', icon: '📿', cat: 'cult', hidden: false,
      check: { k: 'totalCult', v: 1e9 }, reward: { lingYu: 120 },
      desc: '累計修為十億。小數字已經放不下你的耐心。' },
    { id: 'ac_cult_14', name: '修為如淵', icon: '🌊', cat: 'cult', hidden: false,
      check: { k: 'totalCult', v: 1e15 }, reward: { lingYu: 2000, eff: { cultRatePct: 3 } },
      desc: '累計修為千萬億。師父數到一半，決定改用點頭表示肯定。' },

    /* ==================== gongfa 功法 ==================== */
    { id: 'ac_gf_01', name: '初窺門徑', icon: '📜', cat: 'gongfa', hidden: false,
      check: { k: 'gongfaOwn', v: 1 }, reward: { lingYu: 5 },
      desc: '習得第一本功法。大道三千，先從這一本的第一頁開始。' },
    { id: 'ac_gf_02', name: '博覽羣經', icon: '📚', cat: 'gongfa', hidden: false,
      check: { k: 'gongfaOwn', v: 8 }, reward: { lingYu: 40 },
      desc: '已學八部功法。腦袋裝得下，書架快裝不下。' },
    { id: 'ac_gf_03', name: '藏經滿樓', icon: '🏛', cat: 'gongfa', hidden: false,
      check: { k: 'gongfaOwn', v: 16 }, reward: { lingYu: 200, eff: { cultRatePct: 2 } },
      desc: '十六部功法在手。別人帶便當，你出門帶一座小圖書館。' },
    { id: 'ac_gf_04', name: '爐火純青', icon: '🔥', cat: 'gongfa', hidden: false,
      check: { k: 'gongfaMaxLv', v: 10 }, reward: { lingYu: 100, eff: { atkPct: 2 } },
      desc: '一門功法練到十重。這本已經不是熟讀，是會反過來跟你打招呼。' },
    { id: 'ac_gf_05', name: '開宗立派', icon: '🖋', cat: 'gongfa', hidden: false,
      check: { k: 'gongfaCreateCount', v: 1 }, reward: { lingYu: 600, eff: { cultRatePct: 3 } },
      desc: '自創一門功法。恭喜開啟作者生涯，師父正在等你的初版。' },
    { id: 'ac_gf_h1', name: '遺世孤篇', icon: '🗞', cat: 'gongfa', hidden: true,
      check: { k: 'gongfaHidden', v: 1 }, reward: { lingYu: 400 },
      desc: '學會一部隱藏功法。來源暫時保密，嘴角請先收一下。' },

    /* ==================== pill 煉丹 ==================== */
    { id: 'ac_pill_01', name: '初試爐火', icon: '🍶', cat: 'pill', hidden: false,
      check: { k: 'pillMake', v: 1 }, reward: { lingYu: 10 },
      desc: '第一爐丹藥成功出爐。香味正常，師兄們終於願意靠近丹房。' },
    { id: 'ac_pill_02', name: '丹熟五十', icon: '⚗', cat: 'pill', hidden: false,
      check: { k: 'pillMake', v: 50 }, reward: { lingYu: 60 },
      desc: '累計成丹五十。手感漸熟，丹爐對你的信任也加了一點。' },
    { id: 'ac_pill_03', name: '丹成千爐', icon: '🏺', cat: 'pill', hidden: false,
      check: { k: 'pillMake', v: 500 }, reward: { lingYu: 500, eff: { alchSuccPct: 3 } },
      desc: '累計成丹五百。丹房常客，衣服聞起來都是認真。' },
    { id: 'ac_pill_04', name: '丹道宗師', icon: '👑', cat: 'pill', hidden: false,
      check: { k: 'alchLv', v: 8 }, reward: { lingYu: 300, eff: { alchSuccPct: 2 } },
      desc: '煉丹師八級。藥材進了門，都會自動站好隊。' },
    { id: 'ac_pill_05', name: '炸爐驚魂', icon: '💥', cat: 'pill', hidden: false,
      check: { k: 'pillExplode', v: 1 }, reward: { lingYu: 5 },
      desc: '第一次炸爐。恭喜解鎖丹道副修：煙霧處理與掃地。' },
    { id: 'ac_pill_h1', name: '百鍊成灰', icon: '🌋', cat: 'pill', hidden: true,
      check: { k: 'pillExplode', v: 20 }, reward: { lingYu: 300, eff: { forgeSuccPct: 2 } },
      desc: '炸爐二十次。爐灰很厚，道心更厚，掃帚都認得你了。' },
    { id: 'ac_pill_h2', name: '丹毒攻心', icon: '☠', cat: 'pill', hidden: true,
      check: { k: 'tox100', v: 1 }, reward: { lingYu: 200 },
      desc: '丹毒達到百點。丹藥不是糖豆，身體已經舉牌提醒。' },

    /* ==================== equip 裝備 ==================== */
    { id: 'ac_eq_01', name: '百鍊精鋼', icon: '🔨', cat: 'equip', hidden: false,
      check: { k: 'equipEnhMax', v: 5 }, reward: { lingYu: 30 },
      desc: '一件裝備強化到+5。小鐵錘敲出了大大的成就感。' },
    { id: 'ac_eq_02', name: '千錘百煉', icon: '⚒', cat: 'equip', hidden: false,
      check: { k: 'equipEnhMax', v: 10 }, reward: { lingYu: 120, eff: { atkPct: 2 } },
      desc: '一件裝備強化到+10。鋒芒閃亮，鐵匠的手臂也亮了一圈汗。' },
    { id: 'ac_eq_03', name: '神器初臨', icon: '🗡', cat: 'equip', hidden: false,
      check: { k: 'equipGod', v: 1 }, reward: { lingYu: 400, eff: { hpPct: 2 } },
      desc: '第一次獲得神品裝備。裝備有靈，現在你連穿搭都有隊友。' },
    { id: 'ac_eq_04', name: '六神護體', icon: '🛡', cat: 'equip', hidden: false,
      check: { k: 'equipGod', v: 6 }, reward: { lingYu: 2500, eff: { defPct: 5 } },
      desc: '六件神品全身到位。走起路來，連風都想看你的裝備欄。' },
    { id: 'ac_eq_05', name: '鑄器五十', icon: '🏭', cat: 'equip', hidden: false,
      check: { k: 'forgeMake', v: 50 }, reward: { lingYu: 150, eff: { forgeSuccPct: 2 } },
      desc: '親手打造五十件裝備。看一眼火色就懂，摸一下錢袋就痛。' },

    /* ==================== pet 靈寵 ==================== */
    { id: 'ac_pet_01', name: '靈寵初遇', icon: '🐣', cat: 'pet', hidden: false,
      check: { k: 'petOwn', v: 1 }, reward: { lingYu: 8 },
      desc: '遇見第一隻靈寵。從此修仙有伴，點心也有競爭者。' },
    { id: 'ac_pet_02', name: '百獸來朝', icon: '🐾', cat: 'pet', hidden: false,
      check: { k: 'petOwn', v: 10 }, reward: { lingYu: 80 },
      desc: '擁有十隻靈寵。宗門氣勢漸成，鏟毛工作也漸成。' },
    { id: 'ac_pet_03', name: '神獸現世', icon: '🐉', cat: 'pet', hidden: false,
      check: { k: 'petGrade5', v: 1 }, reward: { lingYu: 300, eff: { atkPct: 2 } },
      desc: '育成一隻五品神獸。小毛球長大了，連打哈欠都有神威。' },
    { id: 'ac_pet_04', name: '五神齊聚', icon: '🦁', cat: 'pet', hidden: false,
      check: { k: 'petGrade5', v: 5 }, reward: { lingYu: 1800, eff: { hpPct: 4 } },
      desc: '五隻神獸到齊。你的小院，現在需要一份神獸座位表。' },
    { id: 'ac_pet_05', name: '血脈延續', icon: '🥚', cat: 'pet', hidden: false,
      check: { k: 'petBreed', v: 1 }, reward: { lingYu: 100 },
      desc: '第一次靈寵繁殖。新生命報到，家長們請排隊看小寶寶。' },
    { id: 'ac_pet_06', name: '血脈覺醒', icon: '🔱', cat: 'pet', hidden: false,
      check: { k: 'petAwaken', v: 1 }, reward: { lingYu: 500, eff: { atkPct: 3 } },
      desc: '靈寵血脈覺醒。祖先力量醒了，牠本人還有點睏。' },

    /* ==================== cave 洞府 ==================== */
    { id: 'ac_cave_01', name: '洞天初闢', icon: '⛰', cat: 'cave', hidden: false,
      check: { k: 'caveLvSum', v: 6 }, reward: { lingYu: 20 },
      desc: '洞府建築累計六級。小窩升級，連蒲團都覺得自己有前途。' },
    { id: 'ac_cave_02', name: '福地儼然', icon: '🏞', cat: 'cave', hidden: false,
      check: { k: 'caveLvSum', v: 20 }, reward: { lingYu: 150, eff: { workPct: 2 } },
      desc: '洞府建築累計二十級。靈田整齊，師父開始想來借住。' },
    { id: 'ac_cave_03', name: '洞天圓滿', icon: '🌄', cat: 'cave', hidden: false,
      check: { k: 'caveLvSum', v: 40 }, reward: { lingYu: 1000, eff: { workPct: 4 } },
      desc: '洞府建築累計四十級。仙境裝潢完成，請記得留條路給掃地機關。' },

    /* ==================== explore 歷練 ==================== */
    { id: 'ac_exp_01', name: '初逢奇遇', icon: '🎐', cat: 'explore', hidden: false,
      check: { k: 'advDone', v: 1 }, reward: { lingYu: 5 },
      desc: '完成第一樁奇遇。今天的仙緣，竟然沒有先預約。' },
    { id: 'ac_exp_02', name: '緣法十樁', icon: '🎋', cat: 'explore', hidden: false,
      check: { k: 'advDone', v: 10 }, reward: { lingYu: 50 },
      desc: '完成十樁奇遇。不是你在找故事，是故事天天找你報到。' },
    { id: 'ac_exp_03', name: '遍歷三山', icon: '🗺', cat: 'explore', hidden: false,
      check: { k: 'mapUnlock', v: 3 }, reward: { lingYu: 30 },
      desc: '解鎖三張歷練地圖。仙界散步範圍，正式超出自家後山。' },
    { id: 'ac_exp_04', name: '足跡六合', icon: '🧭', cat: 'explore', hidden: false,
      check: { k: 'mapUnlock', v: 6 }, reward: { lingYu: 150, eff: { dropPct: 2 } },
      desc: '解鎖六張歷練地圖。你的鞋底，比師弟的見識還廣。' },
    { id: 'ac_exp_05', name: '八荒踏遍', icon: '🌏', cat: 'explore', hidden: false,
      check: { k: 'mapUnlock', v: 8 }, reward: { lingYu: 800, eff: { dropPct: 3 } },
      desc: '解鎖八張歷練地圖。八荒任你走，先確認行囊沒有漏帶。' },
    { id: 'ac_exp_06', name: '秘境尋蹤', icon: '🕳', cat: 'explore', hidden: false,
      check: { k: 'hiddenMapUnlock', v: 1 }, reward: { lingYu: 400 },
      desc: '發現一處隱藏秘境。導航找不到的地方，居然被你找到了。' },
    { id: 'ac_exp_07', name: '派遣百次', icon: '📯', cat: 'explore', hidden: false,
      check: { k: 'expeditionCount', v: 100 }, reward: { lingYu: 600, eff: { workPct: 3 } },
      desc: '派遣靈寵歷練百次。隊長指揮很熟練，隊員只想知道點心在哪。' },
    { id: 'ac_exp_08', name: '緣法五十', icon: '🎑', cat: 'explore', hidden: false,
      check: { k: 'advDone', v: 50 }, reward: { lingYu: 500 },
      desc: '完成五十樁奇遇。仙界新聞社，正在考慮給你一張常客卡。' },

    /* ==================== dungeon 秘境 ==================== */
    { id: 'ac_dun_01', name: '登塔十層', icon: '🗼', cat: 'dungeon', hidden: false,
      check: { k: 'towerLayer', v: 10 }, reward: { lingYu: 40 },
      desc: '鎮妖塔到達十層。爬樓小有心得，膝蓋還在努力配合。' },
    { id: 'ac_dun_02', name: '三十三天', icon: '🏯', cat: 'dungeon', hidden: false,
      check: { k: 'towerLayer', v: 33 }, reward: { lingYu: 200, eff: { hpPct: 2 } },
      desc: '登上鎮妖塔三十三層。傳說的大妖在裡面，請先把點心收好。' },
    { id: 'ac_dun_03', name: '百層問頂', icon: '⛩', cat: 'dungeon', hidden: false,
      check: { k: 'towerLayer', v: 100 }, reward: { lingYu: 800, eff: { atkPct: 3 } },
      desc: '鎮妖塔到達百層。樓下風景很好，樓上還有人在等你。' },
    { id: 'ac_dun_04', name: '五百凌霄', icon: '☁', cat: 'dungeon', hidden: false,
      check: { k: 'towerLayer', v: 500 }, reward: { lingYu: 4000, eff: { atkPct: 5, hpPct: 5 } },
      desc: '鎮妖塔到達五百層。塔的電梯？師父說那叫修行。' },
    { id: 'ac_dun_05', name: '守關十波', icon: '🏰', cat: 'dungeon', hidden: false,
      check: { k: 'guardWave', v: 10 }, reward: { lingYu: 150, eff: { defPct: 2 } },
      desc: '守住十波來犯。門口很熱鬧，但今天就是不開放參觀。' },
    { id: 'ac_dun_h1', name: '塔影尋蹤', icon: '👁', cat: 'dungeon', hidden: true,
      check: { k: 'towerHiddenBoss', v: 1 }, reward: { lingYu: 600, eff: { dropPct: 3 } },
      desc: '擊敗塔中隱藏大妖。對方藏得夠深，你爬得更認真。' },

    /* ==================== pvp 論劍 ==================== */
    { id: 'ac_pvp_01', name: '初露鋒芒', icon: '⚔', cat: 'pvp', hidden: false,
      check: { k: 'pvpWins', v: 1 }, reward: { lingYu: 20 },
      desc: '論劍第一次勝利。劍聲清脆，嘴角也很難低調。' },
    { id: 'ac_pvp_02', name: '百戰不殆', icon: '🏹', cat: 'pvp', hidden: false,
      check: { k: 'pvpWins', v: 50 }, reward: { lingYu: 150, eff: { atkPct: 2 } },
      desc: '論劍累計五十勝。經驗增加，擺帥姿勢也更加自然。' },
    { id: 'ac_pvp_03', name: '劍壓羣雄', icon: '🏆', cat: 'pvp', hidden: false,
      check: { k: 'pvpWins', v: 300 }, reward: { lingYu: 1200, eff: { atkPct: 4 } },
      desc: '論劍累計三百勝。請給對手一點掌聲，也給自己一杯茶。' },
    { id: 'ac_pvp_04', name: '仙尊之位', icon: '🎖', cat: 'pvp', hidden: false,
      check: { k: 'pvpPts', v: 3000 }, reward: { lingYu: 1000, eff: { hpPct: 3 } },
      desc: '論劍積分三千。仙尊這個職稱，終於能認真寫進履歷。' },

    /* ==================== fellow 道友 ==================== */
    { id: 'ac_fel_01', name: '知己相逢', icon: '🤝', cat: 'fellow', hidden: false,
      check: { k: 'fellowFavorMax', v: 60 }, reward: { lingYu: 30 },
      desc: '一位道友好感達六十。高山流水有知音，點心也多一人分。' },
    { id: 'ac_fel_02', name: '結為道侶', icon: '💞', cat: 'fellow', hidden: false,
      check: { k: 'fellowPartner', v: 1 }, reward: { lingYu: 300, eff: { cultRatePct: 2 } },
      desc: '與道友結為道侶。仙路很長，這次有人幫你記得回家。' },
    { id: 'ac_fel_03', name: '宿敵當前', icon: '⚔️', cat: 'fellow', hidden: false,
      check: { k: 'fellowRival', v: 1 }, reward: { lingYu: 100, eff: { atkPct: 2 } },
      desc: '遇到旗鼓相當的宿敵。嘴上互不相讓，進步倒是一起變快。' },
    { id: 'ac_fel_04', name: '援手十次', icon: '🤲', cat: 'fellow', hidden: false,
      check: { k: 'helpFellow', v: 10 }, reward: { lingYu: 60 },
      desc: '相助道友十次。送出丹藥，收回滿滿的好人緣。' },
    { id: 'ac_fel_h1', name: '義薄雲天', icon: '🌤', cat: 'fellow', hidden: true,
      check: { k: 'helpFellow', v: 50 }, reward: { lingYu: 500, eff: { workPct: 3 } },
      desc: '相助道友五十次。宗門有事找你，沒事也想請你喝茶。' },
    { id: 'ac_fel_h2', name: '故人依舊', icon: '🌙', cat: 'fellow', hidden: true,
      check: { k: 'fellowEggFavorMax', v: 100 }, reward: { lingYu: 800, eff: { cultRatePct: 3 } },
      desc: '與彩蛋名道友成為至交。這個名字很眼熟，本人居然也很好聊。' },

    /* ==================== reincarn 輪迴 ==================== */
    { id: 'ac_rei_01', name: '一世輪迴', icon: '🌀', cat: 'reincarn', hidden: false,
      check: { k: 'reincarn', v: 1 }, reward: { lingYu: 1000, eff: { breakSuccPct: 2 } },
      desc: '第一次輪回轉世。人生重開，道心與老經驗一起帶上。' },
    { id: 'ac_rei_02', name: '三生有幸', icon: '🎡', cat: 'reincarn', hidden: false,
      check: { k: 'reincarn', v: 3 }, reward: { lingYu: 2000, eff: { cultRatePct: 3 } },
      desc: '三次輪回。重開流程已熟，仙界戶政都快認得你。' },
    { id: 'ac_rei_03', name: '五世修行', icon: '♾', cat: 'reincarn', hidden: false,
      check: { k: 'reincarn', v: 5 }, reward: { lingYu: 3500, eff: { atkPct: 4 } },
      desc: '五次輪回。第五本人生筆記，封面還是寫著這次一定行。' },
    { id: 'ac_rei_04', name: '九世歸真', icon: '🌌', cat: 'reincarn', hidden: false,
      check: { k: 'reincarn', v: 9 }, reward: { lingYu: 6000, eff: { cultRatePct: 5 } },
      desc: '九次輪回。九世道心，連報到處都想給你快速通道。' },

    /* ==================== fun 雜趣 ==================== */
    { id: 'ac_fun_01', name: '富甲一方', icon: '💰', cat: 'fun', hidden: false,
      check: { k: 'rich', v: 1 }, reward: { lingYu: 100 },
      desc: '靈石超過百萬。錢袋鼓鼓，走路開始有清脆背景音。' },
    { id: 'ac_fun_02', name: '聞道百則', icon: '📰', cat: 'fun', hidden: false,
      check: { k: 'newsCount', v: 100 }, reward: { lingYu: 40 },
      desc: '聽聞百則傳聞。仙界小道消息，你已經不是旁聽生。' },
    { id: 'ac_fun_03', name: '江湖百曉', icon: '🗞', cat: 'fun', hidden: false,
      check: { k: 'newsCount', v: 500 }, reward: { lingYu: 300 },
      desc: '聽聞五百則傳聞。茶還沒泡好，你已經知道隔壁發生什麼。' },
    { id: 'ac_fun_04', name: '圖鑑三成', icon: '📖', cat: 'fun', hidden: false,
      check: { k: 'codexPct', v: 30 }, reward: { lingYu: 100, eff: { dropPct: 2 } },
      desc: '圖鑑完成三成。世界很大，你的小本本也越來越厚。' },
    { id: 'ac_fun_05', name: '圖鑑六成', icon: '📕', cat: 'fun', hidden: false,
      check: { k: 'codexPct', v: 60 }, reward: { lingYu: 400, eff: { dropPct: 3 } },
      desc: '圖鑑完成六成。看到新東西，第一反應是先登記一下。' },
    { id: 'ac_fun_06', name: '萬識歸宗', icon: '📙', cat: 'fun', hidden: false,
      check: { k: 'codexPct', v: 90 }, reward: { lingYu: 2000, eff: { dropPct: 5 } },
      desc: '圖鑑完成九成。只差一點點的感覺，讓人很難安靜打坐。' },
    { id: 'ac_fun_07', name: '朝暮不輟', icon: '🕯', cat: 'fun', hidden: false,
      check: { k: 'totalOnlineH', v: 168 }, reward: { lingYu: 200, eff: { offlineHours: 1 } },
      desc: '累計在線七日。修仙很認真，別忘了讓眼睛也休息一下。' },
    { id: 'ac_fun_h1', name: '子夜修仙', icon: '🌃', cat: 'fun', hidden: true,
      check: { k: 'nightLogin', v: 3 }, reward: { lingYu: 300 },
      desc: '連續三日於零至六時上線。月亮都要下班了，你還在跟靈氣聊天。' },
    { id: 'ac_fun_h2', name: '異根天降', icon: '❄', cat: 'fun', hidden: true,
      check: { k: 'spiritRootMut', v: 1 }, reward: { lingYu: 400, eff: { cultRatePct: 2 } },
      desc: '洗出變異靈根。體質更新，師父正在翻新版教學手冊。' },
    { id: 'ac_fun_h3', name: '五敗之地', icon: '🍂', cat: 'fun', hidden: true,
      check: { k: 'breakFailStreak', v: 5 }, reward: { lingYu: 150, eff: { breakSuccPct: 2 } },
      desc: '連續五次突破失敗。天道有自己的節奏，請先領取一個安慰抱抱。' },
    { id: 'ac_fun_h4', name: '名動古今', icon: '✒', cat: 'fun', hidden: true,
      check: { k: 'playerEggName', v: 1 }, reward: { lingYu: 200 },
      desc: '取了個彩蛋名字。道友停頓了一下：你這名字，感覺很有劇情。' },
  ];
})();
