/* v1.9：共用估價、每日額度與標準收益。沿用既有存檔，不扣減舊資源。 */
(function () {
  'use strict';
  const XG = window.XG;
  const B = XG.balance = {
    version: '1.9.3',
    targetHours: [1/3,24,48,96,120,144,168,192,216],
    exploreHourly: [300,1000,3000,8000,20000,40000,70000,110000,160000,160000],
    petGradeMult: [1,1,1.4,1.8,2.3,3],
    dayKey() { const d=new Date(); return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate(); },
    daily() {
      const st=XG.state, day=this.dayKey();
      if (!st.balanceDaily || st.balanceDaily.day!==day) st.balanceDaily={day:day,discuss:0,pills:0,taps:0,purchases:{},activitySec:0,activityYu:0};
      const d=st.balanceDaily;
      if (!d.purchases) d.purchases={};
      return d;
    },
    marketProfile() {
      const p=XG.state.player, base=XG.cfg.POWER(XG.cfg.REALM_BASE[0]);
      const power=Math.max(1,XG.stats.get().power||1);
      const powerStage=Math.max(0,Math.log(Math.max(base,power)/base)/Math.log(6));
      const tier=(Math.max(0,p.realmIdx)+powerStage)/2;
      return {power:power,realmIdx:p.realmIdx,tier:tier,
        pillGrade:Math.min(9,1+Math.floor(tier)),matGrade:Math.min(4,Math.floor(tier/2)),
        equipGrade:Math.min(4,Math.floor(tier/2)),fragGrade:Math.min(9,1+Math.floor(tier)),
        recipeGrade:Math.min(9,2+Math.floor(tier)),priceMult:1+.15*tier};
    },
    marketMarkup(index) { return [0,.2,.3,.4,.5,.5][Math.min(5,Math.max(0,Math.floor(index||0)))]; },
    marketRefreshInfo() {
      const used=this.daily().marketRefreshes||0;
      return {used:used,left:Math.max(0,5-used),cost:used<5?5*Math.pow(2,used):null,nextMarkup:used<5?this.marketMarkup(used+1):null};
    },
    pillLots(id) {
      const st=XG.state; st.marketPillLots=st.marketPillLots||{};
      const lots=st.marketPillLots[id]||[];
      let remaining=Math.max(0,(st.inv.pill||{})[id]||0);
      const clean=[];
      for(const lot of lots) {
        const n=Math.min(remaining,Math.max(0,Math.floor(lot.n||0)));
        if(n && Number.isFinite(lot.paidStone) && lot.paidStone>=0) {clean.push({n:n,paidStone:lot.paidStone});remaining-=n;}
      }
      st.marketPillLots[id]=clean; return clean;
    },
    recordMarketPill(id,paidStone) {
      const lots=this.pillLots(id),last=lots[lots.length-1];
      if(last&&last.paidStone===paidStone)last.n++;else lots.push({n:1,paidStone:paidStone});
    },
    consumeMarketPills(id,n) {
      const lots=this.pillLots(id);let left=n;
      while(left>0&&lots.length){const take=Math.min(left,lots[0].n);lots[0].n-=take;left-=take;if(!lots[0].n)lots.shift();}
    },
    // 送禮估值沿用既有規則；玩家出售一律另用 pillSale(r) 的固定基準。
    pillGiftQuote(id,r) {
      const lots=this.pillLots(id),base=this.pillSale(r);
      return {price:lots.length?Math.min(base,Math.floor(lots[0].paidStone*.6)):base,capped:lots.length>0};
    },
    standardRate() {
      const p=XG.state.player, r=XG.cfg.REALMS[p.realmIdx];
      return r ? r.rate*(1+.12*(p.layer-1))*1.49 : 0;
    },
    stageCost(idx) { let n=0; for(let l=1;l<=10;l++) n+=XG.cfg.layerCost(idx,l); return n; },
    pillRealm(r) { return r.id==='pill_hundun' ? 5 : r.grade-1; },
    instantPill(r) { return r.eff.type==='cult' && !r.eff.dur; },
    pillFactor(n) { return n<2 ? 1 : n<4 ? .5 : .1; },
    pillGain(r,star) { return Math.floor(r.eff.val*(star?1.5:1)*this.pillFactor(this.daily().pills||0)); },
    pillSale(r) { return Math.floor((r.cost.lingShi||0)*.6); },
    matValue(id) {
      const m=XG.data.mats[id], g=m?m.grade:0;
      const prices=XG.data.world.marketRules.stock.basePrice;
      return prices['matG'+Math.min(4,g)]||100;
    },
    pillPrice(r) {
      let n=r.cost.lingShi||0;
      for(const id in r.cost.mat||{}) n+=this.matValue(id)*r.cost.mat[id];
      return Math.ceil(n*1.25);
    },
    equipYu(grade) { return Math.max(1,Math.round(800*Math.max(1,grade||0)/500)); },
    marketPrice(slot,mult,cur) {
      let base=slot.price, floor=0;
      if(slot.kind==='pill') {
        const r=XG.data.pills.recipes.find(r=>r.id===slot.id);
        if(r) { base=this.pillPrice(r); floor=Math.ceil(this.pillSale(r)*1.5); }
      } else if(slot.kind==='equip') {
        base=this.equipYu(slot.grade)*500;
        floor=Math.max(Math.ceil(Math.floor(this.equipYu(slot.grade)*.6)*500*1.5),Math.ceil(base*.7));
      }
      const stone=Math.max(1,Math.ceil(base*mult),floor);
      return cur==='lingYu' ? Math.max(1,Math.ceil(stone/500)) : stone;
    },
    // 重複活動合計每日最多四小時標準修為；不包含掛機、論道、吐納及修為丹。
    activityCult(n) {
      const d=this.daily(), rate=this.standardRate();
      if(!(rate>0)) return 0;
      const secs=Math.min(Math.max(0,n)/rate,Math.max(0,14400-(d.activitySec||0)));
      const gain=Math.floor(secs*rate);
      d.activitySec=(d.activitySec||0)+gain/rate;
      XG.bus.emit('save:dirty');
      return gain;
    },
    // 重複活動靈石以同境一階靈寵十二小時收入為每日共用額度；掛機打工、出售及一次性成就另計。
    activityStoneLimit() { return this.exploreHourly[XG.state.player.realmIdx]*12; },
    activityStoneRemaining() { return Math.max(0,Math.floor((1-(this.daily().activityStoneFraction||0))*this.activityStoneLimit())); },
    activityStone(n) {
      const d=this.daily(), limit=this.activityStoneLimit(), gain=Math.min(Math.max(0,Math.floor(n)),this.activityStoneRemaining());
      d.activityStoneFraction=Math.min(1,(d.activityStoneFraction||0)+gain/limit);
      XG.bus.emit('save:dirty'); return gain;
    },
    // 奇遇、秘境、派遣的可重複靈玉合計每日二十；成就、論劍每日結算不在此限。
    activityJade(n) {
      const d=this.daily(), gain=Math.min(Math.max(0,Math.floor(n)),Math.max(0,20-(d.activityYu||0)));
      d.activityYu=(d.activityYu||0)+gain;
      XG.bus.emit('save:dirty'); return gain;
    }
  };
  // 以初始靈根三品＋閉關1.3倍＋洞府6%作標準，逐層即時突破、未計失敗及額外獎勵。
  let weighted=0; for(let l=1;l<=10;l++) weighted+=Math.pow(l,2.2)/(1+.12*(l-1));
  XG.cfg.REALMS.slice(0,9).forEach((r,i)=>{r.baseCost=B.targetHours[i]*3600*r.rate*1.49/weighted;});
})();
