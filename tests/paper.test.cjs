const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../paper.js'),'utf8');
function fixture(){
 const contexts=[];
 const canvas=()=>{const ctx={draws:0,drawImage(){this.draws++;},fillRect(){},fillText(){},setTransform(){},clearRect(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},createLinearGradient(){return{addColorStop(){}};}};contexts.push(ctx);return{style:{},getContext:()=>ctx,setAttribute(){},remove(){}};};
 const image={complete:true,naturalWidth:200},face={offsetWidth:200,offsetHeight:300,querySelector:()=>image,append(){}},item={querySelector:()=>face,style:{getPropertyValue:()=> '110ms'},classList:{add(){},remove(){}},dataset:{title:'Poster'}};
 const env={document:{createElement:canvas},innerWidth:1280,devicePixelRatio:1};
 const api=vm.runInNewContext(source+';({PosterSheet,posterFacesCamera})',env);
 return{...api,sheet:new api.PosterSheet(item),ctx:contexts[0],env};
}
test('cached mesh keeps every animated vertex at its original position',()=>{
 const{sheet,ctx}=fixture(),nodes=sheet.nodes.slice(),triangles=sheet.triangles.slice();
 for(const[time,gust]of [[.25,0],[1.5,450],[7.75,900]]){
  ctx.draws=0;sheet.render(time,gust);assert.equal(ctx.draws,216);
  const phase=time*2.25+.77,strength=1+Math.min(Math.abs(gust)/900,.45),{w,h,pad}=sheet;
  for(let i=0;i<sheet.nodes.length;i++){
   const p=sheet.nodes[i],{u,v}=p,flex=v*v,z=Math.sin(v*5.3-phase+u*1.4)*w*.18*flex*strength,perspective=w*3/(w*3-z);
   const x=pad+w/2+(u-.5)*w*perspective+Math.sin(v*4-phase)*w*.09*flex*strength;
   const y=pad+h/2+(v-.5)*h*perspective+Math.sin(u*3+phase)*w*.035*flex;
   assert.ok(Math.abs(p.x-x)<1e-9&&Math.abs(p.y-y)<1e-9);assert.equal(p,nodes[i]);
  }
  sheet.triangles.forEach((triangle,i)=>assert.equal(triangle,triangles[i]));
 }
});
test('mobile mesh keeps its existing detail and redraws on return',()=>{
 const{sheet,env,ctx}=fixture();env.innerWidth=390;sheet.resize();assert.equal(sheet.triangles.length,96);
 ctx.draws=0;sheet.render(20);assert.equal(ctx.draws,96);
});
test('rear poster work is skipped with a warmup margin before the front appears',()=>{
 const{posterFacesCamera:faces}=fixture();
 assert.equal(faces(0,0,0,0,350,1100),true);
 assert.equal(faces(Math.PI,0,0,0,-350,1100),false);
 assert.equal(faces(Math.PI/2,0,0,0,0,1100),true);
 assert.equal(faces(Math.PI/2,0,350,0,0,1100),false);
 let active=0;for(let i=0;i<360;i++){const angle=i*Math.PI/180;if(faces(angle,0,350*Math.sin(angle),0,350*Math.cos(angle),1100))active++;}
 assert.ok(active>120&&active<220);console.log(`Front texture active for ${active}/360 orbit samples; orbital animation remains active for all 360.`);
});
