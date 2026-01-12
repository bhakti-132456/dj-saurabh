import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initAnimations() {
    // Hero Text Reveal
    gsap.from('.hero-content h1', {
        duration: 1.5,
        y: 100,
        opacity: 0,
        ease: 'power4.out',
        delay: 0.5
    });

    gsap.from('.hero-content .tagline', {
        duration: 1,
        y: 50,
        opacity: 0,
        ease: 'power3.out',
        delay: 1
    });

    // Example: Animate About Section
    gsap.from('.about-text', {
        scrollTrigger: {
            trigger: '#about',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        duration: 1,
        x: 50,
        opacity: 0
    });

    gsap.from('.about-image', {
        scrollTrigger: {
            trigger: '#about',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        duration: 1,
        x: -50,
        opacity: 0
    });

    // Timeline Items Stagger
    gsap.utils.toArray('.timeline-item').forEach((item, i) => {
        gsap.from(item, {
            scrollTrigger: {
                trigger: item,
                start: 'top 85%',
            },
            duration: 0.8,
            y: 30,
            opacity: 0,
            delay: i * 0.1
        });
    });

    // Gallery Stagger
    gsap.from('.gallery-item', {
        scrollTrigger: {
            trigger: '#gallery',
            start: 'top 70%'
        },
        duration: 0.8,
        y: 50,
        opacity: 0,
        stagger: 0.1
    });

    // Navbar background change on scroll
    const header = document.querySelector('.desktop-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
}
