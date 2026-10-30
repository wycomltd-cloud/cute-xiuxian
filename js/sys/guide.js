/* guide.js：「修行錄」新手目標系統（前期內容豐富迭代）——10 個分階段目標，達成發傳聞，玩家手動領獎
 *
 * ============================ UI 對接面（ui 層唯一接口依據） ============================
 * 全部通過 XG.sys.guide 調用，均可隨時安全調用（內部防禦性校驗）：
 *   list()           → [{ id, name, desc, progress, target, done, claimed, rewardText }]
 *                       按內嵌順序返回 10 條；progress 為當前進度原值（UI 展示自行 cap 到 target）
 *   claim(id)        → { ok:true, msg } | { ok:false, err }   玩家手動領獎（msg/err 可直接 toast）
 *   claimableCount() → number                                 已達成未領取條數（角標用）
 *   nextGoal()       → 單條 list 結構 | null                  第一條未領取的目標；全部領取後返回 null
 *
 * ============================ 進度判定口徑（check.k → 讀取源） ============================
 *   totalCult  → state.stats.total_cult（累計修為）
 *   tuona      → state.stats.tuona_count（手動吐納次數，cultivation.tuona 寫入）
 *   layer      → player.realmIdx*10 + player.layer（跨境界累計層數，突破後不回退）
 *   realmIdx   → player.realmIdx
 *   gongfaOwn  → state.gongfa.owned 鍵數
 *   petHatch   → state.stats.pet_hatch
 *   discuss    → state.stats.discuss_count（fellows.discuss 寫入）
 *   meridian   → player.meridians.lit.length
 *   advDone    → state.adventure.done 鍵數
 *
 * ============================ 行為說明 ============================
 *   進度評估：tick 節流 2 秒批量評估未達成項；達成即置 done + 發 news（imp1, cat:'system'）。
 *   獎勵發放：玩家手動 claim——修為走 cultivation.addCult、殘篇走 gongfa.addFrag、
 *     丹藥/靈寵蛋/靈石/靈玉走 XG.addRes；丹藥 id 運行時從 data/pills 解析
 *     （exp 丹取最低品階、break 丹取 seg 覆蓋 realmIdx 0 者），不硬編碼。
 *   存檔：state.guide = { done:{}, claimed:{} }（懶初始化，不改動 state.js 默認工廠）。
 *   隱藏高光：「仙界正式員工」達成時額外播報 imp2 傳聞（傳聞流高亮）。
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  const EVAL_SEC = 2; // 進度評估節流（秒）

  // ============================ 目標數據（內嵌，順序即展示/推進順序） ============================
  // check:{k,v} 判定口徑見文件頭；reward 鍵：lingShi/lingYu/egg/pill:{kind,n}/fragRandom/cultRealmRate
  const GOALS = [
    { id: 'yinqi', name: '仙氣第一口', desc: '累計修為達 500',
      check: { k: 'totalCult', v: 500 },
      reward: { lingShi: 200 }, rewardText: '靈石×200' },
    { id: 'tuona', name: '今天戳得很勤勞', desc: '手動吐納 10 次',
      check: { k: 'tuona', v: 10 },
      reward: { lingYu: 5 }, rewardText: '靈玉×5' },
    { id: 'chukui', name: '仙界新手畢業班', desc: '臻至煉氣 3 層',
      check: { k: 'layer', v: 3 },
      reward: { egg: 1 }, rewardText: '靈寵蛋×1' },
    { id: 'gongfa', name: '知識開始進腦袋', desc: '習得 1 部功法',
      check: { k: 'gongfaOwn', v: 1 },
      reward: { fragRandom: 3 }, rewardText: '隨機功法殘篇×3' },
    { id: 'pet', name: '恭喜，開始當鏟屎官', desc: '孵化 1 只靈寵',
      check: { k: 'petHatch', v: 1 },
      reward: { pill: { kind: 'exp', n: 1 } }, rewardText: '寵物經驗丹×1' },
    { id: 'discuss', name: '加入仙界聊天羣', desc: '與道友論道 1 次',
      check: { k: 'discuss', v: 1 },
      reward: { lingShi: 1000 }, rewardText: '靈石×1000' },
    { id: 'meridian', name: '經脈解除塞車', desc: '點亮 3 個穴位',
      check: { k: 'meridian', v: 3 },
      reward: { cultRealmRate: 600 }, rewardText: '修為（當前境界 600 秒吐納所得）' },
    { id: 'jiyuan', name: '下山就有小劇場', desc: '完成 3 次奇遇',
      check: { k: 'advDone', v: 3 },
      reward: { lingYu: 5 }, rewardText: '靈玉×5' },
    { id: 'yuanman', name: '煉氣班的資優生', desc: '臻至煉氣 10 層',
      check: { k: 'layer', v: 10 },
      reward: { pill: { kind: 'break', n: 1 } }, rewardText: '築基丹×1' },
    { id: 'zhuji', name: '仙界正式員工', desc: '突破築基之境',
      check: { k: 'realmIdx', v: 1 },
      reward: { lingYu: 20 }, rewardText: '靈玉×20',
      extraNews: { imp: 2, text: '紫氣東來三千里！你道基初成，正式踏入築基之境，四方修士聽聞，皆道一聲「仙途可期」！' } },
  ];

  // ============================ 內部輔助 ============================

  // state.guide 懶初始化（不改 state.js 默認工廠）
  function G() {
    const st = XG.state;
    st.guide = st.guide || {};
    st.guide.done = st.guide.done || {};
    st.guide.claimed = st.guide.claimed || {};
    return st.guide;
  }

  // 內部傳聞助手：落 state.news（NEWS_CAP 截斷）+ emit 'news'（與各系統同規）
  function pushNews(cat, text, imp) {
    const st = XG.state;
    st.news = st.news || [];
    const item = { t: Date.now(), cat: cat, text: text, imp: imp || 0 };
    st.news.unshift(item);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (st.news.length > cap) st.news.length = cap;
    XG.bus.emit('news', item);
    XG.bus.emit('save:dirty');
  }

  // check.k 進度讀取（口徑見文件頭）
  function checkVal(k) {
    const st = XG.state;
    const p = st.player || {};
    const stats = st.stats || {};
    switch (k) {
      case 'totalCult': return stats.total_cult || 0;
      case 'tuona': return stats.tuona_count || 0;
      case 'layer': return (p.realmIdx || 0) * XG.cfg.LAYERS + (p.layer || 1);
      case 'realmIdx': return p.realmIdx || 0;
      case 'gongfaOwn': return Object.keys((st.gongfa && st.gongfa.owned) || {}).length;
      case 'petHatch': return stats.pet_hatch || 0;
      case 'discuss': return stats.discuss_count || 0;
      case 'meridian': return ((p.meridians && p.meridians.lit) || []).length;
      case 'advDone': return Object.keys((st.adventure && st.adventure.done) || {}).length;
    }
    return 0;
  }

  // 丹藥 id 運行時解析（不硬編碼）：exp=eff.type=='exp' 中品階最低者；break=seg 覆蓋 realmIdx 0 者
  const _pillIdCache = {};
  function resolvePillId(kind) {
    if (_pillIdCache[kind]) return _pillIdCache[kind];
    const recipes = (XG.data && XG.data.pills && XG.data.pills.recipes) || [];
    let hit = null;
    if (kind === 'exp') {
      for (const r of recipes) {
        if (!r.eff || r.eff.type !== 'exp') continue;
        if (!hit || (r.grade || 99) < (hit.grade || 99)) hit = r;
      }
    } else if (kind === 'break') {
      for (const r of recipes) {
        if (!r.eff || r.eff.type !== 'break' || !r.seg) continue;
        if (0 >= r.seg[0] && 0 <= r.seg[1]) { hit = r; break; }
      }
    }
    // 防禦性兜底（數據層缺失時退回權威 id，見 DATA_NOTES §二）
    _pillIdCache[kind] = (hit && hit.id) || (kind === 'exp' ? 'pill_lingshou' : 'pill_zhuji');
    return _pillIdCache[kind];
  }

  function pillName(id) {
    const recipes = (XG.data && XG.data.pills && XG.data.pills.recipes) || [];
    for (const r of recipes) if (r.id === id) return r.name;
    return id;
  }

  // 發獎：返回獎勵明細文案數組（修為/殘篇走系統 API，其餘走 XG.addRes）
  function grantReward(def) {
    const r = def.reward || {};
    const parts = [];
    if (r.lingShi) { XG.addRes({ lingShi: r.lingShi }); parts.push('靈石×' + XG.util.fmt(r.lingShi)); }
    if (r.lingYu) { XG.addRes({ lingYu: r.lingYu }); parts.push('靈玉×' + XG.util.fmt(r.lingYu)); }
    if (r.egg) { XG.addRes({ egg: r.egg }); parts.push('靈寵蛋×' + r.egg); }
    if (r.pill) {
      const pid = resolvePillId(r.pill.kind);
      XG.addRes({ pill: { [pid]: r.pill.n || 1 } });
      parts.push(pillName(pid) + '×' + (r.pill.n || 1));
    }
    if (r.fragRandom) {
      const pool = ((XG.data && XG.data.gongfa && XG.data.gongfa.list) || []).filter(function (g) { return !g.hidden; });
      const gf = XG.sys && XG.sys.gongfa;
      for (let i = 0; i < r.fragRandom; i++) {
        if (!pool.length) break;
        const g = XG.util.pick(pool);
        if (gf && typeof gf.addFrag === 'function') gf.addFrag(g.id, 1);
        else XG.addRes({ frag: { [g.id]: 1 } }); // 降級：直接入殘篇袋
      }
      parts.push('隨機功法殘篇×' + r.fragRandom);
    }
    if (r.cultRealmRate) {
      const realm = XG.cfg.REALMS[(XG.state.player || {}).realmIdx || 0] || XG.cfg.REALMS[0];
      const n = realm.rate * r.cultRealmRate;
      const cult = XG.sys && XG.sys.cultivation;
      if (cult && typeof cult.addCult === 'function') cult.addCult(n, '修行錄');
      else { XG.state.player.cult = (XG.state.player.cult || 0) + n; XG.bus.emit('res:changed'); } // 降級直加
      parts.push('修為×' + XG.util.fmt(n));
    }
    return parts;
  }

  // 進度評估：未達成項逐條判定；達成置 done + 發 imp1 系統傳聞（仙界正式員工追加 imp2 高光播報）
  function evaluate() {
    const g = G();
    for (const def of GOALS) {
      if (g.done[def.id]) continue;
      if (checkVal(def.check.k) < def.check.v) continue;
      g.done[def.id] = 1;
      pushNews('system', '修行錄·「' + def.name + '」已達成，可至修煉主頁領取酬賞：' + def.rewardText + '。', 1);
      if (def.extraNews) pushNews('system', def.extraNews.text, def.extraNews.imp);
    }
  }

  // ============================ 系統模塊 ============================
  XG.sys.guide = {
    id: 'guide',
    _acc: 0,

    init() {
      G(); // 懶初始化存檔子樹
      evaluate(); // 老檔/迴歸檔：啓動即補判一次（達成項會在首輪 tick 前落定）
    },

    tick(dt) {
      this._acc += dt || 0;
      if (this._acc < EVAL_SEC) return;
      this._acc = 0;
      evaluate();
    },

    // ============================ UI 對接面 ============================

    list() {
      const g = G();
      return GOALS.map(function (def) {
        return {
          id: def.id,
          name: def.name,
          desc: def.desc,
          progress: checkVal(def.check.k),
          target: def.check.v,
          done: !!g.done[def.id],
          claimed: !!g.claimed[def.id],
          rewardText: def.rewardText,
        };
      });
    },

    claim(id) {
      const g = G();
      let def = null;
      for (const d of GOALS) if (d.id === id) { def = d; break; }
      if (!def) return { ok: false, err: '查無此條修行錄。' };
      if (g.claimed[id]) return { ok: false, err: '此條酬賞已領過了。' };
      if (!g.done[id]) {
        // 領獎前補判一次（進度可能剛達成尚未到 2 秒評估點）
        if (checkVal(def.check.k) >= def.check.v) evaluate();
        if (!g.done[id]) return { ok: false, err: '「' + def.name + '」尚未達成，還需勤勉修行。' };
      }
      g.claimed[id] = 1;
      const parts = grantReward(def);
      XG.bus.emit('save:dirty');
      return { ok: true, msg: '「' + def.name + '」酬賞已領：' + parts.join('、') };
    },

    claimableCount() {
      const g = G();
      let n = 0;
      for (const def of GOALS) if (g.done[def.id] && !g.claimed[def.id]) n++;
      return n;
    },

    nextGoal() {
      const list = this.list();
      for (const it of list) if (!it.claimed) return it;
      return null;
    },
  };

  XG.sysOrder.push('guide');
})();
