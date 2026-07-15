/* ========================================================
   EDIT VIDEO AI HD68 — Effects & Filters Module
   ======================================================== */

'use strict';

const Effects = (() => {

  // CSS filter strings for each named filter
  const FILTERS = {
    none:      '',
    cinematic: 'contrast(1.1) saturate(0.8) brightness(0.9)',
    vintage:   'sepia(0.5) contrast(1.1) brightness(0.95) saturate(0.8)',
    neon:      'saturate(2) contrast(1.3) brightness(1.1) hue-rotate(20deg)',
    bw:        'grayscale(1) contrast(1.2)',
    warm:      'sepia(0.3) saturate(1.4) brightness(1.05)',
    cool:      'saturate(0.9) brightness(1.05) hue-rotate(-20deg)',
    dramatic:  'contrast(1.5) saturate(0.6) brightness(0.8)',
  };

  let currentFilter = 'none';

  function applyFilterToVideo(filterName) {
    const video = document.getElementById('main-video');
    if (!video) return;
    currentFilter = filterName;
    video.style.filter = FILTERS[filterName] || '';
    // Sync color preview
    const colorVideo = document.getElementById('color-preview-video');
    if (colorVideo) colorVideo.style.filter = FILTERS[filterName] || '';
  }

  function applyColorAdjustments(settings) {
    const video = document.getElementById('main-video');
    if (!video) return;
    const { brightness, contrast, saturation, hue } = settings;
    const base = FILTERS[currentFilter] || '';
    const adj = `brightness(${1 + brightness/100}) contrast(${1 + contrast/100}) saturate(${1 + saturation/100}) hue-rotate(${hue}deg)`;
    video.style.filter = `${base} ${adj}`.trim();
  }

  function drawColorWheel(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w/2, cy = h/2, r = Math.min(w,h)/2 - 2;

    // Draw hue wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `hsl(${angle}, 0%, 100%)`);
      grad.addColorStop(1, `hsl(${angle}, 100%, 50%)`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Dark overlay in center
    const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    centerGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
    centerGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = centerGrad;
    ctx.fill();
  }

  function drawWaveform(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(10,10,20,0.8)';
    ctx.fillRect(0, 0, w, h);

    // Draw RGB waveforms
    const colors = ['rgba(239,68,68,0.7)', 'rgba(34,197,94,0.7)', 'rgba(59,130,246,0.7)'];
    colors.forEach((color, ci) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (let x = 0; x < w; x++) {
        const noise = Math.random() * 0.3;
        const wave = Math.sin(x * 0.05 + ci * 2.1) * 0.3 + Math.sin(x * 0.02 + ci) * 0.2 + 0.5 + noise;
        const y = h - wave * h * 0.7 - 10;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * h / 4);
      ctx.lineTo(w, i * h / 4);
      ctx.stroke();
    }
  }

  function drawCurvesCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i*w/4, 0); ctx.lineTo(i*w/4, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*h/4); ctx.lineTo(w, i*h/4); ctx.stroke();
    }

    // Diagonal reference
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.stroke();
    ctx.setLineDash([]);

    // S-curve
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(167,139,250,0.9)';
    ctx.lineWidth = 2;
    ctx.moveTo(0, h);
    ctx.bezierCurveTo(w*0.3, h*0.85, w*0.5, h*0.35, w*0.7, h*0.15);
    ctx.lineTo(w, 0);
    ctx.stroke();

    // Control points
    [[w*0.3, h*0.7], [w*0.7, h*0.3]].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI*2);
      ctx.fillStyle = '#a78bfa';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  function animateAudioWaveform(canvas, analyser) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    function draw() {
      requestAnimationFrame(draw);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(10,10,22,0.5)';
      ctx.fillRect(0, 0, w, h);

      // Fake animated waveform
      const bars = 80;
      const barW = w / bars - 1;
      for (let i = 0; i < bars; i++) {
        const amp = (Math.sin(i * 0.3 + Date.now() * 0.003) * 0.5 + 0.5) *
                    (Math.sin(i * 0.1 + Date.now() * 0.002) * 0.3 + 0.7);
        const barH = amp * h * 0.85;
        const x = i * (barW + 1);
        const y = (h - barH) / 2;

        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, 'rgba(124,58,237,0.9)');
        grad.addColorStop(0.5, 'rgba(6,182,212,0.9)');
        grad.addColorStop(1, 'rgba(124,58,237,0.9)');
        ctx.fillStyle = grad;

        const radius = Math.min(barW/2, 3);
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, radius);
        ctx.fill();
      }
    }
    draw();
  }

  function drawRuler(container, durationSecs, zoom) {
    const ruler = document.getElementById('timeline-ruler');
    if (!ruler) return;
    ruler.innerHTML = '';
    const step = durationSecs > 60 ? 10 : durationSecs > 20 ? 5 : 2;
    const pixelsPerSec = 80 * (zoom / 100);
    for (let t = 0; t <= durationSecs; t += step) {
      const mark = document.createElement('div');
      mark.className = 'ruler-mark';
      mark.style.left = (t * pixelsPerSec) + 'px';
      mark.textContent = formatTime(t);
      ruler.appendChild(mark);
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2,'0')}`;
  }

  // Particle system for splash screen
  function createSplashParticles() {
    const container = document.getElementById('splash-particles');
    if (!container) return;
    const count = 60;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      const size = Math.random() * 3 + 1;
      const x = Math.random() * 100;
      const delay = Math.random() * 5;
      const duration = Math.random() * 6 + 4;
      const opacity = Math.random() * 0.5 + 0.1;
      const colors = ['#7c3aed','#06b6d4','#ec4899','#a78bfa','#22d3ee'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      p.style.cssText = `
        position:absolute; width:${size}px; height:${size}px;
        border-radius:50%; background:${color};
        left:${x}%; bottom:-10px;
        opacity:${opacity};
        animation: particleRise ${duration}s ${delay}s ease-in infinite;
        box-shadow: 0 0 ${size*3}px ${color};
      `;
      container.appendChild(p);
    }

    // Add keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes particleRise {
        0% { transform: translateY(0) scale(1); opacity: var(--op,0.3); }
        50% { opacity: 0.6; }
        100% { transform: translateY(-110vh) scale(0); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  return {
    applyFilter: applyFilterToVideo,
    applyColorAdjustments,
    drawColorWheel,
    drawWaveform,
    drawCurvesCanvas,
    animateAudioWaveform,
    drawRuler,
    createSplashParticles,
    FILTERS,
    formatTime,
  };

})();
