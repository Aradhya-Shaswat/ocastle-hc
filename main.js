import { audioCtx, beep, startThrustTone, stopThrustTone, startMusic, stopMusic, setMusicVolume } from './audio.js';
import { generateTerrain, pickPads, terrainYAt } from './terrain.js';
import { saveShipShape, loadShipShape, saveHigh, loadHigh } from './persist.js';
import { shipVertices } from './ship.js';
import { spawnParticles, updateParticles } from './particles.js';
import { drawMenu, drawControllerConfirm, drawPauseMenu, overlayTransition, drawAchievement } from './ui.js';
import { initInput, pollInput, vibrateGamepad, stopThrottleVibration } from './input.js';

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let off, offCtx;
  const controls = { rotationSpeed: 0.035, thrustPower: 0.12, fuelRate: 0.35, deadzone: 0.15 };
  let W, H, DPR;
  const joystickImg = new Image();
  let joystickSanitized = false;
  joystickImg.src = 'joystick.png';
  joystickImg.onload = function(){ try{ if(!joystickSanitized) sanitizeJoystickImage(); }catch(e){} };

  let state = {};
  state.transition = { active:false, progress:0, duration:50 };

  function startTransition(){ if(!state.transition.active){ state.transition.active = true; state.transition.progress = 0; } }
  const _startTransition = startTransition;
  startTransition = function(){ if(!state.transition.active){ try{ vibrateGamepad(state.activeGamepad >=0 ? state.activeGamepad : 0, 200, 1.0, 0.8); }catch(e){}; _startTransition(); } };
  // haptics & throttle vibration moved to input.js
  function sanitizeJoystickImage(){
    try{
      const w = joystickImg.naturalWidth, h = joystickImg.naturalHeight;
      if(!w || !h) return;
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d'); tctx.drawImage(joystickImg,0,0);
      const data = tctx.getImageData(0,0,w,h).data;
      let minX=w, minY=h, maxX=0, maxY=0;
      for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
          const i = (y*w + x)*4; const a = data[i+3];
          if(a>10){ if(x<minX) minX=x; if(y<minY) minY=y; if(x>maxX) maxX=x; if(y>maxY) maxY=y; }
        }
      }
      if(maxX<=minX || maxY<=minY) return;
      const cw = maxX-minX+1, ch = maxY-minY+1;

      if(cw < w || ch < h){
        const out = document.createElement('canvas'); out.width = cw; out.height = ch;
        out.getContext('2d').drawImage(tmp, minX, minY, cw, ch, 0, 0, cw, ch);
        joystickSanitized = true;
        joystickImg.src = out.toDataURL('image/png');
      }
    }catch(e){}
  }
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

  
  window.addEventListener('resize', resize);
  resize();

  // audio implementation moved to audio.js

  // terrain functions moved to terrain.js

  const base = {gravity:0.035, startFuel:300};
  state.menu = true;
  state.emblem = {show:false,alpha:0,phase:0};

  const shipShapes = ['lander','triangle','rectangle','diamond','circle'];
  // ship shape persistence moved to persist.js (saveShipShape / loadShipShape)
  function cycleShipShape(){ const i = shipShapes.indexOf(state.selectedShipShape || 'triangle'); const ni = (i+1) % shipShapes.length; state.selectedShipShape = shipShapes[ni]; try{ saveShipShape(state.selectedShipShape); }catch(e){} }
  state.controllerConfirm = false;
  state.controllerFade = 0;
  state.activeGamepad = -1;
  state.throttleVib = { interval: null, padIndex: -1, active: false };
  state.firstButtonIndex = -1;
  state.waitForRelease = false;
  state.firstButtonIndex = -1;
  state.paused = false;
  state.startHeld = false;
  state.backHeld = false;
  state.achievement = { visible:false, showing:false, alpha:0, timerMs:0, durationMs:8000, played:false };
  state.attempts = 0;
  // highscore persistence moved to persist.js (loadHigh / saveHigh)
  function newRound(resetScore=false){
    if(resetScore) state.score=0;
    state.terrain = generateTerrain(W, 80, H);
    state.pads = pickPads(state.terrain, 3, Math.min(120, W*0.12), W);
    state.ship = {
      x: W*0.5, y: H*0.12, vx:0, vy:0, angle:0, radius:12,
      shape: state.selectedShipShape || 'lander'
    };
    state.keys = {left:false,right:false,thrust:false};
    state.fuel = Math.max(20, Math.floor(base.startFuel * Math.pow(0.95, state.round-1)));
    state.attempts = (state.attempts || 0) + 1;
  }

  function initGame(){
    state.round = 1; state.score = 0; state.gravity = base.gravity; base.startFuel = 300;
    state.highscore = loadHigh();
    state.selectedShipShape = loadShipShape();
    try{ stopThrottleVibration(); }catch(e){}
    newRound(true);
  }

  // gamepad connect/disconnect handled in input.js

  canvas.addEventListener('pointerdown', e=>{
    try{
      const ach = state.achievement; if(!ach || !ach.visible) return;
      const rect = canvas.getBoundingClientRect(); const cx = e.clientX - rect.left; const cy = e.clientY - rect.top;
      const bw = Math.min(420, W - 40); const bh = 56; const bx = Math.round((W - bw)/2); const by = Math.round(H - 20 - bh + (1 - (ach.alpha||0)) * (bh + 20));
      if(cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh){ try{ window.open('https://retro-hc.vercel.app', '_blank'); }catch(e){} }
    }catch(e){}
  });

  // keyboard handlers moved to input.js

  // ship geometry moved to ship.js (shipVertices)

  state.particles = [];
  state.shake = 0;
  // particles moved to particles.js (spawnParticles / updateParticles)

  function update(dt){
    const ship = state.ship;
    if(state.transition.active){
      state.transition.progress += dt / state.transition.duration;
      if(state.transition.progress >= 1){ state.transition.active = false; state.menu = false; state.controllerConfirm = false; state.activeGamepad = -1; initGame(); }
    }

    // input polling handled in input.js
    pollInput(dt);
    const padRot = state.padRot || 0;
    const padThrottle = state.padThrottle || 0;

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

    const verts = shipVertices(ship, true);
    let collided = false;
    for(const v of verts){
      const ty = terrainYAt(state.terrain, v.x);
      if(v.y >= ty){ collided = true; break; }
    }
    if(collided){
      const onPad = state.pads.find(p => ship.x >= p.left && ship.x <= p.right);
      const safeAngle = 0.6; const safeVy = 3.2;
      if(onPad && Math.abs(ship.vy) <= safeVy){
        beep(880,0.12,'triangle',0.06);
        state.score += Math.max(100, Math.floor(150 - state.round*10) + Math.floor(state.fuel));
        if(state.score > (state.highscore||0)){ state.highscore = state.score; saveHigh(state.highscore); }
        state.round++;
        // gravity no longer scales with rounds; keep it constant
        spawnParticles(state, ship.x, ship.y, 26, 'rgba(160,255,160,0.95)', 1.2, 1.6);
        state.shake = Math.max(state.shake, 6);
        newRound(false);
      } else {
        stopThrustTone();
        beep(120,0.36,'sawtooth',0.06);
        spawnParticles(state, ship.x, ship.y, 40, 'rgba(220,80,40,0.98)', 1.6, 2.6);
        state.shake = Math.max(state.shake, 14);
        initGame();
      }
    }

    try{
      const ach = state.achievement;
      if(!ach.played && (state.attempts || 0) >= 5){ ach.played = true; ach.showing = true; ach.visible = true; ach.alpha = 0; ach.timerMs = 0; }
      if(ach.visible){
        if(ach.showing){ ach.alpha = Math.min(1, ach.alpha + dt * 0.06); ach.timerMs += dt * 16.666; if(ach.timerMs >= ach.durationMs) ach.showing = false; }
        else { ach.alpha = Math.max(0, ach.alpha - dt * 0.06); if(ach.alpha <= 0){ ach.visible = false; ach.timerMs = 0; } }
      }
    }catch(e){}
  }

  function draw(dt){
    if(state.menu){
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
      const mt = generateTerrain(W, 64);
      ctx.strokeStyle = '#666'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(mt[0].x, mt[0].y + 20);
      for(let i=1;i<mt.length;i++) ctx.lineTo(mt[i].x, mt[i].y + 20);
      ctx.stroke();
      if(state.controllerConfirm){
        drawControllerConfirm(ctx, W, H, joystickImg, state);
      } else {
        drawMenu(ctx, W, H, joystickImg, state);
      }
      if(state.transition.active) overlayTransition(ctx, W, H, state.transition.progress);
      return;
    }

    offCtx.clearRect(0,0,off.width,off.height);
    offCtx.strokeStyle = '#fff'; offCtx.lineWidth = 1; offCtx.beginPath();
    const t = state.terrain;
    const scaleX = off.width / W;
    const scaleY = off.height / H;
    offCtx.moveTo(t[0].x * scaleX, t[0].y * scaleY);
    for(let i=1;i<t.length;i++) offCtx.lineTo(t[i].x * scaleX, t[i].y * scaleY);
    offCtx.stroke();
    for(const p of state.pads){ offCtx.beginPath(); offCtx.moveTo(p.left * scaleX, p.y * scaleY); offCtx.lineTo(p.right * scaleX, p.y * scaleY); offCtx.stroke(); }

   
    
    const ship = state.ship;
    const rScaled = ship.radius * Math.max(scaleX, scaleY);
    const sx = ship.x * scaleX, sy = ship.y * scaleY;
    offCtx.save();
    offCtx.translate(sx, sy);
    offCtx.rotate(ship.angle);
    const isGolden = (state.score || 0) > 10000;
    if(isGolden){
      const pulse = 0.8 + 0.4 * Math.sin(Date.now() / 300);
      offCtx.shadowColor = 'rgba(255,200,80,0.95)';
      offCtx.shadowBlur = 18 * pulse;
      const gg = offCtx.createLinearGradient(-rScaled*0.8, -rScaled*1.0, rScaled*0.8, rScaled*1.2);
      gg.addColorStop(0, '#ffd86b'); gg.addColorStop(0.5, '#ffce3a'); gg.addColorStop(1, '#e6b22a');
      offCtx.fillStyle = gg;
      offCtx.strokeStyle = 'rgba(255,245,190,0.95)'; offCtx.lineWidth = Math.max(1, Math.round(rScaled*0.08));
      offCtx.beginPath(); offCtx.rect(-rScaled*0.8, -rScaled*1.0, rScaled*1.6, rScaled*1.2); offCtx.fill(); offCtx.stroke();
      offCtx.beginPath(); offCtx.fillStyle = 'rgba(255,255,255,0.95)'; offCtx.arc(0, -rScaled*0.35, rScaled*0.35, 0, Math.PI*2); offCtx.fill();
      offCtx.beginPath(); offCtx.strokeStyle = '#d49b18'; offCtx.lineWidth = Math.max(1, Math.round(rScaled*0.06));
      offCtx.moveTo(-rScaled*0.45, rScaled*0.6); offCtx.lineTo(-rScaled*0.95, rScaled*1.25); offCtx.moveTo(rScaled*0.45, rScaled*0.6); offCtx.lineTo(rScaled*0.95, rScaled*1.25); offCtx.stroke();
      offCtx.beginPath(); offCtx.moveTo(-rScaled*0.95, rScaled*1.25); offCtx.lineTo(-rScaled*1.15, rScaled*1.25); offCtx.moveTo(rScaled*0.95, rScaled*1.25); offCtx.lineTo(rScaled*1.15, rScaled*1.25); offCtx.stroke();
      offCtx.shadowBlur = 0; offCtx.shadowColor = 'transparent';
    } else {
      offCtx.strokeStyle = '#fff';
      offCtx.beginPath(); offCtx.rect(-rScaled*0.8, -rScaled*1.0, rScaled*1.6, rScaled*1.2); offCtx.stroke();
      offCtx.beginPath(); offCtx.arc(0, -rScaled*0.35, rScaled*0.35, 0, Math.PI*2); offCtx.stroke();
      offCtx.beginPath(); offCtx.moveTo(-rScaled*0.45, rScaled*0.6); offCtx.lineTo(-rScaled*0.95, rScaled*1.25); offCtx.moveTo(rScaled*0.45, rScaled*0.6); offCtx.lineTo(rScaled*0.95, rScaled*1.25); offCtx.stroke();
      offCtx.beginPath(); offCtx.moveTo(-rScaled*0.95, rScaled*1.25); offCtx.lineTo(-rScaled*1.15, rScaled*1.25); offCtx.moveTo(rScaled*0.95, rScaled*1.25); offCtx.lineTo(rScaled*1.15, rScaled*1.25); offCtx.stroke();
    }

    const thrustVisual = ((state.keys && state.keys.thrust) || (state.throttle && state.throttle > 0)) && state.fuel > 0;
    if(thrustVisual){
      offCtx.fillStyle = isGolden ? 'rgba(255,220,100,0.95)' : 'rgba(255,160,40,0.9)';
      offCtx.beginPath(); offCtx.moveTo(-rScaled*0.25, rScaled*0.9); offCtx.lineTo(0, rScaled*1.6 + (Math.random()*rScaled*0.25)); offCtx.lineTo(rScaled*0.25, rScaled*0.9); offCtx.closePath(); offCtx.fill();
    }
    offCtx.restore();

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,W,H);
    // apply screen shake when drawing the world
    ctx.save();
    if(state.shake){ const sx = (Math.random()*2-1) * state.shake; const sy = (Math.random()*2-1) * state.shake; ctx.translate(sx, sy); }
    ctx.drawImage(off, 0, 0, W, H);
    ctx.restore();
    // draw particles (world-space coords) on main canvas
    updateParticles(state, dt);
    if(state.particles.length){
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for(const p of state.particles){
        const alpha = Math.max(0, Math.min(1, p.life / 60));
        ctx.fillStyle = p.col.replace(/[^,]+\)$/, `${alpha})`);
        ctx.fillRect(Math.round(p.x)-1, Math.round(p.y)-1, 3, 3);
      }
      ctx.restore();
    }
    // draw pause overlay if paused
    if(state.paused){ drawPauseMenu(ctx, W, H); }

    ctx.font = '14px monospace'; ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${state.score}`, 12, 20);
    ctx.fillText(`Round: ${state.round}`, 12, 36);
    ctx.fillText(`Fuel: ${Math.floor(state.fuel)}`, 12, 52);
    const altMain = Math.max(0, Math.floor(terrainYAt(state.terrain, state.ship.x) - state.ship.y));
    ctx.fillText(`Alt: ${altMain}`, 12, 68);
    ctx.fillText(`VY: ${state.ship.vy.toFixed(2)}`, 12, 84);
    const barWmain = 140;
    ctx.strokeRect(12, 92, barWmain, 8);
    ctx.fillRect(12, 92, Math.max(0, barWmain * (state.fuel / base.startFuel)), 8);
    const thr = Math.max(0, Math.min(1, state.throttle || 0));
    ctx.strokeRect(12, 104, barWmain, 6);
    ctx.fillStyle = '#ffcc66';
    ctx.fillRect(12, 104, Math.round(barWmain * thr), 6);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.fillText('Throttle', 12 + barWmain + 8, 108);
    ctx.textAlign = 'right';
    ctx.fillText(`High: ${state.highscore||0}`, W - 12, 20);
    ctx.textAlign = 'left';
    // draw achievement banner if active
    try{ drawAchievement(ctx, W, H, state); }catch(e){ console.error('Achievement render error:', e); }

 
  }

  

  // keyboard start handled in input.js

  let last = performance.now();
  function loop(t){
    const dt = (t-last)/16.666; last=t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  initInput(state, { audioCtx, startMusic, setMusicVolume, stopThrustTone, startTransition, initGame, cycleShipShape, controls });
  initGame();
  requestAnimationFrame(loop);

  // audio unlock handled in input.js
})();
