const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const {game}=require('./game-harness.cjs');let checks=0;const ok=(v,s)=>{assert.ok(v,s);checks++};const root=path.resolve(__dirname,'..');
const g=game(),x=g.x;vm.runInContext(fs.readFileSync(path.join(root,'js/ui/sect-art.js'),'utf8'),g.c);
const A=x.sectArt;ok(A.ids.length===5,'all five courtyard assets');const original=JSON.stringify(x.state);
for(const school of ['jian','fu','zhen','dan','ti']){
 const art=A.info(school);ok(art&&art.id===school&&fs.existsSync(path.join(root,art.src)),'real asset '+school);
 ok(!A.currentForPlayer(),'no sect art before join');Object.assign(x.state.player,{realmIdx:2,school:school,gender:'male'});x.sys.sect.choose('sect');
 for(const gender of ['male','female'])for(let realm=2;realm<10;realm++){
  Object.assign(x.state.player,{gender:gender,realmIdx:realm});ok(A.currentForPlayer().id===school,'correct court for gender/realm '+school+gender+realm);
 }
 x.state.player.reincarn++;ok(!A.currentForPlayer(),'successful new life removes courtyard');
}
ok(A.info('../../secret')===null&&A.info('__proto__')===null,'unknown paths rejected');
const stateBefore=JSON.stringify(x.state);for(let i=0;i<100;i++){A.info('dan');A.currentForPlayer();}ok(JSON.stringify(x.state)===stateBefore,'art lookup does not change progress');
const pending=[],events=[];const c=A.controller(a=>events.push(a?a.id:null),(src,done,fail)=>pending.push({src,done,fail}));
c.sync('jian');c.sync('jian');ok(pending.length===1,'one in-flight load');pending[0].done();ok(c.current().id==='jian','show loaded court');c.sync('jian');ok(pending.length===1,'reuse loaded court');
c.sync('fu');ok(!c.current(),'old court cleared on school change');c.sync(null);pending[1].done();ok(!c.current(),'late load cannot restore court after leaving');
c.sync('zhen');c.sync('dan');pending[2].done();ok(!c.current(),'old school cannot overwrite new school');pending[3].done();ok(c.current().id==='dan','current school finishes');
c.sync('ti');pending[4].fail();ok(!c.current(),'failed court falls back to hero');c.sync('ti');ok(pending.length===5,'no immediate retry loop');g.advance(16);c.sync('ti');ok(pending.length===6,'retry after15sec');pending[5].done();ok(c.current().id==='ti','retry restored correct court');
c.sync('jian');c.stop();pending[6].done();ok(!c.current(),'unmount cancels late load');c.sync('fu');ok(pending.length===7,'stopped controller stays inactive');
// Photo builds its art solely from explicit captured arguments, rather than reading membership later.
const photo=fs.readFileSync(path.join(root,'js/ui/scene-photo.js'),'utf8');ok(photo.includes('XG.sectArt.info(photo.sect)')&&!photo.includes('currentForPlayer'),'photo scene snapshot is explicit');
const scene=fs.readFileSync(path.join(root,'js/ui/scene.js'),'utf8');ok(scene.includes('sect: scene.dataset.sect||null'),'camera gets displayed court');ok(scene.includes('sectController.stop()'),'unmount cancellation wired');
console.log('PASS',checks,'v2.0.2 courtyard checks');
