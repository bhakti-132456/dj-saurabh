import { decks as deckData } from './content.js';

const BPM = 122; // the deep house mix sits around here; used for echo timing
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Tempo and beat grid from the audio itself: an onset envelope at 200 Hz, then the
// tempo and offset whose beat grid lands on the most onsets.
function detectBeats(buf) {
    const data = buf.getChannelData(0), sr = buf.sampleRate, fps = 200, hop = Math.floor(sr / fps);
    const n = Math.floor(data.length / hop), env = new Float32Array(n), on = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = i * hop, e = j + hop; j < e; j += 4) s += Math.abs(data[j]);
        env[i] = s;
    }
    for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
    let best = { score: -1, bpm: 120, off: 0 };
    const score = (bpm, o) => {
        const P = (60 / bpm) * fps;
        let s = 0;
        for (let t = o; t < n; t += P) s += on[Math.round(t)] || 0;
        return s / Math.floor((n - o) / P);
    };
    const search = (lo, hi, step, offStep) => {
        for (let bpm = lo; bpm <= hi; bpm += step) {
            const P = (60 / bpm) * fps;
            for (let o = 0; o < P; o += offStep) {
                const sc = score(bpm, o);
                if (sc > best.score) best = { score: sc, bpm, off: o };
            }
        }
    };
    search(100, 150, 0.5, 2);
    search(best.bpm - 0.6, best.bpm + 0.6, 0.02, 1);
    return { bpm: Math.round(best.bpm * 10) / 10, beatOffset: best.off / fps };
}

class Deck {
    constructor(engine, id, { src, title }) {
        this.engine = engine;
        this.id = id;
        this.src = src;
        this.title = title;
        this.buffer = null;
        this.reversed = null;
        this.loading = null;

        this.playing = false;
        this.rate = 1;
        this.pos = 0;
        this.anchorTime = 0;
        this.anchorPos = 0;
        this.source = null;

        this.scratching = false;
        this.scratchSrc = null;
        this.scratchDir = 0;
        this.scratchIdle = null;
        this.hotCues = [0, 30, 60];

        const ctx = engine.ctx;
        this.eqLow = ctx.createBiquadFilter();
        this.eqLow.type = 'lowshelf';
        this.eqLow.frequency.value = 180;
        this.eqMid = ctx.createBiquadFilter();
        this.eqMid.type = 'peaking';
        this.eqMid.frequency.value = 1100;
        this.eqMid.Q.value = 0.8;
        this.eqHigh = ctx.createBiquadFilter();
        this.eqHigh.type = 'highshelf';
        this.eqHigh.frequency.value = 6500;
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 22000;
        this.filter.Q.value = 1;
        this.fader = ctx.createGain();
        this.xfade = ctx.createGain();
        this.meter = ctx.createAnalyser();
        this.meter.fftSize = 256;
        this.meterData = new Uint8Array(this.meter.fftSize);

        this.input = this.eqLow;
        this.eqLow.connect(this.eqMid).connect(this.eqHigh).connect(this.filter).connect(this.fader);
        this.fader.connect(this.meter);
        this.fader.connect(this.xfade).connect(engine.bus);
    }

    get duration() {
        return this.buffer ? this.buffer.duration : 1;
    }

    load() {
        if (!this.loading) {
            this.loading = fetch(this.src)
                .then(r => r.arrayBuffer())
                .then(ab => this.engine.ctx.decodeAudioData(ab))
                .then(buf => { this.buffer = buf; Object.assign(this, detectBeats(buf)); this.engine.emit(); return buf; });
        }
        return this.loading;
    }

    getReversed() {
        if (this.reversed) return this.reversed;
        const b = this.buffer;
        const r = this.engine.ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
        for (let c = 0; c < b.numberOfChannels; c++) {
            const src = b.getChannelData(c);
            const dst = r.getChannelData(c);
            for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
        }
        this.reversed = r;
        return r;
    }

    wrap(p) {
        const d = this.duration;
        return ((p % d) + d) % d;
    }

    position() {
        if (this.playing && this.source && !this.scratching) {
            const t = this.engine.ctx.currentTime;
            return this.wrap(this.anchorPos + (t - this.anchorTime) * this.rate);
        }
        return this.pos;
    }

    startSource(at) {
        this.stopSource();
        const ctx = this.engine.ctx;
        const s = ctx.createBufferSource();
        s.buffer = this.buffer;
        s.loop = true;
        s.playbackRate.value = this.rate;
        s.connect(this.input);
        s.start(0, this.wrap(at));
        this.source = s;
        this.anchorTime = ctx.currentTime;
        this.anchorPos = this.wrap(at);
    }

