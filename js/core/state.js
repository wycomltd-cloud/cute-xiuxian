/* state.js：唯一遊戲狀態對象（契約 §6 默認 state 工廠 + 資源增減工具函數） */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  // 默認狀態工廠：新檔/讀檔合併均以本結構為準（契約 §6 Schema）
  XG.newState = function () {
    const now = Date.now();
    return {
      ver: 1, createdAt: now, lastSeen: now, totalOnlineSec: 0,
      player: {
        name: '摸魚小散仙', gender: null, realmIdx: 0, layer: 1, cult: 0, // cult=當前累積修為(用於突破消耗)
        breakFails: 0, cultivateMode: 'dazuo',            // dazuo打坐|biguan閉關|dunwu頓悟
        spiritRoot: { type: 'jin', grade: 3, mut: null }, // 五行 + 變異(null|bing|lei|feng|an|guang|hundun)
        meridians: { lit: [] },                           // 已點亮穴位 id 列表
        reincarn: 0, identity: null, talents: {}, rp: 0,  // 輪迴: 次數/轉世身份/天賦樹/輪迴點
        toxicity: 0,                                      // 丹毒 0~100
        partner: null,                                    // 道侶 fellow uid
      },
      res: { lingShi: 0, lingYu: 0 },                     // 靈石 / 靈玉
      inv: { mat: {}, pill: {}, frag: {}, egg: 0 },       // 材料/丹藥/功法殘篇/靈寵蛋 {id:count}
      equips: { list: [], slots: { weapon: null, head: null, body: null, boots: null, ring: null, talisman: null } },
      gongfa: { owned: {}, active: [], frag: {}, custom: [] }, // owned:{id:{lv,prof}}, active:已裝備功法id(≤4)
      alchemy: { lv: 1, exp: 0, furnace: 1, fire: null, fires: {}, known: [] }, // known=已習得丹方id
      pets: { list: [], team: [], jobs: {} },             // team≤3 出戰; jobs:{petUid: buildingId|'explore'}
      cave: { lv: { jlz: 1, lt: 0, df: 0, qs: 0, sl: 0, lm: 1 }, layout: {} }, // 建築等級 + 3x3 擺放
      expedition: { active: [], log: [] },                // 進行中派遣 {mapId, petUids, endAt, dur}
      dungeon: { tower: 1, towerBest: 1, guard: 0, hunt: 0, sweepFree: 3, sweepDay: '', week: '', affixes: [] },
      pvp: { pts: 1000, wins: 0, losses: 0, season: '', claimed: '', history: [] },
      fellows: [],                                        // 道友列表（契約 §11）
      news: [],                                           // {t, cat, text, imp} 新→舊, 上限 NEWS_CAP
      ach: {},                                            // {id: {done:1, claimed:1}}
      codex: { gongfa: [], pill: [], pet: [], equip: [], fellow: [] },
      adventure: { done: {}, chains: {}, cd: 0 },         // 奇遇: 已做once事件/連鎖進度/冷卻
      daily: { day: '', discuss: {}, help: {}, gift: 0 }, // 每日: 論道/求助/免費贈禮 記錄
      settings: { newsCollapsed: false, sound: false },
    };
  };

  // 立即建立全局唯一狀態對象（讀檔時由 save.load 整體替換）
  XG.state = XG.newState();

  // 材料/丹藥/殘篇袋增減（內部輔助）：負數即扣除，歸零清鍵保持存檔整潔
  function addBag(bag, obj) {
    for (const id in obj) {
      const nv = Math.max(0, (bag[id] || 0) + obj[id]);
      if (nv <= 0) delete bag[id];
      else bag[id] = nv;
    }
  }

  // 資源統一增減入口（契約 §6）：delta 支持 {lingShi, lingYu, mat:{id:n}, pill:{id:n}, frag:{id:n}, egg}
  // 負數即扣除，自動 clamp 不為負；變動後 emit 'res:changed' + 'save:dirty'
  XG.addRes = function (delta) {
    if (!delta) return;
    const st = XG.state;
    if (delta.lingShi) st.res.lingShi = Math.max(0, (st.res.lingShi || 0) + delta.lingShi);
    if (delta.lingYu) st.res.lingYu = Math.max(0, (st.res.lingYu || 0) + delta.lingYu);
    if (delta.mat) addBag(st.inv.mat, delta.mat);
    if (delta.pill) addBag(st.inv.pill, delta.pill);
    if (delta.frag) addBag(st.inv.frag, delta.frag);
    if (delta.egg) st.inv.egg = Math.max(0, (st.inv.egg || 0) + delta.egg);
    XG.bus.emit('res:changed');
    XG.bus.emit('save:dirty');
  };

  // 資源充足判定：cost 結構同 addRes 的 delta（全部滿足才返回 true）
  XG.hasRes = function (cost) {
    if (!cost) return true;
    const st = XG.state;
    if (cost.lingShi && (st.res.lingShi || 0) < cost.lingShi) return false;
    if (cost.lingYu && (st.res.lingYu || 0) < cost.lingYu) return false;
    const kinds = { mat: st.inv.mat, pill: st.inv.pill, frag: st.inv.frag };
    for (const k in kinds) {
      if (cost[k]) {
        for (const id in cost[k]) {
          if ((kinds[k][id] || 0) < cost[k][id]) return false;
        }
      }
    }
    if (cost.egg && (st.inv.egg || 0) < cost.egg) return false;
    return true;
  };
})();
