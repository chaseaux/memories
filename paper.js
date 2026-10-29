// A textured mesh bends the artwork itself; the top edge stays almost fixed.
class PosterSheet {
 constructor(item){
  this.item=item;this.face=item.querySelector('.object-face');this.image=this.face.querySelector('img');
  this.canvas=document.createElement('canvas');this.canvas.className='paper-mesh';this.canvas.setAttribute('aria-hidden','true');
  this.ctx=this.canvas.getContext('2d');this.texture=document.createElement('canvas');this.shaded=document.createElement('canvas');this.ready=false;this.last=-Infinity;
  if(!this.ctx)return;
  this.face.append(this.canvas);
  this.onLoad=()=>{this.resize();this.render(0,0,true);};
  if(this.image&&!this.image.complete)this.image.addEventListener('load',this.onLoad,{once:true});else this.onLoad();
 }
 resize(){
  if(!this.ctx||(this.image&&!this.image.naturalWidth))return;
  const width=this.face.offsetWidth,height=this.face.offsetHeight;if(!width||!height)return;
  const w=Math.min(480,Math.round(width*Math.min(devicePixelRatio||1,1.5))),h=Math.round(w*height/width);
  if(this.w===w&&this.h===h)return;
  this.w=w;this.h=h;this.pad=w*.2;this.canvas.width=Math.ceil(w+this.pad*2);this.canvas.height=Math.ceil(h+this.pad*2);
  Object.assign(this.canvas.style,{width:'140%',height:`${(h+this.pad*2)/h*100}%`,left:'-20%',top:`${-this.pad/h*100}%`});
  this.texture.width=w;this.texture.height=h;this.shaded.width=w;this.shaded.height=h;const ctx=this.texture.getContext('2d');
  ctx.fillStyle='#f4f2ed';ctx.fillRect(0,0,w,h);
  if(this.image)ctx.drawImage(this.image,0,0,w,h);
  else{
   const size=Math.max(16,w*.08),margin=w*.1;ctx.font=`500 ${size}px Inter, sans-serif`;ctx.fillStyle='#111';ctx.textBaseline='top';
   let line='',y=margin;for(const character of this.item.dataset.title){
    if(ctx.measureText(line+character).width>w-2*margin&&line){ctx.fillText(line,margin,y);y+=size*1.4;line='';}line+=character;
   }if(line)ctx.fillText(line,margin,y);
  }
  this.ready=true;this.last=-Infinity;this.item.classList.add('paper-mesh-ready');
 }
 render(time,gust=0,force=false){
  if(!this.ready||(!force&&time-this.last<1/(innerWidth<600?18:24)))return;this.last=time;
  const {w,h,pad,ctx,texture}=this,cols=innerWidth<600?4:6,rows=innerWidth<600?12:18;
  const phase=time*2.25+Number(this.item.style.getPropertyValue('--arrival').replace('ms',''))*.007;
  const strength=1+Math.min(Math.abs(gust)/900,.45),points=[];
  const paint=this.shaded.getContext('2d');paint.drawImage(texture,0,0);
  const lighting=paint.createLinearGradient(0,0,w*.15,h);
  for(let i=0;i<=32;i++){const v=i/32,shade=Math.cos(v*5.3-phase+.7)*.2*v;lighting.addColorStop(v,shade>0?`rgba(255,255,255,${shade})`:`rgba(0,0,0,${-shade})`);}
  paint.fillStyle=lighting;paint.fillRect(0,0,w,h);
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
   const u=col/cols,v=row/rows,flex=v*v;
   const wave=v*5.3-phase+u*1.4,z=Math.sin(wave)*w*.18*flex*strength;
   const perspective=w*3/(w*3-z);
   points.push({x:pad+w/2+(u-.5)*w*perspective+Math.sin(v*4-phase)*w*.09*flex*strength,
    y:pad+h/2+(v-.5)*h*perspective+Math.sin(u*3+phase)*w*.035*flex,
    sx:u*w,sy:v*h,shade:Math.cos(wave)*.19*v});
  }
  const triangle=(a,b,c)=>{
   const sx1=b.sx-a.sx,sy1=b.sy-a.sy,sx2=c.sx-a.sx,sy2=c.sy-a.sy,det=sx1*sy2-sx2*sy1;
   const dx1=b.x-a.x,dy1=b.y-a.y,dx2=c.x-a.x,dy2=c.y-a.y;
   const A=(dx1*sy2-dx2*sy1)/det,B=(dy1*sy2-dy2*sy1)/det,C=(dx2*sx1-dx1*sx2)/det,D=(dy2*sx1-dy1*sx2)/det;
   const cx=(a.x+b.x+c.x)/3,cy=(a.y+b.y+c.y)/3;
   ctx.save();ctx.beginPath();
   [a,b,c].forEach((p,i)=>{const length=Math.hypot(p.x-cx,p.y-cy)||1,x=p.x+(p.x-cx)/length*1.5,y=p.y+(p.y-cy)/length*1.5;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
   ctx.closePath();ctx.clip();ctx.setTransform(A,B,C,D,a.x-A*a.sx-C*a.sy,a.y-B*a.sx-D*a.sy);ctx.drawImage(this.shaded,0,0);ctx.restore();
  };
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const a=points[row*(cols+1)+col],b=points[row*(cols+1)+col+1],c=points[(row+1)*(cols+1)+col],d=points[(row+1)*(cols+1)+col+1];
   triangle(a,b,c);triangle(b,d,c);
  }
 }
 destroy(){this.image?.removeEventListener('load',this.onLoad);this.canvas.remove();this.item.classList.remove('paper-mesh-ready');}
}
