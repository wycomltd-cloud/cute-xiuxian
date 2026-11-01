const {game}=require('./game-harness.cjs'),assert=require('assert/strict');let count=0;
const ok=(v,s)=>{assert.ok(v,s);count++},near=(a,b,s)=>ok(Math.abs(a-b)<Math.max(.001,Math.abs(b)*1e-8),s+': '+a+' / '+b);
function ready(x){Object.assign(x.state.player,{gender:'female',school:'dan',realmIdx:2,layer:5,cult:0,toxicity:0});x.stats.invalidate();}
for(const oldRank of [0,1,2]){
 const {x}=game();ready(x);x.state.player.realmIdx=5;x.state.res={lingShi:10001,lingYu:123};
 x.sys.sect.choose('sect');Object.assign(x.state.sect,{rank:oldRank,merit:333,credit:55,paySec:7200,payCult:999,payReady:[{cult:1234,realm:2,source:'職位俸祿'}],pills:[{cult:100,n:3,source:'宗門修行丹',realm:2}]});delete x.state.sect.rankSchema;
 const a=x.sys.sect.info();ok(a.rank===[0,1,3][oldRank],'legacy title mapped');ok(a.rankInfo.name===['門人','執事','長老'][oldRank],'title preserved');
 ok(a.merit===333&&a.credit===55&&a.paySec===7200&&a.payCult===999,'progress preserved');ok(a.pills[0].n===3&&a.payReady[0].cult===1234,'pills preserved');
 x.save.save();x.state=x.newState();x.save.load();ok(x.sys.sect.info().rank===[0,1,3][oldRank],'mapping idempotent after load');ok(x.state.res.lingShi===10001&&x.state.res.lingYu===123,'wealth preserved');
}
{
 const {x}=game();ready(x);const A=x.sys.sect;A.choose('sect');ok(A.ranks.map(r=>r.name).join('/')==='門人/執事/宗主/長老/老祖','five titles in requested order');
 for(let i=1;i<5;i++){
  const r=A.ranks[i];x.state.player.realmIdx=r.realm-1;x.state.sect.merit=r.merit;x.state.sect.joinedSec=r.age;ok(!A.promote().ok,'realm gate '+r.name);
  x.state.player.realmIdx=r.realm;x.state.sect.merit=r.merit-1;ok(!A.promote().ok,'merit gate '+r.name);x.state.sect.merit=r.merit;x.state.sect.joinedSec=r.age-1;ok(!A.promote().ok,'age gate '+r.name);
  x.state.sect.joinedSec=r.age;ok(A.promote().ok&&A.info().rank===i,'promote '+r.name);
 }
 ok(!A.info().nextRank&&!A.promote().ok,'ancestor final rank');
}
// Same input: scatter gets 25% more active cultivation, no query changes toxicity.
for(const realm of [0,1,2,3,4,5,6,7,8]){
 const {x}=game();ready(x);x.state.player.realmIdx=realm;x.stats.invalidate();const raw=x.balance.standardRate()*3600;
 const scatter=x.balance.activityCult(raw);for(let k=0;k<30;k++)x.balance.activityCult(raw);ok(x.state.player.toxicity===0,'preview no poison');
 if(realm>=2){x.sys.sect.choose('sect');const safe=x.balance.activityCult(raw);ok(scatter>safe,'scatter active reward higher at realm '+realm);near(scatter,Math.floor(x.balance.standardRate()*15*Math.log1p(30)*1.25),'25% formula');ok(x.balance.activityToxicity(scatter)===0,'member no activity poison');}
 else ok(!x.balance.isRiskyWanderer(),'early realm unchanged');
}
{
 const {x}=game();ready(x);x.data.events=[{id:'qa-risks',title:'風險報酬',minRealm:2,choices:[{text:'領取',out:{cult:100000,toxicity:5}}]}];
 const raw=x.balance.activityCult(100000),expected=x.balance.activityToxicity(raw);x.state.adventure.pending={id:'qa-risks'};
 const r=x.sys.adventure.choose(0);ok(r.ok,'actual adventure');near(r.rewards.cult,raw,'adventure actual reward');near(x.state.player.toxicity,expected+5,'risk and explicit poison each once');near(r.rewards.toxicity,x.state.player.toxicity,'reported total poison');
 const before=x.state.player.toxicity;ok(!x.sys.adventure.choose(0).ok,'repeat event blocked');near(x.state.player.toxicity,before,'failed choice no poison');
}
{
 const {x}=game();ready(x);const f=x.state.fellows[0];const r=x.sys.fellows.discuss(f.uid);ok(r.ok&&r.cult>0&&x.state.player.toxicity>0,'actual discuss reward and poison');
 const n=x.state.player.toxicity;ok(!x.sys.fellows.discuss(f.uid).ok,'discuss cooldown');near(x.state.player.toxicity,n,'failed discuss no poison');
 x.state.player.toxicity=0;const p=x.sys.pvp.fight();ok(p.ok&&p.reward.cult>0&&x.state.player.toxicity>0,'actual duel risk');
 x.state.player.toxicity=0;x.state.dungeon.towerBest=11;x.state.res.lingYu=1000;const estimate=x.sys.dungeon.sweepInfo().est;ok(x.state.player.toxicity===0,'sweep preview pure');const sweep=x.sys.dungeon.quickSweep();ok(sweep.ok&&sweep.gains.cult===estimate.cult,'sweep receipt equals preview');ok(x.state.player.toxicity>0,'sweep risk applied');
}
{
 const {x}=game();ready(x);const A=x.sys.sect;A.choose('sect');const t=A.taskInfo();ok(A.resolveTask(0,t.serial).ok,'sect task');ok(A.teach('practice').ok,'sect teach');A.startContest();ok(A.contestFight().ok,'sect fight');ok(x.state.player.toxicity===0,'sect activities no poison');
 x.state.res.lingShi=100000;ok(A.buyPill('lingShi',1).ok,'buy low poison pill');const use=A.usePill(0,false);ok(use.ok,'use low poison pill');near(x.state.player.toxicity,.05,'0.05 per training pill');
 A.offline(14400);A.claimSalary();const before=x.state.player.toxicity,idx=A.info().pills.findIndex(p=>p.source==='職位俸祿');ok(A.usePill(idx,true).ok,'use salary pill');near(x.state.player.toxicity,before,'salary pill no poison');
 x.state.player.toxicity=0;x.state.dungeon.towerBest=11;ok(x.sys.dungeon.quickSweep().ok,'member shared dungeon');ok(x.state.player.toxicity===0,'shared activity no member risk poison');
}
{
 const {x}=game();ready(x);x.state.player.toxicity=49.9;x.stats.invalidate();const normal=x.stats.get().cultRate;x.balance.applyActivityToxicity(x.balance.standardRate()*60);ok(x.state.player.toxicity>50&&x.stats.get().cultRate<normal,'cross50 immediately invalidates stats');
 for(let i=0;i<100;i++)x.balance.applyActivityToxicity(1e9);ok(x.state.player.toxicity===100&&x.state.stats.tox100===1,'poison bounded100 and achievement stat');
 const balance=x.state.player.cult;const more=x.sys.fellows.discuss(x.state.fellows[0].uid);ok(more.ok&&x.state.player.cult>balance,'full poison does not cap reward');
}
{
 const {x}=game();ready(x);x.state.player.toxicity=51;x.stats.invalidate();const toxic=x.stats.get().cultRate,base=x.cfg.REALMS[2].rate*(1+.12*4),rateClean=toxic+base*.2;
 const r=x.sys.cultivation.offline(3600);const expected=toxic*60+rateClean*3540;near(r.cultGain-(r.dunwuProcs||0)*(expected/3600)*30*4,expected,'offline penalty lasts first60sec only');
 x.sys.alchemy.offline(3600);near(x.state.player.toxicity,0,'offline decay');near(x.stats.get().cultRate,rateClean,'offline decay refreshes cache');
}
{
 const {x}=game();ready(x);x.sys.cultivation.tuona();ok(x.state.player.toxicity===0,'manual tuona no new poison');const r=x.sys.cultivation.offline(100);ok(r.cultGain>0&&x.state.player.toxicity===0,'passive no new poison');
}
console.log('PASS',count,'v2.0.1 rank and risk checks');
