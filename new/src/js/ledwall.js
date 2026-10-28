import { engine } from './audio.js';

// A lightweight LED wall for the homepage: a dot matrix driven by the music, no WebGL.
// Scenes change every 8 bars; with nothing playing it idles on a 122 BPM clock.
const IDLE_BPM = 122;

export function initLedWall(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const spec = new Float32Array(32);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cols = 0, rows = 0, pitch = 0, visible = false;

    const size = () => {
        const dpr = Math.min(devicePixelRatio, 2);
        const w = canvas.clientWidth, h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pitch = Math.max(7, Math.min(12, w / 72)); // LED spacing in CSS pixels
        cols = Math.floor(w / pitch);
        rows = Math.floor(h / pitch);
    };
    new ResizeObserver(size).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

    // Beat clock: the loudest playing deck's grid, else the idle tempo
    const clock = t => {
        const d = Object.values(engine.decks || {}).find(x => x.playing && x.bpm);
        if (d) { const p = d.beatPhase(); return p.beat + p.frac; }
        return (t / 1000) * (IDLE_BPM / 60);
    };

    const scenes = [
        // Spectrum bars, mirrored from the middle
        (x, y, b, lv) => {
            const cx = Math.abs(x - cols / 2) / (cols / 2);
            const v = Math.max(spec[Math.min(31, Math.floor(cx * 32))], 0.08 + 0.12 * Math.exp(-(b % 1) * 4) * (1 - cx));
            const hy = 1 - y / rows;
            return hy < v ? 0.4 + 0.6 * (hy / v) : 0;
        },
        // Rings from the centre on every beat
        (x, y, b, lv) => {
            const d = Math.hypot((x - cols / 2) / cols, (y - rows / 2) / rows * (rows / cols)) * 4;
            const r = (b % 1) * 2.2;
            return Math.max(0, 1 - Math.abs(d - r) * 3) * (0.5 + lv.bass) + lv.bass * 0.15 * (1 - d);
        },
        // Scrolling wave
        (x, y, b, lv) => {
            const w = rows / 2 + Math.sin(x * 0.18 + b * Math.PI) * rows * (0.18 + lv.mid * 0.5);
            return Math.max(0, 1 - Math.abs(y - w) / (1.2 + lv.bass * 3));
        },
    ];

    const draw = t => {
        requestAnimationFrame(draw);
        if (!visible || !cols) return;
        const b = reduced ? 0 : clock(t);
        engine.spectrum(spec);
        let lv = engine.levels();
        if (!engine.anyPlaying) {
            // idle: a soft pulse on the house clock so the wall never sits dark
            const kick = Math.exp(-(b % 1) * 5);
            for (let i = 0; i < spec.length; i++) spec[i] = Math.max(spec[i], 0.18 + 0.14 * Math.sin(t / 700 + i * 0.45) + 0.18 * kick * (1 - i / 32));
            lv = { bass: 0.35 * kick, mid: 0.25, high: 0.1, level: 0.2 };
        }
        const scene = scenes[((Math.floor(b / 32) % scenes.length) + scenes.length) % scenes.length]; // b < 0 before the first beat
        ctx.fillStyle = '#050303';
        ctx.fillRect(0, 0, cols * pitch + pitch, rows * pitch + pitch);
        const r = pitch * 0.36;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const v = Math.min(1, scene(x, y, b, lv));
                // every LED shows faintly, lit ones go red to hot white
                ctx.fillStyle = v < 0.04 ? 'rgba(227,18,11,0.07)'
                    : `rgb(${Math.round(120 + 135 * v)},${Math.round(18 + 200 * v * v * v)},${Math.round(11 + 180 * v * v * v)})`;
                ctx.fillRect(x * pitch + pitch / 2 - r, y * pitch + pitch / 2 - r, r * 2, r * 2);
            }
        }
    };
    requestAnimationFrame(draw);
}
