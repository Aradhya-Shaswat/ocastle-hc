
let _stars = [];
let _W = 320, _H = 180;
const MAX_STARS = 220;
let _density = 1;

function rand(a,b){ return a + Math.random()*(b-a); }

export function initBackground(state, deps){
  _W = deps && deps.W ? deps.W : _W;
  _H = deps && deps.H ? deps.H : _H;
  buildStars();
}

export function resizeBackground(W,H){ _W = W; _H = H; buildStars(); }

function buildStars(){
  _stars = [];
  const area = Math.max(1, _W * _H);
  const base = Math.min(MAX_STARS, Math.max(60, Math.floor(area / 6000)));
  const count = Math.max(10, Math.min(MAX_STARS, Math.round(base * (_density||1))));
  for(let i=0;i<count;i++){
    const z = Math.random();
    _stars.push({
      x: Math.random() * _W,
      y: Math.random() * _H,
      z: 0.15 + z * 0.85,
      size: 0.6 + z * 2.6,
      speed: 0.02 + (1 - z) * 0.48,
      tw: Math.random() * Math.PI * 2
    });
  }
}

export function setStarDensity(f){ _density = Math.max(0, Math.min(3, Number(f)||1)); buildStars(); }

export function updateBackground(dt){
  if(!_stars || !_stars.length) return;
  for(const s of _stars){
    s.y += s.speed * dt * 2.0;
    s.x += (s.speed * dt * 0.3) * (Math.sin(s.tw) * 0.6);
    s.tw += 0.02 * dt;
    if(s.y > _H + 8){ s.y = -8; s.x = Math.random() * _W; }
    if(s.x < -8) s.x = _W + 8;
    if(s.x > _W + 8) s.x = -8;
  }
}

export function drawBackground(ctx, W, H, opts){
  ctx.save();
  ctx.fillStyle = opts && opts.bgColor ? opts.bgColor : '#111217';
  ctx.fillRect(0,0,W,H);

  if(!_stars) { ctx.restore(); return; }
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(let i=0;i<_stars.length;i++){
    const s = _stars[i];
    const alpha = 0.22 + 0.6 * (1 - s.z);
    const r = Math.max(0.5, s.size);
    if(r <= 1.4){
      ctx.fillStyle = `rgba(220,230,255,${alpha})`;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    } else {
      ctx.beginPath();
      const useGlow = (i % 12) === 0;
      if(useGlow){ ctx.shadowBlur = Math.min(12, r * 3.0); ctx.shadowColor = `rgba(220,230,255,${alpha*0.9})`; }
      ctx.fillStyle = `rgba(220,230,255,${alpha})`;
      ctx.arc(Math.round(s.x), Math.round(s.y), r, 0, Math.PI*2);
      ctx.fill();
      if(useGlow) ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
  ctx.restore();
}

export default { initBackground, resizeBackground, updateBackground, drawBackground };
