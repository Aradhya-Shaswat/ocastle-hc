import { generateTerrain } from './terrain.js';

export function drawMenu(ctx, W, H, joystickImg, state){
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

export function drawControllerConfirm(ctx, W, H, joystickImg, state){
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
  if(joystickImg && joystickImg.complete && joystickImg.naturalWidth){ ctx.drawImage(joystickImg, ex, ey, sizeW, sizeH); }
  else { ctx.fillStyle = '#222'; ctx.fillRect(ex, ey, imgW, imgH); }
  ctx.font = Math.max(12, Math.round(H*0.02)) + 'px monospace'; ctx.fillStyle = '#fff'; ctx.fillText('Press the same button to continue', W/2, ey + imgH + 48);
  ctx.font = Math.max(11, Math.round(H*0.017)) + 'px monospace';
  const det = (state.firstButtonIndex >= 0) ? String(state.firstButtonIndex) : '—';
  const waitLabel = state.waitForRelease ? ' (waiting release)' : '';
  ctx.fillText('Detected button: ' + det + waitLabel, W/2, ey + imgH + 72);
  ctx.restore();
}

export function drawPauseMenu(ctx, W, H){
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
  ctx.font = Math.max(14, Math.round(H*0.024)) + 'px monospace'; ctx.fillText('Press R to Restart - Press Back to Quit', W/2, cy + 156);
  const bw = 220, bh = 48; const left = cx + Math.round(cardW*0.18); const right = cx + cardW - Math.round(cardW*0.18) - bw;
  ctx.fillStyle = '#2e88ff'; roundRect(ctx, left, cy + cardH - bh - 28, bw, bh, 10); ctx.fill();
  ctx.fillStyle = '#2e88ff'; roundRect(ctx, right, cy + cardH - bh - 28, bw, bh, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = Math.max(14, Math.round(H*0.02)) + 'px monospace'; ctx.textAlign = 'center';
  ctx.fillText('Resume (Start)', left + bw/2, cy + cardH - bh/2 - 22);
  ctx.fillText('Quit to Menu (Back)', right + bw/2, cy + cardH - bh/2 - 22);
  ctx.restore();
}

export function overlayTransition(ctx, W, H, p){
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

export function drawAchievement(ctx, W, H, state){
  try{
    const ach = state.achievement;
    if(!ach || !(ach.visible || ach.alpha > 0)) return;
    const a = Math.max(0, Math.min(1, ach.alpha || 0));
    ctx.save(); ctx.globalAlpha = a;
    const bw = Math.min(Math.round(W * 0.78), 720);
    const bh = Math.max(50, Math.round(H * 0.09));
    const bx = Math.round((W - bw) / 2);
    const slideOffset = (1 - a) * (bh + 30);
    const by = Math.round(H - 30 - bh + slideOffset);
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#071806'; ctx.fillRect(bx - 6, by - 6, bw + 12, bh + 12);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, '#5bb25a'); g.addColorStop(0.5, '#4a9d49'); g.addColorStop(1, '#2f6d1d');
    ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fillRect(bx, by, bw, Math.round(bh * 0.3));
    ctx.strokeStyle = '#0c3906'; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
    const iconSize = Math.max(32, Math.round(bh * 0.65)); const ix = bx + 12; const iy = by + Math.round((bh - iconSize) / 2);
    ctx.fillStyle = '#ffd86b'; ctx.fillRect(ix, iy, iconSize, iconSize);
    const iconGrad = ctx.createLinearGradient(ix, iy, ix, iy + iconSize); iconGrad.addColorStop(0, '#ffe89a'); iconGrad.addColorStop(1, '#e6c86a');
    ctx.fillStyle = iconGrad; ctx.fillRect(ix + 3, iy + 3, iconSize - 6, iconSize - 6);
    ctx.strokeStyle = '#8a5b2a'; ctx.lineWidth = 2; ctx.strokeRect(ix, iy, iconSize, iconSize);
    const cx = ix + iconSize / 2; const cy = iy + iconSize / 2; ctx.fillStyle = '#ffd700'; ctx.beginPath();
    for (let i = 0; i < 5; i++){
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2; const r = i % 2 === 0 ? iconSize * 0.25 : iconSize * 0.12; const x = cx + Math.cos(angle) * r; const y = cy + Math.sin(angle) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; const fontSize = Math.max(6, Math.round(bh * 0.28));
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;
    const text = 'Like this game? Checkout: retro-hc.vercel.app!'; const maxTextW = bw - (iconSize + 40);
    const words = text.split(' '); const lines = []; let line = '';
    for (let i = 0; i < words.length; i++){
      const test = line ? `${line} ${words[i]}` : words[i]; const m = ctx.measureText(test).width; if (m > maxTextW && line){ lines.push(line); line = words[i]; } else { line = test; }
    }
    if (line) lines.push(line);
    const textX = ix + iconSize + 16; const lineHeight = Math.round(bh * 0.32); const totalTextHeight = lines.length * lineHeight;
    const startY = by + Math.round((bh - totalTextHeight) / 2) + lineHeight / 2;
    for (let li = 0; li < lines.length; li++){ const ty = startY + li * lineHeight; ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillText(lines[li], textX + 2, ty + 2); ctx.fillStyle = '#ffffff'; ctx.fillText(lines[li], textX, ty); }
    ctx.restore();
  }catch(e){ console.error('Achievement render error:', e); }
}