    stopSource() {
        if (this.source) {
            try { this.source.stop(); } catch { /* already stopped */ }
            this.source.disconnect();
            this.source = null;
        }
    }

    async play() {
        await this.engine.resume();
        await this.load();
        if (this.playing) return;
        this.playing = true;
        this.startSource(this.pos);
        this.engine.emit();
    }

    pause() {
        if (!this.playing) return;
        this.pos = this.position();
        this.playing = false;
        this.stopSource();
        this.engine.emit();
    }

    toggle() {
        return this.playing ? this.pause() : this.play();
    }

    async jump(seconds) {
        await this.load();
        this.pos = this.wrap(seconds);
        if (this.playing) this.startSource(this.pos);
        else await this.play();
    }

    // Match tempo (and optionally beat phase) to another deck
    syncTo(master, phase = true) {
        if (!this.bpm || !master.bpm) return;
        this.setPitch(clamp((master.bpm * master.rate) / this.bpm - 1, -0.16, 0.16));
        if (!phase) return;
        const beatM = 60 / master.bpm, beatS = 60 / this.bpm;
        const ph = ((((master.position() - master.beatOffset) / beatM) % 1) + 1) % 1;
        const k = Math.floor((this.position() - this.beatOffset) / beatS);
        const pos = this.wrap(this.beatOffset + (k + ph) * beatS);
        if (this.playing) this.startSource(pos); else this.pos = pos;
    }

    setPitch(p) {
        const pos = this.position();
        this.rate = 1 + p;
        if (this.source && !this.scratching) {
            this.anchorPos = pos;
            this.anchorTime = this.engine.ctx.currentTime;
            this.source.playbackRate.setValueAtTime(this.rate, this.anchorTime);
        }
    }

    setEq(band, v) {
        const node = { low: this.eqLow, mid: this.eqMid, high: this.eqHigh }[band];
        const db = v < 0 ? v * 30 : v * 6;
        node.gain.setTargetAtTime(db, this.engine.ctx.currentTime, 0.02);
    }

    setFilter(v) {
        const t = this.engine.ctx.currentTime;
        const f = this.filter;
        if (v < -0.03) {
            f.type = 'lowpass';
            f.frequency.setTargetAtTime(20000 * Math.pow(2, v * 9.6), t, 0.02);
            f.Q.value = 4;
        } else if (v > 0.03) {
            f.type = 'highpass';
            f.frequency.setTargetAtTime(20 * Math.pow(2, v * 9.6), t, 0.02);
            f.Q.value = 4;
        } else {
            f.type = 'lowpass';
            f.frequency.setTargetAtTime(22000, t, 0.02);
            f.Q.value = 1;
        }
    }

    setFader(v) {
        this.fader.gain.setTargetAtTime(v * v, this.engine.ctx.currentTime, 0.01);
    }

    level() {
        this.meter.getByteTimeDomainData(this.meterData);
        let peak = 0;
        for (let i = 0; i < this.meterData.length; i++) {
            peak = Math.max(peak, Math.abs(this.meterData[i] - 128));
        }
        return peak / 128;
    }

    // --- Scratching: the platter drives a buffer source forwards or backwards ---
    beginScratch() {
        if (!this.buffer) return;
        this.engine.resume();
        this.wasPlaying = this.playing;
        this.pos = this.position();
        this.stopSource();
        this.scratching = true;
        this.scratchDir = 0;
    }

    scratchMove(deltaSec, dtMs) {
        if (!this.scratching) return;
        const ctx = this.engine.ctx;
        this.pos = this.wrap(this.pos + deltaSec);
        const v = deltaSec / Math.max(dtMs / 1000, 0.004);
        const dir = Math.sign(v) || this.scratchDir || 1;
        const speed = clamp(Math.abs(v), 0.001, 4);

        if (!this.scratchSrc || dir !== this.scratchDir) {
            this.killScratchSrc();
            const s = ctx.createBufferSource();
            s.buffer = dir > 0 ? this.buffer : this.getReversed();
            s.loop = true;
            s.playbackRate.value = speed;
            s.connect(this.input);
            const offset = dir > 0 ? this.pos : this.duration - this.pos;
            s.start(0, this.wrap(offset));
            this.scratchSrc = s;
            this.scratchDir = dir;
        } else {
            this.scratchSrc.playbackRate.setTargetAtTime(speed, ctx.currentTime, 0.012);
        }

        // A hand holding the record still means silence
        clearTimeout(this.scratchIdle);
        this.scratchIdle = setTimeout(() => {
            if (this.scratchSrc) this.scratchSrc.playbackRate.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
        }, 70);
    }

