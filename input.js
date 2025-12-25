import { unlockAudioAndStartMusic } from './audio.js';

let _state = null;
let _deps = {};
let _inited = false;
const VIBRATION_CONFIG = {
  maxStrong: 0.18,
  maxWeak: 0.06,
  minIntervalMs: 60,
  defaultDuration: 100,
  maxDuration: 500,
  throttleInterval: 220
};
let _lastVib = {};
let _yHeld = false;
let _l3Held = false;
let _vibMult = 1;

export function initInput(state, deps = {}){
  if(_inited) return;
  _inited = true;
  _state = state;
  _deps = deps;
  window.addEventListener('gamepadconnected', _onGPConnect);
  window.addEventListener('gamepaddisconnected', _onGPDisconnect);
  window.addEventListener('keydown', _onKeyDown);
  window.addEventListener('keyup', _onKeyUp);
  window.addEventListener('pointerdown', _pointerUnlock);
}

export function disposeInput(){
  if(!_inited) return;
  _inited = false;
  try{ stopThrottleVibration(); }catch(e){}
  window.removeEventListener('gamepadconnected', _onGPConnect);
  window.removeEventListener('gamepaddisconnected', _onGPDisconnect);
  window.removeEventListener('keydown', _onKeyDown);
  window.removeEventListener('keyup', _onKeyUp);
  window.removeEventListener('pointerdown', _pointerUnlock);
}

function _onGPConnect(e){
  if(!_state) return;
  try{ _state.emblem.show = true; _state.emblem.alpha = 0; _state.emblem.phase = 0; }catch{};
  try{ const idx = (e.gamepad && typeof e.gamepad.index === 'number') ? e.gamepad.index : 0; vibrateGamepad(idx, 120, 0.6, 0.3); }catch(e){}
  try{ unlockAudioAndStartMusic(); }catch(e){}
}

function _onGPDisconnect(e){ if(!_state) return; try{ _state.emblem.show = false; _state.emblem.alpha = 0; _state.emblem.phase = 0; stopThrottleVibration(); _state.controllerConfirm = false; _state._controllerConfirmPhase = null; _state.waitForRelease = false; }catch(e){} }

function _pointerUnlock(){ try{ unlockAudioAndStartMusic(); }catch(e){} }

