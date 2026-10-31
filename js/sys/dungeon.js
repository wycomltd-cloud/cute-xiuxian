/* dungeon.js：秘境副本系統 —— 鎮妖塔爬塔（金丹）/ 守關波次生存（化神）/ 限時尋寶（煉虛）/ 掃蕩
 *
 * ============================================================
 * 【UI 對接面】（供 ui 層調用的全部查詢/操作函數；均同步返回對象，err 字段非空即失敗原因文案）
 *
 * —— 爬塔（解鎖 dungeon_tower：金丹1層）——
 *   towerInfo() → { unlocked, layer, best, need, power, winP, hiddenBoss, boss|null,
 *                   affixes:[{id,name,desc,eff}], week }
 *      need=當前層戰力需求（含周詞綴與隱藏BOSS倍率）；winP=按當前戰力估算勝率(0~1)。
 *   challengeTower() → { ok, err?, win, winP, power, need, layer, hiddenBoss, boss|null,
 *                        rewards:{ lingShi, cult, mat:{id:n}, equip:{name,icon,grade}|null,
 *                                  frag:{id,n}|null, egg, lingYu } }
 *      挑戰當前層：勝率估算 + 隨機；勝利 layer+1 併發放掉落；失敗無任何懲罰（win=false, rewards=null）。
 *
 * —— 守關（解鎖 dungeon_guard：化神1層）——
 *   guardInfo() → { unlocked, cleared, total, done, replay,
 *                   next:{n,name,icon,power,desc,reward}, power, winP }
 *      cleared=已通檔數；done=true 表示 15 檔全通（此後挑戰為復刷末檔，1/3 靈石）。
 *   challengeGuard() → { ok, err?, win, winP, wave:{n,name,icon}, replay, rewards|null }
 *
 * —— 限時尋寶（解鎖 dungeon_hunt：煉虛1層）——
 *   huntInfo() → { unlocked, active, left(剩餘秒), boxes, cdLeft(手動CD剩餘秒),
 *                  freeLeft(今日免費次數 0/1), payCost(靈玉票價), dur }
 *   enterHunt() → { ok, err?, free }     進入遺府：每日首次免費，其後靈玉 10/次；300s 一場。
 *   seek()      → { ok, err?, box:{id,name,icon}|null, gains|null }   手動「探尋」，CD 2s；
 *      gains = { lingShi, lingYu, mat:{id:n}, pill:{id:n}, frag:{id:n}, egg }（本次寶箱所得，已入賬）。
 *      放置時無需調用：場次進行中每 5s 自動開一箱（tick 驅動，離線亦結算自動部分）。
 *   endHunt()   → { ok, err?, boxes }    提前離場（結算傳聞，清場）。
 *
 * —— 掃蕩（爬塔副產物）——
 *   sweepInfo() → { freeLeft, payCost(靈玉/次), perDay, best, canSweep, est:{lingShi, cult} }
 *      est=按當前 towerBest 預估一鍵掃蕩收益（(towerBest−1) 層標準收益 ×0.8）。
 *   quickSweep() → { ok, err?, msg:[文案…], gains:{lingShi, cult, mat:{id:n}} }
 *      一鍵掃蕩：每日免費 30 次（跨天自動重置），其後靈玉 5/次；直接領取 (towerBest−1) 層標準收益×0.8。
 *
 * ============================================================
 * 【寫入 XG.state.stats 的鍵】（懶初始化，成就統計器讀取）
 *   tower_layer        鎮妖塔歷史最高層（對應 check.k = towerLayer）
 *   tower_clear        爬塔累計通關層數
 *   tower_hidden_boss  擊敗爬塔隱藏 BOSS 次數（對應 towerHiddenBoss）
 *   guard_wave         守關歷史最高波次（對應 guardWave）
 *   hunt_enter         限時尋寶入場次數
 *   hunt_box           限時尋寶累計開箱數
 *   sweep_count        累計掃蕩次數
 *
 * 【emit 事件】
 *   'tower:clear' { layer, hiddenBoss }   每通一層（隱藏 BOSS 層 hiddenBoss=true；隱藏功法 tower_33 判定用）
 *   'news'        經內部 pushNews（隱藏 BOSS 擊殺、死關突破、尋寶結算、百層彩蛋）
 *   'res:changed' / 'save:dirty'          均由 XG.addRes 代發
 *
 * 【offline 行為】尋寶進行中途離線：按自動速率（5s/箱）結算離線時段內的寶箱，並補發結算傳聞（併入總報告 events）。
 *   爬塔/守關為主動挑戰玩法，無離線進度。
 *
 * 【隱藏內容】
 *   1. 每 33 層隱藏 BOSS（四靈輪換，戰力 ×2.5）：必掉高 grade 裝備 + 靈玉 + 高階殘篇×2 + 寶石箱；
 *      第 2 輪起（66 層後）必掉歸墟/龍淵隱藏神裝（grade 4 hidden 底材），為隱藏地圖之外的唯一獲取途徑。
 *   2. towerBest 首次達到 100 層，觸發一次性 imp:2 全服傳聞「鎮妖塔百層」彩蛋。
 *   3. 周詞綴「清平」為負向敵益（利玩家），每週 mulberry32(weekId) 從 14 條詞綴池抽 3 條，遇之則本週登塔順遂。
 * ============================================================ */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  /* ==================== 內部常量 ==================== */
  const TOWER_BASE = 500;      // 塔層戰力需求基數：need = 500 × 1.38^N（指數曲線，金丹起步可戰）
  const TOWER_GROW = 1.38;     // 每層戰力增長倍率
  const HUNT_CD_MS = 2000;     // 尋寶手動「探尋」冷卻 2s
  const HUNT_AUTO_SEC = 5;     // 尋寶放置自動開箱間隔 5s
  const HUNT_PAY = 10;         // 尋寶門票（靈玉/次，每日首次免費）
  const SWEEP_PER_DAY = 30;    // 每日免費掃蕩次數
  const SWEEP_PAY = 5;         // 掃蕩加次票價（靈玉/次）
  const SWEEP_RATE = 0.8;      // 掃蕩收益折算係數

  // 塔層材料池按品階分檔（品階隨層數解鎖；id 均取自 DATA_NOTES 權威表；含鍛造礦 ore_jingtie/zijin/xingsha/xingchen/longjin）
  const MAT_TIERS = [
    ['ore_qingtong', 'ore_heite', 'ore_jingtie', 'gem_lingcui', 'beast_huya', 'beast_tuling'],
    ['ore_xuantie', 'ore_wuxingsha', 'gem_biyu', 'gem_zijing', 'beast_shelin', 'beast_xiongdan'],
    ['ore_miyin', 'ore_jingjin', 'ore_zijin', 'ore_xingsha', 'gem_xuepo', 'gem_hanyu', 'beast_yaodan', 'beast_jiaowei'],
    ['ore_hantie', 'ore_chijing', 'ore_mingtie', 'ore_xingchen', 'gem_xinghui', 'gem_yanxin', 'gem_mingzhu',
      'beast_bingjiao_lin', 'beast_yanlang_gu', 'beast_mingdie_yi'],
    ['ore_xingchenjin', 'ore_longwenjin', 'ore_hundunjin', 'ore_longjin', 'gem_guixuyu', 'gem_longmu',
      'beast_kun_yu', 'beast_longlin', 'beast_longgu', 'beast_longjiao'],
  ];
  // 掃蕩煉丹靈草池（按品階分檔，對應塔層解鎖進度）
  const HERB_TIERS = [
    ['herb_qingling', 'herb_ningxue', 'herb_ningshen', 'herb_ziye'],
    ['herb_juling', 'herb_yuehua', 'herb_chiyang', 'herb_bingxin'],
    ['herb_xuanbing', 'herb_huolingzhi', 'herb_digen', 'herb_jinxian'],
    ['herb_longxu', 'herb_fengwei', 'herb_yusui', 'herb_youming', 'herb_hunyuancao'],
    ['herb_tianxing', 'herb_dihuo', 'herb_hansui', 'herb_leiming', 'herb_xueling', 'herb_taiyin', 'herb_taiyang'],
  ];

  /* ==================== 內部小工具 ==================== */
  function U() { return XG.util; }
  // 副本狀態子樹（自恢復缺省字段）
  function D() {
    const st = XG.state;
    st.dungeon = st.dungeon || {};
    const d = st.dungeon;
    if (typeof d.tower !== 'number' || d.tower < 1) d.tower = 1;
    if (typeof d.towerBest !== 'number' || d.towerBest < 1) d.towerBest = 1;
    if (typeof d.guard !== 'number' || d.guard < 0) d.guard = 0;
    if (typeof d.hunt !== 'number' || d.hunt < 0) d.hunt = 0;
    if (typeof d.sweepFree !== 'number') d.sweepFree = SWEEP_PER_DAY;
    if (typeof d.sweepDay !== 'string') d.sweepDay = '';
    if (typeof d.week !== 'string') d.week = '';
    if (!Array.isArray(d.affixes)) d.affixes = [];
    if (d.huntRun === undefined) d.huntRun = null;
    return d;
  }
  // 跨系統統計（懶初始化）
  function stats() { return (XG.state.stats = XG.state.stats || {}); }
  function incStat(k, n) { const s = stats(); s[k] = (s[k] || 0) + (n || 1); }
  function maxStat(k, v) { const s = stats(); if ((s[k] || 0) < v) s[k] = v; }
  // 傳聞推送：bus 廣播 + 自存 state.news（新→舊，NEWS_CAP 截斷）
  function pushNews(cat, text, imp) {
    const news = { t: Date.now(), cat: cat, text: text, imp: imp || 0 };
    const arr = (XG.state.news = XG.state.news || []);
    arr.unshift(news);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (arr.length > cap) arr.length = cap;
    XG.bus.emit('news', news);
  }
  // 本地日期串（與 main.js dayKey 同格式，跨天重置用）
  function dayKey() {
    const d = new Date();
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  }
  function dun() { return XG.data.world.dungeons; }
  function playerPower() { return XG.stats.get().power || 0; }

  /* ==================== 周詞綴 ==================== */
  // 確保本週詞綴已抽取：mulberry32(weekId) 從 affixPool 不放回抽 3 條
  function ensureWeek() {
    const d = D();
    const wk = U().weekId();
    if (d.week === wk && d.affixes.length === 3) return;
    const pool = (dun().tower.affixPool || []).slice();
    const rnd = U().mulberry32(wk);
    // 用可復現 rnd 做 Fisher-Yates，取前 3 條
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    d.week = wk;
    d.affixes = pool.slice(0, 3).map(function (a) { return a.id; });
  }
  function affixList() {
    ensureWeek();
    const pool = dun().tower.affixPool || [];
    return D().affixes.map(function (id) {
      for (const a of pool) if (a.id === id) return a;
      return null;
    }).filter(Boolean);
  }
  // 聚合詞綴效果：foe*Pct 彙總為敵方戰力乘區；rw*Pct 供獎勵加成查詢
  function affixEff() {
    const eff = {};
    for (const a of affixList()) {
      for (const k in a.eff) eff[k] = (eff[k] || 0) + a.eff[k];
    }
    return eff;
  }
  // 敵方戰力乘區：按戰力公式權重（攻2 防1.5 血0.2 速10，權和 13.7）折算等效百分比
  function foeMul() {
    const e = affixEff();
    const w = (e.foeAtkPct || 0) * 2 + (e.foeDefPct || 0) * 1.5 +
      (e.foeHpPct || 0) * 0.2 + (e.foeSpdPct || 0) * 10;
    return 1 + w / 13.7 / 100;
  }
  function rwPct(key) { return affixEff()[key] || 0; }

  /* ==================== 爬塔：需求與勝率 ==================== */
  // 第 N 層戰力需求（含周詞綴；隱藏 BOSS 層另乘 powerMul）
  function layerNeed(n) {
    let need = TOWER_BASE * Math.pow(TOWER_GROW, n) * foeMul();
    if (isBossLayer(n)) need *= (dun().tower.hiddenBoss.powerMul || 2.5);
    return Math.round(need);
  }
  function isBossLayer(n) { return n > 0 && n % (dun().tower.hiddenBossEvery || 33) === 0; }
  // 隱藏 BOSS 輪次（第 r 輪 = 第 33r 層）
  function bossRound(n) { return Math.floor(n / (dun().tower.hiddenBossEvery || 33)); }
  function bossOf(n) {
    if (!isBossLayer(n)) return null;
    const bosses = dun().tower.hiddenBoss.bosses || [];
    if (!bosses.length) return null;
    return bosses[(bossRound(n) - 1) % bosses.length];
  }
  // 勝率估算：r=玩家戰力/需求，p = r³/(r³+1)，夾取 [0.03, 0.97]（勢均力敵五五開，碾壓約九成）
  function winRate(power, need) {
    if (need <= 0) return 0.97;
    const r = power / need;
    const p = (r * r * r) / (r * r * r + 1);
    return U().clamp(p, 0.03, 0.97);
  }

  /* ==================== 掉落物通用發放 ==================== */
  // 按品階隨機取一個功法 id（優先非隱藏；無精確品階時向最近品階收斂）
  function pickGongfaByGrade(g) {
    const list = (XG.data.gongfa && XG.data.gongfa.list) || [];
    const open = list.filter(function (x) { return !x.hidden; });
    for (let dg = 0; dg <= 9; dg++) {
      const cand = [g - dg, g + dg];
      for (const gg of cand) {
        const hit = open.filter(function (x) { return x.grade === gg; });
        if (hit.length) return U().pick(hit).id;
      }
    }
    return null;
  }
  // 按品階隨機取一個丹方 id（同上收斂）
  function pickPillByGrade(g) {
    const list = (XG.data.pills && XG.data.pills.recipes) || [];
    const open = list.filter(function (x) { return !x.hidden; });
    for (let dg = 0; dg <= 9; dg++) {
      const cand = [g - dg, g + dg];
      for (const gg of cand) {
        const hit = open.filter(function (x) { return x.grade === gg; });
        if (hit.length) return U().pick(hit).id;
      }
    }
    return null;
  }
  // 按品階隨機取一個裝備底材（allowHidden 時含歸墟/龍淵隱藏神裝）
  function pickEquipBase(grade, allowHidden) {
    const bases = (XG.data.equips && XG.data.equips.bases) || [];
    for (let dg = 0; dg <= 4; dg++) {
      const gg = grade - dg;
      if (gg < 0) break;
      const hit = bases.filter(function (b) { return b.grade === gg && (allowHidden || !b.hidden); });
      if (hit.length) return U().pick(hit);
    }
    return null;
  }
  // 發裝備：優先鍛造系統 createEquip(baseId, grade)；不存在則降級發同階礦石×2
  function giveEquip(grade, allowHidden, matSink) {
    const base = pickEquipBase(grade, allowHidden);
    if (!base) return null;
    const forge = XG.sys.forge;
    if (forge && typeof forge.createEquip === 'function') {
      try {
        const eq = forge.createEquip(base.id, base.grade);
        if (eq) return { name: eq.name || base.name, icon: eq.icon || base.icon, grade: base.grade };
      } catch (e) { console.error('[dungeon] forge.createEquip 出錯', e); }
    }
    // 降級：改發材料（高階礦石 2 件），不報錯
    const tier = U().clamp(base.grade, 0, MAT_TIERS.length - 1);
    const orePool = MAT_TIERS[tier].filter(function (id) { return id.indexOf('ore_') === 0; });
    const mid = orePool.length ? U().pick(orePool) : U().pick(MAT_TIERS[tier]);
    XG.addRes({ mat: (function () { const o = {}; o[mid] = 2; return o; })() });
    if (matSink) matSink[mid] = (matSink[mid] || 0) + 2;
    return null;
  }
  // 發功法殘篇：優先 gongfa.addFrag(gfId, n)；不存在則直接入 inv.frag
  function giveFrag(grade, n) {
    const gfId = pickGongfaByGrade(grade);
    if (!gfId) return null;
    const gf = XG.sys.gongfa;
    if (gf && typeof gf.addFrag === 'function') {
      try { gf.addFrag(gfId, n); return { id: gfId, n: n }; } catch (e) { console.error('[dungeon] gongfa.addFrag 出錯', e); }
    }
    XG.addRes({ frag: (function () { const o = {}; o[gfId] = n; return o; })() });
    return { id: gfId, n: n };
  }
  // 發修為：優先 cultivation.addCult(n, 來源)；不存在則直接累加
  function giveCult(n, src) {
    n = Math.floor(n);
    if (n <= 0) return 0;
    const cv = XG.sys.cultivation;
    if (cv && typeof cv.addCult === 'function') {
      try { cv.addCult(n, src); return n; } catch (e) { console.error('[dungeon] cultivation.addCult 出錯', e); }
    }
    XG.state.player.cult = (XG.state.player.cult || 0) + n;
    XG.bus.emit('res:changed');
    return n;
  }
  // 解析數值或 [min,max] 區間
  function rollNum(v) {
    if (Array.isArray(v)) return U().randInt(v[0], v[1]);
    return v || 0;
  }
  // 通用戰利品結算（守關檔獎勵 / 尋寶寶箱共用）：
  // loot 支持 { lingShi:n|[min,max], lingYu, mat:{id:[min,max,w]}, pill:{gG:[min,max,w]},
  //             frag:{gG:[min,max,w]}, egg, eggChance }；全部立即入賬並返回所得彙總
  function grantLoot(loot) {
    const got = { lingShi: 0, lingYu: 0, mat: {}, pill: {}, frag: {}, egg: 0 };
    if (!loot) return got;
    if (loot.lingShi) got.lingShi = XG.balance.activityStone(rollNum(loot.lingShi));
    if (loot.lingYu) got.lingYu = XG.balance.activityJade(rollNum(loot.lingYu));
    if (loot.lingShi || loot.lingYu) XG.addRes({ lingShi: got.lingShi, lingYu: got.lingYu });
    // 材料表：按條目權重（第 3 元素 w）抽一種，數量在 [min,max] 內隨機
    if (loot.mat) {
      const entries = [];
      for (const id in loot.mat) {
        const v = loot.mat[id];
        entries.push({ id: id, min: v[0], max: v[1], w: v[2] || 1 });
      }
      if (entries.length) {
        const e = U().weighted(entries, 'w');
        const n = U().randInt(e.min, e.max);
        got.mat[e.id] = n;
        XG.addRes({ mat: got.mat });
      }
    }
    // 丹藥表：鍵為 'g'+品階，每鍵獨立發放 randInt(min,max) 顆該品階隨機成品丹
    if (loot.pill) {
      for (const k in loot.pill) {
        const m = /^g(\d+)$/.exec(k);
        if (!m) continue;
        const n = rollNum([loot.pill[k][0], loot.pill[k][1]]);
        for (let i = 0; i < n; i++) {
          const pid = pickPillByGrade(+m[1]);
          if (pid) got.pill[pid] = (got.pill[pid] || 0) + 1;
        }
      }
      if (Object.keys(got.pill).length) XG.addRes({ pill: got.pill });
    }
    // 殘篇表：鍵為 'g'+品階
    if (loot.frag) {
      for (const k in loot.frag) {
        const m = /^g(\d+)$/.exec(k);
        if (!m) continue;
        const n = rollNum([loot.frag[k][0], loot.frag[k][1]]);
        if (n > 0) {
          const f = giveFrag(+m[1], n);
          if (f) got.frag[f.id] = (got.frag[f.id] || 0) + f.n;
        }
      }
    }
    if (loot.egg) { got.egg += loot.egg; XG.addRes({ egg: loot.egg }); }
    if (loot.eggChance && U().chance(loot.eggChance)) { got.egg += 1; XG.addRes({ egg: 1 }); }
    return got;
  }
  // 塔層材料掉落：1~3 種，每種 [1, 2+⌊N/15⌋] 件，品階檔 ≤ ⌊N/25⌋（高檔權重略高）
  function rollTowerMats(n) {
    const maxTier = U().clamp(Math.floor(n / 25), 0, MAT_TIERS.length - 1);
    const kinds = U().randInt(1, 3);
    const per = [1, 2 + Math.floor(n / 15)];
    const out = {};
    const tierPool = [];
    for (let t = 0; t <= maxTier; t++) tierPool.push({ t: t, w: t + 1 });
    for (let i = 0; i < kinds; i++) {
      const tier = U().weighted(tierPool, 'w').t;
      const id = U().pick(MAT_TIERS[tier]);
      out[id] = (out[id] || 0) + U().randInt(per[0], per[1]);
    }
    return out;
  }

  /* ==================== 爬塔 ==================== */
  function towerInfo() {
    const d = D();
    const n = d.tower;
    const need = layerNeed(n);
    const power = playerPower();
    const p = XG.state.player;
    const isFeisheng = p.realmIdx >= 9;
    const penalty = isFeisheng ? 0 : Math.floor(0.1 * XG.cfg.layerCost(p.realmIdx, p.layer));
    return {
      unlocked: XG.cfg.isUnlocked('dungeon_tower'),
      layer: n,
      best: d.towerBest,
      need: need,
      power: power,
      winP: winRate(power, need),
      penalty: penalty,
      penaltyOk: isFeisheng || (p.cult || 0) >= penalty,
      hiddenBoss: isBossLayer(n),
      boss: bossOf(n),
      affixes: affixList().map(function (a) { return { id: a.id, name: a.name, desc: a.desc, eff: a.eff }; }),
      week: d.week,
      feisheng: isFeisheng,
    };
  }

  // 挑戰當前層：勝利 layer+1 發掉落；失敗扣當前等級修為 10%（不足則不可挑戰；飛昇境無限挑戰）
  function challengeTower() {
    if (!XG.cfg.isUnlocked('dungeon_tower')) return { ok: false, err: '鎮妖塔尚未開啓（金丹一層）' };
    const d = D();
    const n = d.tower;
    const boss = isBossLayer(n);
    const need = layerNeed(n);
    const power = playerPower();
    const wp = winRate(power, need);
    // 失敗懲罰校驗：飛昇境無損耗；否則扣當前等級所需修為的 10%
    const p = XG.state.player;
    const isFeisheng = p.realmIdx >= 9;
    const penalty = isFeisheng ? 0 : Math.floor(0.1 * XG.cfg.layerCost(p.realmIdx, p.layer));
    if (!isFeisheng && (p.cult || 0) < penalty) {
      return { ok: false, err: '修為不足' + XG.util.fmt(penalty) + '，無法挑戰鎮妖塔' };
    }
    const baseRet = { ok: true, win: false, winP: wp, power: power, need: need, layer: n, hiddenBoss: boss, boss: bossOf(n), rewards: null, penalty: penalty, feisheng: isFeisheng };
    if (!U().chance(wp)) {
      // 失敗：扣修為（飛昇境不扣）
      if (penalty > 0) {
        const cu = XG.sys.cultivation;
        if (cu && typeof cu.addCult === 'function') {
          try { cu.addCult(-penalty, '鎮妖塔挑戰失敗'); } catch (e) { p.cult = Math.max(0, (p.cult || 0) - penalty); }
        } else {
          p.cult = Math.max(0, (p.cult || 0) - penalty);
        }
        XG.bus.emit('res:changed');
      }
      return baseRet;
    }

    // —— 通關獎勵：靈石/修為（標準收益）+ 隨機掉落（裝備/材料/殘篇/蛋，受周詞綴 rw*Pct 加成）——
    const rw = {
      lingShi: Math.floor(100 * Math.pow(n, 1.5) * (1 + rwPct('rwLingShiPct') / 100)),
      cult: 0, mat: {}, equip: null, frag: null, egg: 0, lingYu: 0,
    };
    const cultSec = 60 + 12 * n;
    rw.cult = Math.floor((XG.stats.get().cultRate || XG.cfg.REALMS[XG.state.player.realmIdx].rate) *
      cultSec * (1 + rwPct('rwCultPct') / 100));
    rw.lingShi=XG.balance.activityStone(rw.lingShi);
    XG.addRes({ lingShi: rw.lingShi });
    rw.cult=XG.balance.activityCult(rw.cult);
    giveCult(rw.cult, '鎮妖塔第' + n + '層');
    // 材料（先於裝備 roll：降級發材料會併入 rw.mat，避免被覆蓋）
    rw.mat = rollTowerMats(n);
    if (Object.keys(rw.mat).length) XG.addRes({ mat: rw.mat });
    // 裝備：掉率 min(12%+0.4%×N, 55%)，每 10 層保底；grade = min(1+⌊N/20⌋, 3)（非隱藏底材上限）
    let dropP = Math.min(0.12 + n * 0.004, 0.55) * (1 + rwPct('rwDropPct') / 100);
    if (n % 10 === 0) dropP = 1;
    if (U().chance(dropP)) {
      const g = U().clamp(1 + Math.floor(n / 20), 1, 3);
      rw.equip = giveEquip(g, false, rw.mat);
    }
    // 殘篇：8% 基礎，品階 min(1+⌊N/15⌋, 9)
    if (U().chance(0.08 * (1 + rwPct('rwFragPct') / 100))) {
      rw.frag = giveFrag(U().clamp(1 + Math.floor(n / 15), 1, 9), 1);
    }
    // 靈寵蛋：1.5% 基礎
    if (U().chance(0.015 * (1 + rwPct('rwEggPct') / 100))) { rw.egg = 1; XG.addRes({ egg: 1 }); }

    // —— 隱藏 BOSS 追加厚賞：靈玉 + 必掉高 grade 裝備 + 高階殘篇×2 + 寶石箱 ——
    if (boss) {
      const round = bossRound(n);
      rw.lingYu = XG.balance.activityJade(20 + 5 * round);
      XG.addRes({ lingYu: rw.lingYu });
      // 必掉裝備 grade = min(2+輪次, 4)；grade≥4 時解鎖歸墟/龍淵隱藏神裝（第 2 輪起）
      const bg = U().clamp(2 + round, 1, 4);
      rw.equip = giveEquip(bg, bg >= 4, rw.mat) || rw.equip;
      rw.frag = giveFrag(U().clamp(3 + round, 1, 9), 2) || rw.frag;
      // 寶石箱：gem_* 隨機 2~4 件，品階 ≤ min(1+輪次, 4)（獨立記賬後合併展示，避免重複入賬）
      const gemTier = U().clamp(1 + round, 1, MAT_TIERS.length - 1);
      const gemPool = [];
      for (let t = 0; t <= gemTier; t++) {
        for (const id of MAT_TIERS[t]) if (id.indexOf('gem_') === 0) gemPool.push(id);
      }
      const gemMat = {};
      const gemN = U().randInt(2, 4);
      for (let i = 0; i < gemN; i++) {
        const id = U().pick(gemPool);
        gemMat[id] = (gemMat[id] || 0) + 1;
      }
      XG.addRes({ mat: gemMat });
      for (const id in gemMat) rw.mat[id] = (rw.mat[id] || 0) + gemMat[id];
      const b = bossOf(n);
      incStat('tower_hidden_boss', 1);
      pushNews('world', '鎮妖塔第' + n + '層魔氣沖天——' + (b ? b.name : '無名魔尊') +
        '被人一劍斬落！傳聞其懷中之物已易主。', 2);
    }

    // 進度推進與統計
    d.tower = n + 1;
    if (d.tower > d.towerBest) d.towerBest = d.tower;
    maxStat('tower_layer', d.towerBest);
    incStat('tower_clear', 1);
    XG.bus.emit('tower:clear', { layer: n, hiddenBoss: boss });
    // 隱藏彩蛋：首次登臨百層，全服傳聞
    if (d.towerBest >= 100 && !d.cent100) {
      d.cent100 = 1;
      pushNews('world', '有絕世高人登臨鎮妖塔百層之巔！塔身轟鳴三日，萬妖伏首，天降異象。', 2);
    }
    XG.bus.emit('save:dirty');

    baseRet.win = true;
    baseRet.rewards = rw;
    return baseRet;
  }

  /* ==================== 守關 ==================== */
  function guardWaves() { return dun().guard.waves || []; }
  function guardInfo() {
    const d = D();
    const waves = guardWaves();
    const cleared = d.guard;
    const done = cleared >= waves.length;
    const wave = waves[Math.min(cleared, waves.length - 1)];
    const power = playerPower();
    return {
      unlocked: XG.cfg.isUnlocked('dungeon_guard'),
      cleared: cleared,
      total: waves.length,
      done: done,
      replay: done, // 全通後挑戰=復刷末檔（1/3 靈石）
      next: wave ? { n: wave.n, name: wave.name, icon: wave.icon, power: wave.power, desc: wave.desc, reward: wave.reward } : null,
      power: power,
      winP: wave ? winRate(power, wave.power) : 0,
    };
  }

  function challengeGuard() {
    if (!XG.cfg.isUnlocked('dungeon_guard')) return { ok: false, err: '守關尚未開啓（化神一層）' };
    const d = D();
    const waves = guardWaves();
    if (!waves.length) return { ok: false, err: '關隘數據缺失' };
    const cleared = d.guard;
    const replay = cleared >= waves.length;
    const wave = waves[Math.min(cleared, waves.length - 1)];
    const power = playerPower();
    const wp = winRate(power, wave.power);
    const ret = {
      ok: true, win: false, winP: wp, replay: replay,
      wave: { n: wave.n, name: wave.name, icon: wave.icon }, rewards: null,
    };
    if (!U().chance(wp)) return ret; // 敗走，不計進度亦無損失

    if (replay) {
      // 復刷：僅 1/3 靈石
      const ls = XG.balance.activityStone(Math.floor(rollNum(wave.reward.lingShi) / 3));
      XG.addRes({ lingShi: ls });
      ret.rewards = { lingShi: ls, lingYu: 0, mat: {}, pill: {}, frag: {}, egg: 0 };
    } else {
      ret.rewards = grantLoot(wave.reward);
      d.guard = cleared + 1;
      maxStat('guard_wave', d.guard);
      if (wave.n === 5 || wave.n === 10 || wave.n === 15) {
        pushNews('world', '邊關告急！有修士力挽狂瀾，守得「' + wave.name + '」一關，滿城歡呼。', 1);
      }
    }
    XG.bus.emit('save:dirty');
    ret.win = true;
    return ret;
  }

  /* ==================== 限時尋寶 ==================== */
  function huntCfg() { return dun().hunt; }
  // 今日免費次數（daily.hunt，main.js 每日重置整個 daily 對象；每日前 10 次免費）
  function huntFreeLeft() {
    const daily = (XG.state.daily = XG.state.daily || { day: '', discuss: {}, help: {}, gift: 0 });
    return Math.max(0, 10 - (daily.hunt || 0));
  }
  function huntInfo() {
    const d = D();
    const run = d.huntRun;
    const now = Date.now();
    return {
      unlocked: XG.cfg.isUnlocked('dungeon_hunt'),
      active: !!run,
      left: run ? Math.max(0, Math.ceil((run.endAt - now) / 1000)) : 0,
      boxes: run ? run.boxes : 0,
      cdLeft: run ? Math.max(0, Math.ceil((run.cdUntil - now) / 1000)) : 0,
      freeLeft: huntFreeLeft(),
      payCost: HUNT_PAY,
      dur: huntCfg().dur || 300,
    };
  }

  // 進入遺府：耗門票（每日前 10 次免費，其後靈玉 10/次），開啓 300s 場次
  function enterHunt() {
    if (!XG.cfg.isUnlocked('dungeon_hunt')) return { ok: false, err: '遺府尚未顯世（煉虛一層）' };
    const d = D();
    if (d.huntRun) return { ok: false, err: '已身處在遺府之中' };
    const daily = XG.state.daily;
    let free = false;
    if ((daily.hunt || 0) < 10) {
      daily.hunt = (daily.hunt || 0) + 1;
      free = true;
    } else {
      if (!XG.hasRes({ lingYu: HUNT_PAY })) return { ok: false, err: '靈玉不足（門票 ' + HUNT_PAY + ' 靈玉）' };
      XG.addRes({ lingYu: -HUNT_PAY });
    }
    d.hunt++;
    d.huntRun = { endAt: Date.now() + (huntCfg().dur || 300) * 1000, boxes: 0, cdUntil: 0, autoAcc: 0, bestBox: null };
    incStat('hunt_enter', 1);
    XG.bus.emit('save:dirty');
    return { ok: true, free: free };
  }

  // 開一隻寶箱：按 pools 權重抽箱品，結算戰利品
  function rollBox() {
    const d = D();
    const run = d.huntRun;
    if (!run) return null;
    const pools = huntCfg().pools || [];
    if (!pools.length) return null;
    const pool = U().weighted(pools, 'w');
    const gains = grantLoot(pool.loot);
    run.boxes++;
    incStat('hunt_box', 1);
    // 記錄最珍稀箱品（權重最小者）
    if (!run.bestBox || pool.w < run.bestBox.w) run.bestBox = { name: pool.name, w: pool.w };
    XG.bus.emit('save:dirty');
    return { pool: pool, gains: gains };
  }

  // 手動「探尋」：CD 2s
  function seek() {
    const d = D();
    const run = d.huntRun;
    if (!run) return { ok: false, err: '未在尋寶場次中' };
    const now = Date.now();
    if (now < run.cdUntil) return { ok: false, err: '探尋中……稍安勿躁', cdLeft: Math.ceil((run.cdUntil - now) / 1000) };
    if (now >= run.endAt) { endHuntInner(); return { ok: false, err: '遺府已關閉' }; }
    run.cdUntil = now + HUNT_CD_MS;
    const r = rollBox();
    if (!r) return { ok: false, err: '一無所獲' };
    return { ok: true, box: { id: r.pool.id, name: r.pool.name, icon: r.pool.icon }, gains: r.gains };
  }

  // 結算離場（內部）：發傳聞、清場次
  function endHuntInner() {
    const d = D();
    const run = d.huntRun;
    if (!run) return 0;
    d.huntRun = null;
    if (run.boxes > 0) {
      pushNews('player', '上古遺府一行，共啓 ' + run.boxes + ' 只寶匣' +
        (run.bestBox ? '，其中最珍稀者乃「' + run.bestBox.name + '」' : '') + '，滿載而歸。', 1);
    }
    XG.bus.emit('save:dirty');
    return run.boxes;
  }
  function endHunt() {
    const d = D();
    if (!d.huntRun) return { ok: false, err: '未在尋寶場次中' };
    return { ok: true, boxes: endHuntInner() };
  }

  /* ==================== 掃蕩 ==================== */
  // 跨天重置免費次數
  function ensureSweepDay() {
    const d = D();
    const dk = dayKey();
    if (d.sweepDay !== dk) { d.sweepDay = dk; d.sweepFree = SWEEP_PER_DAY; }
  }
  // 單層標準收益（掃蕩口徑：靈石 + 修為，不含隨機掉落）
  function layerStandard(n) {
    return {
      lingShi: Math.floor(100 * Math.pow(n, 1.5) * (1 + rwPct('rwLingShiPct') / 100)),
      cult: Math.floor((XG.stats.get().cultRate || XG.cfg.REALMS[XG.state.player.realmIdx].rate) *
        (60 + 12 * n) * (1 + rwPct('rwCultPct') / 100)),
    };
  }
  function sweepEst() {
    const d = D();
    let ls = 0, cult = 0;
    for (let n = 1; n <= d.towerBest - 1; n++) {
      const s = layerStandard(n);
      ls += s.lingShi; cult += s.cult;
    }
    const bundles = Math.floor((d.towerBest - 1) / 10);
    return { lingShi: Math.floor(ls * SWEEP_RATE), cult: Math.floor(cult * SWEEP_RATE), bundles: bundles };
  }
  function sweepInfo() {
    ensureSweepDay();
    const d = D();
    return {
      freeLeft: d.sweepFree,
      payCost: SWEEP_PAY,
      perDay: SWEEP_PER_DAY,
      best: d.towerBest,
      canSweep: d.towerBest > 1 && (d.sweepFree > 0 || XG.hasRes({ lingYu: SWEEP_PAY })),
      est: Object.assign({},sweepEst(),{lingShi:Math.min(sweepEst().lingShi,XG.balance.activityStoneRemaining()),cult:Math.min(sweepEst().cult,Math.floor(XG.balance.standardRate()*Math.max(0,14400-(XG.balance.daily().activitySec||0))))}),
    };
  }

  // 一鍵掃蕩：直接領取 (towerBest−1) 層標準收益 ×0.8；免費 30 次/日，其後靈玉 5/次
  function quickSweep() {
    ensureSweepDay();
    const d = D();
    if (d.towerBest <= 1) return { ok: false, err: '尚未登頂任何層數，無可掃蕩' };
    let paid = false;
    if (d.sweepFree > 0) {
      d.sweepFree--;
    } else {
      if (!XG.hasRes({ lingYu: SWEEP_PAY })) return { ok: false, err: '今日免費次數已盡，靈玉亦不足（' + SWEEP_PAY + ' 靈玉/次）' };
      XG.addRes({ lingYu: -SWEEP_PAY });
      paid = true;
    }
    const est = sweepEst();
    est.cult=XG.balance.activityCult(est.cult);
    est.lingShi=XG.balance.activityStone(est.lingShi);
    XG.addRes({ lingShi: est.lingShi });
    giveCult(est.cult, '鎮妖塔掃蕩');
    // 掃蕩添頭：每 10 層贈 1 份鍛造材料 + 1 株煉丹靈草 + 1 份功法殘篇
    const mat = {};
    const bundles = est.bundles;
    const maxTier = U().clamp(Math.floor((d.towerBest - 1) / 25), 0, MAT_TIERS.length - 1);
    for (let i = 0; i < bundles; i++) {
      // 鍛造材料
      const one = rollTowerMats(d.towerBest - 1);
      for (const id in one) mat[id] = (mat[id] || 0) + 1;
      // 煉丹靈草
      const herbTier = U().clamp(Math.floor((d.towerBest - 1) / 25), 0, HERB_TIERS.length - 1);
      const herbId = U().pick(HERB_TIERS[herbTier]);
      mat[herbId] = (mat[herbId] || 0) + 1;
      // 功法殘篇（每 10 層 1 份，品階隨層數遞增）
      const fragGrade = U().clamp(1 + Math.floor((d.towerBest - 1) / 30), 1, 9);
      const gfId = pickGongfaByGrade(fragGrade);
      if (gfId) giveFrag(gfId, 1);
    }
    if (Object.keys(mat).length) XG.addRes({ mat: mat });
    incStat('sweep_count', 1);
    XG.bus.emit('save:dirty');
    const msg = [
      '掃蕩鎮妖塔 ' + (d.towerBest - 1) + ' 層（×' + SWEEP_RATE + '）',
      '靈石 +' + U().fmt(est.lingShi) + '，修為 +' + U().fmt(est.cult),
    ];
    if (Object.keys(mat).length) msg.push('獲材料 ' + Object.keys(mat).length + ' 種、殘篇若干');
    if (paid) msg.push('（消耗靈玉 ' + SWEEP_PAY + '）');
    return { ok: true, msg: msg, gains: { lingShi: est.lingShi, cult: est.cult, mat: mat } };
  }

  /* ==================== 模塊協議（契約 §10） ==================== */
  XG.sys.dungeon = {
    id: 'dungeon',

    // 啓動自恢復：補默認字段、對齊周詞綴/跨天掃蕩
    // 注意：遺留尋寶場次不在此結算——init 先於 offline.settle 執行，離線時段的自動寶箱
    // 統一由 offline(dt) 補開（場次到期由 tick 或 offline 收尾），此處保留原樣
    init() {
      D();
      ensureWeek();
      ensureSweepDay();
    },

    // 每秒：尋寶自動開箱（5s/箱）與到期結算；順帶兜底周詞綴/跨天刷新
    tick(dt) {
      const d = D();
      ensureSweepDay();
      if (d.week !== U().weekId()) ensureWeek();
      const run = d.huntRun;
      if (!run) return;
      const now = Date.now();
      if (now >= run.endAt) { endHuntInner(); return; }
      run.autoAcc += dt;
      while (run.autoAcc >= HUNT_AUTO_SEC && run.endAt > now) {
        run.autoAcc -= HUNT_AUTO_SEC;
        rollBox();
      }
    },

    // 離線結算：尋寶場次在離線時段內按自動速率（5s/箱）補開寶箱；場次過期則補發結算傳聞
    offline(dt) {
      const d = D();
      const run = d.huntRun;
      if (!run) return null;
      const now = Date.now();
      const offlineStart = now - dt * 1000;
      const span = Math.min(now, run.endAt) - offlineStart;
      if (span <= 0) return null;
      const boxes = Math.floor(span / (HUNT_AUTO_SEC * 1000));
      if (boxes <= 0) return null;
      let ls = 0, ly = 0, eggs = 0;
      const matSum = {};
      for (let i = 0; i < boxes; i++) {
        const r = rollBox(); // 內部已入賬並累計 stats.hunt_box
        if (!r) break;
        ls += r.gains.lingShi; ly += r.gains.lingYu; eggs += r.gains.egg;
        for (const id in r.gains.mat) matSum[id] = (matSum[id] || 0) + r.gains.mat[id];
      }
      if (now >= run.endAt) endHuntInner();
      return {
        resGain: { lingShi: ls, lingYu: ly },
        events: ['遺府尋寶離線代啓 ' + boxes + ' 只寶匣，得靈石 ' + U().fmt(ls) +
          (ly > 0 ? '、靈玉 ' + ly : '') + (eggs > 0 ? '、靈寵蛋 ' + eggs + ' 枚' : '') + '。'],
      };
    },

    // —— UI 對接面（見文件頭註釋）——
    towerInfo: towerInfo,
    challengeTower: challengeTower,
    guardInfo: guardInfo,
    challengeGuard: challengeGuard,
    huntInfo: huntInfo,
    enterHunt: enterHunt,
    seek: seek,
    endHunt: endHunt,
    sweepInfo: sweepInfo,
    quickSweep: quickSweep,
  };

  XG.sysOrder.push('dungeon');
})();
