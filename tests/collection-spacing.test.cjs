const {test}=require('node:test'),assert=require('node:assert/strict');
test('two staggered rows fit the window, with adjacent groups outside at rest',()=>{
 for(const height of [440,520,680]){
  const row=(height-52)/2,padding=16,gap=20;
  const lastBottom=padding+row+gap+row,nextTop=padding+2*(row+gap),previousBottom=padding-gap;
  assert.equal(height-lastBottom,16);assert(nextTop>height);assert(previousBottom<0);
 }
});
test('row cadence stays continuous across every four-work boundary',()=>{
 const row=250,gap=20,positions=Array.from({length:12},(_,i)=>16+Math.floor(i/2)*(row+gap));
 for(let i=2;i<12;i+=2)assert.equal(positions[i]-positions[i-2]-row,gap);
});
