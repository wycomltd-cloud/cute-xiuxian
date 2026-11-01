const {game}=require('./game-harness.cjs'),assert=require('assert/strict');let count=0;
const ok=(v,s)=>{assert.ok(v,s);count++},eq=(a,b,s)=>{assert.equal(a,b,s);count++};
function join(){const g=game(),x=g.x;Object.assign(x.state.player,{gender:'female',school:'dan',realmIdx:2,layer:5});x.stats.invalidate();ok(x.sys.sect.choose('sect').ok,'join');return {...g,A:x.sys.sect};}
function counts(A){const i=A.info();return [i.taskPending,i.teachPending];}
function same(a,b,msg){eq(JSON.stringify(a),JSON.stringify(b),msg);}
{
 const g=join(),{x,A}=g;same(counts(A),[1,1],'initial opportunities kept');const serial=A.taskInfo().serial;
 ok(A.resolveTask(0,serial).ok,'initial task');ok(A.teach('practice').ok,'initial class');same(counts(A),[0,0],'consumed');
 const wealth=JSON.stringify(x.state.res),cult=x.state.player.cult;g.advance(3600);A.tick(1);same(counts(A),[30,6],'one hour online by fixed timestamps');eq(JSON.stringify(x.state.res),wealth,'accrual does not issue resources');eq(x.state.player.cult,cult,'accrual does not issue cultivation');
 for(let k=0;k<20;k++){A.info();A.taskInfo();A.tick(1);A.offline(3600);}same(counts(A),[30,6],'same timestamp queries/offline/tick do not duplicate');
 const next=[A.info().taskNextAt,A.info().teachNextAt];const old=A.taskInfo().serial;ok(A.resolveTask(0,old).ok,'backlog task1');const paid=x.state.res.lingShi;
 ok(!A.resolveTask(0,old).ok,'stale serial cannot consume another item');eq(x.state.res.lingShi,paid,'stale action no payout');same(counts(A),[29,6],'stale action no lost pending');
 ok(A.resolveTask(1,A.taskInfo().serial).ok,'backlog task2 immediately');ok(A.teach('mentor').ok&&A.teach('practice').ok,'two classes immediately');same(counts(A),[28,4],'consume exactly one per click');same([A.info().taskNextAt,A.info().teachNextAt],next,'claims do not restart generation clocks');
 const c=counts(A);ok(!A.teach('invalid').ok,'bad style rejected');ok(!A.resolveTask(-1,A.taskInfo().serial).ok,'bad task choice rejected');same(counts(A),c,'invalid choices do not spend pending');
 x.save.save();const frozen=JSON.stringify([counts(A),A.info().taskNextAt,A.info().teachNextAt,A.taskInfo()]);x.state=x.newState();ok(x.save.load(),'reload');A.init();eq(JSON.stringify([counts(A),A.info().taskNextAt,A.info().teachNextAt,A.taskInfo()]),frozen,'reload preserves exact pending and current story');
 const time=g.now();g.setNow(time-30000);same(counts(A),c,'clock rollback no duplicate');g.setNow(time);same(counts(A),c,'clock recovery no duplicate');
}
{
 const g=join(),{A}=g;g.advance(3600);same(counts(A),[31,7],'unclaimed work never stops accumulation');g.advance(120);same(counts(A),[32,7],'continues while backlog exists');
}
{
 const g=join(),{x,A}=g;x.save.save();g.advance(72*3600);const report=x.offline.settle();same(counts(A),[2161,433],'72h offline pending not capped at48h');eq(report.dt,48*3600,'existing passive offline cap unchanged');eq(A.info().payReady.length,12,'salary keeps existing48h behavior');
 x.offline.settle();same(counts(A),[2161,433],'offline settlement idempotent');
 const at=g.now();x.save.save();g.advance(5*86400);x.state=x.newState();x.save.load();A.init();same(counts(A),[5761,1153],'reload catches five more days without item-array growth');ok(A.info().task&&A.info().taskSerial<5,'one displayed story, numeric backlog');eq(A.info().taskNextAt,at+5*86400000+120000,'generation anchor advanced exactly');
}
for(const kind of ['pending','cooldown','future']){
 const g=game(),x=g.x;Object.assign(x.state.player,{gender:'male',school:'jian',realmIdx:5,layer:1});x.sys.sect.choose('sect');const A=x.sys.sect,s=x.state.sect,base=g.now();
 for(const k of ['workSchema','workStarted','taskPending','teachPending','taskNextAt','teachNextAt','taskResumeMs','teachResumeMs'])delete s[k];
 s.task=kind==='pending'?{serial:77,kind:1}:null;s.taskSerial=77;s.taskAt=kind==='future'?base+3660000:base+60000;s.taughtAt=kind==='pending'?base-1:kind==='future'?base+3900000:base+300000;
 x.state.lastSeen=base;x.state.res={lingShi:12345,lingYu:123};g.advance(3600);
 same(counts(A),kind==='pending'?[31,7]:kind==='cooldown'?[30,6]:[0,0],'legacy conversion '+kind);if(kind==='pending')eq(A.taskInfo().serial,77,'legacy story retained');
 const snapshot=JSON.stringify([counts(A),A.info().taskNextAt,A.info().teachNextAt]);x.save.save();x.state=x.newState();x.save.load();A.init();eq(JSON.stringify([counts(A),A.info().taskNextAt,A.info().teachNextAt]),snapshot,'legacy migration once '+kind);eq(x.state.res.lingShi,12345,'legacy money unchanged');
}
{
 const g=join(),{A,x}=g;g.advance(86400+37);const prior=counts(A);ok(A.leave().ok,'leave after24h');const timers=[x.state.sect.taskResumeMs,x.state.sect.teachResumeMs];g.advance(48*3600);A.offline(48*3600);same(counts(A),prior,'outside sect no new work');
 ok(A.choose('sect').ok,'rejoin after rest');same(counts(A),prior,'rejoin no gift or lost pending');same([A.info().taskNextAt-g.now(),A.info().teachNextAt-g.now()],timers,'partial interval resumes');
 x.state.player.reincarn++;x.bus.emit('reincarn:done',{});same(counts(A),[0,0],'reincarnation clears backlog');ok(!A.info().workStarted&&!A.active(),'new life no inherited timers');
}
{
 const g=game(),x=g.x;Object.assign(x.state.player,{gender:'male',school:'fu',realmIdx:2,layer:1});const uid=x.state.fellows[0].uid;x.sys.fellows.discuss(uid);const wait=x.state.daily.discussAt[uid];x.sys.sect.choose('sect');eq(x.sys.sect.info().teachPending,0,'recent discussion does not immediately grant new class');g.setNow(wait);eq(x.sys.sect.info().teachPending,1,'initial shared discussion cooldown retained');
}
{
 const g=join(),{A}=g;A.resolveTask(0,A.taskInfo().serial);A.teach('practice');g.advance(119.999);same(counts(A),[0,0],'just before first task');g.advance(.001);same(counts(A),[1,0],'exact120 seconds');A.resolveTask(0,A.taskInfo().serial);g.advance(480);same(counts(A),[4,1],'exact600 seconds including repeated task intervals');
}
console.log('PASS',count,'v2.0.3 queued work checks');
