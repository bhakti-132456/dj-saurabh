import * as THREE from 'three';
import { engine } from './audio.js';
import { sensors, tiltLive, haptic } from './sensors.js';

const SCENES = ['Duotone', 'Tunnel', 'Kaleido', 'Strobe grid', 'VHS roll', 'Logo pulse'];
const COLORS = ['Red', 'Mono', 'Invert'];

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
uniform sampler2D uPhotoA, uPhotoB, uLogo;

#define PI 3.14159265

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

vec2 cover(vec2 uv, float imgAspect) {
  float sa = uRes.x / uRes.y;
  vec2 p = uv - 0.5;
  if (sa > imgAspect) p.y *= imgAspect / sa; else p.x *= sa / imgAspect;
  return p + 0.5;
}

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

float scene(int m, vec2 uv) {
  float t = uTime;
  float I = uIntensity;
  vec2 c = (uv - 0.5 - uTilt * 0.18) * vec2(uRes.x / uRes.y, 1.0);
  if (m == 0) { // Duotone: photo, slices kicked sideways by the kick
    float slice = floor(uv.y * 24.0);
    float kick = (hash(vec2(slice, floor(t * 8.0))) - 0.5) * uBass * 0.18 * I;
    vec2 p = cover(uv + vec2(kick, 0.0), 0.6667);
    p = (p - 0.5) * (1.0 - uBass * 0.08 * I) + 0.5;
    return lum(texture2D(uPhotoA, p).rgb) * 1.25;
  }
  if (m == 1) { // Tunnel
    float r = length(c) + 1e-3;
    float a = atan(c.y, c.x);
    float z = 0.35 / r + t * (0.6 + uMid * 2.0 * I);
    float rings = step(0.5, fract(z * 2.0));
    float spokes = step(0.5, fract(a / PI * (4.0 + floor(uHigh * 6.0))));
    return mix(rings, rings * spokes, 0.5) * smoothstep(0.0, 0.25, r) * (0.6 + uBass * I);
  }
  if (m == 2) { // Kaleido of the second photo
    float r = length(c);
    float a = atan(c.y, c.x) + t * 0.2 + uTilt.x * 1.5;
    float seg = PI / 3.0;
    a = mod(a, seg);
    a = abs(a - seg * 0.5);
    vec2 p = vec2(cos(a), sin(a)) * r * (0.9 - uBass * 0.25 * I) + vec2(0.5, 0.45);
    return lum(texture2D(uPhotoB, p).rgb) * 1.4;
  }
  if (m == 3) { // Strobe grid
    vec2 g = floor(uv * vec2(8.0, 4.5));
    float on = step(1.0 - (0.15 + uHigh * 0.7 * I), hash(g + floor(t * (4.0 + uBeat * 8.0))));
    vec2 f = fract(uv * vec2(8.0, 4.5));
    float box = step(0.06, f.x) * step(0.06, f.y) * step(f.x, 0.94) * step(f.y, 0.94);
    return on * box * (0.5 + uBass);
  }
  if (m == 4) { // VHS roll
    vec2 p = uv;
    p.y = fract(p.y + t * 0.05 + uBass * 0.04 * I);
    float band = step(0.97 - uMid * 0.2 * I, hash(vec2(floor(p.y * 80.0), floor(t * 12.0))));
    p.x += band * 0.08 + sin(p.y * 40.0 + t * 10.0) * 0.004 * I;
    float l = lum(texture2D(uPhotoA, cover(p, 0.6667)).rgb);
    float lines = 0.8 + 0.2 * sin(uv.y * uRes.y * 1.5);
    return (l * 1.2 + band * 0.4) * lines;
  }
  // Logo pulse
  float s = 1.6 - uBass * 0.5 * I;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * s / vec2(2.85, 1.0) + 0.5;
  float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
  float logo = texture2D(uLogo, p).a * inside;
  float echo = texture2D(uLogo, (p - 0.5) * (1.0 + uBass * 0.3) + 0.5).a * inside * 0.4;
  return max(logo, echo) + (hash(uv + t) - 0.5) * 0.08;
}

