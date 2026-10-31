// A shared artwork connects both the 3D exhibition and collection cards to their detail dialog.
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
 function heroBox(image){
  if(!image?.naturalWidth||!image.naturalHeight)return null;
  const rect=image.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  return {cx:rect.left+rect.width/2,cy:rect.top+rect.height/2,width:rect.width,height:rect.width*image.naturalHeight/image.naturalWidth,angle:0};
 }
 function snapshotHero(button,image){
  const stage=button.closest('#stage-objects'),origin=heroBox(image);if(!stage||!origin)return null;
  const rect=stage.getBoundingClientRect(),style=getComputedStyle(stage),objectStyle=getComputedStyle(button);
  const perspective=parseFloat(style.perspective)||1100,object=button.cloneNode(true),scene=document.createElement('div');
  scene.className='detail-object-scene';scene.setAttribute('aria-hidden','true');
  Object.assign(scene.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,perspective:`${perspective}px`,perspectiveOrigin:style.perspectiveOrigin||'50% 50%'});
  const originals=[button,...button.querySelectorAll('*')],copies=[object,...object.querySelectorAll('*')];
  originals.forEach((node,i)=>{
   const copy=copies[i];if(!copy)return;const computed=getComputedStyle(node);
   Object.assign(copy.style,{animation:'none',transition:'none',transform:computed.transform,rotate:computed.rotate,scale:computed.scale});
   if(node.tagName==='CANVAS'){copy.width=node.width;copy.height=node.height;copy.getContext('2d')?.drawImage(node,0,0);}
  });
  object.classList.add('detail-object-flight');object.removeAttribute('data-entry');object.removeAttribute('aria-label');object.setAttribute('aria-hidden','true');object.tabIndex=-1;object.inert=true;
  Object.assign(object.style,{width:`${button.clientWidth}px`,height:`${button.clientHeight}px`,left:'50%',top:'50%',zIndex:'1',pointerEvents:'none',transform:objectStyle.transform});
  scene.append(object);
  return {scene,object,origin,rect,perspective,initialTransform:objectStyle.transform,artWidth:image.clientWidth||button.clientWidth,art:object.querySelector('.floating-art'),face:object.querySelector('.object-face'),fade:null};
 }
 function heroTransform(hero,box,depth=0){
  const factor=(hero.perspective-depth)/hero.perspective;
  const x=(box.cx-hero.rect.left-hero.rect.width/2)*factor,y=(box.cy-hero.rect.top-hero.rect.height/2)*factor,scale=box.width/hero.artWidth*factor;
  return `translate(-50%,-50%) translate3d(${x}px,${y}px,${depth}px) rotateY(0deg) scale(${scale})`;
 }
 function heroFlight(session,origin,destination){
  const h=session.hero,focus={cx:destination.cx*.45+innerWidth*.5*.55,cy:Math.max(innerHeight*.2,Math.min(innerHeight*.65,(origin.cy+destination.cy)*.5)),width:Math.max(origin.width,destination.width)*1.12,angle:0};
  focus.height=focus.width*session.height/session.width;
  const arrival='cubic-bezier(.2,.75,.25,1)',departure='cubic-bezier(.22,1,.36,1)';
  animate(session,h.object,[{transform:h.initialTransform,offset:0,easing:arrival},{transform:heroTransform(h,focus,Math.min(180,h.perspective*.18)),offset:.38,easing:departure},{transform:heroTransform(h,destination),offset:1}],{duration:session.duration,easing:'linear'});
  if(h.art)animate(session,h.art,[{transform:getComputedStyle(h.art).transform},{transform:'rotateX(0deg) rotateZ(0deg)'}],{duration:session.duration*.65,easing:ease});
  if(h.face){const from=getComputedStyle(h.face).rotate,angle=parseFloat(from)||0;animate(session,h.face,[{rotate:from==='none'?'0deg':from},{rotate:`${Math.round(angle/360)*360}deg`}],{duration:session.duration*.65,easing:ease});}
  animate(session,h.scene,[{opacity:1},{opacity:0}],{duration:190,delay:420,easing:'ease'});
  const flight=animate(session,session.clone,[{transform:pose(origin,session.width,session.height),offset:0,easing:arrival},{transform:pose(focus,session.width,session.height),offset:.38,easing:departure},{transform:pose(destination,session.width,session.height),offset:1}],{duration:session.duration,easing:'linear'});
  h.fade=animate(session,session.clone,[{opacity:0},{opacity:1}],{duration:210,delay:390,easing:'ease'});
  session.flight=flight;const finish=()=>{if(session.flight===flight)finishOpening(session);};flight.finished.then(finish,finish);
 }
 function pose(box,width,height){return `translate(${box.cx-width/2}px,${box.cy-height/2}px) rotate(${box.angle}deg) scale(${box.width/width})`;}
 function visible(box){return box&&box.cx+box.width/2>0&&box.cx-box.width/2<innerWidth&&box.cy+box.height/2>0&&box.cy-box.height/2<innerHeight;}
 function sameBox(a,b){return a&&b&&['cx','cy','width','height'].every(key=>Math.abs(a[key]-b[key])<1);}
 function restorePage(position){if(Math.abs(scrollY-position.top)>1||Math.abs(scrollX-position.left)>1)scrollTo({...position,behavior:'instant'});}
 function animate(session,element,keyframes,options){
  const animation=element.animate(keyframes,{fill:'both',...options});
  // Cancellation is expected when a visitor closes or rotates their phone mid-flight.
  animation.finished.catch(()=>{});session.animations.push(animation);return animation;
 }
 function cancelAnimations(session){for(const animation of session.animations)animation.cancel();session.animations=[];}
 function cancelLayout(session){if(session.layoutFrame)cancelAnimationFrame(session.layoutFrame);session.layoutFrame=0;}
 function clear(session){
  session.phase='done';cancelLayout(session);cancelAnimations(session);session.clone?.remove();session.hero?.scene.remove();
  session.dialog.removeEventListener('scroll',session.onScroll);
  (session.sourceNode||session.source).classList.remove('artwork-flight-hidden');session.target?.classList.remove('artwork-flight-hidden');
  session.dialog.classList.remove('artwork-detail','artwork-preparing','artwork-opening','artwork-closing');
  if(active===session)active=null;
 }
 function finishOpening(session){
  if(active!==session||session.phase!=='opening')return;
  session.phase='open';cancelLayout(session);session.dialog.classList.remove('artwork-preparing','artwork-opening');
  session.dialog.removeEventListener('scroll',session.onScroll);
  session.target.classList.remove('artwork-flight-hidden');session.clone?.remove();session.clone=null;session.hero?.scene.remove();
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
    const origin=session.hero?heroBox(session.source):imageBox(session.source);
    if(origin)session.clone.style.transform=pose(origin,session.width,session.height);
    return;
   }
   if(session.phase!=='opening')return;
   const remaining=session.started+session.duration-performance.now();
   const origin=imageBox(session.clone,session.source),destination=imageBox(session.target,session.source);
   if(remaining<=16||!origin||!destination){finishOpening(session);return;}
   if(sameBox(session.destination,destination))return;
   session.destination=destination;
   // Toolbar, focus and dialog scrolling can move the destination. Keep the original deadline.
   if(session.hero){
    const opacity=getComputedStyle(session.clone).opacity;session.hero.fade?.cancel();
    animate(session,session.clone,[{opacity},{opacity:1}],{duration:Math.min(120,remaining),easing:'ease'});
    animate(session,session.hero.scene,[{opacity:getComputedStyle(session.hero.scene).opacity},{opacity:0}],{duration:Math.min(120,remaining),easing:'ease'});
   }
   openingFlight(session,origin,destination,remaining);
  });
 }
 function startOpening(session){
  if(active!==session||session.phase!=='preparing')return;
  const origin=session.hero?session.hero.origin:imageBox(session.source),destination=imageBox(session.target,session.source);
  if(!origin||!destination){clear(session);return;}
  cancelLayout(session);
  session.width=destination.width;session.height=destination.height;
  Object.assign(session.clone.style,{width:`${session.width}px`,height:`${session.height}px`,transform:pose(origin,session.width,session.height)});
  session.phase='opening';session.started=performance.now();session.destination=destination;
  // Keep the original visible through a transparent dialog until its decoded copy is ready.
  (session.sourceNode||session.source).classList.add('artwork-flight-hidden');session.dialog.classList.remove('artwork-preparing');
  try{
   if(session.hero){session.hero.scene.style.visibility='visible';heroFlight(session,origin,destination);}else openingFlight(session,origin,destination,session.duration);
   animate(session,session.dialog,[{backgroundColor:'transparent'},{backgroundColor:session.background}],{duration:480,delay:session.hero?100:0,easing:ease});
   for(const node of textNodes(session.dialog))animate(session,node,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:session.hero?330:160,easing:ease});
  }catch{clear(session);}
 }
 function open(dialog,button,reveal){
  const inCollection=button?.closest('#collection-grid'),heroButton=!inCollection?button?.closest('.stage-object'):null;
  const source=inCollection?button.querySelector('.cover img'):heroButton?.querySelector('.object-face img');
  const supported=!reduced.matches&&source?.complete&&typeof source.animate==='function'&&typeof DOMMatrixReadOnly==='function';
  let hero=null;
  if(supported&&heroButton)try{hero=snapshotHero(heroButton,source);}catch{hero=null;}
  const origin=supported?(hero?hero.origin:inCollection?imageBox(source):null):null;
  if(!visible(origin)){reveal();return;}
  if(active)clear(active);
  const position={top:scrollY,left:scrollX};
  const background=getComputedStyle(dialog).backgroundColor;
  dialog.classList.add('artwork-detail','artwork-opening','artwork-preparing');
  reveal();
  restorePage(position);
  const target=dialog.querySelector('.detail-visual img'),destination=imageBox(target,source);
  if(!destination){dialog.classList.remove('artwork-detail','artwork-opening','artwork-preparing');return;}
  const session={dialog,source,sourceNode:heroButton||source,hero,duration:hero?700:520,target,button,position,background,phase:'preparing',animations:[],clone:null,flight:null,layoutFrame:0,width:destination.width,height:destination.height,started:performance.now()};active=session;
  session.onScroll=()=>retarget(session);dialog.addEventListener('scroll',session.onScroll,{passive:true});
  try{
   target.classList.add('artwork-flight-hidden');
   const clone=cloneArtwork(session,destination.width,destination.height);
   if(hero){hero.scene.style.visibility='hidden';clone.style.opacity='0';dialog.append(hero.scene);}
   clone.style.transform=pose(origin,destination.width,destination.height);
   if(typeof clone.decode==='function')clone.decode().then(()=>startOpening(session),()=>{if(active===session&&session.phase==='preparing')clear(session);});
   else startOpening(session);
  }catch{clear(session);}
 }
 function leave(dialog,finish){
  const session=active;if(!session||session.dialog!==dialog)return null;
  if(session.phase==='closing')return session.closing;
  if(session.hero){clear(session);return null;}
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
