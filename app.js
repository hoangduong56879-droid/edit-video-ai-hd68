'use strict';

/* ========================================================
   EDIT VIDEO AI HD68 — Core Application Logic
   Player, Timeline, UI, State Management
   ======================================================== */

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
const State = {
  clips: [],          // { id, name, duration, src, start, width }
  currentFilter: 'none',
  zoom: 100,          // timeline zoom %
  isPlaying: false,
  volume: 1,
  isMuted: false,
  currentTime: 0,
  selectedClipId: null,
  textOverlays: [],
  exportHistory: [],
  colorSettings: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
  speed: 1,
  voiceoverTracks: [],   // { id, name, lang, buffer (AudioBuffer), startTime, volume }
  voicePitch: 0,         // bán cung dịch cao độ cho giọng gốc của video khi xuất
  voicePitchEnabled: false,
  currentStep: 1,         // 1 Tải lên → 2 Xem & chỉnh → 3 Render → 4 Hoàn tất
  exportCompleted: false, // mở khoá bước 4 sau khi xuất video thành công lần đầu
};

// ──────────────────────────────────────────────
// TOAST HELPER (global)
// ──────────────────────────────────────────────
function showToast(type, icon, msg, duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon ${type}">${icon}</div>
    <div class="toast-msg">${msg}</div>
    <div class="toast-close" onclick="this.parentElement.remove()">×</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ──────────────────────────────────────────────
// SPLASH SCREEN
// ──────────────────────────────────────────────
function runSplash() {
  Effects.createSplashParticles();

  const stages = [
    [300,  'Khởi động AI Engine...', 20],
    [800,  'Tải mô hình AI HD68...', 45],
    [1400, 'Khởi tạo Timeline Engine...', 65],
    [1900, 'Nạp bộ lọc màu...', 80],
    [2400, 'Sẵn sàng!', 100],
  ];

  const fill  = document.getElementById('splash-loader-fill');
  const label = document.getElementById('splash-loader-text');

  stages.forEach(([delay, text, pct]) => {
    setTimeout(() => {
      if (fill)  fill.style.width  = pct + '%';
      if (label) label.textContent = text;
      if (pct === 100) {
        setTimeout(hideSplash, 600);
      }
    }, delay);
  });
}

function hideSplash() {
  const splash = document.getElementById('splash-screen');
  const app    = document.getElementById('app');
  if (!splash || !app) return;

  splash.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  splash.style.opacity    = '0';
  splash.style.transform  = 'scale(1.05)';

  setTimeout(() => {
    splash.remove();
    app.classList.remove('hidden');
    initApp();
  }, 600);
}

// ──────────────────────────────────────────────
// INIT APP
// ──────────────────────────────────────────────
function initApp() {
  setupStepper();
  setupStep2SubNav();
  setupPanelTabs();
  setupFileInput();
  setupDragDrop();
  setupPlaybackControls();
  setupFilterPanel();
  setupEffectsPanel();
  setupTextPanel();
  setupRightPanel();
  setupExportPanel();
  setupColorPanel();
  setupAudioPanel();
  setupVoiceTools();
  setupAIButtons();
  setupTimeline();
  setupKeyboard();
  updateTimeline();

  // Draw canvases
  Effects.drawColorWheel(document.getElementById('wheel-canvas-shadows'));
  Effects.drawColorWheel(document.getElementById('wheel-canvas-midtones'));
  Effects.drawColorWheel(document.getElementById('wheel-canvas-highlights'));
  Effects.drawWaveform(document.getElementById('waveform-canvas'));
  Effects.drawCurvesCanvas(document.getElementById('curves-canvas'));
  Effects.animateAudioWaveform(document.getElementById('audio-waveform'));

  showToast('success', '🚀', 'EDIT VIDEO AI HD68 đã sẵn sàng!');

  // Khi resize cửa sổ, cập nhật lại kích thước + vị trí subtitle bar
  window.addEventListener('resize', () => {
    const video = document.getElementById('main-video');
    if (video && video.videoWidth) {
      fitVideoToContainer(video);
      requestAnimationFrame(() => repositionSubtitleBar(video));
    }
  });
}

// ──────────────────────────────────────────────
// STEPPER — Bước 1 Tải lên → 2 Xem & chỉnh → 3 Render → 4 Hoàn tất
// ──────────────────────────────────────────────

/* Bước 2/3 chỉ mở khi đã có ít nhất 1 clip; bước 4 chỉ mở sau khi đã xuất
   video thành công ít nhất 1 lần. Quay lại bước trước luôn được phép. */
function canGoToStep(n) {
  if (n === 2 || n === 3) return State.clips.length > 0;
  if (n === 4) return State.exportCompleted === true;
  return true;
}

function goToStep(n) {
  if (n !== 1 && !canGoToStep(n)) {
    const msgs = {
      2: 'Vui lòng thêm video trước khi chỉnh sửa!',
      3: 'Vui lòng thêm video trước khi render!',
      4: 'Chưa có video nào được xuất!',
    };
    showToast('warning', '⚠️', msgs[n] || 'Chưa thể chuyển bước này', 3000);
    return;
  }

  State.currentStep = n;
  updateStepperUI();

  const step1   = document.getElementById('step-screen-1');
  const editor  = document.getElementById('panel-editor');
  const color   = document.getElementById('panel-color');
  const audio   = document.getElementById('panel-audio');
  const exportP = document.getElementById('panel-export');
  const done    = document.getElementById('step-screen-4');
  const subnav  = document.getElementById('step2-subnav');

  [step1, editor, color, audio, exportP, done].forEach(el => el && el.classList.add('hidden'));

  if (n === 1) {
    subnav?.classList.add('hidden');
    step1?.classList.remove('hidden');
  } else if (n === 2) {
    subnav?.classList.remove('hidden');
    const activeBtn = subnav?.querySelector('.step2-subnav-btn.active') || subnav?.querySelector('.step2-subnav-btn');
    const key = activeBtn?.dataset.panel || 'editor';
    document.getElementById(`panel-${key}`)?.classList.remove('hidden');
  } else if (n === 3) {
    subnav?.classList.add('hidden');
    exportP?.classList.remove('hidden');
    updateExportPanel();
  } else if (n === 4) {
    subnav?.classList.add('hidden');
    done?.classList.remove('hidden');
  }
}

function updateStepperUI() {
  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById(`step-btn-${i}`);
    if (!btn) continue;
    btn.classList.toggle('active', State.currentStep === i);
    btn.classList.toggle('completed', i < State.currentStep);
    btn.disabled = i !== 1 && !canGoToStep(i);
  }
}

function setupStepper() {
  document.querySelectorAll('.stepper-node').forEach(btn => {
    btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.step, 10)));
  });
  updateStepperUI();

  document.getElementById('btn-export-quick')?.addEventListener('click', () => goToStep(3));
  document.getElementById('btn-step4-edit')?.addEventListener('click', () => goToStep(2));
  document.getElementById('btn-step4-new')?.addEventListener('click', () => {
    clearAllMedia();
    State.exportCompleted = false;
    goToStep(1);
  });
}

/* Sub-nav nội bộ của bước 2 (Chỉnh sửa/Màu sắc/Âm thanh) — chuyển panel mà
   không rời khỏi bước 2. Tạm thời tái dùng 3 panel cũ nguyên vẹn; sẽ hợp
   nhất thành sub-tab chung trong đợt tái cấu trúc bước 2 tiếp theo. */
function setupStep2SubNav() {
  const btns = document.querySelectorAll('.step2-subnav-btn');
  const panels = {
    editor: document.getElementById('panel-editor'),
    color:  document.getElementById('panel-color'),
    audio:  document.getElementById('panel-audio'),
  };
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panels).forEach(p => p && p.classList.add('hidden'));
      panels[btn.dataset.panel]?.classList.remove('hidden');
    });
  });
}

// ──────────────────────────────────────────────
// PANEL TABS (Left sidebar)
// ──────────────────────────────────────────────
function setupPanelTabs() {
  const ptabs = document.querySelectorAll('.ptab');
  ptabs.forEach(tab => {
    tab.addEventListener('click', () => switchToPanelTab(tab.dataset.ptab));
  });
}

/* Chuyển tab con bên trái (Media / AI Tools / Hiệu ứng / Văn bản) bằng code,
   dùng để tự động nhảy sang mục chỉnh sửa ngay sau khi thêm video.
   Trên mobile giao diện dùng bottom-sheet riêng (Mobile.openSheet) nên gọi cả hai. */
function switchToPanelTab(key) {
  document.querySelectorAll('.ptab').forEach(t => t.classList.toggle('active', t.dataset.ptab === key));
  document.querySelectorAll('.panel-content').forEach(c => c.classList.remove('active'));
  const target = document.getElementById(`pcontent-${key}`);
  if (target) target.classList.add('active');

  if (typeof Mobile !== 'undefined' && Mobile.isMobile && Mobile.isMobile()) {
    Mobile.openSheet(key);
  }
}

// ──────────────────────────────────────────────
// FILE INPUT & DRAG/DROP
// ──────────────────────────────────────────────
function setupFileInput() {
  const input = document.getElementById('file-input-video');
  input?.addEventListener('change', e => handleVideoFiles(Array.from(e.target.files)));

  const addBtn = document.getElementById('btn-add-media');
  addBtn?.addEventListener('click', () => input?.click());

  // Nút xóa tất cả media
  document.getElementById('btn-clear-media')?.addEventListener('click', () => {
    if (State.clips.length === 0) {
      showToast('warning', '⚠️', 'Thư viện media đang trống!', 2000);
      return;
    }
    // Hiển thị xác nhận
    if (confirm(`Bạn có chắc muốn xóa tất cả ${State.clips.length} video khỏi thư viện?`)) {
      clearAllMedia();
    }
  });
}

function setupDragDrop() {
  const zone = document.getElementById('media-upload-zone');
  const canvasWrap = document.getElementById('video-canvas-wrap');

  [zone, canvasWrap].forEach(el => {
    if (!el) return;
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
      if (files.length) handleVideoFiles(files);
    });
  });
}

function handleVideoFiles(files) {
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    const id = Date.now() + Math.random();
    addClipToLibrary({ id, name: file.name, src: url, duration: 0, file });
  });
}

