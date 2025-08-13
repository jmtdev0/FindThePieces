// popup.js
// Allow uploading and previewing multiple images in the popup

const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('previewContainer');

// Store all selected images with metadata
let allImages = [];

// Load images from chrome.storage.local on popup open
document.addEventListener('DOMContentLoaded', () => {
  console.log('[FindThePieces] Popup loaded');
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['findThePiecesImages'], (result) => {
      console.log('[FindThePieces] Storage get result:', result);
      if (result.findThePiecesImages) {
        // Parse date strings back to Date objects and ensure puzzle field exists
        allImages = result.findThePiecesImages.map(img => ({
          ...img,
          date: img.date ? new Date(img.date) : new Date(),
          puzzle: typeof img.puzzle === 'boolean' ? img.puzzle : false
        }));
        console.log('[FindThePieces] Images loaded:', allImages);
        renderPreviews();
      } else {
        console.log('[FindThePieces] No images found in storage');
      }
    });
  } else {
    console.warn('[FindThePieces] chrome.storage.local not available');
  }
});

imageInput.addEventListener('change', (event) => {
  const files = Array.from(event.target.files);
  let newImages = [];
  let filesProcessed = 0;
  files.forEach((file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        // Get image dimensions
        const imgEl = new window.Image();
        imgEl.onload = function() {
          newImages.push({
            src: e.target.result,
            name: file.name,
            date: new Date(),
            puzzle: false,
            width: imgEl.naturalWidth,
            height: imgEl.naturalHeight
          });
          filesProcessed++;
          if (filesProcessed === files.length) {
            allImages = allImages.concat(newImages);
            saveImages();
            renderPreviews();
          }
        };
        imgEl.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      filesProcessed++;
      if (filesProcessed === files.length) {
        allImages = allImages.concat(newImages);
        saveImages();
        renderPreviews();
      }
    }
  });
  // Reset input so the same file can be selected again if needed
  imageInput.value = '';
});

function saveImages() {
  if (chrome && chrome.storage && chrome.storage.local) {
    // Store date as string for serialization
    const toStore = allImages.map(img => ({ ...img, date: img.date.toISOString() }));
    chrome.storage.local.set({ findThePiecesImages: toStore }, () => {
      console.log('[FindThePieces] Images saved:', toStore);
    });
  } else {
    console.warn('[FindThePieces] chrome.storage.local not available for save');
  }
}

