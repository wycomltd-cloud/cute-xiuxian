const {game}=require('./game-harness.cjs'),assert=require('assert/strict');let count=0;
const ok=(v,s)=>{assert.ok(v,s);count++},near=(a,b,s)=>ok(Math.abs(a-b)<Math.max(.001,Math.abs(b)*1e-8),s+': '+a+' / '+b);
function ready(x,school='jian'){Object.assign(x.state.player,{gender:'female',school,realmIdx:2,layer:5});x.stats.invalidate();}
for(const school of ['jian','fu','zhen','dan','ti']){
 const g=game(),x=g.x,A=x.sys.sect;ok(!A.eligible(),'pre-gold unavailable');ok(!A.choose('sect').ok,'reject before gold');ready(x,school);
 const before=JSON.stringify([x.state.res,x.state.inv,x.state.player.cult]);ok(A.choose('sect').ok,'join '+school);ok(A.info().school===school,'school locked');ok(JSON.stringify([x.state.res,x.state.inv,x.state.player.cult])===before,'join no free currency/pill reset');
 ok(!A.choose('sect').ok,'duplicate join blocked');ok(!A.leave().ok,'24h minimum');ok(!x.sys.adventure.getPending(),'adventure hidden');ok(!x.sys.adventure.triggerOnMap('m0').ok,'map adventure blocked');
 x.state.adventure.pending={id:x.data.events[0].id};ok(!x.sys.adventure.choose(0).ok,'stale choice blocked');x.sys.adventure.tick(1e6);ok(x.state.adventure.pending.id===x.data.events[0].id,'pending preserved');
 const t=A.taskInfo(),res=x.state.res.lingShi,cult=x.state.player.cult;ok(t&&t.choices.length===2,'school task choices');ok(A.resolveTask(0,t.serial).ok,'resolve task');ok(x.state.player.cult===cult,'task has no direct cultivation');ok(x.state.res.lingShi>res,'task pays real currency');ok(!A.resolveTask(0,t.serial).ok,'same task double claim blocked');
 ok(!A.teach('invalid').ok,'invalid teaching rejected');ok(A.teach('practice').ok,'teach gives reward');ok(!A.teach('practice').ok,'teach cooldown enforced');ok(A.info().merit===7,'merit recorded');
 const f=x.state.fellows[0];x.state.daily.discussAt[f.uid]=0;const oldCult=x.state.player.cult;ok(x.sys.fellows.discuss(f.uid).ok,'social retained');ok(x.state.player.cult===oldCult,'social no duplicate cultivation');
 ok(!x.sys.pvp.fight().ok,'normal duel blocked');ok(A.startContest().ok,'sect contest start');for(let j=0;j<3;j++){const r=A.contestFight();ok(r.ok,'contest round');near(r.battle.opponentPower,r.battle.playerPower,'equal base power');ok(r.battle.reward.cult===0,'contest cultivation paid as currency');if(j<2){ok(!A.contestFight().ok,'contest cooldown');g.advance(3);}}
 ok(!A.contestFight().ok,'no fourth match');const score=JSON.stringify(A.info().contest);x.save.save();x.state=x.newState();ok(x.save.load(),'save load');A.init();ok(JSON.stringify(A.info().contest)===score,'round result preserved');ok(A.finishContest().ok,'finish contest');ok(!A.finishContest().ok,'finish twice denied');
 x.state.res.lingShi=1e9;x.state.res.lingYu=100;const q=A.quote();ok(A.buyPill('lingShi',1).ok,'stone shop');ok(A.buyPill('lingYu',1).count===5,'jade shop');ok(!A.buyPill('lingShi',-1).ok,'negative purchase denied');ok(!A.buyPill('lingShi',1.1).ok,'fractional denied');
 const owned=JSON.stringify(A.info().pills),old=x.state.inv.pill;ok(!Object.keys(old).some(id=>/sect/.test(id)),'sect pills not regular sellable inventory');x.state.player.realmIdx=3;x.stats.invalidate();const p=A.info().pills[0];ok(p.cult===q.cult,'bought pill no realm inflation');
 const oldN=p.n,oldC=x.state.player.cult;const use=A.usePill(0,false);ok(use.ok&&use.cult===p.cult,'consume snapshot efficacy');near(x.state.player.cult-oldC,p.cult,'actual cultivation received');ok(A.info().pills[0].n===oldN-1,'pill deducted');
 x.state.player.toxicity=100;ok(!A.usePill(0,true).ok,'full toxicity blocked');x.state.player.toxicity=0;
 A.offline(14399);ok(A.info().payReady.length===0,'not due');A.offline(1);ok(A.info().payReady.length===1,'4h salary due');ok(A.claimSalary().ok,'claim salary');ok(!A.claimSalary().ok,'no duplicate salary');
 A.offline(48*3600);ok(A.info().payReady.length===12,'48h offline accumulates all cycles');const matured=JSON.stringify(A.info().payReady);x.save.save();x.state=x.newState();x.save.load();ok(JSON.stringify(A.info().payReady)===matured,'salary persists across reload');
 ok(!A.promote().ok,'need merit for promotion');x.state.sect.merit=80;const c0=x.state.sect.credit;ok(A.promote().ok,'promote with all gates');ok(A.info().credit===c0,'promotion does not spend credit');
 const startedCult=x.state.sect.payCult;A.tick(7200);const oldHalf=x.state.sect.payCult;ok(oldHalf>startedCult,'partial earned');x.state.player.realmIdx=5;x.stats.invalidate();x.state.sect.merit=300;x.state.sect.joinedSec=72*3600;ok(A.promote().ok,'sovereign gate');const r2=x.balance.standardRate();A.tick(7200);near(A.info().payReady.at(-1).cult,Math.floor(oldHalf+r2*315/2),'salary change not retroactive');
 g.advance(24*3600);ok(A.leave().ok,'leave after lock');const held=x.state.sect.payReady.length;A.offline(2*86400);ok(x.state.sect.payReady.length===held,'salary stops after leave');ok(!A.choose('sect').ok,'immediate rejoin denied');g.advance(24*3600);ok(A.choose('sect').ok,'rejoin after 24h');ok(A.info().rank===2&&A.info().merit===300,'rejoin preserves earned rank not new bonus');
 x.state.player.reincarn++;// life check independent of UI
 const n=A.info();ok(!n.route&&n.rank===0&&!n.pills.length&&!n.payReady.length,'new life clears route/rank/pills');ok(!g.errors.length,'no system errors');
}
// No offline double accrual via settle, save imports, and compatibility with old exhausted quotas.
{
 const g=game(),x=g.x;ready(x);delete x.state.sect;x.state.res={lingShi:12345,lingYu:321};x.balance.daily().activitySec=1e20;x.save.save();x.state=x.newState();x.save.load();x.sys.sect.init();ok(x.state.res.lingShi===12345&&x.state.res.lingYu===321,'migration preserves assets');ok(x.sys.sect.info().eligible&&!x.sys.sect.info().route,'old gold gets unforced choice');
 x.sys.sect.choose('sect');x.save.save();g.advance(8*3600);x.offline.settle();ok(x.sys.sect.info().payReady.length===2,'offline two cycles');x.offline.settle();ok(x.sys.sect.info().payReady.length===2,'same timestamp no duplicate offline');
}
{
 const {x}=game();ready(x);x.sys.sect.choose('sect');x.sys.sect.offline(14400);x.sys.sect.claimSalary();
 Object.assign(x.state.player,{realmIdx:7,layer:10});x.sys.reincarnTestPower={getMods:()=>({atkFlat:1e15,defFlat:1e15,hpFlat:1e15})};x.stats.invalidate();
 let done=false;for(let j=0;j<200;j++){const r=x.sys.reincarn.startChallenge([]);if(r.success){done=true;break;}}
 ok(done,'actual successful reincarnation');ok(x.state.player.realmIdx===0&&x.state.player.gender===null&&x.state.player.school===null,'new life asks gender/school again');
 const s=x.sys.sect.info();ok(!s.route&&!s.pills.length&&!s.payReady.length&&s.rank===0,'actual reincarnation clears sect life');
}
console.log('PASS',count,'v2.0 sect checks');
