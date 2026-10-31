const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../floating.js'),'utf8');
const helper=source.slice(source.indexOf('function makeSpring()'),source.indexOf('const orbit='));
const {makeSpring,advanceSpring,flourishPose,freeFromPose,advanceFree,returnProgress,unwrapAngle,blendReturn,separateFree}=vm.runInNewContext(helper+';({makeSpring,advanceSpring,flourishPose,freeFromPose,advanceFree,returnProgress,unwrapAngle,blendReturn,separateFree})');
test('drag impulses visibly rock the artwork and decay back to its original pose',()=>{
 const s=makeSpring();s.velocity=220;let maximum=0;
 for(let i=0;i<120;i++){advanceSpring(s,0,1/60);maximum=Math.max(maximum,Math.abs(s.value));}
 assert(maximum>8&&maximum<20);assert(Math.abs(s.value)<.001);assert(Math.abs(s.velocity)<.001);
});
test('hover arrival has a bounded spring response and returns after leaving',()=>{
 const s=makeSpring();let maximum=0;
 assert(advanceSpring(s,1,1/60)>0);
 for(let i=0;i<90;i++){advanceSpring(s,1,1/60);maximum=Math.max(maximum,s.value);}
 assert(maximum>1&&maximum<1.2);assert(Math.abs(s.value-1)<.001);
 for(let i=0;i<120;i++)advanceSpring(s,0,1/60);
 assert(Math.abs(s.value)<.001);
});
test('the spring follows the same path at 30 and 60 frames per second',()=>{
 const slow=makeSpring(),fast=makeSpring();slow.velocity=fast.velocity=120;
 for(let i=0;i<15;i++)advanceSpring(slow,1,1/30);
 for(let i=0;i<30;i++)advanceSpring(fast,1,1/60);
 assert(Math.abs(slow.value-fast.value)<1e-10);assert(Math.abs(slow.velocity-fast.velocity)<1e-10);
});
test('a long suspended frame cannot create an explosive displacement',()=>{
 const s=makeSpring(),normal=makeSpring();s.velocity=normal.velocity=500;
 advanceSpring(s,0,10);advanceSpring(normal,0,.05);assert.deepEqual(s,normal);
});
test('the idle flourish makes one complete turn and returns with no residual lift',()=>{
 for(const disc of [true,false]){
  const middle=flourishPose(2,2+.825,disc);assert(Math.abs(middle.turn-180)<1e-10);assert(middle.lift>=18);
  const end=flourishPose(2,4,disc);assert.equal(end.turn,0);assert(Math.abs(end.lift)<1e-10);
  assert.equal(flourishPose(null,4,disc).turn,0);
 }
});

function playScene(){
 const item={classList:{add(){},remove(){},toggle(){}},style:{transform:'',zIndex:'',setProperty(key,value){this[key]=value;}}};
 const model={item,i:0,angle:.3,pace:.4,radiusScale:1,depthScale:1,y:20,yaw:4,roll:0,pitch:0,mobility:1,disc:true,paper:null,flourish:null,front:true,screenX:0,screenY:0};
 for(const key of ['hover','slide','bob','rock','pitchSpring'])model[key]=makeSpring();
 const scene={models:[model],orbit:{rotation:0,radius:250,perspective:1000,height:700},measuredWidth:1200,reduced:{matches:false},time:7,active:true,stageVisible:true,visible:new Set([item]),drag:null,dragY:0,throwX:0,pointer:null,hovered:null,focused:null,nextSurprise:5,lastSurprise:null,makeSpring,advanceSpring,flourishPose,freeFromPose,advanceFree,returnProgress,unwrapAngle,blendReturn,separateFree};
 vm.createContext(scene);
 const render=source.slice(source.indexOf('function orbitPose('),source.indexOf('function sweepObjects('));
 const update=source.slice(source.indexOf('function updateObjectPlay('),source.indexOf('const visibility=new IntersectionObserver'));
 vm.runInContext(render+update,scene);return {scene,model,item};
}
test('idle play selects one visible front-facing work, then waits before the next',()=>{
 const {scene,model}=playScene();vm.runInContext('updateObjectPlay(1/60)',scene);assert.equal(model.flourish,7);assert(scene.nextSurprise>=13.5);
 const next=scene.nextSurprise;scene.time=8;vm.runInContext('updateObjectPlay(1/60)',scene);assert.equal(scene.nextSurprise,next);
});
test('keyboard focus and an offscreen TOP prevent idle surprises',()=>{
 const a=playScene();a.scene.focused=a.model;vm.runInContext('updateObjectPlay(1/60)',a.scene);assert.equal(a.model.flourish,null);
 const b=playScene();b.scene.stageVisible=false;vm.runInContext('updateObjectPlay(1/60)',b.scene);assert.equal(b.model.flourish,null);
});
test('a disc flourish is applied to its rendered rotation and returns to the same orientation',()=>{
 const {scene,model,item}=playScene();model.flourish=7;scene.nextSurprise=20;scene.time=7.825;vm.runInContext('renderCylinder()',scene);assert(Number.parseFloat(item.style['--turn-z'])>170);
 scene.time=9;vm.runInContext('updateObjectPlay(1/60);renderCylinder()',scene);assert.equal(model.flourish,null);assert(Math.abs(Number.parseFloat(item.style['--turn-z']))<5);
});
test('reduced motion renders the base pose without hover, spring kick or a flourish',()=>{
 const {scene,model,item}=playScene();scene.reduced.matches=true;model.hover.value=1;model.slide.value=40;model.bob.value=30;model.rock.value=20;model.flourish=7;scene.time=7.825;
 vm.runInContext('renderCylinder()',scene);assert.equal(item.style['--turn-z'],'0.00deg');assert(item.style.transform.endsWith('scale(1.0000)'));
});