function _onKeyDown(e){
  if(!_state) return;
  if(_state.settings && _state.settings.visible){
    const idx = _state.settings.selectedIndex || 0;
    if(e.code === 'ArrowUp'){ _state.settings.selectedIndex = Math.max(0, idx - 1); return; }
    if(e.code === 'ArrowDown'){ _state.settings.selectedIndex = Math.min(4, idx + 1); return; }
    if(e.code === 'ArrowLeft'){
      const si = _state.settings.selectedIndex || 0;
      if(si === 0) _state.settings.music = Math.max(0, (_state.settings.music || 0) - 0.01);
      if(si === 1) _state.settings.sfx = Math.max(0, (_state.settings.sfx || 1) - 0.05);
      if(si === 2) _state.settings.vibration = Math.max(0, (_state.settings.vibration || 1) - 0.05);
      if(si === 3) _state.settings.stars = Math.max(0, (_state.settings.stars || 1) - 0.1);
      return;
    }
    if(e.code === 'ArrowRight'){
      const si = _state.settings.selectedIndex || 0;
      if(si === 0) _state.settings.music = Math.min(1, (_state.settings.music || 0) + 0.01);
      if(si === 1) _state.settings.sfx = Math.min(4, (_state.settings.sfx || 1) + 0.05);
      if(si === 2) _state.settings.vibration = Math.min(2, (_state.settings.vibration || 1) + 0.05);
      if(si === 3) _state.settings.stars = Math.min(3, (_state.settings.stars || 1) + 0.1);
      return;
    }
    if(e.code === 'Enter'){
      const si = _state.settings.selectedIndex || 0;
      if(si === 4) _state.settings.fullscreen = !_state.settings.fullscreen;
      return;
    }
  }
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
    _state.menu = true; _state.controllerConfirm = false; _state._controllerConfirmPhase = null; _state._controllerConfirmTs = null; _state.waitForRelease = false; _state.paused = false; _deps.setMusicVolume && _deps.setMusicVolume(null); try{ stopThrottleVibration(); _deps.stopThrustTone && _deps.stopThrustTone(); }catch(e){}
  }
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
    try{
      const yBtn = controlGP.buttons[3];
      const l3Btn = controlGP.buttons[10] || controlGP.buttons[11] || null;
      const yPressed = yBtn && (yBtn.pressed || (typeof yBtn.value === 'number' && yBtn.value > 0.5));
      const l3Pressed = l3Btn && (l3Btn.pressed || (typeof l3Btn.value === 'number' && l3Btn.value > 0.5));
      if(yPressed && !_yHeld){
        _yHeld = true;
        try{
          _state.achievement = _state.achievement || { visible:false, showing:false, alpha:0, timerMs:0, durationMs:8000 };
          _state.achievement.visible = true;
          _state.achievement.showing = true;
          _state.achievement.alpha = 0;
          _state.achievement.timerMs = 0;
          _state.achievement.message = _state.achievement.message || 'Want to see more games? Visit retro-hc.vercel.app';
          vibrateGamepad(_state.activeGamepad >= 0 ? _state.activeGamepad : 0, 60, 0.18, 0.08);
        }catch(e){}
      }
      if(!yPressed) _yHeld = false;
      if(l3Pressed && !_l3Held){ _l3Held = true; try{ _deps.cycleShipShape && _deps.cycleShipShape(); vibrateGamepad(_state.activeGamepad >= 0 ? _state.activeGamepad : 0, 60, 0.2, 0.08); }catch(e){} }
      if(!l3Pressed) _l3Held = false;
    }catch(e){}
    const startBtn = controlGP.buttons[9] || controlGP.buttons[7] || controlGP.buttons[8] || null;
    const startPressed = startBtn && (startBtn.pressed || (typeof startBtn.value === 'number' && startBtn.value > 0.5));
    if(startPressed && !_state.startHeld){
      if(!_state.menu && !_state.transition.active){
        _state.paused = !_state.paused;
        try{ vibrateGamepad(_state.activeGamepad >= 0 ? _state.activeGamepad : 0, 80, 0.6, 0.3); }catch(e){}
        _deps.setMusicVolume && _deps.setMusicVolume(_state.paused ? 0.01 : null);
        if(_state.paused){
          _deps.stopThrustTone && _deps.stopThrustTone();
          try{ stopThrottleVibration(); }catch(e){}
        }
      }
      _state.startHeld = true;
    } else if(!startPressed) { _state.startHeld = false; }
    const backBtn = controlGP.buttons[8] || controlGP.buttons[6] || null;
    const backPressed = backBtn && (backBtn.pressed || (typeof backBtn.value === 'number' && backBtn.value > 0.5));
    if(backPressed && !_state.backHeld){
      _state.menu = true; _state.controllerConfirm = false; _state._controllerConfirmPhase = null; _state._controllerConfirmTs = null; _state.waitForRelease = false; _state.paused = false; _state.startHeld = false;
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
          if(btn){ const val = (typeof btn.value === 'number') ? btn.value : 0; if(!btn.pressed || val < 0.35){ _state.waitForRelease = false; _state._controllerConfirmPhase = 'awaitPress'; } }
          try{ if(_state._controllerConfirmTs && (Date.now() - _state._controllerConfirmTs) > 1200){ _state.waitForRelease = false; _state._controllerConfirmPhase = 'awaitPress'; } }catch(e){}
          return;
        }
          for(let b=0;b<g.buttons.length;b++){
            const btn = g.buttons[b];
            if(btn && (btn.pressed || btn.value > 0.5)){
              const ok = (_state.firstButtonIndex >= 0 && b === _state.firstButtonIndex) || [0,2,9].includes(b);
              if(ok && _state._controllerConfirmPhase === 'awaitPress'){
                if(_deps.debug) console.debug('input: confirm press accepted, starting transition');
                if(!_state.transition.active) _deps.startTransition && _deps.startTransition();
                _state._controllerConfirmPhase = null;
                _state._controllerConfirmTs = null;
                return;
              }
            }
          }
      }
    } else {
      for(let i=0;i<gps.length;i++){
        const g = gps[i]; if(!g) continue;
        for(let b=0;b<g.buttons.length;b++){
            const btn = g.buttons[b];
            if(btn && (btn.pressed || btn.value > 0.5)){
                _state.controllerConfirm = true;
                _state.activeGamepad = i;
                _state.firstButtonIndex = b;
                _state.waitForRelease = true;
                _state._controllerConfirmPhase = 'waitRelease';
                try{ vibrateGamepad(i, 80, 0.6, 0.4); }catch(e){}
              try{ _deps.stopThrustTone && _deps.stopThrustTone(); if(_deps.debug) console.debug('input: stopped thrust tone on controller-confirm'); }catch(e){}
                try{ stopThrottleVibration(); }catch(e){}
                try{ _state.keys = _state.keys || {}; _state.keys.thrust = false; _state.throttle = 0; _state._lastPadThrottle = 0; }catch(e){}
                try{ _state._controllerConfirmTs = Date.now(); }catch(e){}
                return;
            }
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
    const d = Math.max(10, Math.min(VIBRATION_CONFIG.maxDuration, duration || VIBRATION_CONFIG.defaultDuration));
    const s0 = Math.max(0, Math.min(VIBRATION_CONFIG.maxStrong, strong || 0));
    const w0 = Math.max(0, Math.min(VIBRATION_CONFIG.maxWeak, weak || 0));
    const s = s0 * (_vibMult || 1);
    const w = w0 * (_vibMult || 1);
    const last = _lastVib[usedIndex] || 0;
    if(Date.now() - last < VIBRATION_CONFIG.minIntervalMs) return;
    _lastVib[usedIndex] = Date.now();

    if(g.vibrationActuator && typeof g.vibrationActuator.playEffect === 'function'){
      try{ g.vibrationActuator.playEffect('dual-rumble', {duration: d, strongMagnitude: s, weakMagnitude: w}); }catch(err){}
    } else if(g.hapticActuators && g.hapticActuators.length && typeof g.hapticActuators[0].pulse === 'function'){
      try{ g.hapticActuators[0].pulse(s, d); }catch(err){ try{ g.hapticActuators[0].pulse(d, s); }catch(_){} }
    } else if(g.vibrationActuator && typeof g.vibrationActuator === 'object' && g.vibrationActuator.type){
      try{ g.vibrationActuator.playEffect && g.vibrationActuator.playEffect('dual-rumble', {duration: d, strongMagnitude: s, weakMagnitude: w}); }catch(err){}
    }
  }catch(e){}
}

let _throttleVib = { interval: null, padIndex: -1, active:false };
let _throttleVibMap = {};
export function startThrottleVibration(idx){
  try{
    if(!navigator.getGamepads) return;
    const gps = navigator.getGamepads();
    let g = (typeof idx === 'number' && idx>=0 && gps[idx]) ? gps[idx] : null;
    let usedIndex = (typeof idx === 'number' && idx>=0 && gps[idx]) ? idx : -1;
    if(!g){ for(let i=0;i<gps.length;i++){ const gg = gps[i]; if(!gg) continue; if(gg.vibrationActuator || (gg.hapticActuators && gg.hapticActuators.length)){ g = gg; usedIndex = i; break; } } }
    if(!g) return;
    const existing = _throttleVibMap[usedIndex];
    if(existing && existing.interval) return;
    const pulse = ()=>{
      try{
        const gps2 = navigator.getGamepads ? navigator.getGamepads() : [];
        const gg = (usedIndex>=0 && gps2[usedIndex]) ? gps2[usedIndex] : g;
        if(!gg) return;
        const s = VIBRATION_CONFIG.maxStrong * 0.85 * (_vibMult || 1);
        const w = VIBRATION_CONFIG.maxWeak * 0.85 * (_vibMult || 1);
        const d = Math.max(20, Math.min(VIBRATION_CONFIG.defaultDuration, VIBRATION_CONFIG.defaultDuration));
        if(gg.vibrationActuator && typeof gg.vibrationActuator.playEffect === 'function'){
          try{ gg.vibrationActuator.playEffect('dual-rumble', { duration: d, strongMagnitude: s, weakMagnitude: w }); }catch(e){}
        } else if(gg.hapticActuators && gg.hapticActuators.length && typeof gg.hapticActuators[0].pulse === 'function'){
          try{ gg.hapticActuators[0].pulse(s, d); }catch(e){ try{ gg.hapticActuators[0].pulse(d, s); }catch(_){} }
        }
        _lastVib[usedIndex] = Date.now();
      }catch(e){}
    };
    pulse();
    const id = setInterval(pulse, VIBRATION_CONFIG.throttleInterval);
    _throttleVibMap[usedIndex] = { interval: id, padIndex: usedIndex, active: true };
  }catch(e){}
}

export function setVibrationMultiplier(m){ _vibMult = Math.max(0, Math.min(2, Number(m)||0)); }

export function stopThrottleVibration(){
  try{
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for(const key in _throttleVibMap){
      try{ const ent = _throttleVibMap[key]; if(ent && ent.interval) clearInterval(ent.interval); }catch(e){}
      try{
        const idx = parseInt(key,10);
        const g = (idx>=0 && gps[idx]) ? gps[idx] : null;
        if(g && g.vibrationActuator && typeof g.vibrationActuator.playEffect === 'function'){
          try{ g.vibrationActuator.playEffect('dual-rumble', { duration: 20, strongMagnitude: 0.0, weakMagnitude: 0.0 }); }catch(e){}
        }
      }catch(e){}
    }
  }catch(e){}
  _throttleVibMap = {};
  _lastVib = {};
}
