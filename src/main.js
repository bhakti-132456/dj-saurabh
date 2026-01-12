import { initAnimations } from './js/animations.js';
import { initBookingForm } from './js/booking.js';
import { initGallery } from './js/gallery.js';
import { MusicPlayer } from './js/player.js';

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initAnimations();
    initBookingForm();
    initGallery();

    // Initialize Music Player
    const player = new MusicPlayer();

    // Mobile Navigation Active State
    const sections = document.querySelectorAll('section');
    const navItems = document.querySelectorAll('.mobile-nav .nav-item');

    window.addEventListener('scroll', () => {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - sectionHeight / 3)) {
                current = section.getAttribute('id');
            }
        });

        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-section') === current) {
                item.classList.add('active');
            }
        });
    });
});