function addClipToLibrary(clip) {
  // Một thẻ <video> tạm DUY NHẤT để đọc cả thời lượng lẫn khung hình thumbnail.
  // Trước đây tạo 2 video riêng (1 đọc duration, 1 tạo thumbnail) cộng thêm
  // video player chính = 3 video cùng giải mã 1 file cùng lúc — trên máy tính
  // không vấn đề gì, nhưng trên Safari/iOS mỗi video đang giải mã tốn một
  // vùng bộ nhớ decoder riêng, và video quay trực tiếp từ điện thoại thường
  // rất nặng (vài trăm MB, 4K) nên dễ vượt giới hạn bộ nhớ trang và bị Safari
  // tự kill/reload tab ngay khi thêm video. Gộp còn 1 video tạm, dọn dẹp
  // (remove + giải phóng src) xong mới bắt đầu decode video player chính.
  const temp = document.createElement('video');
  temp.playsInline = true;
  temp.muted = true;
  temp.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;';
  document.body.appendChild(temp);

  let settled = false;
  const finish = (thumbnailUrl) => {
    if (settled) return;
    settled = true;
    clip.duration = temp.duration || 0;
    temp.removeAttribute('src');
    temp.load();
    temp.remove();

    // Add to state
    State.clips.push({ ...clip, start: getTotalDuration() });

    // Add to media grid
    addMediaItem(clip, thumbnailUrl);

    // If first clip, load into player and jump straight to editing —
    // người dùng chỉ cần thêm video là vào thẳng khu vực chỉnh sửa,
    // không phải tự bấm thêm tab nào nữa.
    if (State.clips.length === 1) {
      loadClipIntoPlayer(clip);
      goToStep(2);
      switchToPanelTab('ai');
    }

    updateTimeline();
    showToast('success', '🎬', `Đã thêm: ${clip.name}`);
  };

  const captureThumbnail = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160; canvas.height = 90;
      canvas.getContext('2d').drawImage(temp, 0, 0, 160, 90);
      finish(canvas.toDataURL());
    } catch (e) {
      finish(null);
    }
  };

  temp.addEventListener('loadedmetadata', () => {
    if (temp.duration && isFinite(temp.duration)) {
      temp.addEventListener('seeked', captureThumbnail, { once: true });
      temp.currentTime = temp.duration * 0.1;
    } else {
      captureThumbnail();
    }
  }, { once: true });
  temp.addEventListener('error', () => {
    if (settled) return;
    settled = true;
    temp.remove();
    showToast('error', '⚠️', `Không đọc được video: ${clip.name}`);
  });
  // Fallback: nếu sau 8s vẫn không có sự kiện nào (một số trình duyệt mobile
  // im lặng không bắn loadedmetadata với vài định dạng/blob), vẫn thêm clip
  // thay vì để UI treo vô thời hạn.
  setTimeout(() => finish(null), 8000);

  temp.src = clip.src;
  temp.load();
}

function addMediaItem(clip, thumbnailUrl) {
  const grid = document.getElementById('media-grid');
  if (!grid) return;

  const item = document.createElement('div');
  item.className = 'media-item';
  item.dataset.id = clip.id;

  // Thumbnail được addClipToLibrary chụp sẵn từ cùng video tạm dùng để đọc
  // duration (xem giải thích ở addClipToLibrary) — không tạo thêm <video>
  // nào ở đây để tránh nhiều decoder cùng giải mã 1 file, gây crash trên
  // Safari/iOS với video nặng.
  if (thumbnailUrl) {
    item.style.backgroundImage = `url(${thumbnailUrl})`;
    item.style.backgroundSize = 'cover';
    item.style.backgroundPosition = 'center';
  }

  const dur = clip.duration ? Effects.formatTime(clip.duration) : '--:--';
  item.innerHTML = `
    <div class="media-item-name">${clip.name.replace(/\.[^.]+$/,'')}</div>
    <div class="media-item-dur">${dur}</div>
    <button class="media-item-add" title="Thêm vào timeline">+</button>
    <button class="media-item-delete" title="Xóa video này">&times;</button>
  `;

  // Click để load vào player
  item.addEventListener('click', (e) => {
    if (e.target.classList.contains('media-item-delete') ||
        e.target.classList.contains('media-item-add')) return;
    document.querySelectorAll('.media-item').forEach(m => m.classList.remove('active'));
    item.classList.add('active');
    loadClipIntoPlayer(clip);
  });

  // Double-click để thêm vào timeline
  item.addEventListener('dblclick', (e) => {
    if (e.target.classList.contains('media-item-delete') ||
        e.target.classList.contains('media-item-add')) return;
    addClipToTimeline(clip);
  });

  // Nút + thêm nhanh vào timeline
  item.querySelector('.media-item-add').addEventListener('click', (e) => {
    e.stopPropagation();
    addClipToTimeline(clip);
    showToast('success', '➕', `Đã thêm "${clip.name.replace(/\.[^.]+$/,'')}" vào timeline!`, 2000);
  });

  // Nút × xóa media
  item.querySelector('.media-item-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    removeMediaItem(clip.id, item);
  });

  grid.appendChild(item);
  updateMediaCount();
}

/* ── Xóa một media item ── */
function removeMediaItem(clipId, itemEl) {
  // Animation xóa
  if (itemEl) {
    itemEl.classList.add('removing');
    setTimeout(() => {
      itemEl.remove();
      updateMediaCount();
    }, 300);
  }

  // Xóa khỏi State.clips
  const clip = State.clips.find(c => c.id === clipId);
  State.clips = State.clips.filter(c => c.id !== clipId);

  // Xóa khỏi timeline
  document.querySelectorAll(`.timeline-clip[data-id="${clipId}"]`).forEach(el => el.remove());

  // Nếu clip đang phát bị xóa → load clip tiếp theo hoặc ẩn player
  if (State.selectedClipId === clipId) {
    const video = document.getElementById('main-video');
    const hint  = document.getElementById('video-drop-hint');
    if (State.clips.length > 0) {
      loadClipIntoPlayer(State.clips[0]);
      // Highlight item đầu tiên còn lại
      const firstItem = document.querySelector('.media-item:not(.removing)');
      if (firstItem) firstItem.classList.add('active');
    } else {
      // Không còn clip nào
      if (video) { video.src = ''; video.style.display = 'none'; }
      if (hint) hint.style.display = '';
      State.selectedClipId = null;
      showProps(false);
    }
  }

  updateTimeline();
  showToast('info', '🗑️', `Đã xóa: ${clip ? clip.name : 'video'}`, 2000);
}

/* ── Xóa tất cả media ── */
function clearAllMedia() {
  if (State.clips.length === 0) {
    showToast('warning', '⚠️', 'Thư viện media đang trống!', 2000);
    return;
  }

  const count = State.clips.length;

  // Animate tất cả items
  document.querySelectorAll('.media-item').forEach(el => el.classList.add('removing'));

  setTimeout(() => {
    // Xóa grid
    const grid = document.getElementById('media-grid');
    if (grid) grid.innerHTML = '';

    // Xóa toàn bộ state
    State.clips = [];
    State.selectedClipId = null;

    // Xóa toàn bộ timeline clips
    document.querySelectorAll('.timeline-clip').forEach(el => el.remove());
    // Hiển thị lại empty hints
    document.querySelectorAll('.track-empty-hint').forEach(el => el.style.display = '');

    // Ẩn player, hiện hint
    const video = document.getElementById('main-video');
    const hint  = document.getElementById('video-drop-hint');
    if (video) { video.src = ''; video.style.display = 'none'; }
    if (hint) hint.style.display = '';

    showProps(false);
    updateTimeline();
    updateMediaCount();
    showToast('info', '🗑️', `Đã xóa ${count} video khỏi thư viện!`, 2500);
  }, 320);
}

/* ── Cập nhật số lượng media hiển thị ── */
function updateMediaCount() {
  const countEl = document.getElementById('media-count');
  const clearBtn = document.getElementById('btn-clear-media');
  const count = State.clips.length;

  if (countEl) countEl.textContent = count > 0 ? `(${count})` : '';
  if (clearBtn) {
    if (count > 0) clearBtn.classList.add('visible');
    else clearBtn.classList.remove('visible');
  }
}

// ──────────────────────────────────────────────
// PLAYER
// ──────────────────────────────────────────────
function loadClipIntoPlayer(clip) {
  const video = document.getElementById('main-video');
  const hint  = document.getElementById('video-drop-hint');
  if (!video) return;

  video.src = clip.src;
  video.style.display = 'block';
  video.style.filter = Effects.FILTERS[State.currentFilter] || '';
  video.playbackRate = State.speed;
  if (hint) hint.style.display = 'none';

  // Sync color preview
  const colorVid = document.getElementById('color-preview-video');
  if (colorVid) colorVid.src = clip.src;

  // Sau khi metadata load, điều chỉnh kích thước video đúng tỷ lệ
  video.addEventListener('loadedmetadata', () => {
    updateTimeDisplay();
    fitVideoToContainer(video);
  }, { once: true });
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('ended', onEnded);

  State.selectedClipId = clip.id;
  showProps(true);
}

function fitVideoToContainer(video) {
  const wrap = document.getElementById('video-canvas-wrap');
  if (!wrap || !video.videoWidth || !video.videoHeight) return;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const ar = vw / vh;

  // Đặt aspect-ratio trên video element để giữ đúng tỷ lệ
  video.style.width = '';
  video.style.height = '';
  video.style.maxWidth = '100%';
  video.style.maxHeight = '100%';
  video.style.aspectRatio = `${vw} / ${vh}`;
  video.style.objectFit = 'contain';
  video.style.borderRadius = '8px';

  // Cập nhật overlay canvas để khớp kích thước video thực hiển thị
  const overlay = document.getElementById('overlay-canvas');
  if (overlay) {
    overlay.width  = vw;
    overlay.height = vh;
    overlay.style.aspectRatio = `${vw} / ${vh}`;
    overlay.style.width = '';
    overlay.style.height = '';
    overlay.style.maxWidth = '100%';
    overlay.style.maxHeight = '100%';
    overlay.style.position = 'absolute';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.pointerEvents = 'none';
    overlay.style.borderRadius = '8px';
  }

  // Hiển thị thông tin độ phân giải video
  const resSel = document.getElementById('resolution-select');
  if (resSel) {
    const resLabel = document.createElement('option');
    resLabel.value = 'source';
    resLabel.textContent = `Nguồn gốc ${vw}×${vh}`;
    if (!resSel.querySelector('[value="source"]')) {
      resSel.insertBefore(resLabel, resSel.firstChild);
    } else {
      resSel.querySelector('[value="source"]').textContent = `Nguồn gốc ${vw}×${vh}`;
    }
    resSel.value = 'source';
  }

  // Định vị lại subtitle bar sau khi trình duyệt render xong (dùng 2 rAF)
  requestAnimationFrame(() => requestAnimationFrame(() => repositionSubtitleBar(video)));

  showToast('info', '📐', `Kích thước video: ${vw}×${vh} (${ar.toFixed(2)}:1)`, 2500);
}

/**
 * Tính toán vị trí thực của video trong container
 * và đặt subtitle bar + text-overlays wrapper đúng vào vùng video đó.
 */
