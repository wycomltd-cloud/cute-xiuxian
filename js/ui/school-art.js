/* school-art.js：五修×十境的法器插畫層；首頁與相機共用同一套純展示資料。 */
(function () {
  'use strict';
  const XG = window.XG = window.XG || {};
  const names = {
    jian: ['桃木小劍','青竹靈劍','赤金丹劍','月魄蓮劍','碧晶神劍','星河虛劍','雙儀合璧劍','天宮金蓮劍','紫霄雷劍','虹光天仙劍'],
    fu: ['黃紙靈符','青竹玉符','鎏金丹符','銀月蓮符','碧晶神符','星河虛符','雙儀合符','天宮金籙','紫霄雷籙','虹光仙籙'],
    zhen: ['聚氣小陣','青竹八卦陣','金丹星芒陣','月蓮靈陣','碧晶神陣','星河虛空陣','雙儀合璧陣','天宮金蓮陣','紫霄御雷陣','虹光周天陣'],
    dan: ['小陶丹爐','青竹玉爐','赤金丹爐','銀月蓮爐','碧晶神爐','星河虛爐','雙儀合璧爐','天宮金蓮爐','紫霄雷火爐','虹光仙丹爐'],
    ti: ['暖身氣環','青竹護體環','金丹護體甲','月魄靈甲','碧晶神鎧','星河虛甲','雙儀合璧鎧','天宮金身','紫霄雷鎧','虹光不滅身']
  };
  const palettes = [
    ['#a77844','#f6d296','#725a3e'], ['#4c9275','#c8efd4','#d4ba77'],
    ['#c58b35','#fff1a6','#8c5b2d'], ['#9d86c2','#ece6ff','#c7b8e0'],
    ['#388e97','#bcfff0','#b8b574'], ['#7063a3','#e5d9ff','#c6b2ea'],
    ['#c67b8a','#ffe1cf','#c6aa68'], ['#bb9953','#fff5c3','#a37b43'],
    ['#8660b1','#f1d4ff','#d7b363'], ['#78afba','#fff4cc','#c6a664']
  ];
  function info(school, realmIdx) {
    if (!Object.prototype.hasOwnProperty.call(names, school)) return null;
    const n = Number(realmIdx), level = Number.isFinite(n) ? Math.max(0,Math.min(9,Math.floor(n))) : 0;
    return {school:school, level:level, key:school+':'+level, name:names[school][level], colors:palettes[level]};
  }
  function polygon(cx,cy,r,n,rotation) {
    const a=[];for(let i=0;i<n;i++){const t=(i/n*360+(rotation||0))*Math.PI/180;a.push((cx+Math.cos(t)*r).toFixed(1)+','+(cy+Math.sin(t)*r).toFixed(1));}return a.join(' ');
  }
  function sword(v, extra, x, y, scale) {
    const k=v.level,w=18+k*2.5,len=220+k*12,wood=k===0;
    const edge = k < 3 ? '0,'+(-len)+' '+w+',-125 '+(w*.65)+',-48 '+(-w*.65)+',-48 '+(-w)+',-125' :
      '0,'+(-len)+' '+w+',-'+(len-50)+' '+(w*.72)+',-155 '+(w+7)+',-138 '+(w*.62)+',-48 '+(-w*.62)+',-48 '+(-w-7)+',-138 '+(-w*.72)+',-155 '+(-w)+',-'+(len-50);
    let h='<g transform="translate('+x+' '+y+') rotate('+(extra?-27:17)+') scale('+scale+')" stroke-linejoin="round">';
    h+='<path d="M0 -'+(len+30)+' Q-55 -120 -24 65 Q68 -60 0 -'+(len+30)+'" fill="none" stroke="'+v.colors[1]+'" stroke-width="3" opacity=".8"/>';
    h+='<polygon points="'+edge+'" fill="'+(wood?'#be9562':'url(#metal-'+v.key+')')+'" stroke="'+v.colors[2]+'" stroke-width="4"/>';
    h+='<path d="M0 -'+(len-16)+' V-55" stroke="'+(wood?'#8c613a':'#fffdf0')+'" stroke-width="3"/>';
    h+='<path d="M-'+(45+k*3)+' -44 Q0 -'+(k>3?85:62)+' '+(45+k*3)+' -44 L31 -25 Q0 -40 -31 -25Z" fill="url(#gold-'+v.key+')" stroke="#8a723e" stroke-width="3"/>';
    h+='<rect x="-10" y="-30" width="20" height="65" rx="7" fill="'+v.colors[0]+'" stroke="'+v.colors[2]+'" stroke-width="3"/>';
    for(let i=0;i<4;i++)h+='<path d="M-10 '+(-20+i*13)+' l20 7" stroke="'+v.colors[1]+'" stroke-width="3"/>';
    h+='<circle cy="-42" r="'+(12+k)+'" fill="'+v.colors[0]+'" stroke="#fff4b9" stroke-width="4"/><circle cy="38" r="12" fill="url(#gold-'+v.key+')"/>';
    h+='<path d="M0 50 Q34 83 4 126" fill="none" stroke="'+v.colors[0]+'" stroke-width="7"/><path d="M4 117 l-9 31 19 -2Z" fill="'+v.colors[0]+'"/>';
    if(k>=4)h+='<path d="M-18 -180 l18 -28 18 28 -18 30Z" fill="'+v.colors[0]+'" stroke="#fff7cc" stroke-width="2"/>';
    if(k>=8)h+='<path d="M-45 -270 l27 20 -17 34 38 -16 -14 44" fill="none" stroke="'+v.colors[1]+'" stroke-width="5"/>';
    return h+'</g>';
  }
  function rune(v,x,y,i) {
    const k=v.level,w=70+k*2,h=105+k*3;
    return '<g transform="translate('+x+' '+y+') rotate('+(i%2?-12:12)+')"><path d="M-'+w/2+' -'+h/2+' Q0 -'+(h/2+12)+' '+w/2+' -'+h/2+' L'+w/2+' '+h/2+' Q0 '+(h/2-10)+' -'+w/2+' '+h/2+'Z" fill="'+(k<3?'#ffe8a2':v.colors[1])+'" stroke="'+v.colors[2]+'" stroke-width="4"/><path d="M-22 -34 H22 M-16 -23 H16 M0 -36 V31 M-18 -9 L18 7 -15 21 17 32 M-24 40 H24" fill="none" stroke="'+v.colors[0]+'" stroke-width="5" stroke-linecap="round"/><circle cy="-5" r="'+(8+k)+'" fill="none" stroke="'+v.colors[0]+'" stroke-width="2"/></g>';
  }
  function formation(v) {
    const k=v.level, n=4+k;
    let h='<g transform="translate(790 755) scale(1 .31)" fill="none" stroke="'+v.colors[1]+'" stroke-width="5">';
    h+='<ellipse rx="'+(350+k*13)+'" ry="'+(350+k*13)+'" fill="'+v.colors[0]+'" fill-opacity=".12"/>';
    for(let r=0;r<2+Math.floor(k/3);r++)h+='<circle r="'+(300+k*13-r*28)+'" stroke="'+(r%2?v.colors[0]:v.colors[1])+'" stroke-width="'+(r%2?8:5)+'"/>';
    h+='<polygon points="'+polygon(0,0,270+k*10,n,-90)+'"/>';
    if(k>=2)h+='<polygon points="'+polygon(0,0,270+k*10,n,90)+'" stroke="'+v.colors[2]+'"/>';
    h+='<path d="M0 -130 A130 130 0 1 1 0 130 A65 65 0 0 1 0 0 A65 65 0 0 0 0 -130 M0 -130 A130 130 0 1 0 0 130"/><circle cy="-65" r="13" fill="'+v.colors[1]+'"/><circle cy="65" r="13" fill="'+v.colors[0]+'"/>';
    for(let i=0;i<8+k;i++)h+='<g transform="rotate('+(i*360/(8+k))+') translate(0 -'+(320+k*13)+')"><path d="M-12 -10 H12 M-12 0 H-3 M3 0 H12 M-12 10 H12" stroke-width="5"/></g>';
    h+='</g>';
    for(let i=0;i<3+Math.floor(k/2);i++){const a=i*Math.PI*2/(3+Math.floor(k/2));const x=790+Math.cos(a)*(360+k*10),y=755+Math.sin(a)*110;h+='<path d="M'+x+' '+(y-80-k*3)+' l15 28 -15 23 -15 -23Z" fill="'+v.colors[0]+'" stroke="'+v.colors[1]+'" stroke-width="3"/>';}
    return h;
  }
  function furnace(v) {
    const k=v.level;
    let h='<g transform="translate(1190 680) scale('+(.73+k*.023)+')" stroke-linejoin="round">';
    h+='<ellipse cy="113" rx="105" ry="19" fill="#7b6957" opacity=".18"/>';
    h+='<path d="M-60 65 L-77 107 Q-60 116 -46 103 L-30 69 M60 65 L77 107 Q60 116 46 103 L30 69" fill="'+v.colors[2]+'" stroke="#8b7143" stroke-width="4"/>';
    h+='<path d="M-90 -30 Q-127 -89 -141 -48 Q-151 -5 -91 15 M90 -30 Q127 -89 141 -48 Q151 -5 91 15" fill="none" stroke="'+v.colors[2]+'" stroke-width="17"/>';
    h+='<path d="M-83 -70 Q-126 70 -45 87 Q0 101 45 87 Q126 70 83 -70Z" fill="url(#body-'+v.key+')" stroke="'+v.colors[2]+'" stroke-width="5"/>';
    h+='<ellipse cy="-67" rx="91" ry="23" fill="'+v.colors[1]+'" stroke="'+v.colors[2]+'" stroke-width="5"/>';
    h+='<path d="M-91 -83 Q-60 -123 0 -124 Q60 -123 91 -83Z" fill="url(#gold-'+v.key+')" stroke="'+v.colors[2]+'" stroke-width="4"/><circle cy="-135" r="17" fill="'+v.colors[0]+'" stroke="'+v.colors[1]+'" stroke-width="4"/>';
    h+='<circle cy="5" r="35" fill="none" stroke="'+v.colors[1]+'" stroke-width="5"/><path d="M0 -18 Q-35 14 0 31 Q35 14 0 -18Z" fill="'+v.colors[1]+'"/>';
    for(let i=0;i<2+Math.floor(k/3);i++)h+='<path d="M'+(-35+i*26)+' -147 q-25 -30 0 -55 t0 -45" fill="none" stroke="'+v.colors[1]+'" stroke-width="'+(6+i)+'" opacity=".9"/>';
    if(k>=3)h+='<path d="M-73 -18 l-22 14 18 38 M73 -18 l22 14 -18 38" stroke="'+v.colors[1]+'" stroke-width="5" fill="none"/>';
    h+='</g>';
    for(let i=0;i<2+Math.floor(k/2);i++){const x=1085+Math.sin(i*2.1)*90,y=350+i*33;h+='<circle cx="'+x+'" cy="'+y+'" r="'+(11+k)+'" fill="'+(i%2?v.colors[0]:v.colors[1])+'" stroke="#fff6d9" stroke-width="3"/><path d="M'+(x-5)+' '+(y-6)+' l6 -2" stroke="#fffdf1" stroke-width="3" stroke-linecap="round"/>';}
    return h;
  }
  function bodyAura(v) {
    const k=v.level;let h='<g fill="none" stroke="'+v.colors[1]+'" stroke-width="'+(5+k*.5)+'" opacity=".92">';
    h+='<path d="M555 650 Q490 530 540 405 M1030 405 Q1090 535 1025 650"/>';
    for(let i=0;i<2+Math.floor(k/2);i++){const y=640-i*41;h+='<path d="M'+(530-i*8)+' '+y+' q-40 -24 -60 -2 M'+(1050+i*8)+' '+y+' q40 -24 60 -2"/>';}
    h+='<ellipse cx="790" cy="760" rx="'+(290+k*12)+'" ry="75" stroke="'+v.colors[0]+'"/>';
    if(k>=3)h+='<path d="M585 312 Q785 '+(100-k*4)+' 985 312" stroke="'+v.colors[2]+'"/>';
    h+='</g>';
    const x=1175,y=510;
    h+='<g transform="translate('+x+' '+y+') rotate(12)"><path d="M-60 -80 Q0 -112 60 -80 L48 26 -48 26Z" fill="url(#body-'+v.key+')" stroke="'+v.colors[2]+'" stroke-width="5"/><path d="M-48 20 H48 L61 68 Q0 105 -61 68Z" fill="url(#gold-'+v.key+')" stroke="'+v.colors[2]+'" stroke-width="4"/><path d="M0 -75 l27 40 -27 35 -27 -35Z" fill="'+v.colors[1]+'" stroke="'+v.colors[2]+'" stroke-width="3"/>';
    for(let i=0;i<3+Math.floor(k/3);i++)h+='<path d="M-'+(20+i*8)+' '+(37+i*9)+' H'+(20+i*8)+'" stroke="'+v.colors[0]+'" stroke-width="4"/>';
    return h+'</g>';
  }
  function render(school, realmIdx) {
    const v=info(school,realmIdx);if(!v)return '';
    const k=v.level,c=v.colors;
    let h='<svg class="cute-school-art" data-school-art="'+v.key+'" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" role="img" aria-label="'+XG.util.esc(v.name)+'"><title>'+XG.util.esc(v.name)+'</title><defs>';
    h+='<linearGradient id="metal-'+v.key+'" x1="0" x2="1"><stop stop-color="'+c[0]+'"/><stop offset=".47" stop-color="#fffef0"/><stop offset=".53" stop-color="'+c[1]+'"/><stop offset="1" stop-color="'+c[0]+'"/></linearGradient>';
    h+='<linearGradient id="gold-'+v.key+'" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff4bd"/><stop offset=".4" stop-color="'+c[2]+'"/><stop offset=".68" stop-color="#f4db9b"/><stop offset="1" stop-color="#a8864d"/></linearGradient>';
    h+='<radialGradient id="body-'+v.key+'" cx=".35" cy=".3"><stop stop-color="'+c[1]+'"/><stop offset=".5" stop-color="'+c[0]+'"/><stop offset="1" stop-color="'+c[2]+'"/></radialGradient></defs>';
    if(school==='jian'){h+=sword(v,false,1200,610,1);if(k>=6)h+=sword(v,true,395,650,.65);}
    else if(school==='fu'){for(let i=0;i<3+Math.floor(k/2);i++){const a=i*2.4;h+=rune(v,1140+Math.cos(a)*115,400+Math.sin(a)*150+i*9,i);}if(k>=4)h+=rune(v,390,660,1);}
    else if(school==='zhen')h+=formation(v);
    else if(school==='dan')h+=furnace(v);
    else h+=bodyAura(v);
    for(let i=0;i<3+k;i++){const x=1040+Math.sin(i*8.2)*210,y=330+(i*73)%400,s=4+k*.4;h+='<path d="M'+x+' '+(y-s*2)+' l'+s+' '+s+' '+s+' '+s+' -'+s+' '+s+' -'+s+' '+s+' -'+s+' -'+s+' -'+s+' -'+s+' '+s+' -'+s+'Z" fill="'+c[1]+'" opacity=".9"/>';}
    return h+'</svg>';
  }
  XG.schoolArt={info:info,render:render};
})();
