// Body face, self-hosted (SIL Open Font License) so it renders the same on every device
import '@fontsource/lexend/latin-300.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-500.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/lexend/latin-700.css';
import { engine } from './js/audio.js';
import { initScroll, scrollToTarget } from './js/scroll.js';
import { initHero } from './js/hero.js';
import { initBookingForm } from './js/booking.js';
import { initBooth } from './js/booth.js';
import { initLedWall } from './js/ledwall.js';
import { enableSensors, autoEnableSensors } from './js/sensors.js';
import { lenis } from './js/scroll.js';

// Resolve when an image has its pixels (or failed): never block the page on one picture
const imgReady = img => !img ? Promise.resolve() : (img.complete ? Promise.resolve() : img.decode().catch(() => {}));

function initLoader() {
    const loader = document.getElementById('loader');
    const pct = document.getElementById('loaderPct');
    const tasks = [
        document.fonts ? document.fonts.ready : null,
        imgReady(document.querySelector('.hero-cut img')),
        imgReady(document.querySelector('.hero-name img')),
        new Promise(r => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))),
    ];
    let done = 0, shown = 0, finished = false;
    tasks.forEach(p => Promise.resolve(p).then(() => { done++; }));
    const count = () => {
        if (finished) return;
        shown += ((done / tasks.length) * 100 - shown) * 0.12;
        pct.textContent = `${Math.round(shown)}%`;
        requestAnimationFrame(count);
    };
    count();

    const minTime = new Promise(r => setTimeout(r, 1100));
    const cap = new Promise(r => setTimeout(r, 7000)); // slow network: show the site anyway
    Promise.race([Promise.all([...tasks, minTime]), cap]).then(() => {
        finished = true;
        pct.textContent = '100%';
        loader.classList.add('is-done');
        document.documentElement.classList.remove('is-loading');
        lenis?.start();
        window.__siteReady = true;
        window.dispatchEvent(new Event('site:ready'));
        setTimeout(() => loader.remove(), 900);
    });
}

// Wrap each button's text so the label can roll on hover (see .btn-label in base.css)
function enhanceButtons() {
    document.querySelectorAll('.btn').forEach(b => {
        const text = [...b.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
        if (!text) return;
        const label = document.createElement('span');
        label.className = 'btn-label';
        text.replaceWith(label);
        setButtonLabel(b, text.textContent.trim());
    });
}

function setButtonLabel(btn, t) {
    const label = btn.querySelector('.btn-label');
    label.dataset.text = t;
    label.innerHTML = '';
    const inner = document.createElement('span');
    inner.textContent = t;
    label.append(inner);
}

function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) {
        t = document.createElement('div');
        t.className = 'toast';
        t.setAttribute('role', 'status');
        document.body.append(t);
    }
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('is-on'), 3200);
}

function initSound() {
    const toggle = document.getElementById('soundToggle');
    const bars = toggle.querySelectorAll('.sound-bars i');
    const enter = document.getElementById('enterExperience');

    const sync = () => {
        const on = engine.anyPlaying;
        toggle.setAttribute('aria-pressed', on);
        toggle.setAttribute('aria-label', on ? 'Stop music' : 'Play music');
        toggle.title = on ? 'Stop music' : 'Play music';
    };
    engine.ensure();
    engine.on(sync);

    toggle.addEventListener('click', () => {
        if (engine.anyPlaying) engine.stopAll();
        else engine.decks.A.play();
    });

    enter.addEventListener('click', async () => {
        // must run inside the tap for iOS to show its motion prompt
        const motion = enableSensors();
        enter.disabled = true;
        setButtonLabel(enter, 'Loading the mix…');
        try {
            await engine.decks.A.play();
            const tilt = await motion;
            toast(tilt ? 'Deck A is live. Tilt your phone to move him.' : 'Deck A is live. Step into the booth to take over.');
        } finally {
            enter.disabled = false;
            setButtonLabel(enter, 'Enter the experience');
        }
        scrollToTarget('#facts');
    });

    const loop = () => {
        requestAnimationFrame(loop);
        const lv = engine.levels();
        const vals = [lv.bass, lv.mid, lv.high, lv.level];
        bars.forEach((b, i) => { b.style.height = `${3 + Math.min(1, vals[i] * 1.8) * 13}px`; });
    };
    loop();
}