function repositionSubtitleBar(video) {
  if (!video) video = document.getElementById('main-video');
  if (!video || !video.videoWidth) return;

  const wrap = document.getElementById('video-canvas-wrap');
  if (!wrap) return;

  // getBoundingClientRect của video và container
  const wrapRect  = wrap.getBoundingClientRect();
  const videoRect = video.getBoundingClientRect();

  // Tọa độ tương đối trong container
  const relTop    = videoRect.top    - wrapRect.top;
  const relLeft   = videoRect.left   - wrapRect.left;
  const relWidth  = videoRect.width;
  const relHeight = videoRect.height;

  // --- Subtitle bar ---
  const subBar = document.getElementById('hd68-sub-bar');
  if (subBar) {
    const posY = (typeof AITools !== 'undefined' && AITools.getSubPosY) ? AITools.getSubPosY() : 12;
    const bottomOffset = relHeight * (posY / 100); // % chiều cao video, chỉnh được trong panel phụ đề
    subBar.style.position  = 'absolute';
    subBar.style.left      = relLeft + 'px';
    subBar.style.top       = (relTop + relHeight - bottomOffset) + 'px';
    subBar.style.width     = relWidth + 'px';
    subBar.style.transform = 'none';
    subBar.style.bottom    = 'auto';
    subBar.style.zIndex    = '50';
    subBar.style.textAlign = 'center';
    subBar.style.pointerEvents = 'none';
  }

  // --- Text overlays wrapper ---
  const textOverlays = document.getElementById('text-overlays');
  if (textOverlays) {
    textOverlays.style.position = 'absolute';
    textOverlays.style.left     = relLeft + 'px';
    textOverlays.style.top      = relTop + 'px';
    textOverlays.style.width    = relWidth + 'px';
    textOverlays.style.height   = relHeight + 'px';
    textOverlays.style.overflow = 'hidden';
    textOverlays.style.zIndex   = '40';
    textOverlays.style.pointerEvents = 'none';
  }
}

function onTimeUpdate() {
  const video = document.getElementById('main-video');
  if (!video) return;
  State.currentTime = video.currentTime;
  updateSeekBar(video);
  updateTimeDisplay();
  updatePlayhead(video);
}

function onEnded() {
  State.isPlaying = false;
  document.getElementById('play-icon')?.removeAttribute('style');
  document.getElementById('pause-icon')?.setAttribute('style','display:none');
}

function updateSeekBar(video) {
  const bar = document.getElementById('seek-bar');
  if (!bar || !video.duration) return;
  bar.value = (video.currentTime / video.duration) * 100;
}

function updateTimeDisplay() {
  const video = document.getElementById('main-video');
  if (!video) return;
  const cur = Effects.formatTime(video.currentTime || 0);
  const tot = Effects.formatTime(video.duration || 0);
  document.getElementById('time-display').textContent = `${cur} / ${tot}`;
  document.getElementById('preview-info').textContent = `${cur} / ${tot}`;
}

function updatePlayhead(video) {
  if (!video.duration) return;
  const ph = document.getElementById('timeline-playhead');
  const tc = document.getElementById('tracks-content');
  if (!ph || !tc) return;
  const pct = video.currentTime / video.duration;
  const w = tc.scrollWidth;
  ph.style.left = (pct * w) + 'px';
}

// ──────────────────────────────────────────────
// PLAYBACK CONTROLS
// ──────────────────────────────────────────────
function setupPlaybackControls() {
  const video = () => document.getElementById('main-video');

  document.getElementById('btn-play-pause')?.addEventListener('click', togglePlay);
  document.getElementById('btn-skip-back')?.addEventListener('click', () => { if(video()) video().currentTime = Math.max(0, video().currentTime - 5); });
  document.getElementById('btn-skip-fwd')?.addEventListener('click', () => { if(video()) video().currentTime = Math.min(video().duration||0, video().currentTime + 5); });

  document.getElementById('seek-bar')?.addEventListener('input', e => {
    if(video() && video().duration) video().currentTime = (e.target.value/100) * video().duration;
  });

  document.getElementById('volume-bar')?.addEventListener('input', e => {
    State.volume = parseFloat(e.target.value);
    if(video()) video().volume = State.volume;
  });

  document.getElementById('btn-mute')?.addEventListener('click', () => {
    State.isMuted = !State.isMuted;
    if(video()) video().muted = State.isMuted;
    showToast('info', State.isMuted ? '🔇' : '🔊', State.isMuted ? 'Tắt tiếng' : 'Bật tiếng', 1500);
  });

  document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
    const wrap = document.getElementById('video-canvas-wrap');
    if (wrap) wrap.requestFullscreen?.();
  });

  document.getElementById('btn-screenshot')?.addEventListener('click', takeScreenshot);
  document.getElementById('btn-save')?.addEventListener('click', saveProject);
  document.getElementById('btn-undo')?.addEventListener('click', () => showToast('info','↩️','Đã hoàn tác'));
  document.getElementById('btn-redo')?.addEventListener('click', () => showToast('info','↪️','Đã làm lại'));

  document.getElementById('btn-download-video')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-download-video');
    if (btn) btn.disabled = true;
    exportVideoReal({}).finally(() => { if (btn) btn.disabled = false; });
  });
}

function togglePlay() {
  const video = document.getElementById('main-video');
  const playIcon  = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  if (!video || !video.src) { showToast('warning','⚠️','Vui lòng thêm video trước!'); return; }

  if (State.isPlaying) {
    video.pause();
    State.isPlaying = false;
    playIcon?.removeAttribute('style');
    pauseIcon?.setAttribute('style','display:none');
  } else {
    video.play();
    State.isPlaying = true;
    playIcon?.setAttribute('style','display:none');
    pauseIcon?.removeAttribute('style');
  }
}

function takeScreenshot() {
  const video = document.getElementById('main-video');
  if (!video || !video.src) { showToast('warning','⚠️','Không có video để chụp ảnh!'); return; }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `HD68_screenshot_${Date.now()}.png`;
  link.click();
  showToast('success','📸','Đã chụp ảnh màn hình!');
}

// ──────────────────────────────────────────────
// TẢI VIDEO VỀ THIẾT BỊ — ghi lại thật bằng MediaRecorder
// (canvas = khung hình video + color grade, cộng phụ đề đốt cứng),
// không phải mô phỏng — ra file thật, tải thật.
// ──────────────────────────────────────────────
let _exportRecorder = null;

/* Dựng canvas capture stream + MediaRecorder dùng chung cho tải 1 video
   và ghép nhiều video. Trả về null (và tự hiện toast lỗi) nếu môi trường
   không hỗ trợ.

   opts.pitchedBuffer   — nếu có, thay hẳn audio gốc của video bằng bản đã
                          đổi giọng (AudioBuffer đã pitch-shift trước đó).
   opts.voiceoverTracks — mảng track TTS cộng thêm vào, mỗi track phát tại
                          đúng thời điểm track.startTime (giây) kể từ lúc
                          bắt đầu ghi.
   Trả thêm audioCtx + startAudioGraph(): gọi startAudioGraph() đúng lúc
   video thật sự bắt đầu play để mọi nguồn âm thanh đồng bộ với nhau. */
function _setupExportRecorder(video, canvas, opts) {
  opts = opts || {};
  let mediaStream;
  let audioCtx;
  let startAudioGraph = function() {};
  try {
    const srcStream = video.captureStream
      ? video.captureStream()
      : (video.mozCaptureStream ? video.mozCaptureStream() : null);
    if (!srcStream) throw new Error('Trinh duyet khong ho tro capture video');
    const canvasStream = canvas.captureStream(30);

    const hasVoiceover  = opts.voiceoverTracks && opts.voiceoverTracks.length;
    const hasPitchShift = !!opts.pitchedBuffer;

    if (hasVoiceover || hasPitchShift) {
      // Cần trộn nhiều nguồn âm thanh (giọng gốc/đã đổi + các track TTS)
      // qua Web Audio API thay vì chỉ lấy track audio thô của video.
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      const pendingSources = [];

      if (hasPitchShift) {
        const src = audioCtx.createBufferSource();
        src.buffer = opts.pitchedBuffer;
        src.connect(dest);
        pendingSources.push({ node: src, when: 0 });
      } else {
        audioCtx.createMediaStreamSource(srcStream).connect(dest);
      }

      (opts.voiceoverTracks || []).forEach((track) => {
        const src = audioCtx.createBufferSource();
        src.buffer = track.buffer;
        const gain = audioCtx.createGain();
        gain.gain.value = track.volume != null ? track.volume : 1;
        src.connect(gain).connect(dest);
        pendingSources.push({ node: src, when: track.startTime || 0 });
      });

      startAudioGraph = function() {
        const t0 = audioCtx.currentTime;
        pendingSources.forEach(({ node, when }) => node.start(t0 + Math.max(0, when)));
      };

      mediaStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
    } else {
      mediaStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...srcStream.getAudioTracks(),
      ]);
    }
  } catch (err) {
    showToast('warning', '⚠️', 'Không thể ghi video: ' + err.message, 5000);
    return null;
  }

  // WebM trước: MediaRecorder.isTypeSupported() có thể báo true cho MP4/H.264
  // dù encoder thực tế từ chối giữa chừng (đã gặp thực tế — video bị cắt còn
  // vài khung hình). VP9/Opus ổn định hơn nhiều trên mọi máy.
  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];
  const mimeType = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m));
  if (!mimeType) {
    showToast('warning', '⚠️', 'Trình duyệt không hỗ trợ định dạng ghi video nào.', 5000);
    if (audioCtx) audioCtx.close();
    return null;
  }
  const ext = mimeType.indexOf('mp4') !== -1 ? 'mp4' : 'webm';

  let recorder;
  try {
    recorder = new MediaRecorder(mediaStream, {
      mimeType,
      videoBitsPerSecond: (opts && opts.videoBitsPerSecond) || 8000000,
    });
  } catch (err) {
    showToast('warning', '⚠️', 'Lỗi khởi tạo bộ ghi video: ' + err.message, 5000);
    if (audioCtx) audioCtx.close();
    return null;
  }

  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  return { recorder, mimeType, ext, chunks, audioCtx, startAudioGraph };
}

