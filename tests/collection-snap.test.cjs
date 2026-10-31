const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../collection-snap.js'),'utf8');
function setup(options={}){
 let time=0,id=0,dialog=false,rows=254;
 const timers=new Map(),frames=new Map(),listeners={},viewListeners={},observers=[];
 const style=()=>{const values=new Map();return {getPropertyValue:n=>values.get(n)||'',setProperty(n,v){values.set(n,v);if(n==='--collection-row-height')rows=parseFloat(v);},removeProperty:n=>values.delete(n)};};
 const classes=()=>{const set=new Set();return {contains:v=>set.has(v),add:v=>set.add(v),remove:v=>set.delete(v),toggle(v,on){if(on)set.add(v);else set.delete(v);}};};
 class Element{closest(){return options.editable?{}:null;}}
 const collection={offsetTop:700,offsetParent:null},target=new Element(),root={classList:classes(),style:style()};
 const grid={children:[],classList:classes(),style:style(),contains:()=>false};
 const on=(all,name,fn)=>(all[name]??=[]).push(fn);
 const viewport={offsetTop:760,offsetParent:null,clientHeight:560,scrollTop:options.y??620,style:style(),addEventListener:(n,f)=>on(viewListeners,n,f),get scrollHeight(){return 16+Math.ceil(grid.children.length/2)*(rows+20)-20+(parseFloat(grid.style.getPropertyValue('--collection-tail-space'))||16);}};
 const event=(name,props={},where=viewListeners)=>{const e={target,touches:[],preventDefault(){throw Error('native scroll must not be intercepted');},...props};(where[name]||[]).forEach(f=>f(e));};
 viewport.scrollTo=({top})=>{viewport.scrollTop=top;event('scroll');};
 if(options.nativeEnd)viewport.onscrollend=null;
 function setCards(count){grid.children=Array.from({length:count},(_,i)=>({classList:{contains:v=>v==='object-card'},get offsetTop(){return 16+Math.floor(i/(options.wide?4:2))*(rows+20);},offsetParent:viewport,querySelector(){return {offsetHeight:180};},get offsetHeight(){return options.oversized?900:rows-(i%2?0:32);}}));}
 setCards(options.cards??24);
 const media=matches=>({matches,addEventListener(n,f){this.changed=f;}}),phone=media(options.phone!==false),wide=media(!!options.wide),reduced=media(!!options.reduced);
 const document={documentElement:root,hidden:false,activeElement:options.editable?target:null,querySelector:s=>s==='#collection'?collection:s==='#collection-grid'?grid:s==='#collection-viewport'?viewport:s==='dialog[open]'&&dialog?{}:null,querySelectorAll:()=>[{}],addEventListener:(n,f)=>on(listeners,n,f)};
 const context={document,Element,innerHeight:740,scrollY:700,performance:{now:()=>time},addEventListener:(n,f)=>on(listeners,n,f),matchMedia:q=>q.includes('max-width')?phone:q.includes('min-width')?wide:reduced,MutationObserver:class{constructor(f){observers.push(f);}observe(){}},ResizeObserver:class{observe(){}},getComputedStyle:()=>({getPropertyValue:()=>'',paddingBottom:grid.style.getPropertyValue('--collection-tail-space')||'16px'}),requestAnimationFrame:f=>{frames.set(++id,f);return id;},cancelAnimationFrame:n=>frames.delete(n),setTimeout:(f,delay)=>{timers.set(++id,{f,at:time+delay});return id;},clearTimeout:n=>timers.delete(n)};
 context.scrollTo=({top})=>{context.scrollY=top;};context.window=context;context.visualViewport={height:740,scale:options.zoom||1,addEventListener(){}};
 vm.runInNewContext(source,context);
 function advance(ms){const end=time+ms;while(time<end){time=Math.min(end,time+16);for(const [key,t]of [...timers])if(t.at<=time){timers.delete(key);t.f();}const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(time));}}
 return {root,grid,collection,viewport,context,advance,event:(n,p)=>event(n,p),global:(n,p)=>event(n,p,listeners),scroll(y){viewport.scrollTop=y;event('scroll');},touch(n,y=300){event(n,{touches:n==='touchend'?[]:[{clientX:100,clientY:y}]},n==='touchend'?listeners:viewListeners);},setCards,setDialog(value){dialog=value;observers.forEach(f=>f());},resize(height){viewport.clientHeight=height;event('resize',{},listeners);},setReduced(value){reduced.matches=value;reduced.changed();},setPhone(value){phone.matches=value;phone.changed();}};
}
test('uses a native phone window without masking or changing any artwork opacity',()=>{
 const t=setup();assert(t.root.classList.contains('collection-windowed'));assert(!/rest-occluded|collection-at-rest|opacity/.test(source));
});
test('waits for momentum, aligns four locally, and never scrolls the outer page',()=>{
 const t=setup();t.scroll(620);t.advance(128);assert.equal(t.viewport.scrollTop,620);
 t.scroll(640);t.advance(650);assert.equal(t.viewport.scrollTop,548);assert.equal(t.context.scrollY,700);
});
test('a long gesture can cross multiple four-work stops',()=>{
 const t=setup();t.scroll(1800);t.advance(650);assert.equal(t.viewport.scrollTop,1918);
});
test('slow touch scrolling stays native until the finger lifts',()=>{
 const t=setup();t.touch('touchstart');
 for(let i=1;i<=6;i++){t.touch('touchmove',300-i*6);t.scroll(620+i);t.advance(400);assert.equal(t.viewport.scrollTop,620+i);}
 t.touch('touchend');t.advance(650);assert.equal(t.viewport.scrollTop,548);
});
test('new contact interrupts an active correction without restarting it',()=>{
 const t=setup();t.scroll(640);t.advance(432);assert(t.viewport.scrollTop<640);
 t.touch('touchstart');const y=t.viewport.scrollTop;t.advance(650);assert.equal(t.viewport.scrollTop,y);
 t.touch('touchend');t.advance(650);assert.equal(t.viewport.scrollTop,y);
});
test('new native motion cancels a correction and wins',()=>{
 const t=setup();t.scroll(640);t.advance(432);t.scroll(1150);t.advance(200);assert.equal(t.viewport.scrollTop,1150);
 t.advance(650);assert.equal(t.viewport.scrollTop,1096);
});
test('reduced motion, pinch zoom, editing and oversized text are not snapped',()=>{
 for(const opt of [{reduced:true},{zoom:2},{editable:true},{oversized:true}]){const t=setup(opt);t.scroll(640);t.advance(650);assert.equal(t.viewport.scrollTop,640);}
});
test('native scrollend prevents a premature snap between slow wheel events',()=>{
 const t=setup({nativeEnd:true});t.scroll(640);t.advance(1200);assert.equal(t.viewport.scrollTop,640);
 t.event('scrollend');t.advance(650);assert.equal(t.viewport.scrollTop,548);
});
test('opening a dialog cancels pending correction',()=>{
 const t=setup();t.scroll(640);t.setDialog(true);t.advance(650);assert.equal(t.viewport.scrollTop,640);
});
test('browser toolbar resize preserves the same resting passage',()=>{
 const t=setup();t.scroll(640);t.advance(650);t.resize(600);t.advance(100);assert.equal(t.viewport.scrollTop,588);
});
test('partial final groups can reach the top of the window',()=>{
 const t=setup({cards:5,y:0});assert(t.viewport.scrollHeight-t.viewport.clientHeight>=274);
 t.scroll(530);t.advance(650);assert.equal(t.viewport.scrollTop,274);
});
test('newly appended artworks retain equal row spacing',()=>{
 const t=setup({cards:12});t.setCards(24);t.scroll(1800);t.advance(650);assert.equal(t.viewport.scrollTop,1918);
});
test('turning reduced motion on immediately cancels a correction',()=>{
 const t=setup();t.scroll(640);t.advance(432);t.setReduced(true);const y=t.viewport.scrollTop;t.advance(650);assert.equal(t.viewport.scrollTop,y);
});

