/* alchemy.js：煉丹系統（契約 §10；數據源 js/data/pills.js：recipes/furnaces/fires）
 *
 * ===================== 玩法覆蓋 =====================
 * 丹方習得：初始 3 張（聚氣丹/小還丹/清毒散）；升級自動參悟「alchLv 達標且非隱藏」丹方；
 *   外部來源（歷練掉落/奇遇事件/坊市神祕商人/成就獎勵）調 learn(recipeId) / learnRandomRecipe(maxAlchLv)；
 *   隱藏丹方：cond='explode' 炸爐 12% 頓悟、cond='hiddenmap' 歸墟/龍淵派遣 8% 掉落殘方（監聽 expedition:done）。
 * 煉丹師等級：煉製成功得 exp 升級（滿級 9 級），升級自動參悟丹方 + 成功率加成（每級 +2%）。
 * 丹爐：按 furnaces 階梯順序購置（靈石），succ 加成功率 / speed 縮短耗時（耗時 = time × 0.25 / speed）。
 * 異火：fires 收集（fires[id]=1）與切換裝備（fire=null 即凡火）；隱藏異火——
 *   fire_hundun 混沌虛火：累計炸爐 ≥100 次（監聽自身 alch:done）；
 *   fire_liuding 六丁神火：歸墟派遣完成 15%（監聽 expedition:done）；
 *   另內置 fire_ziwu（tower:clear 每 33 層 25%）、fire_qinglian（焚天谷派遣 12%）、
 *   fire_difu（洞府丹房 df≥1 自動引地火，tick 輪詢）；其餘來源由對應系統調 gainFire(id)。
 * 煉製：單爐隊列（state.alchemy.job 持久化，離線可結算）；成功率=基礎(品階)+等級+爐+火+功法 alchSuccPct−丹毒懲罰；
 *   失敗→材料消失（40% 殘留 1 份）；炸爐（失敗中的 25%）→全損 + 12% 悟隱藏丹方 / 60% 得藥灰（一階靈草安慰獎）；
 *   變異（異火 mutPct）→極品丹：eff×1.5、icon 加★、id=recipeId+'_star' 計入 inv.pill。
 * 服用：usePill 按 eff.type 結算（cult→cultivation.addCult；break→存 buff 供突破讀取，同次突破≤3 顆；
 *   heal→emit alch:heal 供戰鬥系統；tox→解毒；root→洗靈根/根骨+1/變異率 buff；atk/def/hp/work→限時 buff；exp→喂出戰靈寵）。
 * 丹毒：服丹 +tox；tox>50 修煉速率 −20%（getMods 負值）；tox>80 禁服丹（解毒丹豁免）；tick 緩慢衰減（1 點/60 秒）；
 *   丹毒達 100 置 stats.tox100=1。
 *
 * ===================== stats 鍵（XG.state.stats，snake） =====================
 * pill_make     累計成丹數（含極品丹）
 * pill_explode  累計炸爐次數（混沌虛火 cond 判據）
 * tox100        丹毒曾達 100 則置 1（隱藏成就 check.k=tox100）
 *
 * ===================== 事件 =====================
 * emit  alch:done {ok, explode, mutated, pillId, grade}（gongfa 隱藏功法 alchemy_explode_10 等訂閱）
 * emit  alch:heal {val, dur, star}（戰鬥系統可選訂閱：回血比例/持續秒數/是否極品）
 * emit  codex:new {kind:'pill', id}（首次習得/首次煉成；collection 訂閱，需自行去重）
 * emit  news（pushNews 同步寫入 state.news）
 * 訂閱  alch:done（自身：混沌虛火計數）/ expedition:done {mapId}（隱藏火種+隱藏殘方）/ tower:clear {layer}（子午天火）
 *
 * ===================== UI 對接面（全部同步返回；{ok:false, msg} 為統一失敗形態） =====================
 * getState()            → {lv, exp, expNeed, tox, toxSlow, toxBan, furnace:{id,name,icon,succ,speed}, fire:{id,name,icon,succ,mutPct},
 *                          knownCount, job: getJobProgress(), breakPillCount}
 * listRecipes()         → [{id,name,icon,grade,hidden,alchLv,known,canCraft,reason,succ,time,cost,eff,tox,desc,getHint,effText}]
 *                          （未習得隱藏丹方僅展示 getHint 線索，cost/eff 不展示——字段照給，UI 自行按 known 遮蔽）
 * listFurnaces()        → [{id,name,icon,succ,speed,cost,desc,owned,current,next}]（next=true 為可購買的下一座）
 * listFires()           → [{id,name,icon,grade,succ,mutPct,hidden,owned,equipped,getHint,desc}]
 * getJobProgress()      → null | {recipeId,name,icon,pct(0~1),remainSec,endAt,dur}
 * succPreview(recipeId) → 成功率百分數（5~97，含全部加成與丹毒懲罰，供開爐前預覽）
 * canCraft(recipeId)    → {ok, reason}
 * startCraft(recipeId)  → {ok, msg}（扣材料+靈石，開爐；隊列佔用中返回 ok:false）
 * cancelCraft()         → {ok, msg}（全額返還材料與靈石）
 * buyFurnace()          → {ok, msg}（購置下一座丹爐，自動扣靈石）
 * setFire(fireId)       → {ok, msg}（'fire_fan' 或已收集異火 id）
 * gainFire(fireId)      → bool（供其他系統發放異火；重複返回 false）
 * saleInfo(pillId)      → {id,name,craftLingShi,price,count}|null；price=煉製靈石×60%向下取整
 * sellPill(pillId)      → {ok,msg,price?}；每次售1顆，普通與極品同價
 * usePill(pillId)       → {ok, msg, eff?}（支持 recipeId 與 recipeId+'_star'；tox>80 拒服非解毒丹；
 *                          break 丹校驗 seg 境界段與同次突破 ≤3 顆）
 * pillInfo(pillId)      → {id,baseId,star,name,icon,grade,desc,effText,tox,usable,reason,count}（揹包展示用）
 * learn(recipeId)       → bool（供坊市/事件/成就發放丹方）
 * learnRandomRecipe(maxAlchLv) → recipe|null（供歷練/事件/成就隨機發方；不含隱藏方）
 * getBreakBuffs()       → [{pillId,name,icon,val,star}]（當前已服破境丹，供突破界面展示）
 * getBreakBuffBonus()   → 數值（破境丹成功率加值合計，小數）
 * consumeBreakBuffs()   → 數值（cultivation 突破時調用：取走加值合計並清空已服破境丹）
 * getRootWashBoost()    → 0.25|0（淬靈丹 buff 存續中返回 0.25，供靈根洗練變異率加成讀取）
 * getBuffs()            → {cult?|atk?|def?|hp?|work?: {val, remainSec}}（限時丹藥 buff 展示）
 * getToxInfo()          → {tox, slow(tox>50), ban(tox>80), decayPerSec}
 *
 * offline(dt)：結算離線期間到期的丹爐（成丹入 pillGain / 炸爐入 events），並按 dt 衰減丹毒。
 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.sys = XG.sys || {};
  XG.sysOrder = XG.sysOrder || [];

  // ===================== 內部常量 =====================
  const MAX_LV = 9;                 // 煉丹師滿級（數據最高 alchLv 8，留 1 級追求）
  const STAR_SUFFIX = '_star';      // 極品丹 id 後綴
  const STAR_MULT = 1.5;            // 極品丹藥效倍率
  const EXPLODE_RATE = 0.25;        // 失敗中的炸爐佔比
  const FAIL_REMAINDER = 0.4;       // 普通失敗殘留 1 份材料的概率
  const EXPLODE_EPIPHANY = 0.12;    // 炸爐頓悟隱藏丹方概率
  const EXPLODE_ASH = 0.6;          // 炸爐得藥灰（安慰獎）概率
  const BREAK_PILL_MAX = 3;         // 同次突破最多疊 3 顆破境丹（契約 cfg.BREAK_PILL_BONUS）
  const CRAFT_TIME_MULT = 0.25;   // 煉丹耗時全局倍率（耗時 = time × 0.25 / 爐速）
  const TOX_DECAY_PER_SEC = 1 / 60;// 丹毒衰減：60 秒 1 點
  const TOX_SLOW = 50;              // 丹毒 >50 修煉 −20%
  const TOX_BAN = 80;               // 丹毒 >80 禁止服丹
  const ASH_HERBS = ['herb_qingling', 'herb_ningxue', 'herb_ningshen', 'herb_ziye']; // 藥灰安慰獎池
  const INITIAL_RECIPES = ['pill_juqi', 'pill_xiaohuan', 'pill_qingdu']; // 初始 3 張丹方
  const ROOT_TYPES = ['jin', 'mu', 'shui', 'huo', 'tu']; // 五行靈根（洗髓丹重 roll 池）

  // 炸爐傳聞文案池
  const EXPLODE_NEWS = [
    '丹房之中轟然一響，爐火沖天，滿室焦煙，一爐靈藥盡成飛灰。',
    '爐火忽作龍吟，丹爐炸裂，藥香盡散，只餘滿地爐灰。',
    '文武火一時不濟，爐中丹藥炸作漫天星點，幸而未傷性命。',
    '爐蓋掀飛三尺，焦煙滾滾而出——這一爐，算是交代了。',
  ];

  // ===================== 內部工具 =====================
  function D() { return XG.data.pills || { recipes: [], furnaces: [], fires: [] }; }
  function A() { return XG.state.alchemy; }

  // 懶初始化跨系統統計（守則 3）
  function statsAdd(k, n) {
    const st = (XG.state.stats = XG.state.stats || {});
    st[k] = (st[k] || 0) + (n == null ? 1 : n);
  }

  // 傳聞推送：寫 state.news（unshift，按 NEWS_CAP 截斷）+ emit 'news'（守則 7）
  function pushNews(cat, text, imp) {
    const st = XG.state;
    st.news = st.news || [];
    const obj = { t: Date.now(), cat: cat || 'player', text: text, imp: imp || 0 };
    st.news.unshift(obj);
    const cap = (XG.cfg && XG.cfg.NEWS_CAP) || 200;
    if (st.news.length > cap) st.news.length = cap;
    XG.bus.emit('news', obj);
  }

  function recipeOf(id) {
    const list = D().recipes;
    for (const r of list) if (r.id === id) return r;
    return null;
  }
  function furnaceOf(id) {
    const list = D().furnaces;
    for (const f of list) if (f.id === id) return f;
    return null;
  }
  function fireOf(id) {
    const list = D().fires;
    for (const f of list) if (f.id === id) return f;
    return null;
  }
  function curFurnace() { return furnaceOf(A().furnace) || D().furnaces[0]; }
  function curFire() {
    const a = A();
    return (a.fire && fireOf(a.fire)) || fireOf('fire_fan') || { id: 'fire_fan', name: '凡火', icon: '🕯️', succ: 0, mutPct: 0 };
  }

  // 發修為（守則 5：防禦性調 cultivation.addCult）
  function addCult(n, src) {
    const c = XG.sys.cultivation;
    if (c && typeof c.addCult === 'function') {
      try { c.addCult(n, src); return; } catch (e) { /* 降級 */ }
    }
    XG.state.player.cult = (XG.state.player.cult || 0) + n;
  }

  // 圖鑑新增（collection 訂閱 codex:new；已登記則跳過）
  function codexNew(id) {
    const cx = XG.state.codex;
    if (cx && Array.isArray(cx.pill) && cx.pill.indexOf(id) >= 0) return;
    XG.bus.emit('codex:new', { kind: 'pill', id: id });
  }

  // ===================== 丹毒 =====================
  function addTox(n) {
    const p = XG.state.player;
    const before = p.toxicity || 0;
    p.toxicity = XG.util.clamp(before + n, 0, 100);
    if (p.toxicity >= 100 && !(XG.state.stats && XG.state.stats.tox100)) {
      statsAdd('tox100', 1);
      pushNews('player', '丹毒攻心，百脈俱灼！丹毒已積至頂峯，速覓解毒之方，否則道基堪憂。', 1);
    }
    checkToxBand(before, p.toxicity);
  }

  // 丹毒跨越 50 閾值時刷新屬性緩存（getMods 的 −20% 修煉懲罰隨閾值變化）
  function checkToxBand(before, after) {
    if ((before > TOX_SLOW) !== (after > TOX_SLOW) && XG.stats) XG.stats.invalidate();
  }

  // ===================== 丹方習得 =====================
  // 學習指定丹方；silent=true 不發傳聞（初始/補檔用）。返回 bool。
  function learn(recipeId, silent) {
    const a = A();
    const r = recipeOf(recipeId);
    if (!r || a.known.indexOf(recipeId) >= 0) return false;
    a.known.push(recipeId);
    codexNew(recipeId);
    if (!silent) {
      pushNews('player', '參悟丹方「' + r.name + '」——' + (r.hidden ? '隱世古方，得之大幸！' : '丹道又進一步。'), r.hidden ? 2 : 0);
    }
    XG.bus.emit('save:dirty');
    return true;
  }

  // 隨機習得一張「非隱藏、alchLv≤maxAlchLv、未習得」的丹方（歷練/事件/坊市/成就通用入口）
  function learnRandomRecipe(maxAlchLv) {
    const a = A();
    const cap = typeof maxAlchLv === 'number' ? maxAlchLv : a.lv;
    const pool = D().recipes.filter(function (r) {
      return !r.hidden && r.alchLv <= cap && a.known.indexOf(r.id) < 0;
    });
    if (!pool.length) return null;
    const r = XG.util.pick(pool);
    learn(r.id);
    return r;
  }

  // 等級提升時自動參悟「alchLv 達標且非隱藏」的全部丹方；返回新參悟的丹方數組
  function autoLearn(silent) {
    const a = A();
    const out = [];
    D().recipes.forEach(function (r) {
      if (!r.hidden && r.alchLv <= a.lv && a.known.indexOf(r.id) < 0) {
        learn(r.id, silent);
        out.push(r);
      }
    });
    return out;
  }

  // ===================== 煉丹師等級 =====================
  function expNeed(lv) { return 30 * lv + 15 * lv * lv; }

  function gainExp(n) {
    const a = A();
    if (a.lv >= MAX_LV) return;
    a.exp += n;
    while (a.lv < MAX_LV && a.exp >= expNeed(a.lv)) {
      a.exp -= expNeed(a.lv);
      a.lv += 1;
      const news2 = autoLearn(true);
      pushNews(
        'player',
        '丹道精進，煉丹師晉至' + a.lv + '階！' + (news2.length ? '頓悟丹方：' + news2.map(function (r) { return '「' + r.name + '」'; }).join('、') : '成功率更進一分。'),
        1
      );
    }
  }

  // ===================== 成功率 =====================
  // 基礎成功率按品階：一階 89%，每階 −6%
  function baseSucc(grade) { return 95 - grade * 6; }

  // 丹毒懲罰：>80 扣 15，>50 扣 8
  function toxSuccPenalty() {
    const tox = XG.state.player.toxicity || 0;
    if (tox > TOX_BAN) return 15;
    if (tox > TOX_SLOW) return 8;
    return 0;
  }

  // 成功率百分數（5~97）：基礎 + 等級(每級+2) + 爐 + 火 + 功法 alchSuccPct − 丹毒懲罰
  function succRate(r) {
    const a = A();
    let gongfaBonus = 0;
    if (XG.stats) {
      try { gongfaBonus = XG.stats.get().alchSuccPct || 0; } catch (e) { gongfaBonus = 0; }
    }
    const v =
      baseSucc(r.grade) +
      (a.lv - 1) * 2 +
      (curFurnace().succ || 0) +
      (curFire().succ || 0) +
      gongfaBonus -
      toxSuccPenalty();
    return XG.util.clamp(v, 5, 97);
  }

  // 連爐：丹成後按記憶丹方自動再開（僅在線；材料不足/丹爐不可用則中止並傳聞）
  function runAuto() {
    const a = A();
    if (!a.auto || a.job) return;
    const r = startCraft(a.auto);
    if (!r.ok) {
      const def = recipeOf(a.auto);
      a.auto = null;
      pushNews('player', '連爐中止：' + r.msg + (def ? '（' + def.name + '）' : ''), 0);
      XG.bus.emit('save:dirty');
    }
  }

  // ===================== 煉製 =====================
  function canCraft(recipeId) {
    const a = A();
    const r = recipeOf(recipeId);
    if (!r) return { ok: false, reason: '丹方不存在' };
    if (a.known.indexOf(recipeId) < 0) return { ok: false, reason: '尚未習得此丹方' };
    if (a.lv < r.alchLv) return { ok: false, reason: '煉丹師等級不足（需' + r.alchLv + '階）' };
    if (a.job) return { ok: false, reason: '丹爐正忙，候此爐丹成' };
    if (!XG.hasRes(r.cost)) return { ok: false, reason: '藥材或靈石不足（靈草產自洞府·靈田、歷練山澤與坊市）' };
    return { ok: true, reason: '' };
  }

  function startCraft(recipeId) {
    const chk = canCraft(recipeId);
    if (!chk.ok) return { ok: false, msg: chk.reason };
    const a = A();
    const r = recipeOf(recipeId);
    XG.addRes({ lingShi: -(r.cost.lingShi || 0), mat: negate(r.cost.mat) });
    const dur = Math.max(2, r.time * CRAFT_TIME_MULT / (curFurnace().speed || 1)); // 耗時 = time × 全局倍率 / 爐速
    const now = Date.now();
    a.job = { recipeId: recipeId, startAt: now, endAt: now + dur * 1000, dur: dur };
    XG.bus.emit('save:dirty');
    return { ok: true, msg: '開爐煉製「' + r.name + '」，約需' + XG.util.fmtTime(dur) + '。' };
  }

  function cancelCraft() {
    const a = A();
    if (!a.job) return { ok: false, msg: '丹爐空閒，無可取消' };
    const r = recipeOf(a.job.recipeId);
    a.job = null;
    if (r) XG.addRes({ lingShi: r.cost.lingShi || 0, mat: r.cost.mat });
    return { ok: true, msg: '熄火收爐，藥材靈石如數奉還。' };
  }

  function negate(mat) {
    const o = {};
    if (mat) for (const id in mat) o[id] = -mat[id];
    return o;
  }

  // 丹成結算（成功/失敗/炸爐/變異）；返回 alch:done 載荷
  function settleJob() {
    const a = A();
    const job = a.job;
    if (!job) return null;
    a.job = null;
    const r = recipeOf(job.recipeId);
    if (!r) return null;

    const ok = XG.util.chance(succRate(r) / 100);
    let explode = false;
    let mutated = false;
    let pillId = null;

    if (ok) {
      // —— 成丹：異火變異 → 極品丹（eff×1.5，id 加 _star） ——
      pillId = r.id;
      const mutPct = curFire().mutPct || 0;
      if (mutPct > 0 && XG.util.chance(mutPct / 100)) {
        mutated = true;
        pillId = r.id + STAR_SUFFIX;
      }
      XG.addRes({ pill: pillPair(pillId, 1) });
      statsAdd('pill_make', 1);
      gainExp(4 + r.grade * 4);
      codexNew(r.id);
      if (mutated) {
        pushNews('player', '爐火忽轉異彩，丹成極品「' + r.name + '·極品」！藥力更勝常品五成。', 1);
      }
    } else {
      explode = XG.util.chance(EXPLODE_RATE);
      if (explode) {
        // —— 炸爐：材料全損 + 頓悟/藥灰 ——
        statsAdd('pill_explode', 1);
        pushNews('player', XG.util.pick(EXPLODE_NEWS), 0);
        const epiphanyPool = D().recipes.filter(function (x) {
          return x.hidden && x.cond === 'explode' && a.known.indexOf(x.id) < 0;
        });
        if (epiphanyPool.length && XG.util.chance(EXPLODE_EPIPHANY)) {
          const got = XG.util.pick(epiphanyPool);
          learn(got.id, true);
          codexNew(got.id);
          pushNews('player', '炸爐之際靈光乍現，焦煙之中竟悟得隱世丹方「' + got.name + '」！', 2);
        } else if (XG.util.chance(EXPLODE_ASH)) {
          const ash = XG.util.pick(ASH_HERBS);
          const n = XG.util.randInt(1, 2);
          XG.addRes({ mat: pillPair(ash, n) });
          pushNews('player', '爐灰之中尚餘一絲藥性，揀得「' + matName(ash) + '」×' + n + '，聊勝於無。', 0);
        }
      } else {
        // —— 普通失敗：40% 概率殘留 1 份材料 ——
        const ids = r.cost && r.cost.mat ? Object.keys(r.cost.mat) : [];
        if (ids.length && XG.util.chance(FAIL_REMAINDER)) {
          const keep = XG.util.pick(ids);
          XG.addRes({ mat: pillPair(keep, 1) });
        }
      }
    }

    const payload = { ok: ok, explode: explode, mutated: mutated, pillId: ok ? pillId : r.id, grade: r.grade };
    XG.bus.emit('alch:done', payload);
    XG.bus.emit('save:dirty');
    return payload;
  }

  function pillPair(id, n) { const o = {}; o[id] = n; return o; }
  function matName(id) {
    const m = (XG.data.mats || {})[id];
    return m ? m.name : id;
  }

  // ===================== 服用丹藥 =====================
  function baseIdOf(pillId) {
    return pillId.slice(-STAR_SUFFIX.length) === STAR_SUFFIX ? pillId.slice(0, -STAR_SUFFIX.length) : pillId;
  }

  // 丹藥按單顆出售，普通／極品共用原丹方靈石成本，不含材料價值。
  function saleInfo(pillId) {
    if (typeof pillId !== 'string') return null;
    const r = recipeOf(baseIdOf(pillId));
    if (!r) return null;
    const cost = Number(r.cost && r.cost.lingShi);
    if (!Number.isFinite(cost) || cost < 0) return null;
    const count = (XG.state.inv.pill || {})[pillId] || 0;
    return { id: pillId, name: r.name + (baseIdOf(pillId) !== pillId ? '·極品' : ''),
      craftLingShi: cost, price: XG.balance.pillSaleQuote(pillId,r).price, marketCapped:XG.balance.pillSaleQuote(pillId,r).capped, count: count };
  }
  function sellPill(pillId) {
    const info = saleInfo(pillId);
    if (!info) return { ok: false, msg: '找不到這顆丹藥的丹方，暫時無法估價。' };
    if (info.count < 1) return { ok: false, msg: '丹囊裡已沒有這顆丹藥，不能重複出售。' };
    // 一次結算扣一顆與收益；不套用服丹效果、不增加丹毒或煉丹經驗。
    XG.addRes({ pill: pillPair(pillId, -1), lingShi: info.price });
    return { ok: true, price: info.price, msg: '丹藥找到新飯碗，靈石 +' + XG.util.fmt(info.price) + '！' };
  }

  function usePill(pillId) {
    const st = XG.state;
    const a = A();
    const have = (st.inv.pill || {})[pillId] || 0;
    if (have <= 0) return { ok: false, msg: '囊中無此丹藥' };
    const baseId = baseIdOf(pillId);
    const star = baseId !== pillId;
    const r = recipeOf(baseId);
    if (!r) return { ok: false, msg: '丹方已失傳，此丹不可辨' };

    const tox = st.player.toxicity || 0;
    if (r.eff.type !== 'tox' && tox > TOX_BAN) {
      return { ok: false, msg: '丹毒攻心，百脈壅塞，無法再服丹藥——先服解毒丹！' };
    }
    if (XG.balance.instantPill(r) && st.player.realmIdx<XG.balance.pillRealm(r)) {
      return {ok:false,msg:'此丹藥力太熱情，須達'+XG.cfg.REALMS[XG.balance.pillRealm(r)].name+'才能服用。'};
    }
    if (r.eff.type === 'break') {
      const seg = r.seg || [0, 8];
      if (st.player.realmIdx < seg[0] || st.player.realmIdx > seg[1]) {
        return { ok: false, msg: '此丹與當前境界不合，強服無益' };
      }
      if ((a.breakPills || []).length >= BREAK_PILL_MAX) {
        return { ok: false, msg: '破境丹藥力已積三顆，須待突破之後方可再服' };
      }
    }

    const cultBefore=st.player.cult||0;
    XG.addRes({ pill: pillPair(pillId, -1) });
    const mult = star ? STAR_MULT : 1;
    const msg = applyPillEff(r, mult, star);
    if (r.tox) addTox(r.tox);
    if (XG.stats) XG.stats.invalidate();
    XG.bus.emit('save:dirty');
    return { ok: true, msg: msg, star: star, eff: r.eff, actualCult:(st.player.cult||0)-cultBefore };
  }

  function applyPillEff(r, mult, star) {
    const a = A();
    const st = XG.state;
    const now = Date.now();
    const name = r.name + (star ? '·極品' : '');
    const bval = r.eff.val; // 分支判定用原值（root 的 1/2/3 語義不被倍率污染）
    const val = r.eff.val * mult;
    switch (r.eff.type) {
      case 'cult':
        if (r.eff.dur) {
          setBuff('cult', val, r.eff.dur);
          return '服下' + name + '，心若明鏡，' + XG.util.fmtTime(r.eff.dur) + '內修煉速度 +' + Math.round(val) + '%。';
        }
        const gain=XG.balance.pillGain(r,star);
        const d=XG.balance.daily(); d.pills=(d.pills||0)+1;
        addCult(gain, '服用' + name);
        return '服下' + name + '，藥力化作精純修為（+' + XG.util.fmt(gain) + '）。今日第'+d.pills+'顆修為丹。';
      case 'break':
        a.breakPills.push({ pillId: r.id, val: val, star: !!star });
        return '服下' + name + '，藥力沉入丹田蓄勢待發（突破成功率 +' + Math.round(val * 100) + '%，突破時生效）。';
      case 'heal':
        XG.bus.emit('alch:heal', { val: XG.util.clamp(val, 0, 1), dur: r.eff.dur || 0, star: !!star });
        return '服下' + name + '，一股暖流遊走四肢百骸，傷勢漸愈。';
      case 'tox':
        addTox(val); // val 為負
        return '服下' + name + '，清涼藥力滌盪百脈，丹毒消散' + Math.round(-val) + '點。';
      case 'root': {
        const sr = st.player.spiritRoot;
        if (bval === 1) {
          const pool = ROOT_TYPES.filter(function (t) { return t !== sr.type; });
          sr.type = XG.util.pick(pool);
          pushNews('player', '伐毛洗髓，靈根重塑，五行輪轉，資質蹊徑自此而分。', 0);
          return '服下' + name + '，靈根五行已重新輪轉。';
        }
        if (bval === 2) {
          const up = star ? 2 : 1;
          sr.grade = Math.min(5, (sr.grade || 1) + up);
          return '服下' + name + '，根骨精進，靈根品階提升至' + sr.grade + '品。';
        }
        setBuff('rootWash', 0.25, r.eff.dur || 1800);
        return '服下' + name + '，雷火淬形，' + XG.util.fmtTime(r.eff.dur || 1800) + '內洗練靈根變異率大增。';
      }
      case 'atk':
      case 'def':
      case 'hp':
      case 'work': {
        setBuff(r.eff.type, val, r.eff.dur || 1800);
        const cn = { atk: '攻勢', def: '守禦', hp: '氣血', work: '靈寵勞作' }[r.eff.type];
        return '服下' + name + '，' + XG.util.fmtTime(r.eff.dur || 1800) + '內' + cn + ' +' + Math.round(val) + '%。';
      }
      case 'exp': {
        const pets = XG.sys.pets;
        let fed = false;
        if (pets) {
          try {
            if (typeof pets.feedTeamExp === 'function') { pets.feedTeamExp(val, '獸丹'); fed = true; }
            else if (typeof pets.addTeamExp === 'function') { pets.addTeamExp(val); fed = true; }
          } catch (e) { fed = false; }
        }
        if (fed) return '以' + name + '餵養出戰靈寵，靈寵經驗 +' + XG.util.fmt(val) + '。';
        addCult(val * 10, name + '無人可服，藥力化歸己身'); // 降級：無靈寵系統/無出戰寵
        return name + '無可喂之靈寵，藥力化歸己身（修為 +' + XG.util.fmt(val * 10) + '）。';
      }
    }
    return '服下' + name + '，藥力入腹，暖意融融。';
  }

  function setBuff(k, val, durSec) {
    const a = A();
    a.buffs[k] = { val: val, until: Date.now() + durSec * 1000 };
    if (XG.stats) XG.stats.invalidate();
  }

  // ===================== 異火 =====================
  function gainFire(fireId, silent) {
    const a = A();
    const f = fireOf(fireId);
    if (!f || a.fires[fireId]) return false;
    a.fires[fireId] = 1;
    if (!silent) {
      pushNews('player', '收服異火「' + f.icon + f.name + '」！丹道之火，自此更添一分神異。', f.hidden ? 2 : 1);
    }
    XG.bus.emit('save:dirty');
    return true;
  }

  function setFire(fireId) {
    const a = A();
    if (fireId === 'fire_fan' || fireId == null) {
      a.fire = null;
      return { ok: true, msg: '改用凡火。' };
    }
    if (!a.fires[fireId]) return { ok: false, msg: '尚未收服此異火' };
    if (!fireOf(fireId)) return { ok: false, msg: '異火不存在' };
    a.fire = fireId;
    XG.bus.emit('save:dirty');
    return { ok: true, msg: '祭出「' + fireOf(fireId).name + '」，爐火為之一變。' };
  }

  // ===================== 事件訂閱（隱藏內容判定） =====================
  function onAlchDone(p) {
    if (!p) return;
    // 混沌虛火：累計炸爐 ≥100 次，爐火通靈自燃成精
    if (p.explode) {
      const cnt = (XG.state.stats && XG.state.stats.pill_explode) || 0;
      if (cnt >= 100) gainFire('fire_hundun');
    }
  }

  function onExpeditionDone(p) {
    if (!p || !p.mapId) return;
    const a = A();
    if (p.mapId === 'guixu') {
      // 六丁神火：歸墟之眼，潮退之夜，神火自現
      if (!a.fires.fire_liuding && XG.util.chance(0.15)) gainFire('fire_liuding');
    }
    if (p.mapId === 'guixu' || p.mapId === 'longyuan') {
      // 混沌一氣丹殘方：隱藏地圖 8% 掉落
      if (a.known.indexOf('pill_hundun') < 0 && XG.util.chance(0.08)) {
        learn('pill_hundun', true);
        pushNews('player', '於' + (p.mapId === 'guixu' ? '歸墟' : '龍淵') + '深處拾得上古丹方殘頁，參悟隱世丹方「混沌一氣丹」！', 2);
      }
    }
    if (p.mapId === 'fentian') {
      // 青蓮淨火：焚天谷地火深澤，青蓮浴火而生
      if (!a.fires.fire_qinglian && XG.util.chance(0.12)) gainFire('fire_qinglian');
    }
  }

  function onTowerClear(p) {
    if (!p || typeof p.layer !== 'number') return;
    // 子午天火：鎮妖塔每過三十三層，有概率拾得火種
    if (p.layer % 33 === 0 && !A().fires.fire_ziwu && XG.util.chance(0.25)) gainFire('fire_ziwu');
  }

  // ===================== 展示輔助 =====================
  function effText(r, star) {
    const mult = star ? STAR_MULT : 1;
    const val = r.eff.val * mult;
    const dur = r.eff.dur ? XG.util.fmtTime(r.eff.dur) : '';
    switch (r.eff.type) {
      case 'cult':
        return r.eff.dur ? dur + '內修煉速度 +' + Math.round(val) + '%' : '修為 +' + XG.util.fmt(val);
      case 'break': {
        const seg = r.seg || [0, 8];
        const rn = (XG.cfg && XG.cfg.REALMS) || [];
        const segName = seg[0] === seg[1]
          ? (rn[seg[0]] ? rn[seg[0]].name : '?') + '期'
          : (rn[seg[0]] ? rn[seg[0]].name : '?') + '~' + (rn[seg[1]] ? rn[seg[1]].name : '?');
        return '突破成功率 +' + Math.round(val * 100) + '%（限' + segName + '，同次突破≤3顆）';
      }
      case 'heal':
        return r.eff.dur ? dur + '內持續回覆氣血 ' + Math.round(val * 100) + '%' : '立即回覆氣血 ' + Math.round(val * 100) + '%';
      case 'tox':
        return '丹毒 ' + Math.round(val) + '點（解毒）';
      case 'root':
        if (r.eff.val === 1) return '重 roll 五行靈根（品階不變）';
        if (r.eff.val === 2) return '靈根品階 +' + (star ? 2 : 1) + '（上限 5 品）';
        return dur + '內靈根洗練變異率 +25%';
      case 'atk': return dur + '內攻擊 +' + Math.round(val) + '%';
      case 'def': return dur + '內防禦 +' + Math.round(val) + '%';
      case 'hp': return dur + '內氣血 +' + Math.round(val) + '%';
      case 'work': return dur + '內靈寵產出 +' + Math.round(val) + '%';
      case 'exp': return '出戰靈寵經驗 +' + XG.util.fmt(val);
    }
    return '';
  }

  // ===================== 系統註冊 =====================
  XG.sys.alchemy = {
    id: 'alchemy',

    init() {
      if (this._inited) return;
      this._inited = true;
      const st = XG.state;
      st.alchemy = st.alchemy || {};
      const a = st.alchemy;
      if (typeof a.lv !== 'number' || a.lv < 1) a.lv = 1;
      if (typeof a.exp !== 'number' || a.exp < 0) a.exp = 0;
      if (typeof a.furnace !== 'number' || a.furnace < 1 || !furnaceOf(a.furnace)) a.furnace = 1;
      if (!a.fires || typeof a.fires !== 'object') a.fires = {};
      if (!('fire' in a)) a.fire = null;
      if (a.fire && !a.fires[a.fire]) a.fire = null; // 裝備了未持有的火則回退凡火
      if (!Array.isArray(a.known)) a.known = [];
      if (!('job' in a)) a.job = null;
      if (!('auto' in a)) a.auto = null; // 連爐丹方 id（null=關閉）
      if (!a.buffs || typeof a.buffs !== 'object') a.buffs = {};
      if (!Array.isArray(a.breakPills)) a.breakPills = [];
      st.player.toxicity = XG.util.clamp(st.player.toxicity || 0, 0, 100);

      // 初始 3 張丹方；老檔補漏：lv≥2 時補齊等級對應的非隱藏方（新檔由升級自動參悟接管）
      if (!a.known.length) INITIAL_RECIPES.forEach(function (id) { learn(id, true); });
      if (a.lv >= 2) autoLearn(true);

      // 隱藏內容監聽（守則 4：訂閱方防禦性判斷）
      XG.bus.on('alch:done', onAlchDone);
      XG.bus.on('expedition:done', onExpeditionDone);
      XG.bus.on('tower:clear', onTowerClear);

      this._toxBand = (st.player.toxicity || 0) > TOX_SLOW;
      this._fireCheckCd = 0;
    },

    tick(dt) {
      const a = A();
      if (!a) return;
      const p = XG.state.player;

      // 丹毒達 100 判定（先於衰減；服丹之外的來源，如奇遇事件，也可能推高丹毒）
      if (p.toxicity >= 100 && !(XG.state.stats && XG.state.stats.tox100)) {
        statsAdd('tox100', 1);
        pushNews('player', '丹毒攻心，百脈俱灼！丹毒已積至頂峯，速覓解毒之方，否則道基堪憂。', 1);
      }
      // 丹毒緩慢衰減；跨越 50 閾值時刷新屬性緩存
      if (p.toxicity > 0) {
        const before = p.toxicity;
        p.toxicity = Math.max(0, p.toxicity - dt * TOX_DECAY_PER_SEC);
        const band = p.toxicity > TOX_SLOW;
        if (band !== this._toxBand) {
          this._toxBand = band;
          if (XG.stats) XG.stats.invalidate();
        }
      }

      // 限時丹藥 buff 到期清理（觸發屬性重算）
      let expired = false;
      const now = Date.now();
      for (const k in a.buffs) {
        if (a.buffs[k] && a.buffs[k].until <= now) { delete a.buffs[k]; expired = true; }
      }
      if (expired && XG.stats) XG.stats.invalidate();

      // 丹爐到期結算（連爐開啓時隨即自動再開）
      if (a.job && now >= a.job.endAt) settleJob();
      runAuto();

      // 地肺真火：洞府丹房（df）≥1 級自動引地火入丹房（每 5 秒輪詢一次）
      this._fireCheckCd = (this._fireCheckCd || 0) - dt;
      if (this._fireCheckCd <= 0) {
        this._fireCheckCd = 5;
        if (!a.fires.fire_difu && XG.state.cave && XG.state.cave.lv && (XG.state.cave.lv.df || 0) >= 1) {
          gainFire('fire_difu');
        }
      }
    },

    // 離線結算：到期丹爐結算 + 丹毒衰減
    offline(dt) {
      const a = A();
      if (!a) return null;
      const p = XG.state.player;
      if (p.toxicity > 0) p.toxicity = Math.max(0, p.toxicity - dt * TOX_DECAY_PER_SEC);

      const frag = { events: [] };
      if (a.job && a.job.endAt <= Date.now()) {
        const res = settleJob();
        if (res) {
          if (res.ok) {
            frag.pillGain = pillPair(res.pillId, 1);
            frag.events.push('丹爐熄火，「' + this.pillInfo(res.pillId).name + '」已成，收入囊中。');
          } else if (res.explode) {
            frag.events.push('丹房傳來一聲悶響——丹爐炸燬，一爐藥材盡成飛灰。');
          } else {
            frag.events.push('一爐丹藥煉廢，藥材付諸東流。');
          }
        }
      }
      return frag.events.length ? frag : null;
    },

    // 屬性聚合：丹毒 >50 → 修煉 −20%；丹藥限時 buff（atk/def/hp/work/cult）
    getMods() {
      const mods = {};
      const p = XG.state.player;
      if ((p.toxicity || 0) > TOX_SLOW) mods.cultRatePct = -20;
      const a = XG.state.alchemy;
      if (!a || !a.buffs) return mods;
      const now = Date.now();
      const b = a.buffs;
      if (b.cult && b.cult.until > now) mods.cultRatePct = (mods.cultRatePct || 0) + b.cult.val;
      if (b.atk && b.atk.until > now) mods.atkPct = (mods.atkPct || 0) + b.atk.val;
      if (b.def && b.def.until > now) mods.defPct = (mods.defPct || 0) + b.def.val;
      if (b.hp && b.hp.until > now) mods.hpPct = (mods.hpPct || 0) + b.hp.val;
      if (b.work && b.work.until > now) mods.workPct = (mods.workPct || 0) + b.work.val;
      return mods;
    },

    // ===================== UI 對接面：查詢 =====================
    getState() {
      const a = A();
      const tox = XG.state.player.toxicity || 0;
      return {
        lv: a.lv,
        exp: a.exp,
        expNeed: expNeed(a.lv),
        maxLv: MAX_LV,
        tox: tox,
        toxSlow: tox > TOX_SLOW,
        toxBan: tox > TOX_BAN,
        furnace: curFurnace(),
        fire: curFire(),
        knownCount: a.known.length,
        job: this.getJobProgress(),
        breakPillCount: (a.breakPills || []).length,
      };
    },

    listRecipes() {
      const a = A();
      const self = this;
      return D().recipes.map(function (r) {
        const known = a.known.indexOf(r.id) >= 0;
        const chk = self.canCraft(r.id);
        return {
          id: r.id, name: r.name, icon: r.icon, grade: r.grade, hidden: !!r.hidden,
          alchLv: r.alchLv, known: known,
          canCraft: chk.ok, reason: chk.reason,
          succ: known ? self.succPreview(r.id) : 0,
          time: r.time, cost: r.cost, eff: r.eff, tox: r.tox,
          desc: r.desc, getHint: r.getHint, effText: effText(r, false),
        };
      });
    },

    listFurnaces() {
      const a = A();
      return D().furnaces.map(function (f) {
        return {
          id: f.id, name: f.name, icon: f.icon, succ: f.succ, speed: f.speed,
          cost: f.cost, desc: f.desc,
          owned: f.id <= a.furnace, current: f.id === a.furnace, next: f.id === a.furnace + 1,
        };
      });
    },

    listFires() {
      const a = A();
      return D().fires.map(function (f) {
        return {
          id: f.id, name: f.name, icon: f.icon, grade: f.grade,
          succ: f.succ, mutPct: f.mutPct, hidden: !!f.hidden,
          owned: !!a.fires[f.id] || f.id === 'fire_fan',
          equipped: f.id === 'fire_fan' ? !a.fire : a.fire === f.id,
          getHint: f.getHint, desc: f.desc,
        };
      });
    },

    getJobProgress() {
      const a = A();
      if (!a || !a.job) return null;
      const r = recipeOf(a.job.recipeId);
      const now = Date.now();
      const remain = Math.max(0, (a.job.endAt - now) / 1000);
      return {
        recipeId: a.job.recipeId,
        name: r ? r.name : a.job.recipeId,
        icon: r ? r.icon : '❓',
        pct: a.job.dur > 0 ? XG.util.clamp(1 - remain / a.job.dur, 0, 1) : 1,
        remainSec: remain,
        endAt: a.job.endAt,
        dur: a.job.dur,
      };
    },

    succPreview(recipeId) {
      const r = recipeOf(recipeId);
      return r ? succRate(r) : 0;
    },

    canCraft: canCraft,
    startCraft: startCraft,
    cancelCraft: cancelCraft,

    // 連爐：id=丹方 id 開啓（需已習得），null 關閉；丹成後自動按同方再開，材料盡/不可用自動中止
    setAuto(recipeId) {
      const a = A();
      if (!recipeId) { a.auto = null; XG.bus.emit('save:dirty'); return { ok: true, msg: '連爐已停止。' }; }
      const r = recipeOf(recipeId);
      if (!r) return { ok: false, msg: '丹方不存在。' };
      if (a.known.indexOf(recipeId) < 0) return { ok: false, msg: '尚未習得此丹方。' };
      a.auto = recipeId;
      XG.bus.emit('save:dirty');
      return { ok: true, msg: '連爐已開啓：' + r.name + '，丹成自動再開。' };
    },
    getAuto() {
      const a = A();
      if (!a.auto) return null;
      const r = recipeOf(a.auto);
      return { recipeId: a.auto, name: r ? r.name : a.auto, icon: r ? r.icon : '丹' };
    },

    saleInfo: saleInfo,
    sellPill: sellPill,

    // 一鍵服丹：連續服用至丹盡或不可再服（丹毒>80/境界不合/破境丹滿 3 顆自動停）
    useAll(pillId) {
      let n = 0, last = null;
      for (let i = 0; i < 200; i++) {
        const r = usePill(pillId);
        if (!r || !r.ok) { last = r; break; }
        n++;
        last = r;
      }
      if (!n) return { ok: false, n: 0, msg: (last && last.msg) || '無可服之丹。' };
      const info = this.pillInfo(pillId);
      return {
        ok: true, n: n,
        msg: '服下' + (info ? info.name : '丹藥') + '×' + n + (last && last.msg ? '。' + last.msg : ''),
      };
    },

    buyFurnace() {
      const a = A();
      const next = furnaceOf(a.furnace + 1);
      if (!next) return { ok: false, msg: '太上八卦爐已是人間極致，無爐可換' };
      if (!XG.hasRes({ lingShi: next.cost })) {
        return { ok: false, msg: '靈石不足（需 ' + XG.util.fmt(next.cost) + '）' };
      }
      XG.addRes({ lingShi: -next.cost });
      a.furnace = next.id;
      pushNews('player', '重金購得「' + next.name + '」，丹房氣象一新。', 0);
      XG.bus.emit('save:dirty');
      return { ok: true, msg: '購得「' + next.icon + next.name + '」，成功率 +' + next.succ + '%，爐速 ×' + next.speed + '。' };
    },

    gainFire: gainFire,
    setFire: setFire,
    usePill: usePill,
    learn: learn,
    learnRandomRecipe: learnRandomRecipe,

    // 揹包丹藥展示/可用性
    pillInfo(pillId) {
      const st = XG.state;
      const baseId = baseIdOf(pillId);
      const star = baseId !== pillId;
      const r = recipeOf(baseId);
      const count = (st.inv.pill || {})[pillId] || 0;
      if (!r) {
        return { id: pillId, baseId: baseId, star: star, name: pillId, icon: '❓', grade: 0, desc: '', effText: '', tox: 0, usable: false, reason: '丹方已失傳', count: count };
      }
      const tox = st.player.toxicity || 0;
      let usable = true;
      let reason = '';
      if (r.eff.type !== 'tox' && tox > TOX_BAN) { usable = false; reason = '丹毒>80，禁服'; }
      else if (XG.balance.instantPill(r) && st.player.realmIdx<XG.balance.pillRealm(r)) { usable=false; reason='須達'+XG.cfg.REALMS[XG.balance.pillRealm(r)].name+'才可服用'; }
      else if (r.eff.type === 'break') {
        const seg = r.seg || [0, 8];
        if (st.player.realmIdx < seg[0] || st.player.realmIdx > seg[1]) { usable = false; reason = '境界不合'; }
        else if ((A().breakPills || []).length >= BREAK_PILL_MAX) { usable = false; reason = '已積3顆破境丹'; }
      }
      return {
        id: pillId, baseId: baseId, star: star,
        name: r.name + (star ? '·極品' : ''),
        icon: r.icon + (star ? '★' : ''),
        grade: r.grade, desc: r.desc,
        effText: effText(r, star)+(XG.balance.instantPill(r)?'；今日已服'+(XG.balance.daily().pills||0)+'顆，下顆實得修為 '+XG.util.fmt(XG.balance.pillGain(r,star))+'（藥效'+Math.round(XG.balance.pillFactor(XG.balance.daily().pills||0)*100)+'%）':''), tox: r.tox,
        usable: usable, reason: reason, count: count,
      };
    },

    // ===================== 跨系統讀取接口 =====================
    getBreakBuffs() {
      const a = A();
      return (a.breakPills || []).map(function (b) {
        const r = recipeOf(b.pillId);
        return {
          pillId: b.pillId,
          name: (r ? r.name : b.pillId) + (b.star ? '·極品' : ''),
          icon: r ? r.icon : '❓',
          val: b.val,
          star: !!b.star,
        };
      });
    },

    getBreakBuffBonus() {
      const a = A();
      let sum = 0;
      (a.breakPills || []).forEach(function (b) { sum += b.val || 0; });
      return sum;
    },

    // cultivation 突破時調用：取走破境丹加值合計（小數）並清空
    consumeBreakBuffs() {
      const a = A();
      const sum = this.getBreakBuffBonus();
      a.breakPills = [];
      XG.bus.emit('save:dirty');
      return sum;
    },

    // 靈根洗練變異率加成（淬靈丹 buff），cultivation 洗練時讀取
    getRootWashBoost() {
      const b = A().buffs || {};
      return b.rootWash && b.rootWash.until > Date.now() ? b.rootWash.val : 0;
    },

    getBuffs() {
      const a = A();
      const now = Date.now();
      const out = {};
      for (const k in a.buffs) {
        const b = a.buffs[k];
        if (b && b.until > now) out[k] = { val: b.val, remainSec: (b.until - now) / 1000 };
      }
      return out;
    },

    getToxInfo() {
      const tox = XG.state.player.toxicity || 0;
      return { tox: tox, slow: tox > TOX_SLOW, ban: tox > TOX_BAN, decayPerSec: TOX_DECAY_PER_SEC };
    },
  };

  XG.sysOrder.push('alchemy');
})();