function _downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function exportVideoReal(opts) {
  opts = opts || {};
  const video = document.getElementById('main-video');
  if (!video || !video.src || !video.duration) {
    showToast('warning', '⚠️', 'Vui lòng thêm video trước khi tải!');
    return Promise.resolve(false);
  }
  if (_exportRecorder) {
    showToast('warning', '!', 'Đang tải video, vui lòng chờ...');
    return Promise.resolve(false);
  }
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) {
    showToast('warning', '⚠️', 'Video chưa sẵn sàng, thử lại sau giây lát.');
    return Promise.resolve(false);
  }
  if (typeof MediaRecorder === 'undefined') {
    showToast('warning', '⚠️', 'Trình duyệt không hỗ trợ tải video (cần Chrome/Edge).', 5000);
    return Promise.resolve(false);
  }

  const filename = opts.filename ||
    (document.getElementById('export-filename')?.value || 'HD68_video').trim() || 'HD68_video';
  const onProgress = opts.onProgress || function() {};

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  return _prepareVoiceMixOpts(video, opts).then((mixOpts) => {
  const setup = _setupExportRecorder(video, canvas, mixOpts);
  if (!setup) return false;
  const { recorder, mimeType, ext, chunks } = setup;

  showToast('info', '⏺️', 'Đang ghi video (mất khoảng ' + Math.ceil(video.duration) + 's)...', 4000);

  return new Promise((resolve) => {
    const wasPaused = video.paused;
    const wasTime   = video.currentTime;
    const wasFilter = video.style.filter;
    let rafId       = null;
    let stopped     = false;
    let encodeError = null;
    let deadlineId  = null;

    function drawFrame() {
      if (stopped) return;
      ctx.filter = wasFilter || 'none';
      ctx.drawImage(video, 0, 0, w, h);
      drawBurnedSubtitles(ctx, w, h, video.currentTime);
      onProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
      if (video.ended || video.paused) { finish(); return; }
      rafId = requestAnimationFrame(drawFrame);
    }

    function finish() {
      if (stopped) return;
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (deadlineId) clearTimeout(deadlineId);
      if (recorder.state !== 'inactive') recorder.stop();
    }

    // Chốt an toàn: rAF có thể bị trình duyệt tạm dừng hẳn khi tab chạy nền
    // (đổi app, khoá màn hình điện thoại...), khiến drawFrame() không bao
    // giờ được gọi lại để phát hiện video.ended — bản ghi sẽ chạy vô thời
    // hạn cho tới khi tab active trở lại, làm track hình dài hơn hẳn track
    // tiếng thật. setTimeout vẫn được trình duyệt gọi (dù có thể bị trễ)
    // ngay cả khi tab chạy nền, nên dùng nó làm giới hạn cứng.
    deadlineId = setTimeout(finish, ((video.duration || 0) / (video.playbackRate || 1) + 4) * 1000);

    // isTypeSupported() có thể báo hỗ trợ nhưng encoder thực tế vẫn từ chối
    // giữa chừng (đặc biệt với H.264 phần cứng) — bắt lỗi này thay vì âm
    // thầm tải về một file video bị cắt cụt/hỏng.
    recorder.onerror = (e) => {
      encodeError = (e && e.error && e.error.message) || 'Loi encoder khong xac dinh';
      finish();
    };

    recorder.onstop = () => {
      video.currentTime = wasTime;
      if (wasPaused) video.pause();
      _exportRecorder = null;
      if (setup.audioCtx) setup.audioCtx.close();

      if (encodeError) {
        showToast('warning', '⚠️', 'Ghi video thất bại: ' + encodeError, 6000);
        resolve(false);
        return;
      }

      _downloadBlob(new Blob(chunks, { type: mimeType }), filename + '.' + ext);
      onProgress(100);
      showToast('success', '🎉', 'Đã tải "' + filename + '.' + ext + '" về thiết bị!', 5000);
      resolve(true);
    };

    _exportRecorder = recorder;
    video.currentTime = 0;
    recorder.start(250);
    video.play().then(() => {
      setup.startAudioGraph();
      rafId = requestAnimationFrame(drawFrame);
    }).catch((err) => {
      finish();
      _exportRecorder = null;
      showToast('warning', '⚠️', 'Không thể phát video để ghi: ' + err.message, 5000);
      resolve(false);
    });

    video.addEventListener('ended', finish, { once: true });
  });
  });
}

/* Nếu người dùng bật "đổi giọng", giải mã + pitch-shift audio gốc của
   video một lần trước khi ghi (không thể làm real-time cho playbackRate
   độc lập với cao độ bằng Web Audio API cơ bản). Trả về opts đã gắn thêm
   pitchedBuffer + voiceoverTracks để _setupExportRecorder trộn vào. */
function _prepareVoiceMixOpts(video, opts) {
  const voiceoverTracks = (State.voiceoverTracks && State.voiceoverTracks.length) ? State.voiceoverTracks : null;

  if (!State.voicePitchEnabled || !State.voicePitch) {
    return Promise.resolve(Object.assign({}, opts, { voiceoverTracks }));
  }

  showToast('info', '🎚️', 'Đang xử lý đổi giọng trước khi ghi...', 3000);
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _decodeVideoAudioBuffer(video, audioCtx)
    .then((decoded) => {
      const shifted = pitchShiftBuffer(decoded, State.voicePitch, audioCtx);
      audioCtx.close();
      return Object.assign({}, opts, { pitchedBuffer: shifted, voiceoverTracks });
    })
    .catch((err) => {
      audioCtx.close();
      showToast('warning', '⚠️', 'Không đổi được giọng, xuất với giọng gốc: ' + err.message, 5000);
      return Object.assign({}, opts, { voiceoverTracks });
    });
}

/* Nạp một clip từ thư viện vào #main-video và chờ metadata sẵn sàng
   (dùng cho ghép nhiều clip — không đụng tới State/timeline UI). */
function _loadClipForRecording(video, clip) {
  return new Promise((resolve, reject) => {
    function onError() {
      video.removeEventListener('loadedmetadata', onLoaded);
      reject(new Error('Khong tai duoc clip "' + (clip.name || clip.id) + '"'));
    }
    function onLoaded() {
      video.removeEventListener('error', onError);
      resolve();
    }
    video.addEventListener('loadedmetadata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.src = clip.src;
    video.load();
  });
}

/* Ghép toàn bộ clip trong thư viện (theo đúng thứ tự trên timeline)
   thành 1 video và tải về — phát tuần tự từng clip vào cùng một
   canvas + MediaRecorder đang ghi liên tục, không dừng giữa chừng. */
function mergeAndExportClips(opts) {
  opts = opts || {};
  if (State.clips.length === 0) {
    showToast('warning', '⚠️', 'Chưa có video nào trong thư viện!');
    return Promise.resolve(false);
  }
  if (State.clips.length === 1) {
    return exportVideoReal(opts); // chỉ 1 clip thì ghép = tải bình thường
  }
  if (_exportRecorder) {
    showToast('warning', '!', 'Đang xử lý video, vui lòng chờ...');
    return Promise.resolve(false);
  }
  if (typeof MediaRecorder === 'undefined') {
    showToast('warning', '⚠️', 'Trình duyệt không hỗ trợ tải video (cần Chrome/Edge).', 5000);
    return Promise.resolve(false);
  }

  const clips = State.clips.slice().sort((a, b) => (a.start || 0) - (b.start || 0));
  const video = document.getElementById('main-video');
  if (!video) return Promise.resolve(false);

  const filename = opts.filename ||
    (document.getElementById('export-filename')?.value || 'HD68_merged').trim() || 'HD68_merged';
  const onProgress = opts.onProgress || function() {};
  const totalDur   = clips.reduce((s, c) => s + (c.duration || 0), 0) || 1;

  // Nhớ clip + vị trí người dùng đang xem để khôi phục lại player sau khi ghép xong
  const originalClip = State.clips.find(c => c.src === video.src) || State.clips[0];
  const originalTime = video.currentTime;

  return _loadClipForRecording(video, clips[0]).then(() => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) {
      showToast('warning', '⚠️', 'Video chưa sẵn sàng, thử lại sau giây lát.');
      return false;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    const setup = _setupExportRecorder(video, canvas, Object.assign({}, opts, {
      voiceoverTracks: (State.voiceoverTracks && State.voiceoverTracks.length) ? State.voiceoverTracks : null,
    }));
    if (!setup) return false;
    const { recorder, mimeType, ext, chunks } = setup;

    showToast('info', '🔗', 'Đang ghép ' + clips.length + ' video (khoảng ' + Math.ceil(totalDur) + 's)...', 4000);

    return new Promise((resolve) => {
      const wasFilter = video.style.filter;
      let encodeError = null;
      let elapsedBefore = 0;

      recorder.onerror = (e) => {
        encodeError = (e && e.error && e.error.message) || 'Loi encoder khong xac dinh';
        if (recorder.state !== 'inactive') recorder.stop();
      };

      recorder.onstop = () => {
        _exportRecorder = null;
        if (setup.audioCtx) setup.audioCtx.close();

        // Trả player về đúng clip + vị trí trước khi ghép, không để lại ở clip cuối cùng
        if (originalClip) {
          _loadClipForRecording(video, originalClip).then(() => {
            video.currentTime = originalTime;
            video.pause();
          });
        }

        if (encodeError) {
          showToast('warning', '⚠️', 'Ghép video thất bại: ' + encodeError, 6000);
          resolve(false);
          return;
        }
        _downloadBlob(new Blob(chunks, { type: mimeType }), filename + '.' + ext);
        onProgress(100);
        showToast('success', '🎉',
          'Đã ghép ' + clips.length + ' video thành "' + filename + '.' + ext + '" và tải về!', 5000);
        resolve(true);
      };

      _exportRecorder = recorder;
      recorder.start(250);
      playNextClip(0);

      function playNextClip(idx) {
        if (idx >= clips.length) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        const clip = clips[idx];
        const afterLoad = idx === 0 ? Promise.resolve() : _loadClipForRecording(video, clip);

        afterLoad.then(() => {
          video.currentTime = 0;
          let stopped = false;
          let deadlineId = null;

          function advance() {
            if (stopped) return;
            stopped = true;
            if (deadlineId) clearTimeout(deadlineId);
            video.removeEventListener('ended', advance);
            elapsedBefore += (clip.duration || video.duration || 0);
            playNextClip(idx + 1);
          }

          function drawFrame() {
            if (stopped) return;
            ctx.filter = wasFilter || 'none';
            ctx.drawImage(video, 0, 0, w, h);
            drawBurnedSubtitles(ctx, w, h, video.currentTime);
            onProgress(((elapsedBefore + video.currentTime) / totalDur) * 100);
            if (video.ended || video.paused) { advance(); return; }
            requestAnimationFrame(drawFrame);
          }

          video.play().then(() => {
            // Chỉ khởi động đồ thị âm thanh (track TTS...) một lần duy nhất,
            // ở đúng thời điểm clip đầu tiên bắt đầu chạy — đó là mốc 0 của
            // toàn bộ timeline ghép, các track TTS được lên lịch theo mốc này.
            if (idx === 0) setup.startAudioGraph();

            // Chốt an toàn kép (xem giải thích ở _recordSegment): rAF có
            // thể bị trình duyệt tạm dừng hẳn khi tab chạy nền, khiến
            // drawFrame() không bao giờ phát hiện video.ended cho clip
            // này — ghép sẽ bị treo ở giữa chừng và các clip sau bị lệch
            // thời lượng. 'ended' là sự kiện gốc không phụ thuộc rAF;
            // setTimeout là giới hạn cứng theo thời lượng clip.
            video.addEventListener('ended', advance, { once: true });
            const clipDur = clip.duration || video.duration || 0;
            deadlineId = setTimeout(advance, (clipDur / (video.playbackRate || 1) + 3) * 1000);
            requestAnimationFrame(drawFrame);
          }).catch((err) => {
            encodeError = err.message;
            if (recorder.state !== 'inactive') recorder.stop();
          });
        }).catch((err) => {
          encodeError = err.message;
          if (recorder.state !== 'inactive') recorder.stop();
        });
      }
    });
  });
}

/* Ghi lại đúng 1 đoạn [startTime, endTime) của #main-video ra 1 blob video
   (dùng chung bộ ghi canvas+MediaRecorder). Trả về {blob, ext} hoặc null
   nếu lỗi (đã tự hiện toast lỗi bên trong _setupExportRecorder/onerror). */
