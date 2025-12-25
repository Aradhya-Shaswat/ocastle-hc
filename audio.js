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
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.linearRampToValueAtTime(0.0001, t0 + time);
    o.stop(t0 + time + 0.02);
  }catch(e){ console.warn('beep error', e); }
}

let thrustOsc = null, thrustGain = null;
export function startThrustTone(){
  try{
    if(thrustOsc) return;
    thrustOsc = audioCtx.createOscillator();
    thrustGain = audioCtx.createGain(); thrustGain.gain.value = 0.0001;
    thrustOsc.type = 'triangle'; thrustOsc.frequency.value = 160;
    thrustOsc.connect(thrustGain); thrustGain.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime;
    thrustOsc.start(t0);
    thrustGain.gain.cancelScheduledValues(t0);
    thrustGain.gain.setValueAtTime(0.0001, t0);
    thrustGain.gain.linearRampToValueAtTime(0.02, t0 + 0.06);
  }catch(e){ console.warn('startThrustTone error !!', e); }
}
export function stopThrustTone(){
  try{
    if(!thrustOsc) return;
    const t0 = audioCtx.currentTime;
    thrustGain.gain.cancelScheduledValues(t0);
    thrustGain.gain.setValueAtTime(thrustGain.gain.value, t0);
    thrustGain.gain.linearRampToValueAtTime(0.0001, t0 + 0.06);
    thrustOsc.stop(t0 + 0.08);
  }catch(e){}
  thrustOsc = null; thrustGain = null;
}

let musicLead = null, musicLeadGain = null, musicBass = null, musicBassGain = null, musicTimer = null, musicStep = 0, musicPlaying=false;
const leadPattern = [440,0,523,0,392,440,0,392];
const leadDur = 0.28;
export function startMusic(){
  try{
    if(musicPlaying) return;
    if(audioCtx.state === 'suspended') return;
    musicPlaying = true;
    musicLead = audioCtx.createOscillator(); musicLead.type = 'sine';
    musicLeadGain = audioCtx.createGain(); musicLeadGain.gain.value = 0.0001;
    musicLead.connect(musicLeadGain); musicLeadGain.connect(audioCtx.destination);
    musicBass = audioCtx.createOscillator(); musicBass.type = 'sine';
    musicBass.frequency.value = 110; musicBassGain = audioCtx.createGain(); musicBassGain.gain.value = 0.0001;
    musicBass.connect(musicBassGain); musicBassGain.connect(audioCtx.destination);
    musicLead.start(); musicBass.start();
    musicTimer = setInterval(()=>{
      const f = leadPattern[musicStep % leadPattern.length] || 0;
      const tnow = audioCtx.currentTime;
      if(f>0){
        musicLead.frequency.setValueAtTime(f, tnow);
        musicLeadGain.gain.cancelScheduledValues(tnow); musicLeadGain.gain.setValueAtTime(0.0001, tnow); musicLeadGain.gain.linearRampToValueAtTime(0.055, tnow + 0.02); musicLeadGain.gain.linearRampToValueAtTime(0.0001, tnow + leadDur);
      } else {
        musicLeadGain.gain.setValueAtTime(0.0001, tnow);
      }
      const b = (musicStep % 4 === 0) ? 110 : 0;
      if(b>0){ musicBass.frequency.setValueAtTime(b, tnow); musicBassGain.gain.cancelScheduledValues(tnow); musicBassGain.gain.setValueAtTime(0.0001, tnow); musicBassGain.gain.linearRampToValueAtTime(0.02, tnow + 0.02); musicBassGain.gain.linearRampToValueAtTime(0.0001, tnow + leadDur*1.05);
      } else musicBassGain.gain.setValueAtTime(0.0001, tnow);
      musicStep++;
    }, Math.round(leadDur*1000));
  }catch(e){ console.warn('startMusic error !!', e); }
}
export function stopMusic(){ if(!musicPlaying) return; clearInterval(musicTimer); try{ musicLead.stop(); musicBass.stop(); }catch(e){} musicPlaying=false; }
export function setMusicVolume(level){
  try{
    if(!musicPlaying) return;
    if(musicLeadGain) musicLeadGain.gain.setTargetAtTime((level===null)?0.08:level, audioCtx.currentTime, 0.02);
    if(musicBassGain) musicBassGain.gain.setTargetAtTime((level===null)?0.02:Math.max(0.001, level*0.25), audioCtx.currentTime, 0.02);
  }catch(e){}
}
