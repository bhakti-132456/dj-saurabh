// Phone sensors: tilt (orientation), shake (motion) and haptics.
// iOS only hands out motion data after a permission prompt fired from a tap,
// so enable() must be called inside a user gesture.

const listeners = { shake: new Set() };

export const sensors = {
    supported: typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches,
    active: false,
    tiltX: 0, // -1 (left) .. 1 (right)
    tiltY: 0, // -1 (towards you) .. 1 (away)
    lastEvent: 0,
};

let baseBeta = null;
let lastShake = 0;

function onOrient(e) {
    if (e.gamma == null) return;
    // Calibrate "flat" to however the phone was held when motion started
    if (baseBeta === null) baseBeta = e.beta;
    sensors.tiltX = Math.max(-1, Math.min(1, e.gamma / 35));
    sensors.tiltY = Math.max(-1, Math.min(1, (e.beta - baseBeta) / 35));
    sensors.lastEvent = performance.now();
}

function onMotion(e) {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    const now = performance.now();
    // gravity alone is ~9.8; a hard shake pushes well past 25
    if (mag > 26 && now - lastShake > 900) {
        lastShake = now;
        listeners.shake.forEach(fn => fn());
    }
}

export async function enableSensors() {
    if (!sensors.supported || sensors.active) return sensors.active;
    try {
        const O = window.DeviceOrientationEvent, M = window.DeviceMotionEvent;
        if (O && typeof O.requestPermission === 'function') {
            if ((await O.requestPermission()) !== 'granted') return false;
        }
        if (M && typeof M.requestPermission === 'function') {
            await M.requestPermission().catch(() => 'denied');
        }
    } catch {
        return false;
    }
    baseBeta = null;
    addEventListener('deviceorientation', onOrient);
    addEventListener('devicemotion', onMotion);
    sensors.active = true;
    document.documentElement.classList.add('has-motion');
    return true;
}

// Android and others hand out motion data without a prompt; switch it on straight away there
export function autoEnableSensors() {
    const O = window.DeviceOrientationEvent;
    if (sensors.supported && !(O && typeof O.requestPermission === 'function')) enableSensors();
}

export function recalibrate() {
    baseBeta = null;
}

export function onShake(fn) {
    listeners.shake.add(fn);
    return () => listeners.shake.delete(fn);
}

export function haptic(pattern = 12) {
    if (navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch { /* not allowed yet */ }
    }
}

// Sensor data is fresh (the phone is actually reporting)
export function tiltLive() {
    return sensors.active && performance.now() - sensors.lastEvent < 1000;
}
