// Snap only across the hero/collection boundary. The collection remains freely scrollable.
const sectionNavigation=(()=>{
 'use strict';
 const root=document.documentElement,collection=document.querySelector('#collection');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,moving=false,settling=false,releaseAt=0,lastWheel=-Infinity,wheelSum=0,touch=null,destination='top',nativeWheel=false;
 const boundary=()=>Math.max(0,collection.getBoundingClientRect().top+scrollY);
 const dialogOpen=()=>!!document.querySelector('dialog[open]');
 const editable=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"]');
 function finish(target,focus){
  scrollTo({top:target,behavior:'instant'});moving=false;frame=0;root.classList.remove('section-sliding');
  settling=true;releaseAt=performance.now()+140;wheelSum=0;
  if(focus){const heading=root.classList.contains('collection-windowed')?document.querySelector('#collection-viewport'):document.querySelector('#collection-title');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
 }
 function slide(where,{focus=false}={}){
  if(dialogOpen())return;
  if(frame)cancelAnimationFrame(frame);
  destination=where;const from=scrollY,to=where==='collection'?boundary():0;
  moving=true;settling=false;wheelSum=0;root.classList.add('section-sliding');
  if(reduced.matches||Math.abs(to-from)<2){finish(to,focus);return;}
  const start=performance.now(),duration=720;
  function step(now){
   const progress=Math.min(1,(now-start)/duration),ease=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
   scrollTo({top:from+(to-from)*ease,behavior:'instant'});
   if(progress<1)frame=requestAnimationFrame(step);else finish(to,focus);
  }
  frame=requestAnimationFrame(step);
 }
 function scrollableParent(target,delta){
  for(let el=target instanceof Element?target:null;el&&el!==document.body;el=el.parentElement){
   if(el.scrollHeight>el.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(el).overflowY)){
    if((delta<0&&el.scrollTop>0)||(delta>0&&el.scrollTop+el.clientHeight<el.scrollHeight-1))return true;
   }
  }
  return false;
 }
 function wheel(event){
  if(event.ctrlKey||event.metaKey||event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||dialogOpen()||editable(event.target))return;
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
  if(!delta)return;
  const now=performance.now(),gap=now-lastWheel;lastWheel=now;
  if(scrollableParent(event.target,delta)){nativeWheel=true;return;}
  // Reaching the top of the inner list does not turn its momentum into a home gesture.
  if(nativeWheel&&gap<180){event.preventDefault();return;}
  nativeWheel=false;
  // Swallow the rest of this gesture, including a trackpad's momentum tail.
  if(moving||(settling&&(gap<180||now<releaseAt))){event.preventDefault();return;}
  settling=false;
  if(gap>180||Math.sign(wheelSum)!==Math.sign(delta))wheelSum=0;
  const y=scrollY,b=boundary();
  if(y<b-2||(delta<0&&y<=b+2)){
   if(delta<0&&y<=1)return;
   event.preventDefault();wheelSum+=delta;
   if(Math.abs(wheelSum)>=12)slide(delta>0?'collection':'top');
  }else if(delta<0&&y+delta<b){
   // Arriving from deep in the list stops at its beginning; a new gesture goes home.
   event.preventDefault();slide('collection');
  }
 }
 addEventListener('wheel',wheel,{passive:false});
 document.addEventListener('touchstart',event=>{
  if(event.touches.length!==1||dialogOpen()||editable(event.target)||(!root.classList.contains('objects-motion-off')&&event.target instanceof Element&&event.target.closest('.stage-object'))){touch=null;return;}
  const p=event.touches[0];touch={x:p.clientX,y:p.clientY,startY:scrollY,lastY:p.clientY,mode:moving?'snapped':null};
  // A new finger contact is a new gesture, unlike wheel momentum.
  if(!moving)settling=false;
 },{passive:true});
 document.addEventListener('touchmove',event=>{
  if(!touch||event.touches.length!==1||dialogOpen())return;
  const p=event.touches[0],dx=p.clientX-touch.x,dy=touch.y-p.clientY,step=touch.lastY-p.clientY;touch.lastY=p.clientY;
  if(touch.mode==='horizontal'||touch.mode==='native')return;
  if(moving||touch.mode==='snapped'){if(event.cancelable)event.preventDefault();return;}
  if(!touch.mode){
   if(scrollableParent(event.target,dy)){touch.mode='native';return;}
   if(Math.hypot(dx,dy)<14){
    // Reserve small vertical movements before the browser commits to native panning.
    const b=boundary(),towardSection=(touch.startY<b-2&&dy>0)||(touch.startY>1&&touch.startY<=b+2&&dy<0);
    if(towardSection&&Math.abs(dy)>Math.abs(dx)&&event.cancelable)event.preventDefault();
    return;
   }
   if(Math.abs(dx)>Math.abs(dy)){touch.mode='horizontal';return;}
   touch.mode='vertical';
  }
  if(scrollableParent(event.target,dy)){touch.mode='native';return;}
  const b=boundary();let to=null;
  if(touch.startY<b-2){if(dy>14)to='collection';else if(dy<-14&&touch.startY>1)to='top';}
  else if(touch.startY<=b+2&&dy<-14)to='top';
  else if(step<0&&scrollY+step<b)to='collection';
  if(to&&event.cancelable){event.preventDefault();touch.mode='snapped';slide(to);}
 },{passive:false});
 const endTouch=()=>{touch=null;};
 document.addEventListener('touchend',endTouch,{passive:true});document.addEventListener('touchcancel',endTouch,{passive:true});
 document.addEventListener('keydown',event=>{
  if(dialogOpen()||editable(event.target)||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.target instanceof Element&&event.target.closest('button,a,summary'))return;
  const down=event.key==='PageDown'||event.key==='ArrowDown'||(event.key===' '&&!event.shiftKey);
  const up=event.key==='PageUp'||event.key==='ArrowUp'||(event.key===' '&&event.shiftKey);
  if(!down&&!up)return;
  if(scrollableParent(event.target,up?-1:1))return;
  if(moving){event.preventDefault();return;}
  if(down&&scrollY<boundary()-2){event.preventDefault();slide('collection',{focus:true});}
  else if(up&&scrollY>1&&scrollY<=boundary()+2){event.preventDefault();slide('top');}
 },true);
 document.addEventListener('click',event=>{
  const link=event.target instanceof Element?event.target.closest('a[href="#collection"],a[href="#top"]'):null;
  if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||dialogOpen())return;
  event.preventDefault();const where=link.getAttribute('href')==='#top'?'top':'collection';
  slide(where,{focus:link.classList.contains('skip')});
 });
 addEventListener('resize',()=>{if(moving){cancelAnimationFrame(frame);finish(destination==='collection'?boundary():0,false);}});
 const modalObserver=new MutationObserver(()=>{
  if(dialogOpen()&&moving){cancelAnimationFrame(frame);finish(destination==='collection'?boundary():0,false);}
 });
 document.querySelectorAll('dialog').forEach(dialog=>modalObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
 return {toCollection:options=>slide('collection',options),toTop:()=>slide('top')};
})();
