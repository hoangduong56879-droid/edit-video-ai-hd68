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

  // ── Sheet management ───────────────────────────────────────────
  // Ánh xạ mỗi sheet vào đúng bước của stepper (định nghĩa ở app.js) để
  // mobile cũng bị khoá/mở khớp với desktop thay vì hoàn toàn không biết
  // gì về luồng 4 bước. "media" cố tình không có trong danh sách này —
  // mở lại thư viện media giữa chừng lúc đang chỉnh sửa (bước 2/3) không
  // nên bị coi là quay lại bước 1. Chỉ đồng bộ State.currentStep + thanh
  // stepper — KHÔNG gọi goToStep() đầy đủ ở đây để tránh đổi panel-editor/
  // -export đang hiển thị phía sau sheet (giữ nguyên hành vi hiện có).
  const SHEET_STEP = { ai: 2, effects: 2, audio: 2, export: 3 };

  function openSheet(name) {
    const step = SHEET_STEP[name];
    if (step && typeof canGoToStep === 'function' && !canGoToStep(step)) {
      if (typeof showToast === 'function') showToast('warning', '⚠️', 'Vui lòng thêm video trước!', 2500);
      return;
    }
    if (step && typeof State !== 'undefined') {
      State.currentStep = step;
      if (typeof updateStepperUI === 'function') updateStepperUI();
    }

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
    ['media','ai','effects','export','audio'].forEach(n => {
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
  // Chỉ còn icon/title riêng cho overlay mobile — dữ liệu tiến trình
  // (AI_STAGES) và vòng lặp mô phỏng giờ dùng chung AITools.runTool()
  // (ai-tools.js) với desktop thay vì 2 bản độc lập cho cùng 5 công cụ.
  const AI_ICONS = {
    'auto-cut': '✂️', 'bg-remove': '🟢',
    'color-grade': '🎨', 'upscale': '📺', 'noise': '🔇',
  };
  const AI_TITLES = {
    'auto-cut': 'AI Auto Cut', 'bg-remove': 'Background Remover',
    'color-grade': 'AI Color Grade',
    'upscale': 'AI Upscale 4K', 'noise': 'Noise Reduction',
  };

  function runMobileAI(toolKey) {
    if (typeof AITools === 'undefined') return;

    const overlay = document.getElementById('mob-ai-progress');
    const icon    = document.getElementById('mob-ai-progress-icon');
    const title   = document.getElementById('mob-ai-progress-title');

    if (icon)  icon.textContent  = AI_ICONS[toolKey] || '🤖';
    if (title) title.textContent = AI_TITLES[toolKey] || 'AI đang xử lý...';

    closeAllSheets();

    AITools.runTool(toolKey, function(key) {
      if (overlay) overlay.classList.remove('show');
      if (typeof handleAIToolComplete === 'function') handleAIToolComplete(key);
    }, {
      labelId: 'mob-ai-progress-label',
      fillId:  'mob-ai-bar-fill',
      pctId:   'mob-ai-bar-pct',
      onStart: function() { if (overlay) overlay.classList.add('show'); },
      onCancel: function() {
        if (overlay) overlay.classList.remove('show');
        showToast('warning', '⚠️', 'Đã huỷ AI processing');
      },
    });
  }

  function setupMobileAI() {
    document.querySelectorAll('.mob-ai-run[data-mob-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.mobTool;
        // Cắt video ngắn và AI Subtitle là xử lý thật, không đi qua thanh
        // tiến trình giả lập — subtitle trước đây báo "Hoàn thành!" giả sau
        // ~3s trong khi việc nhận dạng thật (tải model + Whisper) vẫn chạy
        // ngầm thêm nhiều giây sau đó mà không hiển thị gì, khiến người
        // dùng tưởng bị treo. generateSubtitles() giờ tự cập nhật overlay
        // tiến trình thật (mob-ai-progress) trong suốt quá trình xử lý.
        if (tool === 'split-clips') {
          closeAllSheets();
          if (typeof splitVideoIntoClips === 'function') splitVideoIntoClips();
          return;
        }
        if (tool === 'subtitle') {
          if (typeof AITools !== 'undefined') AITools.generateSubtitles();
          return;
        }
        runMobileAI(tool);
      });
    });

    document.getElementById('mob-ai-cancel')?.addEventListener('click', () => {
      if (typeof AITools !== 'undefined') AITools.cancelTool();
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
    // Format chips — chỉ MP4/WebM, 2 định dạng exportVideoReal() thực sự
    // tạo ra được (MediaRecorder không hỗ trợ mux thật sang MOV/GIF).
    ['mp4','webm'].forEach(f => {
      document.getElementById(`mob-fmt-${f}`)?.addEventListener('click', () => {
        ['mp4','webm'].forEach(x => document.getElementById(`mob-fmt-${x}`)?.classList.remove('active'));
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

    // Export button — startExport() (app.js) luôn tồn tại vì app.js được
    // nạp trước mobile.js, nên đường mô phỏng dự phòng trước đây không
    // bao giờ thực sự chạy tới; bỏ hẳn cho gọn.
    document.getElementById('mob-export-btn')?.addEventListener('click', () => {
      closeSheet('export');
      if (typeof startExport === 'function') startExport();
    });
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
  // navSetupDone chặn init() gắn listener nhiều lần: trước đây mỗi lần
  // resize (xoay màn hình, bàn phím ảo bật/tắt cũng kích hoạt resize trên
  // nhiều trình duyệt mobile) mà vẫn đang ở kích thước mobile sẽ gọi lại
  // toàn bộ setup*(), gắn trùng listener lên cùng 1 nút — khiến mỗi lần
  // bấm mở sheet thực chất chạy toggleSheet() 2 lần, tự mở rồi tự đóng
  // ngay lập tức.
  let navSetupDone = false;

  function init() {
    if (!isMobile()) return; // Only initialize on mobile
    if (navSetupDone) return;
    navSetupDone = true;

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
  let initialized = false;
  // Wait for splash to finish
  const checkApp = setInterval(() => {
    if (!document.getElementById('splash-screen')) {
      clearInterval(checkApp);
      initialized = true;
      Mobile.init();
    }
  }, 200);
  // Fallback — chỉ chạy nếu interval ở trên chưa kịp init (trước đây gọi
  // Mobile.init() vô điều kiện ở đây, khiến init() chạy 2 lần trong trường
  // hợp bình thường (splash biến mất trước 4s) → mọi listener điều hướng
  // (setupNavigation, v.v.) bị gắn trùng, khiến bấm mở sheet rồi tự đóng
  // ngay lập tức (2 listener cùng gọi toggleSheet).
  setTimeout(() => {
    clearInterval(checkApp);
    if (!initialized) Mobile.init();
  }, 4000);
});
