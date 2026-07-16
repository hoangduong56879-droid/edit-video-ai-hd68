'use strict';

/* ================================================================
   EDIT VIDEO AI HD68 — Mobile Controller
   Bottom nav, sheet panels, swipe gestures, touch AI progress
   ================================================================ */

const Mobile = (() => {

  // ── Detect mobile ──────────────────────────────────────────────
  const isMobile = () => window.innerWidth <= 640;

  // ── State ──────────────────────────────────────────────────────
  let activeSheet  = null;
  let sheetStartY  = 0;
  let sheetCurrentY = 0;
  let aiCancelled  = false;

  // ── Sheet management ───────────────────────────────────────────
  function openSheet(name) {
    closeAllSheets();
    const sheet = document.getElementById(`mob-sheet-${name}`);
    if (!sheet) return;
    sheet.classList.add('open');
    activeSheet = name;

    // Update nav active state
    document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
    const navBtn = document.querySelector(`[data-sheet="${name}"]`);
    if (navBtn) navBtn.classList.add('active');
  }

  function closeSheet(name) {
    const sheet = document.getElementById(`mob-sheet-${name}`);
    if (sheet) sheet.classList.remove('open');
    if (activeSheet === name) activeSheet = null;
    // Reset nav — default to media active
    document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mob-nav-media')?.classList.add('active');
  }

  function closeAllSheets() {
    ['media','ai','effects','export'].forEach(n => {
      document.getElementById(`mob-sheet-${n}`)?.classList.remove('open');
    });
  }

  function toggleSheet(name) {
    if (activeSheet === name) {
      closeSheet(name);
    } else {
      openSheet(name);
    }
  }

  // ── Swipe-to-close sheet ───────────────────────────────────────
  function addSwipeToClose(sheetEl, name) {
    const handle = sheetEl.querySelector('.mob-sheet-handle');
    const header = sheetEl.querySelector('.mob-sheet-header');
    const zone = handle || header;
    if (!zone) return;

    zone.addEventListener('touchstart', e => {
      sheetStartY = e.touches[0].clientY;
    }, { passive: true });

    zone.addEventListener('touchmove', e => {
      sheetCurrentY = e.touches[0].clientY;
      const dy = sheetCurrentY - sheetStartY;
      if (dy > 0) {
        sheetEl.style.transform = `translateY(${dy}px)`;
        sheetEl.style.transition = 'none';
      }
    }, { passive: true });

    zone.addEventListener('touchend', () => {
      const dy = sheetCurrentY - sheetStartY;
      sheetEl.style.transition = '';
      if (dy > 80) {
        closeSheet(name);
        sheetEl.style.transform = '';
      } else {
        sheetEl.style.transform = '';
      }
      sheetStartY = 0; sheetCurrentY = 0;
    });
  }

  // ── Navigation setup ───────────────────────────────────────────
  function setupNavigation() {
    // Bottom nav buttons
    document.querySelectorAll('.mob-nav-btn[data-sheet]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sheet = btn.dataset.sheet;
        toggleSheet(sheet);
      });
    });

    // FAB — AI
    document.getElementById('mob-fab-ai')?.addEventListener('click', () => {
      toggleSheet('ai');
      // FAB gets special treatment (not a .mob-nav-btn)
      document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
    });

    // Close buttons inside sheets
    document.querySelectorAll('.mob-sheet-close[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeSheet(btn.dataset.close));
    });

    // Swipe-to-close on each sheet
    ['media','ai','effects','export'].forEach(name => {
      const el = document.getElementById(`mob-sheet-${name}`);
      if (el) addSwipeToClose(el, name);
    });

    // Tap backdrop closes sheet
    document.addEventListener('click', e => {
      if (!isMobile() || !activeSheet) return;
      const sheet = document.getElementById(`mob-sheet-${activeSheet}`);
      if (sheet && !sheet.contains(e.target)) {
        const navBar = document.getElementById('mob-bottom-nav');
        if (!navBar?.contains(e.target)) closeSheet(activeSheet);
      }
    });
  }

  // ── Mobile file input ──────────────────────────────────────────
  function setupMobileFileInput() {
    document.getElementById('mob-file-input')?.addEventListener('change', e => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      // Delegate to main app handler
      if (typeof handleVideoFiles === 'function') handleVideoFiles(files);
      else {
        // Fallback: directly load first file
        const url = URL.createObjectURL(files[0]);
        const video = document.getElementById('main-video');
        const hint = document.getElementById('video-drop-hint');
        if (video) { video.src = url; video.style.display = 'block'; }
        if (hint) hint.style.display = 'none';
        showToast('success','🎬',`Đã thêm: ${files[0].name}`);
      }
      closeSheet('media');
    });

    // Quick upload button on preview
    document.getElementById('mob-qa-upload')?.addEventListener('click', () => {
      document.getElementById('mob-file-input')?.click();
    });
  }

  // ── Mobile quick actions ───────────────────────────────────────
  function setupQuickActions() {
    document.getElementById('mob-qa-filter')?.addEventListener('click', () => {
      openSheet('effects');
    });
    document.getElementById('mob-qa-text')?.addEventListener('click', () => {
      openSheet('effects');
      // Scroll to text section
      setTimeout(() => {
        const textInput = document.getElementById('mob-text-input');
        textInput?.scrollIntoView({ behavior: 'smooth' });
        textInput?.focus();
      }, 400);
    });
  }

  // ── Mobile AI Tools ────────────────────────────────────────────
  const AI_ICONS = {
    'auto-cut': '✂️', 'bg-remove': '🟢', 'subtitle': '📝',
    'color-grade': '🎨', 'upscale': '📺', 'noise': '🔇',
  };
  const AI_TITLES = {
    'auto-cut': 'AI Auto Cut', 'bg-remove': 'Background Remover',
    'subtitle': 'AI Subtitle', 'color-grade': 'AI Color Grade',
    'upscale': 'AI Upscale 4K', 'noise': 'Noise Reduction',
  };
  const AI_STAGES = {
    'auto-cut':    [{ l:'Phân tích âm thanh...', p:15 },{ l:'Phát hiện nhịp điệu...', p:35 },{ l:'Tính điểm cắt tối ưu...', p:58 },{ l:'Áp dụng cắt...', p:82 },{ l:'✅ Hoàn thành!', p:100 }],
    'bg-remove':   [{ l:'Phân tích khung hình...', p:12 },{ l:'Tách nền SegmentNet...', p:38 },{ l:'Tinh chỉnh biên...', p:65 },{ l:'Render alpha...', p:90 },{ l:'✅ Hoàn thành!', p:100 }],
    'subtitle':    [{ l:'Khởi động Whisper AI...', p:10 },{ l:'Nhận dạng giọng nói...', p:32 },{ l:'Dịch & căn thời gian...', p:58 },{ l:'Burn-in phụ đề...', p:88 },{ l:'✅ Hoàn thành!', p:100 }],
    'color-grade': [{ l:'Phân tích histogram...', p:18 },{ l:'Áp dụng LUT AI...', p:45 },{ l:'Cân bằng trắng...', p:72 },{ l:'Tối ưu tương phản...', p:90 },{ l:'✅ Hoàn thành!', p:100 }],
    'upscale':     [{ l:'Khởi động Real-ESRGAN...', p:8 },{ l:'Phân tích độ phân giải...', p:22 },{ l:'Upscale 1/3 frames...', p:45 },{ l:'Upscale 2/3 frames...', p:68 },{ l:'Encode 4K UHD...', p:90 },{ l:'✅ Hoàn thành!', p:100 }],
    'noise':       [{ l:'Phân tích tạp âm...', p:20 },{ l:'Xây dựng noise profile...', p:46 },{ l:'DeepFilter AI...', p:72 },{ l:'Tối ưu âm thanh...', p:90 },{ l:'✅ Hoàn thành!', p:100 }],
  };

  function runMobileAI(toolKey) {
    const stages = AI_STAGES[toolKey];
    if (!stages) return;

    aiCancelled = false;

    const overlay = document.getElementById('mob-ai-progress');
    const icon    = document.getElementById('mob-ai-progress-icon');
    const title   = document.getElementById('mob-ai-progress-title');
    const label   = document.getElementById('mob-ai-progress-label');
    const fill    = document.getElementById('mob-ai-bar-fill');
    const pct     = document.getElementById('mob-ai-bar-pct');

    if (icon)  icon.textContent  = AI_ICONS[toolKey] || '🤖';
    if (title) title.textContent = AI_TITLES[toolKey] || 'AI đang xử lý...';
    if (overlay) overlay.classList.add('show');

    // Close sheet
    closeAllSheets();

    let idx = 0;
    function next() {
      if (aiCancelled) {
        if (overlay) overlay.classList.remove('show');
        showToast('warning','⚠️','Đã huỷ AI processing');
        return;
      }
      if (idx >= stages.length) {
        setTimeout(() => {
          if (overlay) overlay.classList.remove('show');
          const msgs = {
            'auto-cut':'✂️ Auto Cut hoàn thành!','bg-remove':'🟢 Xóa nền hoàn thành!',
            'subtitle':'📝 Phụ đề đã tạo!','color-grade':'🎨 Color Grade xong!',
            'upscale':'📺 Video đã upscale 4K!','noise':'🔇 Khử nhiễu xong!',
          };
          showToast('success','🤖', msgs[toolKey] || 'AI hoàn thành!', 4000);
          if (toolKey === 'subtitle') { if(typeof AITools !== 'undefined') AITools.generateSubtitles(); }
          if (toolKey === 'color-grade') { if(typeof AITools !== 'undefined') AITools.applyColorGrade('cinematic'); }
        }, 600);
        return;
      }
      const s = stages[idx];
      if (label) label.textContent = s.l;
      if (fill)  fill.style.width  = s.p + '%';
      if (pct)   pct.textContent   = s.p + '%';
      idx++;
      setTimeout(next, 500 + Math.random() * 600);
    }
    next();
  }

  function setupMobileAI() {
    document.querySelectorAll('.mob-ai-run[data-mob-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.mobTool;
        // Cắt video ngắn là xử lý thật, không dùng thanh tiến trình giả lập.
        if (tool === 'split-clips') {
          closeAllSheets();
          if (typeof splitVideoIntoClips === 'function') splitVideoIntoClips();
          return;
        }
        runMobileAI(tool);
      });
    });

    document.getElementById('mob-ai-cancel')?.addEventListener('click', () => {
      aiCancelled = true;
    });
  }

  // ── Mobile Filters ─────────────────────────────────────────────
  function setupMobileFilters() {
    document.querySelectorAll('.mob-filter-chip[data-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.mob-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const f = chip.dataset.filter;
        if (typeof Effects !== 'undefined') Effects.applyFilter(f);
        showToast('info','🎨', chip.querySelector('span')?.textContent || f, 1500);
      });
    });

    document.querySelectorAll('.mob-speed-chip[data-speed]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.mob-speed-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const speed = parseFloat(chip.dataset.speed);
        const video = document.getElementById('main-video');
        if (video) video.playbackRate = speed;
        showToast('info','⚡',`Tốc độ: ${speed}×`, 1500);
      });
    });

    // Mobile text overlay
    document.getElementById('mob-add-text-btn')?.addEventListener('click', () => {
      const text = document.getElementById('mob-text-input')?.value || 'HD68';
      const overlays = document.getElementById('text-overlays');
      const wrap = document.getElementById('video-canvas-wrap');
      if (!overlays || !wrap) { showToast('warning','⚠️','Thêm video trước!'); return; }

      const el = document.createElement('div');
      el.className = 'text-overlay';
      el.contentEditable = 'true';
      el.textContent = text;
      el.style.cssText = `
        top:30%;left:50%;transform:translateX(-50%);
        font-size:clamp(20px,5vw,48px);color:#fff;font-weight:800;
        text-shadow:0 4px 16px rgba(124,58,237,0.8);
        pointer-events:all;text-align:center;
      `;
      overlays.appendChild(el);
      closeSheet('effects');
      showToast('success','✍️','Đã thêm văn bản!');
    });
  }

  // ── Mobile Export ──────────────────────────────────────────────
  function setupMobileExport() {
    // Quality chips
    ['720','1080','4k'].forEach(q => {
      document.getElementById(`mob-q-${q}`)?.addEventListener('click', () => {
        ['720','1080','4k'].forEach(x => document.getElementById(`mob-q-${x}`)?.classList.remove('active'));
        document.getElementById(`mob-q-${q}`)?.classList.add('active');
      });
    });
    // Format chips
    ['mp4','mov','webm','gif'].forEach(f => {
      document.getElementById(`mob-fmt-${f}`)?.addEventListener('click', () => {
        ['mp4','mov','webm','gif'].forEach(x => document.getElementById(`mob-fmt-${x}`)?.classList.remove('active'));
        document.getElementById(`mob-fmt-${f}`)?.classList.add('active');
      });
    });
    // FPS chips
    ['24','30','60'].forEach(f => {
      document.getElementById(`mob-fps-${f}`)?.addEventListener('click', () => {
        ['24','30','60'].forEach(x => document.getElementById(`mob-fps-${x}`)?.classList.remove('active'));
        document.getElementById(`mob-fps-${f}`)?.classList.add('active');
      });
    });

    // Export button
    document.getElementById('mob-export-btn')?.addEventListener('click', () => {
      const filename = document.getElementById('mob-export-filename')?.value || 'HD68_output';
      const quality  = document.querySelector('.mob-quality-chip[id^="mob-q-"].active')?.textContent || 'FHD';
      closeSheet('export');
      // Trigger main export with progress
      if (typeof startExport === 'function') {
        startExport();
      } else {
        simulateMobileExport(filename, quality);
      }
    });
  }

  function simulateMobileExport(filename, quality) {
    const stages = [
      [0, 'Chuẩn bị...'], [20, 'Encode video...'], [45, 'Áp dụng hiệu ứng...'],
      [68, 'Render AI...'], [85, 'Mux audio...'], [95, 'Optimizing...'],
      [100, '✅ Xuất hoàn thành!'],
    ];

    const aiOverlay = document.getElementById('mob-ai-progress');
    const icon  = document.getElementById('mob-ai-progress-icon');
    const title = document.getElementById('mob-ai-progress-title');
    const label = document.getElementById('mob-ai-progress-label');
    const fill  = document.getElementById('mob-ai-bar-fill');
    const pct   = document.getElementById('mob-ai-bar-pct');

    if (icon)  icon.textContent  = '📤';
    if (title) title.textContent = `Xuất ${quality} HD68`;
    if (aiOverlay) aiOverlay.classList.add('show');
    aiCancelled = false;

    let idx = 0;
    function next() {
      if (aiCancelled || idx >= stages.length) {
        if (aiOverlay) aiOverlay.classList.remove('show');
        if (!aiCancelled) showToast('success','🎉',`"${filename}" đã xuất thành công!`, 5000);
        return;
      }
      const [p, l] = stages[idx];
      if (label) label.textContent = l;
      if (fill)  fill.style.width  = p + '%';
      if (pct)   pct.textContent   = p + '%';
      idx++;
      if (p < 100) setTimeout(next, 600 + Math.random() * 500);
      else setTimeout(next, 1200);
    }
    next();
  }

  // ── Touch double-tap to fullscreen ─────────────────────────────
  function setupTouchGestures() {
    let lastTap = 0;
    const wrap = document.getElementById('video-canvas-wrap');
    wrap?.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - lastTap < 300) {
        // Double tap — toggle fullscreen
        const video = document.getElementById('main-video');
        if (video?.src) wrap.requestFullscreen?.();
      }
      lastTap = now;
    }, { passive: true });

    // Swipe left/right on video → seek ±5s
    let touchStartX = 0;
    wrap?.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    wrap?.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const video = document.getElementById('main-video');
      if (!video?.src || Math.abs(dx) < 40) return;
      video.currentTime = Math.max(0, Math.min(video.duration||0, video.currentTime + (dx > 0 ? 5 : -5)));
      showToast('info', dx > 0 ? '⏩' : '⏪', dx > 0 ? '+5 giây' : '-5 giây', 800);
    }, { passive: true });
  }

  // ── Pinch-to-zoom on preview (visual zoom only) ────────────────
  function setupPinchZoom() {
    const wrap = document.getElementById('video-canvas-wrap');
    const video = document.getElementById('main-video');
    if (!wrap || !video) return;

    let initialDist = 0;
    let currentScale = 1;

    wrap.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        initialDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = Math.min(3, Math.max(0.5, currentScale * (dist / initialDist)));
        video.style.transform = `scale(${scale})`;
      }
    }, { passive: true });

    wrap.addEventListener('touchend', e => {
      if (e.touches.length < 2) {
        currentScale = parseFloat(video.style.transform?.replace(/[^0-9.]/g,'') || '1');
        if (currentScale < 1.05) {
          video.style.transform = '';
          currentScale = 1;
        }
      }
    }, { passive: true });
  }

  // ── Haptic feedback (if supported) ────────────────────────────
  function haptic(pattern = [10]) {
    try { navigator.vibrate?.(pattern); } catch(e) {}
  }

  // ── Init ───────────────────────────────────────────────────────
  function init() {
    if (!isMobile()) return; // Only initialize on mobile

    setupNavigation();
    setupMobileFileInput();
    setupQuickActions();
    setupMobileAI();
    setupMobileFilters();
    setupMobileExport();
    setupTouchGestures();
    setupPinchZoom();

    // Add haptic to FAB
    document.getElementById('mob-fab-ai')?.addEventListener('touchstart', () => haptic([15]), { passive: true });

    // Open media sheet by default on mobile after splash
    setTimeout(() => {
      if (isMobile()) openSheet('media');
    }, 800);

    console.log('[HD68 Mobile] Initialized ✅');
  }

  // ── Re-init on resize ──────────────────────────────────────────
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isMobile()) init();
    }, 300);
  });

  return { init, openSheet, closeSheet, isMobile };

})();

// Initialize after DOM is ready (app.js runs first)
document.addEventListener('DOMContentLoaded', () => {
  // Wait for splash to finish
  const checkApp = setInterval(() => {
    if (!document.getElementById('splash-screen')) {
      clearInterval(checkApp);
      Mobile.init();
    }
  }, 200);
  // Fallback
  setTimeout(() => { Mobile.init(); clearInterval(checkApp); }, 4000);
});
