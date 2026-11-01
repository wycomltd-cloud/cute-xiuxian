/* v2.0.2 五宗庭院美術：純展示，不寫遊戲存檔。中央透明保留男女與境界造型。 */
(function(){
'use strict';
const XG=window.XG;
const catalog={
 jian:{id:'jian',name:'青鋒劍宗',place:'聽劍庭',src:'assets/sects/jian.png'},
 fu:{id:'fu',name:'萬符仙院',place:'流雲符院',src:'assets/sects/fu.png'},
 zhen:{id:'zhen',name:'星羅陣宗',place:'星羅陣庭',src:'assets/sects/zhen.png'},
 dan:{id:'dan',name:'百草丹宗',place:'百草丹院',src:'assets/sects/dan.png'},
 ti:{id:'ti',name:'金身武院',place:'金身演武場',src:'assets/sects/ti.png'}
};
for(const id in catalog)Object.freeze(catalog[id]);Object.freeze(catalog);
function info(id){return Object.prototype.hasOwnProperty.call(catalog,id)?catalog[id]:null;}
function currentForPlayer(){
 if(XG.state.player.realmIdx<2||!XG.sys.sect||!XG.sys.sect.active())return null;
 return info(XG.state.sect.school||XG.state.player.school);
}
// 舊載入完成不得覆寫離宗、輪回或換宗後的畫面；暫時失敗15秒後可重試。
function controller(onChange,load){
 let wanted=null,shown=null,loading=false,serial=0,retryAt=0,disposed=false;
 load=load||function(src,done,fail){const im=new Image();im.onload=done;im.onerror=fail;im.src=src;};
 return {
  sync(id){
   if(disposed)return;
   const art=info(id),key=art?art.id:null;
   if(key!==wanted){wanted=key;shown=null;loading=false;retryAt=0;serial++;onChange(null);}
   if(!art||shown===key||loading||Date.now()<retryAt)return;
   const token=++serial;loading=true;
   load(art.src,function(){if(disposed||token!==serial||wanted!==key)return;loading=false;shown=key;retryAt=0;onChange(art);},function(){if(disposed||token!==serial)return;loading=false;retryAt=Date.now()+15000;shown=null;onChange(null);});
  },
  current(){return info(shown);},
  stop(){disposed=true;serial++;wanted=shown=null;loading=false;onChange(null);}
 };
}
XG.sectArt={info:info,currentForPlayer:currentForPlayer,controller:controller,ids:Object.keys(catalog)};
})();
