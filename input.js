import { unlockAudioAndStartMusic } from './audio.js';

let _state = null;
let _deps = {};

export function initInput(state, deps = {}){
  _state = state;
  _deps = deps;
  window.addEventListener('gamepadconnected', _onGPConnect);
  window.addEventListener('gamepaddisconnected', _onGPDisconnect);
  window.addEventListener('keydown', _onKeyDown);
  window.addEventListener('keyup', _onKeyUp);
  window.addEventListener('pointerdown', _pointerUnlock);
}

export function disposeInput(){
  window.removeEventListener('gamepadconnected', _onGPConnect);
  window.removeEventListener('gamepaddisconnected', _onGPDisconnect);
  window.removeEventListener('keydown', _onKeyDown);
  window.removeEventListener('keyup', _onKeyUp);
  window.removeEventListener('pointerdown', _pointerUnlock);
}

function _onGPConnect(e){
  try{ _state.emblem.show = true; _state.emblem.alpha = 0; _state.emblem.phase = 0; }catch{};
  try{ const idx = (e.gamepad && typeof e.gamepad.index === 'number') ? e.gamepad.index : 0; vibrateGamepad(idx, 120, 0.6, 0.3); }catch(e){}
  try{ if(_deps.audioCtx && typeof _deps.audioCtx.resume === 'function'){ _deps.audioCtx.resume().then(()=>{ try{ _deps.startMusic && _deps.startMusic(); }catch(e){} }); } }catch(e){}
}

function _onGPDisconnect(e){ try{ _state.emblem.show = false; _state.emblem.alpha = 0; _state.emblem.phase = 0; stopThrottleVibration(); }catch(e){} }

function _pointerUnlock(){ try{ if(_deps.audioCtx && _deps.audioCtx.state === 'suspended'){ _deps.audioCtx.resume(); } try{ _deps.startMusic && _deps.startMusic(); }catch(e){} }catch(e){} }

function _onKeyDown(e){
  if(!_state) return;
  if(e.code==='ArrowLeft') _state.keys.left=true;
  if(e.code==='ArrowRight') _state.keys.right=true;
  if(e.code==='ArrowUp') _state.keys.thrust=true;
  if(['Space'].includes(e.code)) e.preventDefault();
  if(e.code==='KeyR') _deps.initGame && _deps.initGame();
  if(e.code==='KeyC') _deps.cycleShipShape && _deps.cycleShipShape();
  if(e.code==='Escape' || e.code==='KeyP'){
    if(!_state.menu && !_state.transition.active){ _state.paused = !_state.paused; _deps.setMusicVolume && _deps.setMusicVolume(_state.paused ? 0.01 : null); if(_state.paused){ _deps.stopThrustTone && _deps.stopThrustTone(); try{ stopThrottleVibration(); }catch(e){} } }
  }
  if(e.code === 'KeyQ'){
    _state.menu = true; _state.controllerConfirm = false; _state.paused = false; _deps.setMusicVolume && _deps.setMusicVolume(null); try{ stopThrottleVibration(); _deps.stopThrustTone && _deps.stopThrustTone(); }catch(e){}
  }
  // also start transition from menu via Enter/Space
  if(_state.menu && !_state.controllerConfirm && (e.code === 'Enter' || e.code === 'Space')){ if(!_state.transition.active) _deps.startTransition && _deps.startTransition(); }
}

function _onKeyUp(e){ if(!_state) return; if(e.code==='ArrowLeft') _state.keys.left=false; if(e.code==='ArrowRight') _state.keys.right=false; if(e.code==='ArrowUp') _state.keys.thrust=false; }

