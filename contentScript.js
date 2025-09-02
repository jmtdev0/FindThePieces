// contentScript.js
// Show puzzle pieces on web pages based on user preferences

(function() {
  // Avoid running in iframes or extension pages
  if (window.top !== window.self || window.location.protocol.startsWith('chrome')) return;

  let currentTimeout = null;
  let showPieces = true; // Default to enabled
  // Per-tab eligibility map: imageIndex -> boolean. Decided once per tab lifetime.
  const tabImageEligibility = new Map();

  // Compute (once) whether this tab is eligible to show pieces for a given image.
  // Probability rule requested: P(tab shows pieces for image) = 1 / (frequency / 10) = 10 / frequency
  // Clamped to [0,1]. If frequency missing or invalid, default to 5.
  function decideEligibilityForImage(img, imgIdx) {
    if (tabImageEligibility.has(imgIdx)) return tabImageEligibility.get(imgIdx);
    const freq = (typeof img.frequency === 'number' && img.frequency > 0) ? img.frequency : 5;
    let pGate = 10 / freq;
    if (pGate > 1) pGate = 1;
    if (pGate < 0) pGate = 0;
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
    }
  });

  // Listen for toggle messages from main page
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'toggleContentScript') {
      // Message can come from runtime.sendMessage or from tabs.sendMessage
  console.log('[FTP contentScript] runtime.onMessage received toggleContentScript ->', msg.enabled, 'from', sender && sender.tab ? sender.tab.url : 'runtime');
  showPieces = !!msg.enabled;

      if (!showPieces) {
        // Stop scheduler but keep any already-displayed pieces visible.
        if (currentTimeout) {
          clearTimeout(currentTimeout);
          currentTimeout = null;
        }
      } else {
        // Start showing pieces
        startPieceScheduler();
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
        // Avoid immediate double-schedule if another piece is visible
        if (!document.querySelector('.find-the-piece')) {
          console.log('[FTP contentScript] Matching piece removed (via global). Scheduling next piece.');
          scheduleNextPiece();
        }
      }
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
          console.log('[FTP contentScript] showPieces disabled via storage - clearing scheduler');
          if (currentTimeout) { clearTimeout(currentTimeout); currentTimeout = null; }
        } else {
          console.log('[FTP contentScript] showPieces enabled via storage - starting scheduler');
          startPieceScheduler();
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
        const puzzleImages = imageData.filter(img => img.puzzle);
        if (!puzzleImages.length) {
          return;
        }
        // Seed per-tab eligibility decisions once at start for all current puzzle images
        puzzleImages.forEach((img) => {
          const idx = imageData.indexOf(img);
          if (idx >= 0) decideEligibilityForImage(img, idx);
        });
    console.log('[FTP contentScript] startPieceScheduler -> scheduling next piece');
    scheduleNextPiece();
      });
    });
  }

  function scheduleNextPiece() {
    if (!showPieces) return;
    // If a piece is already visible on the page, don't start scheduling another one.
    if (document.querySelector('.find-the-piece')) return;

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
          const p = freq <= 1 ? 1 : (1 / freq);
          if (Math.random() < p) {
            const pieceIdx = availablePieces[Math.floor(Math.random() * availablePieces.length)];
            passingCandidates.push({ img, imgIdx, pieceIdx, frequency: freq, rows, cols });
          }
        });

        if (passingCandidates.length === 0) {
          // retry after 1s
          console.log('[FTP contentScript] no passing candidates this attempt; retrying in 1s');
          currentTimeout = setTimeout(launchAttempt, 1000);
          return;
        }

        const chosen = passingCandidates[Math.floor(Math.random() * passingCandidates.length)];
        console.log('[FTP contentScript] chosen candidate ->', { imgIdx: chosen.imgIdx, pieceIdx: chosen.pieceIdx, frequency: chosen.frequency });
        showPiece(chosen);
      });
    };

    if (currentTimeout) clearTimeout(currentTimeout);
    currentTimeout = setTimeout(launchAttempt, 1000);
  }

  function showPiece(candidate) {
  if (!showPieces) { console.log('[FTP contentScript] showPiece aborted: showPieces==false'); return; }
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
      
      // Random position on screen
      const margin = 40;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const x = Math.floor(Math.random() * (viewportW - displayW - margin)) + margin/2;
      const y = Math.floor(Math.random() * (viewportH - displayH - margin)) + margin/2;
      
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
        collectPiece(imgIdx, pieceIdx, el);
      });
      
      document.body.appendChild(el);
  console.log('[FTP contentScript] piece element appended to DOM ->', { imgIdx: imgIdx, pieceIdx: pieceIdx });
    };
    
    imageEl.onerror = function(e) {};
    imageEl.src = img.src;
  }

  function collectPiece(imgIdx, pieceIdx, element) {
    chrome.storage.local.get(['findThePiecesImages', 'findThePixelsImages'], (result) => {
      // Buscar en ambas claves
      const imagesArr = result.findThePiecesImages || result.findThePixelsImages;
      if (!imagesArr || !imagesArr[imgIdx]) return;
      
      const imgs = imagesArr;
      const imgObj = imgs[imgIdx];
      
      if (!Array.isArray(imgObj.collectedPieces)) {
        imgObj.collectedPieces = [];
      }
      
      if (!imgObj.collectedPieces.includes(pieceIdx)) {
        imgObj.collectedPieces.push(pieceIdx);
        
        // Guardar en la clave correcta
        let key = result.findThePiecesImages ? 'findThePiecesImages' : 'findThePixelsImages';
        chrome.storage.local.set({ [key]: imgs }, () => {
          element.remove();
          
          // Enviar mensaje al main script para actualizar la UI
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              type: 'PIECE_COLLECTED',
              imageIndex: imgIdx,
              pieceIndex: pieceIdx,
              collectedPieces: imgObj.collectedPieces
            });
          }
          
          // Check if puzzle is complete
          const rows = imgObj.puzzleRows || imgObj.gridSize || 3;
          const cols = imgObj.puzzleCols || imgObj.gridSize || 3;
          const totalPieces = rows * cols;
          if (imgObj.collectedPieces.length >= totalPieces) {
            // Puzzle completed
          }
          
          // Continuar el ciclo solo después de recoger la pieza (si la extensión sigue habilitada)
          if (showPieces) {
            scheduleNextPiece();
          }
        });
      }
    });
  }

})();
