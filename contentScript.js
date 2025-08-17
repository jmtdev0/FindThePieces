// contentScript.js
// Show puzzle images with 'puzzle' checked at random positions on every page

(function() {
  // Avoid running in iframes or extension pages
  if (window.top !== window.self || window.location.protocol.startsWith('chrome')) return;

  // Configuración de aparición aleatoria
  function getRandomDelay(minMinutes = 2, maxMinutes = 7) {
    return (Math.random() * (maxMinutes - minMinutes) + minMinutes) * 60 * 1000;
  }

  let currentTimeout = null;
  let lastPieceEl = null;

  function showRandomPiece(immediate = false) {
    chrome.storage.local.get(['findThePiecesImages'], (result) => {
      if (!result.findThePiecesImages) return;
      const puzzleImages = result.findThePiecesImages.filter(img => img.puzzle);
      if (!puzzleImages.length) return;

      // Buscar una imagen y pieza no recogida
      let candidates = [];
      puzzleImages.forEach((img, idx) => {
        const collected = Array.isArray(img.collectedPieces) ? img.collectedPieces : [];
        const availablePieces = Array.from({length: 9}, (_, i) => i).filter(i => !collected.includes(i));
        if (availablePieces.length > 0) {
          candidates.push({img, idx, availablePieces});
        }
      });
      if (!candidates.length) return;
      // Selecciona aleatoriamente una imagen y una pieza
      // Prioriza imágenes con frecuencia 1
      let freq1 = candidates.filter(c => c.img.frequency === 1);
      let chosen;
      if (freq1.length > 0) {
        chosen = freq1[Math.floor(Math.random() * freq1.length)];
      } else {
        chosen = candidates[Math.floor(Math.random() * candidates.length)];
      }
      const pieceIndex = chosen.availablePieces[Math.floor(Math.random() * chosen.availablePieces.length)];
      const img = chosen.img;

      // Calcular dimensiones para 3x3 y mantener proporción
      const rows = 3, cols = 3;
      const imgW = img.width || 1000;
      const imgH = img.height || 1000;
      const pieceW = imgW / cols;
      const pieceH = imgH / rows;
      const col = pieceIndex % cols;
      const row = Math.floor(pieceIndex / cols);
      const sx = col * pieceW;
      const sy = row * pieceH;

      // Crear canvas para extraer la pieza
      const imageEl = new window.Image();
      imageEl.onload = function() {
  const canvas = document.createElement('canvas');
  // DPR-aware extraction canvas
  const dpr = window.devicePixelRatio || 1;
  const logicalW = pieceW;
  const logicalH = pieceH;
  canvas.width = Math.round(logicalW * dpr);
  canvas.height = Math.round(logicalH * dpr);
  canvas.style.width = logicalW + 'px';
  canvas.style.height = logicalH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.drawImage(imageEl, sx, sy, pieceW, pieceH, 0, 0, logicalW, logicalH);
        const pieceDataUrl = canvas.toDataURL();

        // Posición aleatoria
        const margin = 40;
        const imgWidth = 60;
        const imgHeight = 60;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const x = Math.floor(Math.random() * (viewportW - imgWidth - margin)) + margin/2;
        const y = Math.floor(Math.random() * (viewportH - imgHeight - margin)) + margin/2;

        // Mostrar la pieza
        const el = document.createElement('img');
        el.src = pieceDataUrl;
        el.alt = img.name || 'Puzzle piece';
        el.style.position = 'fixed';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = imgWidth + 'px';
        el.style.height = imgHeight + 'px';
        el.style.zIndex = 999999;
        el.style.border = '2px solid #b2d900';
        el.style.boxShadow = '0 2px 8px #ff910088';
        el.style.background = '#fffbe6';
        el.style.cursor = 'pointer';
        el.style.transition = 'transform 0.2s';
        el.title = img.name;
        el.className = 'findthepieces-puzzle-img';
        el.addEventListener('click', () => {
          // Marcar pieza como recogida
          chrome.storage.local.get(['findThePiecesImages'], (res) => {
            if (!res.findThePiecesImages) return;
            const imgs = res.findThePiecesImages;
            const idxInStorage = imgs.findIndex(i => i.src === img.src);
            if (idxInStorage === -1) return;
            const imgObj = imgs[idxInStorage];
            if (!Array.isArray(imgObj.collectedPieces)) imgObj.collectedPieces = [];
            if (!imgObj.collectedPieces.includes(pieceIndex)) {
              imgObj.collectedPieces.push(pieceIndex);
              chrome.storage.local.set({ findThePiecesImages: imgs }, () => {
                el.remove();
                lastPieceEl = null;
                // Espera para la siguiente pieza según frecuencia
                if (img.frequency === 1) {
                  showRandomPiece(true);
                } else {
                  // Probabilidad 1/frecuencia por segundo
                  function probabilisticWait() {
                    if (Math.random() < 1 / img.frequency) {
                      showRandomPiece();
                    } else {
                      currentTimeout = setTimeout(probabilisticWait, 1000);
                    }
                  }
                  currentTimeout = setTimeout(probabilisticWait, 1000);
                }
              });
            }
          });
        });
        document.body.appendChild(el);
        lastPieceEl = el;
      };
      imageEl.src = img.src;
    });
  }

  // Iniciar el proceso al cargar la página
  function startScheduler() {
    chrome.storage.local.get(['findThePiecesImages'], (result) => {
      if (!result.findThePiecesImages) return;
      const puzzleImages = result.findThePiecesImages.filter(img => img.puzzle);
      if (!puzzleImages.length) return;
      // Si hay alguna imagen con frecuencia 1, mostrar inmediatamente
      if (puzzleImages.some(img => img.frequency === 1)) {
        showRandomPiece(true);
      } else {
        // Probabilidad 1/frecuencia por segundo
        function probabilisticWait() {
          // Selecciona una imagen aleatoria
          const img = puzzleImages[Math.floor(Math.random() * puzzleImages.length)];
          if (Math.random() < 1 / img.frequency) {
            showRandomPiece();
          } else {
            currentTimeout = setTimeout(probabilisticWait, 1000);
          }
        }
        currentTimeout = setTimeout(probabilisticWait, 1000);
      }
    });
  }
  startScheduler();
})();