export function pollInput(dt){
  if(!_state) return;
  const gpsAll = navigator.getGamepads ? navigator.getGamepads() : [];
  try{
    if(_deps.audioCtx && _deps.audioCtx.state === 'suspended'){
      for(let gi=0; gi<gpsAll.length; gi++){
        const gg = gpsAll[gi]; if(!gg || !gg.buttons) continue;
        for(let bi=0; bi<gg.buttons.length; bi++){ const b = gg.buttons[bi]; if(b && (b.pressed || (typeof b.value === 'number' && b.value > 0.1))){ unlockAudioAndStartMusic(); gi = gpsAll.length; break; } }
      }
    }
  }catch(e){}

  let controlGP = null;
  if(_state.activeGamepad >= 0) controlGP = gpsAll[_state.activeGamepad];
  if(!controlGP){ for(let i=0;i<gpsAll.length;i++){ if(gpsAll[i]){ controlGP = gpsAll[i]; break; } } }

  if(controlGP){
    const startBtn = controlGP.buttons[9] || controlGP.buttons[7] || controlGP.buttons[8] || null;
    const startPressed = startBtn && (startBtn.pressed || (typeof startBtn.value === 'number' && startBtn.value > 0.5));
    if(startPressed && !_state.startHeld){
      if(!_state.menu && !_state.transition.active){
        _state.paused = !_state.paused;
        try{ vibrateGamepad(_state.activeGamepad >= 0 ? _state.activeGamepad : 0, 80, 0.6, 0.3); }catch(e){}
        _deps.setMusicVolume && _deps.setMusicVolume(_state.paused ? 0.01 : null);
        if(_state.paused) _deps.stopThrustTone && _deps.stopThrustTone();
      }
      _state.startHeld = true;
    } else if(!startPressed) { _state.startHeld = false; }
    const backBtn = controlGP.buttons[8] || controlGP.buttons[6] || null;
    const backPressed = backBtn && (backBtn.pressed || (typeof backBtn.value === 'number' && backBtn.value > 0.5));
    if(backPressed && !_state.backHeld){
      _state.menu = true; _state.controllerConfirm = false; _state.paused = false; _state.startHeld = false;
      try{ vibrateGamepad(_state.activeGamepad >= 0 ? _state.activeGamepad : 0, 100, 0.4, 0.2); }catch(e){}
      _deps.setMusicVolume && _deps.setMusicVolume(null);
    }
    if(!backPressed) _state.backHeld = false;
  }

  if(_state.menu){
    _state.controllerFade = Math.min(1, _state.controllerFade + (_state.controllerConfirm ? dt * 0.06 : -dt * 0.06));
    if(_state.controllerFade < 0) _state.controllerFade = 0;
    if(_state.controllerFade > 1) _state.controllerFade = 1;
    if(_state.emblem.show) _state.emblem.alpha = Math.min(1, _state.emblem.alpha + 0.02 * dt);
    else _state.emblem.alpha = Math.max(0, _state.emblem.alpha - 0.02 * dt);
    _state.emblem.phase += 0.03 * dt;

    const gps = gpsAll;
    if(_state.controllerConfirm){
      const idx = _state.activeGamepad >= 0 ? _state.activeGamepad : 0;
      const g = gps[idx];
      if(g){
        if(_state.waitForRelease){
          const btn = g.buttons[_state.firstButtonIndex];
          if(btn){ const val = (typeof btn.value === 'number') ? btn.value : 0; if(!btn.pressed && val < 0.15) _state.waitForRelease = false; }
          return;
        }
        for(let b=0;b<g.buttons.length;b++){ const btn = g.buttons[b]; if(btn && (btn.pressed || btn.value > 0.5)){ const ok = (_state.firstButtonIndex >= 0 && b === _state.firstButtonIndex) || [0,2,9].includes(b); if(ok){ if(!_state.transition.active) _deps.startTransition && _deps.startTransition(); return; } } }
      }
    } else {
      for(let i=0;i<gps.length;i++){
        const g = gps[i]; if(!g) continue;
        for(let b=0;b<g.buttons.length;b++){
          const btn = g.buttons[b]; if(btn && (btn.pressed || btn.value > 0.5)){ _state.controllerConfirm = true; _state.activeGamepad = i; _state.firstButtonIndex = b; _state.waitForRelease = true; try{ vibrateGamepad(i, 80, 0.6, 0.4); }catch(e){} return; }
        }
      }
    }
    return;
  }

  if(_state.paused) return;

  const gp = controlGP || (navigator.getGamepads ? navigator.getGamepads()[0] : null);
  let padRot = 0, padThrottle = 0;
  if(gp){ padRot = gp.axes[0] || 0; if(Math.abs(padRot) < (_deps.controls && _deps.controls.deadzone ? _deps.controls.deadzone : 0.15)) padRot = 0; if(gp.buttons[7]) padThrottle = gp.buttons[7].value || 0; if(!padThrottle && gp.buttons[0]) padThrottle = gp.buttons[0].pressed ? 1 : 0; if(!padThrottle && gp.axes[1] !== undefined){ const a = gp.axes[1]; if(a < -(_deps.controls && _deps.controls.deadzone ? _deps.controls.deadzone : 0.15)) padThrottle = Math.min(1, -a); } }

  _state.padRot = padRot; _state.padThrottle = padThrottle;
  _state.throttle = (padThrottle>0) ? padThrottle : (_state.keys.thrust ? 1 : 0);

  try{
    const prevPadThrottle = (_state._lastPadThrottle || 0);
    if(padThrottle > 0 && prevPadThrottle <= 0){ try{ startThrottleVibration(_state.activeGamepad >= 0 ? _state.activeGamepad : (controlGP && typeof controlGP.index === 'number' ? controlGP.index : -1)); }catch(e){} }
    else if(padThrottle <= 0 && prevPadThrottle > 0){ try{ stopThrottleVibration(); }catch(e){} }
    _state._lastPadThrottle = padThrottle;
  }catch(e){}
}