    endScratch() {
        if (!this.scratching) return;
        clearTimeout(this.scratchIdle);
        this.killScratchSrc();
        this.scratching = false;
        if (this.wasPlaying) {
            this.playing = true;
            this.startSource(this.pos);
        }
        this.engine.emit();
    }

    killScratchSrc() {
        if (this.scratchSrc) {
            try { this.scratchSrc.stop(); } catch { /* noop */ }
            this.scratchSrc.disconnect();
            this.scratchSrc = null;
        }
    }

    brake(seconds = 1.4) {
        if (!this.playing || !this.source) return;
        const ctx = this.engine.ctx;
        const t = ctx.currentTime;
        const p = this.position();
        this.source.playbackRate.cancelScheduledValues(t);
        this.source.playbackRate.setValueAtTime(this.rate, t);
        this.source.playbackRate.linearRampToValueAtTime(0.001, t + seconds);
        const src = this.source;
        this.source = null;
        this.playing = false;
        this.pos = this.wrap(p + (this.rate * seconds) / 2);
        setTimeout(() => { try { src.stop(); } catch { /* noop */ } src.disconnect(); }, seconds * 1000 + 50);
        this.engine.emit();
    }
}

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.decks = {};
        this.listeners = new Set();
        this.smoothed = { bass: 0, mid: 0, high: 0, level: 0 };
        this.xfader = 0;
    }

    ensure() {
        if (this.ctx) return this;
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC({ latencyHint: 'interactive' });
        this.ctx = ctx;

        this.bus = ctx.createGain();
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -8;
        comp.ratio.value = 6;
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.75;
        this.freq = new Uint8Array(this.analyser.frequencyBinCount);

        this.bus.connect(this.master);
        this.master.connect(comp).connect(this.analyser).connect(ctx.destination);

        // Echo send (for the echo-throw pad)
        this.echoSend = ctx.createGain();
        this.echoSend.gain.value = 0;
        const delay = ctx.createDelay(2);
        delay.delayTime.value = (60 / BPM) * 0.75;
        const fb = ctx.createGain();
        fb.gain.value = 0.55;
        const tone = ctx.createBiquadFilter();
        tone.type = 'bandpass';
        tone.frequency.value = 1800;
        tone.Q.value = 0.6;
        this.bus.connect(this.echoSend).connect(delay).connect(tone).connect(fb).connect(delay);
        tone.connect(this.master);

        this.fxBus = ctx.createGain();
        this.fxBus.gain.value = 0.7;
        this.fxBus.connect(this.master);

        for (const id of Object.keys(deckData)) this.decks[id] = new Deck(this, id, deckData[id]);
        this.setCrossfader(0);
        return this;
    }

    async resume() {
        this.ensure();
        if (this.ctx.state !== 'running') await this.ctx.resume();
    }

    on(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    emit() {
        for (const fn of this.listeners) fn(this);
    }

    get anyPlaying() {
        return Object.values(this.decks).some(d => d.playing || d.scratching);
    }

    setCrossfader(x) {
        this.xfader = x;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const a = Math.cos(((x + 1) * Math.PI) / 4);
        const b = Math.sin(((x + 1) * Math.PI) / 4);
        this.decks.A.xfade.gain.setTargetAtTime(a, t, 0.008);
        this.decks.B.xfade.gain.setTargetAtTime(b, t, 0.008);
    }

    stopAll() {
        Object.values(this.decks).forEach(d => d.pause());
    }

    // Band energies 0..1, smoothed, for visuals
    levels() {
        const s = this.smoothed;
        if (!this.ctx || !this.anyPlaying) {
            s.bass *= 0.9; s.mid *= 0.9; s.high *= 0.9; s.level *= 0.9;
            return s;
        }
        this.analyser.getByteFrequencyData(this.freq);
        const avg = (a, b) => {
            let sum = 0;
            for (let i = a; i < b; i++) sum += this.freq[i];
            return sum / ((b - a) * 255);
        };
        const bass = avg(1, 6), mid = avg(8, 60), high = avg(90, 260);
        const k = 0.35;
        s.bass += (Math.pow(bass, 1.6) - s.bass) * k;
        s.mid += (mid - s.mid) * k;
        s.high += (high - s.high) * k;
        s.level += ((bass + mid + high) / 3 - s.level) * k;
        return s;
    }

    // Log-spaced band levels 0..1 into `out` (a Float32Array), for spectrum visuals
    spectrum(out) {
        if (!this.ctx || !this.anyPlaying) {
            for (let i = 0; i < out.length; i++) out[i] *= 0.9;
            return out;
        }
        this.analyser.getByteFrequencyData(this.freq);
        const n = out.length, max = this.freq.length * 0.7;
        for (let i = 0; i < n; i++) {
            const a = Math.floor(Math.pow(max, i / n)), b = Math.max(a + 1, Math.floor(Math.pow(max, (i + 1) / n)));
            let s = 0;
            for (let j = a; j < b; j++) s += this.freq[j];
            const v = s / ((b - a) * 255);
            out[i] += (v - out[i]) * 0.4;
        }
        return out;
    }

    // ---- FX pads (synthesised, no samples needed) ----
    async fx(name) {
        await this.resume();
        const fn = { horn: this.airhorn, siren: this.siren, riser: this.riser, echo: this.echoThrow, brake: this.brakeLoudest }[name];
        if (fn) fn.call(this);
    }

    airhorn() {
        const ctx = this.ctx;
        const t0 = ctx.currentTime;
        const shaper = ctx.createWaveShaper();
        const curve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
            const x = (i / 512) - 1;
            curve[i] = Math.tanh(x * 3);
        }
        shaper.curve = curve;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1400;
        bp.Q.value = 0.7;
        const out = ctx.createGain();
        out.gain.value = 0;
        shaper.connect(bp).connect(out).connect(this.fxBus);

        const hits = [[0, 0.13], [0.17, 0.13], [0.34, 0.13], [0.52, 0.7]];
        const oscs = [415, 523, 622].map(f => {
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = f;
            o.connect(shaper);
            o.start(t0);
            o.stop(t0 + 1.4);
            return o;
        });
        hits.forEach(([at, len]) => {
            out.gain.setValueAtTime(0, t0 + at);
            out.gain.linearRampToValueAtTime(0.5, t0 + at + 0.015);
            out.gain.setValueAtTime(0.5, t0 + at + len - 0.03);
            out.gain.linearRampToValueAtTime(0, t0 + at + len);
            oscs.forEach(o => {
                o.frequency.setValueAtTime(o.frequency.value * 0.97, t0 + at);
                o.frequency.linearRampToValueAtTime(o.frequency.value, t0 + at + 0.05);
            });
        });
    }

    siren() {
        const ctx = this.ctx;
        const t0 = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 700;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 3.2;
        const depth = ctx.createGain();
        depth.gain.value = 380;
        lfo.connect(depth).connect(o.frequency);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.18, t0 + 0.05);
        g.gain.setValueAtTime(0.18, t0 + 1.7);
        g.gain.linearRampToValueAtTime(0, t0 + 2);
        o.connect(lp).connect(g).connect(this.fxBus);
        o.start(t0); lfo.start(t0);
        o.stop(t0 + 2.05); lfo.stop(t0 + 2.05);
    }

    riser() {
        const ctx = this.ctx;
        const t0 = ctx.currentTime;
        const dur = 4;
        const len = ctx.sampleRate * dur;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const n = ctx.createBufferSource();
        n.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 3;
        bp.frequency.setValueAtTime(250, t0);
        bp.frequency.exponentialRampToValueAtTime(9000, t0 + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t0);
        g.gain.exponentialRampToValueAtTime(0.5, t0 + dur - 0.05);
        g.gain.linearRampToValueAtTime(0, t0 + dur);
        n.connect(bp).connect(g).connect(this.fxBus);
        n.start(t0);
    }

    echoThrow() {
        const t = this.ctx.currentTime;
        const beat = 60 / BPM;
        const g = this.echoSend.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0.9, t);
        g.setValueAtTime(0.9, t + beat);
        g.linearRampToValueAtTime(0, t + beat + 0.05);
    }

    brakeLoudest() {
        const decks = Object.values(this.decks).filter(d => d.playing);
        if (!decks.length) return;
        decks.sort((a, b) => b.xfade.gain.value * b.fader.gain.value - a.xfade.gain.value * a.fader.gain.value);
        decks[0].brake();
    }
}

export const engine = new AudioEngine();
