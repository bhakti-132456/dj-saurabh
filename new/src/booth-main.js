import '@fontsource/lexend/latin-300.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-500.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/lexend/latin-700.css';
import { engine } from './js/audio.js';
import { createVJ } from './js/vj.js';
import { createWorld } from './js/world.js';
import { initBooth } from './js/booth.js';
import { enableSensors, autoEnableSensors, haptic } from './js/sensors.js';

const $ = s => document.querySelector(s);
const coarse = matchMedia('(pointer: coarse)').matches;

const vj = createVJ();
let world = null;
try {
    world = createWorld($('#world'), vj);
} catch {
    document.body.classList.add('is-lite'); // no WebGL: consoles still work, in flat panels
}
// The DJ panel sits under the top bar; on tall screens it leaves the club visible above it
const bar = document.querySelector('.bt-bar');
const fitDJ = initBooth(() => ({
    w: innerWidth - 52,
    h: Math.min(innerHeight - bar.offsetHeight - 44, innerHeight > 700 ? innerHeight * 0.62 : Infinity),
}));
vj.mountControls($('#vjControls'));
autoEnableSensors();

// ---- Views ----
const go = name => {
    document.body.dataset.mode = name;
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
    document.querySelectorAll('.bt-tabs [data-go]').forEach(b => b.setAttribute('aria-current', b.dataset.go === name));
    world?.fly(name);
    if (name === 'dj') requestAnimationFrame(fitDJ);
    history.replaceState(null, '', name === 'overview' ? location.pathname : `#${name}`);
    haptic(8);
};
document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b && document.body.dataset.mode !== 'gate') go(b.dataset.go);
});

// Tap a console in the 3D scene to enter it; tap the wall in VJ mode for the next scene
$('#world').addEventListener('click', e => {
    if (!world) return;
    const mode = document.body.dataset.mode;
    if (mode === 'overview') {
        const hit = world.pick(e.clientX, e.clientY);
        if (hit) go(hit);
    } else if (mode === 'vj') vj.next();
});

// Hotspot labels follow the consoles on screen
const hotspots = [...document.querySelectorAll('.hotspot')];
const placeHotspots = () => {
    requestAnimationFrame(placeHotspots);
    if (!world || document.body.dataset.mode !== 'overview') return;
    hotspots.forEach(h => {
        const p = world.screenPos(h.dataset.go);
        h.style.transform = `translate(${p.x}px, ${p.y}px)`;
    });
};
placeHotspots();

// ---- Gate: the tap that unlocks sound, motion, full screen and landscape ----
$('#enterBooth').addEventListener('click', async () => {
    enableSensors();
    if (coarse && document.documentElement.requestFullscreen) {
        try {
            await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
            await screen.orientation?.lock?.('landscape');
        } catch { /* iPhone and others: the rotate prompt covers it */ }
    }
    engine.decks.A.play();
    $('#gate').classList.add('is-gone');
    const start = location.hash.slice(1);
    go(['dj', 'vj'].includes(start) ? start : 'overview');
    checkRotate();
});

// ---- Back to the site: release full screen and landscape, ask to rotate back there ----
$('#backToSite').addEventListener('click', () => {
    try { screen.orientation?.unlock?.(); } catch { /* not supported */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (coarse) sessionStorage.setItem('fromBooth', '1');
});

// ---- Rotate prompt on phones held upright ----
const portrait = matchMedia('(orientation: portrait)');
let stayPortrait = false;
const checkRotate = () => {
    $('#rotate').hidden = !(coarse && portrait.matches && !stayPortrait && document.body.dataset.mode !== 'gate');
};
portrait.addEventListener('change', () => { checkRotate(); if (!portrait.matches) haptic(20); });
$('#stayPortrait').addEventListener('click', () => { stayPortrait = true; checkRotate(); });

// ---- Sound toggle ----
const toggle = $('#soundToggle');
const bars = toggle.querySelectorAll('.sound-bars i');
engine.on(() => {
    const on = engine.anyPlaying;
    toggle.setAttribute('aria-pressed', on);
    toggle.setAttribute('aria-label', on ? 'Stop music' : 'Play music');
    toggle.title = on ? 'Stop music' : 'Play music';
});
toggle.addEventListener('click', () => (engine.anyPlaying ? engine.stopAll() : engine.decks.A.play()));
const meter = () => {
    requestAnimationFrame(meter);
    const lv = engine.levels();
    [lv.bass, lv.mid, lv.high, lv.level].forEach((v, i) => { bars[i].style.height = `${3 + Math.min(1, v * 1.8) * 11}px`; });
};
meter();

// ---- Loader ----
const ready = Promise.all([
    document.fonts?.ready,
    new Promise(r => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))),
    new Promise(r => setTimeout(r, 900)),
]);
let shown = 0;
const pct = $('#loaderPct');
const count = () => {
    if (!pct.isConnected) return;
    shown += (92 - shown) * 0.06;
    pct.textContent = `${Math.round(shown)}%`;
    requestAnimationFrame(count);
};
count();
Promise.race([ready, new Promise(r => setTimeout(r, 6000))]).then(() => {
    pct.textContent = '100%';
    $('#loader').classList.add('is-done');
    document.documentElement.classList.remove('is-loading');
    setTimeout(() => $('#loader').remove(), 900);
});
