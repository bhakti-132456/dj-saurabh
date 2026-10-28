import { engine } from './audio.js';
import { sensors, tiltLive } from './sensors.js';

// Layered hero: each layer drifts a few pixels at its own depth with the mouse,
// phone tilt and scroll. Deliberately small numbers: it should feel alive, not move.
const DRIFT_X = 14; // px at depth 1
const DRIFT_Y = 9;
const SCROLL_LIFT = 90;

export function initHero() {
    const hero = document.getElementById('top');
    if (!hero) return;
    const layers = [...hero.querySelectorAll('.hero-layer')].map(el => ({ el, d: Number(el.dataset.depth) }));
    const glow = document.getElementById('heroGlow');
    const name = hero.querySelector('.hero-name');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let tx = 0, ty = 0, x = 0, y = 0;
    hero.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width) * 2 - 1;
        ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

    const tick = now => {
        requestAnimationFrame(tick);
        if (!visible) return;
        if (tiltLive()) { tx = sensors.tiltX; ty = sensors.tiltY; }
        x += (tx - x) * 0.05;
        y += (ty - y) * 0.05;

        const s = Math.min(1, window.scrollY / hero.clientHeight);
        layers.forEach(({ el, d }) => {
            const px = -x * d * DRIFT_X;
            const py = -y * d * DRIFT_Y - s * d * SCROLL_LIFT;
            el.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0) scale(${(1 + s * 0.03 * d).toFixed(4)})`;
        });
        name.style.opacity = (1 - s * 0.7).toFixed(3);

        // The glow breathes slowly, and leans in with the kick when music is on
        const lv = engine.levels();
        const breathe = Math.sin(now / 1000 * 0.7) * 0.5 + 0.5;
        glow.style.opacity = (0.7 + breathe * 0.15 + lv.bass * 0.3).toFixed(3);
        glow.style.scale = (1 + breathe * 0.03 + lv.bass * 0.06).toFixed(4);
    };
    requestAnimationFrame(tick);
}
