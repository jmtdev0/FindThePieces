// contentScript.js
// Show puzzle images with 'puzzle' checked at random positions on every page

(function() {
  // Avoid running in iframes or extension pages
  if (window.top !== window.self || window.location.protocol.startsWith('chrome')) return;

  // Get images from chrome.storage.local
  chrome.storage.local.get(['findThePiecesImages'], (result) => {
    if (!result.findThePiecesImages) return;
    const puzzleImages = result.findThePiecesImages.filter(img => img.puzzle);
    if (!puzzleImages.length) return;

    // Keep track of used positions to avoid overlap
    const usedPositions = [];
  const margin = 40;
  const imgWidth = 60;
  const imgHeight = 60;
    const maxAttempts = 20;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    puzzleImages.forEach((img, idx) => {
      // Recuperar piezas recogidas
      const collected = Array.isArray(img.collectedPieces) ? img.collectedPieces : [];
      // Elegir una pieza no recogida
      const availablePieces = Array.from({length: 10}, (_, i) => i).filter(i => !collected.includes(i));
      if (availablePieces.length === 0) return; // Todas recogidas
      const pieceIndex = availablePieces[Math.floor(Math.random() * availablePieces.length)];
      // Calcular dimensiones
      const imgW = img.width || 1000;
      const imgH = img.height || 1000;
      const pieceW = Math.floor(imgW / 5);
      const pieceH = Math.floor(imgH / 2);
      const col = pieceIndex % 5;
      const row = Math.floor(pieceIndex / 5);
      const sx = col * pieceW;
      const sy = row * pieceH;

      // Crear canvas para extraer la pieza
      const imageEl = new window.Image();
      imageEl.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = pieceW;
        canvas.height = pieceH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageEl, sx, sy, pieceW, pieceH, 0, 0, pieceW, pieceH);
        const pieceDataUrl = canvas.toDataURL();

        // Posición aleatoria sin solapamiento
        let x, y, attempts = 0, overlaps;
        do {
          x = Math.floor(Math.random() * (viewportW - imgWidth - margin)) + margin/2;
          y = Math.floor(Math.random() * (viewportH - imgHeight - margin)) + margin/2;
          overlaps = usedPositions.some(pos => {
            return Math.abs(pos.x - x) < imgWidth && Math.abs(pos.y - y) < imgHeight;
          });
          attempts++;
        } while (overlaps && attempts < maxAttempts);
        usedPositions.push({x, y});

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
        el.style.borderRadius = '10px';
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
              });
            }
          });
        });
        document.body.appendChild(el);
      };
      imageEl.src = img.src;
    });
  });
})();
