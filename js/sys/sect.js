/* v2.0 宗門：獨立成長軌道。幣與丹藥用實際估價換算，沿用修煉及突破引擎。 */
(function () {
  'use strict';
  const XG=window.XG, HOUR=3600, PAY=4*HOUR, SWITCH=24*HOUR, TASK_MS=120000, TEACH_MS=600000;
  const SCHOOLS={
    jian:{name:'青鋒劍宗',icon:'⚔️',place:'聽劍庭',task:'巡山劍鳴',text:'巡山弟子說山門外有劍鳴。查明後，原來是掌門的劍在催他起床。',choices:['親自巡查，順便叫醒掌門','帶弟子排查，教他們別跟劍吵架']},
    fu:{name:'萬符仙院',icon:'📜',place:'流雲符院',task:'符紙集體翹班',text:'庫房的清潔符長出小腳，正在院子裡排隊請假。',choices:['重新校正符紋，批准輪休','教弟子收符，先別把自己貼上去']},
    zhen:{name:'星羅陣宗',icon:'🔮',place:'星羅陣庭',task:'掌門被擋在門外',text:'護山大陣運作正常，唯一問題是把掌門擋在外面了。',choices:['親自排查陣眼，替掌門開門','帶弟子驗證身分，掌門也要刷卡']},
    dan:{name:'百草丹宗',icon:'🫖',place:'百草丹院',task:'丹爐打嗝事件',text:'丹爐每隔三息就打嗝。弟子堅稱丹方沒錯，只是偷偷加了汽水。',choices:['調整爐火，救回這鍋丹','帶弟子重煉，汽水留給自己喝']},
    ti:{name:'金身武院',icon:'💪',place:'金身演武場',task:'石獅拒絕加班',text:'守門石獅被搬去練臂力，現在全院找不到誰來看門。',choices:['親自護送石獅回崗','教弟子輪值，石獅今天休假']}
  };
  const RANKS=[{name:'門人',realm:2,merit:0,age:0,salarySec:180},{name:'執事',realm:3,merit:80,age:24*HOUR,salarySec:270},{name:'宗主',realm:4,merit:180,age:48*HOUR,salarySec:315},{name:'長老',realm:5,merit:300,age:72*HOUR,salarySec:360},{name:'老祖',realm:6,merit:500,age:120*HOUR,salarySec:450}];
  function fresh(){return {workSchema:1,workStarted:false,taskPending:0,teachPending:0,taskNextAt:0,teachNextAt:0,taskResumeMs:TASK_MS,teachResumeMs:TEACH_MS,rankSchema:2,life:XG.state.player.reincarn||0,route:null,offered:false,school:null,rank:0,merit:0,credit:0,joinedSec:0,switchAt:0,taskAt:0,task:null,taskSerial:0,taughtAt:0,paySec:0,payCult:0,payUnits:0,payReady:[],pills:[],dust:0,taught:0,tasks:0,contest:null,battleAt:0,log:[]};}
  function state(){let s=XG.state.sect;if(!s||s.life!==(XG.state.player.reincarn||0))s=XG.state.sect=fresh();if(s.rankSchema!==2){s.rank=s.rank===2?3:Math.max(0,Math.min(1,s.rank||0));s.rankSchema=2;}migrateWork(s);return s;}
  function active(){return state().route==='sect';}
  function eligible(){return XG.state.player.realmIdx>=2&&!!SCHOOLS[XG.state.player.school];}
  function school(){return SCHOOLS[state().school||XG.state.player.school]||SCHOOLS.jian;}
  function changed(){XG.bus.emit('save:dirty');XG.bus.emit('sect:changed');XG.bus.emit('res:changed');}
  function note(text){const s=state();s.log.unshift({t:Date.now(),text:text});s.log.length=Math.min(20,s.log.length);}
  function fail(msg){return {ok:false,msg:msg};}
  function merit(n){const s=state();s.merit+=n;s.credit+=n;}
  function quote(){
    const rate=XG.balance.standardRate(),realm=XG.state.player.realmIdx;
    const recipes=XG.data.pills.recipes.filter(r=>XG.balance.instantPill(r)&&XG.balance.pillRealm(r)<=realm);
    const ratio=Math.min.apply(null,recipes.map(r=>XG.balance.pillPrice(r)/r.eff.val));
    const cult=Math.max(1,Math.floor(rate*30)),stone=Math.max(1,Math.ceil(cult*(Number.isFinite(ratio)?ratio:.01)));
    return {cult:cult,stone:stone,jade:Math.max(1,Math.ceil(stone*5/500)),realm:realm};
  }
  function convertCult(cult,source){
    const s=state(),q=quote(),raw=Math.max(0,cult)/q.cult*q.stone+s.dust;
    const ls=Math.floor(raw);s.dust=raw-ls;
    if(ls)XG.addRes({lingShi:ls});
    return ls;
  }
  function stash(cult,n,source,realm){
    if(n<=0||cult<=0)return;
    const s=state();const stack=s.pills.find(p=>p.cult===cult&&p.realm===realm&&p.source===source);
    if(stack)stack.n+=n;else s.pills.push({cult:cult,n:n,source:source,realm:realm});
  }
  // 舊版只保留一件事務與一個授業冷卻；以舊存檔最後存檔時間接軌，避免追溯整個角色生涯。
  function migrateWork(s){
    if(s.workSchema===1)return;
    const now=Date.now(),saved=Number(XG.state.lastSeen),base=Number.isFinite(saved)&&saved>0?Math.min(now,saved):now;
    s.workSchema=1;s.workStarted=s.route==='sect'||!!s.school;
    s.taskPending=s.task?1:0;s.teachPending=0;s.taskResumeMs=TASK_MS;s.teachResumeMs=TEACH_MS;
    if(s.route==='sect'){
      s.taskNextAt=s.task?base+TASK_MS:Math.max(base,Number(s.taskAt)||base);
      if((Number(s.taughtAt)||0)<=base){s.teachPending=1;s.teachNextAt=base+TEACH_MS;}else s.teachNextAt=s.taughtAt;
    }else{s.taskNextAt=0;s.teachNextAt=0;}
    XG.bus.emit('save:dirty');
  }
  function ensureTask(s){
    if(s.taskPending>0&&!s.task)s.task={serial:++s.taskSerial,kind:s.tasks%3};
    if(s.taskPending<=0)s.task=null;
  }
  // 固定生成時間軸，不因待辦未處理而停表；只存數量，長離線不建立巨型事件陣列。
  // 不使用 offline(dt) 的封頂秒數，所以待辦可跨越既有48小時掛機上限；同一時間重查不重算。
  function accrueWork(){
    const s=state();if(s.route!=='sect'||!s.workStarted)return s;
    const now=Date.now();let dirty=false;
    for(const [at,count,period] of [['taskNextAt','taskPending',TASK_MS],['teachNextAt','teachPending',TEACH_MS]]){
      if(s[at]>0&&now>=s[at]){const n=Math.floor((now-s[at])/period)+1;s[count]+=n;s[at]+=n*period;dirty=true;}
    }
    const had=!!s.task;ensureTask(s);if(had!==!!s.task)dirty=true;
    s.taskAt=s.taskNextAt;
    if(dirty)XG.bus.emit('save:dirty');return s;
  }
  function makeTask(){accrueWork();}
  function advance(dt){
    if(!active())return null;
    accrueWork();
    dt=Math.max(0,Number(dt)||0);if(!dt)return null;
    const s=state(),rate=XG.balance.standardRate(),rank=RANKS[s.rank]||RANKS[0];
    s.joinedSec+=dt;
    // 分段累積：升職/升境前已走過的時間不會套用新待遇。
    const perSec=rate*rank.salarySec/PAY;let left=dt;
    while(left>0){const take=Math.min(left,PAY-s.paySec);s.paySec+=take;s.payCult+=take*perSec;left-=take;
      if(s.paySec>=PAY){s.payReady.push({cult:Math.max(1,Math.floor(s.payCult)),realm:XG.state.player.realmIdx,source:'職位俸祿'});s.paySec=0;s.payCult=0;s.payUnits++;}
    }
    makeTask();return {events:s.payReady.length?['宗門俸祿已備妥，可到宗門領丹。']:[]};
  }
  const api=XG.sys.sect={id:'sect',active:active,eligible:eligible,school:school,ranks:RANKS,quote:quote,convertCult:convertCult,
    init(){state();accrueWork();if(!this._sub){this._sub=true;XG.bus.on('tick',p=>this.tick(p&&p.dt||1));XG.bus.on('reincarn:done',()=>{XG.state.sect=fresh();changed();});}},
    tick(dt){advance(dt);},offline(dt){return advance(dt);},
    choose(route){
      if(!eligible())return fail('金丹後才能決定修行道路。');
      if(route!=='sect'&&route!=='wanderer')return fail('請選擇一條修行道路。');
      const s=state();if(s.route===route)return fail('這已是你目前的道路。');
      if(s.route==='sect')return fail('請先在宗門辦理離宗。');
      if(Date.now()<s.switchAt)return fail('離宗後需休整24小時才可再入宗。');
      s.offered=true;s.route=route;
      if(route==='sect'){
        s.school=XG.state.player.school;s.switchAt=Date.now()+SWITCH*1000;
        // 共用論道時間基準，不能先領論道再立即領一整堂授業。
        const ats=Object.values(XG.state.daily.discussAt||{});s.taughtAt=Math.max(s.taughtAt,0,...ats);
        const now=Date.now();
        if(!s.workStarted){
          s.workStarted=true;s.taskPending=1;s.taskNextAt=now+TASK_MS;
          s.teachPending=s.taughtAt>now?0:1;s.teachNextAt=s.taughtAt>now?s.taughtAt:now+TEACH_MS;
        }else{
          s.taskNextAt=now+s.taskResumeMs;s.teachNextAt=Math.max(now+s.teachResumeMs,s.taughtAt);
        }
        XG.sys.pvp.setAuto(false);makeTask();note('拜入'+school().name+'。從今天起，摸魚也要寫事務紀錄。');
      }else note('選擇自在散修。山很大，蒲團在哪裡都能放。');
      changed();return {ok:true,msg:route==='sect'?'已拜入'+school().name:'繼續自在散修。'};
    },
    defer(){state().offered=true;changed();},
    leave(){const s=state();if(!active())return fail('目前沒有加入宗門。');if(Date.now()<s.switchAt)return fail('入宗滿24小時後可辦理離宗。');
      if(s.contest)return fail('請先完成並結算本次大比。');
      const d=XG.state.daily;d.discussAt=d.discussAt||{};for(const f of XG.state.fellows||[])d.discussAt[f.uid]=Math.max(d.discussAt[f.uid]||0,s.taughtAt);
      accrueWork();s.taskResumeMs=Math.max(0,s.taskNextAt-Date.now());s.teachResumeMs=Math.max(0,s.teachNextAt-Date.now());s.taskNextAt=s.teachNextAt=0;
      s.route='wanderer';s.switchAt=Date.now()+SWITCH*1000;note('暫別宗門，繼續雲遊。已賺取的丹藥、貢獻與待辦妥善保留。');changed();return {ok:true,msg:'已離宗，24小時後可再入宗。'};},
    info(){const s=accrueWork(),q=quote();return Object.assign({},s,{eligible:eligible(),active:active(),schoolInfo:school(),rankInfo:RANKS[s.rank],nextRank:RANKS[s.rank+1]||null,quote:q,taskWait:s.taskPending?0:Math.max(0,Math.ceil((s.taskNextAt-Date.now())/1000)),teachWait:s.teachPending?0:Math.max(0,Math.ceil((s.teachNextAt-Date.now())/1000)),taskNextWait:Math.max(0,Math.ceil((s.taskNextAt-Date.now())/1000)),teachNextWait:Math.max(0,Math.ceil((s.teachNextAt-Date.now())/1000)),switchWait:Math.max(0,Math.ceil((s.switchAt-Date.now())/1000)),payWait:Math.max(0,Math.ceil(PAY-s.paySec)),pills:s.pills.map(p=>Object.assign({},p)),payReady:s.payReady.slice(),log:s.log.slice()});},
    taskInfo(){const s=accrueWork();if(!active()||!s.task)return null;const sp=school();
      const common=[{title:sp.task,text:sp.text,choices:sp.choices},{title:'靈田排班小風波',text:'弟子都想負責澆水，因為鋤草聽起來就很累。靈草表示：我們也很為難。',choices:['親自整理靈田，保住本月收成','安排弟子輪值，大家一起長大']},{title:'庫房帳本失蹤',text:'庫房帳本找到了，墊在長老的茶壺下面。帳是平的，茶也是。',choices:['親自盤點，追回遺漏物資','教弟子重整帳冊，下次用杯墊']}][s.task.kind];return Object.assign({serial:s.task.serial},common);},
    resolveTask(choice,serial){const s=state();if(!active())return fail('宗門事務需要入宗後處理。');makeTask();if(!s.task||serial!==s.task.serial)return fail('這件事務已處理，請查看新事務。');if(choice!==0&&choice!==1)return fail('請選擇處理方式。');
      const cult=XG.balance.activityCult(XG.balance.standardRate()*(choice===0?3600:2400));
      const contrib=choice===0?3:5,ls=convertCult(Math.max(1,cult-XG.balance.standardRate()*contrib*3),'宗門事務');
      merit(contrib);s.tasks++;const ly=s.tasks%5===0?1:0;if(ly)XG.addRes({lingYu:ly});s.taskPending--;s.task=null;ensureTask(s);
      const msg='事務完成：靈石＋'+ls+'，貢獻＋'+contrib+(ly?'，靈玉＋1':'')+'。';note(msg);changed();return {ok:true,msg:msg,lingShi:ls,lingYu:ly,merit:contrib};
    },
    teach(style){const s=accrueWork();if(!active())return fail('拜入宗門後才能授業。');if(style!=='practice'&&style!=='mentor')return fail('請選擇授業方式。');if(s.teachPending<1)return fail('目前沒有待授業，十分鐘會新增一次。');
      // 對齊同時間散修50道友約150秒標準修為，改為可購丹的報酬。
      const seconds=150,gain=style==='practice'?4:6,ls=convertCult(XG.balance.standardRate()*(seconds-gain*3),'授業');
      merit(gain);s.taught++;s.teachPending--;s.taughtAt=Date.now()+TEACH_MS;
      const d=XG.state.daily;d.discussAt=d.discussAt||{};for(const f of XG.state.fellows||[])d.discussAt[f.uid]=Math.max(d.discussAt[f.uid]||0,s.taughtAt);
      note('完成一堂'+(style==='practice'?'實修課':'解惑課')+'：靈石＋'+ls+'，貢獻＋'+gain+'。');changed();return {ok:true,msg:s.log[0].text};
    },
    promote(){const s=state(),next=RANKS[s.rank+1];if(!active()||!next)return fail('目前無可晉升職位。');if(XG.state.player.realmIdx<next.realm||s.merit<next.merit||s.joinedSec<next.age)return fail('境界、累積貢獻與入宗時長均達標，才可晉升。');
      s.rank++;note('晉升'+next.name+'。待遇增加，茶杯也升級了。');changed();return {ok:true,msg:s.log[0].text};
    },
    quickCollect(){if(!state().payReady.length)return {ok:false,msg:[]};const r=this.claimSalary();return {ok:r.ok,msg:[r.msg]};},
    quickCultivate(){let n=0,cult=0;for(let k=state().pills.length-1;k>=0;k--){const r=this.usePill(k,true);if(r.ok){n+=r.n;cult+=r.cult;}}return {ok:n>0,n:n,cult:cult,msg:n?'服下宗門丹藥'+n+'枚，修為＋'+XG.util.fmt(cult):'宗門丹藥暫不可服用。'};},
    claimSalary(){const s=state();if(!s.payReady.length)return fail('俸祿尚未備妥。');const n=s.payReady.length;for(const p of s.payReady)stash(p.cult,1,p.source,p.realm);s.payReady=[];note('領取'+n+'份職位丹藥。');changed();return {ok:true,msg:'已領取'+n+'份職位丹藥。'};},
    buyPill(currency,count){if(!active())return fail('宗門丹房只對本宗門人開放。');if(currency!=='lingShi'&&currency!=='lingYu'&&currency!=='credit')return fail('請選擇付款方式。');if(!Number.isInteger(count)||count<1||count>10)return fail('一次購買1至10枚。');
      const s=state(),q=quote();let n=count,cost;if(currency==='lingYu'){n=count*5;cost=q.jade*count;}else cost=(currency==='credit'?10:q.stone)*count;
      if(currency==='credit'){if(s.credit<cost)return fail('可用貢獻不足。');s.credit-=cost;}else{if((XG.state.res[currency]||0)<cost)return fail('貨幣不足。');XG.addRes({[currency]:-cost});}
      stash(q.cult,n,'宗門修行丹',q.realm);changed();return {ok:true,msg:'取得宗門修行丹×'+n+'。',count:n,cost:cost};
    },
    usePill(index,all){const s=state(),p=s.pills[index];if(!p||p.n<1)return fail('丹藥已用完。');if(XG.state.player.realmIdx<p.realm)return fail('境界尚不足以服用此丹。');let n=all?p.n:1;
      // 俸祿丹純淨無丹毒；修行丹每枚0.05，沿用自然衰減。
      const tox=XG.state.player.toxicity||0,perTox=p.source==='職位俸祿'?0:.05;if(tox>=100)return fail('丹毒已滿，先調息再服。');if(perTox)n=Math.min(n,Math.max(0,Math.floor((100-tox+1e-8)/perTox)));if(!n)return fail('丹毒已滿，先調息再服。');
      const cult=p.cult*n;XG.sys.cultivation.addCult(cult,'宗門丹藥');XG.state.player.toxicity=Math.min(100,tox+n*perTox);p.n-=n;if(!p.n)s.pills.splice(index,1);XG.stats.invalidate();changed();return {ok:true,msg:'服用'+n+'枚，修為＋'+XG.util.fmt(cult)+'。',cult:cult,n:n};
    },
    startContest(){const s=state();if(!active())return fail('入宗後可參加宗門大比。');if(!XG.cfg.isUnlocked('pvp'))return fail('金丹五層開放宗門大比。');if(s.contest)return fail('已有一場大比進行中。');s.contest={rounds:[],settled:false};changed();return {ok:true,msg:'大比開場，連戰三位參賽道友。每戰仍採三局兩勝。'};},
    contestFight(){const s=state();if(!active()||!s.contest||s.contest.rounds.length>=3)return fail('請先報名大比，或領取本次結果。');if(Date.now()<s.battleAt)return fail('稍候三秒，讓道友先站穩。');
      const r=XG.sys.pvp.fightSect();if(!r.ok)return fail(r.reason||'暫時無法比試。');s.battleAt=Date.now()+3000;s.contest.rounds.push({name:r.opp.name,gender:r.opp.gender,schoolName:r.opp.schoolName,win:r.win,counterPct:r.counterPct,power:r.opp.power,reward:r.reward});changed();return {ok:true,msg:(r.win?'勝':'負')+' '+r.opp.name+'，靈石＋'+r.reward.lingShi+'。',battle:r};
    },
    finishContest(){const s=state();if(!active()||!s.contest||s.contest.rounds.length<3)return fail('完成三戰後才能結算。');const wins=s.contest.rounds.filter(r=>r.win).length,gain=2+wins;merit(gain);const msg='大比'+wins+'勝'+(3-wins)+'負，貢獻＋'+gain+'。';s.contest=null;note(msg);changed();return {ok:true,msg:msg};}
  };
  XG.sysOrder.push('sect');
})();
