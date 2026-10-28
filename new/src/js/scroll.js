import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { timeline, venues, lineup, gallery } from './content.js';

gsap.registerPlugin(ScrollTrigger);
// Phones resize the viewport when the address bar hides; don't re-layout pins for that
ScrollTrigger.config({ ignoreMobileResize: true });

const ANY_MOTION = '(prefers-reduced-motion: no-preference)';

export let lenis = null;

export function scrollToTarget(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    else el.scrollIntoView({ behavior: 'smooth' });
}

function initLenis() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);

    document.addEventListener('click', e => {
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        e.preventDefault();
        scrollToTarget(id);
    });
}

function initTopbar() {
    const bar = document.getElementById('topbar');
    const links = [...document.querySelectorAll('.topbar-nav a, .mobile-nav a')];
    ScrollTrigger.create({
        start: 40,
        end: 'max',
        onToggle: self => bar.classList.toggle('is-solid', self.isActive),
    });
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href.startsWith('#')) return; // links to other pages, e.g. the booth
        const sec = document.querySelector(href);
        if (!sec) return;
        ScrollTrigger.create({
            trigger: sec,
            start: 'top 50%',
            end: 'bottom 50%',
            onToggle: self => link.classList.toggle('is-active', self.isActive),
        });
    });
}