test('resting covers reserve clearance above the floating nav even with a full-height window',()=>{
 const t=setup();
 const coverLimit=parseFloat(t.viewport.style.getPropertyValue('--collection-cover-limit'));
 const rowHeight=parseFloat(t.viewport.style.getPropertyValue('--collection-row-height'));
 const metadata=74,diagonal=16,navTop=560-68;
 assert.equal(16+rowHeight+20+coverLimit+metadata+diagonal,navTop-8);
});

test('desktop uses four columns and snaps one full row at a time',()=>{
 const t=setup({phone:false,wide:true});assert(t.root.classList.contains('collection-windowed'));
 assert.equal(parseFloat(t.viewport.style.getPropertyValue('--collection-row-height')),528);
 t.scroll(640);t.advance(650);assert.equal(t.viewport.scrollTop,548);assert.equal(t.context.scrollY,700);
});
test('narrow desktop windows use two rows and stop after either row',()=>{
 const t=setup({phone:false});assert.equal(parseFloat(t.viewport.style.getPropertyValue('--collection-row-height')),254);
 t.scroll(340);t.advance(650);assert.equal(t.viewport.scrollTop,274);
});
test('resizing a browser keeps the collection at the top of the screen',()=>{
 const t=setup();t.collection.offsetTop=780;t.resize(600);t.advance(80);assert.equal(t.context.scrollY,780);
});

test('phones can rest with the old lower row at the top: works 3 through 6',()=>{
 const t=setup({y:0});t.scroll(340);t.advance(650);assert.equal(t.viewport.scrollTop,274);
});
test('a final full passage retains four works rather than exposing an unnecessary half-empty stop',()=>{
 for(const phone of [true,false]){
  const t=setup({phone,cards:6,y:0});t.scroll(800);t.advance(650);assert.equal(t.viewport.scrollTop,274);
  const f=setup({phone,cards:4,y:0});f.scroll(200);f.advance(650);assert.equal(f.viewport.scrollTop,0);
 }
});
test('four-column desktop windows retain full-row stops',()=>{
 const t=setup({phone:false,wide:true,y:0});t.scroll(340);t.advance(650);assert.equal(t.viewport.scrollTop,548);
});
test('switching to phone width keeps the same first artwork at a resting stop',()=>{
 const t=setup({phone:false});t.scroll(640);t.advance(650);assert.equal(t.viewport.scrollTop,548);
 t.setPhone(true);t.advance(80);assert.equal(t.viewport.scrollTop,548);
});

test('an empty filtered collection has no snapping destinations',()=>{
 const t=setup({cards:0,y:0});t.scroll(30);t.advance(650);assert.equal(t.viewport.scrollTop,30);
});
