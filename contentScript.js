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
    const imgWidth = 120;
    const imgHeight = 120;
    const maxAttempts = 20;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    puzzleImages.forEach((img, idx) => {
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

      const el = document.createElement('img');
      el.src = img.src;
      el.alt = img.name || 'Puzzle piece';
      el.style.position = 'fixed';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.width = imgWidth + 'px';
      el.style.height = imgHeight + 'px';
      el.style.zIndex = 999999;
      el.style.border = '3px solid #b2d900';
      el.style.borderRadius = '16px';
      el.style.boxShadow = '0 2px 12px #ff910088';
      el.style.background = '#fffbe6';
      el.style.cursor = 'pointer';
      el.style.transition = 'transform 0.2s';
      el.title = img.name;
      el.className = 'findthepieces-puzzle-img';
      document.body.appendChild(el);
    });
  });
})();
