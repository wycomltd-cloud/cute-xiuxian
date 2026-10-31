const {game}=require('./balance.test.cjs');
function simulate(label,logins,bonus,pillsPerDay,taps){
 const g=game(),{x}=g;x.state.player.gender='male';x.state.player.school='jian';x.state.player.cultivateMode='biguan';
 x.sys.simulatedPermanent={getMods:()=>({cultRatePct:bonus})};x.stats.invalidate();
 const start=g.now(),step=86400/logins;let sessions=0,lastDay='';
 for(let i=0;i<logins*30;i++){
  const elapsed=i?step:0;g.advance(elapsed);x.stats.invalidate();if(elapsed)x.sys.cultivation.offline(elapsed);
  function ascend(){for(let k=0;k<100;k++){if(x.state.player.realmIdx>=4)return;const r=x.sys.cultivation.tryBreakthrough([]);if(!r.ok)return;}}
  ascend();if(x.state.player.realmIdx>=4)break;
  // This model assumes each login uses available activities and an acquired same-realm pill supply.
  const d=x.balance.daily();for(let j=0;j<10;j++){
   const used=d.discuss||0,factor=used<5?1:used<10?.3:0;d.discuss=used+1;x.sys.cultivation.addCult(x.balance.standardRate()*900*factor,'模擬論道');
  }
  x.sys.cultivation.addCult(x.balance.activityCult(x.balance.standardRate()*3600),'模擬活動');
  for(let j=0;j<taps&&d.taps<100;j++){g.advance(3);x.sys.cultivation.tuona();}
  const day=x.balance.dayKey();if(day!==lastDay){lastDay=day;for(let j=0;j<pillsPerDay;j++){
   const r=x.data.pills.recipes.find(r=>x.balance.instantPill(r)&&x.balance.pillRealm(r)===x.state.player.realmIdx);if(r){x.state.inv.pill[r.id]=(x.state.inv.pill[r.id]||0)+1;x.sys.alchemy.usePill(r.id);}
  }}
  sessions++;ascend();if(x.state.player.realmIdx>=4)break;
 }
 return {label,loginsPerDay:logins,assumedPermanentCultPct:bonus,assumedSameRealmPillsPerDay:pillsPerDay,daysToHuashen:+((g.now()-start)/86400000).toFixed(2),realm:x.state.player.realmIdx,sessions};
}
const results=[simulate('每日登入兩次',2,10,1,20),simulate('一般活躍',6,25,1,20),simulate('頻繁登入',24,40,2,5)];
console.log(JSON.stringify(results,null,2));require('fs').writeFileSync(require('path').join(__dirname,'progression-results.json'),JSON.stringify(results,null,2));
