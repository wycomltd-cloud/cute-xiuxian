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
module.exports={game};