export function vibrateGamepad(idx, duration=100, strong=0.5, weak=0.5){
  try{
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let g = (typeof idx === 'number' && gps[idx]) ? gps[idx] : null;
    let usedIndex = (typeof idx === 'number' && gps[idx]) ? idx : -1;
    if(!g){ for(let i=0;i<gps.length;i++){ const gg = gps[i]; if(!gg) continue; if(gg.vibrationActuator || (gg.hapticActuators && gg.hapticActuators.length)){ g = gg; usedIndex = i; break; } } }
    if(!g) return;
    if(g.vibrationActuator && typeof g.vibrationActuator.playEffect === 'function'){ try{ g.vibrationActuator.playEffect('dual-rumble', {duration: duration, strongMagnitude: strong, weakMagnitude: weak}); }catch(err){} }
    else if(g.hapticActuators && g.hapticActuators.length && typeof g.hapticActuators[0].pulse === 'function'){ try{ g.hapticActuators[0].pulse(strong, duration); }catch(err){ try{ g.hapticActuators[0].pulse(duration, strong); }catch(_){} } }
    else if(g.vibrationActuator && typeof g.vibrationActuator === 'object' && g.vibrationActuator.type){ try{ g.vibrationActuator.playEffect && g.vibrationActuator.playEffect('dual-rumble', {duration: duration, strongMagnitude: strong, weakMagnitude: weak}); }catch(err){} }
  }catch(e){}
}

let _throttleVib = { interval: null, padIndex: -1, active:false };
export function startThrottleVibration(idx){
  try{
    if(!navigator.getGamepads) return;
    const gps = navigator.getGamepads();
    let g = (typeof idx === 'number' && idx>=0 && gps[idx]) ? gps[idx] : null;
    let usedIndex = (typeof idx === 'number' && idx>=0 && gps[idx]) ? idx : -1;
    if(!g){ for(let i=0;i<gps.length;i++){ const gg = gps[i]; if(!gg) continue; if(gg.vibrationActuator || (gg.hapticActuators && gg.hapticActuators.length)){ g = gg; usedIndex = i; break; } } }
    if(!g) return;
    if(_throttleVib && _throttleVib.interval && _throttleVib.padIndex === usedIndex) return;
    if(_throttleVib && _throttleVib.interval){ clearInterval(_throttleVib.interval); _throttleVib.interval = null; }
    const pulse = ()=>{ try{ if(g.vibrationActuator && typeof g.vibrationActuator.playEffect === 'function'){ g.vibrationActuator.playEffect('dual-rumble', { duration: 120, strongMagnitude: 0.32, weakMagnitude: 0.12 }); } else if(g.hapticActuators && g.hapticActuators.length && typeof g.hapticActuators[0].pulse === 'function'){ try{ g.hapticActuators[0].pulse(0.28, 120); }catch(e){ try{ g.hapticActuators[0].pulse(120, 0.28); }catch(_){} } } else if(g.vibrationActuator && typeof g.vibrationActuator.playEffect === 'function'){ try{ g.vibrationActuator.playEffect('dual-rumble', { duration: 120, strongMagnitude: 0.28, weakMagnitude: 0.12 }); }catch(e){} } }catch(e){} };
    pulse();
    const id = setInterval(pulse, 200);
    _throttleVib = { interval: id, padIndex: usedIndex, active: true };
  }catch(e){}
}

export function stopThrottleVibration(){
  try{ if(_throttleVib && _throttleVib.interval){ clearInterval(_throttleVib.interval); } const gps = navigator.getGamepads ? navigator.getGamepads() : []; const idx = (_throttleVib && typeof _throttleVib.padIndex === 'number') ? _throttleVib.padIndex : -1; const g = (idx>=0 && gps[idx]) ? gps[idx] : null; if(g && g.vibrationActuator && typeof g.vibrationActuator.playEffect === 'function'){ try{ g.vibrationActuator.playEffect('dual-rumble', { duration: 20, strongMagnitude: 0.0, weakMagnitude: 0.0 }); }catch(e){} } }catch(e){}
  _throttleVib = { interval: null, padIndex: -1, active: false };
}
