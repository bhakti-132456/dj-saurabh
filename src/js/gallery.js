export function initGallery() {
    // SimpleLightbox initialization logic (simulated for vanilla JS)
    const items = document.querySelectorAll('.gallery-item');

    // Create Lightbox Container if it doesn't exist
    let lightbox = document.getElementById('lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'lightbox';
        lightbox.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.95);
      z-index: 2000;
      display: none;
      justify-content: center;
      align-items: center;
      opacity: 0;
      transition: opacity 0.3s;
    `;
        const img = document.createElement('img');
        img.style.cssText = `
       max-width: 90%;
       max-height: 90%;
       box-shadow: 0 0 50px rgba(0,0,0,0.5);
       transform: scale(0.9);
       transition: transform 0.3s;
    `;
        lightbox.appendChild(img);

        // Close on click
        lightbox.addEventListener('click', () => {
            lightbox.style.opacity = '0';
            lightbox.querySelector('img').style.transform = 'scale(0.9)';
            setTimeout(() => lightbox.style.display = 'none', 300);
        });

        document.body.appendChild(lightbox);
    }

    items.forEach(item => {
        item.addEventListener('click', (e) => {
            const src = item.querySelector('img').src;
            const lightboxImg = lightbox.querySelector('img');
            lightboxImg.src = src;
            lightbox.style.display = 'flex';
            setTimeout(() => {
                lightbox.style.opacity = '1';
                lightboxImg.style.transform = 'scale(1)';
            }, 10);
        });
    });

    // Keep horizontal scroll logic for desktop feel
    const scroller = document.querySelector('.gallery-scroller-wrapper');
    if (scroller) {
        let isDown = false;
        let startX;
        let scrollLeft;

        scroller.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - scroller.offsetLeft;
            scrollLeft = scroller.scrollLeft;
        });
        scroller.addEventListener('mouseleave', () => { isDown = false; });
        scroller.addEventListener('mouseup', () => { isDown = false; });
        scroller.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - scroller.offsetLeft;
            const walk = (x - startX) * 2;
            scroller.scrollLeft = scrollLeft - walk;
        });
    }
}
