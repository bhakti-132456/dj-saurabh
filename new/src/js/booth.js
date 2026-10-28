import { engine } from './audio.js';
import { sensors, enableSensors, onShake, haptic, tiltLive, recalibrate } from './sensors.js';

const SEC_PER_REV = 1.8; // 33 1/3 rpm
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function knob({ label, onChange, filter = false }) {
    const wrap = document.createElement('div');
    wrap.className = 'knob';
    wrap.innerHTML = `<div class="knob-dial${filter ? ' is-filter' : ''}" role="slider" tabindex="0"
      aria-label="${label}" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"></div><span>${label.split(' ').pop()}</span>`;
    const dial = wrap.firstElementChild;
    let value = 0;
    const set = v => {
        value = Math.max(-1, Math.min(1, v));
        if (Math.abs(value) < 0.04) value = 0;
        dial.style.transform = `rotate(${value * 135}deg)`;
        dial.setAttribute('aria-valuenow', Math.round(value * 100));
        onChange(value);
    };
    let startY = 0, startV = 0;
    dial.addEventListener('pointerdown', e => {
        startY = e.clientY; startV = value;
        dial.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    dial.addEventListener('pointermove', e => {
        if (!dial.hasPointerCapture(e.pointerId)) return;
        set(startV + (startY - e.clientY) * 0.009);
    });
    dial.addEventListener('dblclick', () => set(0));
    dial.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { set(value + 0.05); e.preventDefault(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { set(value - 0.05); e.preventDefault(); }
        if (e.key === 'Home' || e.key === '0') set(0);
    });
    return wrap;
}

function buildDeck(el, deck, lite) {
    el.innerHTML = `
      <div class="deck-top">
        <span class="deck-letter">${deck.id}</span>
        <span class="deck-title">${deck.title}</span>
        <span class="deck-bpm">-- BPM</span>
        <span class="deck-beats" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="deck-time">0:00</span>
      </div>
      <canvas class="deck-wave" aria-label="Deck ${deck.id} track overview. Click to jump."></canvas>
      <div class="platter-wrap">
        <div class="platter" role="img" aria-label="Deck ${deck.id} platter. Drag in a circle to scratch.">
          <div class="platter-disc"></div>
        </div>
      </div>
      <label class="pitch"><span>Pitch</span>
        <input type="range" class="vrange" min="-16" max="16" step="0.1" value="0" aria-label="Deck ${deck.id} pitch">
        <span class="pitch-val">0.0%</span>
      </label>
      <div class="transport">
        <button class="pad-btn play" aria-pressed="false">Play</button>
        ${lite ? '' : '<button class="pad-btn sync" aria-pressed="false" title="Match tempo and beats to the other deck">Sync</button>'}
        ${deck.hotCues.slice(0, lite ? 2 : 3).map((c, i) => `<button class="pad-btn" data-cue="${c}" aria-label="Hot cue ${i + 1}, ${fmt(c)}">Cue ${i + 1}</button>`).join('')}
        ${lite ? '<button class="pad-btn loop" aria-pressed="false" title="Loop four beats">Loop</button>' : ''}
      </div>`;

    const ui = {
        time: el.querySelector('.deck-time'),
        wave: el.querySelector('.deck-wave'),
        platter: el.querySelector('.platter'),
        disc: el.querySelector('.platter-disc'),
        play: el.querySelector('.play'),
        sync: el.querySelector('.sync'),
        loop: el.querySelector('.loop'),
        bpm: el.querySelector('.deck-bpm'),
        beats: [...el.querySelectorAll('.deck-beats i')],
        pitch: el.querySelector('.vrange'),
        pitchVal: el.querySelector('.pitch-val'),
        angle: 0,
        peaks: null,
    };

    ui.play.addEventListener('click', () => { haptic(10); deck.toggle(); });
    el.querySelectorAll('[data-cue]').forEach(b => b.addEventListener('click', () => { haptic(10); deck.jump(Number(b.dataset.cue)); }));
    ui.showPitch = () => {
        const p = (deck.rate - 1) * 100;
        ui.pitch.value = p;
        ui.pitchVal.textContent = `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
    };
    ui.pitch.addEventListener('input', () => {
        deck.synced = false; // moving your own pitch releases sync
        deck.setPitch(Number(ui.pitch.value) / 100);
        ui.showPitch();
        ui.onPitch?.();
    });
    ui.loop?.addEventListener('click', async () => {
        haptic(12);
        await deck.load();
        deck.setLoop(!deck.loop);
    });
    ui.sync?.addEventListener('click', async () => {
        haptic(12);
        const other = engine.decks[deck.id === 'A' ? 'B' : 'A'];
        await Promise.all([deck.load(), other.load()]);
        deck.synced = !deck.synced;
        if (deck.synced) {
            other.synced = false;
            deck.syncTo(other);
            ui.showPitch();
        }
        engine.emit();
    });
    ui.showPitch();
    ui.pitch.addEventListener('dblclick', () => { ui.pitch.value = 0; ui.pitch.dispatchEvent(new Event('input')); });

    ui.wave.addEventListener('click', async e => {
        await deck.load();
        const r = ui.wave.getBoundingClientRect();
        deck.jump(((e.clientX - r.left) / r.width) * deck.duration);
    });

    // Scratching: angle of the pointer around the platter centre drives the audio
    let last = null;
    const angleOf = e => {
        const r = ui.platter.getBoundingClientRect();
        return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    ui.platter.addEventListener('pointerdown', async e => {
        e.preventDefault();
        ui.platter.setPointerCapture(e.pointerId);
        ui.platter.classList.add('is-touched');
        await engine.resume();
        await deck.load();
        deck.beginScratch();
        last = { a: angleOf(e), t: performance.now() };
    });
    ui.platter.addEventListener('pointermove', e => {
        if (!last) return;
        const a = angleOf(e);
        let d = a - last.a;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        const now = performance.now();
        ui.angle += d;
        // a tick on the fingertip every eighth of a turn
        ui.tick = (ui.tick || 0) + Math.abs(d);
        if (ui.tick > Math.PI / 4) { ui.tick = 0; haptic(4); }
        deck.scratchMove((d / (Math.PI * 2)) * SEC_PER_REV, now - last.t);
        last = { a, t: now };
    });
    const release = () => {
        if (!last) return;
        last = null;
        ui.platter.classList.remove('is-touched');
        deck.endScratch();
    };
    ui.platter.addEventListener('pointerup', release);
    ui.platter.addEventListener('pointercancel', release);

    return ui;
}

function drawWave(ui, deck) {
    const c = ui.wave;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); ui.peaks = null; }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!deck.buffer) {
        ctx.fillStyle = 'rgba(243,237,228,0.4)';
        ctx.font = '500 12px Lexend, sans-serif';
        ctx.fillText(deck.loading ? 'Loading…' : 'Press play to load', 10, h / 2 + 4);
        return;
    }
    const bars = Math.floor(w / 3);
    if (!ui.peaks || ui.peaks.length !== bars) {
        const data = deck.buffer.getChannelData(0);
        const step = Math.floor(data.length / bars);
        ui.peaks = new Float32Array(bars);
        for (let i = 0; i < bars; i++) {
            let m = 0;
            for (let j = i * step, e = j + step; j < e; j += 16) m = Math.max(m, Math.abs(data[j]));
            ui.peaks[i] = m;
        }
    }
    const played = deck.position() / deck.duration;
    for (let i = 0; i < bars; i++) {
        const ph = Math.max(1, ui.peaks[i] * (h - 8));
        ctx.fillStyle = i / bars < played ? '#e3120b' : 'rgba(243,237,228,0.35)';
        ctx.fillRect(i * 3, (h - ph) / 2, 2, ph);
    }
    ctx.fillStyle = '#f3ede4';
    ctx.fillRect(played * w - 1, 0, 2, h);
}

// Scale the console as one piece so all of it is visible without scrolling.
// `avail` returns the space it may use; the layout flips to the upright design on narrow screens.
function fitConsole(host, avail) {
    const fit = document.createElement('div');
    fit.className = 'fit';
    fit.append(...host.children);
    const box = document.createElement('div');
    box.className = 'fit-box';
    box.append(fit);
    host.append(box);
    const apply = () => {
        const { w, h } = avail();
        fit.dataset.layout = w < 640 && h > w ? 'port' : 'land';
        fit.style.transform = 'none';
        const s = Math.min(1, w / fit.offsetWidth, h / fit.offsetHeight);
        fit.style.transform = `scale(${s})`;
        box.style.width = `${fit.offsetWidth * s}px`;
        box.style.height = `${fit.offsetHeight * s}px`;
    };
    apply();
    addEventListener('resize', apply);
    document.fonts?.ready.then(apply);
    return apply;
}

export function initBooth(avail) {
    const consoleEl = document.getElementById('console');
    if (!consoleEl) return;
    engine.ensure();
    const { A, B } = engine.decks;
    // The homepage preview is a lite console: pitch, play, two cues, loop and the crossfader
    const lite = 'lite' in document.getElementById('booth').dataset;
    let boothVisible = false;
    const deckUi = {
        A: buildDeck(consoleEl.querySelector('[data-deck="A"]'), A, lite),
        B: buildDeck(consoleEl.querySelector('[data-deck="B"]'), B, lite),
    };

    deckUi.A.onPitch = () => { if (B.synced) { B.syncTo(A, false); deckUi.B.showPitch(); } engine.emit(); };
    deckUi.B.onPitch = () => { if (A.synced) { A.syncTo(B, false); deckUi.A.showPitch(); } engine.emit(); };

    // Mixer
    const mixer = document.getElementById('mixer');
    mixer.innerHTML = `<div class="mixer-title">Mixer</div>`;
    const channel = deck => {
        const ch = document.createElement('div');
        ch.className = 'channel';
        ch.append(
            knob({ label: `${deck.id} Hi`, onChange: v => deck.setEq('high', v) }),
            knob({ label: `${deck.id} Mid`, onChange: v => deck.setEq('mid', v) }),
            knob({ label: `${deck.id} Low`, onChange: v => deck.setEq('low', v) }),
            knob({ label: `${deck.id} Filter`, onChange: v => deck.setFilter(v), filter: true }),
        );
        const fader = document.createElement('input');
        Object.assign(fader, { type: 'range', min: 0, max: 1, step: 0.01, value: 0.85, className: 'vrange' });
        fader.setAttribute('aria-label', `Channel ${deck.id} volume`);
        fader.addEventListener('input', () => deck.setFader(Number(fader.value)));
        deck.setFader(0.85);
        ch.append(fader);
        return ch;
    };
    const vu = document.createElement('div');
    vu.className = 'vu';
    vu.setAttribute('aria-hidden', 'true');
    vu.innerHTML = '<span><i></i></span><span><i></i></span>';
    const xf = document.createElement('div');
    xf.className = 'xfader';
    xf.innerHTML = `<span>A</span><input type="range" class="hrange" min="-1" max="1" step="0.01" value="0" aria-label="Crossfader"><span>B</span>`;
    const xInput = xf.querySelector('input');
    xInput.addEventListener('input', () => engine.setCrossfader(Number(xInput.value)));
    xInput.addEventListener('dblclick', () => { xInput.value = 0; engine.setCrossfader(0); });
    mixer.append(...(lite ? [xf] : [channel(A), vu, channel(B), xf]));
    const vuBars = vu.querySelectorAll('i');

    let tiltXfade = false;
    if (sensors.supported && !lite) {
        const row = document.createElement('div');
        row.className = 'mixer-fx';
        row.innerHTML = `<button class="pad-btn" data-motion aria-pressed="false">Tilt crossfader</button>`;
        mixer.append(row);
        const btn = row.querySelector('[data-motion]');
        btn.addEventListener('click', async () => {
            if (!(await enableSensors())) return;
            tiltXfade = !tiltXfade;
            recalibrate();
            btn.classList.toggle('is-on', tiltXfade);
            btn.setAttribute('aria-pressed', tiltXfade);
            btn.textContent = tiltXfade ? 'Tilt crossfader: on' : 'Tilt crossfader';
            haptic(15);
        });
        onShake(() => { if (boothVisible || engine.anyPlaying) hit('horn'); });
    }

    // FX pads
    const pads = document.getElementById('pads') || document.createElement('div');
    const padDefs = lite ? [] : [
        ['horn', 'Air horn', '1'],
        ['siren', 'Siren', '2'],
        ['riser', 'Riser', '3'],
        ['echo', 'Echo throw', '4'],
        ['brake', 'Vinyl brake', '5'],
    ];
    pads.innerHTML = padDefs.map(([id, name, key]) =>
        `<button class="fx-pad" data-fx="${id}">${name}<small>Key ${key}</small></button>`).join('');
    const hit = id => {
        haptic(id === 'horn' ? [20, 30, 20] : 15);
        engine.fx(id);
        const b = pads.querySelector(`[data-fx="${id}"]`);
        b.classList.add('is-hit');
        setTimeout(() => b.classList.remove('is-hit'), 160);
    };
    pads.addEventListener('pointerdown', e => {
        const b = e.target.closest('[data-fx]');
        if (b) { e.preventDefault(); hit(b.dataset.fx); }
    });
    pads.addEventListener('keydown', e => {
        const b = e.target.closest('[data-fx]');
        if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); hit(b.dataset.fx); }
    });

    // Keyboard, only while the booth is on screen
    const booth = document.getElementById('booth');
    new IntersectionObserver(([e]) => {
        boothVisible = e.isIntersecting;
        if (boothVisible) { A.load(); B.load(); }
    }, { rootMargin: '400px 0px' }).observe(booth);

    document.addEventListener('keydown', e => {
        if (!boothVisible || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target.closest('input, textarea, select, [role="slider"]')) return;
        const k = e.key.toLowerCase();
        if (k === 'q') A.toggle();
        else if (k === 'p') B.toggle();
        else if (padDefs.some(p => p[2] === k)) hit(padDefs.find(p => p[2] === k)[0]);
        else if (k === 'arrowleft' || k === 'arrowright') {
            e.preventDefault();
            xInput.value = Math.max(-1, Math.min(1, Number(xInput.value) + (k === 'arrowleft' ? -0.1 : 0.1)));
            engine.setCrossfader(Number(xInput.value));
        }
    });

    engine.on(() => {
        for (const id of ['A', 'B']) {
            const d = engine.decks[id], ui = deckUi[id];
            ui.play.textContent = d.playing ? 'Pause' : 'Play';
            ui.play.classList.toggle('is-on', d.playing);
            ui.play.setAttribute('aria-pressed', d.playing);
            ui.sync?.classList.toggle('is-on', !!d.synced);
            ui.sync?.setAttribute('aria-pressed', !!d.synced);
            ui.loop?.classList.toggle('is-on', !!d.loop);
            ui.loop?.setAttribute('aria-pressed', !!d.loop);
            if (d.bpm) ui.bpm.textContent = `${(d.bpm * d.rate).toFixed(1)} BPM`;
        }
    });

    let lastT = performance.now();
    const loop = now => {
        requestAnimationFrame(loop);
        const dt = (now - lastT) / 1000;
        lastT = now;
        if (!boothVisible) return;
        if (tiltXfade && tiltLive()) {
            const x = Math.abs(sensors.tiltX) < 0.08 ? 0 : sensors.tiltX;
            xInput.value = x;
            engine.setCrossfader(x);
        }
        ['A', 'B'].forEach((id, i) => {
            const d = engine.decks[id], ui = deckUi[id];
            if (d.playing && !d.scratching) ui.angle += (dt / SEC_PER_REV) * Math.PI * 2 * d.rate;
            ui.disc.style.transform = `rotate(${ui.angle}rad)`;
            ui.time.textContent = d.buffer ? `${fmt(d.position())} / ${fmt(d.duration)}` : '0:00';
            drawWave(ui, d);
            // Beat lights: the bar position from the detected beat grid, lit on each beat
            const ph = d.bpm ? d.beatPhase() : null;
            ui.beats.forEach((b, j) => {
                b.classList.toggle('is-on', !!ph && ((ph.beat % 4) + 4) % 4 === j);
                b.classList.toggle('is-hit', !!ph && d.playing && ph.frac < 0.18);
            });
            // Sync holds the beats together: re-lock if loops or cue jumps pull them apart
            const m = d.other;
            if (d.synced && d.playing && m.playing && !d.scratching && !m.scratching && now - (ui.lockT || 0) > 250) {
                ui.lockT = now;
                const diff = ((d.beatPhase().bar - m.beatPhase().bar + 1.5) % 1) - 0.5;
                if (Math.abs(diff * 240 / d.bpm) > 0.015) d.syncTo(m);
            }
            const lvl = engine.ctx ? d.level() : 0;
            if (vuBars[i]) vuBars[i].style.height = `${Math.min(100, lvl * 140)}%`;
        });
    };
    requestAnimationFrame(loop);

    const host = document.getElementById('booth');
    const fallback = () => ({ w: host.clientWidth - 24, h: innerHeight - 110 });
    return fitConsole(host, avail || fallback);
}