function initCursor() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const c = document.getElementById('cursor');
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; }, { passive: true });
    document.addEventListener('pointerover', e => {
        c.classList.toggle('is-big', !!e.target.closest('a, button, .platter, .knob-dial, input, .g-item, .crate-stage, label.chip'));
    });
    const tick = () => {
        cx += (x - cx) * 0.25;
        cy += (y - cy) * 0.25;
        c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        requestAnimationFrame(tick);
    };
    tick();

    // Magnetic pull on the main buttons
    document.querySelectorAll('.btn-large, .topbar .btn').forEach(b => {
        b.addEventListener('pointermove', e => {
            const r = b.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
            b.style.transform = `translate(${dx * 0.18}px, ${dy * 0.25}px)`;
        });
        b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
}

// Back from the booth on a phone still held sideways: a short nudge to turn it upright
function initRotateBack() {
    if (!sessionStorage.getItem('fromBooth')) return;
    sessionStorage.removeItem('fromBooth');
    const portrait = matchMedia('(orientation: portrait)');
    if (portrait.matches) return;
    const el = document.createElement('div');
    el.className = 'rotate-back';
    el.innerHTML = '<div class="rotate-phone is-back" aria-hidden="true"><span></span></div><p>Turn your phone upright for the rest of the site</p><button class="btn btn-ghost btn-small">Keep landscape</button>';
    document.body.append(el);
    const close = () => el.remove();
    el.querySelector('button').addEventListener('click', close);
    portrait.addEventListener('change', e => { if (e.matches) close(); });
}

function initMenu() {
    const btn = document.getElementById('menuBtn');
    const menu = document.getElementById('menu');
    if (!btn) return;
    const set = open => {
        btn.setAttribute('aria-expanded', open);
        document.documentElement.classList.toggle('menu-open', open);
        if (open) {
            menu.hidden = false;
            requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
            lenis?.stop();
        } else {
            menu.classList.remove('is-open');
            lenis?.start();
            setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 600);
        }
    };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
}

function initCopyBio() {
    const btn = document.getElementById('copyBio');
    btn?.addEventListener('click', async () => {
        const text = [...document.getElementById(btn.dataset.copyTarget).querySelectorAll('p')]
            .map(p => p.textContent.replace(/\s+/g, ' ').trim()).join('\n\n');
        try {
            await navigator.clipboard.writeText(text);
            toast('Bio copied. Paste it into your listing or poster.');
        } catch {
            toast('Copy failed. Select the text and copy it manually.');
        }
    });
}

// No orphans: tie the last two words of every text block with a no-break space, so a line
// never ends the block on one word. CSS text-wrap: pretty only does this for short words.
// A tie that would push text out of its box is undone; it re-runs when the width changes.
const tied = [];
function preventOrphans() {
    tied.forEach(([node, text]) => { node.nodeValue = text; });
    tied.length = 0;
    document.querySelectorAll('h1, h2, h3, p, li, dd, figcaption, blockquote, span, strong, label').forEach(el => {
        if (el.closest('.lineup-poster, .fit, .loader, [aria-hidden="true"]')) return;
        if ([...el.children].some(c => getComputedStyle(c).display !== 'inline')) return; // leaf text only
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let last = null;
        while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) last = walker.currentNode;
        if (!last || el.textContent.trim().split(/\s+/).length < 3) return;
        const text = last.nodeValue;
        const next = text.replace(/\s+(\S+\s*)$/, '\u00a0$1');
        if (next === text) return;
        last.nodeValue = next;
        tied.push([last, text]);
        if (el.scrollWidth > el.clientWidth + 1) { last.nodeValue = text; tied.pop(); }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('year').textContent = new Date().getFullYear();
    enhanceButtons();
    initSound();
    autoEnableSensors();
    initHero();
    initBookingForm();
    // Console takes the top of the stage, the LED wall the rest (half the screen on phones)
    const mini = document.getElementById('booth');
    initBooth(() => ({ w: mini.parentElement.clientWidth - 24, h: innerHeight * (innerWidth < 900 ? 0.46 : 0.5) }));
    initLedWall(document.getElementById('ledWall'));
    initCopyBio();
    initMenu();
    initRotateBack();
    initCursor();
    initScroll();
    preventOrphans();
    document.fonts?.ready.then(preventOrphans); // measure again with the real fonts
    let lastW = innerWidth, t = 0;
    addEventListener('resize', () => {
        if (innerWidth === lastW) return; // ignore phone address-bar height changes
        lastW = innerWidth;
        clearTimeout(t);
        t = setTimeout(preventOrphans, 200);
    });
    lenis?.stop();
    initLoader();
});
