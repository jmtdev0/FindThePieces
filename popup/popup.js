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

  // Mostrar título, subtítulo e input al volver a la vista principal
  var uploadBlock = document.getElementById('uploadBlock');
  if (uploadBlock) uploadBlock.style.display = '';
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
          // Adaptar a 3x3 piezas cuadradas
          const rows = 3, cols = 3;
          const minSide = Math.min(imgObj.width, imgObj.height);
          const pieceW = minSide / cols;
          const pieceH = minSide / rows;
          const scaleX = width / minSide;
          const scaleY = height / minSide;
          imgObj.collectedPieces.forEach(pieceIdx => {
            const col = pieceIdx % cols;
            const row = Math.floor(pieceIdx / cols);
            let sx = col * pieceW;
            let sy = row * pieceH;
            // Centrar el recorte si la imagen no es cuadrada
            if (imgObj.width > imgObj.height) {
              sx += (imgObj.width - minSide) / 2;
            } else if (imgObj.height > imgObj.width) {
              sy += (imgObj.height - minSide) / 2;
            }
            ctx.drawImage(
              imgEl,
              sx, sy, pieceW, pieceH,
              Math.round(col * pieceW * scaleX), Math.round(row * pieceH * scaleY),
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
  counter.textContent = `Pieces found: ${collected}/9`;
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

  // Ocultar título, subtítulo e input al entrar en detalle
  var uploadBlock = document.getElementById('uploadBlock');
  if (uploadBlock) uploadBlock.style.display = 'none';

  // Puzzle grid config (3x3 cuadrado)
  const rows = 3, cols = 3;
  const totalPieces = rows * cols;
  // Usar el menor lado para piezas cuadradas
  const minSide = Math.min(imgObj.width, imgObj.height);
  const pieceW = minSide / cols;
  const pieceH = minSide / rows;
  const gridSize = 270;
  const cellW = Math.floor(gridSize / cols);
  const cellH = Math.floor(gridSize / rows);

  // Estado de rotación de cada pieza (por índice en puzzleState)
  let rotationState = Array(totalPieces).fill(0);
  if (Array.isArray(imgObj.rotationState) && imgObj.rotationState.length === totalPieces) {
    rotationState = [...imgObj.rotationState];
  }

  // Leyenda de controles (solo si hay pieza seleccionada)
  let legend = null;
  function showLegend() {
    if (legend) legend.remove();
    if (selectedIdx !== null) {
      legend = document.createElement('div');
      legend.className = 'puzzle-legend';
      legend.style.margin = '12px 0';
      legend.style.fontSize = '14px';
      legend.style.color = '#666';
      legend.innerHTML = 'Puedes mover la pieza seleccionada con las flechas del teclado y girarla 90° pulsando <b>R</b>.';
      previewContainer.insertBefore(legend, puzzleDiv);
    }
  }

  // Manejar movimiento con flechas del teclado y giro
  document.addEventListener('keydown', handleKeyControls);
  function handleKeyControls(e) {
    if (selectedIdx === null) return;
    let dir = null;
    if (e.key === 'ArrowUp') dir = -cols;
    else if (e.key === 'ArrowDown') dir = cols;
    else if (e.key === 'ArrowLeft') dir = -1;
    else if (e.key === 'ArrowRight') dir = 1;
    if (dir !== null) {
      const targetIdx = selectedIdx + dir;
      // Comprobar límites y adyacencia
      if (targetIdx < 0 || targetIdx >= totalPieces || !isAdjacent(selectedIdx, targetIdx)) return;
      // Intercambiar si hay pieza, mover si está vacío
      if (puzzleState[targetIdx] !== null) {
        // Intercambiar piezas y rotaciones
        const temp = puzzleState[targetIdx];
        puzzleState[targetIdx] = puzzleState[selectedIdx];
        puzzleState[selectedIdx] = temp;
        // Intercambiar rotación
        const tempRot = rotationState[targetIdx];
        rotationState[targetIdx] = rotationState[selectedIdx];
        rotationState[selectedIdx] = tempRot;
        selectedIdx = targetIdx;
      } else {
        // Mover a casilla vacía y rotación
        puzzleState[targetIdx] = puzzleState[selectedIdx];
        rotationState[targetIdx] = rotationState[selectedIdx];
        puzzleState[selectedIdx] = null;
        rotationState[selectedIdx] = 0;
        selectedIdx = targetIdx;
      }
      renderGrid();
      checkWin();
      savePuzzleState();
      saveRotationState();
      showLegend();
      return;
    }
    // Girar pieza seleccionada con R
    if (e.key.toLowerCase() === 'r') {
      rotationState[selectedIdx] = ((rotationState[selectedIdx] || 0) + 1) % 4;
      renderGrid();
      saveRotationState();
      showLegend();
      checkWin();
    }
  }

  // Guardar el estado de rotación en la imagen
  function saveRotationState() {
    allImages[idx].rotationState = [...rotationState];
    saveImages();
  }

  // Limpiar listener al salir de la vista detalle
  function cleanupDetailView() {
    document.removeEventListener('keydown', handleKeyControls);
  }

  previewContainer.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.addEventListener('click', cleanupDetailView);
  backBtn.textContent = '← Back';
  backBtn.className = 'back-btn';
  backBtn.onclick = renderPreviews;

  previewContainer.appendChild(backBtn);

  // Estado del puzzle: array con el índice de la pieza en cada celda (o null si no recogida)
  let puzzleState = [];
  if (Array.isArray(imgObj.puzzleState) && imgObj.puzzleState.length === totalPieces) {
    puzzleState = [...imgObj.puzzleState];
    // Colocar automáticamente las nuevas piezas recogidas en huecos libres
    if (Array.isArray(imgObj.collectedPieces)) {
      // Buscar qué piezas recogidas no están en el puzzleState
      const placed = puzzleState.filter(x => x !== null);
      const toPlace = imgObj.collectedPieces.filter(pieceIdx => !placed.includes(pieceIdx));
      // Buscar huecos libres
      const freeSlots = [];
      for (let i = 0; i < puzzleState.length; i++) {
        if (puzzleState[i] === null) freeSlots.push(i);
      }
      // Repartir aleatoriamente las nuevas piezas en los huecos
      toPlace.forEach(pieceIdx => {
        if (freeSlots.length === 0) return;
        const slotIdx = freeSlots.splice(Math.floor(Math.random() * freeSlots.length), 1)[0];
        puzzleState[slotIdx] = pieceIdx;
      });
    }
  } else {
    // Inicializar: colocar todas las piezas recogidas en las primeras posiciones libres
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
        // Dibujar la pieza cuadrada con rotación
        const canvas = document.createElement('canvas');
        canvas.width = cellW;
        canvas.height = cellH;
        const ctx = canvas.getContext('2d');
        const imgEl = new window.Image();
        imgEl.onload = function() {
          const col = pieceIdx % cols;
          const row = Math.floor(pieceIdx / cols);
          // Ajustar el recorte para cuadrado centrado
          let sx = col * pieceW;
          let sy = row * pieceH;
          if (imgObj.width > imgObj.height) {
            sx += (imgObj.width - minSide) / 2;
          } else if (imgObj.height > imgObj.width) {
            sy += (imgObj.height - minSide) / 2;
          }
          ctx.save();
          ctx.translate(cellW/2, cellH/2);
          ctx.rotate((rotationState[i] || 0) * Math.PI/2);
          ctx.translate(-cellW/2, -cellH/2);
          ctx.drawImage(
            imgEl,
            sx, sy, pieceW, pieceH,
            0, 0, cellW, cellH
          );
          ctx.restore();
        };
        imgEl.src = imgObj.src;
        cell.appendChild(canvas);
      }
      if (selectedIdx === i) {
        cell.style.outline = '3px solid #b2d900';
      }
      puzzleDiv.appendChild(cell);
    }
    showLegend();
  }

  // Movimiento de piezas: solo se pueden mover a celdas vacías adyacentes
  let selectedIdx = null;
  puzzleDiv.addEventListener('click', function(e) {
    const cell = e.target.closest('.sliding-cell');
    if (!cell) return;
    const idx = parseInt(cell.dataset.index);
    if (puzzleState[idx] === null) {
      // Si hay una pieza seleccionada y es adyacente, mover
      if (selectedIdx !== null && isAdjacent(selectedIdx, idx)) {
        puzzleState[idx] = puzzleState[selectedIdx];
        puzzleState[selectedIdx] = null;
        selectedIdx = null;
        renderGrid();
        checkWin();
        savePuzzleState();
      }
    } else {
      // Seleccionar/des-seleccionar pieza
      selectedIdx = selectedIdx === idx ? null : idx;
      renderGrid();
    }
  });

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
    // Deben estar todas las piezas y en orden
    for (let i = 0; i < totalPieces; i++) {
      if (puzzleState[i] !== i || (rotationState && rotationState[i] !== 0)) return;
    }
    // Mostrar mensaje de éxito por encima del puzzle
    const winMsg = document.createElement('div');
    winMsg.className = 'puzzle-win-msg';
    winMsg.textContent = '¡Puzzle completado!';
    // Insertar antes del puzzleDiv
    if (previewContainer.contains(puzzleDiv)) {
      previewContainer.insertBefore(winMsg, puzzleDiv);
    } else {
      previewContainer.appendChild(winMsg);
    }
  }

  // Render inicial
  previewContainer.innerHTML = '';
  previewContainer.appendChild(backBtn);
  renderGrid();
  previewContainer.appendChild(puzzleDiv);
  checkWin();

  // Datos
  const meta = document.createElement('div');
  meta.className = 'detail-meta';
  meta.innerHTML = `<b>Name:</b> ${imgObj.name}<br><b>Date:</b> ${new Date(imgObj.date).toLocaleString()}<br><b>Size:</b> ${imgObj.width} x ${imgObj.height}`;
  previewContainer.appendChild(meta);
}