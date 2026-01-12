export class MusicPlayer {
    constructor() {
        this.audio = document.getElementById('audioElement');
        this.playBtn = document.getElementById('playBtn');
        this.enterBtn = document.getElementById('enterExperience');
        this.player = document.getElementById('musicPlayer');
        this.closeBtn = document.getElementById('closePlayer');
        this.toggleBtn = document.getElementById('musicToggle');

        this.heroCanvas = document.getElementById('heroVisualizer');
        this.playerCanvas = document.getElementById('playerVisualizer');

        this.isPlaying = false;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;

        this.init();
    }

    init() {
        // UI Event Listeners
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.enterBtn.addEventListener('click', () => {
            this.togglePlay();
        });

        this.closeBtn.addEventListener('click', () => {
            this.player.classList.add('minimized');
        });

        this.toggleBtn.addEventListener('click', () => {
            this.player.classList.remove('minimized');
        });

        // Resize listener for canvas
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }

    resizeCanvas() {
        if (this.heroCanvas) {
            this.heroCanvas.width = window.innerWidth;
            this.heroCanvas.height = window.innerHeight;
        }
        if (this.playerCanvas) {
            this.playerCanvas.width = this.playerCanvas.clientWidth;
            this.playerCanvas.height = this.playerCanvas.clientHeight;
        }
    }

    initAudioContext() {
        if (this.audioContext) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.analyser = this.audioContext.createAnalyser();

        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        this.analyser.fftSize = 256;
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);

        this.animate();
    }

    togglePlay() {
        if (!this.audioContext) {
            this.initAudioContext();
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        if (this.isPlaying) {
            this.audio.pause();
            this.playBtn.textContent = '▶';
            this.enterBtn.textContent = 'Enter Experience';
        } else {
            this.audio.play();
            this.playBtn.textContent = '⏸';
            this.enterBtn.textContent = 'Pause Music';
        }
        this.isPlaying = !this.isPlaying;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.analyser.getByteFrequencyData(this.dataArray);

        this.drawHeroVisualizer();
        this.drawPlayerVisualizer();
    }

    drawHeroVisualizer() {
        if (!this.heroCanvas) return;
        const ctx = this.heroCanvas.getContext('2d');
        const width = this.heroCanvas.width;
        const height = this.heroCanvas.height;

        ctx.clearRect(0, 0, width, height);

        const barWidth = (width / this.dataArray.length) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < this.dataArray.length; i++) {
            barHeight = this.dataArray[i] * 1.5; // Scale up

            // Red color responsive to frequency
            const r = barHeight + (25 * (i / this.dataArray.length));
            const g = 0;
            const b = 0;
            const a = 0.5;

            ctx.fillStyle = `rgba(209, 72, 54, ${barHeight / 500})`; // Using theme red
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);

            // Reflection for "Alive" feel
            ctx.fillStyle = `rgba(209, 72, 54, ${barHeight / 1500})`;
            ctx.fillRect(x, height - barHeight - 10, barWidth, barHeight);

            x += barWidth + 1;
        }
    }

    drawPlayerVisualizer() {
        if (!this.playerCanvas) return;
        const ctx = this.playerCanvas.getContext('2d');
        const width = this.playerCanvas.width;
        const height = this.playerCanvas.height;

        ctx.clearRect(0, 0, width, height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#D14836';
        ctx.beginPath();

        const sliceWidth = width * 1.0 / this.dataArray.length;
        let x = 0;

        for (let i = 0; i < this.dataArray.length; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = v * height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
    }
}
