const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../detail-transition.js'),'utf8');
function setup(options={}){
 let now=0,frameId=0;const events={},animations=[],clones=[],frames=new Map();
 const classes=()=>{const values=new Set();return {add(...v){v.forEach(x=>values.add(x));},remove(...v){v.forEach(x=>values.delete(x));},contains:v=>values.has(v)};};
 class Element{
  constructor(rect={left:0,top:0,width:200,height:200}){this.rect=rect;this.style={};this.classList=classes();this.parentElement=null;this.isConnected=true;this.naturalWidth=1200;this.naturalHeight=1200;this.complete=true;this.src='cover.webp';this.currentSrc='cover.webp';}
  get clientWidth(){return parseFloat(this.style.width)||this.rect.width;}
  get clientHeight(){return parseFloat(this.style.height)||this.rect.height;}
  getBoundingClientRect(){return {...this.rect,right:this.rect.left+this.rect.width,bottom:this.rect.top+this.rect.height};}
  setAttribute(){}
  removeAttribute(name){if(name==='style')this.style={};}
  querySelector(selector){return this.parts?.[selector]||null;}
  querySelectorAll(selector){return selector==='*'?Object.values(this.parts||{}):[];}
  append(...nodes){for(const node of nodes)node.parentElement=this;}
  cloneNode(deep=false){
   const clone=new Element({...this.rect});clone.naturalWidth=this.naturalWidth;clone.naturalHeight=this.naturalHeight;clone.src=this.src;clone.currentSrc=this.currentSrc;clone.style={...this.style};clone.className=this.className||'';
   if(deep&&this.parts){clone.parts={};for(const [key,node]of Object.entries(this.parts))clone.parts[key]=node.cloneNode(false);}
   if(options.delayedDecode)clone.decode=()=>new Promise((resolve,reject)=>{clone.resolveDecode=resolve;clone.rejectDecode=reject;});
   return clone;
  }
  addEventListener(name,callback){(this.events??={})[name]=callback;}
  removeEventListener(name,callback){if(this.events?.[name]===callback)delete this.events[name];}
  remove(){this.isConnected=false;}
  animate(frames,settings){let resolve,reject;const result={element:this,frames,settings,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),finish(){resolve();},cancel(){this.cancelled=true;reject(Error('cancelled'));}};animations.push(result);return result;}
 }
 const sourceImage=new Element({left:20,top:350,width:160,height:120});sourceImage.style.rotate='-4deg';
 const targetImage=new Element({left:70,top:80,width:240,height:240});
 const button=new Element(),dialog=new Element({left:16,top:16,width:343,height:635}),body=new Element(),grid=new Element();
 sourceImage.parentElement=button;button.parentElement=grid;
 const stage=new Element({left:0,top:0,width:375,height:667});stage.style.perspective='700px';stage.style.perspectiveOrigin='187.5px 333.5px';
 if(options.hero){
  button.style.transform='matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,40,20,100,1)';button.parentElement=stage;
  button.parts={'.floating-art':new Element(),'.object-face':new Element(),'.object-face img':sourceImage};
 }
 button.closest=selector=>options.hero?(selector==='.stage-object'?button:selector==='#stage-objects'?stage:null):grid;
 button.querySelector=selector=>options.missing?null:options.hero?button.parts[selector]||null:sourceImage;
 dialog.querySelector=()=>targetImage;dialog.querySelectorAll=()=>[body];
 dialog.append=clone=>{clone.parentElement=dialog;clones.push(clone);};
 const reduced={matches:!!options.reduced,addEventListener(name,callback){this.changed=callback;}};
 const on=(name,callback)=>(events[name]??=[]).push(callback);
 const document={hidden:false,addEventListener:on,createElement(){return new Element({left:70,top:80,width:240,height:240});}};
 const context={document,Element,innerWidth:375,innerHeight:667,scrollY:options.hero?0:667,scrollX:0,performance:{now:()=>now},matchMedia:()=>reduced,addEventListener:on,getComputedStyle:node=>({transform:'none',scale:'none',rotate:'none',backgroundColor:'#f4f4f4',opacity:'1',...node.style}),DOMMatrixReadOnly:class{constructor(){this.a=1;this.b=0;this.is2D=true;}}};
 context.scrollTo=position=>{context.scrollY=position.top;context.scrollX=position.left;};
 context.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};context.cancelAnimationFrame=id=>frames.delete(id);
 context.window=context;context.visualViewport={addEventListener(){}};
 const api=vm.runInNewContext(source+';detailArtworkTransition',context);
 const reveal=()=>{dialog.open=true;if(options.focusJump)context.scrollY=478;};
 const live=()=>clones.filter(c=>c.isConnected&&c.className==='detail-artwork-flight');
 const scenes=()=>clones.filter(c=>c.isConnected&&c.className==='detail-object-scene');
 const flight=()=>animations.filter(a=>a.element===live()[0]&&a.frames.some(frame=>frame.transform)).at(-1);
 return {api,dialog,sourceImage,targetImage,button,animations,live,scenes,flight,reduced,document,context,open:()=>api.open(dialog,button,reveal),event:name=>(events[name]||[]).forEach(callback=>callback()),advance(ms){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(now));}};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test('the artwork grows from the real card with its tilt and natural proportions',()=>{
 const t=setup();t.open();assert(t.dialog.open);assert.equal(t.live().length,1);
 assert(t.sourceImage.classList.contains('artwork-flight-hidden'));assert(t.targetImage.classList.contains('artwork-flight-hidden'));
 const animation=t.flight();assert.equal(animation.settings.duration,520);
 assert(animation.frames[0].transform.includes('rotate(-4deg)'));assert(animation.frames[0].transform.includes('scale(0.5)'));
 assert(animation.frames[1].transform.includes('scale(1)'));assert.equal(t.live()[0].style.width,t.live()[0].style.height);
});
test('finishing the opening leaves one real detail image and removes the flying layer',async()=>{
 const t=setup();t.open();t.flight().finish();await flush();
 assert.equal(t.live().length,0);assert(!t.targetImage.classList.contains('artwork-flight-hidden'));
 assert(t.sourceImage.classList.contains('artwork-flight-hidden'));assert(!t.dialog.classList.contains('artwork-opening'));
});
test('closing returns the artwork and cleans up once even after repeated close requests',async()=>{
 const t=setup();t.open();t.flight().finish();await flush();let finishes=0;
 const promise=t.api.leave(t.dialog,()=>finishes++);assert.equal(promise,t.api.leave(t.dialog,()=>finishes++));
 assert.equal(t.live().length,1);assert(t.targetImage.classList.contains('artwork-flight-hidden'));
 assert(t.flight().frames[1].transform.includes('rotate(-4deg)'));
 t.flight().finish();await promise;await flush();
 assert.equal(finishes,1);assert.equal(t.live().length,0);assert(!t.sourceImage.classList.contains('artwork-flight-hidden'));assert(!t.targetImage.classList.contains('artwork-flight-hidden'));
});
test('closing during enlargement reverses without revealing a duplicate or leaving a layer behind',async()=>{
 const t=setup();t.open();const opening=t.flight();t.advance(180);let finishes=0;
 const closing=t.api.leave(t.dialog,()=>finishes++);await flush();assert(opening.cancelled);
 assert(t.targetImage.classList.contains('artwork-flight-hidden'));assert.equal(t.live().length,1);
 t.flight().finish();await closing;assert.equal(finishes,1);assert.equal(t.live().length,0);
});
test('a toolbar resize retargets opening without cutting it short and closing still completes safely',async()=>{
 const t=setup();t.open();const first=t.flight();t.advance(180);t.targetImage.rect.top+=40;t.event('resize');t.advance(16);await flush();
 assert(first.cancelled);assert.equal(t.live().length,1);assert(t.targetImage.classList.contains('artwork-flight-hidden'));
 assert.equal(t.flight().settings.duration,324);t.flight().finish();await flush();assert.equal(t.live().length,0);
 let finishes=0;const close=t.api.leave(t.dialog,()=>finishes++);t.event('resize');await close;assert.equal(finishes,1);assert.equal(t.live().length,0);
});
test('reduced motion, missing artwork and unloaded pictures retain the normal dialog',()=>{
 for(const options of [{reduced:true},{missing:true},{unloaded:true},{unsupported:true}]){
  const t=setup(options);if(options.unloaded)t.sourceImage.complete=false;if(options.unsupported)t.sourceImage.animate=undefined;
  t.open();assert(t.dialog.open);assert.equal(t.live().length,0);assert(!t.dialog.classList.contains('artwork-detail'));
 }
});
test('a scrolled-away detail image or removed source falls back without flying across the screen',async()=>{
 for(const removed of [false,true]){
  const t=setup();t.open();t.flight().finish();await flush();
  if(removed)t.sourceImage.isConnected=false;else t.targetImage.rect.top=-500;
  assert.equal(t.api.leave(t.dialog,()=>{}),null);assert.equal(t.live().length,0);assert(!t.sourceImage.classList.contains('artwork-flight-hidden'));
 }
});
test('direct dialog cancellation restores the original image and drops pending effects',async()=>{
 const t=setup();t.open();t.api.cancel(t.dialog);await flush();
 assert.equal(t.live().length,0);assert(!t.sourceImage.classList.contains('artwork-flight-hidden'));assert(!t.targetImage.classList.contains('artwork-flight-hidden'));
});
test('initial dialog scrolling retargets the image instead of skipping its enlargement',async()=>{
 const t=setup();t.open();const first=t.flight();t.advance(100);t.dialog.scrollTop=50;t.targetImage.rect.top-=50;t.dialog.events.scroll();t.advance(16);await flush();
 assert(first.cancelled);assert.equal(t.live().length,1);assert(t.targetImage.classList.contains('artwork-flight-hidden'));
 t.flight().finish();await flush();assert(!t.targetImage.classList.contains('artwork-flight-hidden'));
 assert(!t.dialog.events.scroll,'the transient listener is removed after handover');
});
test('the initial scroll reset on reopening does not cancel the enlargement',async()=>{
 const t=setup();t.open();t.dialog.scrollTop=0;t.dialog.events.scroll();await flush();
 assert.equal(t.live().length,1);assert(t.targetImage.classList.contains('artwork-flight-hidden'));
 t.flight().finish();await flush();assert.equal(t.live().length,0);
});
test('native focus restoration cannot move the collection behind the transition',async()=>{
 const t=setup({focusJump:true});t.open();assert.equal(t.context.scrollY,667);
 t.flight().finish();await flush();
 const close=t.api.leave(t.dialog,()=>{t.context.scrollY=478;});t.flight().finish();await close;
 assert.equal(t.context.scrollY,667);
});
test('posters and landscape artwork enlarge without changing their aspect ratio',()=>{
 for(const [width,height]of [[900,1600],[1600,900]]){
  const t=setup();t.sourceImage.naturalWidth=width;t.sourceImage.naturalHeight=height;t.open();
  const clone=t.live()[0];assert(Math.abs(parseFloat(clone.style.width)/parseFloat(clone.style.height)-width/height)<1e-9);
  t.api.cancel(t.dialog);
 }
});
test('opening waits for a decoded bitmap while keeping the original card visible',async()=>{
 const t=setup({delayedDecode:true});t.open();const clone=t.live()[0];
 assert(t.dialog.classList.contains('artwork-preparing'));assert(!t.sourceImage.classList.contains('artwork-flight-hidden'));
 assert(t.targetImage.classList.contains('artwork-flight-hidden'));assert.equal(t.animations.length,0);
 clone.resolveDecode();await flush();assert(!t.dialog.classList.contains('artwork-preparing'));
 assert(t.sourceImage.classList.contains('artwork-flight-hidden'));assert.equal(t.flight().settings.duration,520);
 t.flight().finish();await flush();
});
test('closing before decode finishes cannot reopen or leave an invisible card',async()=>{
 const t=setup({delayedDecode:true});t.open();const clone=t.live()[0];let finishes=0;
 await t.api.leave(t.dialog,()=>finishes++);clone.resolveDecode();await flush();
 assert.equal(finishes,1);assert.equal(t.live().length,0);assert.equal(t.animations.length,0);assert(!t.sourceImage.classList.contains('artwork-flight-hidden'));
});
test('decode failure leaves a usable detail dialog without a blank floating image',async()=>{
 const t=setup({delayedDecode:true});t.open();t.live()[0].rejectDecode(Error('decode failed'));await flush();
 assert.equal(t.live().length,0);assert(t.dialog.open);assert(!t.targetImage.classList.contains('artwork-flight-hidden'));assert(!t.dialog.classList.contains('artwork-preparing'));
});

