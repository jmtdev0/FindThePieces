// main.js
// Lógica migrada desde popup.js para la extension page

const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('previewContainer');
let allImages = [];

document.addEventListener('DOMContentLoaded', () => {
	if (chrome && chrome.storage && chrome.storage.local) {
		chrome.storage.local.get(['findThePiecesImages'], (result) => {
			if (result.findThePiecesImages) {
				allImages = result.findThePiecesImages.map(img => ({
					...img,
					date: img.date ? new Date(img.date) : new Date(),
					puzzle: true // Siempre true para todas las imágenes existentes
				}));
				renderPreviews();
			}
		});
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
				const imgEl = new window.Image();
				imgEl.onload = function() {
					newImages.push({
						src: e.target.result,
						name: file.name,
						date: new Date(),
						puzzle: true, // Siempre se establece a true al añadir una nueva imagen
						width: imgEl.naturalWidth,
						height: imgEl.naturalHeight,
						frequency: 10 // Valor por defecto
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
	imageInput.value = '';
});

function saveImages() {
	if (chrome && chrome.storage && chrome.storage.local) {
		const toStore = allImages.map(img => ({ ...img, date: img.date.toISOString() }));
		chrome.storage.local.set({ findThePiecesImages: toStore });
	}
}

function renderPreviews() {
	var uploadBlock = document.getElementById('uploadBlock');
	if (uploadBlock) uploadBlock.style.display = '';
	
	// Reseteamos los estilos del contenedor que se usaron en la vista de detalle
	previewContainer.style.display = '';
	previewContainer.style.flexDirection = '';
	previewContainer.style.alignItems = '';
	previewContainer.style.justifyContent = '';
	previewContainer.style.minHeight = '';
	previewContainer.style.padding = '';
	
	previewContainer.innerHTML = '';
	allImages.forEach((imgObj, idx) => {
		const wrapper = document.createElement('div');
		wrapper.className = 'preview-wrapper';
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
		let img;
		if (imgObj.puzzle) {
			const canvas = document.createElement('canvas');
			// DPR-aware canvas: use devicePixelRatio for pixel backing store
			const dpr = window.devicePixelRatio || 1;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';
			canvas.className = 'preview-image puzzle-border-only';
			// No rounded corners on preview piece canvases
			canvas.style.borderRadius = '0';
			const ctx = canvas.getContext('2d');
			ctx.scale(dpr, dpr);
			if (Array.isArray(imgObj.collectedPieces) && imgObj.collectedPieces.length > 0) {
				const imgEl = new window.Image();
				imgEl.onload = function() {
					const rows = 3, cols = 3;
					// Use actual image natural dimensions for source cropping
					const srcW = imgEl.naturalWidth || imgObj.width;
					const srcH = imgEl.naturalHeight || imgObj.height;
					const srcPieceW = srcW / cols;
					const srcPieceH = srcH / rows;
					// Calculamos el tamaño de las piezas en el canvas para ocupar todo el espacio
					const cellW = width / cols;
					const cellH = height / rows;
					imgObj.collectedPieces.forEach(pieceIdx => {
						const col = pieceIdx % cols;
						const row = Math.floor(pieceIdx / cols);
						const sx = col * srcPieceW;
						const sy = row * srcPieceH;
						// Destination rect in canvas should be integer pixels
						const dx = Math.round(col * cellW);
						const dy = Math.round(row * cellH);
						const dW = Math.round(cellW);
						const dH = Math.round(cellH);
						// draw using logical coordinates (ctx already scaled)
						ctx.drawImage(
							imgEl,
							sx, sy, srcPieceW, srcPieceH,
							dx, dy, dW, dH
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
		const info = document.createElement('div');
		info.className = 'preview-info';
		const dateStr = new Date(imgObj.date).toLocaleString();
		info.innerHTML = `<span class="img-name" title="${imgObj.name}">${imgObj.name}</span><span class="img-date">${dateStr}</span>`;

		// Input range para frecuencia de aparición
		const freqLabel = document.createElement('label');
		freqLabel.style.display = 'block';
		freqLabel.style.marginTop = '8px';
		freqLabel.style.fontSize = '13px';
		freqLabel.style.color = '#666';
	freqLabel.textContent = 'Appearance frequency:';

		const freqInput = document.createElement('input');
		freqInput.type = 'range';
		freqInput.min = 1;
		freqInput.max = 100;
		freqInput.value = imgObj.frequency || 10;
		freqInput.style.width = '120px';
		freqInput.style.margin = '0 8px';

		const freqValue = document.createElement('span');
		freqValue.className = 'freq-value';
		freqValue.style.fontWeight = 'bold';
		freqValue.style.color = '#ff9100';
		freqValue.textContent = freqInput.value;

		// Explicación del rango
		const freqDesc = document.createElement('span');
		freqDesc.style.fontSize = '12px';
		freqDesc.style.color = '#888';
		freqDesc.style.display = 'block';
		freqDesc.style.marginTop = '2px';
	freqDesc.textContent = '1: Always appears | 100: 1/100 chance per second';

		freqInput.addEventListener('input', () => {
			freqValue.textContent = freqInput.value;
		});
		freqInput.addEventListener('change', () => {
			imgObj.frequency = parseInt(freqInput.value);
			saveImages();
		});

		freqLabel.appendChild(freqInput);
		freqLabel.appendChild(freqValue);
		info.appendChild(freqLabel);
		info.appendChild(freqDesc);
		const side = document.createElement('div');
		side.className = 'preview-side';

		let counter = null;
		if (imgObj.puzzle) {
			const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces.length : 0;
			counter = document.createElement('div');
			counter.className = 'piece-counter';
		counter.textContent = `Pieces found: ${collected}/9`;
		}
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
			}
		};
		function openDetail() {
			renderDetailView(imgObj, idx);
		}
		img.style.cursor = 'pointer';
		img.addEventListener('click', openDetail);
		info.querySelector('.img-name').style.cursor = 'pointer';
		info.querySelector('.img-name').addEventListener('click', openDetail);
		wrapper.appendChild(img);
		if (!imgObj.puzzle) {
			const fullImg = document.createElement('img');
			fullImg.src = imgObj.src;
			fullImg.alt = 'Full preview';
			fullImg.className = 'full-image-popup';
			wrapper.appendChild(fullImg);
		}
	side.appendChild(info);
		if (counter) side.appendChild(counter);
		side.appendChild(deleteBtn);
		wrapper.appendChild(side);
		previewContainer.appendChild(wrapper);
	});
}

function renderDetailView(imgObj, idx) {
	var uploadBlock = document.getElementById('uploadBlock');
	if (uploadBlock) uploadBlock.style.display = 'none';
	const rows = 3, cols = 3;
	const totalPieces = rows * cols;
	// Mantener la relación de aspecto de la imagen
	const aspect = imgObj.width / imgObj.height;
	const gridBase = 540; // tamaño base
	let gridW, gridH;
	if (aspect >= 1) {
		gridW = gridBase;
		gridH = Math.round(gridBase / aspect);
	} else {
		gridH = gridBase;
		gridW = Math.round(gridBase * aspect);
	}
	// Tamaño de cada celda en el grid (float to avoid losing pixels when dividing)
	const cellW = gridW / cols;
	const cellH = gridH / rows;
	// Tamaño real de cada pieza en la imagen
	const pieceW = imgObj.width / cols;
	const pieceH = imgObj.height / rows;
	// Log dimensions for debugging
	console.debug('puzzle-piece-dimensions', {
		pieceW,
		pieceH,
		cellW,
		cellH,
		dpr: window.devicePixelRatio || 1
	});
	let rotationState = Array(totalPieces).fill(0);
	if (Array.isArray(imgObj.rotationState) && imgObj.rotationState.length === totalPieces) {
		rotationState = [...imgObj.rotationState];
	}
	// Se eliminó el código del legend y handleKeyControls ya que ahora se maneja en el grid de piezas coleccionadas
	function saveRotationState() {
		allImages[idx].rotationState = [...rotationState];
		saveImages();
	}
	function cleanupDetailView() {
		document.removeEventListener('keydown', handleCollectedKeyControls);
	}
	previewContainer.innerHTML = '';
	previewContainer.style.display = 'flex';
	previewContainer.style.flexDirection = 'column';
	previewContainer.style.alignItems = 'center';
	previewContainer.style.justifyContent = 'center';
	previewContainer.style.minHeight = '100vh';
	previewContainer.style.padding = '32px';
	
	const backBtn = document.createElement('button');
	backBtn.addEventListener('click', cleanupDetailView);
	backBtn.textContent = '← Back';
	backBtn.className = 'back-btn';
	backBtn.onclick = renderPreviews;
	previewContainer.appendChild(backBtn);
	// Inicializamos el estado de rotación
	rotationState = Array(totalPieces).fill(0);
	if (Array.isArray(imgObj.rotationState) && imgObj.rotationState.length === totalPieces) {
		rotationState = [...imgObj.rotationState];
	}
	function isAdjacent(a, b) {
		const ax = a % cols, ay = Math.floor(a / cols);
		const bx = b % cols, by = Math.floor(b / cols);
		return (Math.abs(ax - bx) + Math.abs(ay - by)) === 1;
	}
	previewContainer.innerHTML = '';
	previewContainer.appendChild(backBtn);

		// Show collected piece thumbnails for verification
		const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces : [];
		if (collected.length > 0) {
			const collectedWrap = document.createElement('div');
			collectedWrap.id = 'collected-pieces';
			collectedWrap.style.display = 'flex';
			collectedWrap.style.flexDirection = 'column';
			collectedWrap.style.gap = '8px';
			collectedWrap.style.marginTop = '18px';
			collectedWrap.style.alignItems = 'center';
			const title = document.createElement('div');
			title.style.color = '#ff9100';
			title.style.fontWeight = '600';
			collectedWrap.appendChild(title);
			const grid = document.createElement('div');
			grid.style.display = 'grid';
			grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
			grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
			grid.style.gap = '2px';
			grid.style.background = '#fffbe6';
			grid.style.border = '4px solid #ff9100';
			grid.style.padding = '2px';
			// Límites máximos para el grid
			const MAX_WIDTH = 1100;
			const MAX_HEIGHT = 700;
			
			// Calculamos el tamaño del grid manteniendo la relación de aspecto
			const aspect = imgObj.width / imgObj.height;
			let gridWidth = imgObj.width;
			let gridHeight = imgObj.height;
			
			// Si la imagen excede alguno de los límites, la redimensionamos proporcionalmente
			if (gridWidth > MAX_WIDTH || gridHeight > MAX_HEIGHT) {
				if (gridWidth / MAX_WIDTH > gridHeight / MAX_HEIGHT) {
					// El ancho es el factor limitante
					gridWidth = MAX_WIDTH;
					gridHeight = Math.round(MAX_WIDTH / aspect);
				} else {
					// El alto es el factor limitante
					gridHeight = MAX_HEIGHT;
					gridWidth = Math.round(MAX_HEIGHT * aspect);
				}
			}
			
			grid.style.width = gridWidth + 'px';
			grid.style.height = gridHeight + 'px';
			grid.style.position = 'relative';

			// Inicializamos el estado del puzzle para las piezas coleccionadas
			let collectedPuzzleState = Array(totalPieces).fill(null);
			collected.forEach((pieceIdx, i) => {
				collectedPuzzleState[i] = pieceIdx;
			});

			// Función para renderizar el grid de piezas coleccionadas
			function renderCollectedGrid() {
				grid.innerHTML = '';
				for (let i = 0; i < totalPieces; i++) {
					const cell = document.createElement('div');
					cell.className = 'sliding-cell';
					cell.style.width = '100%';
					cell.style.height = '100%';
					cell.style.background = '#fff';
					cell.style.position = 'relative';
					cell.style.overflow = 'hidden';
					cell.dataset.index = i;

					const pieceIdx = collectedPuzzleState[i];
					if (pieceIdx !== null) {
						const canvas = document.createElement('canvas');
						const dpr = window.devicePixelRatio || 1;
						const cellW = gridWidth / cols;
						const cellH = gridHeight / rows;
						canvas.width = Math.round(cellW * dpr);
						canvas.height = Math.round(cellH * dpr);
						canvas.style.width = cellW + 'px';
						canvas.style.height = cellH + 'px';
						canvas.style.borderRadius = '0';
						const ctx = canvas.getContext('2d');
						ctx.scale(dpr, dpr);

						const imgThumb = new window.Image();
						imgThumb.onload = function() {
							const col = pieceIdx % cols;
							const row = Math.floor(pieceIdx / cols);
							const srcW = imgThumb.naturalWidth || imgObj.width;
							const srcH = imgThumb.naturalHeight || imgObj.height;
							const srcPieceW = srcW / cols;
							const srcPieceH = srcH / rows;
							const sx = col * srcPieceW;
							const sy = row * srcPieceH;

							ctx.save();
							ctx.translate(cellW/2, cellH/2);
							ctx.rotate((rotationState[i] || 0) * Math.PI/2);
							ctx.translate(-cellW/2, -cellH/2);
							ctx.drawImage(imgThumb, sx, sy, srcPieceW, srcPieceH, 0, 0, cellW, cellH);
							ctx.restore();
						};
						imgThumb.src = imgObj.src;
						cell.appendChild(canvas);
						cell.style.cursor = 'grab';
					}

					if (selectedCollectedIdx === i) {
						cell.style.outline = '3px solid #b2d900';
					}

					cell.addEventListener('click', function() {
						if (collectedPuzzleState[i] === null) {
							if (selectedCollectedIdx !== null && isAdjacent(selectedCollectedIdx, i)) {
								collectedPuzzleState[i] = collectedPuzzleState[selectedCollectedIdx];
								collectedPuzzleState[selectedCollectedIdx] = null;
								rotationState[i] = rotationState[selectedCollectedIdx];
								rotationState[selectedCollectedIdx] = 0;
								selectedCollectedIdx = null;
								renderCollectedGrid();
								checkCollectedWin();
							}
						} else {
							selectedCollectedIdx = selectedCollectedIdx === i ? null : i;
							renderCollectedGrid();
						}
					});

					grid.appendChild(cell);
				}
			}

			let selectedCollectedIdx = null;

			// Función para verificar si se ha completado el puzzle en el grid de piezas coleccionadas
			function checkCollectedWin() {
				for (let i = 0; i < totalPieces; i++) {
					if (collectedPuzzleState[i] !== i || rotationState[i] !== 0) {
						return;
					}
				}
				const winMsg = document.createElement('div');
				winMsg.className = 'puzzle-win-msg';
				winMsg.textContent = 'Puzzle completed!';
				collectedWrap.insertBefore(winMsg, grid);
			}

			// Manejador de teclas para el grid de piezas coleccionadas
			function handleCollectedKeyControls(e) {
				if (selectedCollectedIdx === null) return;
				if (e.key.toLowerCase() === 'r') {
					rotationState[selectedCollectedIdx] = ((rotationState[selectedCollectedIdx] || 0) + 1) % 4;
					renderCollectedGrid();
					checkCollectedWin();
					return;
				}

				let dir = null;
				if (e.key === 'ArrowUp') dir = -cols;
				else if (e.key === 'ArrowDown') dir = cols;
				else if (e.key === 'ArrowLeft') dir = -1;
				else if (e.key === 'ArrowRight') dir = 1;

				if (dir !== null) {
					const targetIdx = selectedCollectedIdx + dir;
					if (targetIdx >= 0 && targetIdx < totalPieces && isAdjacent(selectedCollectedIdx, targetIdx)) {
						if (collectedPuzzleState[targetIdx] !== null) {
							// Intercambiar piezas
							[collectedPuzzleState[targetIdx], collectedPuzzleState[selectedCollectedIdx]] = 
							[collectedPuzzleState[selectedCollectedIdx], collectedPuzzleState[targetIdx]];
							[rotationState[targetIdx], rotationState[selectedCollectedIdx]] = 
							[rotationState[selectedCollectedIdx], rotationState[targetIdx]];
							selectedCollectedIdx = targetIdx;
						} else {
							collectedPuzzleState[targetIdx] = collectedPuzzleState[selectedCollectedIdx];
							rotationState[targetIdx] = rotationState[selectedCollectedIdx];
							collectedPuzzleState[selectedCollectedIdx] = null;
							rotationState[selectedCollectedIdx] = 0;
							selectedCollectedIdx = targetIdx;
						}
						renderCollectedGrid();
						checkCollectedWin();
					}
				}
			}

			document.addEventListener('keydown', handleCollectedKeyControls);
			collectedWrap.appendChild(grid);
			renderCollectedGrid();
			previewContainer.appendChild(collectedWrap);

			// Añadir meta después de collected pieces
			const meta = document.createElement('div');
			meta.className = 'detail-meta';
			meta.style.alignSelf = 'center';
			meta.style.marginTop = '24px';
			meta.innerHTML = `
				<div style="display:flex;align-items:center;gap:18px;">
					<div style="flex:1;">
						<div><span style='color:#b2d900'>🖼️</span> <b>${imgObj.name}</b></div>
						<div><span style='color:#b2d900'>📅</span> ${new Date(imgObj.date).toLocaleString()}</div>
						<div><span style='color:#b2d900'>📏</span> ${imgObj.width} x ${imgObj.height} px</div>
					</div>
				</div>
			`;
			previewContainer.appendChild(meta);
		}
}
