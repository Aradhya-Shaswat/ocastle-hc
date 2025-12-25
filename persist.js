export function saveShipShape(s){ try{ localStorage.setItem('ocastle_shipshape', String(s)); }catch(e){} }
export function loadShipShape(){ return localStorage.getItem('ocastle_shipshape') || 'lander'; }
export function saveHigh(v){ try{ localStorage.setItem('ocastle_highscore', String(v)); }catch(e){} }
export function loadHigh(){ return Number(localStorage.getItem('ocastle_highscore')||0); }
