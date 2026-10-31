const {game}=require('./game-harness.cjs'),assert=require('assert/strict');let n=0;
function ok(v,msg){assert.ok(v,msg);n++;}function eq(a,b,msg){ok(Math.abs(a-b)<.001,msg+': '+a+' != '+b);}
{
 const {x}=game(),A=x.sys.alchemy;
 for(const r of x.data.pills.recipes)for(const suffix of ['', '_star'])for(const paidStone of [0,10,100000000]) {
  const id=r.id+suffix;x.state.inv.pill[id]=1;x.state.marketPillLots=x.state.marketPillLots||{};x.state.marketPillLots[id]=[{n:1,paidStone}];
  const expected=Math.floor((r.cost.lingShi||0)*.6),before=x.state.res.lingShi;
  eq(A.saleInfo(id).price,expected,'pill fixed 60% '+id+' paid '+paidStone);
  const result=A.sellPill(id);ok(result.ok,'sale succeeds');eq(x.state.res.lingShi-before,expected,'actual fixed payout');eq(x.state.inv.pill[id]||0,0,'deducted once');ok(!A.sellPill(id).ok,'repeat refused');
 }
}
{
 const {x}=game(),F=x.sys.forge,b=x.data.equips.bases.find(b=>!b.hidden);
 for(let grade=0;grade<=4;grade++)for(const paidStone of [0,1,100,100000000]) {
  const eqp=F.createEquip(b.id,grade);eqp.marketPaidStone=paidStone;const expected=Math.floor(x.balance.equipYu(grade)*.6),before=x.state.res.lingYu;
  eq(F.disposalInfo(eqp.uid).lingYu,expected,'equipment fixed basis');ok(F.sell(eqp.uid).ok,'equipment sale succeeds');eq(x.state.res.lingYu-before,expected,'equipment actual payout');ok(!F.sell(eqp.uid).ok,'equipment repeated sale denied');
 }
}
{
 const g=game(),{x}=g;Object.assign(x.state.player,{realmIdx:2,layer:5,gender:'male',school:'jian'});x.state.res.lingYu=1000;x.stats.invalidate();const F=x.sys.fellows;
 for(let i=0;i<5;i++){const r=F.refreshMarket();ok(r.ok,'refresh works');ok(!r.msg.includes('加')&&!r.msg.includes('%'),'refresh result concise');eq(F.market().refreshUsed,i+1,'refresh limit still counted');}
 ok(!F.refreshMarket().ok,'sixth still blocked');
}
console.log('PASS',n,'v1.9.3 sale checks');
