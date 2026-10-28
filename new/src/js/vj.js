import * as THREE from 'three';
import { engine } from './audio.js';
import { sensors, tiltLive, haptic } from './sensors.js';

// Generative scenes come first: they dance to the music with nothing loaded.
// The photo scene is optional, for when you want his pictures on the wall.
export const SCENES = ['Pulse', 'Tunnel', 'Spectrum', 'Warp', 'Strobe grid', 'Logo', 'Kaleido', 'Lasers', 'Photo FX'];
const COLORS = ['Red', 'Mono', 'Invert'];
const BANDS = 24;
const IDLE_BPM = 122;

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uBass, uMid, uHigh, uBeat;
uniform float uIntensity;
uniform int uScene, uPrev, uColor;
uniform float uMix;
uniform float uStrobe;
uniform vec2 uTilt;
uniform float uGain;
uniform float uSpec[${BANDS}];
uniform sampler2D uPhoto, uLogo;

#define PI 3.14159265

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float band(float x) {
  // read the spectrum at 0..1 without dynamic indexing (GLSL ES 1.0 safe)
  float idx = clamp(x, 0.0, 0.999) * ${BANDS}.0;
  float v = 0.0;
  for (int i = 0; i < ${BANDS}; i++) { if (float(i) <= idx && idx < float(i + 1)) v = uSpec[i]; }
  return v;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

float scene(int m, vec2 uv) {
  float t = uTime, I = uIntensity;
  float aspect = uRes.x / uRes.y;
  vec2 c = (uv - 0.5 - uTilt * 0.12) * vec2(aspect, 1.0);
  float r = length(c), a = atan(c.y, c.x);
  if (m == 0) { // Pulse: rings that leave the centre on every kick
    float rings = sin(r * 26.0 - t * 4.0 - uBass * 6.0 * I);
    float shape = smoothstep(0.75, 1.0, rings) * (0.5 + uBass * 1.4 * I);
    float core = smoothstep(0.32 + uBass * 0.25 * I, 0.0, r);
    float grain = noise(c * 6.0 + t) * uHigh * 0.5;
    return shape * smoothstep(1.2, 0.1, r) + core + grain * 0.4;
  }
  if (m == 1) { // Tunnel
    float z = 0.35 / (r + 1e-3) + t * (0.6 + uMid * 2.0 * I);
    float rings = step(0.5, fract(z * 2.0));
    float spokes = step(0.5, fract(a / PI * (4.0 + floor(uHigh * 6.0))));
    return mix(rings, rings * spokes, 0.5) * smoothstep(0.0, 0.25, r) * (0.6 + uBass * I);
  }
  if (m == 2) { // Spectrum: mirrored bars from the middle out
    float x = abs(uv.x - 0.5) * 2.0;
    float h = band(x) * (0.6 + 0.8 * I);
    float bar = step(abs(uv.y - 0.5) * 2.0, h) * step(0.18, fract(x * ${BANDS}.0));
    float glow = smoothstep(h + 0.25, h, abs(uv.y - 0.5) * 2.0) * 0.25;
    return bar + glow;
  }
  if (m == 3) { // Warp: streaks flying past, faster with the mids
    float v = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float ang = floor(a / PI * (40.0 + fi * 14.0)) ;
      float seed = hash(vec2(ang, fi));
      float pos = fract(seed + t * (0.25 + uMid * 1.2 * I) * (1.0 + fi * 0.4));
      float d = abs(r - pos * 1.4);
      v += smoothstep(0.06 + uBass * 0.08, 0.0, d) * step(0.55, seed) * pos;
    }
    return v * 1.5 + smoothstep(0.25, 0.0, r) * uBass;
  }
  if (m == 4) { // Strobe grid
    vec2 g = floor(uv * vec2(8.0, 4.5));
    float on = step(1.0 - (0.15 + uHigh * 0.7 * I), hash(g + floor(t * (4.0 + uBeat * 8.0))));
    vec2 f = fract(uv * vec2(8.0, 4.5));
    float box = step(0.06, f.x) * step(0.06, f.y) * step(f.x, 0.94) * step(f.y, 0.94);
    return on * box * (0.5 + uBass);
  }
  if (m == 5) { // Logo pulse
    float s = 1.6 - uBass * 0.5 * I;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * s / vec2(2.85, 1.0) + 0.5;
    float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
    float logo = texture2D(uLogo, p).a * inside;
    float echo = texture2D(uLogo, (p - 0.5) * (1.0 + uBass * 0.3) + 0.5).a * inside * 0.4;
    return max(logo, echo) + (hash(uv + t) - 0.5) * 0.08;
  }
  if (m == 6) { // Kaleido: a noise field folded into mirrored slices that turn with the music
    float k = 6.0 + floor(uHigh * 4.0 * I) * 2.0;
    float seg = PI / k;
    float fa = mod(a + t * 0.25 + uBass * 0.4 * I, 2.0 * seg);
    fa = abs(fa - seg);
    vec2 q = vec2(cos(fa), sin(fa)) * r;
    float n = noise(q * 7.0 - vec2(t * 0.8, 0.0)) * noise(q * 3.0 + t * 0.3);
    float lines = smoothstep(0.42, 0.5, fract(n * 6.0 + r * 3.0 - t * 0.5));
    return lines * (0.55 + uBass * I) * smoothstep(1.3, 0.2, r) + smoothstep(0.12 + uBass * 0.1, 0.0, r);
  }
  if (m == 7) { // Lasers: beams fanning up from the floor, sweeping on the beat
    vec2 o = vec2(0.0, -0.55);
    vec2 d = c - o;
    float ang = atan(d.x, d.y);
    float v = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i) - 3.0;
      float target = fi * (0.16 + uMid * 0.12 * I) + sin(t * 1.3 + fi * 0.7) * 0.35 * (0.4 + uBass * I);
      v += smoothstep(0.012 + uHigh * 0.01, 0.0, abs(ang - target)) * smoothstep(1.6, 0.0, length(d));
    }
    float haze = noise(c * 3.0 + vec2(0.0, t * 0.4)) * 0.12;
    return v * (0.7 + uBass * 0.8 * I) + haze;
  }
  // Photo FX (optional): his photo, sliced by the kick
  float slice = floor(uv.y * 24.0);
  float kick = (hash(vec2(slice, floor(t * 8.0))) - 0.5) * uBass * 0.18 * I;
  vec2 p = uv + vec2(kick, 0.0) - 0.5;
  if (aspect > 0.6667) p.y *= 0.6667 / aspect; else p.x *= aspect / 0.6667;
  p = p * (1.0 - uBass * 0.08 * I) + 0.5;
  return lum(texture2D(uPhoto, p).rgb) * 1.25;
}