test('a released work has its own momentum and does not return to its pickup point',()=>{
 const f=freeFromPose({x:200,y:200,z:20,yaw:0,pitch:0,roll:0,scale:1});f.vx=300;f.vy=100;
 for(let i=0;i<120;i++)advanceFree(f,1/60,2000,1200);
 assert(f.x>500);assert(f.y>300);assert(f.vx>0&&f.vx<100);
});
test('free motion travels the same distance at 30 and 60 frames per second',()=>{
 const a=freeFromPose({x:200,y:200,z:0,yaw:0,pitch:0,roll:0,scale:1}),b={...a};a.vx=b.vx=200;a.vy=b.vy=100;a.spin=b.spin=90;
 for(let i=0;i<30;i++)advanceFree(a,1/30,2000,1200);
 for(let i=0;i<60;i++)advanceFree(b,1/60,2000,1200);
 for(const key of ['x','y','vx','vy','roll'])assert(Math.abs(a[key]-b[key])<1e-9);
});
test('free works bounce at the canvas edge and remain reachable',()=>{
 const f=freeFromPose({x:45,y:45,z:0,yaw:0,pitch:0,roll:0,scale:1});f.vx=-800;f.vy=-500;
 advanceFree(f,.04,800,700);assert.equal(f.x,40);assert.equal(f.y,40);assert(f.vx>0&&f.vy>0);
});
test('a detached work renders in the same screen position after the cylinder rotates',()=>{
 const {scene,model,item}=playScene();model.free=freeFromPose({x:300,y:250,z:100,yaw:12,pitch:5,roll:10,scale:1});model.free.order=1;
 vm.runInContext('renderCylinder()',scene);const pose=item.style.transform;
 scene.orbit.rotation+=1.7;vm.runInContext('renderCylinder()',scene);assert.equal(item.style.transform,pose);assert.equal(item.style.zIndex,'30001');
});

function dragScene(){
 const scene=playScene().scene;scene.stageVisible=true;scene.measuredWidth=1200;scene.performance={now:()=>scene.now};scene.now=0;scene.scrollY=0;scene.grabOrder=0;scene.suppressClickUntil=0;
 const listeners={},classes=new Set();
 scene.field={classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){},addEventListener(n,f){listeners[n]=f;}};
 scene.hideTooltip=()=>{};scene.requestFrame=()=>{};scene.fine={matches:false};scene.clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 for(const m of scene.models){m.item.classList={add(){},remove(){},toggle(){}};m.pose={x:300,y:250,z:100,yaw:12,pitch:5,roll:10,scale:1};}
 const detach=source.slice(source.indexOf('function detachObject('),source.indexOf('function renderFreeObject('));
 const sweep=source.slice(source.indexOf('function sweepObjects('),source.indexOf('function setHovered('));
 const input=source.slice(source.indexOf('function endDrag(event)'),source.indexOf("field.addEventListener('click'"));
 vm.runInContext(detach+sweep+input,scene);
 function pointer(name,x,y,onWork=true,touch=false){scene.now+=16;listeners[name]({button:0,pointerId:1,pointerType:touch?'touch':'mouse',clientX:x,clientY:y,type:name,target:{closest:q=>q==='.stage-object'&&onWork?scene.models[0].item:null}});}
 return {scene,pointer,classes};
}
test('dragging one work detaches only that work and follows both axes without rotating the cylinder',()=>{
 const {scene,pointer}=dragScene();const other={...scene.models[0],item:{classList:{add(){},remove(){},toggle(){}}},pose:{...scene.models[0].pose,x:750},free:null};scene.models.push(other);const angle=scene.orbit.rotation;
 pointer('pointerdown',100,100);pointer('pointermove',260,180);
 assert.equal(scene.models[0].free.x,460);assert.equal(scene.models[0].free.y,330);assert.equal(other.free,null);assert.equal(scene.orbit.rotation,angle);
 pointer('pointerup',260,180);assert.equal(scene.drag,null);assert(scene.models[0].free.vx>0);assert(scene.suppressClickUntil>scene.now);
});
test('an ordinary tap still opens a note rather than detaching a work',()=>{
 const {scene,pointer}=dragScene();pointer('pointerdown',100,100);pointer('pointerup',100,100);assert.equal(scene.models[0].free,undefined);assert.equal(scene.suppressClickUntil,0);
});
test('touch can move a work vertically, while a vertical swipe on empty space remains navigation',()=>{
 const a=dragScene();a.pointer('pointerdown',100,100,true,true);a.pointer('pointermove',100,200,true,true);assert.equal(a.scene.models[0].free.y,350);
 const b=dragScene();b.pointer('pointerdown',100,100,false,true);b.pointer('pointermove',100,200,false,true);assert.equal(b.scene.drag,null);assert.equal(b.scene.models[0].free,undefined);
});
test('dragging empty space frees all works with individual velocities',()=>{
 const {scene,pointer}=dragScene();const other={...scene.models[0],item:{classList:{add(){},remove(){},toggle(){}}},pose:{...scene.models[0].pose,x:950},free:null};scene.models.push(other);
 pointer('pointerdown',100,100,false);pointer('pointermove',260,180,false);assert(scene.models.every(m=>m.free));assert.notEqual(scene.models[0].free.vx,other.free.vx);assert.equal(scene.orbit.rotation,0);
});

