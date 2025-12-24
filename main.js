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
  function vibrateGamepad(idx, duration=100, strong=0.5, weak=0.5){
    try{
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      let g = (typeof idx === 'number' && gps[idx]) ? gps[idx] : null;
      let usedIndex = (typeof idx === 'number' && gps[idx]) ? idx : -1;
      if(!g){
        for(let i=0;i<gps.length;i++){
          const gg = gps[i];
          if(!gg) continue;
          if(gg.vibrationActuator || (gg.hapticActuators && gg.hapticActuators.length)){
            g = gg; usedIndex = i; break;
          }
        }
      }
      console.debug('vibrateGamepad requestedIdx=', idx, 'usingIdx=', usedIndex, 'gamepad=', g);
      if(!g){ console.debug('no gamepad available for vibration'); return; }

      if(g.vibrationActuator && typeof g.vibrationActuator.playEffect === 'function'){
        console.debug('using vibrationActuator.playEffect on index', usedIndex);
        try{
          const res = g.vibrationActuator.playEffect('dual-rumble', {duration: duration, strongMagnitude: strong, weakMagnitude: weak});
          if(res && typeof res.then === 'function') res.then(()=>console.debug('vibration playEffect resolved')).catch(err=>console.warn('vibration playEffect err', err));
        }catch(err){ console.warn('vibrationActuator.playEffect threw', err); }

      } else if(g.hapticActuators && g.hapticActuators.length && typeof g.hapticActuators[0].pulse === 'function'){
        console.debug('using hapticActuators[0].pulse on index', usedIndex);
        try{ g.hapticActuators[0].pulse(strong, duration); }catch(err1){ try{ g.hapticActuators[0].pulse(duration, strong); }catch(err2){ console.warn('hapticActuators pulse failed (both signatures)', err1, err2); } }

      } else if(g.vibrationActuator && typeof g.vibrationActuator === 'object' && g.vibrationActuator.type){
        console.debug('using generic vibrationActuator interface on index', usedIndex);
        try{ g.vibrationActuator.playEffect && g.vibrationActuator.playEffect('dual-rumble', {duration: duration, strongMagnitude: strong, weakMagnitude: weak}); }catch(err){ console.warn('generic actuator playEffect failed', err); }
      } else {
        console.debug('no recognized actuator on gamepad at index', usedIndex);
      }
    }catch(e){ console.warn('vibrateGamepad error', e); }
  }
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


  // music (doesnt work)
  let musicLead = null, musicLeadGain = null, musicBass = null, musicBassGain = null, musicTimer = null, musicStep = 0, musicPlaying=false;
  const leadPattern = [660,660,0,660,0,524,660,784];
  const leadDur = 0.18; 
  function startMusic(){
    if(musicPlaying || audioCtx.state==='suspended') return; musicPlaying = true;
    musicLead = audioCtx.createOscillator(); musicLead.type = 'square';
    musicLeadGain = audioCtx.createGain(); musicLeadGain.gain.value = 0;
    musicLead.connect(musicLeadGain); musicLeadGain.connect(audioCtx.destination);
    musicBass = audioCtx.createOscillator(); musicBass.type = 'square';
    musicBass.frequency.value = 110; musicBassGain = audioCtx.createGain(); musicBassGain.gain.value = 0.02;
    musicBass.connect(musicBassGain); musicBassGain.connect(audioCtx.destination);
    musicLead.start(); musicBass.start();
    musicTimer = setInterval(()=>{
      const f = leadPattern[musicStep % leadPattern.length] || 0;
      if(f>0){ musicLead.frequency.setValueAtTime(f, audioCtx.currentTime); musicLeadGain.gain.cancelScheduledValues(audioCtx.currentTime); musicLeadGain.gain.setValueAtTime(0.0001, audioCtx.currentTime); musicLeadGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.01); musicLeadGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + leadDur);
      } else { musicLeadGain.gain.setValueAtTime(0.0001, audioCtx.currentTime); }
      // bass pattern simple
      const b = (musicStep % 4 === 0) ? 110 : 0;
      if(b>0){ musicBass.frequency.setValueAtTime(b, audioCtx.currentTime); musicBassGain.gain.cancelScheduledValues(audioCtx.currentTime); musicBassGain.gain.setValueAtTime(0.0001, audioCtx.currentTime); musicBassGain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 0.01); musicBassGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + leadDur*1.1);
      } else musicBassGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      musicStep++;
    }, Math.round(leadDur*1000));
  }
  function stopMusic(){ if(!musicPlaying) return; clearInterval(musicTimer); try{ musicLead.stop(); musicBass.stop(); }catch(e){} musicPlaying=false; }
  function setMusicVolume(level){
    try{
      if(!musicPlaying) return;
      if(musicLeadGain) musicLeadGain.gain.setTargetAtTime((level===null)?0.08:level, audioCtx.currentTime, 0.02);
      if(musicBassGain) musicBassGain.gain.setTargetAtTime((level===null)?0.02:Math.max(0.001, level*0.25), audioCtx.currentTime, 0.02);
    }catch(e){}
  }

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
  state.menu = true;
  state.emblem = {show:false,alpha:0,phase:0};
  state.controllerConfirm = false;
  state.controllerFade = 0;
  state.activeGamepad = -1;
  state.firstButtonIndex = -1;
  state.waitForRelease = false;
  state.firstButtonIndex = -1;
  state.paused = false;
  state.startHeld = false;
  state.backHeld = false;
  function loadHigh(){
    return Number(localStorage.getItem('ocastle_highscore')||0);
  }
  function saveHigh(v){
    try{ localStorage.setItem('ocastle_highscore', String(v)); }catch(e){}
  }
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
    state.highscore = loadHigh();
    newRound(true);
  }

  window.addEventListener('gamepadconnected', e=>{ 
    state.emblem.show = true; state.emblem.alpha = 0; state.emblem.phase = 0; 
    try{
      console.log('gamepadconnected:', e.gamepad && e.gamepad.index, e.gamepad);
      vibrateGamepad((e.gamepad && typeof e.gamepad.index === 'number') ? e.gamepad.index : 0, 120, 0.6, 0.3);
    }catch(err){ console.warn('vibration test failed', err); }
  });
  window.addEventListener('gamepaddisconnected', e=>{ state.emblem.show = false; state.emblem.alpha = 0; state.emblem.phase = 0; });

  window.addEventListener('keydown', e=>{
    if(e.code==='ArrowLeft') state.keys.left=true;
    if(e.code==='ArrowRight') state.keys.right=true;
    if(e.code==='ArrowUp') state.keys.thrust=true;
    if(['Space'].includes(e.code)) e.preventDefault();
    if(e.code==='KeyR') initGame();
    if(e.code==='Escape' || e.code==='KeyP'){
      if(!state.menu && !state.transition.active){ state.paused = !state.paused; setMusicVolume(state.paused ? 0.01 : null); if(state.paused) stopThrustTone(); }
    }
    if(e.code === 'KeyQ'){
      // quick quit to menu
      state.menu = true; state.controllerConfirm = false; state.paused = false; setMusicVolume(null);
    }
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

  // ---- particles & screen shake ----
  state.particles = [];
  state.shake = 0;
  function spawnParticles(x,y,count=16, color='rgba(255,200,120,0.9)', spread=1.5, speed=1.6){
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2; const s = (Math.random()*0.6+0.4) * speed;
      state.particles.push({ x:x + (Math.random()-0.5)*6, y:y + (Math.random()-0.5)*6, vx: Math.cos(a)*s*spread, vy: Math.sin(a)*s*spread - Math.random()*1.2, life: 40 + Math.random()*30, col: color });
    }
  }
  function updateParticles(dt){
    for(let i=state.particles.length-1;i>=0;i--){
      const p = state.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.12 * dt; p.life -= dt*1.2; if(p.life <= 0) state.particles.splice(i,1);
    }
    // decay shake
    state.shake *= Math.pow(0.85, dt);
    if(state.shake < 0.01) state.shake = 0;
  }

  function update(dt){
    const ship = state.ship;
    if(state.transition.active){
      state.transition.progress += dt / state.transition.duration;
      if(state.transition.progress >= 1){ state.transition.active = false; state.menu = false; state.controllerConfirm = false; state.activeGamepad = -1; initGame(); }
    }

    const gpsAll = navigator.getGamepads ? navigator.getGamepads() : [];
    let controlGP = null;
    if(state.activeGamepad >= 0) controlGP = gpsAll[state.activeGamepad];
    if(!controlGP){ for(let i=0;i<gpsAll.length;i++){ if(gpsAll[i]){ controlGP = gpsAll[i]; break; } } }

    if(controlGP){
      const startBtn = controlGP.buttons[9] || controlGP.buttons[7] || controlGP.buttons[8] || null;
      const startPressed = startBtn && (startBtn.pressed || (typeof startBtn.value === 'number' && startBtn.value > 0.5));
      if(startPressed && !state.startHeld){
        if(!state.menu && !state.transition.active){
          state.paused = !state.paused;
          try{ vibrateGamepad(state.activeGamepad >= 0 ? state.activeGamepad : 0, 80, 0.6, 0.3); }catch(e){}
          setMusicVolume(state.paused ? 0.01 : null);
          if(state.paused) stopThrustTone();
        }
        state.startHeld = true;
      } else if(!startPressed){ state.startHeld = false; }
      const backBtn = controlGP.buttons[8] || controlGP.buttons[6] || null;
      const backPressed = backBtn && (backBtn.pressed || (typeof backBtn.value === 'number' && backBtn.value > 0.5));
      if(backPressed && !state.backHeld){
        state.menu = true; state.controllerConfirm = false; state.paused = false; state.startHeld = false;
        try{ vibrateGamepad(state.activeGamepad >= 0 ? state.activeGamepad : 0, 100, 0.4, 0.2); }catch(e){}
        setMusicVolume(null);
      }
      if(!backPressed) state.backHeld = false;
    }

    if(state.menu){
      // controller confirm fade in/out
      state.controllerFade = Math.min(1, state.controllerFade + (state.controllerConfirm ? dt * 0.06 : -dt * 0.06));
      if(state.controllerFade < 0) state.controllerFade = 0;
      if(state.controllerFade > 1) state.controllerFade = 1;

      if(state.emblem.show) state.emblem.alpha = Math.min(1, state.emblem.alpha + 0.02 * dt);
      else state.emblem.alpha = Math.max(0, state.emblem.alpha - 0.02 * dt);
      state.emblem.phase += 0.03 * dt;
      const gps = gpsAll;
      if(state.controllerConfirm){
        const idx = state.activeGamepad >= 0 ? state.activeGamepad : 0;
        const g = gps[idx];
        if(g){
          if(state.waitForRelease){
            const btn = g.buttons[state.firstButtonIndex];
            if(btn){
              const val = (typeof btn.value === 'number') ? btn.value : 0;
              if(!btn.pressed && val < 0.15) state.waitForRelease = false;
            }
            return;
          }
          for(let b=0;b<g.buttons.length;b++){
            const btn = g.buttons[b];
            if(btn && (btn.pressed || btn.value > 0.5)){
              const ok = (state.firstButtonIndex >= 0 && b === state.firstButtonIndex) || [0,2,9].includes(b);
              if(ok){ if(!state.transition.active) startTransition(); return; }
            }
          }
        }
      } else {
        for(let i=0;i<gps.length;i++){
          const g = gps[i];
          if(!g) continue;
          for(let b=0;b<g.buttons.length;b++){
            const btn = g.buttons[b];
            if(btn && (btn.pressed || btn.value > 0.5)){
              state.controllerConfirm = true;
              state.activeGamepad = i;
              state.firstButtonIndex = b;
              state.waitForRelease = true;
              try{ vibrateGamepad(i, 80, 0.6, 0.4); }catch(e){}
              return;
            }
          }
        }
      }
      return;
    }

    if(state.paused){ return; }

    const gp = controlGP || (navigator.getGamepads ? navigator.getGamepads()[0] : null);
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
        if(state.score > (state.highscore||0)){ state.highscore = state.score; saveHigh(state.highscore); }
        state.round++;
        state.gravity *= 1.03;
        spawnParticles(ship.x, ship.y, 26, 'rgba(160,255,160,0.95)', 1.2, 1.6);
        state.shake = Math.max(state.shake, 6);
        try{ vibrateGamepad(state.activeGamepad >= 0 ? state.activeGamepad : 0, 260, 0.9, 0.6); }catch(e){}
        newRound(false);
      } else {
        stopThrustTone();
        beep(80,0.4,'sawtooth',0.18);
        spawnParticles(ship.x, ship.y, 40, 'rgba(220,80,40,0.98)', 1.6, 2.6);
        state.shake = Math.max(state.shake, 14);
        try{ vibrateGamepad(state.activeGamepad >= 0 ? state.activeGamepad : 0, 420, 1.0, 1.0); }catch(e){}
        initGame();
      }
    }
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
        drawControllerConfirm();
      } else {
        drawMenu();
      }
      if(state.transition.active) overlayTransition(state.transition.progress);
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

    const verts = shipVertices(state.ship);
    offCtx.beginPath(); offCtx.moveTo(verts[0].x * scaleX, verts[0].y * scaleY);
    offCtx.lineTo(verts[1].x * scaleX, verts[1].y * scaleY); offCtx.lineTo(verts[2].x * scaleX, verts[2].y * scaleY); offCtx.closePath(); offCtx.stroke();

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,W,H);
    // apply screen shake when drawing the world
    ctx.save();
    if(state.shake){ const sx = (Math.random()*2-1) * state.shake; const sy = (Math.random()*2-1) * state.shake; ctx.translate(sx, sy); }
    ctx.drawImage(off, 0, 0, W, H);
    ctx.restore();
    // draw particles (world-space coords) on main canvas
    updateParticles(dt);
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
    if(state.paused){ drawPauseMenu(); }

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
    ctx.textAlign = 'right';
    ctx.fillText(`High: ${state.highscore||0}`, W - 12, 20);
    ctx.textAlign = 'left';
    if(state.menu) drawMenu();
  }

  function drawMenu(){
    ctx.save();
    ctx.fillStyle = '#030710ff'; ctx.fillRect(0,0,W,H);

    const cx = Math.round(W/2), cy = Math.round(H/2);
    const panelW = Math.min(720, Math.round(W*0.6));
    const panelH = Math.round(Math.min(220, H*0.28));
    const px = cx - Math.round(panelW/2), py = cy - Math.round(panelH/2);
    function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
    ctx.fillStyle = 'rgba(0,0,0,0.52)'; roundRect(px, py, panelW, panelH, 14); ctx.fill();
    const glow = ctx.createLinearGradient(px, py, px, py+panelH); glow.addColorStop(0, 'rgba(255,255,255,0.03)'); glow.addColorStop(1, 'rgba(255,255,255,0.01)');
    ctx.fillStyle = glow; roundRect(px+2, py+2, panelW-4, panelH-4, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = Math.max(36, Math.round(H*0.06)) + 'px monospace';
    ctx.fillText('OCastle!', cx, py + Math.round(panelH*0.28));
    ctx.font = Math.max(14, Math.round(H*0.03)) + 'px monospace';
    ctx.fillText('Press Enter or Start to Launch', cx, py + Math.round(panelH*0.56));
    ctx.font = Math.max(12, Math.round(H*0.02)) + 'px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Arrow keys to rotate · Up to thrust', cx, py + Math.round(panelH*0.78));
    ctx.restore();
  }

  function drawControllerConfirm(){
    ctx.save();
    ctx.globalAlpha = state.controllerFade;
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = Math.max(28, Math.round(H*0.05)) + 'px monospace';
    ctx.fillText('Controller Detected', W/2, Math.round(H*0.18));
    ctx.font = Math.max(14, Math.round(H*0.025)) + 'px monospace';
    let label = 'Press the same button to confirm and start';
    if(state.firstButtonIndex === 0) label = 'Press X / A to confirm and start';
    if(state.firstButtonIndex === 1) label = 'Press B / O to confirm and start';
    if(state.firstButtonIndex === 2) label = 'Press Square / X to confirm and start';
    if(state.firstButtonIndex === 3) label = 'Press Y / △ to confirm and start';
    if(state.waitForRelease) label = 'Release the button, then press again to confirm';
    ctx.fillText(label, W/2, Math.round(H*0.26));
    const imgW = Math.min(360, Math.round(W*0.32));
    const aspect = (joystickImg.naturalWidth && joystickImg.naturalHeight) ? (joystickImg.naturalHeight / joystickImg.naturalWidth) : 0.5;
    const imgH = Math.max( Math.round(imgW * aspect), Math.round(imgW * 0.6) );
    const ex = Math.round((W - imgW)/2);
    const ey = Math.round(H*0.35);
    const sizeW = Math.round(imgW);
    const sizeH = Math.round(imgH);
    const dx = ex; const dy = ey;
    if(joystickImg && joystickImg.complete && joystickImg.naturalWidth){
      ctx.drawImage(joystickImg, dx, dy, sizeW, sizeH);
    } 

    else {
      ctx.fillStyle = '#222'; ctx.fillRect(ex, ey, imgW, imgH);
    }

    ctx.font = Math.max(12, Math.round(H*0.02)) + 'px monospace';
    ctx.fillStyle = '#fff'; ctx.fillText('Press the same button to continue', W/2, ey + imgH + 48);
  
    ctx.font = Math.max(11, Math.round(H*0.017)) + 'px monospace';
    const det = (state.firstButtonIndex >= 0) ? String(state.firstButtonIndex) : '—';
    const waitLabel = state.waitForRelease ? ' (waiting release)' : '';
    ctx.fillText('Detected button: ' + det + waitLabel, W/2, ey + imgH + 72);
    ctx.restore();
    // ensure alpha restored for rest of drawing
    ctx.globalAlpha = 1;
  }

  function drawPauseMenu(){
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.54)'; ctx.fillRect(0,0,W,H);
    const cardW = Math.min(620, Math.round(W*0.6)); const cardH = Math.round(H*0.36);
    const cx = Math.round((W - cardW)/2), cy = Math.round((H - cardH)/2);
    function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
    ctx.fillStyle = 'rgba(0,0,0,0.66)'; roundRect(ctx, cx+8, cy+10, cardW, cardH, 14); ctx.fill();
    const cg = ctx.createLinearGradient(cx, cy, cx, cy + cardH); cg.addColorStop(0,'rgba(255,255,255,0.03)'); cg.addColorStop(1,'rgba(255,255,255,0.01)');
    ctx.fillStyle = cg; roundRect(ctx, cx, cy, cardW, cardH, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = Math.max(48, Math.round(H*0.07)) + 'px monospace'; ctx.fillText('PAUSED', W/2, cy + 74);
    ctx.font = Math.max(16, Math.round(H*0.03)) + 'px monospace'; ctx.fillText('Press Start / Enter to Resume', W/2, cy + 120);
    ctx.font = Math.max(14, Math.round(H*0.024)) + 'px monospace'; ctx.fillText('Press R to Restart — Press Back to Quit', W/2, cy + 156);
    // buttons
    const bw = 220, bh = 48; const left = cx + Math.round(cardW*0.18); const right = cx + cardW - Math.round(cardW*0.18) - bw;
    ctx.fillStyle = '#2e88ff'; roundRect(ctx, left, cy + cardH - bh - 28, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#2e88ff'; roundRect(ctx, right, cy + cardH - bh - 28, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = Math.max(14, Math.round(H*0.02)) + 'px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Resume (Start)', left + bw/2, cy + cardH - bh/2 - 10);
    ctx.fillText('Quit to Menu (Back)', right + bw/2, cy + cardH - bh/2 - 10);
    ctx.restore();
  }

  function overlayTransition(p){
    const prog = Math.max(0, Math.min(1, p));
    const diag = Math.hypot(W, H);
    const angle = Math.atan2(H, -W);
    const rectW = diag * 1.6, rectH = diag * 1.0;
    const x = diag * (1 - 2 * prog);
    ctx.save();
    ctx.translate(W/2, H/2);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(x - rectW/2, 0, x + rectW/2, 0);
    grad.addColorStop(0, 'rgba(80,100,160,' + (0.28 * prog) + ')');
    grad.addColorStop(0.5, 'rgba(180,200,255,' + (0.14 * prog) + ')');
    grad.addColorStop(1, 'rgba(0,0,0,' + (0.6 * prog) + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(x - rectW/2, -rectH/2, rectW, rectH);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 2;
    const bands = 5;
    for(let band=0; band<bands; band++){
      const bandProg = prog * (1 + band*0.15);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.08 * (1-band/bands) * bandProg) + ')';
      const steps = 18;
      for(let i=0;i<steps;i++){
        const t = i/ (steps-1);
        const sx = x - rectW/2 + t * rectW;
        const wobble = Math.sin((t * 18) + prog * 12 + band) * (8 + 28 * (1-prog));
        ctx.beginPath(); ctx.moveTo(sx, -rectH/2 + wobble); ctx.lineTo(sx, rectH/2 - wobble); ctx.stroke();
      }
    }
    ctx.restore();
  }

  window.addEventListener('keydown', e=>{
    if(state.menu && !state.controllerConfirm && (e.code === 'Enter' || e.code === 'Space')){ if(!state.transition.active) startTransition(); }
  });

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
  // start music once audio is unlocked
  const _unlock = unlock;
  function _unlock_and_music(){
    if(audioCtx.state==='suspended') audioCtx.resume();
    try{ startMusic(); }catch(e){}
    window.removeEventListener('pointerdown', _unlock_and_music);
  }
  window.removeEventListener('pointerdown', unlock);
  window.addEventListener('pointerdown', _unlock_and_music);
})();
