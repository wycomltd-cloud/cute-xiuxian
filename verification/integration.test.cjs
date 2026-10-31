const {game}=require('./balance.test.cjs'),assert=require('assert/strict');let count=0;
function ok(v,s){assert.ok(v,s);count++;}function eq(a,b,s){ok(Math.abs(a-b)<.001,s+': '+a+' / '+b);}
{
 const g=game(),{x}=g,B=x.balance;x.state.player.realmIdx=2;const limit=B.activityStoneLimit();eq(limit,36000,'gold daily money budget');eq(B.activityStone(9000),9000,'partial claim');x.state.player.realmIdx=3;eq(B.activityStoneRemaining(),72000,'realm increase retains used fraction');eq(B.activityStone(1e9),72000,'new realm cap');eq(B.activityStone(100),0,'no overflow');g.advance(86400);eq(B.activityStoneRemaining(),96000,'midnight new cap');
}
{
 const g=game(),{x}=g;x.state.player.realmIdx=2;x.state.player.layer=5;x.state.player.cultivateMode='biguan';x.state.dungeon.towerBest=51;x.state.res.lingShi=0;x.stats.invalidate();
 const D=x.sys.dungeon,expect=D.sweepInfo().est,before=x.state.player.cult,r=D.quickSweep();ok(r.ok,'sweep works');eq(r.gains.lingShi,expect.lingShi,'stone estimate actual');eq(r.gains.cult,expect.cult,'cult estimate actual');eq(x.state.res.lingShi,r.gains.lingShi,'credited stone actual');eq(x.state.player.cult-before,r.gains.cult,'credited cult actual');
 const cash=x.state.res.lingShi,cult=x.state.player.cult;for(let i=0;i<3;i++)ok(D.quickSweep().ok,'repeat sweep still playable');eq(x.state.res.lingShi,cash,'repeat stone exhausted');eq(x.state.player.cult,cult,'repeat cult exhausted');eq(D.sweepInfo().est.cult,0,'preview no phantom cult');eq(D.sweepInfo().est.lingShi,0,'preview no phantom stone');
}
{
 const {x,c}=game();x.state.player.realmIdx=7;x.state.player.layer=10;x.state.player.gender='female';x.state.player.school='zhen';x.state.res.lingYu=1000;
 const budget=x.balance.daily();Object.assign(budget,{pills:5,taps:100,discuss:12,activitySec:14400,activityYu:20,activityStoneFraction:1,purchases:{pill_taiyi:3}});
 x.state.pvp.pending=[{season:'D-old',lingYu:5,frags:{},t:1}];const season=x.state.pvp.season;c.Math.random=()=>0;x.stats.invalidate();const r=x.sys.reincarn.startChallenge([]);ok(r.ok&&r.success,'successful reincarnation');eq(x.state.player.realmIdx,0,'realm reset expected');ok(x.state.player.gender===null&&x.state.player.school===null,'gender school reselect expected');ok(x.state.balanceDaily===budget,'daily budgets retained');eq(x.balance.daily().pills,5,'pill counter retained');eq(x.balance.daily().purchases.pill_taiyi,3,'shop quota retained');eq(x.balance.daily().activityYu,20,'jade limit retained');ok(x.state.pvp.season===season,'daily settlement retained');eq(x.state.pvp.pending.length,1,'pending rewards retained');x.sys.pvp.tick(1);eq(x.state.pvp.pending.length,1,'no same-day repeated settlement');
}
{
 const g=game(),{x}=g;x.state.player.realmIdx=1;x.state.player.layer=2;x.state.player.cultivateMode='biguan';x.state.pets.list=[{uid:'pet',sp:'pet_shigui',persona:'none',skills:[],lv:1,exp:0}];x.state.pets.jobs={pet:'explore'};x.stats.invalidate();const before=x.state.player.cult;const r=x.sys.cultivation.offline(3600);ok(r.cultGain>0&&x.state.player.cult>before,'offline cultivation unchanged');x.sys.pets.offline(3600);eq(x.sys.pets.pending().lingShi,1000,'offline work new rate');ok(x.balance.daily().activitySec===0,'offline cultivation does not spend activity cap');eq(x.balance.daily().activityStoneFraction||0,0,'pet work does not spend activity cap');
}
console.log('PASS',count,'additional integration checks');