function _recordSegment(video, canvas, ctx, startTime, endTime, opts) {
  return new Promise((resolve) => {
    const setup = _setupExportRecorder(video, canvas, opts);
    if (!setup) { resolve(null); return; }
    const { recorder, mimeType, ext, chunks } = setup;
    const w = canvas.width, h = canvas.height;
    const wasFilter = video.style.filter;
    let rafId = null;
    let stopped = false;
    let encodeError = null;
    let deadlineId = null;

    function drawFrame() {
      if (stopped) return;
      ctx.filter = wasFilter || 'none';
      ctx.drawImage(video, 0, 0, w, h);
      drawBurnedSubtitles(ctx, w, h, video.currentTime);
      if (video.ended || video.currentTime >= endTime - 0.02) { finish(); return; }
      rafId = requestAnimationFrame(drawFrame);
    }

    function finish() {
      if (stopped) return;
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (deadlineId) clearTimeout(deadlineId);
      video.removeEventListener('ended', finish);
      video.pause();
      if (recorder.state !== 'inactive') recorder.stop();
    }

    recorder.onerror = (e) => {
      encodeError = (e && e.error && e.error.message) || 'Loi encoder khong xac dinh';
      finish();
    };

    recorder.onstop = () => {
      _exportRecorder = null;
      if (encodeError) {
        showToast('warning', '⚠️', 'Cắt video thất bại: ' + encodeError, 6000);
        resolve(null);
        return;
      }
      resolve({ blob: new Blob(chunks, { type: mimeType }), ext });
    };

    _exportRecorder = recorder;
    video.addEventListener('seeked', function onSeeked() {
      video.removeEventListener('seeked', onSeeked);
      recorder.start(250);

      // Chốt an toàn kép, gắn ngay sau khi recorder đã thật sự bắt đầu ghi
      // (không gắn sớm hơn — nếu seek chậm và hết hạn trước khi start(),
      // recorder.state vẫn 'inactive' nên finish() sẽ không gọi được
      // recorder.stop(), khiến onstop/resolve() không bao giờ chạy — Promise
      // treo vĩnh viễn). rAF có thể bị trình duyệt tạm dừng hẳn khi tab chạy
      // nền, khiến drawFrame() không bao giờ phát hiện điểm dừng — track
      // hình sẽ dài hơn hẳn track tiếng (bug thật đã gặp: hình 40s, tiếng
      // 10s). 'ended' là sự kiện gốc của thẻ video (không phụ thuộc rAF);
      // setTimeout là giới hạn cứng theo thời lượng đoạn, vẫn được gọi dù
      // tab chạy nền.
      video.addEventListener('ended', finish, { once: true });
      deadlineId = setTimeout(finish, ((endTime - startTime) / (video.playbackRate || 1) + 3) * 1000);

      video.play().then(() => {
        rafId = requestAnimationFrame(drawFrame);
      }).catch((err) => {
        encodeError = err.message;
        finish();
      });
    }, { once: true });
    video.currentTime = startTime;
  });
}

/* Cắt #main-video thành nhiều video ngắn liên tiếp (mỗi đoạn segmentSeconds
   giây), ghi lại thật từng đoạn qua canvas+MediaRecorder (giữ nguyên color
   grade + phụ đề đốt cứng như xem trước) và tải về từng file riêng. */
function splitVideoIntoClips(opts) {
  opts = opts || {};
  const video = document.getElementById('main-video');
  if (!video || !video.src || !video.duration) {
    showToast('warning', '⚠️', 'Vui lòng thêm video trước khi cắt!');
    return Promise.resolve(false);
  }
  if (_exportRecorder) {
    showToast('warning', '!', 'Đang xử lý video, vui lòng chờ...');
    return Promise.resolve(false);
  }
  if (typeof MediaRecorder === 'undefined') {
    showToast('warning', '⚠️', 'Trình duyệt không hỗ trợ tải video (cần Chrome/Edge).', 5000);
    return Promise.resolve(false);
  }
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) {
    showToast('warning', '⚠️', 'Video chưa sẵn sàng, thử lại sau giây lát.');
    return Promise.resolve(false);
  }

  const segDur = opts.segmentSeconds ||
    parseFloat(document.getElementById('split-duration-input')?.value) ||
    parseFloat(document.getElementById('mob-split-duration-input')?.value) || 15;
  if (!segDur || segDur <= 0) {
    showToast('warning', '⚠️', 'Độ dài mỗi đoạn phải lớn hơn 0 giây!');
    return Promise.resolve(false);
  }

  const totalDur     = video.duration;
  const numSegments  = Math.max(1, Math.ceil(totalDur / segDur));
  const filename      = (document.getElementById('export-filename')?.value || 'HD68_video').trim() || 'HD68_video';
  const onProgress    = opts.onProgress || function() {};
  const wasTime       = video.currentTime;
  const wasPaused     = video.paused;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  showToast('info', '✂️', 'Đang cắt video thành ' + numSegments + ' đoạn (' + segDur + 's/đoạn)...', 4000);

  function recordOne(idx) {
    if (idx >= numSegments) return Promise.resolve(true);
    const segStart = idx * segDur;
    const segEnd   = Math.min(totalDur, segStart + segDur);

    return _recordSegment(video, canvas, ctx, segStart, segEnd, opts).then((result) => {
      if (!result) return false;
      _downloadBlob(result.blob, filename + '_phan' + (idx + 1) + '.' + result.ext);
      onProgress(((idx + 1) / numSegments) * 100);
      return recordOne(idx + 1);
    });
  }

  return recordOne(0).then((ok) => {
    video.currentTime = wasTime;
    if (wasPaused) video.pause();
    if (ok) {
      onProgress(100);
      showToast('success', '🎉', 'Đã cắt xong ' + numSegments + ' video ngắn và tải về!', 5000);
    }
    return ok;
  }).catch((err) => {
    video.currentTime = wasTime;
    if (wasPaused) video.pause();
    showToast('warning', '⚠️', 'Lỗi khi cắt video: ' + err.message, 6000);
    return false;
  });
}

/* Vẽ phụ đề đang hiển thị (đúng style + vị trí + highlight từng từ nếu có)
   lên khung hình xuất, để video tải về giống hệt bản xem trước. */
function drawBurnedSubtitles(ctx, w, h, ct) {
  if (typeof AITools === 'undefined' || !AITools.isSubEnabled || !AITools.isSubEnabled()) return;
  const subs  = AITools.getSubtitles ? AITools.getSubtitles() : [];
  const style = AITools.getSubStyle ? AITools.getSubStyle() : null;
  if (!subs || !subs.length || !style) return;

  let active = null;
  for (let i = 0; i < subs.length; i++) {
    if (ct >= subs[i].start && ct < subs[i].end) { active = subs[i]; break; }
  }
  if (!active) return;

  const fontSize = Math.round((style.size || 19) * (h / 600));
  ctx.font = '700 ' + fontSize + 'px ' + (style.font || 'Inter') + ', sans-serif';
  ctx.textBaseline = 'middle';

  const posY = style.posY != null ? style.posY : 12;
  const cy = h - (h * (posY / 100)) - fontSize * 0.7;
  const cx = w / 2;

  let activeWordIdx = -1;
  if (active.words && active.words.length) {
    for (let i = 0; i < active.words.length; i++) {
      if (ct >= active.words[i].start) activeWordIdx = i; else break;
    }
  }

  const words  = (active.words && active.words.length) ? active.words.map(x => x.text) : active.text.split(' ');
  const spaceW = ctx.measureText(' ').width;
  const widths = words.map(t => ctx.measureText(t).width);
  const totalW = widths.reduce((a, b) => a + b, 0) + spaceW * (words.length - 1);

  const padX = fontSize * 0.7, padY = fontSize * 0.35;
  const boxX = cx - totalW / 2 - padX;
  const boxY = cy - fontSize / 2 - padY;
  const boxW = totalW + padX * 2;
  const boxH = fontSize + padY * 2;
  const r = 8;
  ctx.fillStyle = style.bgColor || 'rgba(0,0,0,0.82)';
  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, r);
  ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, r);
  ctx.arcTo(boxX, boxY + boxH, boxX, boxY, r);
  ctx.arcTo(boxX, boxY, boxX + boxW, boxY, r);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = 'left';
  let x = cx - totalW / 2;
  words.forEach((t, i) => {
    if (active.words && active.words.length) {
      ctx.fillStyle = i < activeWordIdx ? '#ffffff'
        : i === activeWordIdx ? '#ffe14d'
        : 'rgba(255,255,255,0.45)';
    } else {
      ctx.fillStyle = style.color || '#ffffff';
    }
    ctx.fillText(t, x, cy);
    x += widths[i] + spaceW;
  });
}

function saveProject() {
  const data = JSON.stringify({ clips: State.clips.length, filter: State.currentFilter, time: new Date().toISOString() });
  localStorage.setItem('hd68_project', data);
  showToast('success','💾','Dự án đã được lưu!');
}

// ──────────────────────────────────────────────
// FILTER PANEL
// ──────────────────────────────────────────────
function setupFilterPanel() {
  document.querySelectorAll('.filter-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const f = item.dataset.filter;
      State.currentFilter = f;
      Effects.applyFilter(f);
      showToast('info', '🎨', `Bộ lọc: ${item.querySelector('span').textContent}`);
    });
  });
}

// ──────────────────────────────────────────────
// EFFECTS PANEL (Speed, Transitions)
// ──────────────────────────────────────────────
function setupEffectsPanel() {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseFloat(btn.dataset.speed);
      State.speed = speed;
      const video = document.getElementById('main-video');
      if (video) video.playbackRate = speed;
      showToast('info','⚡',`Tốc độ: ${speed}x`);
    });
  });

  document.querySelectorAll('.transition-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.transition-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showToast('info','🎞️',`Transition: ${item.textContent}`);
    });
  });
}

// ──────────────────────────────────────────────
// TEXT PANEL
// ──────────────────────────────────────────────
function setupTextPanel() {
  document.getElementById('btn-add-text')?.addEventListener('click', addTextOverlay);
}

function addTextOverlay() {
  const text     = document.getElementById('text-input')?.value || 'HD68';
  const font     = document.getElementById('font-select')?.value || 'Inter';
  const size     = document.getElementById('font-size')?.value || '48';
  const color    = document.getElementById('font-color')?.value || '#ffffff';
  const shadow   = document.getElementById('font-shadow')?.value || '#7c3aed';

  const overlays = document.getElementById('text-overlays');
  const wrap     = document.getElementById('video-canvas-wrap');
  if (!overlays || !wrap) { showToast('warning','⚠️','Vui lòng thêm video trước!'); return; }

  const el = document.createElement('div');
  el.className = 'text-overlay';
  el.contentEditable = 'true';
  el.textContent = text;
  el.style.cssText = `
    top: 30%; left: 50%; transform: translateX(-50%);
    font-family: ${font}; font-size: ${size}px;
    color: ${color}; text-shadow: 0 4px 16px ${shadow};
    pointer-events: all; min-width: 40px; text-align: center;
  `;
  makeDraggable(el);
  overlays.appendChild(el);

  el.addEventListener('click', () => {
    document.querySelectorAll('.text-overlay').forEach(t => t.classList.remove('selected'));
    el.classList.add('selected');
  });

  showToast('success','✍️','Đã thêm văn bản vào video!');
}

