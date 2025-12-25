export function shipVertices(ship, flatBase=false){
  const r = ship.radius;
  const shape = ship.shape || 'triangle';
  let pts = [];
  if(shape === 'triangle') pts = [ {x:0,y:-r}, {x:-r*0.65,y:r*0.6}, {x:r*0.65,y:r*0.6} ];
  else if(shape === 'rectangle'){ const hw = r * 1.0; const hh = r * 1.2; pts = [ {x:-hw,y:-hh}, {x:hw,y:-hh}, {x:hw,y:hh}, {x:-hw,y:hh} ]; }
  else if(shape === 'diamond') pts = [ {x:0,y:-r}, {x:r,y:0}, {x:0,y:r}, {x:-r,y:0} ];
  else if(shape === 'circle'){ const sides = 12; for(let i=0;i<sides;i++){ const a = (i/sides) * Math.PI*2; pts.push({x: Math.cos(a)*r, y: Math.sin(a)*r}); } }
  else pts = [ {x:0,y:-r}, {x:-r*0.65,y:r*0.6}, {x:r*0.65,y:r*0.6} ];
  const angle = flatBase ? 0 : ship.angle;
  return pts.map(p=>{ const s=Math.sin(angle), c=Math.cos(angle); return {x: ship.x + (p.x*c - p.y*s), y: ship.y + (p.x*s + p.y*c)}; });
}
