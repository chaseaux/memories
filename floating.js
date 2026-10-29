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
  document.querySelector('#menu-reset').hidden=!document.querySelector('#search').value&&!document.querySelector('.filter.active:not([data-filter="all"])');
 }
 new MutationObserver(updateResults).observe(document.querySelector('#result-count'),{childList:true,characterData:true,subtree:true});updateResults();
 document.querySelector('#menu-reset').addEventListener('click',()=>{
  document.querySelector('#search').value='';document.querySelector('[data-filter="all"]').click();document.querySelector('#search').focus();
 });
 document.querySelector('#search').addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.isComposing&&!viewResults.disabled){event.preventDefault();viewResults.click();}
 });
 new MutationObserver(()=>trigger.setAttribute('aria-expanded',String(menu.open))).observe(menu,{attributes:true,attributeFilter:['open']});
 // Keep the reference's centered navigation on the hero, then clear the artwork.
 let navFrame=0;
 function placeNav(){navFrame=0;document.querySelector('.central-nav').classList.toggle('nav-docked',document.querySelector('.object-stage').getBoundingClientRect().bottom<innerHeight*.6);}
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
 const observer='IntersectionObserver' in window?new IntersectionObserver(items=>{
  items.forEach(item=>{if(item.isIntersecting){item.target.classList.add('seen');observer.unobserve(item.target);}});
 },{threshold:.05}):null;
 function reveal(){document.querySelectorAll('.object-card:not([data-observed])').forEach(card=>{
  card.dataset.observed='';
  if(observer&&!reduced.matches){card.classList.add('will-reveal');observer.observe(card);}else card.classList.add('seen');
 });}
 reveal();new MutationObserver(reveal).observe(document.querySelector('#collection-grid'),{childList:true});

 // Keep the shared left-to-right orbit, with a loose cloud of works around its axis.
 // The period controls the overall rotation; each work has its own height, depth and lean.
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
  pace:.3+Math.random()*.22,y:0,
  paper:item.classList.contains('is-poster')?new PosterSheet(item):null}));
 let models=makeModels();
 const tooltip=document.createElement('span');tooltip.className='field-tooltip';tooltip.setAttribute('aria-hidden','true');document.body.append(tooltip);
 let active=false,raf=0,lastTime=0,time=0,stageVisible=true;
 let drag=null,dragY=0,throwX=0,throwY=0,suppressClickUntil=0;
 const visible=new Set(),registered=new Set();
 function measure(){
  const width=field.clientWidth,height=field.clientHeight;
  orbit.height=height;
  orbit.radius=Math.min(width*.32,height*.57);orbit.perspective=Math.max(650,orbit.radius*3.4);
  stage.style.perspective=`${orbit.perspective}px`;
  models.forEach(m=>{
   // Use the whole height, allowing edges of large works to crop into the canvas boundary.
   // Previously fitting each full poster squeezed tall works into a narrow central belt.
   m.y=m.level*height*.44;m.paper?.resize();
  });
  renderCylinder();requestFrame();
 }
 function renderCylinder(){
  for(const m of models){
   const angle=orbit.rotation+m.angle,phase=time*m.pace+m.i*1.9;
   const breathe=reduced.matches?0:Math.sin(phase*.63)*.035;
   const x=Math.sin(angle)*orbit.radius*(m.radiusScale+breathe),z=Math.cos(angle)*orbit.radius*m.depthScale;
   const sway=reduced.matches?0:Math.sin(phase)*20+Math.cos(phase*.71)*8;
   const tilt=reduced.matches?0:Math.sin(phase*.8)*6;
   // Counter perspective's vertical compression so distant works still fill the top and bottom.
   const screenY=Math.max(-orbit.height*.46,Math.min(orbit.height*.46,m.y+sway+dragY*.15));
   const y=screenY*(orbit.perspective-z)/orbit.perspective;
   m.item.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${(angle*180/Math.PI+m.yaw+tilt*.7).toFixed(3)}deg)`;
   // Composite whole objects from back to front without intersecting their paper surfaces.
   m.item.style.zIndex=String(10000+Math.round(z*10));
   m.item.style.setProperty('--turn-x',`${(m.pitch+tilt).toFixed(2)}deg`);
   m.item.style.setProperty('--turn-z',`${(m.roll+tilt*.6).toFixed(2)}deg`);
   if(active&&m.paper&&visible.has(m.item)&&posterFacesCamera(angle+(m.yaw+tilt*.7)*Math.PI/180,(m.pitch+tilt)*Math.PI/180,x,y,z,orbit.perspective))m.paper.render(time,drag?.vx||throwX);
  }
 }
 const visibility=new IntersectionObserver(items=>{
  items.forEach(({target,isIntersecting})=>{target.classList.toggle('motion-visible',isIntersecting);if(isIntersecting)visible.add(target);else visible.delete(target);});requestFrame();
 },{rootMargin:'60px'});
 new IntersectionObserver(([entry])=>{stageVisible=entry.isIntersecting;lastTime=0;requestFrame();}).observe(field);
 function registerMotion(){
  [...objects,...grid.querySelectorAll('.object-card')].forEach((item,i)=>{
   if(registered.has(item))return;registered.add(item);item.setAttribute('data-motion','');
   item.style.setProperty('--drift-duration',`${9+i%5*1.7}s`);item.style.setProperty('--drift-phase',`${-i*1.73}s`);
   item.style.setProperty('--drift-direction',i%2?'reverse':'normal');visibility.observe(item);
  });
 }
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function requestFrame(){if(active&&!raf)raf=requestAnimationFrame(update);}
 function update(now){
  raf=0;if(!active)return;
  const dt=lastTime?Math.min((now-lastTime)/1000,.04):1/60;lastTime=now;time+=dt;
  if(!drag){
   if(stageVisible&&!stage.querySelector(':focus-visible'))orbit.rotation+=dt*(Math.PI*2/orbit.period+throwX/Math.max(180,orbit.radius)*.9);
   dragY+=throwY*dt;throwX*=Math.exp(-dt*4);throwY*=Math.exp(-dt*5);dragY*=Math.exp(-dt*3);
  }
  orbit.rotation%=Math.PI*2;
  if(stageVisible)renderCylinder();
  const scrollDepths=[],captionScales=[];
  if(!grid.classList.contains('index-mode'))for(const item of visible){
   if(!item.classList.contains('object-card'))continue;
   if(!item.matches(':hover,:focus-within')){
    const r=item.getBoundingClientRect();scrollDepths.push([item,`${clamp((innerHeight*.5-r.top-r.height*.5)*.055,-24,24)}px`]);
   }
   const caption=item.querySelector('.object-caption');
   if(caption){
    const r=caption.getBoundingClientRect(),distance=clamp(Math.abs(r.top+r.height*.5-innerHeight*.5)/(innerHeight*.5),0,1);
    const emphasis=(1+Math.cos(distance*Math.PI))*.5;
    captionScales.push([caption,(.96+.08*emphasis).toFixed(4)]);
   }
  }
  for(const[item,depth]of scrollDepths)item.style.setProperty('--scroll-depth',depth);
  for(const[caption,scale]of captionScales)caption.style.setProperty('--caption-scale',scale);
  if(stageVisible||Math.abs(throwX)+Math.abs(throwY)>1)requestFrame();
 }
 function hideTooltip(){tooltip.classList.remove('visible');}
 function endDrag(event){
  if(!drag||event.pointerId!==drag.id)return;
  if(drag.moved){suppressClickUntil=performance.now()+400;throwX=event.type==='pointercancel'?0:drag.vx;throwY=event.type==='pointercancel'?0:drag.vy;}
  if(field.hasPointerCapture(event.pointerId))field.releasePointerCapture(event.pointerId);
  drag=null;field.classList.remove('is-dragging');requestFrame();
 }
 field.addEventListener('pointerdown',event=>{
  if(!active||event.button!==0||event.target.closest('a'))return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,last:performance.now(),vx:0,vy:0,moved:false};
  throwX=throwY=0;
 });
 field.addEventListener('pointermove',event=>{
  if(!active)return;
  if(drag&&event.pointerId===drag.id){
   const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
   if(!drag.moved&&event.pointerType==='touch'&&Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
   if(!drag.moved&&Math.hypot(dx,dy)>8){drag.moved=true;field.setPointerCapture(event.pointerId);field.classList.add('is-dragging');hideTooltip();}
   if(drag.moved){
    const stamp=performance.now(),dt=Math.max(16,stamp-drag.last);
    orbit.rotation+=(event.clientX-drag.lastX)/Math.max(180,orbit.radius)*.9;
    dragY=clamp(dragY+(event.clientY-drag.lastY)*.6,-60,60);
    drag.vx=clamp((event.clientX-drag.lastX)/dt*1200,-840,840);drag.vy=clamp((event.clientY-drag.lastY)/dt*1200,-600,600);
    drag.lastX=event.clientX;drag.lastY=event.clientY;drag.last=stamp;requestFrame();return;
   }
  }
  if(!fine.matches||event.pointerType==='touch')return;
  const item=event.target.closest('.stage-object');
  if(item){tooltip.textContent=item.dataset.title+' ↗';tooltip.classList.add('visible');tooltip.style.left=`${clamp(event.clientX+18,12,innerWidth-260)}px`;tooltip.style.top=`${clamp(event.clientY+18,12,innerHeight-65)}px`;}else hideTooltip();
  requestFrame();
 },{passive:true});
 field.addEventListener('pointerup',endDrag);field.addEventListener('pointercancel',endDrag);field.addEventListener('lostpointercapture',event=>{if(drag)endDrag(event);});
 field.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}},true);
 field.addEventListener('pointerleave',()=>{hideTooltip();if(drag&&!drag.moved)drag=null;requestFrame();});
 field.addEventListener('dragstart',event=>event.preventDefault());
 function sync(){
  const off=reduced.matches,suspended=document.hidden||!!document.querySelector('dialog[open]');
  active=!off&&!suspended;lastTime=0;root.classList.toggle('objects-motion-off',off);root.classList.toggle('objects-motion-suspended',suspended);
  if(!active){if(raf)cancelAnimationFrame(raf);raf=0;hideTooltip();if(drag)endDrag({pointerId:drag.id,type:'pointercancel'});}
  requestFrame();
 }
 addEventListener('scroll',()=>{hideTooltip();requestFrame();},{passive:true});addEventListener('resize',measure,{passive:true});
 document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
 const dialogObserver=new MutationObserver(sync);document.querySelectorAll('dialog').forEach(dialog=>dialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
 new MutationObserver(()=>{for(const item of registered)if(!item.isConnected){registered.delete(item);visible.delete(item);visibility.unobserve(item);}registerMotion();requestFrame();}).observe(grid,{childList:true,attributes:true,attributeFilter:['class']});
 function watchImages(){objects.forEach(item=>item.querySelector('img')?.addEventListener('load',measure));}
 new ResizeObserver(measure).observe(field);watchImages();
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
