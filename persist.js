export function saveShipShape(s){ try{ localStorage.setItem('ocastle_shipshape', String(s)); }catch(e){} }
export function loadShipShape(){ return localStorage.getItem('ocastle_shipshape') || 'lander'; }
export function saveHigh(v){ try{ localStorage.setItem('ocastle_highscore', String(v)); }catch(e){} }
export function loadHigh(){ return Number(localStorage.getItem('ocastle_highscore')||0); }

export function saveSettings(obj){
	try{ localStorage.setItem('ocastle_settings', JSON.stringify(obj||{})); }catch(e){}
}
export function loadSettings(){
	try{ const s = localStorage.getItem('ocastle_settings'); if(!s) return null; return JSON.parse(s); }catch(e){ return null; }
}