function makeDraggable(el) {
  let sx, sy, ox, oy;
  el.addEventListener('mousedown', e => {
    if (e.target !== el) return;
    sx = e.clientX; sy = e.clientY;
    const rect = el.getBoundingClientRect();
    ox = rect.left; oy = rect.top;

    function move(ev) {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      el.style.left = (ox + dx) + 'px';
      el.style.top  = (oy + dy) + 'px';
      el.style.transform = 'none';
    }
    function up() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  });
}

// ──────────────────────────────────────────────
// RIGHT PANEL — Properties
// ──────────────────────────────────────────────
function showProps(show) {
  document.getElementById('props-no-clip')?.style.setProperty('display', show ? 'none' : 'flex');
  document.getElementById('props-clip-controls')?.style.setProperty('display', show ? 'block' : 'none');
}

function setupRightPanel() {
  showProps(false);

  function makePropRange(id, valId, suffix, handler) {
    const el = document.getElementById(id);
    const vl = document.getElementById(valId);
    el?.addEventListener('input', e => {
      if (vl) vl.textContent = e.target.value + suffix;
      if (handler) handler(parseFloat(e.target.value));
    });
  }

  makePropRange('prop-scale',    'prop-scale-val',      '%');
  makePropRange('prop-rotate',   'prop-rotate-val',     '°');
  makePropRange('prop-x',        'prop-x-val',          '');
  makePropRange('prop-y',        'prop-y-val',          '');
  makePropRange('prop-opacity',  'prop-opacity-val',    '%', v => {
    const video = document.getElementById('main-video');
    if (video) video.style.opacity = v/100;
  });
  makePropRange('prop-speed',    'prop-speed-val',      'x', v => {
    State.speed = v;
    const video = document.getElementById('main-video');
    if (video) video.playbackRate = v;
  });

  // Color sliders
  ['brightness','contrast','saturation','hue'].forEach(key => {
    const el = document.getElementById(`prop-${key}`);
    const vl = document.getElementById(`prop-${key}-val`);
    const suf = key === 'hue' ? '°' : '';
    el?.addEventListener('input', e => {
      State.colorSettings[key] = parseFloat(e.target.value);
      if (vl) vl.textContent = e.target.value + suf;
      Effects.applyColorAdjustments(State.colorSettings);
    });
  });
}

// ──────────────────────────────────────────────
// AI BUTTONS
// ──────────────────────────────────────────────
function setupAIButtons() {
  const mapping = {
    'btn-auto-cut':    'auto-cut',
    'btn-bg-remove':   'bg-remove',
    'btn-subtitle':    'subtitle',
    'btn-color-grade': 'color-grade',
    'btn-upscale':     'upscale',
    'btn-noise':       'noise',
    'btn-split-clips': 'split-clips',
  };

  Object.entries(mapping).forEach(([btnId, toolKey]) => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      // Cắt video ngắn là xử lý thật (ghi canvas+MediaRecorder theo từng
      // đoạn) — không đi qua thanh tiến trình giả lập của runTool().
      if (toolKey === 'split-clips') {
        const progressArea = document.getElementById('ai-progress-area');
        const progressLabel = document.getElementById('ai-progress-label');
        const progressFill = document.getElementById('ai-progress-fill');
        const progressPct = document.getElementById('ai-progress-pct');
        if (progressArea) progressArea.style.display = '';
        if (progressLabel) progressLabel.textContent = 'Đang cắt video...';
        splitVideoIntoClips({
          onProgress: (pct) => {
            const rounded = Math.round(pct);
            if (progressFill) progressFill.style.width = rounded + '%';
            if (progressPct) progressPct.textContent = rounded + '%';
          },
        }).then(() => {
          if (progressArea) progressArea.style.display = 'none';
        });
        return;
      }

      // Phụ đề dùng Whisper thật (xử lý audio ngoài luồng) — không đi qua
      // thanh tiến trình giả lập của runTool(), vì generateSubtitles() tự
      // quản lý tiến trình thật của riêng nó.
      if (toolKey === 'subtitle') {
        const video = document.getElementById('main-video');
        if (!video || !video.src || !video.duration) {
          showToast('warning', '⚠️',
            'Vui lòng thêm video vào player trước khi tạo phụ đề!', 4000);
          return;
        }

        if (!document.getElementById('btn-stop-subtitle')) {
          const stopBtn = document.createElement('button');
          stopBtn.id = 'btn-stop-subtitle';
          stopBtn.textContent = '⏹ Huỷ tạo phụ đề';
          stopBtn.style.cssText =
            'width:100%;padding:9px;margin-top:10px;border-radius:9px;' +
            'background:linear-gradient(135deg,#ef4444,#dc2626);' +
            'color:#fff;font-size:12px;font-weight:700;cursor:pointer;border:none;' +
            'box-shadow:0 4px 16px rgba(239,68,68,0.4);';
          stopBtn.addEventListener('click', () => {
            AITools.stopRecognition();
            stopBtn.remove();
            showToast('info', '⏹', 'Đã huỷ tạo phụ đề', 2500);
          });
          const card = document.getElementById('ai-tool-subtitle');
          if (card) card.after(stopBtn);
        }

        AITools.generateSubtitles();
        return;
      }

      AITools.runTool(toolKey, (key) => {
        const messages = {
          'auto-cut':    '✂️ Auto Cut: Timeline đã được tối ưu theo nhịp nhạc!',
          'bg-remove':   '🟢 Xóa nền thành công! Nền đã được xóa AI.',
          'color-grade': '🎨 Color Grade AI đã áp dụng tone màu Cinematic!',
          'upscale':     '📺 Video đã được nâng cấp lên 4K UHD thành công!',
          'noise':       '🔇 Tiếng ồn đã được khử hoàn toàn!',
        };
        showToast('success', '🤖', messages[key] || 'AI xử lý hoàn thành!', 4000);
        if (key === 'color-grade') AITools.applyColorGrade('cinematic');
      });
    });
  });
}

// ──────────────────────────────────────────────
// TIMELINE
// ──────────────────────────────────────────────
function setupTimeline() {
  // Zoom controls
  document.getElementById('tl-zoom-in')?.addEventListener('click', () => {
    State.zoom = Math.min(400, State.zoom + 25);
    document.getElementById('tl-zoom-label').textContent = State.zoom + '%';
    updateTimeline();
  });
  document.getElementById('tl-zoom-out')?.addEventListener('click', () => {
    State.zoom = Math.max(25, State.zoom - 25);
    document.getElementById('tl-zoom-label').textContent = State.zoom + '%';
    updateTimeline();
  });

  // Tool buttons
  document.querySelectorAll('.tl-btn[id^="tl-tool"]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tl-btn[id^="tl-tool"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Ghép các clip trong thư viện thành 1 video và tải về
  document.getElementById('btn-merge-clips')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-merge-clips');
    if (State.clips.length < 2) {
      showToast('warning', '⚠️', 'Cần ít nhất 2 video trong thư viện để ghép!');
      return;
    }
    if (btn) btn.disabled = true;
    mergeAndExportClips({}).finally(() => { if (btn) btn.disabled = false; });
  });

  // Click on timeline to seek
  document.getElementById('tracks-content')?.addEventListener('click', e => {
    const tc = document.getElementById('tracks-content');
    if (!tc) return;
    const rect = tc.getBoundingClientRect();
    const x = e.clientX - rect.left + tc.scrollLeft;
    const video = document.getElementById('main-video');
    if (!video || !video.duration) return;
    const pxPerSec = 80 * (State.zoom / 100);
    const t = x / pxPerSec;
    video.currentTime = Math.min(video.duration, Math.max(0, t));
  });
}

function addClipToTimeline(clip) {
  const track = document.getElementById('track-video');
  if (!track) return;

  // Remove empty hint
  track.querySelector('.track-empty-hint')?.remove();

  const pxPerSec = 80 * (State.zoom / 100);
  const start = getTotalDuration();
  const width = clip.duration * pxPerSec;

  const el = document.createElement('div');
  el.className = 'timeline-clip';
  el.style.left  = (start * pxPerSec) + 'px';
  el.style.width = width + 'px';
  el.dataset.id  = clip.id;
  el.innerHTML = `<div class="clip-thumb"></div>${clip.name.replace(/\.[^.]+$/,'').substring(0,20)}`;
  el.title = clip.name;

  el.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.timeline-clip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    State.selectedClipId = clip.id;
    showProps(true);
    loadClipIntoPlayer(clip);
  });

  track.appendChild(el);
  updateTimeline();
}

function getTotalDuration() {
  return State.clips.reduce((sum, c) => sum + (c.duration || 0), 0);
}

function updateTimeline() {
  const total = getTotalDuration();
  document.getElementById('tl-clips-count').textContent = State.clips.length + ' clips';
  document.getElementById('tl-duration').textContent = Effects.formatTime(total);
  document.getElementById('export-clips').textContent  = State.clips.length;
  document.getElementById('export-dur').textContent    = Effects.formatTime(total);

  const pxPerSec = 80 * (State.zoom / 100);
  Effects.drawRuler(null, Math.max(total, 30), State.zoom);

  // Set min-width on tracks
  const minW = Math.max(total * pxPerSec + 200, 600);
  document.querySelectorAll('.track').forEach(t => t.style.minWidth = minW + 'px');
  const ruler = document.getElementById('timeline-ruler');
  if (ruler) ruler.style.minWidth = minW + 'px';
}

// ──────────────────────────────────────────────
// COLOR GRADING PANEL
// ──────────────────────────────────────────────
function setupColorPanel() {
  // CG sliders
  ['temp','tint','vibrance','shadows','highlights'].forEach(key => {
    const el = document.getElementById(`cg-${key}`);
    const vl = document.getElementById(`cg-${key}-val`);
    el?.addEventListener('input', e => {
      if (vl) vl.textContent = e.target.value;
    });
  });

  // LUT buttons
  document.querySelectorAll('.lut-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lut-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lut = btn.id.replace('lut-','');
      const lutMap = {
        none: '', cinema: 'cinematic', fuji: 'warm', kodak: 'vintage', teal: 'cool', nordic: 'bw'
      };
      const video = document.getElementById('main-video');
      if (video) video.style.filter = Effects.FILTERS[lutMap[lut] || 'none'] || '';
      showToast('info','🎞️',`LUT: ${btn.textContent}`);
    });
  });
}

// ──────────────────────────────────────────────
// AUDIO PANEL
// ──────────────────────────────────────────────
function setupAudioPanel() {
  function makeAudioRange(id, valId, suffix) {
    const el = document.getElementById(id);
    const vl = document.getElementById(valId);
    el?.addEventListener('input', e => { if (vl) vl.textContent = e.target.value + suffix; });
  }
  makeAudioRange('master-vol','master-vol-val','%');
  makeAudioRange('fade-in',   'fade-in-val',  's');
  makeAudioRange('fade-out',  'fade-out-val', 's');

  document.getElementById('wf-play')?.addEventListener('click', () => {
    document.getElementById('wf-play')?.classList.add('active');
    document.getElementById('wf-stop')?.classList.remove('active');
  });
  document.getElementById('wf-stop')?.addEventListener('click', () => {
    document.getElementById('wf-stop')?.classList.add('active');
    document.getElementById('wf-play')?.classList.remove('active');
  });

  document.querySelectorAll('.bgm-add').forEach(btn => {
    btn.addEventListener('click', () => {
      showToast('success','🎵','Đã thêm nhạc nền vào dự án!');
    });
  });

  document.getElementById('audio-file-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    addAudioTrack(file);
  });
}

