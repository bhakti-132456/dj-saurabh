import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { engine } from './audio.js';
import { sensors, tiltLive } from './sensors.js';

// The booth: a ^-shaped table, DJ console on the left arm, VJ console on the right,
// an LED wall behind and moving-head lights above. Everything is built in code.
const RED = 0xe3120b;

function box(w, h, d, mat) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

export function createWorld(canvas, vj) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const tier = coarse || (navigator.hardwareConcurrency || 4) <= 4 ? 'low' : 'high';

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === 'high', powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier === 'high' ? 1.75 : 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050404);
    scene.fog = new THREE.FogExp2(0x070505, 0.07);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);

    // Light
    scene.add(new THREE.HemisphereLight(0x8a5a5a, 0x100808, 1.1));
    const key = new THREE.SpotLight(RED, 40, 14, 0.7, 0.6);
    key.position.set(0, 5, 2);
    key.target.position.set(0, 0.9, -0.4);
    scene.add(key, key.target);
    const wallGlow = new THREE.PointLight(RED, 8, 9);
    wallGlow.position.set(0, 2.6, -2.6);
    scene.add(wallGlow);

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 0.35, metalness: 0.4 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // LED wall shows the VJ output live
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.06), vj.material);
    wall.position.set(0, 3, -3.8);
    scene.add(wall);
    const frame = box(9.3, 5.36, 0.1, new THREE.MeshStandardMaterial({ color: 0x0a0909, roughness: 0.8 }));
    frame.position.set(0, 3, -3.88);
    scene.add(frame);

    // ^-shaped table: two arms meeting at an apex away from the viewer
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x2a2020, roughness: 0.5, metalness: 0.25 });
    const strip = new THREE.MeshBasicMaterial({ color: RED, toneMapped: false });
    const apex = new THREE.Vector3(0, 0, -1.1);
    const L = 2.7, H = 0.95, D = 0.8;
    const arms = {};
    for (const side of [-1, 1]) {
        const dir = new THREE.Vector3(side * 0.82, 0, 0.57).normalize();
        const n = new THREE.Vector3(-side * 0.57, 0, 0.82).normalize(); // faces the inside of the ^
        const c = apex.clone().addScaledVector(dir, L / 2);
        const g = new THREE.Group();
        g.position.set(c.x, 0, c.z);
        g.rotation.y = Math.atan2(n.x, n.z);
        const body = box(L, H, D, tableMat);
        body.position.y = H / 2;
        const led = box(L, 0.025, 0.02, strip);
        led.position.set(0, H - 0.04, D / 2 + 0.005);
        g.add(body, led);
        scene.add(g);
        arms[side] = { g, n, top: new THREE.Vector3(c.x, H, c.z) };
    }
    new THREE.TextureLoader().load('/logo-hd.png', t => {
        t.colorSpace = THREE.SRGBColorSpace;
        const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.32),
            new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
        logo.position.set(0, 0.55, -0.62);
        scene.add(logo);
    });

    // DJ controller on the left arm
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d1818, roughness: 0.4, metalness: 0.5 });
    const ring = new THREE.MeshBasicMaterial({ color: RED, toneMapped: false });
    const padMat = () => new THREE.MeshBasicMaterial({ color: 0x3a0a08, toneMapped: false });
    const dj = new THREE.Group();
    dj.add(box(1.5, 0.06, 0.62, dark));
    const jogs = [], pads = [];
    for (const s of [-1, 1]) {
        const jog = new THREE.Group();
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 40), new THREE.MeshStandardMaterial({ color: 0x0e0c0c, roughness: 0.3, metalness: 0.7 }));
        const glow = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.007, 8, 48), ring);
        glow.rotation.x = Math.PI / 2;
        glow.position.y = 0.017;
        const mark = box(0.012, 0.005, 0.12, new THREE.MeshBasicMaterial({ color: 0xf3ede4 }));
        mark.position.set(0, 0.018, -0.08);
        jog.add(plate, glow, mark);
        jog.position.set(s * 0.46, 0.045, -0.06);
        dj.add(jog);
        jogs.push(jog);
        for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
            const p = box(0.055, 0.012, 0.045, padMat());
            p.position.set(s * 0.46 + (i - 1.5) * 0.07, 0.036, 0.17 + r * 0.06);
            dj.add(p);
            pads.push(p);
        }
    }
    for (const x of [-0.07, 0.07]) {
        const f = box(0.02, 0.03, 0.16, dark);
        f.position.set(x, 0.04, 0.1);
        dj.add(f);
        for (let k = 0; k < 3; k++) {
            const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x2c2525 }));
            knob.position.set(x, 0.045, -0.2 + k * 0.07);
            dj.add(knob);
        }
    }
    placeOn(dj, arms[-1], 0.15);

    // VJ station on the right arm: laptop showing the output, plus a pad grid
    const vjg = new THREE.Group();
    const base = box(0.6, 0.02, 0.42, dark);
    base.position.x = -0.3;
    const screen = new THREE.Group();
    const lid = box(0.6, 0.38, 0.01, dark);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.33), vj.material);
    disp.position.z = 0.006;
    screen.add(lid, disp);
    screen.position.set(-0.3, 0.19, -0.2);
    screen.rotation.x = -0.25;
    const grid = box(0.42, 0.04, 0.42, dark);
    grid.position.x = 0.32;
    vjg.add(base, screen, grid);
    const vjPads = [];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) {
        const p = box(0.07, 0.012, 0.07, padMat());
        p.position.set(0.32 + (i - 1.5) * 0.09, 0.026, (r - 1.5) * 0.09);
        vjg.add(p);
        vjPads.push(p);
    }
    placeOn(vjg, arms[1], -0.15);

    function placeOn(obj, arm, shift) {
        // sit on the arm top, nudged along the arm towards the viewer
        const along = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), arm.n).normalize();
        obj.position.copy(arm.top).addScaledVector(along, shift).addScaledVector(arm.n, 0.02);
        obj.position.y = H;
        obj.rotation.y = arm.g.rotation.y;
        scene.add(obj);
    }

    // Moving heads: additive beams on a truss above the wall
    const beams = [];
    const beamMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uI: { value: 0.5 } },
        vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform float uI; varying float vY; void main(){ gl_FragColor = vec4(vec3(0.95,0.12,0.06) * pow(vY, 2.2) * uI, 1.0); }',
    });
    const count = tier === 'high' ? 4 : 2;
    for (let i = 0; i < count; i++) {
        const pivot = new THREE.Group();
        pivot.position.set((i - (count - 1) / 2) * 2.6, 5.6, -2.8);
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.8, 8, 24, 1, true), beamMat);
        cone.position.y = -4;
        pivot.add(cone);
        scene.add(pivot);
        beams.push(pivot);
    }

    // Post: bloom on capable devices only
    let composer = null;
    if (tier === 'high') {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.4, 0.82));
        composer.addPass(new OutputPass());
    }

    // Camera views
    const views = {
        far: { pos: new THREE.Vector3(0, 3.4, 9), look: new THREE.Vector3(0, 2, -2) },
        overview: { pos: new THREE.Vector3(0, 1.95, 3.2), look: new THREE.Vector3(0, 1.25, -1.3) },
        dj: view(dj, arms[-1].n),
        vj: view(vjg, arms[1].n),
    };
    function view(obj, n) {
        const look = obj.position.clone().add(new THREE.Vector3(0, 0.05, 0));
        const pos = look.clone().addScaledVector(n, 1.15).add(new THREE.Vector3(0, 1.05, 0));
        // keep the LED wall in the back of the shot
        look.lerp(new THREE.Vector3(0, 2.4, -3.8), 0.18);
        return { pos, look };
    }
    const look = views.far.look.clone();
    camera.position.copy(views.far.pos);
    let current = 'far';
    const fly = (name, duration = 1.6) => {
        current = name;
        const v = views[name];
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const d = reduced ? 0 : duration;
        gsap.to(camera.position, { x: v.pos.x, y: v.pos.y, z: v.pos.z, duration: d, ease: 'power3.inOut' });
        gsap.to(look, { x: v.look.x, y: v.look.y, z: v.look.z, duration: d, ease: 'power3.inOut' });
    };

    // Picking: tap or click a console to enter it
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pickTargets = [[dj, 'dj'], [vjg, 'vj'], [arms[-1].g, 'dj'], [arms[1].g, 'vj']];
    const pick = (x, y) => {
        const r = canvas.getBoundingClientRect();
        ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        for (const [obj, name] of pickTargets) if (ray.intersectObject(obj, true).length) return name;
        return null;
    };

    // Screen positions of the two consoles, for the HTML hotspots
    const tmp = new THREE.Vector3();
    const screenPos = name => {
        tmp.copy((name === 'dj' ? dj : vjg).position).project(camera);
        const r = canvas.getBoundingClientRect();
        return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height, visible: tmp.z < 1 };
    };

    const resize = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        renderer.setSize(w, h, false);
        composer?.setSize(w, h);
        camera.aspect = w / h;
        // narrow screens: widen the lens so both arms stay in frame
        camera.fov = w / h < 1 ? 68 : 50;
        camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas);
    resize();

    const clock = new THREE.Clock();
    let running = true;
    document.addEventListener('visibilitychange', () => { running = !document.hidden; });
    const drift = new THREE.Vector2();
    let pointer = new THREE.Vector2();
    canvas.addEventListener('pointermove', e => {
        const r = canvas.getBoundingClientRect();
        pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    }, { passive: true });

    renderer.setAnimationLoop(() => {
        if (!running) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        const lv = vj.update(t);

        // the room answers the music
        const kick = lv.bass;
        strip.color.setRGB(0.35 + kick * 1.6, 0.03, 0.02);
        ring.color.setRGB(0.5 + kick * 1.5, 0.05, 0.03);
        wallGlow.intensity = 3 + kick * 8;
        key.intensity = 25 + kick * 40;
        beamMat.uniforms.uI.value = (lv.live ? 0.14 : 0.08) + kick * 0.35;
        beams.forEach((b, i) => {
            b.rotation.z = Math.sin(t * 0.5 + i * 1.7) * 0.5;
            b.rotation.x = 0.35 + Math.sin(t * 0.37 + i) * 0.25;
        });
        if (lv.beat) {
            pads.forEach(p => p.material.color.setHex(Math.random() < 0.35 ? RED : 0x3a0a08));
            vjPads.forEach(p => p.material.color.setHex(Math.random() < 0.3 ? 0xf3ede4 : 0x3a0a08));
        }
        jogs.forEach((j, i) => {
            const d = engine.decks[i ? 'B' : 'A'];
            if (d?.playing) j.rotation.y -= dt * (Math.PI * 2 / 1.8) * d.rate;
        });

        // gentle drift from the mouse or phone tilt
        const tx = tiltLive() ? sensors.tiltX : pointer.x;
        const ty = tiltLive() ? sensors.tiltY : pointer.y;
        drift.lerp(new THREE.Vector2(tx, ty), 0.04);
        camera.lookAt(look.x + drift.x * 0.25, look.y - drift.y * 0.15, look.z);

        if (composer) composer.render(); else renderer.render(scene, camera);
    });

    return { fly, pick, screenPos, get current() { return current; }, tier };
}
