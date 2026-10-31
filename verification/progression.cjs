const {game}=require('./game-harness.cjs');
function simulate(label,logins,bonus,pillsPerDay,taps){
 const g=game(),{x}=g;x.state.player.gender='male';x.state.player.school='jian';x.state.player.cultivateMode='biguan';
 x.sys.simulatedPermanent={getMods:()=>({cultRatePct:bonus})};x.stats.invalidate();
 const start=g.now(),step=86400/logins;let sessions=0,lastDay='';
 for(let i=0;i<logins*30;i++){
  const elapsed=i?step:0;g.advance(elapsed);x.stats.invalidate();if(elapsed)x.sys.cultivation.offline(elapsed);
  function ascend(){for(let k=0;k<100;k++){if(x.state.player.realmIdx>=4)return;const r=x.sys.cultivation.tryBreakthrough([]);if(!r.ok)return;}}
  ascend();if(x.state.player.realmIdx>=4)break;
  // This model assumes each login uses available activities and an acquired same-realm pill supply.
  // Each session: all currently available fellows, one representative adventure,
  // and a short series of manual taps. This is a scenario, not a completion promise.
  x.sys.fellows.discussAll();
  x.sys.cultivation.addCult(x.balance.activityCult(x.balance.standardRate()*3600),'模擬單次奇遇');
  for(let j=0;j<taps;j++){g.advance(3);x.sys.cultivation.tuona();}
  const day=x.balance.dayKey();if(day!==lastDay){lastDay=day;for(let j=0;j<pillsPerDay;j++){
   const r=x.data.pills.recipes.find(r=>x.balance.instantPill(r)&&x.balance.pillRealm(r)===x.state.player.realmIdx);if(r){x.state.inv.pill[r.id]=(x.state.inv.pill[r.id]||0)+1;x.sys.alchemy.usePill(r.id);}
  }}
  sessions++;ascend();if(x.state.player.realmIdx>=4)break;
 }
 return {label,loginsPerDay:logins,assumedPermanentCultPct:bonus,assumedSameRealmPillsPerDay:pillsPerDay,daysToHuashen:+((g.now()-start)/86400000).toFixed(2),realm:x.state.player.realmIdx,sessions};
}
const scenarios=[simulate('每日登入兩次',2,10,1,20),simulate('一般活躍',6,25,1,20),simulate('頻繁登入',24,40,2,5)];
const results={assumptions:['每次登入與所有可論道道友論道一次、領一次代表性奇遇、少量吐納','閉關收益及假設永久修練加成；丹藥假設已取得，未模擬購買或煉製成本','即時嘗試突破；包含既有成功率與渡劫；未模擬裝備、功法、靈寵、全部活動或真實經濟','僅用於比較登入頻率，並非保證到達時間'],scenarios};console.log(JSON.stringify(results,null,2));require('fs').writeFileSync(require('path').join(__dirname,'progression-results.json'),JSON.stringify(results,null,2));
