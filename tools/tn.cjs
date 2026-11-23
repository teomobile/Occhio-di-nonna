const p=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'..','public','province.json'),'utf8')).find(x=>x.p==='Trento');
const rings=p.g.map(r=>{const a=[];for(let i=0;i<r.length;i+=2)a.push([r[i],r[i+1]]);return a});
const inR=(x,y,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!=(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c};
const inP=(x,y)=>rings.some(r=>inR(x,y,r));
const t2lon=(x,z)=>x/2**z*360-180, t2lat=(y,z)=>{const n=Math.PI-2*Math.PI*y/2**z;return 180/Math.PI*Math.atan(Math.sinh(n))};
const lon2x=(l,z)=>Math.floor((l+180)/360*2**z), lat2y=(la,z)=>{const r=la*Math.PI/180;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z)};
function tiles(z){const[w,s,e,n]=p.b;const out=[];for(let x=lon2x(w,z);x<=lon2x(e,z);x++)for(let y=lat2y(n,z);y<=lat2y(s,z);y++){
 const W=t2lon(x,z),E=t2lon(x+1,z),N=t2lat(y,z),S=t2lat(y+1,z);let hit=false;
 for(let i=0;i<=4&&!hit;i++)for(let j=0;j<=4&&!hit;j++)if(inP(W+(E-W)*i/4,N+(S-N)*j/4))hit=true;
 if(!hit)hit=rings.some(r=>r.some(([a,b])=>a>=W&&a<=E&&b<=N&&b>=S));
 if(hit)out.push([z,x,y]);}return out}
module.exports=tiles;
if(require.main===module){for(let z=9;z<=15;z++)console.log(z,tiles(z).length)}
