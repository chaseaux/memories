const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../floating.js'),'utf8');
const start=source.indexOf('const clamp='),end=source.indexOf('function requestFrame()',start);
const {galleryTarget:target,followGallery:follow,galleryUnsettled:moving}=vm.runInNewContext(source.slice(start,end)+';({galleryTarget,followGallery,galleryUnsettled})');
const model={top:1000,height:240,captionTop:170,captionHeight:70,entryX:-56,entryY:24};
test('diagonal entry/exit and caption emphasis preserve the full visual range',()=>{
 const below=target(model,-1000,740),above=target(model,3000,740);
 assert.equal(below.x,-56);assert.equal(below.y,24);assert.equal(above.x,-56);assert.equal(above.y,-24);
 assert.equal(target({...model,entryX:56},-1000,740).x,56);
 assert.equal(target(model,835,740).scale,1.04);assert.equal(below.scale,.96);assert.equal(above.scale,.96);
});
test('one-pixel slow scrolling stays monotonic without transform feedback',()=>{
 let pose=target(model,900,740);
 for(let position=901;position<1000;position++){
  const next=follow(pose,target(model,position,740),1/60);
  assert(next.y<=pose.y,'a steady upward passage must never bounce back');
  assert(Math.abs(next.y-pose.y)<.05,'tiny input must not make a larger positional jump');
  pose=next;
 }
});
test('following continues between sparse scroll events and finishes at the true position',()=>{
 let pose=target(model,900,740),goal=target(model,950,740),steps=0;
 const first=follow(pose,goal,1/60);assert(first.y<pose.y&&first.y>goal.y);
 pose=first;
 while(moving(pose,goal)&&steps<180){pose=follow(pose,goal,1/60);steps++;}
 assert(steps>1&&steps<60);assert(!moving(pose,goal),'idle gallery must stop requesting frames');
 assert(Math.abs(pose.y-goal.y)<.012);
});
test('30 and 60 fps cover the same distance in the same time',()=>{
 const origin=target(model,-1000,740),goal=target(model,3000,740);
 let slow=origin,fast=origin;
 for(let i=0;i<6;i++)slow=follow(slow,goal,1/30);
 for(let i=0;i<12;i++)fast=follow(fast,goal,1/60);
 for(const key of ['x','y','depth','scale'])assert(Math.abs(slow[key]-fast[key])<1e-10);
});
test('layout metrics are independent of animated bounding boxes',()=>{
 const stable=target(model,900,740);
 const transformed=target({...model,getBoundingClientRect(){throw Error('animated geometry is unstable');}},900,740);
 assert.deepEqual(transformed,stable);
});