void main() {
  float v = mix(scene(uPrev, vUv), scene(uScene, vUv), uMix);
  v = clamp(v, 0.0, 1.0);
  vec3 col;
  if (uColor == 0) col = mix(vec3(0.0), vec3(0.89, 0.07, 0.04), smoothstep(0.05, 0.55, v)) + vec3(1.0, 0.95, 0.9) * smoothstep(0.75, 1.0, v);
  else if (uColor == 1) col = vec3(v);
  else col = vec3(1.0) - mix(vec3(0.0), vec3(0.89, 0.07, 0.04), v) - vec3(v * 0.3);
  col = mix(col, vec3(1.0), uStrobe * step(0.5, fract(uTime * 12.0)));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function initVJ() {
    const canvas = document.getElementById('vjCanvas');
    const controls = document.getElementById('vjControls');
    const live = document.getElementById('vjLive');
    if (!canvas) return;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    } catch {
        canvas.parentElement.innerHTML = '<p style="padding:20px">This screen needs WebGL.</p>';
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const loader = new THREE.TextureLoader();
    const tex = src => loader.load(src, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    });
    const u = {
        uRes: { value: new THREE.Vector2(16, 9) },
        uTime: { value: 0 },
        uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 }, uBeat: { value: 0 },
        uIntensity: { value: 0.7 },
        uScene: { value: 0 }, uPrev: { value: 0 }, uMix: { value: 1 },
        uColor: { value: 0 },
        uStrobe: { value: 0 },
        uTilt: { value: new THREE.Vector2(0, 0) },
        uPhotoA: { value: tex('/media/deck-hands-900.webp') },
        uPhotoB: { value: tex('/media/red-beam-900.webp') },
        uLogo: { value: tex('/logo-tight.png') },
    };
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: frag,
        uniforms: u,
    })));
    const camera = new THREE.Camera();

    const resize = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        renderer.setSize(w, h, false);
        u.uRes.value.set(w, h);
    };
    new ResizeObserver(resize).observe(canvas);
    resize();

    // Controls
    controls.innerHTML = `
      <div class="vj-scenes" role="group" aria-label="Scenes">
        ${SCENES.map((s, i) => `<button class="pad-btn${i === 0 ? ' is-on' : ''}" data-scene="${i}" aria-pressed="${i === 0}">${s}</button>`).join('')}
      </div>
      <label class="vj-row">Intensity <input type="range" class="hrange" min="0" max="1" step="0.01" value="0.7" data-ctl="intensity"></label>
      <div class="vj-actions" role="group" aria-label="Colour">
        ${COLORS.map((c, i) => `<button class="pad-btn${i === 0 ? ' is-on' : ''}" data-color="${i}" aria-pressed="${i === 0}">${c}</button>`).join('')}
      </div>
      <div class="vj-actions">
        <button class="pad-btn" data-ctl="strobe">Hold: strobe</button>
        <button class="pad-btn" data-ctl="auto" aria-pressed="false">Auto cut</button>
      </div>
      <button class="pad-btn" data-ctl="feed">Feed it the booth</button>`;

    const setScene = i => {
        if (i === u.uScene.value) return;
        u.uPrev.value = u.uScene.value;
        u.uScene.value = i;
        u.uMix.value = 0;
        controls.querySelectorAll('[data-scene]').forEach(b => {
            const on = Number(b.dataset.scene) === i;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on);
        });
    };
    let auto = false;
    controls.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.scene) setScene(Number(b.dataset.scene));
        if (b.dataset.color) {
            u.uColor.value = Number(b.dataset.color);
            controls.querySelectorAll('[data-color]').forEach(x => {
                x.classList.toggle('is-on', x === b);
                x.setAttribute('aria-pressed', x === b);
            });
        }
        if (b.dataset.ctl === 'auto') {
            auto = !auto;
            b.classList.toggle('is-on', auto);
            b.setAttribute('aria-pressed', auto);
        }
        if (b.dataset.ctl === 'feed') engine.decks.A.play();
    });
    controls.querySelector('[data-ctl="intensity"]').addEventListener('input', e => { u.uIntensity.value = Number(e.target.value); });
    const strobe = controls.querySelector('[data-ctl="strobe"]');
    const strobeOn = v => { u.uStrobe.value = v; strobe.classList.toggle('is-on', !!v); };
    strobe.addEventListener('pointerdown', () => strobeOn(1));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => strobe.addEventListener(ev, () => strobeOn(0)));

    // Tap the screen to cut to the next scene
    canvas.addEventListener('click', () => {
        haptic(12);
        setScene((u.uScene.value + 1) % SCENES.length);
    });

    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

    const clock = new THREE.Clock();
    let lastBass = 0, beatCount = 0, lastBeatT = 0;
    renderer.setAnimationLoop(() => {
        if (!visible) return;
        const t = clock.getElapsedTime();
        u.uTime.value = t;
        const lv = engine.levels();
        const isLive = engine.anyPlaying;
        let bass = lv.bass, mid = lv.mid, high = lv.high;
        if (!isLive) {
            // internal clock at 122 bpm so the screen is never dead
            const ph = (t * 122 / 60) % 1;
            bass = Math.pow(1 - ph, 4) * 0.8;
            mid = 0.3 + 0.2 * Math.sin(t);
            high = 0.25 + 0.25 * Math.sin(t * 3.1);
        }
        u.uBass.value = bass; u.uMid.value = mid; u.uHigh.value = high;

        // crude beat detector for auto cuts
        if (bass - lastBass > 0.12 && t - lastBeatT > 0.3) {
            lastBeatT = t;
            u.uBeat.value = 1;
            if (auto && ++beatCount % 8 === 0) setScene((u.uScene.value + 1 + Math.floor(Math.random() * (SCENES.length - 1))) % SCENES.length);
        }
        u.uBeat.value *= 0.9;
        lastBass = bass;
        u.uMix.value = Math.min(1, u.uMix.value + 0.04);
        if (tiltLive()) u.uTilt.value.lerp(new THREE.Vector2(sensors.tiltX, -sensors.tiltY), 0.15);

        live.textContent = isLive ? 'Live input: booth' : 'Live input: internal clock';
        live.classList.toggle('is-live', isLive);
        renderer.render(scene, camera);
    });
}
