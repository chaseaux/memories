const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../section-scroll.js'),'utf8');
function setup(options={}){
 let time=0,id=0,dialog=false;const callbacks=new Map(),listeners={};
 class Element{closest(selector){return options.artwork&&selector==='.stage-object'?{}:null;}}
 const target=new Element(),body=new Element(),nested=new Element(),root={classList:{add(){},remove(){},contains(){return false;}}};
 if(options.nested){target.parentElement=nested;Object.assign(nested,{scrollTop:100,scrollHeight:2000,clientHeight:500});}
 const collection={getBoundingClientRect:()=>({top:720-context.scrollY})};
 const document={documentElement:root,body,querySelector:s=>s==='#collection'?collection:s==='dialog[open]'&&dialog?{}:null,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f};
 const context={document,Element,scrollY:0,innerHeight:720,matchMedia:()=>({matches:false}),performance:{now:()=>time},MutationObserver:class{observe(){}},getComputedStyle:node=>({overflowY:node===nested?'auto':'visible'}),addEventListener:(n,f)=>listeners[n]=f,requestAnimationFrame:f=>{callbacks.set(++id,f);return id;},cancelAnimationFrame:n=>callbacks.delete(n)};
 context.scrollTo=({top})=>context.scrollY=top;vm.runInNewContext(source,context);
 function advance(ms){for(let n=0;n<ms;n+=16){time+=16;const jobs=[...callbacks.values()];callbacks.clear();jobs.forEach(f=>f(time));}}
 function event(name,props={}){const e={target,cancelable:true,prevented:false,preventDefault(){this.prevented=true;},...props};listeners[name](e);return e;}
 const wheel=dy=>event('wheel',{deltaY:dy,deltaX:0,deltaMode:0});
 const touch=(name,x,y)=>event(name,{touches:name==='touchend'?[]:[{clientX:x,clientY:y}]});
 return {context,nested,advance,event,wheel,touch,setDialog:value=>dialog=value};
}
{
 const t=setup();assert(t.wheel(50).prevented);t.advance(800);assert.equal(t.context.scrollY,720);
 assert(t.wheel(30).prevented,'momentum must not overshoot');t.advance(200);assert(!t.wheel(120).prevented,'fresh list gesture stays native');
 t.context.scrollY=900;assert(t.wheel(-240).prevented);t.advance(1000);assert.equal(t.context.scrollY,720);
 t.wheel(-50);t.advance(1000);assert.equal(t.context.scrollY,0);
 t.setDialog(true);assert(!t.wheel(50).prevented,'modal keeps native scroll');
}
{
 const t=setup();t.touch('touchstart',100,300);assert(t.touch('touchmove',100,295).prevented,'reserve initial vertical touch');
 assert(t.touch('touchmove',100,270).prevented);t.advance(800);assert.equal(t.context.scrollY,720);
 assert(t.touch('touchmove',100,200).prevented,'same swipe cannot overshoot');t.touch('touchend');
 t.touch('touchstart',100,300);assert(!t.touch('touchmove',100,250).prevented,'list swipe stays native');t.touch('touchend');
 t.touch('touchstart',100,300);assert(t.touch('touchmove',100,340).prevented);t.advance(800);assert.equal(t.context.scrollY,0);
 t.touch('touchend');t.touch('touchstart',100,300);assert(!t.touch('touchmove',150,302).prevented,'horizontal object drag stays available');
}
{
 const t=setup({nested:true});t.context.scrollY=720;
 t.touch('touchstart',100,300);assert(!t.touch('touchmove',100,305).prevented,'small native window motions must not be reserved by the hero');
 assert(!t.touch('touchmove',100,330).prevented,'scrolling up inside the window must not navigate home');
 t.nested.scrollTop=0;assert(!t.touch('touchmove',100,370).prevented,'the same touch cannot navigate home at the list boundary');t.nested.scrollTop=100;
 assert(!t.event('keydown',{key:'PageUp'}).prevented,'keyboard scrolling inside the window remains native');
 assert(!t.wheel(-100).prevented);t.nested.scrollTop=0;assert(t.wheel(-60).prevented,'wheel momentum must stop at the window boundary');t.advance(200);t.wheel(-50);t.advance(800);assert.equal(t.context.scrollY,0);
}
{
 const t=setup({artwork:true});t.touch('touchstart',100,300);assert(!t.touch('touchmove',100,200).prevented,'an artwork drag belongs to the work rather than section navigation');assert.equal(t.context.scrollY,0);
}
console.log('Section scrolling: wheel, momentum, list boundary, modal, touch, and horizontal drag checks passed.');