function renderPreviews() {
  previewContainer.innerHTML = '';
  console.log('[FindThePieces] Rendering previews:', allImages);
  allImages.forEach((imgObj, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-wrapper';

    // Calcular dimensiones
    let width = 120, height = 120, aspect = 1;
    if (imgObj.width && imgObj.height) {
      aspect = imgObj.width / imgObj.height;
    }
    if (aspect > 1) {
      width = 120;
      height = Math.round(120 / aspect);
    } else {
      height = 120;
      width = Math.round(120 * aspect);
    }

    // Crear imagen/canvas preview
    let img;
    if (imgObj.puzzle) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.className = 'preview-image puzzle-border-only';
      // Dibuja borde naranja
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.strokeStyle = '#ff9100';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(2, 2, width-4, height-4, 12);
      ctx.stroke();
      ctx.restore();
      // Si hay piezas recogidas, dibujarlas
      if (Array.isArray(imgObj.collectedPieces) && imgObj.collectedPieces.length > 0) {
        const imgEl = new window.Image();
        imgEl.onload = function() {
          const pieceW = imgObj.width / 5;
          const pieceH = imgObj.height / 2;
          const scaleX = width / imgObj.width;
          const scaleY = height / imgObj.height;
          imgObj.collectedPieces.forEach(pieceIdx => {
            const col = pieceIdx % 5;
            const row = Math.floor(pieceIdx / 5);
            const sx = col * pieceW;
            const sy = row * pieceH;
            ctx.drawImage(
              imgEl,
              sx, sy, pieceW, pieceH,
              Math.round(sx * scaleX), Math.round(sy * scaleY),
              Math.round(pieceW * scaleX), Math.round(pieceH * scaleY)
            );
          });
        };
        imgEl.src = imgObj.src;
      }
      img = canvas;
    } else {
      img = document.createElement('img');
      img.src = imgObj.src;
      img.alt = 'Preview';
      img.className = 'preview-image';
      img.style.width = width + 'px';
      img.style.height = height + 'px';
    }

    // Info
    const info = document.createElement('div');
    info.className = 'preview-info';
    const dateStr = new Date(imgObj.date).toLocaleString();
    info.innerHTML = `<span class="img-name">${imgObj.name}</span><span class="img-date">${dateStr}</span>`;

    // Lateral info + toggle + delete button container
    const side = document.createElement('div');
    side.className = 'preview-side';

    // Puzzle mode toggle (checkbox)
    const puzzleDiv = document.createElement('div');
    puzzleDiv.className = 'puzzle-toggle';
    const puzzleLabel = document.createElement('label');
    puzzleLabel.innerText = 'Puzzle mode';
    puzzleLabel.htmlFor = `puzzle-check-${idx}`;
    const puzzleCheck = document.createElement('input');
    puzzleCheck.type = 'checkbox';
    puzzleCheck.id = `puzzle-check-${idx}`;
    puzzleCheck.className = 'puzzle-checkbox';
    puzzleCheck.checked = !!imgObj.puzzle;
    puzzleCheck.addEventListener('change', (e) => {
      allImages[idx].puzzle = puzzleCheck.checked;
      saveImages();
    });
    puzzleLabel.prepend(puzzleCheck);
    puzzleDiv.appendChild(puzzleLabel);

    // Contador de piezas recogidas solo si Puzzle Mode está activo
    let counter = null;
    if (imgObj.puzzle) {
      const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces.length : 0;
      counter = document.createElement('div');
      counter.className = 'piece-counter';
      counter.textContent = `Pieces found: ${collected}/10`;
    }

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-image-btn';
    deleteBtn.title = 'Delete image';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick = () => {
      const confirmDelete = confirm(`Are you sure you want to delete the image "${imgObj.name}"?`);
      if (confirmDelete) {
        allImages.splice(idx, 1);
        saveImages();
        renderPreviews();
        console.log('[FindThePieces] Image deleted:', imgObj.name);
      }
    };

    // Hacer clic en imagen o nombre abre vista detalle
    function openDetail() {
      renderDetailView(imgObj, idx);
    }
    img.style.cursor = 'pointer';
    img.addEventListener('click', openDetail);
    info.querySelector('.img-name').style.cursor = 'pointer';
    info.querySelector('.img-name').addEventListener('click', openDetail);

    wrapper.appendChild(img);

    // Full image popup (hidden by default, shown on hover)
    if (!imgObj.puzzle) {
      const fullImg = document.createElement('img');
      fullImg.src = imgObj.src;
      fullImg.alt = 'Full preview';
      fullImg.className = 'full-image-popup';
      wrapper.appendChild(fullImg);
    }

    side.appendChild(info);
    side.appendChild(puzzleDiv);
    if (counter) side.appendChild(counter);
    side.appendChild(deleteBtn);

    wrapper.appendChild(side);
    previewContainer.appendChild(wrapper);
  });
}

