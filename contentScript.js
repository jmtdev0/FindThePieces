// contentScript.js
// Show puzzle pieces on web pages based on user preferences

(function() {
  // Avoid running in iframes or extension pages
  if (window.top !== window.self || window.location.protocol.startsWith('chrome')) return;

  let currentTimeout = null;
  let showPieces = true; // Default to enabled
  // Maximum number of pieces allowed simultaneously on the page
  // No global maximum by default; allow any number of pieces across different images.
  // Keep a per-image guard so only one piece per image appears at once.
  const MAX_SIMULTANEOUS_PIECES = Infinity; // xd
  // Extension validity watcher
  let extensionCheckIntervalId = null;
  let extensionInvalid = false;
  let extensionFailureCount = 0;
  const EXTENSION_FAILURE_THRESHOLD = 3; // require 3 consecutive failures before invalidating
  // Per-image scheduler map: imageIndex -> timeoutId
  const perImageTimeouts = new Map();
  // Per-image currently-effective frequency (updated when messages arrive)
  const perImageFreqs = new Map();
  // Per-tab eligibility map: imageIndex -> boolean. Decided once per tab lifetime.
  const tabImageEligibility = new Map();
  // Per-image paused state when a piece is already visible in this tab
  const perImagePausedDueToVisible = new Set();
  // Per-tab per-image collected count (only counts local clicks in this tab)
  const perTabCollectedCounts = new Map(); // imageIndex -> count
  // Polling interval to check storage for externally-collected pieces
  let collectedPollIntervalId = null;
  // Cursor for collection events feed
  let lastSeenFeedId = 0;

  // Append a lightweight collection event into ftp_collectionFeed (keeps last 10)
  function appendCollectionEvent(imageIndex, pieceIndex) {
    try {
      // Prefer notifying background to append to the feed to avoid storage I/O in the content script
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: 'FTP_CS_FEED_APPEND', imageIndex, pieceIndex });
          return;
        } catch (_) {}
      }
      // Fallback: append directly if runtime messaging is unavailable
      const now = Date.now();
      if (chrome && chrome.storage && chrome.storage.local && chrome.storage.local.get) {
        chrome.storage.local.get(['ftp_collectionFeed', 'ftp_collectionSeq'], (res) => {
          try {
            const feed = Array.isArray(res.ftp_collectionFeed) ? res.ftp_collectionFeed.slice() : [];
            const nextSeq = (typeof res.ftp_collectionSeq === 'number' ? res.ftp_collectionSeq : 0) + 1;
            feed.push({ id: nextSeq, imageIndex, pieceIndex, ts: now });
            // Keep only last 10 events
            const pruned = feed.length > 10 ? feed.slice(-10) : feed;
            chrome.storage.local.set({ ftp_collectionFeed: pruned, ftp_collectionSeq: nextSeq });
          } catch (_) {}
        });
      }
    } catch (_) {}
  }

  function getCollectedCountForTab(imgIdx) {
    try { return perTabCollectedCounts.get(imgIdx) || 0; } catch (_) { return 0; }
  }
  function incrementCollectedCountForTab(imgIdx) {
    const next = getCollectedCountForTab(imgIdx) + 1;
    try { perTabCollectedCounts.set(imgIdx, next); } catch (_) {}
    return next;
  }

  // Debug logging control
  // Toggle this to enable/disable console output from this content script
  let IT_DEBUG = true;
  // Optional: allow enabling via window.FTP_DEBUG or localStorage('FTP_DEBUG' = '1'|'true')
  try {
    if (typeof window !== 'undefined' && typeof window.FTP_DEBUG === 'boolean') {
      IT_DEBUG = window.FTP_DEBUG;
    } else {
      const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem('FTP_DEBUG') : null;
      if (stored && /^(1|true)$/i.test(String(stored))) IT_DEBUG = true;
    }
  } catch (_) {}

  // Preserve the original console.log and wrap it so logs only emit when IT_DEBUG is true
  const __FTP_ORIG_CONSOLE_LOG__ = (console && console.log) ? console.log.bind(console) : function(){};
  function itLog() {
    if (!IT_DEBUG) return;
    try { __FTP_ORIG_CONSOLE_LOG__.apply(console, arguments); } catch (_) {}
  }
  // Redirect console.log to our gated logger for this script's execution context
  try { console.log = itLog; } catch (_) {}

  // Helpers: visible pieces and overlap detection
  function getVisiblePieces() {
    return Array.from(document.querySelectorAll('.find-the-piece'));
  }

  // Compute per-second probability based on frequency with simple rules:
  // - If freq <= 1 => p = 1
  // - If freq >= 100 => p = 0.01 (exception)
  // - Else p = 1 - (freq / 100)
  // mode: 'eligibility' (default) uses base/2, 'attempt' uses base/3
  function probabilityFromFrequency(freq, mode = 'eligibility') {
  const f = (typeof freq === 'number' && isFinite(freq)) ? freq : 5;
  // Keep the exceptional rule: frequency 1 always yields probability 1
  if (f <= 1) return 1;
  // Preserve an upper frequency guard to avoid nonsensical inputs
  if (f >= 100) return 0.01;

  // Original mapping: base = 1 - (f / 100)
  const base = 1 - (f / 100);
  let p;
  if (mode === 'attempt') {
    // per-attempt show: reduce to one third of original
    p = base / 3;
  } else {
    // eligibility (tab-level): keep half
    p = base;
  }
  // Guard tiny numerical drift and keep within [0.01, 1]
  if (p < 0.01) return 0.01;
  if (p > 1) return 1;
  return p;
  }

  function rectsOverlap(r1, r2, margin = 8) {
    // Expand each rect by margin and check overlap
    return !(r1.right + margin <= r2.left - margin ||
             r1.left - margin >= r2.right + margin ||
             r1.bottom + margin <= r2.top - margin ||
             r1.top - margin >= r2.bottom + margin);
  }

  function findNonOverlappingPosition(displayW, displayH, tries = 12) {
    const margin = 40;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const existing = getVisiblePieces().map(el => el.getBoundingClientRect());

    for (let t = 0; t < tries; t++) {
      const x = Math.floor(Math.random() * Math.max(1, (viewportW - displayW - margin))) + Math.floor(margin/2);
      const y = Math.floor(Math.random() * Math.max(1, (viewportH - displayH - margin))) + Math.floor(margin/2);
      const rect = { left: x, top: y, right: x + displayW, bottom: y + displayH };
      let conflict = false;
      for (const ex of existing) {
        if (rectsOverlap(rect, ex, 8)) { conflict = true; break; }
      }
      if (!conflict) return { x, y };
    }
    // Fallback: return a random position even if overlapping after tries
    return {
      x: Math.floor(Math.random() * Math.max(1, (viewportW - displayW - margin))) + Math.floor(margin/2),
      y: Math.floor(Math.random() * Math.max(1, (viewportH - displayH - margin))) + Math.floor(margin/2)
    };
  }

  function startImageScheduler(imgIdx, img) {
    if (extensionInvalid) return;
    // Avoid creating multiple timers for same image
    if (perImageTimeouts.has(imgIdx)) return;

    // Determine the effective starting frequency for this image in this tab.
    // If we've already received a FREQUENCY_CHANGED message for this tab, prefer that value
    // to avoid overwriting a newer frequency when the scheduler is restarted.
    const initialFreq = perImageFreqs.has(imgIdx)
      ? perImageFreqs.get(imgIdx)
      : ((img && typeof img.frequency === 'number' && img.frequency > 0) ? img.frequency : 5);
    // Only set the map if we didn't already have a value (preserve external updates)
    if (!perImageFreqs.has(imgIdx)) {
      try { perImageFreqs.set(imgIdx, initialFreq); } catch (e) {}
    }

  const attemptFn = function tryLaunch() {
      if (!showPieces || extensionInvalid) return;
      // If we've reached max simultaneous pieces, defer next attempt
      const visibleCount = getVisiblePieces().length;
      if (visibleCount >= MAX_SIMULTANEOUS_PIECES) {
        try { console.log('[FTP contentScript][img', imgIdx, '] Intento diferido: límite simultáneo alcanzado -> visibles =', visibleCount); } catch (e) {}
  // retry after 7s
  try { const prev = perImageTimeouts.get(imgIdx); if (prev) clearTimeout(prev); } catch (e) {}
  perImageTimeouts.set(imgIdx, setTimeout(tryLaunch, 7000));
        return;
      }

      // Cap rule: if freq>50 and this tab already collected 5 pieces for this image, stop scheduling in this tab
      try {
        const fNowCap = (perImageFreqs.has(imgIdx) ? perImageFreqs.get(imgIdx) : ((img && typeof img.frequency === 'number' && img.frequency > 0) ? img.frequency : 5));
        if (fNowCap > 50 && getCollectedCountForTab(imgIdx) >= 5) {
          try { const prevCap = perImageTimeouts.get(imgIdx); if (prevCap) clearTimeout(prevCap); } catch (e) {}
          perImageTimeouts.delete(imgIdx);
          try { console.log('[FTP contentScript][img', imgIdx, '] Cap aplicado: 5 piezas ya recogidas en esta pestaña (freq>50).'); } catch (e) {}
          return;
        }
      } catch (e) {}

      // If this tab is not eligible for this image, skip
      if (!decideEligibilityForImage(img, imgIdx)) {
        // This tab won’t show pieces for this image: stop this image’s scheduler for this tab
        try { const prev = perImageTimeouts.get(imgIdx); if (prev) clearTimeout(prev); } catch (e) {}
        perImageTimeouts.delete(imgIdx);
        return;
      }

      // If there's already a visible piece from this same image on the page, defer
      try {
        const existingForImage = document.querySelector(`.find-the-piece[data-image-index="${imgIdx}"]`);
        if (existingForImage) {
          // Pause this image's scheduler until the visible piece is collected
          try { const prev = perImageTimeouts.get(imgIdx); if (prev) clearTimeout(prev); } catch (e) {}
          perImageTimeouts.delete(imgIdx);
          try { perImagePausedDueToVisible.add(imgIdx); } catch (e) {}
          return;
        }
      } catch (e) {}

  // Compute chance based on current image frequency (may have been updated via messages)
  const freqNow = (perImageFreqs.has(imgIdx) ? perImageFreqs.get(imgIdx) : ((img && typeof img.frequency === 'number' && img.frequency > 0) ? img.frequency : 5));
  const p = probabilityFromFrequency(freqNow, 'attempt');
      const r = Math.random();
      try { console.log('[FTP contentScript][img', imgIdx, `] Cálculo aleatorio: freq=${freqNow} -> p=${p.toFixed(3)}; r=${r.toFixed(3)} =>`, (r < p ? 'Se muestra' : 'No se muestra')); } catch (e) {}
      if (r < p) {
        // Need fresh image state from storage to avoid showing already-collected pieces
        try {
          chrome.storage && chrome.storage.local && chrome.storage.local.get ?
            chrome.storage.local.get(['findThePiecesImages', 'findThePixelsImages'], (res) => {
              let shouldReschedule = true;
              try {
                const imgs = (res && (res.findThePiecesImages || res.findThePixelsImages)) || [];
                const freshImg = imgs && imgs[imgIdx];
                if (!freshImg || !freshImg.puzzle) {
                  // image removed or no longer a puzzle -> stop scheduler
                  stopImageScheduler(imgIdx);
                  shouldReschedule = false;
                  return;
                }

                const rows = freshImg.puzzleRows || freshImg.gridSize || 3;
                const cols = freshImg.puzzleCols || freshImg.gridSize || 3;
                const totalPieces = rows * cols;
                const collected = Array.isArray(freshImg.collectedPieces) ? freshImg.collectedPieces : [];
                let availablePieces = Array.from({ length: totalPieces }, (_, i) => i).filter(i => !collected.includes(i));

                // Exclude pieces that are already visible on this page (not yet collected)
                try {
                  const visibleOnPage = getVisiblePieces().filter(el => String(el.getAttribute('data-image-index')) === String(imgIdx)).map(el => parseInt(el.getAttribute('data-piece-index'), 10)).filter(n => !isNaN(n));
                  if (visibleOnPage.length) {
                    availablePieces = availablePieces.filter(i => visibleOnPage.indexOf(i) === -1);
                  }
                } catch (e) {}

                if (availablePieces.length > 0) {
                  const pieceIdx = availablePieces[Math.floor(Math.random() * availablePieces.length)];
                  // pass the fresh image object and the current frequency to showPiece so widths/collected state are up-to-date
                  const sendFreq = (perImageFreqs.has(imgIdx) ? perImageFreqs.get(imgIdx) : initialFreq);
                  try { console.log('[FTP contentScript][img', imgIdx, '] Mostrar pieza seleccionada:', pieceIdx, 'entre', availablePieces.length, 'disponibles'); } catch (e) {}
                  // Guard: if cap reached exactly after last collection, skip showing
                  try { if (sendFreq > 50 && getCollectedCountForTab(imgIdx) >= 5) { shouldReschedule = false; stopImageScheduler(imgIdx); return; } } catch (e) {}
                  showPiece({ img: freshImg, imgIdx, pieceIdx, frequency: sendFreq, rows, cols });
                } else {
                  // no pieces left -> stop scheduler for this image and do not reschedule
                  try { console.log('[FTP contentScript][img', imgIdx, '] No hay piezas disponibles para mostrar. Deteniendo scheduler para esta imagen'); } catch (e) {}
                  stopImageScheduler(imgIdx);
                  shouldReschedule = false;
                }
              } catch (e) {
                // ignore transient storage errors
              } finally {
                // schedule next attempt after async handling
                if (shouldReschedule) {
                  try { const prev = perImageTimeouts.get(imgIdx); if (prev) clearTimeout(prev); } catch (e) {}
                  perImageTimeouts.set(imgIdx, setTimeout(tryLaunch, 7000));
                }
              }
            }) :
            // storage not available; fallback: schedule next attempt or mark invalid
            perImageTimeouts.set(imgIdx, setTimeout(tryLaunch, 7000));
        } catch (e) {
          // schedule next attempt on error
          perImageTimeouts.set(imgIdx, setTimeout(tryLaunch, 7000));
        }
      } else {
  // did not pass probability gate; schedule next attempt
  try { console.log('[FTP contentScript][img', imgIdx, '] Resultado: No se muestra (se reintenta en 7s)'); } catch (e) {}
        perImageTimeouts.set(imgIdx, setTimeout(tryLaunch, 7000));
      }
    };

  // start first attempt after a small random delay to avoid alignment
  const initialDelay = 500 + Math.floor(Math.random() * 1000);
  perImageTimeouts.set(imgIdx, setTimeout(attemptFn, initialDelay));
  }

  function stopImageScheduler(imgIdx) {
    try {
      const t = perImageTimeouts.get(imgIdx);
      if (t) { clearTimeout(t); }
    } catch (e) {}
    perImageTimeouts.delete(imgIdx);
  }

  function stopAllImageSchedulers() {
    try {
      perImageTimeouts.forEach((t, k) => { try { clearTimeout(t); } catch {} });
    } catch (e) {}
    perImageTimeouts.clear();
  }

  // Start polling every ~2 seconds to check if any visible piece was collected elsewhere (via feed)
  function startCollectedPolling() {
    try { if (collectedPollIntervalId) return; } catch (_) {}
    collectedPollIntervalId = setInterval(() => {
      try {
        if (!showPieces) return;
        const visible = getVisiblePieces();
        chrome.storage && chrome.storage.local && chrome.storage.local.get && chrome.storage.local.get(['ftp_collectionFeed', 'ftp_collectionSeq'], (res) => {
          try {
            const feed = Array.isArray(res.ftp_collectionFeed) ? res.ftp_collectionFeed : [];
            const newEvents = feed.filter(ev => ev && typeof ev.id === 'number' && ev.id > lastSeenFeedId);
            if (!newEvents.length) return;
            lastSeenFeedId = Math.max(lastSeenFeedId, ...newEvents.map(e => e.id));
            if (!visible || !visible.length) return;
            // Remove any visible piece that matches a new event
            visible.forEach((node) => {
              try {
                const imgIdx = parseInt(node.getAttribute('data-image-index'), 10);
                const pieceIdx = parseInt(node.getAttribute('data-piece-index'), 10);
                if (isNaN(imgIdx) || isNaN(pieceIdx)) return;
                if (newEvents.some(ev => ev.imageIndex === imgIdx && ev.pieceIndex === pieceIdx)) {
                  try { node.remove(); } catch (_) {}
                  // If no other piece from this image remains visible, restart scheduler
                  try {
                    const stillVisible = document.querySelector(`.find-the-piece[data-image-index="${imgIdx}"]`);
                    if (!stillVisible) {
                      perImagePausedDueToVisible.delete(imgIdx);
                      // Fetch latest image to resume scheduler with authoritative state
                      chrome.storage && chrome.storage.local && chrome.storage.local.get && chrome.storage.local.get(['findThePiecesImages', 'findThePixelsImages'], (r2) => {
                        try {
                          const imgs = (r2 && (r2.findThePiecesImages || r2.findThePixelsImages)) || [];
                          const imgObj = imgs && imgs[imgIdx];
                          if (imgObj && imgObj.puzzle) startImageScheduler(imgIdx, imgObj);
                        } catch (_) {}
                      });
                    }
                  } catch (_) {}
                }
              } catch (_) {}
            });
          } catch (_) {}
        });
      } catch (_) {}
    }, 2000);
  }

  function stopCollectedPolling() {
    try { if (collectedPollIntervalId) { clearInterval(collectedPollIntervalId); } } catch (_) {}
    collectedPollIntervalId = null;
  }

  // Show another piece from a specific image immediately (used after a piece is collected)
  function launchPieceForImageNow(imgIdx) {
    if (extensionInvalid || !showPieces) return;
    try {
  // Cap early exit: if freq>50 and cap reached in this tab, do not launch
  try {
    const fEarly = perImageFreqs.has(imgIdx) ? perImageFreqs.get(imgIdx) : 5;
    if (fEarly > 50 && getCollectedCountForTab(imgIdx) >= 5) { return; }
  } catch (e) {}
  // If there's already a visible piece from this image, do not show another
  try { if (document.querySelector(`.find-the-piece[data-image-index="${imgIdx}"]`)) { startImageScheduler(imgIdx, null); return; } } catch (e) {}
      // Clear any existing timer for the image so we can show immediately
      try { const prev = perImageTimeouts.get(imgIdx); if (prev) clearTimeout(prev); } catch (e) {}
      perImageTimeouts.delete(imgIdx);

      chrome.storage && chrome.storage.local && chrome.storage.local.get ?
        chrome.storage.local.get(['findThePiecesImages', 'findThePixelsImages'], (res) => {
          try {
            const imgs = (res && (res.findThePiecesImages || res.findThePixelsImages)) || [];
            const freshImg = imgs && imgs[imgIdx];
            if (!freshImg || !freshImg.puzzle) {
              stopImageScheduler(imgIdx);
              return;
            }

            const rows = freshImg.puzzleRows || freshImg.gridSize || 3;
            const cols = freshImg.puzzleCols || freshImg.gridSize || 3;
            const totalPieces = rows * cols;
            const collected = Array.isArray(freshImg.collectedPieces) ? freshImg.collectedPieces : [];
            let availablePieces = Array.from({ length: totalPieces }, (_, i) => i).filter(i => !collected.includes(i));

            // Exclude pieces already visible on this page for this image
            try {
              const visibleOnPage = getVisiblePieces().filter(el => String(el.getAttribute('data-image-index')) === String(imgIdx)).map(el => parseInt(el.getAttribute('data-piece-index'), 10)).filter(n => !isNaN(n));
              if (visibleOnPage.length) {
                availablePieces = availablePieces.filter(i => visibleOnPage.indexOf(i) === -1);
              }
            } catch (e) {}

            if (availablePieces.length > 0) {
              const pieceIdx = availablePieces[Math.floor(Math.random() * availablePieces.length)];
              // Refresh current frequency from storage and persist to cache
              const freqNow = (freshImg && typeof freshImg.frequency === 'number' && freshImg.frequency > 0) ? freshImg.frequency : 5;
              try { perImageFreqs.set(imgIdx, freqNow); } catch (e) {}
              try { console.log('[FTP contentScript][img', imgIdx, '] Frecuencia actualizada desde storage tras recoger pieza ->', freqNow); } catch (e) {}
              // Enforce cap right before showing
              try { if (freqNow > 50 && getCollectedCountForTab(imgIdx) >= 5) { return; } } catch (e) {}
              showPiece({ img: freshImg, imgIdx, pieceIdx, rows, cols, frequency: freqNow });
              // Restart per-image scheduler for continued attempts
              try { startImageScheduler(imgIdx, freshImg); } catch (e) {}
            } else {
              // No pieces left -> stop scheduler
              stopImageScheduler(imgIdx);
            }
          } catch (e) {
            // ignore transient storage errors
            // restart scheduler to continue normal flow
            try { startImageScheduler(imgIdx, imgs && imgs[imgIdx]); } catch (ee) {}
          }
        }) :
        // storage not available -> just restart scheduler to resume normal behavior
        startImageScheduler(imgIdx, null);
    } catch (e) {}
  }

  function handleExtensionInvalid() {
  // NOTE: intentionally do NOT remove pieces or stop schedulers here.
  // The extension context may fluctuate; avoid removing UI elements automatically.
  if (extensionInvalid) return;
  extensionInvalid = true;
  try { console.log('[FTP contentScript] extension context invalidated (no-op): not removing pieces'); } catch {}
  }

  function checkExtensionAlive() {
    if (extensionInvalid) return;
    try {
      if (!(chrome && chrome.runtime && chrome.runtime.sendMessage)) {
        extensionFailureCount++;
        if (extensionFailureCount >= EXTENSION_FAILURE_THRESHOLD) handleExtensionInvalid();
        return;
      }
      // Try a harmless message; be tolerant and only treat specific lastError messages as fatal
      try {
        chrome.runtime.sendMessage({ type: 'FTP_PING' }, function() {
          const err = chrome.runtime && chrome.runtime.lastError;
          if (err) {
            const msg = String(err.message || '');
            const fatal = /Extension context invalidated|Could not establish connection|The message port closed before a response was received/i.test(msg);
            if (fatal) {
              extensionFailureCount++;
              if (extensionFailureCount >= EXTENSION_FAILURE_THRESHOLD) handleExtensionInvalid();
            } else {
              // non-fatal transient error, reset counter
              extensionFailureCount = 0;
            }
          } else {
            // success: reset failure counter
            extensionFailureCount = 0;
          }
        });
      } catch (e) {
        extensionFailureCount++;
        if (extensionFailureCount >= EXTENSION_FAILURE_THRESHOLD) handleExtensionInvalid();
      }
    } catch (e) {
      extensionFailureCount++;
      if (extensionFailureCount >= EXTENSION_FAILURE_THRESHOLD) handleExtensionInvalid();
    }
  }

  // Compute (once) whether this tab is eligible to show pieces for a given image.
  // Rule: reuse probabilityFromFrequency(freq) so eligibility matches per-second mapping.
  // If frequency missing or invalid, default to 5.
  function decideEligibilityForImage(img, imgIdx) {
  const freq = (img && typeof img.frequency === 'number' && img.frequency > 0) ? img.frequency : 5;
    // Exceptional rule: if freq is exactly 1, force eligibility in this tab even if previously set to false
    if (freq === 1) {
      tabImageEligibility.set(imgIdx, true);
      try { console.log('[FTP contentScript] eligibility override (freq=1) for image', imgIdx, '-> true'); } catch (e) {}
      return true;
    }
  // Cap rule: if freq>50 and this tab has already collected 5 pieces for this image, treat as ineligible
  try { if (freq > 50 && getCollectedCountForTab(imgIdx) >= 5) return false; } catch (e) {}
    if (tabImageEligibility.has(imgIdx)) return tabImageEligibility.get(imgIdx);
    const pGate = probabilityFromFrequency(freq);
    const allowed = Math.random() < pGate;
    tabImageEligibility.set(imgIdx, allowed);
    console.log('[FTP contentScript] eligibility decision for image', imgIdx, 'freq=', freq, 'pGate=', pGate.toFixed(3), '->', allowed);
    return allowed;
  }

  // Initialize: Check if extension is enabled
  chrome.storage.local.get(['showPieces'], (result) => {
    showPieces = result.showPieces !== false; // Default to true if not set
    console.log('[FTP contentScript] init - storage.showPieces ->', result && result.showPieces, 'effective showPieces ->', showPieces);
    if (showPieces) {
      startPieceScheduler();
      startCollectedPolling();
    }
  // No periodic extension liveness check started (disabled by user request)
  });

  // Listen for toggle messages from main page
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'toggleContentScript') {
      // Message can come from runtime.sendMessage or from tabs.sendMessage
  console.log('[FTP contentScript] runtime.onMessage received toggleContentScript ->', msg.enabled, 'from', sender && sender.tab ? sender.tab.url : 'runtime');
  showPieces = !!msg.enabled;

      if (!showPieces) {
        // Stop all schedulers and remove any displayed pieces from the DOM
        try {
          if (currentTimeout) { clearTimeout(currentTimeout); currentTimeout = null; }
        } catch (e) {}
        try { stopAllImageSchedulers(); } catch (e) {}
        try { stopCollectedPolling(); } catch (e) {}
        try {
          document.querySelectorAll('.find-the-piece').forEach(node => { try { node.remove(); } catch (e) {} });
          console.log('[FTP contentScript] toggleContentScript -> disabled: removed displayed pieces and stopped schedulers');
        } catch (e) {}
      } else {
        // Start showing pieces
        startPieceScheduler();
        startCollectedPolling();
      }
    } else if (msg && msg.type === 'PIECE_COLLECTED_GLOBAL') {
      const { imageIndex, pieceIndex } = msg;
      console.log('[FTP contentScript] PIECE_COLLECTED_GLOBAL ->', imageIndex, pieceIndex);
      // Find any currently displayed matching piece(s) and remove them
      const nodes = document.querySelectorAll('.find-the-piece');
      let removedAny = false;
      nodes.forEach((node) => {
        const imgIdxAttr = node.getAttribute('data-image-index');
        const pieceIdxAttr = node.getAttribute('data-piece-index');
        if (String(imgIdxAttr) === String(imageIndex) && String(pieceIdxAttr) === String(pieceIndex)) {
          try { node.remove(); removedAny = true; } catch {}
        }
      });
      // If we removed a piece (i.e., this tab was also showing it), resume scheduling here as well
      if (removedAny && showPieces) {
        // Refresh image from storage, update frequency cache, and resume the scheduler if not complete
        try {
          chrome.storage && chrome.storage.local && chrome.storage.local.get && chrome.storage.local.get(['findThePiecesImages', 'findThePixelsImages'], (res) => {
            const imgs = res && (res.findThePiecesImages || res.findThePixelsImages) || [];
            const imgObj = imgs && imgs[imageIndex];
            if (!imgObj || !imgObj.puzzle) { try { stopImageScheduler(imageIndex); } catch (e) {}; return; }
            const rows = imgObj.puzzleRows || imgObj.gridSize || 3;
            const cols = imgObj.puzzleCols || imgObj.gridSize || 3;
            const totalPieces = rows * cols;
            const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces : [];
            // Update local frequency cache from storage
            try { const freshFreq = (typeof imgObj.frequency === 'number' && imgObj.frequency > 0) ? imgObj.frequency : 5; perImageFreqs.set(imageIndex, freshFreq); } catch (e) {}
            if (collected.length >= totalPieces) {
              try { stopImageScheduler(imageIndex); } catch (e) {}
              return;
            }
            // Clear paused flag and start scheduler (do not show immediately)
            try { perImagePausedDueToVisible.delete(imageIndex); } catch (e) {}
            try {
              if (decideEligibilityForImage(imgObj, imageIndex)) {
                startImageScheduler(imageIndex, imgObj);
              }
            } catch (e) {
              // If eligibility check fails, attempt to start; attempt loop will stop if ineligible
              try { startImageScheduler(imageIndex, imgObj); } catch (_) {}
            }
          });
        } catch (e) {}
      }
    }
    else if (msg && msg.type === 'NEW_IMAGE_ADDED') {
      const { imageIndex, imageData } = msg;
      try {
        console.log('[FTP contentScript] NEW_IMAGE_ADDED ->', imageIndex);
        if (!showPieces) return;
        if (!imageData || !imageData.puzzle) return;
        // Skip if already complete
        try {
          const rows = imageData.puzzleRows || imageData.gridSize || 3;
          const cols = imageData.puzzleCols || imageData.gridSize || 3;
          const totalPieces = rows * cols;
          const collected = Array.isArray(imageData.collectedPieces) ? imageData.collectedPieces : [];
          if (collected.length >= totalPieces) return;
        } catch (e) {}
        // Decide eligibility for this tab and start scheduler for the new image
  try { if (decideEligibilityForImage(imageData, imageIndex)) startImageScheduler(imageIndex, imageData); } catch (e) {}
      } catch (e) {}
    }
    else if (msg && msg.type === 'FREQUENCY_CHANGED') {
      try {
        const { imageIndex, frequency, oldFrequency } = msg;
  try { console.log('[FTP contentScript] FREQUENCY_CHANGED received for image', imageIndex, 'new frequency=', frequency, 'old frequency=', oldFrequency); } catch (e) {}
        if (!showPieces) return;
        // Update the per-image frequency so schedulers use the new value immediately
        try { perImageFreqs.set(imageIndex, (typeof frequency === 'number' && frequency > 0) ? frequency : 5); } catch (e) {}

        try {
          const already = document.querySelector(`.find-the-piece[data-image-index="${imageIndex}"]`);
          if (!already) {
            // No piece currently visible for this image in this tab: restart scheduler so the new frequency affects the next attempts immediately
            try { stopImageScheduler(imageIndex); } catch (e) {}
            // Only (re)start if this tab is eligible for that image
            try {
              chrome.storage.local.get(['findThePiecesImages', 'findThePixelsImages'], (res) => {
                const imgs = (res && (res.findThePiecesImages || res.findThePixelsImages)) || [];
                const imgObj = imgs && imgs[imageIndex];
                if (imgObj) {
                  // Skip restart if image is complete
                  try {
                    const rows = imgObj.puzzleRows || imgObj.gridSize || 3;
                    const cols = imgObj.puzzleCols || imgObj.gridSize || 3;
                    const totalPieces = rows * cols;
                    const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces : [];
                    if (collected.length >= totalPieces) return;
                  } catch (e) {}
                  // Exceptional rule: if freq becomes exactly 1, force eligibility in this tab
                  if (imgObj.frequency === 1) {
                    try { tabImageEligibility.set(imageIndex, true); console.log('[FTP contentScript] eligibility override on FREQUENCY_CHANGED (freq=1) for image', imageIndex); } catch (e) {}
                    startImageScheduler(imageIndex, imgObj);
                  } else if (decideEligibilityForImage(imgObj, imageIndex)) {
                    startImageScheduler(imageIndex, imgObj);
                  }
                }
              });
            } catch (e) {}
          } else {
            // A piece is currently visible; the updated frequency will be used on the next cycle after the piece is collected
            try { console.log('[FTP contentScript] FREQUENCY_CHANGED: piece currently visible for image', imageIndex, '- new frequency will be applied on next cycle'); } catch (e) {}
          }
        } catch (e) {}
      } catch (e) {}
    }
    // Handle image removal: remove any displayed pieces belonging to the removed image
    else if (msg && msg.type === 'IMAGE_REMOVED') {
      const { imageIndex } = msg;
      console.log('[FTP contentScript] IMAGE_REMOVED ->', imageIndex);
      const nodes = document.querySelectorAll('.find-the-piece');
      nodes.forEach((node) => {
        const imgIdxAttr = node.getAttribute('data-image-index');
        if (String(imgIdxAttr) === String(imageIndex)) {
          try { node.remove(); } catch {}
        }
      });
      // Stop any scheduler for that image
      try { stopImageScheduler(imageIndex); } catch (e) {}
    }
  });

  // Also listen to chrome.storage changes in case the main page updated the value via storage API
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes.showPieces) {
        const newVal = changes.showPieces.newValue;
        console.log('[FTP contentScript] storage.onChanged showPieces ->', newVal);
        showPieces = !!newVal;
        if (!showPieces) {
          console.log('[FTP contentScript] showPieces disabled via storage - stopping schedulers and removing displayed pieces');
          try { if (currentTimeout) { clearTimeout(currentTimeout); currentTimeout = null; } } catch (e) {}
          try { stopAllImageSchedulers(); } catch (e) {}
          try { stopCollectedPolling(); } catch (e) {}
          try { document.querySelectorAll('.find-the-piece').forEach(n => { try { n.remove(); } catch (e) {} }); } catch (e) {}
        } else {
          console.log('[FTP contentScript] showPieces enabled via storage - starting scheduler');
          startPieceScheduler();
          startCollectedPolling();
        }
      }
    });
  }

  function startPieceScheduler() {
    // Double-check authoritative value in storage
    chrome.storage.local.get(['showPieces'], (res) => {
      const enabled = res && typeof res.showPieces !== 'undefined' ? res.showPieces : showPieces;
      showPieces = enabled !== false;
      if (!showPieces) return;

      // proceed only if enabled
      // Try multiple possible key names
      chrome.storage.local.get(['findThePiecesImages', 'findThePixelsImages', 'images', 'allImages'], (result) => {
        let imageData = result.findThePiecesImages || result.findThePixelsImages || result.images || result.allImages;
        if (!imageData) {
          return;
        }
        // Only consider puzzle images that are not already completed
        const puzzleImages = imageData.filter(img => {
          if (!img || !img.puzzle) return false;
          try {
            if (img.completed) return false;
            const rows = img.puzzleRows || img.gridSize || 3;
            const cols = img.puzzleCols || img.gridSize || 3;
            const totalPieces = rows * cols;
            const collected = Array.isArray(img.collectedPieces) ? img.collectedPieces : [];
            if (collected.length >= totalPieces) return false;
          } catch (e) {}
          return true;
        });
        if (!puzzleImages.length) {
          return;
        }
        // Seed per-tab eligibility decisions once at start for all current puzzle images
        puzzleImages.forEach((img) => {
          const idx = imageData.indexOf(img);
          if (idx >= 0) decideEligibilityForImage(img, idx);
        });

        // Start an independent scheduler only for images eligible in this tab
        puzzleImages.forEach((img) => {
          const idx = imageData.indexOf(img);
          if (idx >= 0 && decideEligibilityForImage(img, idx)) startImageScheduler(idx, img);
        });
      });
    });
  }

  function scheduleNextPiece() {
    if (!showPieces) return;
  // Only schedule if we haven't reached the max simultaneous pieces
  if (getVisiblePieces().length >= MAX_SIMULTANEOUS_PIECES) return;

    // Attempt loop: every second check storage and decide probabilistically per image
    const launchAttempt = () => {
      // Quick guard
      if (!showPieces) { console.log('[FTP contentScript] launchAttempt aborted: showPieces==false'); return; }
      if (document.querySelector('.find-the-piece')) { console.log('[FTP contentScript] launchAttempt aborted: piece already visible'); return; }

      // Read authoritative values
      chrome.storage.local.get(['showPieces', 'findThePiecesImages', 'findThePixelsImages'], (res) => {
        const enabled = res && typeof res.showPieces !== 'undefined' ? res.showPieces : showPieces;
        if (enabled === false) {
          showPieces = false;
          return;
        }

        const imgs = res.findThePiecesImages || res.findThePixelsImages || [];
        const passingCandidates = [];

        imgs.forEach((img, imgIdx) => {
          if (!img || !img.puzzle) return;
          // Respect per-tab eligibility: if this tab is not eligible for this image, skip it entirely
          if (!decideEligibilityForImage(img, imgIdx)) return;
          const rows = img.puzzleRows || img.gridSize || 3;
          const cols = img.puzzleCols || img.gridSize || 3;
          const totalPieces = rows * cols;
          const collected = Array.isArray(img.collectedPieces) ? img.collectedPieces : [];
          const availablePieces = Array.from({ length: totalPieces }, (_, i) => i).filter(i => !collected.includes(i));
          if (availablePieces.length === 0) return;

          const freq = (typeof img.frequency === 'number' && img.frequency > 0) ? img.frequency : 5;
          const p = probabilityFromFrequency(freq, 'attempt');
          if (Math.random() < p) {
            const pieceIdx = availablePieces[Math.floor(Math.random() * availablePieces.length)];
            passingCandidates.push({ img, imgIdx, pieceIdx, frequency: freq, rows, cols });
          }
        });

        if (passingCandidates.length === 0) {
          // retry after 7s
          console.log('[FTP contentScript] no passing candidates this attempt; retrying in 7s');
          currentTimeout = setTimeout(launchAttempt, 7000);
          return;
        }

        const chosen = passingCandidates[Math.floor(Math.random() * passingCandidates.length)];
        console.log('[FTP contentScript] chosen candidate ->', { imgIdx: chosen.imgIdx, pieceIdx: chosen.pieceIdx, frequency: chosen.frequency });
        showPiece(chosen);
      });
    };

  if (currentTimeout) clearTimeout(currentTimeout);
  currentTimeout = setTimeout(launchAttempt, 7000);
  }

  function showPiece(candidate) {
  // Prevent showing if disabled or we've reached the allowed number of simultaneous pieces
  if (!showPieces) { console.log('[FTP contentScript] showPiece aborted: showPieces==false'); return; }
  if (getVisiblePieces().length >= MAX_SIMULTANEOUS_PIECES) {
    console.log('[FTP contentScript] showPiece aborted: max simultaneous pieces reached');
    return;
  }
  console.log('[FTP contentScript] showPiece candidate ->', { imgIdx: candidate.imgIdx, pieceIdx: candidate.pieceIdx });
    
    const { img, imgIdx, pieceIdx, rows, cols } = candidate;
    // Calcular dimensiones de la pieza y posición
    const imgW = img.width || 1000;
    const imgH = img.height || 1000;
    const pieceW = imgW / cols;
    const pieceH = imgH / rows;
    const col = pieceIdx % cols;
    const row = Math.floor(pieceIdx / cols);
    const sx = col * pieceW;
    const sy = row * pieceH;

    const imageEl = new Image();
    imageEl.onload = function() {
      const canvas = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(pieceW * dpr);
      canvas.height = Math.round(pieceH * dpr);
      canvas.style.width = pieceW + 'px';
      canvas.style.height = pieceH + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.drawImage(imageEl, sx, sy, pieceW, pieceH, 0, 0, pieceW, pieceH);
      const pieceDataUrl = canvas.toDataURL();
      
      // Calculate display size (max 60px)
      const maxSize = 60;
      const pieceAspect = pieceW / pieceH;
      let displayW, displayH;
      if (pieceAspect > 1) {
        displayW = maxSize;
        displayH = maxSize / pieceAspect;
      } else {
        displayH = maxSize;
        displayW = maxSize * pieceAspect;
      }
      
  // Random position on screen, try to avoid overlapping existing pieces
  const pos = findNonOverlappingPosition(displayW, displayH, 12);
  const x = pos.x;
  const y = pos.y;
      
      // Create and show the piece element
      const el = document.createElement('img');
      el.src = pieceDataUrl;
      el.alt = img.name || 'Puzzle piece';
      el.className = 'find-the-piece';
  el.setAttribute('data-image-index', String(imgIdx));
  el.setAttribute('data-piece-index', String(pieceIdx));
      el.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: ${displayW}px;
        height: ${displayH}px;
        z-index: 999999;
        border: 2px solid #b2d900;
        box-shadow: 0 2px 8px #ff910088;
        background: #fffbe6;
        cursor: pointer;
        transition: transform 0.2s;
        border-radius: 4px;
      `;
      el.title = `${img.name} - Piece ${pieceIdx + 1}`;
      
      el.addEventListener('click', () => {
        try { console.log('[FTP contentScript] CLICK pieza ->', { imgIdx, pieceIdx }); } catch (e) {}
        // alert('¡Pieza recogida!'); // Local feedback
        collectPiece(imgIdx, pieceIdx, el);
      });
      
      // Double-check before appending in case another piece was added while the image was loading
      // Re-check count and overlaps. If we've reached max, skip. If overlap detected, try a reposition before skipping.
      const visible = getVisiblePieces();
      // Ensure we don't already have a piece from the same image on this page
      if (document.querySelector(`.find-the-piece[data-image-index="${imgIdx}"]`)) {
        console.log('[FTP contentScript] skipping append: another piece from same image already visible');
        return;
      }
      if (visible.length >= MAX_SIMULTANEOUS_PIECES) {
        console.log('[FTP contentScript] skipping append: reached max simultaneous pieces while loading');
        return;
      }
      // If this position overlaps someone (rare because findNonOverlappingPosition tried), attempt a few quick repositions
      let overlapping = false;
      const thisRect = { left: x, top: y, right: x + displayW, bottom: y + displayH };
      for (const exEl of visible) {
        const ex = exEl.getBoundingClientRect();
        if (rectsOverlap(thisRect, ex, 8)) { overlapping = true; break; }
      }
      if (overlapping) {
        const alt = findNonOverlappingPosition(displayW, displayH, 8);
        el.style.left = alt.x + 'px';
        el.style.top = alt.y + 'px';
        // re-evaluate overlap quickly
        const altRect = { left: alt.x, top: alt.y, right: alt.x + displayW, bottom: alt.y + displayH };
        let stillOverlap = false;
        for (const exEl of visible) { if (rectsOverlap(altRect, exEl.getBoundingClientRect(), 8)) { stillOverlap = true; break; } }
        if (stillOverlap) {
          console.log('[FTP contentScript] still overlapping after reposition; skipping append');
          return;
        }
      }
      document.body.appendChild(el);
  console.log('[FTP contentScript] piece element appended to DOM ->', { imgIdx: imgIdx, pieceIdx: pieceIdx });
    };
    
    imageEl.onerror = function(e) {};
    imageEl.src = img.src;
  }

  function collectPiece(imgIdx, pieceIdx, element) {
      const t0 = performance.now ? performance.now() : Date.now();
      const logStep = (label) => {
        try {
          const now = performance.now ? performance.now() : Date.now();
          console.log(`[FTP collectPiece][img ${imgIdx} piece ${pieceIdx}] ${label} (+${(now - t0).toFixed(2)}ms)`);
        } catch(_) {}
      };
      logStep('start');

      // 1. Play sound (non-blocking)
      try {
        const src = (chrome && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('sounds/pop.mp3') : 'sounds/pop.mp3';
        const sfx = new Audio(src);
        try { sfx.volume = 0.6; } catch (_) {}
        const playPromise = sfx.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.then(() => { logStep('audio play resolved'); }).catch(() => { logStep('audio play rejected'); });
        }
      } catch (e) { logStep('audio exception'); }
      logStep('after audio trigger');

      // 2. Remove element optimistically
      try { element && element.remove && element.remove(); } catch (_) {}
      logStep('after element.remove');

      // 3. Increment local cap counter
      try {
        const countNow = incrementCollectedCountForTab(imgIdx);
        const fNowLocal = (perImageFreqs.has(imgIdx) ? perImageFreqs.get(imgIdx) : 5);
        if (fNowLocal > 50 && countNow === 5) {
          console.log(`[FTP collectPiece][img ${imgIdx}] cap reached (5 pieces, freq>50)`);
        }
      } catch (e) { logStep('increment counter exception'); }
      logStep('after counter increment');

      // 4. Append minimal event to feed (async); persistence of images is handled by main/background
      try {
        setTimeout(() => { appendCollectionEvent(imgIdx, pieceIdx); }, 0);
      } catch (e) { logStep('persist exception'); }
      logStep('after schedule persist');

      // 5. Cap enforcement check
      try {
        const fNowCap = (perImageFreqs.has(imgIdx) ? perImageFreqs.get(imgIdx) : 5);
        if (fNowCap > 50 && getCollectedCountForTab(imgIdx) >= 5) {
          try { stopImageScheduler(imgIdx); } catch(_) {}
          logStep('cap stop scheduler');
          return;
        }
      } catch (e) { logStep('cap check exception'); }
      logStep('after cap check');

      // 6. Clear paused flag
      try { perImagePausedDueToVisible.delete(imgIdx); } catch (e) { logStep('paused delete exception'); }
      logStep('after clear paused flag');

      // 7. Stop existing scheduler (if any)
      try { stopImageScheduler(imgIdx); } catch (e) { logStep('stop scheduler exception'); }
      logStep('after stop scheduler');

      // 8. Restart scheduler (could be replaced by immediate launch in future)
      try { startImageScheduler(imgIdx, null); } catch (e) { logStep('start scheduler exception'); }
      logStep('after start scheduler');
  }

})();
