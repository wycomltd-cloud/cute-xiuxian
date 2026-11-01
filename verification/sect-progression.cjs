/* Same golden-core start, same passive bonuses, same three-action session budget.
   Measures eligibility for the original reincarnation challenge, not guaranteed success. */
const {game}=require('./game-harness.cjs'),fs=require('fs'),path=require('path');
function simulate(route,logins,seed=17){
 const g=game(),x=g.x;let rng=seed;g.c.Math.random=()=>((rng=(rng*1664525+1013904223)>>>0)/2**32);
 Object.assign(x.state.player,{gender:'female',school:'dan',realmIdx:2,layer:1,cult:0,cultivateMode:'biguan'});
 x.sys.scenarioMods={getMods:()=>({cultRatePct:25})};x.stats.invalidate();x.sys.sect.choose(route);
 const start=g.now(),step=86400/logins;let sessions=0;const milestones={};
 function ascend(){for(let k=0;k<100;k++){if(x.sys.reincarn.canChallenge().ok)return;const r=x.sys.cultivation.tryBreakthrough([]);if(!r.ok)return;}}
 function mark(){const realm=x.state.player.realmIdx;if(!milestones[realm])milestones[realm]=+((g.now()-start)/86400000).toFixed(3);}
 for(let j=0;j<logins*150;j++){
  if(j){g.advance(step);x.sys.cultivation.offline(step);x.sys.alchemy.offline(step);x.sys.sect.offline(step);}
  ascend();mark();if(x.sys.reincarn.canChallenge().ok)break;
  if(route==='sect'){
   const A=x.sys.sect;A.tick(1);const t=A.taskInfo();if(t)A.resolveTask(0,t.serial);A.teach('practice');
   if(x.cfg.isUnlocked('pvp')){A.startContest();for(let i=0;i<3;i++){A.contestFight();g.advance(3);}A.finishContest();}
   A.promote();A.claimSalary();
   let credit=Math.floor(A.info().credit/10);while(credit>0){const n=Math.min(10,credit);A.buyPill('credit',n);credit-=n;}
   let stone=Math.floor(x.state.res.lingShi/A.quote().stone);while(stone>0){const n=Math.min(10,stone);A.buyPill('lingShi',n);stone-=n;}
   A.quickCultivate();
  }else{
   // Standard fellows and one representative adventure (same choice-0 budget as sect task).
   x.sys.fellows.discussAll();const award=x.balance.activityCult(x.balance.standardRate()*3600);x.balance.applyActivityToxicity(award);x.sys.cultivation.addCult(award,'代表性奇遇');
   if(x.cfg.isUnlocked('pvp'))for(let i=0;i<3;i++){x.sys.pvp.fight();g.advance(3);}
  }
  // Equal short manual interaction allowance.
  for(let i=0;i<5;i++){g.advance(3);x.sys.cultivation.tuona();}
  sessions++;ascend();mark();if(x.sys.reincarn.canChallenge().ok)break;
 }
 return {route,logins,seed,days:+((g.now()-start)/86400000).toFixed(3),eligible:x.sys.reincarn.canChallenge().ok,sessions,milestones};
}
const results=[];
for(const n of [2,6,24]){const scatter=[],sect=[];for(const seed of Array.from({length:20},(_,i)=>17+i*97)){scatter.push(simulate('wanderer',n,seed));sect.push(simulate('sect',n,seed));}
 const avg=a=>a.reduce((s,r)=>s+r.days,0)/a.length;const a=avg(scatter),b=avg(sect);results.push({loginsPerDay:n,wandererMeanDays:+a.toFixed(3),sectMeanDays:+b.toFixed(3),differencePct:+((b-a)/a*100).toFixed(2),allReached:[...scatter,...sect].every(r=>r.eligible),samples:{scatter,sect}});}
const report={version:'2.0.1',target:'同等登入頻率與操作步驟，從金丹一層到大乘十層輪回挑戰資格，比較新散修高收益／丹毒與五職位宗門的成長節奏',assumptions:['每次登入：散修論道全體＋一次代表性奇遇＋3場鬥法；宗門一件親自事務＋一堂實修授業＋3場大比','兩路同為閉關、固定25%永久加成、每次5次吐納；無額外初始資產、無免費注入丹藥或貨幣','宗門將活動所得靈石與可用貢獻購成自用丹，按實際職位領丹與晉升；未用靈玉購丹','未模擬共同的靈寵、坊市購買、功法裝備、所有隨機奇遇及遊戲經濟；單次操作數相同，不代表實際秒數完全一致','每種登入頻率20個固定種子，運行真實突破／渡劫；終點是可挑戰輪回，未保證九劫成功'],results};
fs.writeFileSync(path.join(__dirname,'sect-progression-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(results.map(({samples,...r})=>r),null,2));
if(results.some(r=>!r.allReached||Math.abs(r.differencePct)>5))process.exitCode=1;
