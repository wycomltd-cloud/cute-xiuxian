/* v2.0 修行道路與宗門頁：沿用可愛主題，保留道友與原存檔。 */
(function(){
'use strict';
const XG=window.XG,api=()=>XG.sys.sect,E=XG.util.esc,F=n=>XG.util.fmtInt(n||0),T=s=>XG.util.fmtTime(Math.max(0,Math.ceil(s||0)));
let root=null,section='affairs',signature='',promptLife=null;
const B=(act,text,disabled,extra)=>'<button class="btn '+(extra||'')+'" data-sect-act="'+act+'"'+(disabled?' disabled':'')+'>'+text+'</button>';
const card=(title,body)=>'<section class="card sect-card"><h3 class="card-title">'+title+'</h3>'+body+'</section>';
function routeCards(i){return '<div class="sect-route-grid"><article class="sect-path"><span class="sect-symbol">☁️</span><h3>自在散修</h3><p>奇遇、論道、鬥法與靈寵，繼續走自己的仙路。</p>'+B('wanderer',i.route==='wanderer'?'目前道路':'繼續做散修',i.route==='wanderer','btn-primary')+'</article><article class="sect-path sect-path-gold"><span class="sect-symbol">'+i.schoolInfo.icon+'</span><h3>拜入'+E(i.schoolInfo.name)+'</h3><p>照顧宗門、授業與大比，以報酬購丹、按職位領丹，較少丹毒負擔。</p>'+B('join','拜入宗門',i.switchWait>0,'btn-primary')+'</article></div><p class="muted">散修活動修為＋25%，附帶丹毒；宗門活動不加丹毒，修行丹低丹毒、俸祿丹無丹毒。基礎掛機修為相同。選散修後仍可入宗；入宗或離宗後需休整24小時才能再次轉換。</p>'+(i.switchWait?'<p class="muted">可再入宗：'+T(i.switchWait)+'</p>':'');}
function affairs(i){const task=api().taskInfo();return card('📋 宗門事務',task?'<p class="sect-eyebrow">待辦小紙條</p><h3>'+E(task.title)+'</h3><p>'+E(task.text)+'</p><div class="sect-actions">'+task.choices.map((t,k)=>'<button class="btn '+(k?'':'btn-primary')+'" data-sect-act="task" data-choice="'+k+'" data-serial="'+task.serial+'">'+E(t)+'</button>').join('')+'</div><p class="muted">親自處理報酬較多；帶領弟子可獲較多貢獻。</p>':'<p>事務暫告一段落。弟子們很乖，至少現在是。</p><p class="muted" data-sect-clock="task">下件事務：'+T(i.taskWait)+'</p>');}
function teach(i){return card('📚 授業', '<p>指導本宗低境界弟子，每堂獲得靈石與貢獻。弟子消化課業需十分鐘。</p><div class="sect-actions">'+B('practice','開實修課 · 報酬較多',i.teachWait>0,'btn-primary')+B('mentor','開解惑課 · 貢獻較多',i.teachWait>0)+'</div><p class="muted" data-sect-clock="teach">'+(i.teachWait?'弟子溫習中：'+T(i.teachWait):'弟子已帶著筆記與點心就座。')+'</p><p class="muted">已授業 '+F(i.taught)+' 堂。與道友的閒聊、送禮及道侶關係照常保留。</p>');}
function contest(i){const c=i.contest;let body='<p>邀各宗同道交流，連戰三位道友，每戰三局兩勝。切磋戰力與你相等，五修相剋仍生效。</p>';
 if(!XG.cfg.isUnlocked('pvp'))body+='<p class="muted">金丹五層開放。</p>';
 else if(!c)body+=B('contest-start','報名宗門大比',false,'btn-primary');
 else{body+='<div class="sect-bouts">'+[0,1,2].map(k=>{const r=c.rounds[k];return '<div><b>第'+(k+1)+'戰</b><span>'+(r?E(r.name)+' '+E(XG.character.symbol(r.gender))+' · '+E(r.schoolName||'')+' · '+(r.win?'勝':'負')+'<small class="sect-battle-detail">戰力 '+F(r.power)+' · 我方修正 '+(r.counterPct>0?'+':'')+r.counterPct+'%</small>':'等待上場')+'</span></div>';}).join('')+'</div>';
 body+=c.rounds.length<3?B('contest-fight','挑戰下一位道友',Date.now()<i.battleAt,'btn-primary'):B('contest-finish','結算大比 · 領取貢獻',false,'btn-primary');}
 return card('🏆 宗門大比',body+'<p class="muted">每戰立即領靈石；三戰完成後按勝場領貢獻。中途離開頁面不會重抽或丟失戰績。</p>');}
function pills(i){const q=i.quote;return card('🫖 宗門丹房','<p>宗門修行丹每枚修為＋<b>'+F(q.cult)+'</b>，購買時固定藥效。</p><div class="sect-actions">'+B('buy-stone','買1枚 · '+F(q.stone)+'靈石',XG.state.res.lingShi<q.stone,'btn-primary')+B('buy-ten','買10枚 · '+F(q.stone*10)+'靈石',XG.state.res.lingShi<q.stone*10)+B('buy-jade','買5枚 · '+F(q.jade)+'靈玉',XG.state.res.lingYu<q.jade)+B('buy-credit','換1枚 · 10貢獻',i.credit<10)+'</div><p class="muted">自用丹藥不可出售或送禮；每枚丹毒＋0.05，職位俸祿丹無丹毒，沿用自然調息。舊丹不因升境界而放大藥效。</p>')+inventory(i);}
function inventory(i){return card('🎒 我的宗門丹囊','<p class="muted">丹毒 '+Math.round(XG.state.player.toxicity||0)+' / 100</p>'+(i.pills.length?i.pills.map((p,k)=>'<div class="sect-pill"><div><b>'+E(p.source)+(p.source==='職位俸祿'?' · 無丹毒':' · 低丹毒')+'</b><p class="muted">'+E(XG.cfg.REALMS[p.realm].name)+'可服 · 每枚修為＋'+F(p.cult)+' · ×'+F(p.n)+'</p></div><div class="sect-actions"><button class="btn btn-primary" data-sect-act="pill" data-index="'+k+'">服用</button><button class="btn" data-sect-act="pill-all" data-index="'+k+'">全服</button></div></div>').join(''):'<p>丹囊很輕，先去做點事，再回來買丹。</p>'));}
function rank(i){const nr=i.nextRank,p=XG.state.player;let next='<p>已任老祖，接下來專心渡劫飛升。</p>';
 if(nr)next='<h4>下一職位：'+nr.name+'</h4><div class="sect-checks"><span>'+ (p.realmIdx>=nr.realm?'✓':'○')+' '+E(XG.cfg.REALMS[nr.realm].name)+'境界</span><span>'+(i.merit>=nr.merit?'✓':'○')+' 累積貢獻 '+F(i.merit)+' / '+nr.merit+'</span><span>'+(i.joinedSec>=nr.age?'✓':'○')+' 入宗修行 '+T(i.joinedSec)+' / '+T(nr.age)+'</span></div>'+B('promote','申請晉升'+nr.name,!(p.realmIdx>=nr.realm&&i.merit>=nr.merit&&i.joinedSec>=nr.age),'btn-primary');
 return card('🎖️ 職位與俸祿','<p class="muted">門人（金丹／結丹） → 執事（元嬰） → 宗主（化神） → 長老（煉虛） → 老祖（合體以上）</p><p>目前為 <b>'+i.rankInfo.name+'</b>。每四小時產生一份俸祿丹，可離線累積後一次領取。</p><div class="sect-actions">'+B('salary','領取俸祿丹 · '+F(i.payReady.length)+'份',!i.payReady.length,'btn-primary')+'</div><p class="muted" data-sect-clock="pay">下一份俸祿：'+T(i.payWait)+'</p><p class="muted">目前待遇每份約 '+i.rankInfo.salarySec+' 秒標準修為；升職後待遇提高，先前已累積部分按當時待遇保留。</p>'+next)+card('📖 宗門手帳',i.log.length?i.log.slice(0,8).map(l=>'<p class="sect-log">'+E(l.text)+'</p>').join(''):'<p>手帳還是空的。</p>')+card('☁️ 暫別宗門','<p>離宗後回到散修流程；本世已賺取的丹藥、職位與貢獻保留，離宗期間不產生俸祿。輪回後重新開始。</p>'+B('leave','辦理離宗',i.switchWait>0||!!i.contest)+(i.switchWait?'<p class="muted">尚需休整 '+T(i.switchWait)+'</p>':''));}
function render(force){if(!root)return;const i=api().info();const sig=JSON.stringify([section,i.active,i.route,i.rank,i.merit,i.credit,i.task,i.contest,i.pills,i.payReady.length,i.log[0],i.eligible,i.quote,[XG.state.res.lingShi>=i.quote.stone,XG.state.res.lingShi>=i.quote.stone*10,XG.state.res.lingYu>=i.quote.jade],Math.round(XG.state.player.toxicity||0),!i.teachWait,!i.taskWait,!i.switchWait,Date.now()>=i.battleAt,i.nextRank&&i.joinedSec>=i.nextRank.age]);
 if(!force&&sig===signature){clocks(i);return;}signature=sig;
 let h='<div class="tab-page sect-page"><div class="sect-page-head"><span class="sect-eyebrow">TWO PATHS, ONE IMMORTAL DREAM</span><h2>'+ (i.active?E(i.schoolInfo.name):'我的修行道路')+'</h2><p>'+ (i.active?'宗門大小事，今天也請道友多多照顧。':'仙路分兩條，蒲團都坐得下。')+'</p></div>';
 if(!i.eligible)h+=card('⛩️ 金丹之後，再選一條路','<p>繼續修行至金丹，便可選擇自在散修，或依當世五修拜入對應宗門。</p>');
 else if(!i.active){h+=routeCards(i);if(i.payReady.length)h+=card('待領舊俸祿',B('salary','領取已賺俸祿 · '+i.payReady.length+'份',false));if(i.pills.length)h+=inventory(i);}
 else{h+='<div class="sect-summary"><span>'+E(i.schoolInfo.icon)+' '+i.rankInfo.name+'</span><span>累積貢獻 <b>'+F(i.merit)+'</b></span><span>可用貢獻 <b>'+F(i.credit)+'</b></span></div><div class="sect-nav" role="group" aria-label="宗門功能">'+[['affairs','事務'],['teach','授業'],['contest','大比'],['pills','丹房'],['rank','職位俸祿']].map(x=>'<button class="btn '+(section===x[0]?'btn-primary':'')+'" data-sect-act="section" data-section="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>';
 h+=section==='teach'?teach(i):section==='contest'?contest(i):section==='pills'?pills(i):section==='rank'?rank(i):affairs(i);}
 root.innerHTML=h+'</div>';clocks(i);
}
function clocks(i){if(!root)return;const tx=(id,s)=>{const e=root.querySelector('[data-sect-clock="'+id+'"]');if(e)e.textContent=s;};tx('task','下件事務：'+T(i.taskWait));tx('teach',i.teachWait?'弟子溫習中：'+T(i.teachWait):'弟子已帶著筆記與點心就座。');tx('pay','下一份俸祿：'+T(i.payWait));}
function result(r){if(r)XG.ui.toast(r.msg||(r.ok?'完成':'稍後再試'),r.ok?'gold':'err');render(true);homeBanner();}
function transition(route){const r=api().choose(route);result(r);if(r.ok){XG.ui.renderActive();homeBanner();}}
function handle(ev){const b=ev.target.closest('[data-sect-act]');if(!b||!root.contains(b))return;const a=b.dataset.sectAct;
 if(a==='section'){section=b.dataset.section;render(true);return;}
 if(a==='join'){XG.ui.confirm('拜入'+api().school().name+'？主要奇遇、論道與鬥法收益將由宗門事務、授業與大比取代。',()=>transition('sect'));return;}
 if(a==='wanderer'){transition('wanderer');return;}
 if(a==='leave'){XG.ui.confirm('確定暫別宗門，回到自在散修的生活？',()=>{const r=api().leave();result(r);if(r.ok)XG.ui.showTab('home');});return;}
 let r;
 if(a==='task')r=api().resolveTask(Number(b.dataset.choice),Number(b.dataset.serial));
 else if(a==='practice'||a==='mentor')r=api().teach(a);
 else if(a==='salary')r=api().claimSalary();
 else if(a==='promote')r=api().promote();
 else if(a==='buy-stone'||a==='buy-ten')r=api().buyPill('lingShi',a==='buy-ten'?10:1);
 else if(a==='buy-jade')r=api().buyPill('lingYu',1);
 else if(a==='buy-credit')r=api().buyPill('credit',1);
 else if(a==='pill'||a==='pill-all')r=api().usePill(Number(b.dataset.index),a==='pill-all');
 else if(a==='contest-start')r=api().startContest();
 else if(a==='contest-fight')r=api().contestFight();
 else if(a==='contest-finish')r=api().finishContest();
 result(r);
}
function mount(el,focus){unmount();root=el;section=focus||'affairs';signature='';root.addEventListener('click',handle);render(true);}
function unmount(){if(root)root.removeEventListener('click',handle);root=null;signature='';}
XG.ui.sectMount=mount;XG.ui.sectUpdate=()=>render(false);XG.ui.sectUnmount=unmount;
XG.ui.registerTab({id:'sect',name:'宗門／散修',icon:'⛩️',order:12,main:false,mount:el=>mount(el),update:()=>render(false),unmount:unmount});
function homeBanner(){const e=document.getElementById('sect-home-banner');if(!e)return;const i=api().info();if(!i.eligible){e.innerHTML='';return;}
 const text=i.active?i.schoolInfo.name+' · '+i.rankInfo.name:i.route==='wanderer'?'自在散修 · 仙路由我':'金丹已成，仙路由你選';const tail=i.active?'穩定修行 · 俸祿丹無丹毒':'活動修為＋25% · 冒險也會累積丹毒';const h='<div class="sect-home-strip"><div><b>⛩️ '+E(text)+'</b><span>'+E(tail)+'</span></div><button class="btn btn-primary" data-sect-open="1">'+(i.active?'回宗門':'選擇道路')+'</button></div>';
 if(e.innerHTML!==h)e.innerHTML=h;
 const side=document.querySelector('[data-cute-tab="pvp"]');if(side){const label=side.querySelector('span:nth-child(2)');if(label)label.textContent=i.active?'宗門大比':'友善切磋局';}
}
function prompt(){homeBanner();const i=api().info();if(!i.eligible||i.offered||i.route||promptLife===i.life||!document.getElementById('tab-container')||(XG.character&&XG.character.needsChoice()))return;
 if(document.querySelector('#modal-root > *,dialog[open]'))return;
 promptLife=i.life;XG.ui.modal({title:'金丹已成，你想走哪條仙路？',html:'<p>繼續自在散修，或拜入<b>'+E(i.schoolInfo.name)+'</b>，靠宗門事務、授業、大比與職位丹藥修行。兩條路都能渡劫輪回。</p>',buttons:[{text:'自在散修',cb:()=>transition('wanderer')},{text:'拜入'+i.schoolInfo.name,cls:'btn-primary',cb:()=>transition('sect')},{text:'再逛逛，稍後決定',cb:()=>api().defer()}]});}
document.addEventListener('click',ev=>{if(ev.target.closest('[data-sect-open]'))XG.ui.showTab('sect');});
setInterval(prompt,1000);
})();
