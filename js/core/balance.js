/* v1.9：共用估價、單次活動收益與標準收益。沿用既有存檔，不扣減舊資源。 */
(function () {
  'use strict';
  const XG = window.XG;
  const B = XG.balance = {
    version: '2.0.3',
    targetHours: [1/3,24,48,96,120,144,168,192,216],
    exploreHourly: [180,600,1800,4800,12000,24000,42000,66000,96000,96000],
    petGradeMult: [1,1,1.4,1.8,2.3,3],
    dayKey() { const d=new Date(); return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate(); },
    daily() {
      const st=XG.state, day=this.dayKey();
      if (!st.balanceDaily || st.balanceDaily.day!==day) st.balanceDaily={day:day,discuss:0,pills:0,taps:0,purchases:{}};
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
    pillGain(r,star) { return Math.floor(r.eff.val*(star?1.5:1)); },
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
    // v2.0.1：路線差異只作用於金丹後主動活動，不改掛機／吐納／普通丹藥。
    isRiskyWanderer() {return XG.state.player.realmIdx>=2&&!(XG.sys.sect&&XG.sys.sect.active());},
    boostActivityCult(n) {n=Number(n)||0;return n>0?Math.max(1,Math.floor(n*(this.isRiskyWanderer()?1.25:1))):0;},
    activityToxicity(n) {
      if(!this.isRiskyWanderer()||!(n>0))return 0;
      const seconds=n/Math.max(1,this.standardRate());
      return Math.round(Math.min(8,Math.max(.2,seconds/30))*1000)/1000;
    },
    // 僅在成功發獎時調用；報價、預覽與失敗操作不可調用。
    applyActivityToxicity(n) {
      const gain=this.activityToxicity(n);if(!gain)return 0;
      const p=XG.state.player,before=p.toxicity||0;
      p.toxicity=Math.min(100,Math.round((before+gain)*1000)/1000);
      const stats=XG.state.stats=XG.state.stats||{};stats.tox_max=Math.max(stats.tox_max||0,p.toxicity);if(p.toxicity>=100)stats.tox100=1;
      if((before>50)!==(p.toxicity>50))XG.stats.invalidate();
      XG.bus.emit('save:dirty');return p.toxicity-before;
    },
    // v2.0：單次報酬採較小、平滑成長的值；無每日總額、無次數遞減，舊額度欄位不再讀寫。
    activityCult(n) {
      n=Number(n)||0;if(n<=0)return 0;
      const rate=this.standardRate();if(!(rate>0))return 0;
      return this.boostActivityCult(rate*15*Math.log1p(n/(rate*120)));
    },
    activityStone(n) {
      n=Number(n)||0;if(n<=0)return 0;
      const unit=this.exploreHourly[XG.state.player.realmIdx]/120;
      return Math.max(1,Math.floor(unit*Math.log1p(n/(unit*10))));
    },
    activityJade(n) {
      n=Number(n)||0;return n>0?Math.max(1,Math.floor(n*.2)):0;
    }
  };
  // 以初始靈根三品＋閉關1.3倍＋洞府6%作標準，逐層即時突破、未計失敗及額外獎勵。
  let weighted=0; for(let l=1;l<=10;l++) weighted+=Math.pow(l,2.2)/(1+.12*(l-1));
  XG.cfg.REALMS.slice(0,9).forEach((r,i)=>{r.baseCost=B.targetHours[i]*3600*r.rate*1.49/weighted;});
})();