function addAudioTrack(file) {
  const list = document.getElementById('audio-tracks-list');
  if (!list) return;
  const item = document.createElement('div');
  item.className = 'audio-track-item';
  item.innerHTML = `
    <div class="audio-track-icon">🎵</div>
    <div class="audio-track-info">
      <div class="audio-track-name">${file.name}</div>
      <div class="audio-track-dur">--:--</div>
    </div>
    <div class="audio-track-controls">
      <button class="aud-btn">M</button>
      <button class="aud-btn aud-solo">S</button>
    </div>
  `;
  list.appendChild(item);
  showToast('success','🎵',`Đã thêm audio: ${file.name}`);
}

// ──────────────────────────────────────────────
// GIỌNG NÓI — Tạo giọng đọc (TTS) + Đổi giọng (pitch shift)
// Cả hai đều xử lý audio thật (Web Audio API + model TTS chạy trong
// browser), không phải mô phỏng — nối thẳng vào pipeline xuất video
// thật đã có (_setupExportRecorder).
// ──────────────────────────────────────────────

function _waitForGlobalReady(flagName, timeoutMs) {
  return new Promise((resolve) => {
    if (window[flagName]) return resolve();
    let waited = 0;
    const iv = setInterval(() => {
      waited += 200;
      if (window[flagName] || waited >= timeoutMs) { clearInterval(iv); resolve(); }
    }, 200);
  });
}

/* AudioBuffer -> WAV Blob (PCM 16-bit) để phát qua thẻ <audio> */
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate   = buffer.sampleRate;
  const numFrames    = buffer.length;
  const bytesPerSample = 2;
  const blockAlign   = numChannels * bytesPerSample;
  const dataSize     = numFrames * blockAlign;

  const bufOut = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bufOut);
  function writeStr(offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bufOut], { type: 'audio/wav' });
}

/* Float32Array (mono) + sampleRate -> AudioBuffer, dùng chung AudioContext */
function _floatArrayToAudioBuffer(float32, sampleRate, audioCtx) {
  const buf = audioCtx.createBuffer(1, float32.length, sampleRate);
  buf.copyToChannel(float32, 0);
  return buf;
}

/* Giọng Adam mặc định của ElevenLabs (voice có sẵn trên mọi tài khoản).
   Có thể ghi đè bằng ô "Voice ID" trong UI nếu tài khoản dùng voice khác. */
const ELEVENLABS_ADAM_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';
const ELEVENLABS_KEY_STORAGE   = 'hd68_elevenlabs_api_key';

function _getElevenLabsSettings(prefix) {
  const apiKey  = document.getElementById(prefix + 'elevenlabs-api-key')?.value.trim()
    || localStorage.getItem(ELEVENLABS_KEY_STORAGE) || '';
  const voiceId = document.getElementById(prefix + 'elevenlabs-voice-id')?.value.trim() || ELEVENLABS_ADAM_VOICE_ID;
  return { apiKey, voiceId };
}

/* Gọi thẳng ElevenLabs API từ trình duyệt (không có server riêng để giấu
   key) — trả về AudioBuffer đã giải mã từ MP3 nhận được. */
async function _generateElevenLabsVoiceover(text, apiKey, voiceId, setProgress) {
  if (!apiKey) throw new Error('Chưa nhập API key ElevenLabs');

  setProgress(30, '🌐 Đang gọi ElevenLabs API...');
  const resp = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!resp.ok) {
    let detail = resp.statusText;
    try { detail = (await resp.json())?.detail?.message || detail; } catch (e) {}
    if (resp.status === 401) throw new Error('API key không hợp lệ');
    if (resp.status === 404) throw new Error('Không tìm thấy voice ID "' + voiceId + '"');
    if (resp.status === 429) throw new Error('Hết quota ElevenLabs hoặc bị giới hạn tốc độ');
    throw new Error('ElevenLabs lỗi ' + resp.status + ': ' + detail);
  }

  setProgress(75, '💾 Đang xử lý âm thanh...');
  const mp3Buf = await resp.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(mp3Buf);
  audioCtx.close();
  return decoded;
}

/* Model TTS miễn phí chạy trong trình duyệt (MMS-TTS qua transformers.js) */
async function _generateLocalVoiceover(text, lang, setProgress) {
  if (!window.HD68LoadTTS) await _waitForGlobalReady('HD68TTSReady', 8000);
  if (!window.HD68LoadTTS) throw new Error('Chưa tải xong bộ giọng đọc, thử lại sau giây lát');

  const synth = await window.HD68LoadTTS(lang, (p) => {
    if (p && p.status === 'progress' && typeof p.progress === 'number') {
      setProgress(10 + p.progress * 0.5, '📦 Đang tải mô hình... ' + Math.round(p.progress) + '%');
    }
  });

  setProgress(70, '🗣️ Đang tạo giọng đọc...');
  const output = await synth(text);
  setProgress(95, '💾 Đang xử lý âm thanh...');

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = _floatArrayToAudioBuffer(output.audio, output.sampling_rate, audioCtx);
  audioCtx.close();
  return buffer;
}

/* ── TTS: tạo giọng đọc từ văn bản ── */
/* prefix = '' cho bộ điều khiển desktop, 'mob-' cho bộ điều khiển mobile —
   hai bản UI dùng chung 1 State.voiceoverTracks/voicePitch* nên luôn đồng bộ. */
