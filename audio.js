export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export function unlockAudioAndStartMusic(){
  try{
    if(!audioCtx) return;
    if(audioCtx.state === 'suspended'){
      audioCtx.resume().then(()=>{ try{ startMusic(); }catch(e){} });
    } else {
      try{ startMusic(); }catch(e){}
    }
  }catch(e){console.warn('unlockAudio error', e);} 
}

export function beep(freq=440, time=0.12, type='sine', gain=0.06){
  try{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const t0 = audioCtx.currentTime;
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0);
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain * (_sfxVol||1), t0 + 0.01);
    g.gain.linearRampToValueAtTime(0.0001, t0 + time);
    o.stop(t0 + time + 0.02);
  }catch(e){ console.warn('beep error', e); }
}

let _sfxVol = 1;
export function setSfxVolume(v){ try{ _sfxVol = Math.max(0, Math.min(4, Number(v)||0)); }catch(e){} }

let _engine = null;
export function startThrustTone(){
  try{
    if(_engine) return;
    const ctx = audioCtx;
    const outGain = ctx.createGain(); outGain.gain.value = 0.0001;
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = noiseBuf; noiseSrc.loop = true;
    const noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 800;
    noiseSrc.connect(noiseFilter); noiseFilter.connect(outGain);
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 90;
    const oscFilter = ctx.createBiquadFilter(); oscFilter.type = 'lowpass'; oscFilter.frequency.value = 700;
    osc.connect(oscFilter); oscFilter.connect(outGain);
    const master = ctx.createGain(); master.gain.value = 0.0001;
    outGain.connect(master); master.connect(ctx.destination);

    const now = ctx.currentTime;
    noiseSrc.start(now);
    osc.start(now);

    _engine = { noiseSrc, noiseFilter, osc, oscFilter, master, outGain };
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(0.0001, now); master.gain.linearRampToValueAtTime(0.02, now + 0.06);
  }catch(e){ console.warn('startThrustTone error', e); }
}

export function setThrustLevel(level){
  try{
    if(!_engine) return;
    const ctx = audioCtx; const now = ctx.currentTime;
    const cl = Math.max(0, Math.min(1, level || 0));
    const targetGain = 0.0025 * cl;
    _engine.master.gain.cancelScheduledValues(now);
    _engine.master.gain.setTargetAtTime(Math.max(0.0001, targetGain), now, 0.05);
    const noiseFreq = 400 + cl * 1400;
    const toneFreq = 300 + cl * 700;
    _engine.noiseFilter.frequency.setTargetAtTime(noiseFreq, now, 0.05);
    _engine.oscFilter.frequency.setTargetAtTime(toneFreq, now, 0.08);
    _engine.osc.frequency.setTargetAtTime(80 + cl * 120, now, 0.06);
  }catch(e){}
}

export function stopThrustTone(){
  try{
    if(!_engine) return;
    const ctx = audioCtx; const now = ctx.currentTime;
    _engine.master.gain.cancelScheduledValues(now); _engine.master.gain.setValueAtTime(_engine.master.gain.value, now); _engine.master.gain.linearRampToValueAtTime(0.0001, now + 0.06);
    try{ _engine.noiseSrc.stop(now + 0.08); }catch(e){}
    try{ _engine.osc.stop(now + 0.08); }catch(e){}
  }catch(e){}
  _engine = null;
}

let musicPlaying = false;
let _musicNodes = null;
const _chords = [ [440, 660, 880], [392, 588, 784], [330, 495, 660], [349,524,698] ];
export function startMusic(){
  try{
    if(musicPlaying) return;
    if(audioCtx.state === 'suspended') return;
    const ctx = audioCtx; musicPlaying = true;
    const master = ctx.createGain(); master.gain.value = 0.0001;
    const masterFilter = ctx.createBiquadFilter(); masterFilter.type = 'lowpass'; masterFilter.frequency.value = 5000;
    master.connect(masterFilter); masterFilter.connect(ctx.destination);

    const padOscs = [];
    const padGain = ctx.createGain(); padGain.gain.value = 0.0001; padGain.connect(master);
    for(let i=0;i<3;i++){ const o = ctx.createOscillator(); o.type = 'sine'; const g = ctx.createGain(); g.gain.value = 1; o.connect(g); g.connect(padGain); padOscs.push(o); }

    const lead = ctx.createOscillator(); lead.type = 'triangle'; const leadGain = ctx.createGain(); leadGain.gain.value = 0.0001; lead.connect(leadGain); leadGain.connect(master);

    const bass = ctx.createOscillator(); bass.type = 'sawtooth'; const bassGain = ctx.createGain(); bassGain.gain.value = 0.0001; bass.frequency.value = 110; bass.connect(bassGain); bassGain.connect(master);

    const now = ctx.currentTime;
    padOscs.forEach(o=>o.start(now)); lead.start(now); bass.start(now);

    let step = 0;
    const stepMs = 350;
    const tick = ()=>{
      try{
        const chord = _chords[step % _chords.length];
        for(let i=0;i<3;i++){ const f = chord[i] * (1 + (i-1)*0.003); padOscs[i].frequency.setValueAtTime(f, ctx.currentTime); }
        const leadNote = chord[step % chord.length] * (step%2 ? 0.5 : 1);
        lead.frequency.setValueAtTime(leadNote, ctx.currentTime);
        padGain.gain.cancelScheduledValues(ctx.currentTime); padGain.gain.setValueAtTime(0.0001, ctx.currentTime); padGain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.06); padGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + (stepMs/1000)*0.9);
        leadGain.gain.cancelScheduledValues(ctx.currentTime); leadGain.gain.setValueAtTime(0.0001, ctx.currentTime); leadGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02); leadGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
        bassGain.gain.cancelScheduledValues(ctx.currentTime); bassGain.gain.setValueAtTime(0.0001, ctx.currentTime); bassGain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 0.02); bassGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        step++;
      }catch(e){}
    };
    const timer = setInterval(tick, stepMs);

    _musicNodes = { master, masterFilter, padOscs, padGain, lead, leadGain, bass, bassGain, timer };
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(0.0001, now); master.gain.linearRampToValueAtTime(0.06, now + 0.4);
  }catch(e){ console.warn('startMusic error', e); }
}

export function stopMusic(){
  try{
    if(!_musicNodes) return; clearInterval(_musicNodes.timer);
    const now = audioCtx.currentTime;
    try{ _musicNodes.padOscs.forEach(o=>o.stop(now + 0.06)); }catch(e){}
    try{ _musicNodes.lead.stop(now + 0.06); }catch(e){}
    try{ _musicNodes.bass.stop(now + 0.06); }catch(e){}
    _musicNodes = null;
  }catch(e){}
  musicPlaying = false;
}

export function setMusicVolume(level){
  try{
    if(!_musicNodes) return;
    const now = audioCtx.currentTime;
    const target = (level===null) ? 0.06 : Math.max(0, Math.min(0.3, level));
    _musicNodes.master.gain.cancelScheduledValues(now); _musicNodes.master.gain.setTargetAtTime(target, now, 0.05);
  }catch(e){}
}