function renderDetailView(imgObj, idx) {
  previewContainer.innerHTML = '';
  const backBtn = document.createElement('button');
  backBtn.textContent = '← Back';
  backBtn.className = 'back-btn';
  backBtn.onclick = renderPreviews;
  previewContainer.appendChild(backBtn);

  // Puzzle grid config
  const rows = 2, cols = 5;
  const totalPieces = rows * cols;
  const pieceW = imgObj.width / cols;
  const pieceH = imgObj.height / rows;
  const gridSize = 250;
  const cellW = Math.floor(gridSize / cols);
  const cellH = Math.floor(gridSize / rows);

  // Estado del puzzle: array con el índice de la pieza en cada celda (o null si no recogida)
  let puzzleState = [];
  if (Array.isArray(imgObj.puzzleState) && imgObj.puzzleState.length === totalPieces) {
    puzzleState = [...imgObj.puzzleState];
  } else {
    puzzleState = Array(totalPieces).fill(null);
    if (Array.isArray(imgObj.collectedPieces)) {
      imgObj.collectedPieces.forEach((pieceIdx, i) => {
        puzzleState[i] = pieceIdx;
      });
    }
  }

  // Crear el marco del puzzle
  const puzzleDiv = document.createElement('div');
  puzzleDiv.className = 'sliding-puzzle';
  puzzleDiv.style.width = (cellW * cols) + 'px';
  puzzleDiv.style.height = (cellH * rows) + 'px';
  puzzleDiv.style.position = 'relative';
  puzzleDiv.style.margin = '0 auto 18px auto';
  puzzleDiv.style.background = '#fffbe6';
  puzzleDiv.style.border = '4px solid #ff9100';
  puzzleDiv.style.borderRadius = '12px';
  puzzleDiv.style.display = 'grid';
  puzzleDiv.style.gridTemplateRows = `repeat(${rows}, ${cellH}px)`;
  puzzleDiv.style.gridTemplateColumns = `repeat(${cols}, ${cellW}px)`;
  puzzleDiv.style.gap = '2px';

  // Drag & drop variables
  let dragIdx = null;

  // Renderizar las piezas en la rejilla
  function renderGrid() {
    puzzleDiv.innerHTML = '';
    for (let i = 0; i < totalPieces; i++) {
      const pieceIdx = puzzleState[i];
      const cell = document.createElement('div');
      cell.className = 'sliding-cell';
      cell.style.width = cellW + 'px';
      cell.style.height = cellH + 'px';
      cell.style.background = '#fff';
      cell.style.borderRadius = '6px';
      cell.style.position = 'relative';
      cell.style.overflow = 'hidden';
      cell.style.boxShadow = '0 1px 4px #ff910033';
      cell.style.cursor = pieceIdx !== null ? 'grab' : 'default';
      cell.dataset.index = i;
      if (pieceIdx !== null) {
        // Dibujar la pieza
        const canvas = document.createElement('canvas');
        canvas.width = cellW;
        canvas.height = cellH;
        const ctx = canvas.getContext('2d');
        const imgEl = new window.Image();
        imgEl.onload = function() {
          const col = pieceIdx % cols;
          const row = Math.floor(pieceIdx / cols);
          const sx = col * pieceW;
          const sy = row * pieceH;
          ctx.drawImage(
            imgEl,
            sx, sy, pieceW, pieceH,
            0, 0, cellW, cellH
          );
        };
        imgEl.src = imgObj.src;
        cell.appendChild(canvas);
        // Drag events
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) => {
          dragIdx = i;
          cell.style.opacity = '0.5';
        });
        cell.addEventListener('dragend', (e) => {
          dragIdx = null;
          cell.style.opacity = '1';
        });
      }
      // Drop events
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIdx = i;
        if (dragIdx !== null && puzzleState[targetIdx] === null && isAdjacent(dragIdx, targetIdx)) {
          puzzleState[targetIdx] = puzzleState[dragIdx];
          puzzleState[dragIdx] = null;
          dragIdx = null;
          renderGrid();
          checkWin();
          savePuzzleState();
        }
      });
      puzzleDiv.appendChild(cell);
    }
  }

  // Comprobar si dos celdas son adyacentes
  function isAdjacent(a, b) {
    const ax = a % cols, ay = Math.floor(a / cols);
    const bx = b % cols, by = Math.floor(b / cols);
    return (Math.abs(ax - bx) + Math.abs(ay - by)) === 1;
  }

  // Guardar el estado del puzzle en la imagen
  function savePuzzleState() {
    allImages[idx].puzzleState = [...puzzleState];
    saveImages();
  }

  // Comprobar si el puzzle está resuelto
  function checkWin() {
    for (let i = 0; i < totalPieces; i++) {
      if (puzzleState[i] !== i) return;
    }
    const winMsg = document.createElement('div');
    winMsg.className = 'puzzle-win-msg';
    winMsg.textContent = '¡Puzzle completado!';
    previewContainer.appendChild(winMsg);
  }

  // Render inicial
  renderGrid();
  previewContainer.appendChild(puzzleDiv);

  // Datos
  const meta = document.createElement('div');
  meta.className = 'detail-meta';
  meta.innerHTML = `<b>Name:</b> ${imgObj.name}<br><b>Date:</b> ${new Date(imgObj.date).toLocaleString()}<br><b>Size:</b> ${imgObj.width} x ${imgObj.height}`;
  previewContainer.appendChild(meta);

  // Piezas recogidas
  const piecesDiv = document.createElement('div');
  piecesDiv.className = 'detail-pieces';
  piecesDiv.innerHTML = '<b>Collected pieces:</b>';
  // Mostrar cada pieza recogida como miniatura
  if (Array.isArray(imgObj.collectedPieces) && imgObj.collectedPieces.length > 0) {
    const imgEl = new window.Image();
    imgEl.onload = function() {
      const pieceW = imgObj.width / 5;
      const pieceH = imgObj.height / 2;
      imgObj.collectedPieces.forEach(pieceIdx => {
        const col = pieceIdx % 5;
        const row = Math.floor(pieceIdx / 5);
        const sx = col * pieceW;
        const sy = row * pieceH;
        // Canvas para la pieza
        const c = document.createElement('canvas');
        c.width = 40;
        c.height = 40;
        const ctx = c.getContext('2d');
        ctx.drawImage(
          imgEl,
          sx, sy, pieceW, pieceH,
          0, 0, 40, 40
        );
        c.className = 'piece-thumb';
        piecesDiv.appendChild(c);
      });
    };
    imgEl.src = imgObj.src;
  } else {
    piecesDiv.innerHTML += ' <span style="color:#bbb">(none yet)</span>';
  }
  previewContainer.appendChild(piecesDiv);
}