function initHeroIntro() {
    const mm = gsap.matchMedia();
    mm.add(ANY_MOTION, () => {
        // Name settles in first, then he rises into place in front of it (once the loader lifts)
        const intro = gsap.timeline({ delay: 0.15, paused: true });
        if (window.__siteReady) intro.play();
        else window.addEventListener('site:ready', () => intro.play(), { once: true });
        intro
            .from('.hero-bg', { opacity: 0, duration: 1.6, ease: 'power2.out' })
            .from('.hero-name img', { y: 40, opacity: 0, duration: 1.2, ease: 'power3.out' }, 0.1)
            .from('.hero-cut picture', { y: 60, opacity: 0, filter: 'blur(10px)', duration: 1.4, ease: 'power3.out', clearProps: 'filter' }, 0.35)
            .from('.hero-line', { y: 24, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.7')
            .from('.hero-ctas .btn', { y: 24, opacity: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out' }, '-=0.5')
            .from('.hero-now', { opacity: 0, duration: 0.8 }, '-=0.4');

        // Hero type lifts away as you leave
        gsap.to('.hero-inner', {
            yPercent: -30, opacity: 0, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });
    });
}

function initFacts() {
    document.querySelectorAll('[data-count]').forEach(el => {
        const to = Number(el.dataset.count);
        const from = el.hasAttribute('data-plain') ? to - 13 : 0;
        const obj = { v: from };
        el.textContent = from;
        ScrollTrigger.create({
            trigger: el,
            start: 'top 85%',
            once: true,
            onEnter: () => gsap.to(obj, {
                v: to, duration: 1.6, ease: 'power3.out',
                onUpdate: () => { el.textContent = Math.round(obj.v); },
            }),
        });
    });
}

function initStory() {
    const h = document.querySelector('[data-split]');
    if (h) {
        h.innerHTML = h.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
        const mm = gsap.matchMedia();
        mm.add(ANY_MOTION, () => {
            gsap.to(h.querySelectorAll('.w'), {
                opacity: 1, stagger: 0.1, ease: 'none',
                scrollTrigger: { trigger: h, start: 'top 85%', end: 'bottom 45%', scrub: true },
            });
        });
        mm.add('(prefers-reduced-motion: reduce)', () => {
            h.querySelectorAll('.w').forEach(w => { w.style.opacity = 1; });
        });
    }
    gsap.matchMedia().add(ANY_MOTION, () => {
        gsap.fromTo('.story-media img', { yPercent: -12 }, {
            yPercent: 0, ease: 'none',
            scrollTrigger: { trigger: '.story-media', start: 'top bottom', end: 'bottom top', scrub: true },
        });
        gsap.from('.story-media', {
            clipPath: 'inset(18% 18% 18% 18%)', ease: 'power2.out',
            scrollTrigger: { trigger: '.story-media', start: 'top 90%', end: 'top 35%', scrub: true },
        });
    });
}

function buildWave(svg) {
    // A deterministic waveform, drawn as bars, two layers: dim and played (red)
    const bars = 180;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let d = '';
    for (let i = 0; i < bars; i++) {
        const env = 0.35 + 0.65 * Math.abs(Math.sin(i / 17)) * (0.6 + 0.4 * Math.sin(i / 5.3));
        const hgt = Math.max(0.06, env * (0.55 + rnd() * 0.45));
        const x = i * (1000 / bars);
        d += `M${x.toFixed(1)} ${50 - hgt * 48}V${50 + hgt * 48}`;
    }
    svg.setAttribute('viewBox', '0 0 1000 100');
    svg.innerHTML = `
      <defs><clipPath id="played"><rect id="playedRect" x="0" y="0" width="0" height="100"/></clipPath></defs>
      <path d="${d}" stroke="rgba(243,237,228,0.22)" stroke-width="3"/>
      <path d="${d}" stroke="#e3120b" stroke-width="3" clip-path="url(#played)"/>`;
    return svg.querySelector('#playedRect');
}

function initTimeline() {
    const track = document.getElementById('timelineTrack');
    if (!track) return;
    track.innerHTML = timeline.map(t => `
      <li class="tl-item${t.now ? ' is-now' : ''}">
        ${t.photo ? `<img class="tl-photo" src="/media/${t.photo}-900.webp" alt="" decoding="async">` : ''}
        <span class="tl-when">${t.when}</span>
        <span class="tl-where">${t.where}</span>
        <span class="tl-what">${t.what}</span>
      </li>`).join('');
    const playedRect = buildWave(document.getElementById('waveSvg'));
    const playhead = document.getElementById('playhead');

    const mm = gsap.matchMedia();
    mm.add(ANY_MOTION, () => {
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
        gsap.to(track, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
                trigger: '.timeline',
                pin: '.timeline-pin',
                start: 'top top',
                end: () => '+=' + (distance() + window.innerHeight * 0.4),
                scrub: 0.6,
                invalidateOnRefresh: true,
                onUpdate: self => {
                    const p = self.progress;
                    playedRect.setAttribute('width', 1000 * p);
                    playhead.style.left = `${p * 100}%`;
                },
            },
        });
    });
}

function initCrate() {
    const rack = document.getElementById('crateRack');
    const stage = document.getElementById('crateStage');
    if (!rack) return;
    const themes = ['t-red', 't-ink', 't-paper'];
    rack.innerHTML = venues.map((v, i) => `
      <div class="sleeve ${themes[i % 3]}" role="group" aria-label="${v.name}, ${v.city}">
        <span class="sleeve-city">${v.city}</span>
        <span class="sleeve-name">${v.name}</span>
        <span class="sleeve-count">${i + 1} / ${venues.length}</span>
      </div>`).join('');
    const sleeves = [...rack.children];
    let active = 0;

    const layout = () => {
        sleeves.forEach((s, i) => {
            const d = i - active;
            if (d < 0) {
                // flipped forward, out of the way
                s.style.transform = `translate3d(0, 30%, 160px) rotateX(-96deg)`;
                s.style.opacity = d < -2 ? 0 : 1;
            } else {
                s.style.transform = `translate3d(0, ${-d * 5}%, ${-d * 70}px) rotateX(${d === 0 ? 0 : 6}deg)`;
                s.style.opacity = d > 6 ? 0 : 1;
            }
            s.style.zIndex = String(100 - Math.abs(d));
        });
    };
    const go = i => {
        const n = Math.max(0, Math.min(sleeves.length - 1, i));
        if (n !== active) { active = n; layout(); }
    };
    layout();

    // Drag or swipe through the crate on any device
    let startY = null, startX = null, startActive = 0;
    stage.addEventListener('pointerdown', e => {
        startY = e.clientY; startX = e.clientX; startActive = active;
        stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', e => {
        if (startY === null) return;
        const dy = startY - e.clientY, dx = startX - e.clientX;
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        go(startActive + Math.round(delta / 60));
    });
    const up = e => {
        if (startY !== null && Math.abs(e.clientY - startY) < 6 && Math.abs(e.clientX - startX) < 6) {
            go(active + 1 >= sleeves.length ? 0 : active + 1);
            if (active === 0) layout();
        }
        startY = null;
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', () => { startY = null; });

    const mm = gsap.matchMedia();
    mm.add(ANY_MOTION, () => {
        ScrollTrigger.create({
            trigger: '.crate',
            start: 'top top',
            end: () => '+=' + window.innerHeight * 1.6,
            pin: true,
            onUpdate: self => go(Math.round(self.progress * (sleeves.length - 1))),
        });
    });
}

function initLineup() {
    const ul = document.getElementById('lineupPoster');
    if (!ul) return;
    // An event flier: headliners on top, then each tier below, every row justified to the
    // full width (so the type steps down as rows get longer), names split by small dots
    let rows = [];
    const build = () => {
        const narrow = innerWidth < 600;
        const limits = narrow ? [16, 26, 36] : [20, 36, 50]; // characters per row, by tier
        const groups = [];
        lineup.forEach((tier, t) => {
            // spread the tier over just enough rows, longest names first into the emptiest
            // row, so a tier's rows come out about the same length (and so the same size)
            const len = n => n.length + 2;
            const total = tier.reduce((sum, n) => sum + len(n), 0);
            const count = Math.min(tier.length, Math.ceil(total / limits[t]));
            const bins = Array.from({ length: count }, () => ({ names: [], chars: 0 }));
            [...tier].sort((a, b) => b.length - a.length).forEach(n => {
                const bin = bins.reduce((m, x) => (x.chars < m.chars ? x : m));
                bin.names.push(n);
                bin.chars += len(n);
            });
            // keep the original billing order inside each row; shortest (biggest) row first
            bins.forEach(b => b.names.sort((x, y) => tier.indexOf(x) - tier.indexOf(y)));
            bins.sort((x, y) => x.chars - y.chars).forEach(b => groups.push([t, b.names]));
        });
        ul.innerHTML = groups.map(([t, g]) => `<li class="tier-${t + 1}">${g.map(n => `<span data-w="1">${n}</span>`)
            .join('<i class="sep" data-w="0.6" aria-hidden="true">•</i>')}</li>`).join('');
        rows = [...ul.children];
        fit();
    };
    const fit = () => {
        const cs = getComputedStyle(ul);
        const w = ul.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        rows.forEach(r => {
            const spans = [...r.children]; // names and the dots between them
            const ws = spans.map(sp => Number(sp.dataset.w));
            // width of each name at 100px, then solve for the row scale that fills the line
            spans.forEach(sp => { sp.style.fontSize = '100px'; });
            const nat = spans.map(sp => sp.getBoundingClientRect().width);
            const gap = 0.16 * 100; // space either side of a dot
            const unit = nat.reduce((sum, n, i) => sum + n * ws[i], 0) + gap * (spans.length - 1);
            let scale = Math.min((w - 2) / unit, (w * 0.3) / (100 * Math.max(...ws)));
            const set = () => spans.forEach((sp, i) => { sp.style.fontSize = `${(100 * ws[i] * scale).toFixed(2)}px`; });
            set();
            // type doesn't scale perfectly linearly: correct the last few pixels with a second pass
            const used = spans.reduce((sum, sp) => sum + sp.getBoundingClientRect().width, 0) + gap * scale * (spans.length - 1);
            if (used > 0 && scale < (w * 0.3) / (100 * Math.max(...ws))) { scale *= (w - 0.5) / used; set(); }
        });
    };
    build();
    document.fonts?.ready.then(fit);
    let lastW = innerWidth;
    addEventListener('resize', () => {
        if (innerWidth === lastW) return;
        const regroup = (innerWidth < 600) !== (lastW < 600);
        lastW = innerWidth;
        regroup ? build() : fit();
    });

    gsap.matchMedia().add(ANY_MOTION, () => {
        gsap.from(rows, {
            yPercent: 40, opacity: 0, duration: 0.9, ease: 'power4.out', stagger: 0.05,
            scrollTrigger: { trigger: ul, start: 'top 80%' },
        });
        // A slow ripple runs through the names as the page scrolls; vertical only, so the
        // block's edges stay straight
        const wave = ScrollTrigger.create({
            trigger: ul, start: 'top bottom', end: 'bottom top',
            onUpdate: self => {
                let k = 0;
                rows.forEach((r, i) => [...r.children].forEach(el => {
                    const ph = self.progress * Math.PI * 5 - i * 0.6 - k++ * 0.35;
                    el.style.translate = `0 ${(Math.sin(ph) * 0.045).toFixed(3)}em`;
                }));
            },
        });
        return () => { wave.kill(); rows.forEach(r => [...r.children].forEach(el => { el.style.translate = ''; })); };
    });
}

function initGallery() {
    const strip = document.getElementById('galleryStrip');
    if (!strip) return;
    strip.innerHTML = gallery.map((g, i) => `
      <button class="g-item is-${g.shape}" data-full="/media/${g.src}-1800.webp" aria-label="Open photo: ${g.alt}">
        <img src="/media/${g.src}-900.webp" alt="${g.alt}" decoding="async">
      </button>`).join('');
    const items = [...strip.children];

    const mm = gsap.matchMedia();
    mm.add(ANY_MOTION, () => {
        const distance = () => Math.max(0, strip.scrollWidth - window.innerWidth);
        const depth = () => {
            const cx = window.innerWidth / 2;
            const k = window.innerWidth < 900 ? 0.6 : 1; // gentler on phones
            items.forEach(el => {
                const r = el.getBoundingClientRect();
                const off = Math.max(-1.5, Math.min(1.5, (r.left + r.width / 2 - cx) / cx)); // 0 at the centre
                const a = Math.abs(off);
                // overlapping stack: the photo nearest the centre comes forward and sits on top,
                // its neighbours turn away, shrink and dim behind it
                el.style.zIndex = 100 - Math.round(a * 60);
                el.style.transform = `perspective(1400px) rotateY(${off * -14 * k}deg) scale(${1 - Math.min(a, 1) * 0.22 * k})`;
                el.style.setProperty('--dim', (Math.min(a, 1) * 0.6 * k).toFixed(3));
            });
        };
        strip.addEventListener('scroll', depth, { passive: true }); // phones swipe the strip itself
        requestAnimationFrame(depth);
        gsap.to(strip, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
                trigger: '.gallery',
                pin: '.gallery-pin',
                start: 'top top',
                end: () => '+=' + distance(),
                scrub: 0.6,
                invalidateOnRefresh: true,
                onUpdate: depth,
                onRefresh: depth,
            },
        });
        return () => {
            strip.removeEventListener('scroll', depth);
            items.forEach(el => { el.style.transform = ''; el.style.zIndex = ''; el.style.removeProperty('--dim'); });
        };
    });

    const box = document.getElementById('lightbox');
    const img = box.querySelector('img');
    const close = () => { box.hidden = true; lenis?.start(); };
    strip.addEventListener('click', e => {
        const b = e.target.closest('.g-item');
        if (!b) return;
        img.src = b.dataset.full;
        img.alt = b.querySelector('img').alt;
        box.hidden = false;
        lenis?.stop();
    });
    box.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });
}

function initSectionReveals() {
    gsap.matchMedia().add(ANY_MOTION, () => {
        gsap.utils.toArray('.crate-head h2, .booth-head h2, .visuals-head h2, .book-intro h2, .lineup-title').forEach(h => {
            gsap.from(h, {
                clipPath: 'inset(0 0 100% 0)', y: 40, duration: 1, ease: 'power4.out',
                scrollTrigger: { trigger: h, start: 'top 88%' },
            });
        });
    });
}

export function initScroll() {
    initLenis();
    initTopbar();
    initHeroIntro();
    initFacts();
    initStory();
    initTimeline();
    initCrate();
    initLineup();
    initGallery();
    initSectionReveals();
    window.addEventListener('load', () => ScrollTrigger.refresh());
}
