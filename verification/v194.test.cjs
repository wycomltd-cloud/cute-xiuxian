const {game}=require('./game-harness.cjs'),assert=require('assert/strict');let count=0;
function ok(v,msg){assert.ok(v,msg);count++;}function near(a,b,msg){ok(Math.abs(a-b)<Math.max(.001,Math.abs(b)*1e-8),msg+': '+a+' / '+b);}
function ready(x){Object.assign(x.state.player,{realmIdx:2,layer:5,gender:'male',school:'jian',cultivateMode:'biguan'});x.stats.invalidate();}
{
 const {x}=game();ready(x);const B=x.balance,d=B.daily();Object.assign(d,{activitySec:1e12,activityYu:1e12,activityStoneFraction:1,discuss:1e8,pills:1e8,taps:1e8});
 const snapshot=JSON.stringify(d),rate=B.standardRate(),cult=B.activityCult(rate*3600),stone=B.activityStone(100000),jade=B.activityJade(5);
 ok(cult>0&&stone>0&&jade>0,'exhausted old save gets all rewards');let totalC=0,totalS=0,totalJ=0;
 for(let i=0;i<1000;i++){near(B.activityCult(rate*3600),cult,'same cult regardless count');near(B.activityStone(100000),stone,'same stones regardless count');near(B.activityJade(5),jade,'same jade regardless count');totalC+=cult;totalS+=stone;totalJ+=jade;}
 ok(totalC>rate*14400,'cult exceeds old daily cap');ok(totalS>B.exploreHourly[2]*12,'stones exceed old daily cap');ok(totalJ>20,'jade exceeds old daily cap');ok(JSON.stringify(d)===snapshot,'no quota counter is read down or consumed');
 ok(B.activityCult(rate*36000)>cult,'cult smoothly grows without fixed award ceiling');ok(B.activityStone(1000000)>stone,'stone smoothly grows without fixed award ceiling');ok(B.activityJade(1000)>B.activityJade(10),'jade not total-limited');
 for(const n of [0,-1]){near(B.activityCult(n),0,'no free cultivation for zero');near(B.activityStone(n),0,'no free stones for zero');near(B.activityJade(n),0,'no free jade for zero');}
}
{
 const g=game(),{x}=g;ready(x);x.balance.daily().discuss=100000;const F=x.sys.fellows;
 for(let round=0;round<4;round++){
  const before=x.state.player.cult;const r=F.discussAll();ok(r.ok&&r.count===50&&r.cult>0,'every ready NPC pays even after old cap');near(x.state.player.cult-before,r.cult,'actual discuss total');ok(r.cult<=x.balance.standardRate()*4*1.2*50,'smaller each discussion');ok(!F.discuss(x.state.fellows[0].uid).ok,'original per-NPC cooldown kept');g.advance(600);
 }
}
{
 const g=game(),{x}=g;ready(x);const C=x.sys.cultivation,rate=x.stats.get().cultRate;x.balance.daily().taps=100000;
 for(let i=0;i<110;i++){const r=C.tuona();ok(r.ok,'tap after hundreds still works');near(r.gain,rate,'fixed one second reward');g.advance(3);}
 const first=C.tuona();ok(first.ok,'tap after cooldown');ok(!C.tuona().ok,'3 second cooldown kept');
 const A=x.sys.alchemy,r=x.data.pills.recipes.find(r=>r.id==='pill_juqi');x.balance.daily().pills=100000;x.state.inv.pill[r.id]=8;x.state.player.toxicity=0;
 near(r.eff.val,Math.floor(x.balance.stageCost(0)*.01),'pill1% stage');for(let i=0;i<8;i++){const result=A.usePill(r.id);ok(result.ok,'pill remains usable after old daily counter');near(result.actualCult,r.eff.val,'constant smaller pill effect');}
}
{
 const {x}=game();ready(x);const F=x.sys.pvp,uid=x.state.fellows.find(f=>f.persona!=='ouhuang').uid;x.state.daily.pvpDay=x.balance.dayKey();x.state.daily.pvpCount=1000;
 for(let i=0;i<40;i++){const beforeC=x.state.player.cult,beforeS=x.state.res.lingShi,r=F.fight(uid);ok(r.ok&&r.reward&&r.reward.cult>0&&r.reward.lingShi>0,'every match rewarded after five');near(x.state.player.cult-beforeC,r.reward.cult,'cult payout');near(x.state.res.lingShi-beforeS,r.reward.lingShi,'stone payout');ok(r.reward.lingShi<=5,'small per-fight currency');}
 ok(F.getOverview().rewardEveryMatch,'overview always rewarded');
}
{
 const {x}=game();ready(x);x.state.dungeon.towerBest=51;x.state.res.lingYu=1000;Object.assign(x.balance.daily(),{activitySec:1e12,activityStoneFraction:1});const D=x.sys.dungeon;
 for(let i=0;i<40;i++){const expected=D.sweepInfo().est,beforeC=x.state.player.cult,beforeS=x.state.res.lingShi,r=D.quickSweep();ok(r.ok&&r.gains.cult>0&&r.gains.lingShi>0,'every sweep pays past old caps');near(r.gains.cult,expected.cult,'preview exact cult');near(r.gains.lingShi,expected.lingShi,'preview exact stone');near(x.state.player.cult-beforeC,r.gains.cult,'actual sweep cult');near(x.state.res.lingShi-beforeS,r.gains.lingShi,'actual sweep stone');}
}
{
 const {x}=game();ready(x);x.data.events=[{id:'qa-repeat',title:'測試奇遇',minRealm:0,choices:[{text:'領取',out:{cult:1000000,lingShi:10000,lingYu:5}}]}];Object.assign(x.balance.daily(),{activitySec:1e12,activityYu:1e12,activityStoneFraction:1});
 for(let i=0;i<30;i++){x.state.adventure.pending={id:'qa-repeat',via:'qa'};const r=x.sys.adventure.choose(0);ok(r.ok&&r.rewards.cult>0&&r.rewards.lingShi>0&&r.rewards.lingYu>0,'adventure rewards every completion');}
}
{
 const {x}=game();ready(x);x.state.pets.list=[{uid:'test',sp:'pet_shigui',persona:'none',skills:[],lv:1,exp:0}];x.state.pets.jobs={test:'explore'};const P=x.sys.pets;
 near(P.ratesFor('test').explore.lingShiPerH,1800,'reduced gold pet hourly');P.offline(3600);near(P.pending().lingShi,1800,'first offline hour');P.offline(3600);near(P.pending().lingShi,3600,'second offline hour not capped');
 const before=x.state.player.cult;const r=x.sys.cultivation.offline(3600);ok(r.cultGain>0&&x.state.player.cult>before,'passive cultivation kept');
}
{
 const {x}=game();ready(x);x.balance.daily().activitySec=1e12;x.state.res={lingShi:123456,lingYu:5678};const wealth=JSON.stringify(x.state.res);x.save.save();x.state=x.newState();ok(x.save.load(),'old quota save loads');ok(JSON.stringify(x.state.res)===wealth,'old balances preserved');ok(x.balance.activityCult(100000)>0,'loaded old quota ignored');
}
console.log('PASS',count,'v1.9.4 unlimited reward checks');
