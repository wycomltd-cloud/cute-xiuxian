const {game}=require('./game-harness.cjs'),assert=require('assert/strict');let n=0;
function ok(v,msg){assert.ok(v,msg);n++;}function eq(a,b,msg){ok(Math.abs(a-b)<1e-7,msg+': '+a+' != '+b);}
function setup(x){Object.assign(x.state.player,{realmIdx:2,layer:5,gender:'male',school:'jian'});x.stats.invalidate();}
function forceType(x,type){const pick=x.util.pick;x.util.pick=function(arr){return arr.includes(type)?type:pick.call(this,arr);};}
{
 const g=game(),{x}=g;setup(x);x.state.res.lingYu=1000;const F=x.sys.fellows;
 let m=F.market();eq(m.batchMarkup,0,'free first batch normal price');ok(m.slots.every(s=>s.markup===0&&s.price===s.originalPrice),'initial no premium');
 let i=0;for(const premium of [.2,.3,.4,.5,.5]){i++;const before=x.state.res.lingYu;const r=F.refreshMarket();ok(r.ok,'paid refresh');eq(before-x.state.res.lingYu,5*2**(i-1),'fee unchanged');m=F.market();eq(m.batchMarkup,premium,'correct sequence '+i);for(const s of m.slots){eq(s.markup,premium,'same whole batch');eq(s.price,Math.ceil(s.originalPrice*(1+premium)),'price base plus premium');ok(s.price>=s.originalPrice,'never a discount');}}
 ok(!F.refreshMarket().ok,'sixth blocked');x.save.save();x.save.load();eq(F.market().refreshUsed,5,'five usage persists');g.advance(86400);m=F.market();eq(m.batchMarkup,0,'midnight resets premium');eq(m.refreshCost,5,'midnight resets fee');
}
{
 const {x}=game();setup(x);const F=x.sys.fellows;x.balance.daily().marketRefreshes=2;
 x.state.fellowMarket={balanceVersion:'1.9.1',at:123,day:x.balance.dayKey(),discounted:true,slots:[
 {sid:'old-a',kind:'mat',id:'ore_jingtie',originalPrice:1000,price:200,n:2,sold:false,cur:'lingShi'},
 {sid:'old-b',kind:'pill',id:'pill_juqi',originalPrice:100,price:50,n:0,sold:true,cur:'lingShi'}]};
 const m=F.market();eq(m.refreshUsed,2,'migration retains refresh usage');eq(m.slots[0].price,1300,'old discount replaced with second premium');ok(m.slots[0].sid==='old-a'&&m.slots[0].n===2,'no free stock reroll');ok(m.slots[1].sold&&m.slots[1].n===0,'sold stays sold');F.market();eq(x.balance.daily().marketRefreshes,2,'migration once');
}
{
 const {x}=game();setup(x);const F=x.sys.fellows;forceType(x,'lingShi');x.state.inv.pill.pill_juqi=100;const fs=x.state.fellows;
 for(let i=0;i<49;i++){const r=F.sendGift(fs[i].uid,'pill','pill_juqi');ok(r.ok&&r.returns.length===0,'49 distinct NPCs no early return');}
 eq(F.giftProgress().totalSent,49,'shared 49 total');eq(F.get(fs[49].uid).giftReturnIn,1,'unsent NPC shows shared one remaining');
 const r=F.sendGift(fs[49].uid,'pill','pill_juqi');eq(r.returns.length,1,'50 different NPCs trigger one return');eq(r.returnLingShi,600,'one bounded cash return');eq(F.giftProgress().returnsClaimed,1,'claimed counter');ok(fs.some(f=>f.uid===r.returns[0].fromUid&&f.giftsReceived>0),'donor actually received gifts');
 eq(F.claimGiftReturns().count,0,'cannot repeat claim');x.save.save();x.save.load();eq(F.giftProgress().totalSent,50,'global saved');
 for(let i=0;i<50;i++)F.sendGift(x.state.fellows[i].uid,'pill','pill_juqi');eq(F.giftProgress().returnsClaimed,2,'100 total gives second return');eq(F.giftProgress().totalSent,100,'global100');
 const before=F.giftProgress().totalSent;ok(!F.sendGift(fs[0].uid,'pill','missing').ok,'invalid gift rejected');eq(F.giftProgress().totalSent,before,'failed gift not counted');
}
for(const type of ['lingShi','lingYu','equip','pill','frag']){
 const {x}=game();setup(x);const F=x.sys.fellows;const a=x.state.fellows[0],b=x.state.fellows[1];
 delete x.state.fellowGiftLedger;a.giftsReceived=49;a.giftBatchValue=44100;eq(F.giftProgress().totalSent,49,'prime old count');forceType(x,type);x.state.inv.pill.pill_ningyuan=1;
 const cash=x.state.res.lingShi,jade=x.state.res.lingYu,eqCount=x.state.equips.list.length;
 const r=F.sendGift(b.uid,'pill','pill_ningyuan');eq(r.returns.length,1,'one '+type+' return');const reward=r.returns[0];ok(reward.kind===type,'type is '+type);ok(reward.value<=4500,'return within batch value');ok(reward.fromUid===a.uid||reward.fromUid===b.uid,'eligible donor');
 if(type==='lingShi')eq(x.state.res.lingShi-cash,reward.n,'cash credited');
 if(type==='lingYu')eq(x.state.res.lingYu-jade,reward.n,'jade credited');
 if(type==='equip'){eq(x.state.equips.list.length,eqCount+1,'equip created');ok(x.sys.forge.getEquip(reward.id),'equip instance exists');}
 if(type==='pill')ok(x.state.inv.pill[reward.id]>=1,'pill bag credited');
 if(type==='frag')ok((x.state.gongfa.frag[reward.id]||0)+(x.state.inv.frag[reward.id]||0)>=1,'fragment bag credited');
}
{
 const {x}=game();setup(x);const F=x.sys.fellows;forceType(x,'lingShi');delete x.state.fellowGiftLedger;
 x.state.fellows.slice(0,2).forEach(f=>{f.giftsReceived=25;f.giftBatchValue=3000;});
 let progress=F.giftProgress();eq(progress.totalSent,50,'old 25+25 counts merged');eq(progress.pendingReturns,1,'missed old return pending');eq(progress.returnsClaimed,0,'none already paid');const cash=x.state.res.lingShi;eq(F.claimGiftReturns().count,1,'can claim without gifting again');eq(x.state.res.lingShi-cash,600,'migration correct amount');eq(F.claimGiftReturns().count,0,'catch-up cannot duplicate');
 x.save.save();x.save.load();eq(F.giftProgress().pendingReturns,0,'catch-up saved');eq(F.giftProgress().returnsClaimed,1,'claimed saved');
}
{
 const {x}=game();setup(x);const F=x.sys.fellows;delete x.state.fellowGiftLedger;
 const [a,b]=x.state.fellows;a.giftsReceived=75;a.giftBatchValue=3000;b.giftsReceived=25;b.giftBatchValue=3000;
 const p=F.giftProgress();eq(p.totalSent,100,'all old counts retained');eq(p.returnsClaimed,1,'old per-NPC50 already credited');eq(p.pendingReturns,1,'only missing global return due');eq(F.claimGiftReturns().count,1,'only one catchup');eq(F.giftProgress().returnsClaimed,2,'no duplicate already paid return');
}
{
 const {x,c}=game();setup(x);x.state.player.realmIdx=7;x.state.player.layer=10;x.state.inv.pill.pill_juqi=1;
 const F=x.sys.fellows;F.sendGift(x.state.fellows[0].uid,'pill','pill_juqi');const count=F.giftProgress().totalSent;c.Math.random=()=>0;x.stats.invalidate();ok(x.sys.reincarn.startChallenge([]).success,'reincarnation succeeds');eq(F.giftProgress().totalSent,count,'global count survives reincarnation');
}
console.log('PASS',n,'v1.9.2 correction checks');
