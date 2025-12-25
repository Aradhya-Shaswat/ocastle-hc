export function spawnParticles(state, x,y,count=16, color='rgba(255,200,120,0.9)', spread=1.5, speed=1.6){
  for(let i=0;i<count;i++){
    const a = Math.random()*Math.PI*2; const s = (Math.random()*0.6+0.4) * speed;
    state.particles.push({ x:x + (Math.random()-0.5)*6, y:y + (Math.random()-0.5)*6, vx: Math.cos(a)*s*spread, vy: Math.sin(a)*s*spread - Math.random()*1.2, life: 40 + Math.random()*30, col: color });
  }
}
export function updateParticles(state, dt){
  for(let i=state.particles.length-1;i>=0;i--){
    const p = state.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.12 * dt; p.life -= dt*1.2; if(p.life <= 0) state.particles.splice(i,1);
  }
  state.shake *= Math.pow(0.85, dt);
  if(state.shake < 0.01) state.shake = 0;
}
