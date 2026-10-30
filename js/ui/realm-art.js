/* realm-art.js：十個大境界的原創服裝與場景；不寫入存檔、不影響養成數值。 */
(function () {
  'use strict';
  const XG = window.XG = window.XG || {};
  const entries = [
    { id: 'lianqi', scene: '桃花小仙境', outfit: '青綠入門袍・翡翠髮扣', src: 'assets/cultivation-garden.png', color: '#82a77e', quip: '新手仙袍很輕，成仙的夢很大。' },
    { id: 'zhuji', scene: '竹林小院', outfit: '玉白青竹袍・碧玉披肩', src: 'assets/realms/01-zhuji.webp', color: '#568d73', quip: '地基打好了，衣櫃也該升級了。' },
    { id: 'jindan', scene: '金杏暖庭', outfit: '蜜金繡紋袍・金玉髮飾', src: 'assets/realms/02-jindan.webp', color: '#c79740', quip: '金丹有了，金色穿搭也要跟上。' },
    { id: 'yuanying', scene: '月下蓮池', outfit: '月白薰紫袍・銀蓮飄帶', src: 'assets/realms/03-yuanying.webp', color: '#a089bd', quip: '元嬰負責修行，我負責可愛。' },
    { id: 'huashen', scene: '碧晶天台', outfit: '碧青星繡袍・琉璃肩紗', src: 'assets/realms/04-huashen.webp', color: '#4b9c9e', quip: '神識擴張了，煩惱就不必跟著擴張。' },
    { id: 'lianxu', scene: '星河雲海', outfit: '靛紫星月袍・銀紋斗篷', src: 'assets/realms/05-lianxu.webp', color: '#8b7bb7', quip: '虛空很大，剛好放我的待辦事項。' },
    { id: 'heti', scene: '雙嶼桃源', outfit: '珊瑚雙色袍・金繡玉帶', src: 'assets/realms/06-heti.webp', color: '#c99098', quip: '人與道合一，衣服終於也合身。' },
    { id: 'dacheng', scene: '雲上仙宮', outfit: '珍珠金蓮袍・雲光披風', src: 'assets/realms/07-dacheng.webp', color: '#baa36b', quip: '大乘級的排場，午睡級的心態。' },
    { id: 'dujie', scene: '紫霄雷台', outfit: '雷紫銀紋袍・金電護腕', src: 'assets/realms/08-dujie.webp', color: '#9474ba', quip: '雷公上班了，我先把新衣服穿好。' },
    { id: 'feisheng', scene: '虹光天門', outfit: '虹彩天仙袍・金冠輕紗', src: 'assets/realms/09-feisheng.webp', color: '#d6b17e', quip: '終於飛升！請問仙界哪裡可以補眠？' },
  ];
  // 女主角各境界採獨立長髮版；男主角沿用各境界場景與原有男裝。
  entries.forEach(function (e, i) { e.gender = 'female'; e.key = e.id + ':female'; e.src = 'assets/genders/female/' + String(i).padStart(2, '0') + '-' + e.id + '.webp'; e.outfit += '・長髮披肩'; });
  const maleOutfits = ['青白直襟袍・簡玉髮簪', '青竹男式仙袍・玉綠肩披', '白金男式法袍・金玉腰封', '月白銀蓮袍・紫玉髮簪', '碧青星紋袍・琉璃肩巾', '靛紫星月袍・銀紋肩氅', '珊瑚金繡袍・雙玉腰帶', '白金天宮袍・金冠雲氅', '雷紫銀甲袍・金電護腕', '虹光天仙袍・金冠輕氅'];
  const male = entries.map(function (e, i) {
    return Object.assign({}, e, { gender: 'male', key: e.id + ':male', src: 'assets/genders/male/' + String(i).padStart(2, '0') + '-' + e.id + '.webp', outfit: maleOutfits[i] });
  });
  XG.sceneArt = {
    list: entries, maleList: male,
    listForGender: function (gender) { return gender === 'male' ? male : entries; },
    forRealm: function (idx, gender) {
      const n = Number(idx), list = gender === 'male' ? male : entries;
      return list[Math.min(list.length - 1, Math.max(0, Number.isFinite(n) ? Math.floor(n) : 0))];
    },
  };
})();
