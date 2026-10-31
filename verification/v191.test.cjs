const {game}=require('./balance.test.cjs'),assert=require('assert/strict');let n=0;
function ok(v,msg){assert.ok(v,msg);n++;}function eq(a,b,msg){ok(Math.abs(a-b)<1e-7,msg+': '+a+' != '+b);}
function fighter(x){Object.assign(x.state.player,{realmIdx:2,layer:5,gender:'male',school:'jian'});x.stats.invalidate();}
{
 const {x}=game(),F=x.sys.fellows;eq(x.state.fellows.length,50,'new game 50');
 const old=x.state.fellows.slice(0,31);old[0].favor=77;old[0].relation='friend';const ids=old.map(f=>f.uid);x.state.fellows=old;F.init();eq(x.state.fellows.length,50,'old game topped up');ok(ids.every((id,i)=>x.state.fellows[i].uid===id),'old NPC identities retained');eq(x.state.fellows[0].favor,77,'favor retained');ok(x.state.fellows[0].relation==='friend','relationship retained');F.init();eq(x.state.fellows.length,50,'no repeated topups');eq(new Set(x.state.fellows.map(f=>f.uid)).size,50,'unique NPC IDs');
}
{
 const {x}=game();fighter(x);const P=x.sys.pvp,uid=x.state.fellows[0].uid,real=x.sys.fellows.get(uid).power;
 eq(P.match().power,x.stats.get().power,'matched equal power');
 x.sys.testBoost={getMods:()=>({atkFlat:10000})};x.stats.invalidate();const p=x.stats.get().power;
 const result=P.fight(uid);ok(result.ok,'explicit opponent battle');eq(result.opp.power,p,'fight resync after equipment change');eq(x.sys.fellows.get(uid).power,real,'NPC stats not mutated');ok(!result.upset,'no phantom stronger-opponent reward');
 x.state.player.layer=9;x.stats.invalidate();eq(P.fight().opp.power,x.stats.get().power,'automatic battle equality');ok(P.counterBonus('jian','fu')===20,'school counter retained');
}
{
 const g=game(),{x}=g;fighter(x);const F=x.sys.fellows;x.state.res.lingYu=1000;
 let m=F.market();eq(m.refreshUsed,0,'initial no paid count');ok(m.slots.length===6&&m.slots.every(s=>s.markup===0),'initial batch undiscounted');const initial=m.slots.map(s=>s.sid).join();
 g.advance(1800);F.tick(1800);eq(F.market().refreshUsed,0,'time does not spend quota');ok(F.market().slots.map(s=>s.sid).join()===initial,'no ten minute reroll');F.offline(3600);ok(F.market().slots.map(s=>s.sid).join()===initial,'no offline reroll');
 let expected=1000;for(const cost of [5,10,20,40,80]){m=F.market();eq(m.refreshCost,cost,'next cost');const r=F.refreshMarket();ok(r.ok,'refresh success');expected-=cost;eq(x.state.res.lingYu,expected,'exact charge');for(const s of F.market().slots){ok([.2,.3,.4,.5].includes(s.markup),'allowed markup');eq(s.price,Math.max(1,Math.ceil(s.originalPrice*(1+s.markup))),'markup price exact');}}
 m=F.market();eq(m.refreshLeft,0,'five limit');const before=JSON.stringify(x.state.fellowMarket);ok(!F.refreshMarket().ok,'sixth refused');eq(x.state.res.lingYu,expected,'sixth no charge');ok(JSON.stringify(x.state.fellowMarket)===before,'sixth no reroll');
 x.save.save();x.save.load();eq(F.market().refreshUsed,5,'refresh quota saved');ok(!F.refreshMarket().ok,'reload no bypass');
 g.advance(86400);m=F.market();eq(m.refreshUsed,0,'next day reset');eq(m.refreshCost,5,'next day cost reset');ok(m.slots.every(s=>s.markup===0),'new daily free batch');x.state.res.lingYu=0;const failed=JSON.stringify(x.state.fellowMarket);ok(!F.refreshMarket().ok,'poor refresh refused');eq(F.market().refreshUsed,0,'failed no quota');ok(JSON.stringify(x.state.fellowMarket)===failed,'failed no reroll');
}
{
 const {x}=game();fighter(x);x.state.res.lingShi=10000;x.sys.fellows.market();
 const r=x.data.pills.recipes.find(r=>r.id==='pill_xuanzhi'),A=x.sys.alchemy;
 // Mixed legacy and bought inventory: newly bought lots are consumed first by every resource path.
 x.state.inv.pill[r.id]=2;x.state.fellowMarket.slots=[{sid:'cheap',kind:'pill',id:r.id,name:r.name,n:3,cur:'lingShi',price:10}];
 ok(x.sys.fellows.buyMarket('cheap').ok,'buy discounted pill');eq(A.saleInfo(r.id).price,6,'resale actual paid cap');const before=x.state.res.lingShi;ok(A.sellPill(r.id).ok,'discount sell');eq(x.state.res.lingShi,before+6,'actual capped payout');eq(A.saleInfo(r.id).price,3600,'legacy item retains original return');
 ok(x.sys.fellows.buyMarket('cheap').ok,'second discounted pill');x.save.save();x.save.load();eq(A.saleInfo(r.id).price,6,'acquisition metadata saved');
 ok(A.usePill(r.id).ok,'consume bought lot');eq(A.saleInfo(r.id).price,3600,'consumed lot no stale cap');
 ok(x.sys.fellows.buyMarket('cheap').ok,'third discounted pill');const uid=x.state.fellows[0].uid;ok(x.sys.fellows.sendGift(uid,'pill',r.id).ok,'gift consumes purchased lot');eq(A.saleInfo(r.id).price,3600,'gift no stale metadata');
 const b=x.data.equips.bases.find(b=>!b.hidden),E=x.sys.forge,gear=E.createEquip(b.id,b.grade);gear.marketPaidStone=100;
 eq(E.disposalInfo(gear.uid).lingYu,0,'equipment low paid cap');ok(E.sell(gear.uid).ok,'zero return explicitly supported');ok(!E.sell(gear.uid).ok,'no duplicate sale');
}
{
 const g=game(),{x}=g;fighter(x);const F=x.sys.fellows;const oldPick=x.util.pick;x.util.pick=function(arr){return arr.includes('lingShi')?'lingShi':oldPick.call(this,arr);};let f=x.state.fellows[0],other=x.state.fellows[1];f.favor=0;const uid=f.uid;x.state.inv.pill.pill_juqi=101;
 for(let i=1;i<50;i++){const r=F.sendGift(uid,'pill','pill_juqi');ok(r.ok&&r.returnLingShi===0,'no return before50');}
 eq(f.giftsReceived,49,'49 gifts counted');eq(other.giftsReceived||0,0,'per-NPC counter');const prev=x.state.res.lingShi,r=F.sendGift(uid,'pill','pill_juqi');eq(r.returnLingShi,600,'50th guaranteed ten percent batch value');eq(x.state.res.lingShi,prev+600,'return paid once');eq(x.state.fellowGiftLedger.batchValue,0,'global batch cleared');
 ok(F.sendGift(uid,'pill','pill_juqi').returnLingShi===0,'51st no duplicate return');x.save.save();x.save.load();f=x.state.fellows.find(f=>f.uid===uid);eq(f.giftsReceived,51,'gifts saved');
 for(let i=52;i<=100;i++)F.sendGift(uid,'pill','pill_juqi');eq(f.giftsReceived,100,'100th count');eq(x.state.res.lingShi,prev+1200,'100th second return');
 const count=f.giftsReceived;ok(!F.sendGift(uid,'pill','missing').ok,'missing gift rejected');eq(f.giftsReceived,count,'failed gift not counted');
 const def=x.data.gongfa.list.find(g=>!g.hidden),id=def.id;x.state.gongfa.frag[id]=2;x.state.inv.frag[id]=1;
 for(let i=0;i<3;i++)ok(F.sendGift(uid,'frag',id).ok,'fragment gift from either bag');ok(!F.giftItems().some(it=>it.kind==='frag'&&it.id===id),'fragment bags depleted');ok(!F.sendGift(uid,'frag',id).ok,'no negative fragments');
 const base=x.data.equips.bases.find(b=>!b.hidden),eqp=x.sys.forge.createEquip(base.id,base.grade);x.state.equips.slots[eqp.slot]=eqp.uid;
 ok(!F.sendGift(uid,'equip',eqp.uid).ok,'worn equip refused');x.state.equips.slots[eqp.slot]=null;ok(F.sendGift(uid,'equip',eqp.uid).ok,'bag equip gift');ok(!x.sys.forge.getEquip(eqp.uid),'equipment actually removed');ok(!F.sendGift(uid,'equip',eqp.uid).ok,'no duplicate gift');
}
{
 const {x}=game();fighter(x);let power=2000;x.stats.get=()=>({power:power,marketDiscPct:0});
 let a=x.balance.marketProfile();power=20000;let b=x.balance.marketProfile();ok(b.tier>a.tier&&b.priceMult>a.priceMult,'power increases quality and price');ok(b.pillGrade>=a.pillGrade&&b.equipGrade>=a.equipGrade,'power grade monotonic');x.state.player.realmIdx=4;let c=x.balance.marketProfile();ok(c.tier>b.tier&&c.priceMult>b.priceMult,'realm independently increases quality price');
 const g=game(),G=g.x;fighter(G);G.state.res.lingYu=1000;
 const kinds=['pill','mat','equip','frag','egg','recipe'];
 for(const kind of kinds){const weighted=G.util.weighted;G.util.weighted=function(arr,k){return arr.find(it=>it.k===kind)||arr.find(it=>it.k==='lingShi')||weighted.call(this,arr,k);};
   G.balance.daily().marketRefreshes=0;ok(G.sys.fellows.refreshMarket().ok,'generate '+kind);const m=G.sys.fellows.market();eq(m.slots.length,6,'six slots '+kind);ok(m.slots.every(s=>Number.isFinite(s.price)&&s.price>=1),'finite prices '+kind);G.util.weighted=weighted;
 }
}
console.log('PASS',n,'v1.9.1 feature checks');