void main() {
  float v = mix(scene(uPrev, vUv), scene(uScene, vUv), uMix);
  v = clamp(v, 0.0, 1.0);
  vec3 red = vec3(0.89, 0.07, 0.04);
  vec3 col;
  if (uColor == 0) col = mix(vec3(0.0), red, smoothstep(0.05, 0.55, v)) + vec3(1.0, 0.95, 0.9) * smoothstep(0.75, 1.0, v);
  else if (uColor == 1) col = vec3(v);
  else col = vec3(1.0) - mix(vec3(0.0), red, v) - vec3(v * 0.3);
  col = mix(col, vec3(1.0), uStrobe * step(0.5, fract(uTime * 12.0)));
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;

const vert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// One VJ engine; its material can be put on any number of surfaces (LED wall, laptop screen)
export function createVJ() {
    const loader = new THREE.TextureLoader();
    const tex = src => loader.load(src, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    });
    const spec = new Float32Array(BANDS);
    const u = {
        uRes: { value: new THREE.Vector2(1920, 1080) },
        uTime: { value: 0 },
        uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 }, uBeat: { value: 0 },
        uIntensity: { value: 0.75 },
        uScene: { value: 0 }, uPrev: { value: 0 }, uMix: { value: 1 },
        uColor: { value: 0 },
        uStrobe: { value: 0 },
        uTilt: { value: new THREE.Vector2(0, 0) },
        uGain: { value: 0.72 },
        uSpec: { value: spec },
        uPhoto: { value: tex('/media/deck-hands-900.webp') },
        uLogo: { value: tex('/logo-tight.png') },
    };
    const material = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: u, toneMapped: false });

    const listeners = new Set();
    let auto = true;
    const setScene = i => {
        if (i === u.uScene.value) return;
        u.uPrev.value = u.uScene.value;
        u.uScene.value = i;
        u.uMix.value = 0;
        listeners.forEach(fn => fn());
    };

    let lastBass = 0, beatCount = 0, lastBeatT = 0;
    const tilt = new THREE.Vector2();
    // Called once per frame by whoever renders the world. Returns the frame's levels for reuse.
    const update = t => {
        u.uTime.value = t;
        const lv = engine.levels();
        let bass = lv.bass, mid = lv.mid, high = lv.high;
        const live = engine.anyPlaying;
        engine.spectrum(spec);
        if (!live) {
            // internal clock so the wall is never dead
            const ph = (t * IDLE_BPM / 60) % 1;
            bass = Math.pow(1 - ph, 4) * 0.7;
            mid = 0.3 + 0.2 * Math.sin(t);
            high = 0.25 + 0.25 * Math.sin(t * 3.1);
            for (let i = 0; i < BANDS; i++) spec[i] = 0.25 + 0.25 * Math.sin(t * 2 + i * 0.6) * (1 - i / BANDS) + bass * 0.4 * (1 - i / BANDS);
        }
        u.uBass.value = bass; u.uMid.value = mid; u.uHigh.value = high;

        let beat = false;
        if (bass - lastBass > 0.12 && t - lastBeatT > 0.28) {
            lastBeatT = t;
            beat = true;
            u.uBeat.value = 1;
            // cut to a new generative scene every 16 beats
            if (auto && ++beatCount % 16 === 0) setScene((u.uScene.value + 1 + Math.floor(Math.random() * 4)) % (SCENES.length - 1)); // never Photo FX
        }
        u.uBeat.value *= 0.9;
        lastBass = bass;
        u.uMix.value = Math.min(1, u.uMix.value + 0.035);
        if (tiltLive()) u.uTilt.value.lerp(tilt.set(sensors.tiltX, -sensors.tiltY), 0.15);
        return { bass, mid, high, beat, live };
    };

    // Control panel for the VJ side of the booth
    const mountControls = el => {
        el.innerHTML = `
          <div class="vj-scenes" role="group" aria-label="Scenes">
            ${SCENES.map((s, i) => `<button class="pad-btn" data-scene="${i}">${s}</button>`).join('')}
          </div>
          <div class="vj-side">
            <label class="vj-row">Intensity <input type="range" class="hrange" min="0" max="1" step="0.01" value="0.75" data-ctl="intensity"></label>
            <div class="vj-actions" role="group" aria-label="Colour">
              ${COLORS.map((c, i) => `<button class="pad-btn${i === 0 ? ' is-on' : ''}" data-color="${i}" aria-pressed="${i === 0}">${c}</button>`).join('')}
            </div>
            <div class="vj-actions">
              <button class="pad-btn" data-ctl="strobe">Hold: strobe</button>
              <button class="pad-btn is-on" data-ctl="auto" aria-pressed="true">Auto cut</button>
            </div>
          </div>`;
        const sync = () => el.querySelectorAll('[data-scene]').forEach(b => {
            const on = Number(b.dataset.scene) === u.uScene.value;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on);
        });
        listeners.add(sync);
        sync();
        el.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            haptic(10);
            if (b.dataset.scene) setScene(Number(b.dataset.scene));
            if (b.dataset.color) {
                u.uColor.value = Number(b.dataset.color);
                el.querySelectorAll('[data-color]').forEach(x => {
                    x.classList.toggle('is-on', x === b);
                    x.setAttribute('aria-pressed', x === b);
                });
            }
            if (b.dataset.ctl === 'auto') {
                auto = !auto;
                b.classList.toggle('is-on', auto);
                b.setAttribute('aria-pressed', auto);
            }
        });
        el.querySelector('[data-ctl="intensity"]').addEventListener('input', e => { u.uIntensity.value = Number(e.target.value); });
        const strobe = el.querySelector('[data-ctl="strobe"]');
        const strobeOn = v => { u.uStrobe.value = v; strobe.classList.toggle('is-on', !!v); };
        strobe.addEventListener('pointerdown', () => strobeOn(1));
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => strobe.addEventListener(ev, () => strobeOn(0)));
    };

    const next = () => setScene((u.uScene.value + 1) % SCENES.length);
    return { material, uniforms: u, update, mountControls, next };
}
