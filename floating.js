(()=>{
 'use strict';
 const stage=document.querySelector('#stage-objects');
 const objectCount=15;
 function drawStage(){
  const pool=entries.filter(e=>typeof e.cover==='string'&&e.cover.trim().length>0);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  stage.innerHTML=pool.slice(0,objectCount).map((e,i)=>{
   const material=e.category==='音楽'?'is-disc':e.category==='映画'?'is-poster':e.category==='アート'?'is-framed':'';
   const art=e.cover?`<img src="${escapeHTML(e.cover)}" alt="${escapeHTML(e.title)}" draggable="false">`:`<span class="stage-title">${escapeHTML(e.title)}</span>`;
   return `<button class="stage-object object-${i+1} ${material}${e.cover?'':' is-text'}" style="--arrival:${i*55}ms;--object-scale:${(.82+Math.random()*.42).toFixed(3)}" data-entry="${e.id}" data-title="${escapeHTML(e.title)}" data-medium="${escapeHTML(e.category)}" aria-label="Read the note: ${escapeHTML(e.title)}"><span class="floating-art"><span class="object-face">${art}</span><span class="object-back" aria-hidden="true"><span class="back-label">${escapeHTML(e.title)}</span></span><span class="stage-label">${pad(entries.indexOf(e)+1)} / ${e.label}</span></span></button>`;
  }).join('');
 }
 drawStage();
 const menu=document.querySelector('#menu-dialog');
 const trigger=document.querySelector('#menu-open');
 trigger.addEventListener('click',()=>openArchiveDialog(menu));
 document.querySelector('#view-results').addEventListener('click',async()=>{
  await closeArchiveDialog(menu);
  const collection=document.querySelector('#collection'),heading=document.querySelector('#collection-title');
  heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
  sectionNavigation.toCollection();
 });
 const menuResult=document.querySelector('#menu-result'),viewResults=document.querySelector('#view-results');
 function updateResults(){
  const count=Number(document.querySelector('#result-count').textContent.match(/^\d+/)?.[0]||0);
  menuResult.textContent=count?`${count} ${count===1?'object':'objects'}`:'No matches. Try another search.';
  viewResults.disabled=count===0;
  viewResults.innerHTML=count?`View ${count} ${count===1?'object':'objects'} <span aria-hidden="true">↗</span>`:'No matches';
  document.querySelector('#menu-reset').hidden=collectionScope==='collection'&&!document.querySelector('#search').value&&!document.querySelector('.filter.active:not([data-filter="all"]),.rating-filter.active');
 }
 new MutationObserver(updateResults).observe(document.querySelector('#result-count'),{childList:true,characterData:true,subtree:true});updateResults();
 document.querySelector('#menu-reset').addEventListener('click',()=>{
  resetCollectionFilters();document.querySelector('#search').focus();
 });
 document.querySelector('#search').addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.isComposing&&!viewResults.disabled){event.preventDefault();viewResults.click();}
 });
 new MutationObserver(()=>trigger.setAttribute('aria-expanded',String(menu.open))).observe(menu,{attributes:true,attributeFilter:['open']});
 // Keep the reference's centered navigation on the hero, then clear the artwork.
 // Keep Index available for a future return, while exposing only Objects today.
 const collectionLayoutSwitchEnabled=false;
 let navFrame=0;
 function placeNav(){
  navFrame=0;
  const nav=document.querySelector('.central-nav'),layout=nav.querySelector('.collection-layout');
  const docked=document.querySelector('.object-stage').getBoundingClientRect().bottom<innerHeight*.6;
  nav.classList.toggle('nav-docked',docked);layout.hidden=!collectionLayoutSwitchEnabled||!docked;
 }
 function scheduleNav(){if(!navFrame)navFrame=requestAnimationFrame(placeNav);}
 addEventListener('scroll',scheduleNav,{passive:true});addEventListener('resize',scheduleNav,{passive:true});placeNav();
 const views=[document.querySelector('#view-objects'),document.querySelector('#view-index')];
 views.forEach((b,i)=>b.addEventListener('click',()=>{
  document.querySelector('#collection-grid').classList.toggle('index-mode',i===1);
  views.forEach(v=>v.setAttribute('aria-pressed',String(v===b)));
 }));
 // The keyboard shortcut opens the search control where it actually lives.
 document.addEventListener('keydown',event=>{
  if(event.key==='/'&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){
   event.preventDefault();openArchiveDialog(menu);document.querySelector('#search').focus();
  }
 },true);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 // Gallery cards enter and leave with scroll position; their opacity stays constant.

 // Keep the shared left-to-right orbit, with a loose cloud of works around its axis.
 // The period controls the overall rotation; each work has its own height, depth and lean.
 // Analytic damped springs stay consistent on slower phones and high-refresh displays.
 function makeSpring(){return {value:0,velocity:0};}
 function advanceSpring(s,target,dt){
  const t=Math.max(0,Math.min(dt,.05)),damping=7,frequency=10;
  const offset=s.value-target,decay=Math.exp(-damping*t),c=Math.cos(frequency*t),n=Math.sin(frequency*t);
  const wave=(s.velocity+damping*offset)/frequency;
  s.value=target+decay*(offset*c+wave*n);
  s.velocity=decay*((-damping*offset+frequency*wave)*c+(-damping*wave-frequency*offset)*n);
  if(Math.abs(s.value-target)<.0001&&Math.abs(s.velocity)<.001){s.value=target;s.velocity=0;}
  return s.value;
 }
 function flourishPose(start,now,disc){
  if(start===null)return {turn:0,lift:0,energy:0};
  const progress=Math.max(0,Math.min(1,(now-start)/1.65));
  const ease=progress*progress*(3-2*progress),arc=Math.sin(progress*Math.PI);
  return {turn:progress>=1?0:360*ease,lift:arc*(disc?24:18),energy:arc};
 }
 // Detached objects move in screen coordinates, independently of the rotating orbit.
 function freeFromPose(pose){return {...pose,vx:0,vy:0,spin:0,turn:0,releasedAt:Infinity,targetYaw:null,targetRoll:null};}
 function advanceFree(f,dt,width,height){
  const t=Math.max(0,Math.min(dt,.05)),decay=Math.exp(-.65*t),travel=(1-decay)/.65;
  f.x+=f.vx*travel;f.y+=f.vy*travel;f.vx*=decay;f.vy*=decay;
  const angular=Math.exp(-1.1*t),rotation=(1-angular)/1.1;
  f.roll+=f.spin*rotation;f.yaw+=f.turn*rotation;f.spin*=angular;f.turn*=angular;
  const edge=Math.min(40,width*.1,height*.1);
  if(f.x<edge){f.x=edge;if(f.vx<0)f.vx=-f.vx*.65;}
  if(f.x>width-edge){f.x=width-edge;if(f.vx>0)f.vx=-f.vx*.65;}
  if(f.y<edge){f.y=edge;if(f.vy<0)f.vy=-f.vy*.65;}
  if(f.y>height-edge){f.y=height-edge;if(f.vy>0)f.vy=-f.vy*.65;}
 }
 function returnProgress(f,now,index=0){
  if(!Number.isFinite(f.releasedAt))return 0;
  const delay=3+(index%5)*.18,duration=5+(index%4)*.22;
  const p=Math.max(0,Math.min(1,(now-f.releasedAt-delay)/duration));
  return p*p*p*(p*(p*6-15)+10);
 }
 function unwrapAngle(reference,angle){return reference+Math.atan2(Math.sin((angle-reference)*Math.PI/180),Math.cos((angle-reference)*Math.PI/180))*180/Math.PI;}
 function blendReturn(f,target,weight){
  f.targetYaw=unwrapAngle(f.targetYaw??f.yaw,target.yaw);f.targetRoll=unwrapAngle(f.targetRoll??f.roll,target.roll);
  const mixed={};
  for(const key of ['x','y','z','pitch','scale'])mixed[key]=f[key]+(target[key]-f[key])*weight;
  mixed.yaw=f.yaw+(f.targetYaw-f.yaw)*weight;mixed.roll=f.roll+(f.targetRoll-f.roll)*weight;
  return mixed;
 }
 // Soft velocity-only separation: no teleporting objects and no force on the held work.
 function separateFree(bodies,dt,width,height,held,now){
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const first=bodies[i],second=bodies[j],a=first.free,b=second.free;if(!a||!b)continue;
   const wa=first===held?0:1-returnProgress(a,now,first.i),wb=second===held?0:1-returnProgress(b,now,second.i);if(wa+wb<.001)continue;
   let dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
   const gap=(a.radius||Math.min(width,height)*.12)+(b.radius||Math.min(width,height)*.12);
   if(distance>=gap)continue;
   if(distance<.01){const angle=i*2.399+j*1.133;dx=Math.cos(angle);dy=Math.sin(angle);distance=1;}
   const nx=dx/distance,ny=dy/distance,closing=Math.max(0,-((b.vx-a.vx)*nx+(b.vy-a.vy)*ny));
   const impulse=Math.min(60,(650*(1-distance/gap)+closing*2.5)*dt),sum=wa+wb;
   a.vx-=nx*impulse*wa/sum;a.vy-=ny*impulse*wa/sum;b.vx+=nx*impulse*wb/sum;b.vy+=ny*impulse*wb/sum;
  }
 }
 const orbit={period:64,radius:320,perspective:1100,rotation:0,height:700};
 const heights=[-.9,.45,-.2,.95,-.6,.1,.72,-.95,.3,-.35,.86,-.55,.05,.6,-.78];
 const root=document.documentElement,field=document.querySelector('.object-stage');
 const grid=document.querySelector('#collection-grid'),fine=matchMedia('(hover: hover) and (pointer: fine)');
 let objects=[...stage.querySelectorAll('.stage-object')];
 const makeModels=()=>objects.map((item,i)=>({item,i,
  // Separate width/depth, height and facing so the shared orbit does not read as a rigid surface.
  angle:i*Math.PI*2/objects.length+.18+(Math.random()-.5)*.24,
  radiusScale:.8+Math.random()*.44,depthScale:.72+Math.random()*.52,
  level:heights[i]+(Math.random()-.5)*.08,
  roll:(Math.random()-.5)*48,yaw:(Math.random()-.5)*50,pitch:(Math.random()-.5)*24,
  pace:.3+Math.random()*.22,y:0,mobility:item.classList.contains('is-poster')?1.3:item.classList.contains('is-framed')?.7:1,
  free:null,pose:null,disc:item.classList.contains('is-disc'),hover:makeSpring(),slide:makeSpring(),bob:makeSpring(),rock:makeSpring(),pitchSpring:makeSpring(),flourish:null,screenX:0,screenY:0,
  paper:item.classList.contains('is-poster')?new PosterSheet(item):null}));
 let models=makeModels();
 const tooltip=document.createElement('span');tooltip.className='field-tooltip';tooltip.setAttribute('aria-hidden','true');document.body.append(tooltip);
 let active=false,raf=0,lastTime=0,time=0,stageVisible=true;
 let drag=null,suppressClickUntil=0,hovered=null,focused=null,pointer=null,nextSurprise=5.5,lastSurprise=null,grabOrder=0;
 const visible=new Set(),registered=new Set(),galleryModels=new Map();
 let galleryMeasureFrame=0,measuredWidth=0,measuredHeight=0;
 function layoutTop(element){let top=0;for(let node=element;node;node=node.offsetParent)top+=node.offsetTop;return top;}
 function measureGallery(){
  galleryMeasureFrame=0;
  for(const item of grid.querySelectorAll('.object-card')){
   const caption=item.querySelector('.object-caption'),style=getComputedStyle(item),top=layoutTop(item);
   const model=galleryModels.get(item)||{item,pose:null,written:{}};
   Object.assign(model,{top,height:item.offsetHeight,caption,captionTop:caption?layoutTop(caption)-top:0,captionHeight:caption?.offsetHeight||0,
    entryX:parseFloat(style.getPropertyValue('--entry-x'))||0,entryY:parseFloat(style.getPropertyValue('--entry-y'))||0});
   galleryModels.set(item,model);
  }
  for(const item of galleryModels.keys())if(!item.isConnected)galleryModels.delete(item);
  requestFrame();
 }
 function queueGalleryMeasure(){if(!galleryMeasureFrame)galleryMeasureFrame=requestAnimationFrame(measureGallery);}
 function measure(){
  const width=field.clientWidth,height=field.clientHeight;
  if(width===measuredWidth&&height===measuredHeight){requestFrame();return;}
  const oldWidth=measuredWidth,oldHeight=measuredHeight;
  measuredWidth=width;measuredHeight=height;
  if(oldWidth&&oldHeight)for(const m of models)if(m.free){const f=m.free,sx=width/oldWidth,sy=height/oldHeight;f.x*=sx;f.y*=sy;f.z*=sx;f.vx*=sx;f.vy*=sy;if(f.radius)f.radius*=Math.min(sx,sy);}
  orbit.height=height;
  orbit.radius=Math.min(width*.32,height*.57);orbit.perspective=Math.max(650,orbit.radius*3.4);
  stage.style.perspective=`${orbit.perspective}px`;
  models.forEach(m=>{
   // Use the whole height, allowing edges of large works to crop into the canvas boundary.
   // Previously fitting each full poster squeezed tall works into a narrow central belt.
   m.y=m.level*height*.44;m.size=m.item.offsetWidth;m.paper?.resize();
  });
  renderCylinder();requestFrame();
 }
 function detachObject(m,retake=false){
  if(!m||(!retake&&m.free)||!m.pose)return;
  m.free=freeFromPose(m.pose);m.free.order=++grabOrder;m.flourish=null;
  m.free.radius=Math.min(Math.min(measuredWidth,orbit.height)*.23,Math.max(32,(m.size||160)*.34*m.pose.scale*orbit.perspective/(orbit.perspective-m.pose.z)));
  m.item.classList.remove('is-returning');
  m.item.classList.add('is-free');
  for(const spring of [m.slide,m.bob,m.rock,m.pitchSpring]){spring.value=0;spring.velocity=0;}
 }
 function orbitPose(m){
  const angle=orbit.rotation+m.angle,phase=time*m.pace+m.i*1.9,interactive=!m.free&&!reduced.matches,hover=interactive?m.hover.value:0;
  const flourish=reduced.matches||m.free?{turn:0,lift:0,energy:0}:flourishPose(m.flourish,time,m.disc);
  const breathe=reduced.matches?0:Math.sin(phase*.63)*.035;
  const pullX=pointer&&hover?Math.max(-1,Math.min(1,(pointer.x-m.screenX)/140)):0,pullY=pointer&&hover?Math.max(-1,Math.min(1,(pointer.y-m.screenY)/140)):0;
  const x=Math.sin(angle)*orbit.radius*(m.radiusScale+breathe)+(interactive?m.slide.value:0)+pullX*hover*14,z=Math.cos(angle)*orbit.radius*m.depthScale+hover*80;
  const sway=reduced.matches?0:Math.sin(phase)*20+Math.cos(phase*.71)*8,tilt=reduced.matches?0:Math.sin(phase*.8)*6;
  const screenY=Math.max(-orbit.height*.48,Math.min(orbit.height*.48,m.y+sway+(interactive?m.bob.value:0)-hover*8-flourish.lift));
  return {x:measuredWidth*.5+x*orbit.perspective/(orbit.perspective-z),y:orbit.height*.5+screenY,z,
   yaw:angle*180/Math.PI+m.yaw+tilt*.7+pullX*hover*18+(m.disc?0:flourish.turn),
   pitch:m.pitch+tilt+(interactive?m.pitchSpring.value:0)-pullY*hover*14,
   roll:m.roll+tilt*.6+(interactive?m.rock.value:0)+(m.disc?flourish.turn:0),scale:1+hover*.07,gust:flourish.energy*750+hover*250};
 }
 function paintObject(m,pose,layer,gust=0){
  const {yaw,pitch,roll,scale}=pose,z=Math.min(pose.z,orbit.perspective*.55),factor=(orbit.perspective-z)/orbit.perspective;
  const x=(pose.x-measuredWidth*.5)*factor,y=(pose.y-orbit.height*.5)*factor;
  m.screenX=pose.x;m.screenY=pose.y;m.front=Math.cos(yaw*Math.PI/180)>.4;m.pose={...pose,z};
  m.item.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${yaw.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
  m.item.style.zIndex=String(Math.round(layer));m.item.style.setProperty('--turn-x',`${pitch.toFixed(2)}deg`);m.item.style.setProperty('--turn-z',`${roll.toFixed(2)}deg`);
  if(active&&m.paper&&visible.has(m.item)&&posterFacesCamera(yaw*Math.PI/180,pitch*Math.PI/180,x,y,z,orbit.perspective))m.paper.render(time,gust);
 }
 function renderFreeObject(m,target){
  const f=m.free,held=drag?.model===m&&drag.moved,weight=held?0:returnProgress(f,time,m.i);
  if(weight>=1){
   m.free=null;m.item.classList.remove('is-free','is-returning');
   for(const spring of [m.hover,m.slide,m.bob,m.rock,m.pitchSpring]){spring.value=0;spring.velocity=0;}
   paintObject(m,target,10000+target.z*10);return;
  }
  const flourish=reduced.matches?{turn:0,lift:0,energy:0}:flourishPose(m.flourish,time,m.disc);
  const pose=blendReturn(f,target,weight);
  pose.y-=flourish.lift*(1-weight);pose.yaw+=(m.disc?0:flourish.turn)*(1-weight);pose.roll+=(m.disc?flourish.turn:0)*(1-weight);
  const layer=held?50000+f.order:(30000+f.order)*(1-weight)+(10000+target.z*10)*weight;
  m.item.classList.toggle('is-returning',weight>0);
  paintObject(m,pose,layer,(f.vx+flourish.energy*750)*(1-weight));
 }
 function renderCylinder(){
  for(const m of models){const target=orbitPose(m);if(m.free)renderFreeObject(m,target);else paintObject(m,target,10000+target.z*10,target.gust);}
 }
 function sweepObjects(dx,dy,dt,x,y){
  for(const m of models){
   if(!m.free)continue;
   const distance=Math.hypot(m.free.x-x,m.free.y-y),reach=Math.max(160,measuredWidth*.3);
   const gain=(.18+.7*Math.exp(-distance*distance/(reach*reach)))*m.mobility;
   const angle=Math.sin(m.i*2.4+.5)*.5,c=Math.cos(angle),s=Math.sin(angle);
   m.free.vx=clamp(m.free.vx+(dx*c-dy*s)/dt*gain*.24,-1100,1100);
   m.free.vy=clamp(m.free.vy+(dx*s+dy*c)/dt*gain*.24,-900,900);
   m.free.spin=clamp(m.free.spin+dx*gain*.55,-140,140);
  }
 }
 function setHovered(item){
  const model=models.find(m=>m.item===item)||null;
  if(hovered===model)return;
  hovered=model;
  if(model&&active){model.rock.velocity+=(model.i%2?1:-1)*100*model.mobility;requestFrame();}
 }
 function updateObjectPlay(dt){
  if(!stageVisible)return;
  for(const m of models){
   advanceSpring(m.hover,!drag&&(m===hovered||m===focused)?1:0,dt);
   for(const spring of [m.slide,m.bob,m.rock,m.pitchSpring])advanceSpring(spring,0,dt);
   if(m.flourish!==null&&time-m.flourish>=1.65)m.flourish=null;
  }
  const loose=models.filter(m=>m.free),steps=Math.max(1,Math.ceil(dt*120)),step=dt/steps,held=drag?.moved?drag.model:null;
  for(let n=0;loose.length&&n<steps;n++){
   separateFree(loose,step,measuredWidth,orbit.height,held,time);
   for(const m of loose)if(m!==held)advanceFree(m.free,step,measuredWidth,orbit.height);
  }
  if(!drag&&!focused&&time>=nextSurprise){
   const candidates=models.filter(m=>!m.free&&m.front&&visible.has(m.item)&&m!==hovered&&m!==focused&&m!==lastSurprise&&m.flourish===null);
   if(candidates.length){const chosen=candidates[Math.floor(Math.random()*candidates.length)];chosen.flourish=time;lastSurprise=chosen;nextSurprise=time+6.5+Math.random()*3.5;}
   else nextSurprise=time+1;
  }
 }
 const visibility=new IntersectionObserver(items=>{
  items.forEach(({target,isIntersecting})=>{target.classList.toggle('motion-visible',isIntersecting);if(isIntersecting)visible.add(target);else visible.delete(target);});requestFrame();
 },{rootMargin:'60px'});
 new IntersectionObserver(([entry])=>{stageVisible=entry.isIntersecting;lastTime=0;if(stageVisible)nextSurprise=time+4;else{hovered=null;pointer=null;}requestFrame();}).observe(field);
 function registerMotion(){
  [...objects,...grid.querySelectorAll('.object-card')].forEach((item,i)=>{
   if(registered.has(item))return;registered.add(item);item.setAttribute('data-motion','');
   item.style.setProperty('--drift-duration',`${9+i%5*1.7}s`);item.style.setProperty('--drift-phase',`${-i*1.73}s`);
   item.style.setProperty('--drift-direction',i%2?'reverse':'normal');visibility.observe(item);
  });
  queueGalleryMeasure();
 }
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function galleryTarget(model,position,viewport){
  const center=model.top-position+model.height*.5;
  const progress=clamp((center-viewport*.5)/(viewport*.5+model.height*.5),-1,1);
  const captionCenter=model.top-position+model.captionTop+model.captionHeight*.5;
  const distance=clamp(Math.abs(captionCenter-viewport*.5)/(viewport*.5),0,1);
  return {x:model.entryX*progress*progress,y:model.entryY*progress,depth:clamp((viewport*.5-center)*.055,-24,24),scale:.96+.04*(1+Math.cos(distance*Math.PI))};
 }
 function followGallery(previous,target,dt){
  if(!previous)return {...target};
  const blend=1-Math.exp(-Math.min(dt,.05)/.045),next={};
  for(const key of ['x','y','depth','scale']){
   const remaining=target[key]-previous[key],epsilon=key==='scale'?.00004:.012;
   next[key]=Math.abs(remaining)<epsilon?target[key]:previous[key]+remaining*blend;
  }
  return next;
 }
 function galleryUnsettled(pose,target){return Math.abs(pose.x-target.x)>.012||Math.abs(pose.y-target.y)>.012||Math.abs(pose.depth-target.depth)>.012||Math.abs(pose.scale-target.scale)>.00004;}
 function requestFrame(){if(active&&!raf)raf=requestAnimationFrame(update);}
 function update(now){
  raf=0;if(!active)return;
  const dt=lastTime?Math.min((now-lastTime)/1000,.04):1/60;lastTime=now;time+=dt;
  if(stageVisible&&!stage.querySelector(':focus-visible'))orbit.rotation+=dt*Math.PI*2/orbit.period;
  orbit.rotation%=Math.PI*2;
  if(stageVisible){updateObjectPlay(dt);renderCylinder();}
  const galleryWrites=[];let galleryMoving=false;
  const windowed=root.classList.contains('collection-windowed'),collectionViewport=document.querySelector('#collection-viewport');
  const position=scrollY+(windowed?collectionViewport.scrollTop:0),viewport=innerHeight;
  if(!grid.classList.contains('index-mode'))for(const item of visible){
   const model=galleryModels.get(item);if(!model)continue;
   const target=galleryTarget(model,position,viewport);
   if(model.pose&&item.matches(':hover,:focus-within'))target.depth=model.pose.depth;
   model.pose=followGallery(model.pose,target,dt);
   galleryMoving=galleryUnsettled(model.pose,target)||galleryMoving;
   galleryWrites.push(model);
  }
  // All geometry is cached outside the animation loop; batch only composite updates here.
  for(const model of galleryWrites){
   const {item,caption,pose,written}=model;
   const values={'--slide-x':`${pose.x.toFixed(3)}px`,'--slide-y':`${pose.y.toFixed(3)}px`,'--scroll-depth':`${pose.depth.toFixed(3)}px`,'--caption-scale':pose.scale.toFixed(5)};
   for(const [key,value]of Object.entries(values))if(written[key]!==value){
    (key==='--caption-scale'?caption:item)?.style.setProperty(key,value);written[key]=value;
   }
  }
  if(stageVisible||galleryMoving)requestFrame();
 }
 function hideTooltip(){tooltip.classList.remove('visible');}
 function endDrag(event){
  if(!drag||event.pointerId!==drag.id)return;
  const finished=drag;drag=null;
  if(finished.moved){
   suppressClickUntil=performance.now()+400;
   for(const m of finished.model?[finished.model]:models)if(m.free)m.free.releasedAt=time;
   if(finished.model?.free){
    const f=finished.model.free,age=performance.now()-finished.last,velocity=event.type==='pointercancel'||age>120?0:Math.exp(-age/100);
    f.vx=finished.vx*velocity;f.vy=finished.vy*velocity;f.spin=clamp(finished.vx*.09+finished.vy*.035,-140,140)*velocity;f.turn=clamp(finished.vx*.035,-70,70)*velocity;
   }
  }
  if(field.hasPointerCapture(event.pointerId))field.releasePointerCapture(event.pointerId);
  field.classList.remove('is-dragging');requestFrame();
 }
 field.addEventListener('pointerdown',event=>{
  if(!active||event.button!==0||event.isPrimary===false||event.target.closest('a'))return;
  nextSurprise=time+6;pointer={x:event.clientX,y:event.clientY+scrollY};
  const model=models.find(m=>m.item===event.target.closest('.stage-object'))||null;
  drag={id:event.pointerId,model,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,last:performance.now(),vx:0,vy:0,moved:false,origin:null};
 });
 field.addEventListener('pointermove',event=>{
  if(!active)return;
  if(drag&&event.pointerId===drag.id){
   const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
   // Artworks are a two-dimensional drag surface; empty space keeps vertical navigation.
   if(!drag.moved&&!drag.model&&event.pointerType==='touch'&&Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
   if(!drag.moved&&Math.hypot(dx,dy)>8){
    drag.moved=true;field.setPointerCapture(event.pointerId);field.classList.add('is-dragging');hideTooltip();
    if(drag.model){
     detachObject(drag.model,true);const f=drag.model.free;
     if(f){f.order=++grabOrder;drag.origin={x:f.x,y:f.y,roll:f.roll,pitch:f.pitch};f.vx=f.vy=f.spin=f.turn=0;}
    }else for(const m of models)detachObject(m,true);
   }
   if(drag.moved){
    const stamp=performance.now(),dt=Math.max(16,stamp-drag.last)/1000;
    const moveX=event.clientX-drag.lastX,moveY=event.clientY-drag.lastY;
    if(drag.model?.free&&drag.origin){
     const f=drag.model.free;
     f.x=clamp(drag.origin.x+dx,-measuredWidth*.2,measuredWidth*1.2);f.y=clamp(drag.origin.y+dy,-orbit.height*.2,orbit.height*1.2);
     f.roll=drag.origin.roll+clamp(dx*.045-dy*.035,-28,28);f.pitch=drag.origin.pitch+clamp(dy*.035,-16,16);
    }else sweepObjects(moveX,moveY,dt,event.clientX,event.clientY+scrollY);
    hovered=null;nextSurprise=time+6;
    drag.vx=clamp(moveX/dt,-1100,1100);drag.vy=clamp(moveY/dt,-1100,1100);
    drag.lastX=event.clientX;drag.lastY=event.clientY;drag.last=stamp;requestFrame();return;
   }
  }
  if(!fine.matches||event.pointerType==='touch')return;
  const item=event.target.closest('.stage-object');
  pointer={x:event.clientX,y:event.clientY+scrollY};setHovered(item);
  if(item){tooltip.textContent=item.dataset.title+' ↗';tooltip.classList.add('visible');tooltip.style.left=`${clamp(event.clientX+18,12,innerWidth-260)}px`;tooltip.style.top=`${clamp(event.clientY+18,12,innerHeight-65)}px`;}else hideTooltip();
  requestFrame();
 },{passive:true});
 field.addEventListener('pointerover',event=>{if(active&&fine.matches&&!drag&&event.pointerType!=='touch'){pointer={x:event.clientX,y:event.clientY+scrollY};setHovered(event.target.closest('.stage-object'));}});
 field.addEventListener('pointerout',event=>{if(fine.matches&&!drag&&event.pointerType!=='touch')setHovered(event.relatedTarget instanceof Element?event.relatedTarget.closest('.stage-object'):null);});
 field.addEventListener('pointerup',endDrag);field.addEventListener('pointercancel',endDrag);field.addEventListener('lostpointercapture',event=>{if(drag)endDrag(event);});
 field.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}},true);
 field.addEventListener('pointerleave',()=>{hideTooltip();hovered=null;pointer=null;if(drag&&!drag.moved)drag=null;requestFrame();});
 field.addEventListener('focusin',event=>{const item=event.target.closest('.stage-object');focused=item?.matches(':focus-visible')?models.find(m=>m.item===item)||null:null;nextSurprise=time+6;requestFrame();});
 field.addEventListener('focusout',()=>{focused=null;requestFrame();});
 field.addEventListener('dragstart',event=>event.preventDefault());
 function sync(){
  const off=reduced.matches,suspended=document.hidden||!!document.querySelector('dialog[open]');
  active=!off&&!suspended;lastTime=0;root.classList.toggle('objects-motion-off',off);root.classList.toggle('objects-motion-suspended',suspended);
  if(!active){if(raf)cancelAnimationFrame(raf);raf=0;hideTooltip();hovered=null;pointer=null;if(drag)endDrag({pointerId:drag.id,type:'pointercancel'});for(const m of models){m.flourish=null;if(off&&m.free)m.free.vx=m.free.vy=m.free.spin=m.free.turn=0;for(const spring of [m.hover,m.slide,m.bob,m.rock,m.pitchSpring]){spring.value=0;spring.velocity=0;}}if(off)renderCylinder();}
  nextSurprise=time+5;
  requestFrame();
 }
 document.querySelector('#collection-viewport')?.addEventListener('scroll',()=>{hideTooltip();requestFrame();},{passive:true});
 addEventListener('scroll',()=>{hideTooltip();requestFrame();},{passive:true});addEventListener('resize',measure,{passive:true});
 document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
 const dialogObserver=new MutationObserver(sync);document.querySelectorAll('dialog').forEach(dialog=>dialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
 new MutationObserver(()=>{for(const item of registered)if(!item.isConnected){registered.delete(item);visible.delete(item);visibility.unobserve(item);}registerMotion();requestFrame();}).observe(grid,{childList:true,attributes:true,attributeFilter:['class']});
 function watchImages(){objects.forEach(item=>item.querySelector('img')?.addEventListener('load',measure));}
 new ResizeObserver(()=>{measure();queueGalleryMeasure();}).observe(field);watchImages();
 new ResizeObserver(queueGalleryMeasure).observe(grid);
 document.fonts?.ready.then(queueGalleryMeasure);
 registerMotion();measure();sync();root.classList.add('objects-motion-ready');
 // An opt-in comparison view; the normal page keeps its existing navigation.
 if(new URLSearchParams(location.search).get('nav-preview')==='1'){
  const options=document.querySelector('#nav-design-dialog'),open=document.querySelector('#design-options-open');
  open.hidden=false;open.addEventListener('click',()=>openArchiveDialog(options));
  options.querySelectorAll('[data-design]').forEach(button=>button.addEventListener('click',async()=>{
   document.querySelector('.central-nav').dataset.design=button.dataset.design;
   trigger.querySelector('span').textContent=button.dataset.design==='outline'?'↗':'+';
   await closeArchiveDialog(options);
  }));
  openArchiveDialog(options);
 }
})();