test('a 3D hero work lifts intact toward the viewer before becoming the detail image',async()=>{
 const t=setup({hero:true});t.open();assert.equal(t.live().length,1);assert.equal(t.scenes().length,1);
 assert(t.button.classList.contains('artwork-flight-hidden'));assert(!t.sourceImage.classList.contains('artwork-flight-hidden'));
 const flight=t.flight();assert.equal(flight.settings.duration,700);assert.equal(flight.frames.length,3);assert.equal(flight.frames[1].offset,.38);
 assert(t.animations.some(a=>a.element.classList?.contains('detail-object-flight')));
 flight.finish();await flush();assert.equal(t.scenes().length,0);assert.equal(t.live().length,0);assert(!t.targetImage.classList.contains('artwork-flight-hidden'));
});
test('hero transitions preserve the existing simple close and restore the complete original object',async()=>{
 const t=setup({hero:true});t.open();t.flight().finish();await flush();assert.equal(t.api.leave(t.dialog,()=>{}),null);
 assert(!t.button.classList.contains('artwork-flight-hidden'));assert.equal(t.scenes().length,0);assert.equal(t.live().length,0);
});
test('closing a hero while decoding removes the material copy and never starts a later flight',async()=>{
 const t=setup({hero:true,delayedDecode:true});t.open();const clone=t.live()[0];assert.equal(t.scenes().length,1);assert(!t.button.classList.contains('artwork-flight-hidden'));
 assert.equal(t.api.leave(t.dialog,()=>{}),null);clone.resolveDecode();await flush();assert.equal(t.scenes().length,0);assert.equal(t.live().length,0);assert.equal(t.animations.length,0);
});
test('a phone resize retargets a hero flight to the new image while cleaning up the material layer',async()=>{
 const t=setup({hero:true});t.open();const initial=t.flight();t.advance(200);t.targetImage.rect.top+=50;t.event('resize');t.advance(16);await flush();
 assert(initial.cancelled);assert.equal(t.flight().settings.duration,484);t.flight().finish();await flush();assert.equal(t.scenes().length,0);assert.equal(t.live().length,0);
});
test('hero decode failure leaves a usable detail image and no hidden original artifact',async()=>{
 const t=setup({hero:true,delayedDecode:true});t.open();t.live()[0].rejectDecode(Error('decode failed'));await flush();
 assert.equal(t.scenes().length,0);assert.equal(t.live().length,0);assert(!t.button.classList.contains('artwork-flight-hidden'));assert(!t.targetImage.classList.contains('artwork-flight-hidden'));assert(t.dialog.open);
});

test('the initial dialog scroll reset does not flatten or shorten the hero approach',async()=>{
 const t=setup({hero:true});t.open();const flight=t.flight();t.dialog.scrollTop=0;t.dialog.events.scroll();t.advance(16);await flush();
 assert.equal(t.flight(),flight);assert(!flight.cancelled);assert.equal(flight.frames.length,3);
});
