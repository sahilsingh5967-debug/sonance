/**
 * Sonance Visualizer - 60FPS Canvas Spectrum & Waveform Renderer
 * 
 * Performance Optimized: Listens for ANALYSER_READY once, pauses requestAnimationFrame loop when audio is paused.
 */
export class Visualizer {
  /**
   * @param {import('./eventBus.js').EventBus} eventBus 
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.analyserNode = null;

    this.canvas = document.getElementById('visualizer-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.animationId = null;
    this.mode = 'spectrum'; // 'spectrum', 'waveform', 'circular'

    this.initCanvas();
    this.bindEvents();
  }

  initCanvas() {
    if (!this.canvas) return;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
  }

  bindEvents() {
    // Listen for ANALYSER_READY ONCE from audioEngine
    this.eventBus.on('ANALYSER_READY', (analyserNode) => {
      this.analyserNode = analyserNode;
    });

    // Performance Optimization: Pause requestAnimationFrame loop when audio is paused
    this.eventBus.on('PLAYSTATE_CHANGED', ({ isPlaying }) => {
      if (isPlaying) {
        this.startLoop();
      } else {
        this.stopLoop();
      }
    });

    this.eventBus.on('VISUALIZER_MODE_CHANGED', (newMode) => {
      this.mode = newMode;
    });
  }

  startLoop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    const draw = () => {
      this.render();
      if (this.animationId) {
        this.animationId = requestAnimationFrame(draw);
      }
    };
    this.animationId = requestAnimationFrame(draw);
  }

  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.clear();
  }

  clear() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render() {
    if (!this.ctx || !this.canvas || !this.analyserNode) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    if (this.mode === 'waveform') {
      this.renderWaveform(width, height);
    } else if (this.mode === 'circular') {
      this.renderCircular(width, height);
    } else {
      this.renderSpectrum(width, height);
    }
  }

  renderSpectrum(width, height) {
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteFrequencyData(dataArray);

    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height;

      // Electric Violet / Deep Indigo Gradient
      const gradient = this.ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#6366f1');
      gradient.addColorStop(0.5, '#8b5cf6');
      gradient.addColorStop(1, '#a78bfa');

      this.ctx.fillStyle = gradient;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
      this.ctx.fillRect(x, height - barHeight, barWidth, barHeight);

      x += barWidth + 2;
    }
  }

  renderWaveform(width, height) {
    const bufferLength = this.analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteTimeDomainData(dataArray);

    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = '#8b5cf6';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
    this.ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
  }

  renderCircular(width, height) {
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteFrequencyData(dataArray);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.strokeStyle = '#6366f1';
    this.ctx.stroke();

    for (let i = 0; i < bufferLength; i += 4) {
      const angle = (i / bufferLength) * (2 * Math.PI);
      const barLen = (dataArray[i] / 255) * 40;

      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barLen);
      const y2 = centerY + Math.sin(angle) * (radius + barLen);

      this.ctx.strokeStyle = '#8b5cf6';
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
  }
}