test('released works stay fully free for three seconds and ease back over five seconds',()=>{
 const f=freeFromPose({x:200,y:200,z:0,yaw:0,pitch:0,roll:0,scale:1});f.releasedAt=0;
 assert.equal(returnProgress(f,2.99),0);assert(Math.abs(returnProgress(f,5.5)-.5)<1e-10);assert.equal(returnProgress(f,8),1);
 assert(returnProgress(f,3.001)<1e-8);assert(1-returnProgress(f,7.999)<1e-8);
});
test('the return blends rotation across the nearest angle and remains continuous at 360 degrees',()=>{
 const f=freeFromPose({x:200,y:200,z:0,yaw:350,pitch:0,roll:350,scale:1});
 const target={x:400,y:400,z:100,yaw:10,pitch:10,roll:10,scale:1};
 assert.equal(blendReturn(f,target,.5).yaw,360);assert.equal(blendReturn(f,{...target,yaw:15},.5).yaw,362.5);
});
test('finishing the return exactly matches the current rotating cylinder pose without a last-frame jump',()=>{
 const {scene,model,item}=playScene();model.free=freeFromPose({x:300,y:250,z:100,yaw:12,pitch:5,roll:10,scale:1});model.free.order=1;model.free.releasedAt=0;scene.time=8;
 vm.runInContext('renderCylinder()',scene);assert.equal(model.free,null);const pose=item.style.transform;
 vm.runInContext('renderCylinder()',scene);assert.equal(item.style.transform,pose);
});
test('nearby free works gently separate while a held work stays under the pointer',()=>{
 const a={i:0,free:freeFromPose({x:300,y:300,z:0,yaw:0,pitch:0,roll:0,scale:1})},b={i:1,free:freeFromPose({x:310,y:300,z:0,yaw:0,pitch:0,roll:0,scale:1})};
 a.free.radius=b.free.radius=70;separateFree([a,b],1/60,1000,800,a,0);assert.equal(a.free.vx,0);assert(b.free.vx>0);assert.equal(a.free.x,300);
});
test('a dense pile disperses rather than remaining stuck in one place',()=>{
 const bodies=Array.from({length:15},(_,i)=>({i,free:{...freeFromPose({x:195,y:422,z:0,yaw:0,pitch:0,roll:0,scale:1}),radius:48}}));
 for(let t=0;t<360;t++){separateFree(bodies,1/120,390,844,null,0);for(const m of bodies)advanceFree(m.free,1/120,390,844);}
 let total=0,count=0,minimum=Infinity;
 for(let i=0;i<15;i++)for(let j=i+1;j<15;j++){const d=Math.hypot(bodies[i].free.x-bodies[j].free.x,bodies[i].free.y-bodies[j].free.y);total+=d;count++;minimum=Math.min(minimum,d);}
 assert(total/count>120);assert(minimum>20);
});
test('picking up a returning work cancels its return from its visible position',()=>{
 const {scene,pointer}=dragScene(),m=scene.models[0];m.free=freeFromPose(m.pose);m.free.order=1;m.free.releasedAt=0;scene.time=5;
 vm.runInContext('renderCylinder()',scene);const visible=m.pose.x;pointer('pointerdown',100,100);pointer('pointermove',200,100);
 assert.equal(m.free.releasedAt,Infinity);assert.equal(m.free.x,visible+100);
});
