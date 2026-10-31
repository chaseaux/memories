// The collection is a native scroll window at every width, with a soft four-work resting stop.
(()=>{
 'use strict';
 const collection=document.querySelector('#collection'),root=document.documentElement,grid=document.querySelector('#collection-grid'),viewport=document.querySelector('#collection-viewport');
 if(!grid||!viewport)return;
 const phone=matchMedia('(max-width:540px)'),wide=matchMedia('(min-width:901px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const nativeEnd='onscrollend' in viewport,quietTime=nativeEnd?80:300,duration=320;
 let timer=0,frame=0,layoutFrame=0,armed=false,touches=0,mouseDown=false,origin=null,lastScroll=-Infinity,lastWritten=null,scrollComplete=false,layoutStops=[],layoutStarts=[],previousPageStart=null;
 const enabled=()=>!grid.classList.contains('index-mode');
 const allowed=()=>enabled()&&!reduced.matches&&!document.hidden&&!document.querySelector('dialog[open]')
  &&!root.classList.contains('section-sliding')&&(!window.visualViewport||Math.abs(window.visualViewport.scale-1)<.02);
 const editable=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"]');
 function layoutTop(element){let top=0;for(let node=element;node;node=node.offsetParent)top+=node.offsetTop;return top;}
 function stop(disarm=true){
  clearTimeout(timer);timer=0;if(frame)cancelAnimationFrame(frame);
  frame=0;root.classList.remove('collection-settling');if(disarm)armed=false;
 }
 function queue(){clearTimeout(timer);if(armed&&(!nativeEnd||scrollComplete))timer=setTimeout(settle,quietTime);}
 function groups(){
  const cards=[...grid.children].filter(card=>card.classList.contains('object-card')),offset=layoutTop(viewport),result=[];
  // Every two-column layout can place either visible row at the top; four columns keep full-row stops.
  const step=wide.matches?4:2,limit=!wide.matches&&cards.length>0?Math.max(1,cards.length-2):cards.length;
  for(let i=0;i<limit;i+=step){
   const items=cards.slice(i,i+4),top=layoutTop(items[0])-offset,end=Math.max(...items.map(card=>layoutTop(card)-offset+card.offsetHeight));
   result.push({top,end,count:items.length,start:i});
  }
  return result;
 }
 function groupStop(group){return Math.max(0,group.top-16);}
 function setLayout(element,name,value){const text=`${value}px`;if(element.style.getPropertyValue(name)!==text)element.style.setProperty(name,text);}
 function syncLayout(){
  layoutFrame=0;
  const preservePage=previousPageStart!==null&&Math.abs(scrollY-previousPageStart)<3&&!root.classList.contains('section-sliding');
  const resting=!armed&&!frame&&!touches&&!mouseDown?layoutStops.findIndex(target=>Math.abs(target-viewport.scrollTop)<3):-1;
  const restingStart=layoutStarts[resting]??0;
  root.classList.toggle('collection-windowed',enabled());
  if(!enabled()){
   layoutStops=[];layoutStarts=[];grid.style.removeProperty('--collection-tail-space');viewport.style.removeProperty('--collection-row-height');viewport.style.removeProperty('--collection-cover-limit');return;
  }
  // Four columns on a wide screen, two staggered rows on smaller screens.
  setLayout(root,'--collection-page-height',Math.min(innerHeight,window.visualViewport?.height||innerHeight));
  const rows=wide.matches?1:2,rowHeight=Math.max(48,(viewport.clientHeight-32-20*(rows-1))/rows);
  setLayout(viewport,'--collection-row-height',rowHeight);
  // The scroll window reaches the screen edge; resting artwork still clears the floating nav.
  const nav=document.querySelector('.central-nav'),safeBottom=parseFloat(getComputedStyle(grid).getPropertyValue('--collection-safe-bottom'))||0;
  const contentReserve=Math.max(0,...[...grid.children].map(card=>{const cover=card.querySelector('.cover');return cover?card.offsetHeight-cover.offsetHeight:0;}));
  const navReserve=(phone.matches?38:42)+(nav?.offsetHeight||60)/2+safeBottom+8;
  const precedingRows=(rows-1)*(rowHeight+20),motionAllowance=phone.matches?16:24;
  setLayout(viewport,'--collection-cover-limit',Math.max(48,viewport.clientHeight-precedingRows-16-navReserve-contentReserve-motionAllowance));
  const pageStart=collection?layoutTop(collection):null;
  if(preservePage&&pageStart!==null&&Math.abs(scrollY-pageStart)>1)scrollTo({top:pageStart,behavior:'instant'});
  previousPageStart=pageStart;
  const items=groups();
  if(!items.length){layoutStops=[];layoutStarts=[];setLayout(grid,'--collection-tail-space',16);return;}
  const padding=parseFloat(getComputedStyle(grid).paddingBottom)||16,last=items[items.length-1];
  const withoutTail=viewport.scrollHeight-padding;
  // Allow the final one, two or three records to align without inserting any internal gaps.
  setLayout(grid,'--collection-tail-space',Math.max(16,Math.ceil(groupStop(last)+viewport.clientHeight-withoutTail)));
  const stopGroups=groups().filter(group=>group.end-group.top<=viewport.clientHeight-24);
  layoutStops=stopGroups.map(groupStop);layoutStarts=stopGroups.map(group=>group.start);
  // Keep the same works in view when the column count or viewport height changes.
  const restore=stopGroups.reduce((chosen,group,index)=>group.start<=restingStart?index:chosen,0);
  if(resting>=0&&layoutStops[restore]!==undefined&&Math.abs(layoutStops[restore]-viewport.scrollTop)>1){
   lastWritten=layoutStops[restore];viewport.scrollTo({top:lastWritten,behavior:'instant'});
  }
 }
 function queueLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(syncLayout);}
 function anchors(){
  const maximum=Math.max(0,viewport.scrollHeight-viewport.clientHeight);
  return groups().filter(group=>group.end-group.top<=viewport.clientHeight-24).map(group=>Math.min(maximum,groupStop(group)));
 }
 function settle(){
  timer=0;if(!armed)return;
  if(!allowed()){stop();return;}
  if(touches||mouseDown)return;
  if(performance.now()-lastScroll<quietTime-1){queue();return;}
  const positions=anchors();if(!positions.length){stop();return;}
  const from=viewport.scrollTop,to=positions.reduce((nearest,value)=>Math.abs(value-from)<Math.abs(nearest-from)?value:nearest);
  armed=false;if(Math.abs(to-from)<3)return;
  const began=performance.now();root.classList.add('collection-settling');
  function step(now){
   if(!allowed()){stop();return;}
   const progress=Math.min(1,(now-began)/duration),ease=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
   lastWritten=from+(to-from)*ease;viewport.scrollTo({top:lastWritten,behavior:'instant'});
   if(progress<1)frame=requestAnimationFrame(step);else{frame=0;root.classList.remove('collection-settling');}
  }
  frame=requestAnimationFrame(step);
 }
 viewport.addEventListener('scroll',()=>{
  if(lastWritten!==null&&Math.abs(viewport.scrollTop-lastWritten)<2)return;
  if(frame)stop();
  if(!allowed()||editable(document.activeElement)){stop();return;}
  const focused=document.activeElement;
  if(focused instanceof Element&&grid.contains(focused)&&focused.matches(':focus-visible')){stop();return;}
  if(touches&&!origin?.vertical)return;
  armed=true;lastWritten=null;scrollComplete=false;lastScroll=performance.now();queue();
 },{passive:true});
 viewport.addEventListener('scrollend',()=>{if(frame||!armed)return;scrollComplete=true;queue();},{passive:true});
 viewport.addEventListener('touchstart',event=>{
  stop();touches=event.touches.length;
  origin=touches===1?{x:event.touches[0].clientX,y:event.touches[0].clientY,vertical:false}:null;
 },{passive:true});
 viewport.addEventListener('touchmove',event=>{
  if(!origin||event.touches.length!==1||!allowed()||editable(event.target))return;
  const point=event.touches[0],dx=point.clientX-origin.x,dy=point.clientY-origin.y;
  if(Math.abs(dy)>5&&Math.abs(dy)>Math.abs(dx))origin.vertical=true;
 },{passive:true});
 const release=event=>{touches=event.touches.length;if(!touches){origin=null;queue();}};
 document.addEventListener('touchend',release,{passive:true});document.addEventListener('touchcancel',release,{passive:true});
 viewport.addEventListener('wheel',()=>stop(),{passive:true});
 viewport.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'){stop();mouseDown=true;}},{passive:true});
 const releaseMouse=()=>{mouseDown=false;queue();};
 document.addEventListener('pointerup',releaseMouse,{passive:true});document.addEventListener('pointercancel',releaseMouse,{passive:true});
 document.addEventListener('keydown',()=>stop(),true);
 function resized(){const retry=armed||!!frame;stop();armed=retry;if(!allowed())stop();else queue();queueLayout();}
 addEventListener('resize',resized,{passive:true});window.visualViewport?.addEventListener('resize',resized,{passive:true});
 addEventListener('blur',()=>{touches=0;mouseDown=false;origin=null;queue();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();touches=0;mouseDown=false;origin=null;}});
 const modalObserver=new MutationObserver(()=>{if(document.querySelector('dialog[open]'))stop();});
 document.querySelectorAll('dialog').forEach(dialog=>modalObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
 phone.addEventListener('change',()=>{stop();queueLayout();});wide.addEventListener('change',()=>{stop();queueLayout();});reduced.addEventListener('change',()=>{stop();queueLayout();});
 new ResizeObserver(queueLayout).observe(viewport);
 new MutationObserver(queueLayout).observe(grid,{childList:true,attributes:true,attributeFilter:['class']});
 document.fonts?.ready.then(queueLayout);
 syncLayout();
})();