async function generateVoiceover(prefix) {
  prefix = prefix || '';
  const textEl   = document.getElementById(prefix + 'tts-text');
  const langEl   = document.getElementById(prefix + 'tts-lang');
  const engineEl = document.getElementById(prefix + 'tts-engine');
  const btn      = document.getElementById(prefix + 'btn-tts-generate');
  const text     = (textEl?.value || '').trim();
  const lang     = langEl?.value || 'vi';
  const engine   = engineEl?.value || 'local';

  if (!text) {
    showToast('warning', '⚠️', 'Vui lòng nhập văn bản muốn đọc!');
    return;
  }
  if (typeof MediaRecorder === 'undefined' && typeof AudioContext === 'undefined') {
    showToast('warning', '⚠️', 'Trình duyệt không hỗ trợ tạo giọng đọc.', 5000);
    return;
  }

  const progressArea  = document.getElementById(prefix + 'tts-progress');
  const progressFill  = document.getElementById(prefix + 'tts-progress-fill');
  const progressLabel = document.getElementById(prefix + 'tts-progress-label');
  function setProgress(pct, label) {
    if (progressArea)  progressArea.style.display = 'block';
    if (progressFill)  progressFill.style.width = pct + '%';
    if (progressLabel) progressLabel.textContent = label;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Đang tạo...'; }
  setProgress(10, engine === 'elevenlabs' ? '🌐 Đang kết nối ElevenLabs...' : '📦 Đang tải mô hình giọng đọc...');

  try {
    let buffer, voiceLabel;
    if (engine === 'elevenlabs') {
      const { apiKey, voiceId } = _getElevenLabsSettings(prefix);
      buffer = await _generateElevenLabsVoiceover(text, apiKey, voiceId, setProgress);
      voiceLabel = 'Adam';
    } else {
      buffer = await _generateLocalVoiceover(text, lang, setProgress);
      voiceLabel = null;
    }

    const track = {
      id: Date.now() + Math.random(),
      name: (voiceLabel ? '[' + voiceLabel + '] ' : '') + (text.length > 24 ? text.slice(0, 24) + '…' : text),
      lang, buffer,
      startTime: 0,
      volume: 1,
    };
    State.voiceoverTracks.push(track);
    renderVoiceoverTracks();

    setProgress(100, '✅ Đã tạo xong giọng đọc!');
    setTimeout(() => { if (progressArea) progressArea.style.display = 'none'; }, 1500);
    showToast('success', '🎉', 'Đã tạo giọng đọc "' + track.name + '"!', 4000);
    if (textEl) textEl.value = '';
  } catch (err) {
    showToast('warning', '⚠️', 'Lỗi tạo giọng đọc: ' + err.message, 6000);
    if (progressArea) progressArea.style.display = 'none';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Tạo giọng đọc'; }
  }
}

function renderVoiceoverTracks() {
  ['voiceover-tracks-list', 'mob-voiceover-tracks-list'].forEach((listId) => {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';

    State.voiceoverTracks.forEach((track) => {
      const url = URL.createObjectURL(audioBufferToWav(track.buffer));
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 8px;' +
        'border-radius:8px;margin-bottom:5px;background:rgba(255,255,255,0.03);' +
        'border:1px solid rgba(255,255,255,0.06);';
      row.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;color:rgba(255,255,255,0.85);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${track.name}</div>
          <div style="font-size:9px;color:rgba(255,255,255,0.35);display:flex;gap:6px;align-items:center;margin-top:3px;">
            <span>${track.buffer.duration.toFixed(1)}s</span>
            <span>Bắt đầu tại</span>
            <input type="number" step="0.1" min="0" value="${track.startTime}" data-action="start" style="width:52px;padding:2px 4px;border-radius:5px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);color:#fff;font-size:9px;"/>s
          </div>
        </div>
        <audio controls src="${url}" style="height:26px;max-width:120px;"></audio>
        <button data-action="delete" style="width:22px;height:22px;border-radius:5px;
          border:1px solid rgba(239,68,68,0.25);background:rgba(239,68,68,0.08);
          color:rgba(239,68,68,0.7);cursor:pointer;font-size:14px;flex-shrink:0;">&times;</button>
      `;
      row.querySelector('[data-action="start"]')?.addEventListener('input', (e) => {
        track.startTime = Math.max(0, parseFloat(e.target.value) || 0);
      });
      row.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        URL.revokeObjectURL(url);
        State.voiceoverTracks = State.voiceoverTracks.filter(t => t.id !== track.id);
        renderVoiceoverTracks();
      });
      list.appendChild(row);
    });
  });
}

/* ── Đổi giọng: pitch-shift bằng granular overlap-add (WSOLA đơn giản) ──
   Kỹ thuật thật: cắt audio thành các "hạt" (grain) nhỏ, resample từng hạt
   theo tỉ lệ cao độ mong muốn rồi ghép chồng lấn (overlap-add) để giữ
   nguyên thời lượng gốc trong khi đổi cao độ. */
function pitchShiftBuffer(buffer, semitones, audioCtx) {
  if (!semitones) return buffer;
  const pitchRatio  = Math.pow(2, semitones / 12);
  const numChannels = buffer.numberOfChannels;
  const sampleRate  = buffer.sampleRate;
  const inLen       = buffer.length;
  const grainSize   = 4096;
  const hop         = Math.floor(grainSize / 4); // 75% overlap

  const outBuffer = audioCtx.createBuffer(numChannels, inLen, sampleRate);

  // Hann window để ghép các hạt không bị rè/click
  const window_ = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    window_[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (grainSize - 1));
  }

  for (let c = 0; c < numChannels; c++) {
    const inData  = buffer.getChannelData(c);
    const outData = outBuffer.getChannelData(c);
    const norm    = new Float32Array(inLen); // để chia chuẩn hoá biên độ overlap

    for (let pos = 0; pos < inLen; pos += hop) {
      const grain = new Float32Array(grainSize);
      // Đọc hạt từ vị trí đã resample theo pitchRatio (thay đổi cao độ)
      for (let i = 0; i < grainSize; i++) {
        const srcIdx = pos + i * pitchRatio;
        const i0 = Math.floor(srcIdx);
        const frac = srcIdx - i0;
        const s0 = i0 < inLen ? inData[i0] : 0;
        const s1 = (i0 + 1) < inLen ? inData[i0 + 1] : 0;
        grain[i] = (s0 + (s1 - s0) * frac) * window_[i];
      }
      for (let i = 0; i < grainSize && (pos + i) < inLen; i++) {
        outData[pos + i] += grain[i];
        norm[pos + i]    += window_[i];
      }
    }
    for (let i = 0; i < inLen; i++) {
      if (norm[i] > 0.0001) outData[i] /= norm[i];
    }
  }

  return outBuffer;
}

/* Giải mã audio hiện có của #main-video thành AudioBuffer (sample rate gốc) */
async function _decodeVideoAudioBuffer(video, audioCtx) {
  const resp = await fetch(video.src);
  const buf  = await resp.arrayBuffer();
  return audioCtx.decodeAudioData(buf);
}

async function previewVoiceChange(prefix) {
  prefix = prefix || '';
  const video = document.getElementById('main-video');
  const btn   = document.getElementById(prefix + 'btn-voice-preview');
  const progressEl = document.getElementById(prefix + 'voice-preview-progress');
  if (!video || !video.src || !video.duration) {
    showToast('warning', '⚠️', 'Vui lòng thêm video trước!');
    return;
  }
  const semitones = parseInt(document.getElementById(prefix + 'voice-pitch')?.value, 10) || 0;
  if (!semitones) {
    showToast('info', 'ℹ️', 'Cao độ đang là 0 — chọn 1 preset hoặc kéo thanh trượt trước khi nghe thử.', 3500);
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang xử lý...'; }
  if (progressEl) { progressEl.style.display = 'block'; progressEl.textContent = 'Đang tách và đổi giọng...'; }

  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded  = await _decodeVideoAudioBuffer(video, audioCtx);
    const shifted  = pitchShiftBuffer(decoded, semitones, audioCtx);

    const src = audioCtx.createBufferSource();
    src.buffer = shifted;
    src.connect(audioCtx.destination);
    src.start(0);
    src.onended = () => { audioCtx.close(); };

    showToast('success', '🔊', 'Đang phát thử giọng đã đổi...', 3000);
  } catch (err) {
    showToast('warning', '⚠️', 'Lỗi nghe thử: ' + err.message, 5000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔊 Nghe thử'; }
    if (progressEl) progressEl.style.display = 'none';
  }
}

/* Desktop và mobile là 2 bộ DOM riêng cho cùng 1 tính năng (giống các
   sheet mobile khác trong app này) — dùng chung State.voicePitch* nên
   luôn khớp nhau, chỉ khác id (tiền tố 'mob-'). */
function _syncVoicePitchUI(val) {
  ['', 'mob-'].forEach((prefix) => {
    const slider = document.getElementById(prefix + 'voice-pitch');
    const label  = document.getElementById(prefix + 'voice-pitch-val');
    if (slider) slider.value = val;
    if (label) label.textContent = val > 0 ? '+' + val : String(val);
  });
}

function setupVoiceTools() {
  const savedKey = localStorage.getItem(ELEVENLABS_KEY_STORAGE) || '';

  ['', 'mob-'].forEach((prefix) => {
    document.getElementById(prefix + 'btn-tts-generate')?.addEventListener('click', () => generateVoiceover(prefix));

    // Engine chọn "Adam - ElevenLabs" -> hiện ô nhập API key/voice ID
    const engineEl   = document.getElementById(prefix + 'tts-engine');
    const settingsEl = document.getElementById(prefix + 'elevenlabs-settings');
    engineEl?.addEventListener('change', (e) => {
      if (settingsEl) settingsEl.style.display = e.target.value === 'elevenlabs' ? 'block' : 'none';
    });

    // Ghi nhớ API key trong trình duyệt của người dùng (không đưa vào code/git)
    const apiKeyEl = document.getElementById(prefix + 'elevenlabs-api-key');
    if (apiKeyEl && savedKey) apiKeyEl.value = savedKey;
    apiKeyEl?.addEventListener('change', (e) => {
      localStorage.setItem(ELEVENLABS_KEY_STORAGE, e.target.value.trim());
    });

    document.getElementById(prefix + 'voice-pitch')?.addEventListener('input', (e) => {
      State.voicePitch = parseInt(e.target.value, 10) || 0;
      _syncVoicePitchUI(State.voicePitch);
    });

    document.querySelectorAll('.' + (prefix ? 'mob-' : '') + 'voice-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        State.voicePitch = parseInt(btn.getAttribute('data-pitch'), 10) || 0;
        _syncVoicePitchUI(State.voicePitch);
      });
    });

    document.getElementById(prefix + 'voice-change-enable')?.addEventListener('change', (e) => {
      State.voicePitchEnabled = e.target.checked;
      ['', 'mob-'].forEach((p) => {
        const cb = document.getElementById(p + 'voice-change-enable');
        if (cb) cb.checked = State.voicePitchEnabled;
      });
    });

    document.getElementById(prefix + 'btn-voice-preview')?.addEventListener('click', () => previewVoiceChange(prefix));
  });
}

// ──────────────────────────────────────────────
// EXPORT PANEL
// ──────────────────────────────────────────────
function setupExportPanel() {
  // Format buttons
  document.querySelectorAll('.format-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.format-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Quality cards
  document.querySelectorAll('.quality-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.quality-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const labels = { 'qcard-720':'HD 720p', 'qcard-1080':'Full HD 1080p', 'qcard-4k':'4K UHD' };
      document.getElementById('export-quality-label').textContent = labels[card.id] || '';
      const sizes = { 'qcard-720':'~150 MB', 'qcard-1080':'~350 MB', 'qcard-4k':'~1.2 GB' };
      document.getElementById('export-size-est').textContent = sizes[card.id] || '';
    });
  });

  // FPS buttons
  document.querySelectorAll('.fps-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fps-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('btn-start-export')?.addEventListener('click', startExport);

  // Share buttons
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const platform = btn.id.replace('share-','');
      showToast('info','📤',`Chuẩn bị chia sẻ lên ${platform.toUpperCase()}...`);
    });
  });
}

function updateExportPanel() {
  const total = getTotalDuration();
  document.getElementById('export-dur').textContent   = Effects.formatTime(total);
  document.getElementById('export-clips').textContent = State.clips.length;
}

function startExport() {
  const video = document.getElementById('main-video');
  if (State.clips.length === 0 || !video || !video.src) {
    showToast('warning','⚠️','Vui lòng thêm video vào timeline trước khi xuất!');
    return;
  }

  const btn = document.getElementById('btn-start-export');
  const progressArea = document.getElementById('export-progress-area');
  const fill = document.getElementById('ep-fill');
  const pct  = document.getElementById('ep-pct');
  const stage = document.getElementById('ep-stage');
  const timeLeft = document.getElementById('ep-time-left');
  const filename = document.getElementById('export-filename')?.value || 'HD68_output';

  const bitrateMap = { 'qcard-720': 4000000, 'qcard-1080': 8000000, 'qcard-4k': 20000000 };
  const activeQuality = document.querySelector('.quality-card.active')?.id;
  const videoBitsPerSecond = bitrateMap[activeQuality] || 8000000;

  btn.disabled = true;
  btn.textContent = 'Đang xuất...';
  if (progressArea) progressArea.style.display = 'block';
  if (stage) stage.textContent = 'Đang ghi video theo thời lượng thực...';

  const startedAt = Date.now();
  exportVideoReal({
    filename,
    videoBitsPerSecond,
    onProgress: (p) => {
      if (fill) fill.style.width = p + '%';
      if (pct)  pct.textContent  = Math.round(p) + '%';
      if (timeLeft && p > 0) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const remain  = Math.max(0, elapsed / (p / 100) - elapsed);
        timeLeft.textContent = '~' + Math.ceil(remain) + 's';
      }
    },
  }).then((ok) => {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="20"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg> XUẤT VIDEO HD68`;
    if (stage) stage.textContent = ok ? '✅ Xuất hoàn thành!' : 'Xuất thất bại';
    if (ok) {
      addExportHistory(filename);
      State.exportCompleted = true;
      goToStep(4);
    }
  });
}

function addExportHistory(name) {
  const history = document.getElementById('export-history');
  if (!history) return;
  history.querySelector('.history-empty')?.remove();

  const item = document.createElement('div');
  item.className = 'history-item';
  const quality = document.querySelector('.quality-card.active')?.querySelector('.qcard-label')?.textContent || '1080p';
  const format = document.querySelector('.format-opt.active')?.textContent || 'MP4';
  item.innerHTML = `
    <div class="history-item-thumb"></div>
    <div class="history-item-info">
      <div class="history-item-name">${name}.${format.toLowerCase()}</div>
      <div class="history-item-meta">${quality} • ${new Date().toLocaleTimeString('vi-VN')}</div>
    </div>
    <div class="history-item-dl">↓</div>
  `;
  history.insertBefore(item, history.firstChild);

  State.exportHistory.push({ name, quality, format, time: new Date() });
}

// ──────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ──────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    switch(e.code) {
      case 'Space':       e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft':   e.preventDefault(); skipBy(-5); break;
      case 'ArrowRight':  e.preventDefault(); skipBy(5); break;
      case 'KeyM':        document.getElementById('btn-mute')?.click(); break;
      case 'KeyF':        document.getElementById('btn-fullscreen')?.click(); break;
      case 'KeyS':        if(e.ctrlKey || e.metaKey) { e.preventDefault(); saveProject(); } break;
      case 'KeyZ':        if(e.ctrlKey || e.metaKey) showToast('info','↩️','Hoàn tác'); break;
      case 'KeyY':        if(e.ctrlKey || e.metaKey) showToast('info','↪️','Làm lại'); break;
      case 'Escape':
        document.querySelectorAll('.text-overlay').forEach(t => t.classList.remove('selected'));
        document.querySelectorAll('.timeline-clip').forEach(c => c.classList.remove('selected'));
        break;
    }
  });
}

function skipBy(sec) {
  const video = document.getElementById('main-video');
  if (video) video.currentTime = Math.max(0, Math.min(video.duration||0, video.currentTime + sec));
}

// ──────────────────────────────────────────────
// START!
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', runSplash);
