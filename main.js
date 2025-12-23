(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let off, offCtx;
  const controls = { rotationSpeed: 0.035, thrustPower: 0.12, fuelRate: 0.35, deadzone: 0.15 };
  let W, H, DPR;
  function resize(){
    DPR = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    off = document.createElement('canvas');
    off.width = 320;
    off.height = Math.max(120, Math.round(320 * H / W));
    offCtx = off.getContext('2d');
    offCtx.setTransform(1,0,0,1,0,0);
  }

  function applyCRT(){
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for(let y=0;y<H;y+=3) ctx.fillStyle = 'rgba(0,0,0,0.04)', ctx.fillRect(0,y,W,1);
    const g = ctx.createRadialGradient(W/2, H/2, Math.max(W,H)*0.1, W/2, H/2, Math.max(W,H)*0.8);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    ctx.restore();
  }
  window.addEventListener('resize', resize);
  resize();

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function beep(freq=440, time=0.12, type='sine', gain=0.08){
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + time);
  }
  let thrustOsc = null;
  function startThrustTone(){
    if(thrustOsc) return;
    thrustOsc = audioCtx.createOscillator();
    const g = audioCtx.createGain(); g.gain.value = 0.03;
    thrustOsc.type = 'sawtooth'; thrustOsc.frequency.value = 220;
    thrustOsc.connect(g); g.connect(audioCtx.destination);
    thrustOsc.start();
  }
  function stopThrustTone(){ if(!thrustOsc) return; thrustOsc.stop(); thrustOsc.disconnect(); thrustOsc=null }

  function generateTerrain(width, segments=80){
    const pts = [];
    for(let i=0;i<=segments;i++){
      const x = i/segments * width;
      const y = H*0.45 + (Math.sin(i*0.5) + (Math.random()-0.5)*1.4) * (H*0.08);
      pts.push({x,y});
    }
    return pts;
  }

  function pickPads(terrain, count=3, padWidth=80){
    const pads = [];
    const segments = terrain.length-1;
    for(let k=0;k<count;k++){
      const i = Math.floor((0.1 + Math.random()*0.8) * segments);
      const left = Math.max(0, terrain[i].x - padWidth/2);
      const right = Math.min(W, left + padWidth);

      // set flat in terrain points ???
      const y = terrain[i].y - 0.5; 
      pads.push({left,right,y});
      for(let j=0;j<terrain.length;j++){
        if(terrain[j].x >= left && terrain[j].x <= right) terrain[j].y = y;
      }
    }
    return pads;
  }

  function terrainYAt(terrain, x){
    if(x<=terrain[0].x) return terrain[0].y;
    for(let i=0;i<terrain.length-1;i++){
      const a=terrain[i], b=terrain[i+1];
      if(x>=a.x && x<=b.x){
        const t=(x-a.x)/(b.x-a.x); return a.y*(1-t)+b.y*t;
      }
    }
    return terrain[terrain.length-1].y;
  }

  const base = {gravity:0.035, startFuel:300};
  let state = {};
  function newRound(resetScore=false){
    if(resetScore) state.score=0;
    state.terrain = generateTerrain(W);
    state.pads = pickPads(state.terrain, 3, Math.min(120, W*0.12));
    state.ship = {
      x: W*0.5, y: H*0.12, vx:0, vy:0, angle:0, radius:12
    };
    state.keys = {left:false,right:false,thrust:false};
    state.fuel = Math.max(20, Math.floor(base.startFuel * Math.pow(0.95, state.round-1)));
  }

  function initGame(){
    state.round = 1; state.score = 0; state.gravity = base.gravity; base.startFuel = 300;
    newRound(true);
  }

  window.addEventListener('keydown', e=>{
    if(e.code==='ArrowLeft') state.keys.left=true;
    if(e.code==='ArrowRight') state.keys.right=true;
    if(e.code==='ArrowUp') state.keys.thrust=true;
    if(['Space'].includes(e.code)) e.preventDefault();
    if(e.code==='KeyR') initGame();
  });
  window.addEventListener('keyup', e=>{
    if(e.code==='ArrowLeft') state.keys.left=false;
    if(e.code==='ArrowRight') state.keys.right=false;
    if(e.code==='ArrowUp') state.keys.thrust=false;
  });

  function shipVertices(ship){
    const r = ship.radius;
    const pts = [ {x:0,y:-r}, {x:-r*0.65,y:r*0.6}, {x:r*0.65,y:r*0.6} ];
    return pts.map(p=>{
      const s=Math.sin(ship.angle), c=Math.cos(ship.angle);
      return {x: ship.x + (p.x*c - p.y*s), y: ship.y + (p.x*s + p.y*c)};
    });
  }

  function update(dt){
    const ship = state.ship;
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    let padRot = 0, padThrottle = 0;
    if(gp){
      padRot = gp.axes[0] || 0;
      if(Math.abs(padRot) < controls.deadzone) padRot = 0;
      if(gp.buttons[7]) padThrottle = gp.buttons[7].value || 0;
      if(!padThrottle && gp.buttons[0]) padThrottle = gp.buttons[0].pressed ? 1 : 0;
      if(!padThrottle && gp.axes[1] !== undefined){
        const a = gp.axes[1]; if(a < -controls.deadzone) padThrottle = Math.min(1, -a);
      }
    }
    if(state.keys.left) ship.angle -= controls.rotationSpeed * dt;
    if(state.keys.right) ship.angle += controls.rotationSpeed * dt;
    if(padRot) ship.angle += padRot * controls.rotationSpeed * dt;
    const thrustActive = (state.keys.thrust && state.fuel>0) || (padThrottle>0 && state.fuel>0);
    if(thrustActive){
      const mult = padThrottle>0 ? padThrottle : 1;
      const power = controls.thrustPower * dt * mult;
      ship.vx += Math.sin(ship.angle) * power;
      ship.vy -= Math.cos(ship.angle) * power;
      state.fuel = Math.max(0, state.fuel - controls.fuelRate * dt * mult);
      startThrustTone();
    } else stopThrustTone();

    ship.vy += state.gravity;

    ship.x += ship.vx;
    ship.y += ship.vy;

    if(ship.x < 0) ship.x = 0; if(ship.x > W) ship.x = W;

    // check collision w/ terrain
    const verts = shipVertices(ship);
    let collided = false;
    for(const v of verts){
      const ty = terrainYAt(state.terrain, v.x);
      if(v.y >= ty){ collided = true; break; }
    }
    if(collided){
      const onPad = state.pads.find(p => ship.x >= p.left && ship.x <= p.right);
      const safeAngle = 0.6; const safeVy = 3.2;
      if(onPad && Math.abs(ship.vy) <= safeVy && Math.abs(((ship.angle+Math.PI)%(Math.PI*2))-Math.PI) < safeAngle){
        beep(880,0.12,'square',0.08);
        state.score += Math.max(100, Math.floor(150 - state.round*10) + Math.floor(state.fuel));
        state.round++;
        state.gravity *= 1.03;
        newRound(false);
      } else {
        stopThrustTone();
        beep(80,0.4,'sawtooth',0.18);
        initGame();
      }
    }
  }

  function draw(){
    offCtx.clearRect(0,0,off.width,off.height);
    offCtx.strokeStyle = '#fff'; offCtx.lineWidth = 1; offCtx.beginPath();
    const t = state.terrain;
    const scaleX = off.width / W;
    const scaleY = off.height / H;
    offCtx.moveTo(t[0].x * scaleX, t[0].y * scaleY);
    for(let i=1;i<t.length;i++) offCtx.lineTo(t[i].x * scaleX, t[i].y * scaleY);
    offCtx.stroke();
    for(const p of state.pads){ offCtx.beginPath(); offCtx.moveTo(p.left * scaleX, p.y * scaleY); offCtx.lineTo(p.right * scaleX, p.y * scaleY); offCtx.stroke(); }

    const verts = shipVertices(state.ship);
    offCtx.beginPath(); offCtx.moveTo(verts[0].x * scaleX, verts[0].y * scaleY);
    offCtx.lineTo(verts[1].x * scaleX, verts[1].y * scaleY); offCtx.lineTo(verts[2].x * scaleX, verts[2].y * scaleY); offCtx.closePath(); offCtx.stroke();

    offCtx.font = Math.max(10, Math.round(14 * scaleY)) + 'px monospace'; offCtx.fillStyle = '#fff';
    offCtx.fillText(`Score: ${state.score}`, 12 * scaleX, 20 * scaleY);
    offCtx.fillText(`Round: ${state.round}`, 12 * scaleX, 36 * scaleY);
    offCtx.fillText(`Fuel: ${Math.floor(state.fuel)}`, 12 * scaleX, 52 * scaleY);
    const alt = Math.max(0, Math.floor(terrainYAt(state.terrain, state.ship.x) - state.ship.y));
    offCtx.fillText(`Alt: ${alt}`, 12 * scaleX, 68 * scaleY);
    offCtx.fillText(`VY: ${state.ship.vy.toFixed(2)}`, 12 * scaleX, 84 * scaleY);

    const barW = Math.round(140 * scaleX);
    offCtx.strokeRect(12 * scaleX, 92 * scaleY, barW, 8 * scaleY);
    offCtx.fillRect(12 * scaleX, 92 * scaleY, Math.max(0, barW * (state.fuel / base.startFuel)), 8 * scaleY);

    offCtx.strokeStyle = '#444'; offCtx.beginPath(); offCtx.moveTo((W/2-6) * scaleX, (H/2) * scaleY); offCtx.lineTo((W/2+6) * scaleX, (H/2) * scaleY); offCtx.moveTo((W/2) * scaleX, (H/2-6) * scaleY); offCtx.lineTo((W/2) * scaleX, (H/2+6) * scaleY); offCtx.stroke();

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(off, 0, 0, W, H);
    applyCRT();
  }

  let last = performance.now();
  function loop(t){
    const dt = (t-last)/16.666; last=t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  initGame();
  requestAnimationFrame(loop);

  function unlock(){ if(audioCtx.state==='suspended') audioCtx.resume(); window.removeEventListener('pointerdown',unlock); }
  window.addEventListener('pointerdown', unlock);
})();
