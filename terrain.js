export function generateTerrain(width, segments=80, H=600){
  const pts = [];
  for(let i=0;i<=segments;i++){
    const x = i/segments * width;
    const y = H*0.45 + (Math.sin(i*0.5) + (Math.random()-0.5)*1.4) * (H*0.08);
    pts.push({x,y});
  }
  return pts;
}
export function pickPads(terrain, count=3, padWidth=80, W=800){
  const pads = [];
  const segments = terrain.length-1;
  for(let k=0;k<count;k++){
    const i = Math.floor((0.1 + Math.random()*0.8) * segments);
    const left = Math.max(0, terrain[i].x - padWidth/2);
    const right = Math.min(W, left + padWidth);
    const y = terrain[i].y - 0.5;
    pads.push({left,right,y});
    for(let j=0;j<terrain.length;j++){
      if(terrain[j].x >= left && terrain[j].x <= right) terrain[j].y = y;
    }
  }
  return pads;
}
export function terrainYAt(terrain, x){
  if(x<=terrain[0].x) return terrain[0].y;
  for(let i=0;i<terrain.length-1;i++){
    const a=terrain[i], b=terrain[i+1];
    if(x>=a.x && x<=b.x){ const t=(x-a.x)/(b.x-a.x); return a.y*(1-t)+b.y*t; }
  }
  return terrain[terrain.length-1].y;
}
