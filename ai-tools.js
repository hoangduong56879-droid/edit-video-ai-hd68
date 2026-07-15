'use strict';

/* ========================================================
   EDIT VIDEO AI HD68 — AI Tools Module
   v3.0 — Full Subtitle System:
     + Timed display (RAF loop)
     + Color / Font / Size / BG customization
     + Auto translate (VI / EN / KO / JA)
     + Timeline drag-to-adjust timing
   ======================================================== */

const AITools = (function() {

  /* ──────────────────────────────────────────────────────────
     AI STAGE DEFINITIONS
  ────────────────────────────────────────────────────────── */
  var AI_STAGES = {
    'auto-cut': [
      { label: 'Phan tich am thanh...', pct: 15 },
      { label: 'Phat hien nhip dieu...', pct: 30 },
      { label: 'Tinh toan diem cat toi uu...', pct: 55 },
      { label: 'Ap dung cat tu dong...', pct: 80 },
      { label: 'Hoan thien timeline...', pct: 95 },
      { label: '✅ AI Auto Cut hoan thanh!', pct: 100 },
    ],
    'bg-remove': [
      { label: 'Phan tich khung hinh...', pct: 10 },
      { label: 'Tach nen SegmentNet AI...', pct: 35 },
      { label: 'Tinh chinh vung bien...', pct: 60 },
      { label: 'Xu ly alpha channel...', pct: 80 },
      { label: 'Render ket qua...', pct: 95 },
      { label: '✅ Xoa nen hoan thanh!', pct: 100 },
    ],
    'subtitle': [
      { label: 'Khoi dong AI Whisper Engine...', pct: 10 },
      { label: 'Nhan dang giong noi...', pct: 30 },
      { label: 'Dich thuat & can thoi gian...', pct: 55 },
      { label: 'Tao file SRT/VTT...', pct: 75 },
      { label: 'Burn-in phu de...', pct: 90 },
      { label: '✅ Phu de tu dong hoan thanh!', pct: 100 },
    ],
    'color-grade': [
      { label: 'Phan tich histogram mau...', pct: 15 },
      { label: 'Ap dung AI LUT Engine...', pct: 40 },
      { label: 'Can bang trang thong minh...', pct: 65 },
      { label: 'Toi uu do tuong phan...', pct: 85 },
      { label: '✅ Color Grade hoan thanh!', pct: 100 },
    ],
    'upscale': [
      { label: 'Khoi dong Real-ESRGAN AI...', pct: 10 },
      { label: 'Phan tich do phan giai goc...', pct: 25 },
      { label: 'Upscale frame 1/240...', pct: 45 },
      { label: 'Upscale frame 120/240...', pct: 70 },
      { label: 'Upscale frame 240/240...', pct: 88 },
      { label: 'Encode 4K UHD...', pct: 95 },
      { label: '✅ Upscale 4K hoan thanh!', pct: 100 },
    ],
    'noise': [
      { label: 'Phan tich tap am...', pct: 20 },
      { label: 'Xay dung noise profile...', pct: 45 },
      { label: 'Khu tieng on DeepFilter AI...', pct: 70 },
      { label: 'Toi uu am thanh...', pct: 90 },
      { label: '✅ Khu nhieu hoan thanh!', pct: 100 },
    ],
  };

  /* ──────────────────────────────────────────────────────────
     TRANSLATION DICTIONARY
  ────────────────────────────────────────────────────────── */
  var TRANSLATIONS = {
    vi: [
      'Chao mung den voi EDIT VIDEO AI HD68',
      'Phan mem chinh sua video thong minh nhat',
      'Powered by AI — Tuong lai cua video editing',
      'Tan huong chat luong 4K Ultra HD',
      'AI Auto Cut, Background Remover, Upscale',
      'Tao phu de tu dong bang Whisper AI',
    ],
    en: [
      'Welcome to EDIT VIDEO AI HD68',
      'The smartest video editing software',
      'Powered by AI — The future of video editing',
      'Enjoy 4K Ultra HD quality',
      'AI Auto Cut, Background Remover, Upscale',
      'Auto subtitle generation by Whisper AI',
    ],
    ko: [
      'EDIT VIDEO AI HD68에 오신 것을 환영합니다',
      '가장 스마트한 영상 편집 소프트웨어',
      'AI 기반 — 영상 편집의 미래',
      '4K Ultra HD 화질을 즐기세요',
      'AI 자동 컷, 배경 제거, 업스케일',
      'Whisper AI로 자막 자동 생성',
    ],
    ja: [
      'EDIT VIDEO AI HD68へようこそ',
      '最もスマートな動画編集ソフトウェア',
      'AI搭載 — 動画編集の未来',
      '4K Ultra HD クオリティをお楽しみください',
      'AI自動カット、背景除去、アップスケール',
      'Whisper AIによる自動字幕生成',
    ],
  };

  /* ──────────────────────────────────────────────────────────
     SUBTITLE STATE
  ────────────────────────────────────────────────────────── */
  var subtitleList  = [];
  var subRafId      = null;
  var subEnabled    = true;
  var currentLang   = 'vi';
  var subStyle = {
    color:      '#ffffff',
    font:       'Inter',
    size:       19,          // px
    bgColor:    'rgba(0,0,0,0.82)',
    bgOpacity:  0.82,
    outline:    true,
    posY:       12,          // % chiều cao video tính từ đáy lên — vị trí phụ đề
  };

  /* Current subtitle animation style */
  var subAnimStyle = 'normal'; // normal | karaoke | fade | slideup | slidedown | typewriter | bounce | neon | wave | zoom | glitch

  /* Map animStyle => CSS class */
  var ANIM_CLASS_MAP = {
    normal:      '',
    karaoke:     'hd68-sub-karaoke',
    fade:        'hd68-sub-fade',
    slideup:     'hd68-sub-slideup',
    slidedown:   'hd68-sub-slidedown',
    typewriter:  'hd68-sub-typewriter',
    bounce:      'hd68-sub-bounce',
    neon:        'hd68-sub-neon',
    wave:        'hd68-sub-wave',
    zoom:        'hd68-sub-zoom',
    glitch:      'hd68-sub-glitch',
  };

  /* ──────────────────────────────────────────────────────────
     isRunning flag
  ────────────────────────────────────────────────────────── */
  var isRunning = false;

  /* ──────────────────────────────────────────────────────────
     runTool — generic AI progress runner
  ────────────────────────────────────────────────────────── */
  function runTool(toolKey, onComplete) {
    if (isRunning) {
      showToast('warning', '!', 'AI dang xu ly, vui long cho...');
      return;
    }

    var stages = AI_STAGES[toolKey];
    if (!stages) return;

    isRunning = true;

    var progressArea  = document.getElementById('ai-progress-area');
    var progressLabel = document.getElementById('ai-progress-label');
    var progressFill  = document.getElementById('ai-progress-fill');
    var progressPct   = document.getElementById('ai-progress-pct');

    var btnIdMap = {
      'auto-cut':    'btn-auto-cut',
      'bg-remove':   'btn-bg-remove',
      'subtitle':    'btn-subtitle',
      'color-grade': 'btn-color-grade',
      'upscale':     'btn-upscale',
      'noise':       'btn-noise',
    };
    var runBtn = document.getElementById(btnIdMap[toolKey]);

    if (progressArea) progressArea.style.display = 'block';
    if (runBtn) {
      runBtn.textContent = 'Dang chay...';
      runBtn.classList.add('running');
      runBtn.disabled = true;
    }

    document.querySelectorAll('.ai-tool-card').forEach(function(c) {
      c.style.opacity = '0.5';
    });
    var toolCard = document.getElementById('ai-tool-' + toolKey);
    if (toolCard) {
      toolCard.style.opacity = '1';
      toolCard.style.outline = '2px solid var(--purple)';
    }

    var stageIdx = 0;

    function runStage() {
      if (stageIdx >= stages.length) {
        isRunning = false;
        if (runBtn) {
          runBtn.textContent = 'Chay';
          runBtn.classList.remove('running');
          runBtn.disabled = false;
        }
        document.querySelectorAll('.ai-tool-card').forEach(function(c) {
          c.style.opacity = '1';
          c.style.outline = '';
        });
        if (toolCard) {
          toolCard.style.boxShadow = '0 0 20px rgba(6,182,212,0.4)';
          setTimeout(function() { toolCard.style.boxShadow = ''; }, 3000);
        }
        if (onComplete) onComplete(toolKey);
        return;
      }

      var stage = stages[stageIdx];
      if (progressLabel) progressLabel.textContent = stage.label;
      if (progressFill)  progressFill.style.width  = stage.pct + '%';
      if (progressPct)   progressPct.textContent   = stage.pct + '%';

      stageIdx++;
      setTimeout(runStage, 400 + Math.random() * 500);
    }

    runStage();
  }

  /* ──────────────────────────────────────────────────────────
     generateSubtitles — Nhận dạng giọng nói thực từ audio video
     bằng Whisper chạy thẳng trong trình duyệt (@xenova/transformers,
     nạp sẵn ở index.html qua window.HD68LoadWhisper). Đọc đúng track
     audio của video — không cần microphone, không cần mạng ngoài
     lần tải model đầu tiên, chạy được trên mọi trình duyệt hỗ trợ
     WebAssembly.
  ────────────────────────────────────────────────────────── */
  var _subRunId   = 0;      // tăng mỗi lần chạy để loại bỏ kết quả của lần chạy cũ
  var _subAborted = false;

  function _waitForWhisperReady(timeoutMs) {
    return new Promise(function(resolve) {
      if (window.HD68LoadWhisper) return resolve();
      var waited = 0;
      var iv = setInterval(function() {
        waited += 200;
        if (window.HD68LoadWhisper || waited >= timeoutMs) {
          clearInterval(iv);
          resolve();
        }
      }, 200);
    });
  }

  /* Giải mã audio track của video → Float32Array mono 16kHz cho Whisper */
  async function _extractAudioForWhisper(video) {
    var resp = await fetch(video.src);
    var buf  = await resp.arrayBuffer();

    var DecodeCtx = window.AudioContext || window.webkitAudioContext;
    var decodeCtx = new DecodeCtx();
    var decoded;
    try {
      decoded = await decodeCtx.decodeAudioData(buf);
    } finally {
      try { decodeCtx.close(); } catch(e) {}
    }

    if (!decoded.length) throw new Error('Video khong co du lieu am thanh');

    var targetRate = 16000;
    var offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
    var src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    var rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  }

  /* Gộp các từ (word-level timestamps) thành cụm phụ đề ngắn kiểu CapCut —
     ngắt cụm khi gặp khoảng lặng, dấu câu kết thúc câu, hoặc quá dài, để
     phụ đề luôn bám sát đúng đoạn đang nói thay vì hiện nguyên câu dài
     tĩnh trong khi giọng nói đã trôi qua nhiều đoạn khác. */
  function _groupWordsIntoCues(words, videoDuration) {
    var MAX_WORDS = 5;
    var MAX_GAP   = 0.6;
    var MAX_DUR   = 4.0;
    var cues = [];
    var cur  = null;

    words.forEach(function(w) {
      if (cur) {
        var lastWord = cur.words[cur.words.length - 1];
        var gap        = w.start - lastWord.end;
        var wouldDur   = w.end - cur.words[0].start;
        var endsSentence = /[.!?…]$/.test(lastWord.text);
        if (gap > MAX_GAP || cur.words.length >= MAX_WORDS || wouldDur > MAX_DUR || endsSentence) {
          cues.push(cur);
          cur = null;
        }
      }
      if (!cur) cur = { words: [] };
      cur.words.push(w);
    });
    if (cur) cues.push(cur);

    return cues.map(function(c) {
      var start = c.words[0].start;
      var end   = Math.min(videoDuration || c.words[c.words.length - 1].end,
                            c.words[c.words.length - 1].end);
      if (end <= start) end = start + 0.3;
      return {
        id:    Date.now() + Math.random(),
        start: parseFloat(start.toFixed(2)),
        end:   parseFloat(end.toFixed(2)),
        text:  c.words.map(function(w) { return w.text; }).join(' '),
        words: c.words.map(function(w) {
          return {
            text:  w.text,
            start: parseFloat(w.start.toFixed(2)),
            end:   parseFloat(w.end.toFixed(2)),
          };
        }),
        lang: currentLang,
      };
    });
  }

  function generateSubtitles() {
    var video = document.getElementById('main-video');

    if (!video || !video.src || !video.duration) {
      showToast('warning', '⚠️', 'Vui lòng thêm video vào player trước!', 3500);
      return Promise.resolve([]);
    }
    if (isRunning) {
      showToast('warning', '!', 'AI dang xu ly, vui long cho...');
      return Promise.resolve(subtitleList);
    }

    stopRecognition(); // dọn dẹp lần chạy trước nếu có
    subtitleList  = [];
    isRunning     = true;
    _subAborted   = false;
    var runId     = ++_subRunId;

    ensureSubtitleDOM();
    renderSubtitleList();
    updateSubtitlePanelCount();
    if (typeof repositionSubtitleBar === 'function') {
      requestAnimationFrame(function() { repositionSubtitleBar(video); });
    }

    var progressArea  = document.getElementById('ai-progress-area');
    var progressLabel = document.getElementById('ai-progress-label');
    var progressFill  = document.getElementById('ai-progress-fill');
    var progressPct   = document.getElementById('ai-progress-pct');
    var runBtn        = document.getElementById('btn-subtitle');

    function setProgress(pct, label) {
      if (progressArea)  progressArea.style.display = 'block';
      if (progressLabel) progressLabel.textContent   = label;
      if (progressFill)  progressFill.style.width    = pct + '%';
      if (progressPct)   progressPct.textContent     = Math.round(pct) + '%';
      _updateLiveBar(label, true);
    }

    function finish() {
      isRunning = false;
      if (runBtn) {
        runBtn.textContent = 'Chay';
        runBtn.classList.remove('running');
        runBtn.disabled = false;
      }
      _updateLiveBar('', false);
      var stopBtn = document.getElementById('btn-stop-subtitle');
      if (stopBtn) stopBtn.remove();
    }

    if (runBtn) {
      runBtn.textContent = 'Dang chay...';
      runBtn.classList.add('running');
      runBtn.disabled = true;
    }

    return (async function() {
      try {
        setProgress(5, '🎧 Đang đọc audio từ video...');
        var audioData = await _extractAudioForWhisper(video);
        if (_subAborted || runId !== _subRunId) return finish(), subtitleList;

        if (!window.HD68LoadWhisper) await _waitForWhisperReady(8000);
        if (!window.HD68LoadWhisper) {
          showToast('warning', '⚠️',
            'Whisper AI chưa sẵn sàng — kiểm tra kết nối mạng (cần tải model ~40MB ở lần chạy đầu).', 6000);
          finish();
          return subtitleList;
        }

        var langMap   = { vi: 'vietnamese', en: 'english', ko: 'korean', ja: 'japanese' };
        var modelType = currentLang === 'en' ? 'en' : 'multilingual';

        setProgress(15, '📦 Đang tải mô hình Whisper (chỉ lần đầu)...');
        var transcriber = await window.HD68LoadWhisper(modelType, function(p) {
          if (p && p.status === 'progress' && typeof p.progress === 'number') {
            setProgress(15 + p.progress * 0.5,
              '📦 Đang tải mô hình Whisper... ' + Math.round(p.progress) + '%');
          }
        });
        if (_subAborted || runId !== _subRunId) return finish(), subtitleList;

        setProgress(70, '🎙️ Đang nhận dạng giọng nói...');
        var whisperOpts = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: 'word' };
        if (modelType === 'multilingual') {
          whisperOpts.language = langMap[currentLang] || 'vietnamese';
          whisperOpts.task     = 'transcribe';
        }
        var output = await transcriber(audioData, whisperOpts);
        if (_subAborted || runId !== _subRunId) return finish(), subtitleList;

        setProgress(92, '⏱️ Đang căn chỉnh thời gian theo từng từ...');
        var words = ((output && output.chunks) || [])
          .map(function(c) {
            var text = (c.text || '').trim();
            var ts   = c.timestamp || [0, null];
            var start = typeof ts[0] === 'number' ? ts[0] : 0;
            var end   = typeof ts[1] === 'number' ? ts[1] : start + 0.3;
            if (end <= start) end = start + 0.15;
            return { text: text, start: start, end: end };
          })
          .filter(function(w) { return w.text; });

        subtitleList = _groupWordsIntoCues(words, video.duration);

        renderSubtitleList();
        updateSubtitlePanelCount();
        addSubtitlesToTimeline();
        startSubtitleLoop();

        setProgress(100, '✅ Phụ đề tự động hoàn thành!');
        if (subtitleList.length > 0) {
          showToast('success', '✅',
            '✅ Tạo xong ' + subtitleList.length + ' phụ đề từ giọng nói!', 5000);
        } else {
          showToast('warning', '⚠️', 'Không phát hiện giọng nói nào trong video.', 4000);
        }
        finish();
        return subtitleList;

      } catch (err) {
        console.error('[HD68 Sub] Whisper error:', err);
        showToast('warning', '⚠️',
          'Lỗi tạo phụ đề: ' + (err && err.message ? err.message : err), 6000);
        finish();
        return subtitleList;
      }
    }());
  }

  /* Huỷ lần tạo phụ đề đang chạy */
  function stopRecognition() {
    _subAborted = true;
    isRunning   = false;
    var runBtn = document.getElementById('btn-subtitle');
    if (runBtn) {
      runBtn.textContent = 'Chay';
      runBtn.classList.remove('running');
      runBtn.disabled = false;
    }
    _updateLiveBar('', false);
  }

  /* Cập nhật thanh phụ đề live */
  function _updateLiveBar(text, isInterim) {
    var el = document.getElementById('hd68-sub-text');
    if (!el) return;
    el.textContent  = text || '';
    el.style.opacity    = text ? '1' : '0';
    el.style.fontStyle  = isInterim ? 'italic' : 'normal';
    el.style.color      = isInterim ? 'rgba(255,220,100,0.95)' : subStyle.color || '#fff';
  }


  /* ──────────────────────────────────────────────────────────
     ensureSubtitleDOM — subtitle bar + panel
  ────────────────────────────────────────────────────────── */
  function ensureSubtitleDOM() {
    // --- Subtitle bar on video ---
    if (!document.getElementById('hd68-sub-bar')) {
      var wrap = document.getElementById('video-canvas-wrap');
      if (!wrap) return;

      var bar = document.createElement('div');
      bar.id = 'hd68-sub-bar';
      // Không dùng !important để app.js có thể định vị lại đúng
      bar.style.cssText =
        'position:absolute;bottom:14px;left:50%;' +
        'transform:translateX(-50%);z-index:50;' +
        'width:90%;text-align:center;pointer-events:none;';

      var textEl = document.createElement('div');
      textEl.id = 'hd68-sub-text';
      applySubStyleToEl(textEl);
      textEl.style.opacity = '0';
      bar.appendChild(textEl);
      wrap.appendChild(bar);
    }

    // --- Management panel ---
    if (!document.getElementById('subtitle-panel')) {
      buildSubtitlePanel();
    }
  }

  /* Apply current subStyle to the display element */
  function applySubStyleToEl(el) {
    if (!el) el = document.getElementById('hd68-sub-text');
    if (!el) return;
    el.style.display         = 'inline-block';
    el.style.background      = subStyle.bgColor;
    el.style.color           = subStyle.color;
    el.style.fontFamily      = subStyle.font + ', sans-serif';
    el.style.fontSize        = subStyle.size + 'px';
    el.style.fontWeight      = '600';
    el.style.padding         = '5px 20px';
    el.style.borderRadius    = '6px';
    el.style.textShadow      = subStyle.outline
      ? '0 2px 8px rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.6), 1px 1px 0 rgba(0,0,0,0.6)'
      : 'none';
    el.style.maxWidth        = '100%';
    el.style.wordBreak       = 'break-word';
    el.style.transition      = 'opacity 0.18s ease';
  }

  /* ──────────────────────────────────────────────────────────
     buildSubtitlePanel — full-featured panel in AI tab
  ────────────────────────────────────────────────────────── */
  function buildSubtitlePanel() {
    var target = document.getElementById('pcontent-ai');
    if (!target) return;

    var panel = document.createElement('div');
    panel.id = 'subtitle-panel';
    panel.style.cssText =
      'margin-top:18px;background:rgba(124,58,237,0.06);' +
      'border:1px solid rgba(124,58,237,0.18);border-radius:12px;overflow:hidden;';

    panel.innerHTML = [
      /* ── Header ── */
      '<div style="display:flex;align-items:center;justify-content:space-between;',
        'padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.07);">',
        '<span id="sub-panel-title" style="font-size:12px;font-weight:700;color:var(--purple-light);">',
          '📝 Phu de AI (0)',
        '</span>',
        '<div style="display:flex;gap:5px;">',
          '<button id="sub-toggle-btn" class="sub-ctrl-btn" style="color:var(--cyan-light);',
            'border-color:rgba(6,182,212,0.35);background:rgba(6,182,212,0.12);">👁 Hien</button>',
          '<button id="sub-add-btn"    class="sub-ctrl-btn">+ Them</button>',
          '<button id="sub-export-srt" class="sub-ctrl-btn" style="color:#34d399;',
            'border-color:rgba(16,185,129,0.35);background:rgba(16,185,129,0.12);">↓ SRT</button>',
        '</div>',
      '</div>',

      /* ── Translate bar ── */
      '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;',
        'border-bottom:1px solid rgba(255,255,255,0.07);background:rgba(0,0,0,0.1);">',
        '<span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);',
          'text-transform:uppercase;letter-spacing:1px;flex-shrink:0;">🌐 Dich:</span>',
        '<div id="sub-lang-btns" style="display:flex;gap:4px;flex-wrap:wrap;">',
          '<button class="sub-lang-btn active" data-lang="vi">VI</button>',
          '<button class="sub-lang-btn" data-lang="en">EN</button>',
          '<button class="sub-lang-btn" data-lang="ko">KO</button>',
          '<button class="sub-lang-btn" data-lang="ja">JA</button>',
        '</div>',
        '<button id="sub-translate-btn" style="',
          'margin-left:auto;padding:4px 12px;border-radius:7px;font-size:10px;font-weight:700;',
          'background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;',
          'border:none;cursor:pointer;white-space:nowrap;">Dich ngay</button>',
      '</div>',

      /* ── Style toolbar ── */
      '<div id="sub-style-bar" style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;',
        'border-bottom:1px solid rgba(255,255,255,0.07);align-items:center;">',
        /* Color */
        '<div style="display:flex;align-items:center;gap:4px;">',
          '<span style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;">Mau</span>',
          '<input type="color" id="sub-color" value="#ffffff" style="',
            'width:28px;height:24px;border-radius:5px;border:1px solid rgba(255,255,255,0.15);',
            'background:transparent;cursor:pointer;padding:1px;"/>',
        '</div>',
        /* BG opacity */
        '<div style="display:flex;align-items:center;gap:4px;flex:1;min-width:80px;">',
          '<span style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;white-space:nowrap;">Nen</span>',
          '<input type="range" id="sub-bg-opacity" min="0" max="100" value="82" style="',
            'flex:1;height:4px;accent-color:#7c3aed;cursor:pointer;"/>',
        '</div>',
        /* Font */
        '<select id="sub-font" style="',
          'padding:4px 6px;border-radius:7px;background:rgba(0,0,0,0.3);',
          'border:1px solid rgba(255,255,255,0.12);color:#fff;font-size:10px;cursor:pointer;">',
          '<option value="Inter">Inter</option>',
          '<option value="Space Grotesk">Space Grotesk</option>',
          '<option value="Georgia">Serif</option>',
          '<option value="monospace">Mono</option>',
          '<option value="Arial Rounded MT Bold">Rounded</option>',
        '</select>',
        /* Size */
        '<div style="display:flex;align-items:center;gap:4px;">',
          '<span style="font-size:9px;color:rgba(255,255,255,0.4);">Cỡ</span>',
          '<input type="number" id="sub-size" value="19" min="10" max="48" style="',
            'width:42px;padding:3px 5px;border-radius:6px;background:rgba(0,0,0,0.3);',
            'border:1px solid rgba(255,255,255,0.12);color:#fff;font-size:10px;text-align:center;"/>',
        '</div>',
        /* Outline toggle */
        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:9px;',
          'color:rgba(255,255,255,0.5);">',
          '<input type="checkbox" id="sub-outline" checked style="accent-color:#7c3aed;"/>',
          'Vien',
        '</label>',
      '</div>',

      /* ── Position toolbar ── */
      '<div id="sub-position-bar" style="display:flex;align-items:center;gap:8px;',
        'padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.07);">',
        '<span style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;',
          'white-space:nowrap;">📍 Vi tri</span>',
        '<input type="range" id="sub-posY" min="2" max="70" value="12" style="',
          'flex:1;height:4px;accent-color:#7c3aed;cursor:pointer;"/>',
        '<button class="sub-pos-btn" data-pos="8"  style="padding:3px 8px;border-radius:6px;',
          'background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);color:#fff;',
          'font-size:9px;cursor:pointer;">Duoi</button>',
        '<button class="sub-pos-btn" data-pos="35" style="padding:3px 8px;border-radius:6px;',
          'background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);color:#fff;',
          'font-size:9px;cursor:pointer;">Giua</button>',
        '<button class="sub-pos-btn" data-pos="60" style="padding:3px 8px;border-radius:6px;',
          'background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);color:#fff;',
          'font-size:9px;cursor:pointer;">Tren</button>',
      '</div>',

      /* ── Animation style picker ── */
      '<div class="sub-anim-label">🎬 Kiểu chữ chạy</div>',
      '<div class="sub-anim-grid" id="sub-anim-grid">',
        '<button class="sub-anim-btn active" data-anim="normal">',
          '<span class="btn-icon-mini">▬</span>Bình thường',
        '</button>',
        '<button class="sub-anim-btn" data-anim="karaoke">',
          '<span class="btn-icon-mini">🎤</span>Karaoke',
        '</button>',
        '<button class="sub-anim-btn" data-anim="fade">',
          '<span class="btn-icon-mini">🌅</span>Fade',
        '</button>',
        '<button class="sub-anim-btn" data-anim="slideup">',
          '<span class="btn-icon-mini">⬆</span>Slide Up',
        '</button>',
        '<button class="sub-anim-btn" data-anim="slidedown">',
          '<span class="btn-icon-mini">⬇</span>Slide Down',
        '</button>',
        '<button class="sub-anim-btn" data-anim="typewriter">',
          '<span class="btn-icon-mini">⌨</span>Đánh máy',
        '</button>',
        '<button class="sub-anim-btn" data-anim="bounce">',
          '<span class="btn-icon-mini">🏀</span>Bounce',
        '</button>',
        '<button class="sub-anim-btn" data-anim="neon">',
          '<span class="btn-icon-mini">💡</span>Neon',
        '</button>',
        '<button class="sub-anim-btn" data-anim="wave">',
          '<span class="btn-icon-mini">🌊</span>Wave',
        '</button>',
        '<button class="sub-anim-btn" data-anim="zoom">',
          '<span class="btn-icon-mini">🔍</span>Zoom Pop',
        '</button>',
        '<button class="sub-anim-btn" data-anim="glitch">',
          '<span class="btn-icon-mini">⚡</span>Glitch',
        '</button>',
      '</div>',

      /* ── Subtitle list ── */
      '<div id="subtitle-list-container" style="max-height:200px;overflow-y:auto;padding:8px;"></div>',

      /* ── Add form ── */
      '<div id="subtitle-add-form" style="display:none;padding:10px 14px;',
        'border-top:1px solid rgba(255,255,255,0.07);">',
        '<div style="display:flex;gap:6px;margin-bottom:7px;">',
          '<input id="sub-new-start" type="number" step="0.1" min="0" placeholder="Bat dau (s)" ',
            'style="flex:1;padding:5px 8px;border-radius:7px;background:rgba(0,0,0,0.3);',
            'border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:11px;"/>',
          '<input id="sub-new-end" type="number" step="0.1" min="0" placeholder="Ket thuc (s)" ',
            'style="flex:1;padding:5px 8px;border-radius:7px;background:rgba(0,0,0,0.3);',
            'border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:11px;"/>',
        '</div>',
        '<div style="display:flex;gap:6px;">',
          '<input id="sub-new-text" type="text" placeholder="Noi dung phu de..." ',
            'style="flex:1;padding:5px 10px;border-radius:7px;background:rgba(0,0,0,0.3);',
            'border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:12px;"/>',
          '<button id="sub-new-save" style="padding:5px 14px;border-radius:7px;',
            'background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;',
            'font-size:11px;font-weight:700;cursor:pointer;border:none;white-space:nowrap;">Luu</button>',
        '</div>',
      '</div>',
    ].join('');

    target.appendChild(panel);

    /* ── Wire events ── */
    wirePanelEvents();
  }

  /* ──────────────────────────────────────────────────────────
     wirePanelEvents
  ────────────────────────────────────────────────────────── */
  function wirePanelEvents() {
    /* Toggle visibility */
    document.getElementById('sub-toggle-btn').addEventListener('click', function() {
      subEnabled = !subEnabled;
      var bar = document.getElementById('hd68-sub-bar');
      var btn = document.getElementById('sub-toggle-btn');
      if (bar) bar.style.display = subEnabled ? '' : 'none';
      if (btn) btn.textContent = subEnabled ? '👁 Hien' : '🚫 An';
      showToast('info', 'i', subEnabled ? 'Da bat phu de' : 'Da an phu de', 1400);
    });

    /* Add form toggle */
    document.getElementById('sub-add-btn').addEventListener('click', function() {
      var f = document.getElementById('subtitle-add-form');
      if (f) f.style.display = (f.style.display === 'none' ? 'block' : 'none');
    });

    /* Save new subtitle */
    document.getElementById('sub-new-save').addEventListener('click', function() {
      var start = parseFloat(document.getElementById('sub-new-start').value);
      var end   = parseFloat(document.getElementById('sub-new-end').value);
      var text  = (document.getElementById('sub-new-text').value || '').trim();
      if (isNaN(start) || isNaN(end) || !text || end <= start) {
        showToast('warning', '!', 'Dien day du thong tin hop le!');
        return;
      }
      addSubtitle(start, end, text);
      document.getElementById('sub-new-start').value = '';
      document.getElementById('sub-new-end').value   = '';
      document.getElementById('sub-new-text').value  = '';
      document.getElementById('subtitle-add-form').style.display = 'none';
    });

    /* SRT export */
    document.getElementById('sub-export-srt').addEventListener('click', exportSRT);

    /* ── Language buttons ── */
    document.querySelectorAll('.sub-lang-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.sub-lang-btn').forEach(function(b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        currentLang = btn.getAttribute('data-lang');
      });
    });

    /* ── Translate button ── */
    document.getElementById('sub-translate-btn').addEventListener('click', function() {
      if (subtitleList.length === 0) {
        showToast('warning', '!', 'Chua co phu de. Hay chay AI Subtitle truoc!');
        return;
      }
      runTranslate(currentLang);
    });

    /* ── Style controls ── */
    document.getElementById('sub-color').addEventListener('input', function() {
      subStyle.color = this.value;
      applySubStyleToEl();
    });

    document.getElementById('sub-bg-opacity').addEventListener('input', function() {
      var opacity = parseInt(this.value) / 100;
      subStyle.bgOpacity = opacity;
      subStyle.bgColor   = 'rgba(0,0,0,' + opacity + ')';
      applySubStyleToEl();
    });

    document.getElementById('sub-font').addEventListener('change', function() {
      subStyle.font = this.value;
      applySubStyleToEl();
    });

    document.getElementById('sub-size').addEventListener('input', function() {
      subStyle.size = parseInt(this.value) || 19;
      applySubStyleToEl();
    });

    document.getElementById('sub-outline').addEventListener('change', function() {
      subStyle.outline = this.checked;
      applySubStyleToEl();
    });

    /* ── Position (vertical) ── */
    var posSlider = document.getElementById('sub-posY');
    if (posSlider) {
      posSlider.addEventListener('input', function() {
        subStyle.posY = parseInt(this.value, 10) || 12;
        if (typeof repositionSubtitleBar === 'function') repositionSubtitleBar();
      });
    }
    document.querySelectorAll('.sub-pos-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var val = parseInt(btn.getAttribute('data-pos'), 10) || 12;
        subStyle.posY = val;
        if (posSlider) posSlider.value = val;
        if (typeof repositionSubtitleBar === 'function') repositionSubtitleBar();
      });
    });

    /* ── Animation style buttons ── */
    wireAnimEvents();
  }

  /* ──────────────────────────────────────────────────────────
     wireAnimEvents — wire animation picker
  ────────────────────────────────────────────────────────── */
  function wireAnimEvents() {
    var grid = document.getElementById('sub-anim-grid');
    if (!grid) return;
    grid.querySelectorAll('.sub-anim-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        grid.querySelectorAll('.sub-anim-btn').forEach(function(b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        subAnimStyle = btn.getAttribute('data-anim') || 'normal';
        /* Apply immediately to current text element */
        applyAnimToEl(document.getElementById('hd68-sub-text'), true);
        showToast('info', '🎬', 'Kiểu chữ: ' + btn.textContent.trim(), 1500);
      });
    });
  }

  /* Apply animation class + wave char-wrap to el */
  function applyAnimToEl(el, reflow) {
    if (!el) return;
    /* Remove all existing anim classes */
    Object.values(ANIM_CLASS_MAP).forEach(function(cls) {
      if (cls) el.classList.remove(cls);
    });
    el.classList.remove('hd68-sub-wave'); // safety

    var cls = ANIM_CLASS_MAP[subAnimStyle] || '';
    if (!cls) return; // normal — no class

    if (subAnimStyle === 'wave') {
      /* Wrap each char in a span with delay */
      var txt = el.textContent;
      el.innerHTML = txt.split('').map(function(ch, i) {
        var delay = (i * 0.07).toFixed(2) + 's';
        return '<span class="wc" style="animation-delay:' + delay + '">' +
          (ch === ' ' ? '&nbsp;' : ch) + '</span>';
      }).join('');
      el.classList.add('hd68-sub-wave');
    } else if (subAnimStyle === 'glitch') {
      el.setAttribute('data-text', el.textContent);
      el.classList.add(cls);
    } else {
      /* Trigger CSS animation reflow */
      if (reflow) {
        el.style.animation = 'none';
        void el.offsetWidth; // force reflow
        el.style.animation = '';
      }
      el.classList.add(cls);
    }
  }

  /* ──────────────────────────────────────────────────────────
     TRANSLATE — swap text to target language
  ────────────────────────────────────────────────────────── */
  function runTranslate(lang) {
    var btn = document.getElementById('sub-translate-btn');
    if (btn) { btn.textContent = 'Dang dich...'; btn.disabled = true; }

    var lines = TRANSLATIONS[lang] || TRANSLATIONS.vi;

    /* Simulate network delay */
    var stepsLeft = subtitleList.length;
    var delay = 0;
    subtitleList.forEach(function(sub, i) {
      delay += 180 + Math.random() * 140;
      (function(idx, d) {
        setTimeout(function() {
          if (lines[idx]) { sub.text = lines[idx]; sub.words = null; }
          stepsLeft--;
          if (stepsLeft === 0) {
            renderSubtitleList();
            updateSubtitlePanelCount();
            addSubtitlesToTimeline();
            if (btn) { btn.textContent = 'Dich ngay'; btn.disabled = false; }
            var names = { vi: 'Tieng Viet', en: 'English', ko: 'Korean', ja: 'Japanese' };
            showToast('success', 'ok',
              'Da dich ' + subtitleList.length + ' dong sang ' + (names[lang] || lang),
              3000);
          }
        }, d);
      }(i, delay));
    });
  }

  /* ──────────────────────────────────────────────────────────
     addSubtitle / deleteSubtitle
  ────────────────────────────────────────────────────────── */
  function addSubtitle(start, end, text) {
    var entry = { id: Date.now() + Math.random(), start: start, end: end, text: text };
    subtitleList.push(entry);
    subtitleList.sort(function(a, b) { return a.start - b.start; });
    renderSubtitleList();
    updateSubtitlePanelCount();
    addSubtitlesToTimeline();
    showToast('success', 'ok', 'Da them phu de!', 1800);
  }

  function deleteSubtitle(id) {
    subtitleList = subtitleList.filter(function(s) { return s.id !== id; });
    renderSubtitleList();
    updateSubtitlePanelCount();
    addSubtitlesToTimeline();
  }

  /* Sửa nội dung một dòng phụ đề (chữa lỗi chính tả do AI nhận dạng sai).
     Xoá words[] vì văn bản gõ tay không còn khớp với timestamp gốc của
     từng từ — phụ đề dòng này sẽ hiển thị tĩnh thay vì highlight theo từ. */
  function editSubtitleText(id, newText) {
    newText = (newText || '').trim();
    if (!newText) return;
    var sub = subtitleList.filter(function(s) { return s.id === id; })[0];
    if (!sub) return;
    sub.text  = newText;
    sub.words = null;
    renderSubtitleList();
    updateSubtitlePanelCount();
    addSubtitlesToTimeline();
  }

  function updateSubtitlePanelCount() {
    var el = document.getElementById('sub-panel-title');
    if (el) el.textContent = '📝 Phụ đề AI (' + subtitleList.length + ')';
  }

  /* ──────────────────────────────────────────────────────────
     renderSubtitleList
  ────────────────────────────────────────────────────────── */
  function renderSubtitleList() {
    var container = document.getElementById('subtitle-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (subtitleList.length === 0) {
      container.innerHTML =
        '<div style="text-align:center;color:rgba(255,255,255,0.25);' +
        'font-size:11px;padding:16px;">Chua co phu de nao</div>';
      return;
    }

    subtitleList.forEach(function(sub, idx) {
      var row = document.createElement('div');
      row.setAttribute('data-sub-id', String(sub.id));
      row.style.cssText =
        'display:flex;align-items:flex-start;gap:8px;padding:7px 8px;' +
        'border-radius:8px;margin-bottom:5px;' +
        'background:rgba(255,255,255,0.03);' +
        'border:1px solid rgba(255,255,255,0.06);cursor:pointer;' +
        'transition:background 0.12s;';

      row.innerHTML =
        '<span style="font-size:9px;font-weight:700;color:rgba(167,139,250,0.8);' +
          'font-family:monospace;flex-shrink:0;padding-top:2px;min-width:18px;">' +
          (idx + 1) + '</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="sub-text-view" data-sub-text-id="' + sub.id + '" style="font-size:11px;' +
            'color:rgba(255,255,255,0.85);font-weight:500;cursor:text;' +
            'margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" ' +
            'title="' + _escapeHtml(sub.text) + ' (bam de sua)">' + _escapeHtml(sub.text) + '</div>' +
          '<div style="font-size:9px;color:rgba(255,255,255,0.32);font-family:monospace;">' +
            formatSubTime(sub.start) + ' → ' + formatSubTime(sub.end) +
            ' <span style="color:rgba(124,58,237,0.6);">' +
            (sub.end - sub.start).toFixed(1) + 's</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0;">' +
          '<button data-action="seek" data-time="' + sub.start + '" ' +
            'style="width:22px;height:22px;border-radius:5px;' +
            'border:1px solid rgba(6,182,212,0.3);background:rgba(6,182,212,0.1);' +
            'color:#22d3ee;cursor:pointer;font-size:10px;" title="Tua den">&#9654;</button>' +
          '<button data-action="edit" data-id="' + sub.id + '" ' +
            'style="width:22px;height:22px;border-radius:5px;' +
            'border:1px solid rgba(167,139,250,0.3);background:rgba(167,139,250,0.1);' +
            'color:#a78bfa;cursor:pointer;font-size:11px;" title="Sua chinh ta">✎</button>' +
          '<button data-action="delete" data-id="' + sub.id + '" ' +
            'style="width:22px;height:22px;border-radius:5px;' +
            'border:1px solid rgba(239,68,68,0.25);background:rgba(239,68,68,0.08);' +
            'color:rgba(239,68,68,0.7);cursor:pointer;font-size:14px;" title="Xoa">&times;</button>' +
        '</div>';

      (function(s, r) {
        r.addEventListener('mouseenter', function() {
          r.style.background = 'rgba(124,58,237,0.08)';
        });
        r.addEventListener('mouseleave', function() {
          r.style.background = 'rgba(255,255,255,0.03)';
        });
        r.addEventListener('click', function(e) {
          if (e.target.getAttribute('data-action')) return;
          if (e.target.classList.contains('sub-text-view')) return;
          var video = document.getElementById('main-video');
          if (video) video.currentTime = s.start;
        });
        r.querySelectorAll('button[data-action]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (btn.getAttribute('data-action') === 'seek') {
              var v = document.getElementById('main-video');
              if (v) v.currentTime = parseFloat(btn.getAttribute('data-time'));
            } else if (btn.getAttribute('data-action') === 'delete') {
              deleteSubtitle(parseFloat(btn.getAttribute('data-id')));
            } else if (btn.getAttribute('data-action') === 'edit') {
              _startInlineEdit(r, s);
            }
          });
        });
        var textView = r.querySelector('.sub-text-view');
        if (textView) {
          textView.addEventListener('click', function(e) {
            e.stopPropagation();
            _startInlineEdit(r, s);
          });
        }
      }(sub, row));

      container.appendChild(row);
    });
  }

  /* Bấm vào chữ (hoặc nút ✎) để sửa lỗi chính tả — thay div thành input,
     Enter/blur để lưu, Escape để huỷ. */
  function _startInlineEdit(row, sub) {
    var view = row.querySelector('.sub-text-view');
    if (!view || view.tagName === 'INPUT') return;

    var input = document.createElement('input');
    input.type  = 'text';
    input.value = sub.text;
    input.className = 'sub-text-view';
    input.style.cssText =
      'width:100%;font-size:11px;color:#fff;font-weight:500;margin-bottom:2px;' +
      'background:rgba(0,0,0,0.35);border:1px solid rgba(167,139,250,0.5);' +
      'border-radius:5px;padding:2px 6px;font-family:inherit;';
    view.replaceWith(input);
    input.focus();
    input.select();

    var done = false;
    function commit() {
      if (done) return;
      done = true;
      editSubtitleText(sub.id, input.value);
    }
    function cancel() {
      if (done) return;
      done = true;
      renderSubtitleList();
    }
    input.addEventListener('click', function(e) { e.stopPropagation(); });
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  }

  /* ──────────────────────────────────────────────────────────
     TIMELINE — render subtitle clips + drag to adjust timing
  ────────────────────────────────────────────────────────── */
  function addSubtitlesToTimeline() {
    var track = document.getElementById('track-text');
    if (!track) return;

    /* Remove old subtitle clips */
    track.querySelectorAll('.sub-tl-clip').forEach(function(el) { el.remove(); });
    var hint = track.querySelector('.track-empty-hint');
    if (hint) hint.style.display = subtitleList.length ? 'none' : '';

    var video     = document.getElementById('main-video');
    var totalDur  = (video && video.duration && isFinite(video.duration)) ? video.duration : 30;
    /* Read zoom from State if available */
    var zoom      = (typeof State !== 'undefined' && State.zoom) ? State.zoom : 100;
    var pxPerSec  = 80 * (zoom / 100);

    subtitleList.forEach(function(sub) {
      var clip = document.createElement('div');
      clip.className = 'sub-tl-clip timeline-clip';
      clip.style.left       = (sub.start * pxPerSec) + 'px';
      clip.style.width      = Math.max(40, (sub.end - sub.start) * pxPerSec) + 'px';
      clip.style.background = 'linear-gradient(135deg,rgba(236,72,153,0.55),rgba(167,139,250,0.55))';
      clip.style.borderColor = 'rgba(244,114,182,0.5)';
      clip.style.fontSize   = '9px';
      clip.innerHTML        =
        '<div class="clip-thumb"></div>' +
        sub.text.substring(0, 22) + (sub.text.length > 22 ? '…' : '');
      clip.title = sub.text + '\n' + formatSubTime(sub.start) + ' - ' + formatSubTime(sub.end);

      /* ── Drag to move (adjust start/end) ── */
      makeDraggableClip(clip, sub, pxPerSec, totalDur);

      /* ── Left resize handle ── */
      var leftHandle = makeResizeHandle('left');
      clip.appendChild(leftHandle);
      makeResizable(leftHandle, clip, sub, pxPerSec, totalDur, 'start');

      /* ── Right resize handle ── */
      var rightHandle = makeResizeHandle('right');
      clip.appendChild(rightHandle);
      makeResizable(rightHandle, clip, sub, pxPerSec, totalDur, 'end');

      track.appendChild(clip);
    });
  }

  function makeResizeHandle(side) {
    var h = document.createElement('div');
    h.style.cssText =
      'position:absolute;top:0;bottom:0;width:7px;cursor:ew-resize;z-index:5;' +
      'background:rgba(255,255,255,0.15);border-radius:' +
      (side === 'left' ? '6px 0 0 6px' : '0 6px 6px 0') + ';' +
      (side === 'left' ? 'left:0;' : 'right:0;');
    return h;
  }

  function makeDraggableClip(clip, sub, pxPerSec, totalDur) {
    var startX, origLeft;
    clip.addEventListener('mousedown', function(e) {
      if (e.target !== clip && e.target.className.indexOf('clip-thumb') === -1) return;
      e.preventDefault();
      startX   = e.clientX;
      origLeft = sub.start * pxPerSec;
      clip.style.cursor = 'grabbing';
      sub.words = null; // thời gian chỉnh tay không còn khớp với timestamp gốc của từng từ

      function move(ev) {
        var dx  = ev.clientX - startX;
        var newStart = Math.max(0, (origLeft + dx) / pxPerSec);
        var dur = sub.end - sub.start;
        newStart = Math.min(totalDur - dur, newStart);
        sub.start = parseFloat(newStart.toFixed(2));
        sub.end   = parseFloat((newStart + dur).toFixed(2));
        clip.style.left = (sub.start * pxPerSec) + 'px';
        /* Update list */
        var r = document.querySelector('[data-sub-id="' + sub.id + '"] div div:last-child');
        if (r) r.textContent = formatSubTime(sub.start) + ' → ' + formatSubTime(sub.end) + ' ' + (sub.end - sub.start).toFixed(1) + 's';
      }
      function up() {
        clip.style.cursor = 'grab';
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        renderSubtitleList();
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    clip.style.cursor = 'grab';
  }

  function makeResizable(handle, clip, sub, pxPerSec, totalDur, edge) {
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var startX = e.clientX;
      var origVal = edge === 'start' ? sub.start : sub.end;
      sub.words = null; // thời gian chỉnh tay không còn khớp với timestamp gốc của từng từ

      function move(ev) {
        var dx  = ev.clientX - startX;
        var delta = dx / pxPerSec;
        if (edge === 'start') {
          var newStart = Math.max(0, Math.min(sub.end - 0.2, origVal + delta));
          sub.start = parseFloat(newStart.toFixed(2));
          clip.style.left  = (sub.start * pxPerSec) + 'px';
          clip.style.width = Math.max(20, (sub.end - sub.start) * pxPerSec) + 'px';
        } else {
          var newEnd = Math.min(totalDur, Math.max(sub.start + 0.2, origVal + delta));
          sub.end  = parseFloat(newEnd.toFixed(2));
          clip.style.width = Math.max(20, (sub.end - sub.start) * pxPerSec) + 'px';
        }
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        renderSubtitleList();
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  /* ──────────────────────────────────────────────────────────
     RAF subtitle display loop
  ────────────────────────────────────────────────────────── */
  function _escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Cụm nào có words[] (từ Whisper) hiển thị kiểu CapCut: bôi màu đúng từ
     đang được nói. 'wave' và 'glitch' giữ hiệu ứng riêng vì xung đột với
     cách bọc span theo từ. */
  var _wordSpans   = null;
  var _lastWordIdx = -1;

  function _renderCue(barEl, cue) {
    Object.values(ANIM_CLASS_MAP).forEach(function(c) { if (c) barEl.classList.remove(c); });
    barEl.classList.remove('hd68-sub-wave');
    _wordSpans   = null;
    _lastWordIdx = -1;

    if (subAnimStyle === 'wave') {
      barEl.innerHTML = cue.text.split('').map(function(ch, i) {
        var delay = (i * 0.07).toFixed(2) + 's';
        return '<span class="wc" style="animation-delay:' + delay + '">' +
          (ch === ' ' ? '&nbsp;' : _escapeHtml(ch)) + '</span>';
      }).join('');
      barEl.classList.add('hd68-sub-wave');
    } else if (cue.words && cue.words.length) {
      barEl.innerHTML = cue.words.map(function(w) {
        return '<span class="hd68-word">' + _escapeHtml(w.text) + '</span>';
      }).join(' ');
      _wordSpans = Array.prototype.slice.call(barEl.querySelectorAll('.hd68-word'));
      if (subAnimStyle === 'glitch') barEl.setAttribute('data-text', cue.text);
      barEl.style.animation = 'none';
      void barEl.offsetWidth;
      barEl.style.animation = '';
      var wordAnimCls = ANIM_CLASS_MAP[subAnimStyle] || '';
      if (wordAnimCls && subAnimStyle !== 'karaoke') barEl.classList.add(wordAnimCls);
    } else {
      barEl.textContent = cue.text;
      if (subAnimStyle === 'glitch') barEl.setAttribute('data-text', cue.text);
      barEl.style.animation = 'none';
      void barEl.offsetWidth;
      barEl.style.animation = '';
      var animCls = ANIM_CLASS_MAP[subAnimStyle] || '';
      if (animCls) barEl.classList.add(animCls);
    }
  }

  function startSubtitleLoop() {
    if (subRafId) cancelAnimationFrame(subRafId);

    var lastId = null;
    function loop() {
      subRafId = requestAnimationFrame(loop);
      // Lấy video và barEl mỗi frame (vì có thể được tạo sau)
      var video = document.getElementById('main-video');
      var barEl = document.getElementById('hd68-sub-text');
      if (!video || !barEl || !subEnabled) return;

      var ct = video.currentTime;
      var active = null;
      for (var i = 0; i < subtitleList.length; i++) {
        if (ct >= subtitleList[i].start && ct < subtitleList[i].end) {
          active = subtitleList[i]; break;
        }
      }
      if (active) {
        if (lastId !== active.id) {
          _renderCue(barEl, active);
          barEl.style.opacity = '1';
          lastId = active.id;
          /* Highlight row */
          document.querySelectorAll('#subtitle-list-container > div').forEach(function(r) {
            r.style.background = 'rgba(255,255,255,0.03)';
            r.style.borderColor = 'rgba(255,255,255,0.06)';
          });
          var activeRow = document.querySelector('#subtitle-list-container > div[data-sub-id="' + active.id + '"]');
          if (activeRow) {
            activeRow.style.background   = 'rgba(124,58,237,0.12)';
            activeRow.style.borderColor  = 'rgba(167,139,250,0.4)';
            activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }

        /* Bôi màu đúng từ đang nói, cập nhật mỗi frame theo thời gian thật */
        if (_wordSpans && active.words) {
          var idx = -1;
          for (var w = 0; w < active.words.length; w++) {
            if (ct >= active.words[w].start) idx = w; else break;
          }
          if (idx !== _lastWordIdx) {
            for (var k = 0; k < _wordSpans.length; k++) {
              _wordSpans[k].className = 'hd68-word' +
                (k < idx ? ' hd68-word-said' : (k === idx ? ' hd68-word-active' : ''));
            }
            _lastWordIdx = idx;
          }
        }
      } else {
        if (lastId !== null) {
          barEl.style.opacity = '0';
          lastId = null;
          _wordSpans = null;
          _lastWordIdx = -1;
          document.querySelectorAll('#subtitle-list-container > div').forEach(function(r) {
            r.style.background  = 'rgba(255,255,255,0.03)';
            r.style.borderColor = 'rgba(255,255,255,0.06)';
          });
        }
      }
    }
    loop();
  }

  /* ──────────────────────────────────────────────────────────
     SRT export
  ────────────────────────────────────────────────────────── */
  function exportSRT() {
    if (subtitleList.length === 0) {
      showToast('warning', '!', 'Khong co phu de nao de xuat!');
      return;
    }
    var srt = '';
    subtitleList.forEach(function(sub, i) {
      srt += (i + 1) + '\n';
      srt += toSRTTime(sub.start) + ' --> ' + toSRTTime(sub.end) + '\n';
      srt += sub.text + '\n\n';
    });
    var blob = new Blob(['\uFEFF' + srt], { type: 'text/plain;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'HD68_subtitles.srt';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('success', 'ok', 'Da xuat ' + subtitleList.length + ' phu de → HD68_subtitles.srt', 3000);
  }

  /* ──────────────────────────────────────────────────────────
     Color grading
  ────────────────────────────────────────────────────────── */
  function applyColorGrade(style) {
    var video = document.getElementById('main-video');
    if (!video) return;
    var grades = {
      cinematic: 'contrast(1.15) saturate(0.75) brightness(0.88)',
      warm:      'sepia(0.3) saturate(1.3) brightness(1.05) hue-rotate(-10deg)',
      cool:      'saturate(0.85) brightness(1.08) hue-rotate(-25deg)',
      moody:     'contrast(1.3) saturate(0.6) brightness(0.8)',
      vibrant:   'contrast(1.1) saturate(1.6) brightness(1.05)',
    };
    video.style.filter = grades[style] || '';
  }

  /* ──────────────────────────────────────────────────────────
     Time helpers
  ────────────────────────────────────────────────────────── */
  function formatSubTime(sec) {
    var m = Math.floor(sec / 60);
    var s = (sec % 60).toFixed(1);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function toSRTTime(sec) {
    var h  = Math.floor(sec / 3600);
    var m  = Math.floor((sec % 3600) / 60);
    var s  = Math.floor(sec % 60);
    var ms = Math.round((sec % 1) * 1000);
    function pad(n, l) { return String(n).padStart(l, '0'); }
    return pad(h,2) + ':' + pad(m,2) + ':' + pad(s,2) + ',' + pad(ms,3);
  }

  /* ──────────────────────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────────────────────── */
  return {
    runTool:           runTool,
    generateSubtitles: generateSubtitles,
    stopRecognition:   stopRecognition,
    addSubtitle:       addSubtitle,
    deleteSubtitle:    deleteSubtitle,
    exportSRT:         exportSRT,
    runTranslate:      runTranslate,
    getSubtitles:      function() { return subtitleList; },
    editSubtitleText:  editSubtitleText,
    getSubPosY:        function() { return subStyle.posY; },
    getSubStyle:       function() { return subStyle; },
    isSubEnabled:      function() { return subEnabled; },
    applyColorGrade:   applyColorGrade,
    isRunning:         function() { return isRunning; },
  };

}());
