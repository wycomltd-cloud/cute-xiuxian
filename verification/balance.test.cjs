const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');let checks=0;
function ok(v,msg){assert.ok(v,msg);checks++;}
function near(a,b,msg){ok(Math.abs(a-b)<Math.max(.001,Math.abs(b)*1e-8),msg+': '+a+' / '+b);}
function game(){
 let now=new Date(2026,9,31,10).getTime(),seed=17,errors=[],storage=new Map();
 class Clock extends Date {constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
 const math=Object.create(Math);math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
 const c={console:{log(){},warn(){},error(...v){errors.push(v.join(' '));}},Date:Clock,Math:math,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')};c.window=c;vm.createContext(c);
 const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^?]+)\?/g)].map(x=>x[1]).filter(p=>!p.startsWith('js/ui/')&&p!=='js/main.js');
 for(const p of files)vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),c,{filename:p});
 const x=c.XG;x.ui={toast(){},pop(){}};for(const id of x.sysOrder)if(x.sys[id].init)x.sys[id].init();ok(!errors.length,'initialization: '+errors.join(';'));
 return {x,setNow:n=>now=n,advance:s=>now+=s*1000,now:()=>now,errors,c};
}
{
 const {x}=game(),B=x.balance;let pairs=0;
 for(const r of x.data.pills.recipes)for(const mult of [.01,.4725,.7,1,1.56,3])for(const cur of ['lingShi','lingYu']){const price=B.marketPrice({kind:'pill',id:r.id,price:200*r.grade,grade:r.grade},mult,cur);ok(price*(cur==='lingYu'?500:1)>=Math.ceil(B.pillSale(r)*1.5),'pill arbitrage '+r.id);pairs++;}
 for(let grade=0;grade<=4;grade++)for(const mult of [.01,.4725,.7,1,1.56])for(const cur of ['lingShi','lingYu']){const price=B.marketPrice({kind:'equip',price:800,grade},mult,cur);ok(price*(cur==='lingYu'?500:1)>Math.floor(B.equipYu(grade)*.6)*500,'equipment arbitrage');pairs++;}
 console.log('price combinations:',pairs);
}
{
 const g=game(),{x}=g;x.state.player.realmIdx=3;x.state.player.layer=5;x.state.res.lingShi=1e8;x.sys.fellows.market();const r=x.data.pills.recipes.find(r=>r.id==='pill_taiyi');
 function offer(){x.state.fellowMarket.slots=[{sid:'offer',kind:'pill',id:r.id,name:r.name,n:10,cur:'lingShi',price:x.balance.marketPrice({kind:'pill',id:r.id,price:800},1,'lingShi')}];}
 offer();const start=x.state.res.lingShi;ok(x.sys.fellows.buyMarket('offer').ok,'buy');ok(x.sys.alchemy.sellPill(r.id).ok,'sell');ok(x.state.res.lingShi<start,'trade loses money');ok(x.sys.fellows.buyMarket('offer').ok,'buy2');ok(x.sys.fellows.buyMarket('offer').ok,'buy3');let cash=x.state.res.lingShi;ok(!x.sys.fellows.buyMarket('offer').ok,'buy4 denied');near(x.state.res.lingShi,cash,'denial no cost');offer();ok(!x.sys.fellows.buyMarket('offer').ok,'refresh no reset');
 x.save.save();const saved=JSON.stringify(x.state.balanceDaily);x.state.balanceDaily=null;ok(x.save.load(),'load');ok(JSON.stringify(x.state.balanceDaily)===saved,'saved quota');g.advance(86400);x.sys.fellows.market();offer();ok(x.sys.fellows.buyMarket('offer').ok,'tomorrow reset');x.state.res.lingShi=0;ok(!x.sys.fellows.buyMarket('offer').ok,'insufficient funds');
}
{
 const {x,advance}=game(),A=x.sys.alchemy,B=x.balance,r=x.data.pills.recipes.find(r=>r.id==='pill_ningyuan');x.state.inv.pill[r.id]=8;x.state.inv.pill[r.id+'_star']=2;ok(!A.usePill(r.id).ok,'realm gate');near(x.state.inv.pill[r.id],8,'not consumed');ok(!A.pillInfo(r.id).usable,'UI realm gate');x.state.player.realmIdx=1;
 for(const [id,factor] of [[r.id,1],[r.id+'_star',1.5],[r.id,.5],[r.id,.5],[r.id,.1]]){const before=x.state.player.cult;ok(A.usePill(id).ok,'consume');near(x.state.player.cult-before,Math.floor(r.eff.val*factor),'dose multiplier');}
 ok(A.pillInfo(r.id).effText.includes('藥效10%'),'preview effect');const n=B.daily().pills;A.sellPill(r.id);near(B.daily().pills,n,'sale no dose');advance(86400);near(B.daily().pills,0,'daily dose reset');x.state.player.toxicity=0;const count=x.state.inv.pill[r.id];const used=A.useAll(r.id);ok(used.ok&&used.n===count,'bulk uses same rules');
}
{
 const {x,advance}=game();x.state.player.realmIdx=1;x.state.player.layer=3;const fs=x.state.fellows.slice(0,11);fs.forEach(f=>{f.realmIdx=8;f.alive=true;});const gains=fs.map(f=>x.sys.fellows.discuss(f.uid).cult),rate=x.balance.standardRate();
 for(let i=0;i<5;i++)ok(gains[i]>=rate*600*1.2-1&&gains[i]<=rate*1200*1.2,'discuss bound');for(let i=5;i<10;i++)ok(gains[i]>=rate*600*1.2*.3-1&&gains[i]<=rate*1200*1.2*.3,'reduced discuss');near(gains[10],0,'eleventh no cult');const favor=fs[10].favor;advance(600);ok(x.sys.fellows.discuss(fs[10].uid).ok,'social allowed');ok(fs[10].favor>favor,'favor rises');near(x.sys.fellows.discussAll().cult,0,'bulk no cap bypass');
}
{
 const g=game(),{x}=g,C=x.sys.cultivation,r=x.stats.get().cultRate;near(C.tuona().gain,r*5,'tap5s');ok(!C.tuona().ok,'cooldown');g.advance(2.9);ok(!C.tuona().ok,'cooldown2.9');g.advance(.1);ok(C.tuona().ok,'cooldown3');x.balance.daily().taps=99;g.advance(3);near(C.tuona().gain,r*5,'100th full');g.advance(3);near(C.tuona().gain,r*.5,'101st reduced');const rate=x.balance.standardRate();near(x.balance.activityCult(rate*20000),Math.floor(rate*14400),'4h cap');near(x.balance.activityCult(rate*60),0,'cult overflow');near(x.balance.activityJade(100),20,'jade20');near(x.balance.activityJade(2),0,'jade overflow');g.advance(86400);near(x.balance.daily().taps,0,'tap reset');near(x.balance.activityJade(2),2,'jade reset');
}
{
 const g=game(),{x}=g,P=x.sys.pvp;x.state.player.realmIdx=2;x.state.player.layer=5;x.state.player.gender='male';x.state.player.school='jian';x.state.pvp.pts=2500;x.state.pvp.pending=[{season:'C-old',tierName:'仙尊',lingYu:5,frags:{},t:g.now()}];near(P.claimSeason().lingYu,5,'old pending');ok(!P.claimSeason().ok,'no double claim');g.advance(600);P.tick(600);near(P.getOverview().pending.length,0,'no10min');g.advance(86400);P.tick(1);near(P.getOverview().pending.length,1,'daily award');near(P.claimSeason().lingYu,12,'xianzun12');ok(!P.claimSeason().ok,'once per day');
}
{
 const {x}=game();x.state.res={lingShi:123456789,lingYu:999};x.state.player.realmIdx=4;x.state.player.gender='female';x.state.player.school='zhen';x.state.inv.pill.pill_jiuzhuan=42;x.state.fellowMarket={at:Date.now(),slots:[{sid:'old-cheap',price:1}]};const before=JSON.stringify({res:x.state.res,inv:x.state.inv,player:x.state.player});x.save.save();x.state=x.newState();x.save.load();x.sys.fellows.market();ok(!x.state.fellowMarket.slots.some(s=>s.sid==='old-cheap'),'old offers removed');ok(JSON.stringify({res:x.state.res,inv:x.state.inv,player:x.state.player})===before,'old save wealth inventory identity preserved');
}
{
 const {x}=game();x.state.pets.list=[{uid:'test',sp:'pet_shigui',persona:'none',skills:[]}];for(let idx=0;idx<5;idx++){x.state.player.realmIdx=idx;x.stats.invalidate();near(x.sys.pets.ratesFor('test').explore.lingShiPerH,x.balance.exploreHourly[idx],'pet hourly');}for(let idx=0;idx<9;idx++){let secs=0;for(let l=1;l<=10;l++)secs+=x.cfg.layerCost(idx,l)/(x.cfg.REALMS[idx].rate*(1+.12*(l-1))*1.49);near(secs/3600,x.balance.targetHours[idx],'stage hours');}
}
console.log('PASS',checks,'checks');module.exports={game};
