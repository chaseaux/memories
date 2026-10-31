// One composited artwork connects a collection card to its native detail dialog.
const detailArtworkTransition=(()=>{
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),ease='cubic-bezier(.22,1,.36,1)';
 let active=null;
 function imageBox(image,reference=image){
  if(!image||!reference?.naturalWidth||!reference.naturalHeight)return null;
  const rect=image.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  const width=image.clientWidth||rect.width,height=image.clientHeight||rect.height;
  let scale=1,angle=0;
  for(let node=image;node instanceof Element;node=node.parentElement){
   const style=getComputedStyle(node);
   if(style.transform&&style.transform!=='none'){
    const matrix=new DOMMatrixReadOnly(style.transform);
    if(!matrix.is2D)return null;
    scale*=Math.hypot(matrix.a,matrix.b);angle+=Math.atan2(matrix.b,matrix.a)*180/Math.PI;
   }
   scale*=Math.abs(parseFloat(style.scale))||1;
   angle+=parseFloat(style.rotate)||0;
  }
  const fit=Math.min(width/reference.naturalWidth,height/reference.naturalHeight)*scale;
  return {cx:rect.left+rect.width/2,cy:rect.top+rect.height/2,width:reference.naturalWidth*fit,height:reference.naturalHeight*fit,angle};
 }
 function pose(box,width,height){return `translate(${box.cx-width/2}px,${box.cy-height/2}px) rotate(${box.angle}deg) scale(${box.width/width})`;}
 function visible(box){return box&&box.cx+box.width/2>0&&box.cx-box.width/2<innerWidth&&box.cy+box.height/2>0&&box.cy-box.height/2<innerHeight;}
 function restorePage(position){if(Math.abs(scrollY-position.top)>1||Math.abs(scrollX-position.left)>1)scrollTo({...position,behavior:'instant'});}
 function animate(session,element,keyframes,options){
  const animation=element.animate(keyframes,{fill:'both',...options});
  // Cancellation is expected when a visitor closes or rotates their phone mid-flight.
  animation.finished.catch(()=>{});session.animations.push(animation);return animation;
 }
 function cancelAnimations(session){for(const animation of session.animations)animation.cancel();session.animations=[];}
 function cancelLayout(session){if(session.layoutFrame)cancelAnimationFrame(session.layoutFrame);session.layoutFrame=0;}
 function clear(session){
  session.phase='done';cancelLayout(session);cancelAnimations(session);session.clone?.remove();
  session.dialog.removeEventListener('scroll',session.onScroll);
  session.source.classList.remove('artwork-flight-hidden');session.target?.classList.remove('artwork-flight-hidden');
  session.dialog.classList.remove('artwork-detail','artwork-preparing','artwork-opening','artwork-closing');
  if(active===session)active=null;
 }
 function finishOpening(session){
  if(active!==session||session.phase!=='opening')return;
  session.phase='open';cancelLayout(session);session.dialog.classList.remove('artwork-preparing','artwork-opening');
  session.dialog.removeEventListener('scroll',session.onScroll);
  session.target.classList.remove('artwork-flight-hidden');session.clone?.remove();session.clone=null;
  cancelAnimations(session);
 }
 function cloneArtwork(session,width,height){
  const clone=session.source.cloneNode(false);clone.className='detail-artwork-flight';clone.alt='';clone.draggable=false;clone.loading='eager';
  clone.removeAttribute('style');
  clone.setAttribute('aria-hidden','true');
  if(session.source.currentSrc&&clone.src!==session.source.currentSrc)clone.src=session.source.currentSrc;
  Object.assign(clone.style,{width:`${width}px`,height:`${height}px`});
  session.dialog.append(clone);session.clone=clone;return clone;
 }
 function textNodes(dialog){return [...dialog.querySelectorAll('.dialog-close,.detail-body,.entry-body,.detail-disclaimer')];}
 function openingFlight(session,origin,destination,duration){
  const previous=session.flight;session.flight=null;
  if(previous){previous.cancel();session.animations=session.animations.filter(animation=>animation!==previous);}
  const flight=animate(session,session.clone,[{transform:pose(origin,session.width,session.height)},{transform:pose(destination,session.width,session.height)}],{duration,easing:ease});
  session.flight=flight;
  const finish=()=>{if(session.flight===flight)finishOpening(session);};
  flight.finished.then(finish,finish);
 }
 function retarget(session){
  if(active!==session||!['preparing','opening'].includes(session.phase)||session.layoutFrame)return;
  session.layoutFrame=requestAnimationFrame(()=>{
   session.layoutFrame=0;
   if(active!==session)return;
   if(session.phase==='preparing'){
    const origin=imageBox(session.source);
    if(origin)session.clone.style.transform=pose(origin,session.width,session.height);
    return;
   }
   if(session.phase!=='opening')return;
   const remaining=session.started+520-performance.now();
   const origin=imageBox(session.clone,session.source),destination=imageBox(session.target,session.source);
   if(remaining<=16||!origin||!destination){finishOpening(session);return;}
   // Toolbar, focus and dialog scrolling can move the destination. Keep the original deadline.
   openingFlight(session,origin,destination,remaining);
  });
 }
 function startOpening(session){
  if(active!==session||session.phase!=='preparing')return;
  const origin=imageBox(session.source),destination=imageBox(session.target,session.source);
  if(!origin||!destination){clear(session);return;}
  cancelLayout(session);
  session.width=destination.width;session.height=destination.height;
  Object.assign(session.clone.style,{width:`${session.width}px`,height:`${session.height}px`,transform:pose(origin,session.width,session.height)});
  session.phase='opening';session.started=performance.now();
  // Keep the original visible through a transparent dialog until its decoded copy is ready.
  session.source.classList.add('artwork-flight-hidden');session.dialog.classList.remove('artwork-preparing');
  try{
   openingFlight(session,origin,destination,520);
   animate(session,session.dialog,[{backgroundColor:'transparent'},{backgroundColor:session.background}],{duration:480,easing:ease});
   for(const node of textNodes(session.dialog))animate(session,node,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:160,easing:ease});
  }catch{clear(session);}
 }
 function open(dialog,button,reveal){
  const source=button?.closest('#collection-grid')?button.querySelector('.cover img'):null;
  const origin=!reduced.matches&&source?.complete&&typeof source.animate==='function'&&typeof DOMMatrixReadOnly==='function'?imageBox(source):null;
  if(!visible(origin)){reveal();return;}
  if(active)clear(active);
  const position={top:scrollY,left:scrollX};
  const background=getComputedStyle(dialog).backgroundColor;
  dialog.classList.add('artwork-detail','artwork-opening','artwork-preparing');
  reveal();
  restorePage(position);
  const target=dialog.querySelector('.detail-visual img'),destination=imageBox(target,source);
  if(!destination){dialog.classList.remove('artwork-detail','artwork-opening','artwork-preparing');return;}
  const session={dialog,source,target,button,position,background,phase:'preparing',animations:[],clone:null,flight:null,layoutFrame:0,width:destination.width,height:destination.height,started:performance.now()};active=session;
  session.onScroll=()=>retarget(session);dialog.addEventListener('scroll',session.onScroll,{passive:true});
  try{
   target.classList.add('artwork-flight-hidden');
   const clone=cloneArtwork(session,destination.width,destination.height);
   clone.style.transform=pose(origin,destination.width,destination.height);
   if(typeof clone.decode==='function')clone.decode().then(()=>startOpening(session),()=>{if(active===session&&session.phase==='preparing')clear(session);});
   else startOpening(session);
  }catch{clear(session);}
 }
 function leave(dialog,finish){
  const session=active;if(!session||session.dialog!==dialog)return null;
  if(session.phase==='closing')return session.closing;
  if(session.phase==='preparing'){clear(session);finish();restorePage(session.position);return Promise.resolve();}
  const origin=imageBox(session.source),destination=imageBox(session.clone||session.target,session.source);
  const dialogBox=dialog.getBoundingClientRect();
  if(!session.source.isConnected||!visible(origin)||!visible(destination)||destination.cy<dialogBox.top||destination.cy>dialogBox.bottom){clear(session);return null;}
  const elapsed=performance.now()-session.started,wasOpening=session.phase==='opening';
  const background=getComputedStyle(dialog).backgroundColor;
  const texts=textNodes(dialog).map(node=>[node,getComputedStyle(node).opacity]);
  session.phase='closing';cancelLayout(session);cancelAnimations(session);session.clone?.remove();
  dialog.classList.remove('artwork-opening');dialog.classList.add('artwork-closing');
  session.target.classList.add('artwork-flight-hidden');
  let complete;
  session.closing=new Promise(resolve=>{complete=()=>{if(session.phase==='done')return;clear(session);finish();restorePage(session.position);resolve();};});
  session.complete=complete;
  try{
   const clone=cloneArtwork(session,destination.width,destination.height),duration=wasOpening?Math.max(160,Math.min(420,elapsed*.8)):420;
   const flight=animate(session,clone,[{transform:pose(destination,destination.width,destination.height)},{transform:pose(origin,destination.width,destination.height)}],{duration,easing:ease});
   animate(session,dialog,[{backgroundColor:background},{backgroundColor:'transparent'}],{duration,easing:'ease-in'});
   for(const[node,opacity]of texts)animate(session,node,[{opacity,transform:'translateY(0)'},{opacity:0,transform:'translateY(6px)'}],{duration:Math.min(180,duration),easing:'ease-out'});
   flight.finished.then(complete,complete);
  }catch{complete();}
  return session.closing;
 }
 function cancel(dialog){if(active?.dialog===dialog){if(active.phase==='closing')active.complete();else clear(active);}}
 function resized(){if(active?.phase==='opening'||active?.phase==='preparing')retarget(active);else if(active?.phase==='closing')active.complete();}
 function finishImmediately(){if(active?.phase==='preparing')clear(active);else if(active?.phase==='opening')finishOpening(active);else if(active?.phase==='closing')active.complete();}
 addEventListener('resize',resized,{passive:true});
 window.visualViewport?.addEventListener('resize',resized,{passive:true});
 reduced.addEventListener('change',()=>{if(reduced.matches)finishImmediately();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finishImmediately();});
 return {open,leave,cancel};
})();
