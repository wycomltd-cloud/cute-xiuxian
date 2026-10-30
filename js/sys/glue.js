/* glue.js：跨系統膠水層（聯調階段補）——並行開發的系統之間預定接口的最終對接
 *
 * 職責（全部在 init 中執行，init 由 main.js 在其餘系統之後統一調用）：
 * 0. 主循環 tick 分發：main.js 只 emit bus 'tick'，除 adventure 自訂閱外其餘系統的
 *    tick(dt) 方法無人調用；glue 訂閱 bus 'tick' 按 sysOrder 分發（跳過 adventure/自身）。
 * 1. 突破丹藥增益串聯：包裝 cultivation.getBreakInfo / tryBreakthrough，
 *    把 alchemy 已服破境丹 buff（state.alchemy.breakPills，經 getBreakBuffBonus/consumeBreakBuffs）
 *    真正計入大境界突破成功率；判定後（成敗皆耗）清空 buff。
 *    —— cultivation 自身的 pillIds 路徑消耗的是揹包丹藥，與 alchemy 已服 buff 互不重複：
 *       揹包丹按 pillIds 耗一次，已服 buff 耗一次，兩條路徑各自只計一次。
 * 2. cultivation.washRootFree() / lightMeridianFree(n)：adventure 奇遇獎勵用的免費版別名，
 *    基於公開的 washRoot/lightMeridian 實現（墊付消耗→調用→回收/恢復，不耗玩家資源）。
 * 3. pets.feedTeamExp(n, src)：別名到 pets.addTeamExp（alchemy 服獸丹優先調此名）。
 * 4. fellows.onRivalBattle(win, uid)：pvp 宿敵戰後調用——按 data/fellows 的 war 文案池
 *    發一條宿敵戰書 news（複用 fellows 的 fellow 傳聞風格：落 state.news + emit news/fellow:news）。
 * 5. reincarn 自定義鍵（dunwuRatePct/advRatePct/marketDiscPct 等）已由 reincarn.getMods
 *    輸出，core/stats.js calc() 以 Object.assign({}, mods) 全鍵透傳（已讀碼確認，無需修補）；
 *    glue.getMods() 返回空對象，不重複加計。三個消費方接通情況：
 *    - advRatePct → 本文件 §5 包裝 adventure.tick/offline（cd 流逝速率 ×(1+pct/100)）。
 *    - dunwuRatePct → cultivation.js dunwuChancePerSec() 閉包不可達，已在該文件內做最小乘法修補。
 *    - marketDiscPct → fellows.js genMarket() 閉包不可達，已在該文件內做最小乘法修補（7 折下限）。
 *
 * 原則：不修改其餘 13 個 sys 文件；所有對接均為防禦性包裝（目標缺失則跳過）。
 * （例外：上述兩個閉包內概率/價格無法外部包裝，按任務授權做了一行級最小修補。）
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  function alchemy() { return XG.sys && XG.sys.alchemy; }

  // ============================ 0. 主循環 tick 分發 ============================
  // main.js 主循環只 emit bus 'tick'（契約 §13）；而契約 §10 約定各系統暴露 tick(dt) 方法由調度器調用。
  // 實際只有 adventure 自訂閱了 bus 'tick'，其餘系統的 tick(dt) 無人調用——
  // 導致修為不累積、丹爐不結算、坊市不刷新、道友不成長等。glue 在此架橋：
  // 訂閱 bus 'tick'，按 sysOrder 分發到各系統 tick(dt)（跳過 adventure，避免雙重步進；跳過自身）。
  function bridgeTick() {
    XG.bus.on('tick', function (p) {
      const dt = (p && p.dt) || 1;
      const order = XG.sysOrder || [];
      for (const id of order) {
        if (id === 'glue' || id === 'adventure') continue;
        const m = XG.sys && XG.sys[id];
        if (m && typeof m.tick === 'function') {
          try { m.tick(dt); } catch (e) { console.error('[glue] ' + id + '.tick() 出錯', e); }
        }
      }
    });
  }

  // ============================ 1. 突破丹藥增益串聯 ============================
  function wrapBreakthrough() {
    const cult = XG.sys.cultivation;
    if (!cult) return;

    // getBreakInfo 包裝：大境界時把已服破境丹 buff 計入 baseRate/rateWith（預覽與實算同源）
    const origInfo = cult.getBreakInfo.bind(cult);
    cult.getBreakInfo = function () {
      const info = origInfo();
      const al = alchemy();
      if (info && info.big && al && typeof al.getBreakBuffBonus === 'function') {
        let bonus = 0;
        try { bonus = al.getBreakBuffBonus() || 0; } catch (e) { bonus = 0; }
        if (bonus > 0) {
          const base = (info.baseRate || 0) + bonus;
          info.breakBuffBonus = bonus; // 已服破境丹加值（小數，供 UI 展示）
          info.breakBuffs = typeof al.getBreakBuffs === 'function' ? al.getBreakBuffs() : [];
          info.baseRate = base;
          info.rateWith = function (n) {
            n = XG.util.clamp(Math.floor(n || 0), 0, info.pillMax || 3);
            return Math.min(0.98, base + n * XG.cfg.BREAK_PILL_BONUS);
          };
        }
      }
      return info;
    };

    // tryBreakthrough 包裝：大境界突破判定後清空已服破境丹 buff（與揹包丹同規，成敗皆耗）
    const origTry = cult.tryBreakthrough.bind(cult);
    cult.tryBreakthrough = function (pillIds) {
      const res = origTry(pillIds);
      const al = alchemy();
      if (res && res.ok && res.big && al && typeof al.consumeBreakBuffs === 'function') {
        try { al.consumeBreakBuffs(); } catch (e) { console.error('[glue] consumeBreakBuffs 出錯', e); }
      }
      return res;
    };
  }

  // ============================ 2. 免費洗靈根 / 免費點穴別名 ============================
  function addFreeAliases() {
    const cult = XG.sys.cultivation;
    if (!cult) return;

    // 免費洗靈根（adventure 奇遇 rootWash 獎勵）：墊付消耗 → 調原版 → 未成功收回墊付
    if (typeof cult.washRootFree !== 'function') {
      cult.washRootFree = function () {
        const cost = typeof cult._washCost === 'function' ? cult._washCost() : { lingYu: 0, mat: {} };
        const grant = { lingYu: cost.lingYu || 0, mat: {} };
        for (const id in (cost.mat || {})) grant.mat[id] = cost.mat[id];
        XG.addRes(grant); // 墊付後即被 washRoot 扣除，玩家資源淨變化為 0
        const res = cult.washRoot();
        if (!res || !res.ok) { // 兜底：未洗成則收回墊付
          const back = { lingYu: -grant.lingYu, mat: {} };
          for (const id in grant.mat) back.mat[id] = -grant.mat[id];
          XG.addRes(back);
          return (res && res.err) || '洗練未成';
        }
        return res.msg || '靈根已重洗';
      };
    }

    // 免費點亮穴位（adventure 奇遇 meridian 獎勵）：墊付修為點亮後恢復，按表序點 n 個前置已通的
    if (typeof cult.lightMeridianFree !== 'function') {
      cult.lightMeridianFree = function (n) {
        n = Math.max(1, Math.floor(n || 1));
        const list = typeof cult.getMeridians === 'function' ? cult.getMeridians() : [];
        const p = XG.state.player;
        const names = [];
        for (const m of list) {
          if (names.length >= n) break;
          if (m.lit || m.err === '前置穴位未通') continue; // 只點前置已通、自身未亮的
          const before = p.cult || 0;
          if (before < m.cost) p.cult = m.cost; // 墊付修為
          const res = cult.lightMeridian(m.id);
          p.cult = before; // 免費：恢復修為
          if (res && res.ok) names.push(res.name);
        }
        if (!names.length) return '經脈無可點之穴';
        return '點亮穴位「' + names.join('、') + '」';
      };
    }
  }

  // ============================ 3. pets.feedTeamExp 別名 ============================
  function aliasPets() {
    const pets = XG.sys.pets;
    if (pets && typeof pets.addTeamExp === 'function' && typeof pets.feedTeamExp !== 'function') {
      pets.feedTeamExp = function (n, src) { return pets.addTeamExp(n); };
    }
  }

  // ============================ 4. fellows.onRivalBattle 宿敵戰書 ============================
  function patchFellows() {
    const fellows = XG.sys.fellows;
    if (!fellows || typeof fellows.onRivalBattle === 'function') return;
    fellows.onRivalBattle = function (win, uid) {
      const st = XG.state;
      const list = st.fellows || [];
      let f = null;
      for (const x of list) { if (x.uid === uid) { f = x; break; } }
      const pool = (XG.data && XG.data.fellows && XG.data.fellows.lines && XG.data.fellows.lines.war) || [];
      const tpl = pool.length ? XG.util.pick(pool) : '「{name}，擇日再戰！」';
      const playerName = (st.player && st.player.name) || '道友';
      const quote = String(tpl).replace(/\{name\}/g, playerName);
      const lead = f
        ? f.name + (win ? '敗於你手，心有不甘，擲下戰書：' : '勝你一局，意氣正盛，擲下戰書：')
        : '宿敵擲下戰書：';
      const text = lead + quote;
      // 防禦性 push state.news + emit（複用 fellows 的 fellow 傳聞風格）
      st.news = st.news || [];
      const item = { t: Date.now(), cat: 'fellow', text: text, imp: 1 };
      st.news.unshift(item);
      const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
      if (st.news.length > cap) st.news.length = cap;
      st.stats = st.stats || {};
      st.stats.news_count = (st.stats.news_count || 0) + 1;
      XG.bus.emit('news', item);
      XG.bus.emit('fellow:news', { uid: uid || '', text: text, imp: 1, t: item.t });
      XG.bus.emit('save:dirty');
    };
  }

  // ============================ 5. adventure 奇遇率加成（輪迴 advRatePct 透傳鍵） ============================
  // adventure 的修煉奇遇為 cd 制（300~900s roll 一次，tick 內 a.cd -= dt）。
  // 此處包裝 tick/offline 步進：dt ×(1+advRatePct/100)，等效於觸發頻率 ×(1+pct/100)。
  // adventure 自訂閱 bus 'tick' 時是閉包內動態讀 self.tick，故後包裝仍生效；getCdRange 展示區間不變。
  function patchAdventure() {
    const adv = XG.sys.adventure;
    if (!adv || adv._advRateWrapped) return;
    function factor() {
      let pct = 0;
      try { pct = (XG.stats && XG.stats.get().advRatePct) || 0; } catch (e) { pct = 0; }
      if (!isFinite(pct)) pct = 0;
      return 1 + pct / 100;
    }
    if (typeof adv.tick === 'function') {
      const origTick = adv.tick.bind(adv);
      adv.tick = function (dt) { return origTick((Number(dt) || 0) * factor()); };
    }
    if (typeof adv.offline === 'function') {
      const origOffline = adv.offline.bind(adv);
      adv.offline = function (dt) { return origOffline((Number(dt) || 0) * factor()); };
    }
    adv._advRateWrapped = true;
  }

  // ============================ 系統註冊（排最後，由 main.js 統一調 init） ============================
  XG.sys.glue = {
    id: 'glue',

    init() {
      try { bridgeTick(); } catch (e) { console.error('[glue] tick 分發失敗', e); }
      try { wrapBreakthrough(); } catch (e) { console.error('[glue] 突破串聯失敗', e); }
      try { addFreeAliases(); } catch (e) { console.error('[glue] 免費別名失敗', e); }
      try { aliasPets(); } catch (e) { console.error('[glue] 靈寵別名失敗', e); }
      try { patchFellows(); } catch (e) { console.error('[glue] 宿敵戰書失敗', e); }
      try { patchAdventure(); } catch (e) { console.error('[glue] 奇遇率包裝失敗', e); }
    },

    // 屬性聚合：空對象——reincarn 的 dunwuRatePct/advRatePct/marketDiscPct 等鍵
    // 已由 reincarn.getMods 輸出並經 stats.calc 透傳，glue 不重複加計
    getMods() { return {}; },
  };

  XG.sysOrder.push('glue');
})();
