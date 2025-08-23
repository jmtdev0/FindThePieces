// main.js
// Lógica migrada desde popup.js para la extension page

const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('previewContainer');
const modal = document.getElementById('uploadModal');
const chooseImagesBtn = document.getElementById('chooseImagesBtn');
const puzzleDifficulty = document.getElementById('puzzleDifficulty');
let allImages = [];

// Modal handling
chooseImagesBtn.addEventListener('click', () => {
    modal.classList.add('show');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
    }
});

// Drag and drop handling
const uploadArea = modal.querySelector('.upload-area');

uploadArea.addEventListener('dragenter', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ff9100';
    uploadArea.style.background = 'rgba(255,145,0,0.1)';
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#b2d900';
    uploadArea.style.background = 'transparent';
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#b2d900';
    uploadArea.style.background = 'transparent';
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
});

function handleFiles(files) {
    let newImages = [];
    let filesProcessed = 0;

    files.forEach((file) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgEl = new window.Image();
                imgEl.onload = function() {
                    const size = parseInt(puzzleDifficulty.value);
                    newImages.push({
                        src: e.target.result,
                        name: file.name,
                        date: new Date(),
                        puzzle: true,
                        width: imgEl.naturalWidth,
                        height: imgEl.naturalHeight,
                        frequency: 10,
                        gridSize: size, // Guardamos el tamaño del grid
                        totalPieces: size * size // Guardamos el total de piezas
                    });
                    filesProcessed++;
                    if (filesProcessed === files.length) {
                        allImages = allImages.concat(newImages);
                        saveImages();
                        renderPreviews();
                        modal.classList.remove('show');
                    }
                };
                imgEl.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            filesProcessed++;
        }
    });
}

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
    handleFiles(files);
    imageInput.value = '';
});

function saveImages() {
	if (chrome && chrome.storage && chrome.storage.local) {
		const toStore = allImages.map(img => ({ ...img, date: img.date.toISOString() }));
		chrome.storage.local.set({ findThePiecesImages: toStore });
	}
}

// Función para limpiar popups obsoletos
function cleanupObsoletePopups() {
    const currentImageIndexes = allImages.map((_, idx) => idx.toString());
    document.querySelectorAll('.preview-hover-popup').forEach(popup => {
        const popupIndex = popup.getAttribute('data-image-index');
        if (!currentImageIndexes.includes(popupIndex)) {
            popup.remove();
        }
    });
}

function renderPreviews() {
	// Ocultar todos los popups antes de mostrar la galería
	hideAllHoverPopups();
	
	// Actualizar el título de la página a Gallery
	document.title = 'Find The Pieces - Gallery';
	
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
			img = document.createElement('img');
			img.src = imgObj.src;
			img.alt = 'Preview';
			img.className = 'preview-image puzzle-border-only';
			img.style.width = width + 'px';
			img.style.height = height + 'px';
			img.style.borderRadius = '0';
			img.style.display = 'block';
			img.style.margin = '0 auto';

			// Usar el popup existente o crear uno nuevo si no existe
			let hoverPopup = document.querySelector(`.preview-hover-popup[data-image-index="${idx}"]`);
			
			if (!hoverPopup) {
				hoverPopup = document.createElement('div');
				hoverPopup.className = 'preview-hover-popup' + (imgObj.completed ? ' completed' : '');
				hoverPopup.setAttribute('data-image-index', idx);
				const popupImg = document.createElement('img');
				popupImg.src = imgObj.src;
				hoverPopup.appendChild(popupImg);
				document.body.appendChild(hoverPopup);
			}

			// Eventos de mouse para mostrar/ocultar el popup
			img.addEventListener('mouseenter', () => {
				// Ocultar cualquier otro popup visible primero
				document.querySelectorAll('.preview-hover-popup').forEach(popup => {
					if (popup !== hoverPopup) {
						popup.style.display = 'none';
					}
				});
				hoverPopup.style.display = 'block';
			});

			img.addEventListener('mousemove', (e) => {
				const rect = hoverPopup.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;
				
				// Calcular posiciones posibles
				let x = e.clientX + 20;
				let y = e.clientY + 20;
				
				// Ajustar horizontalmente si se sale de la pantalla
				if (x + rect.width > viewportWidth) {
					x = e.clientX - rect.width - 20;
				}
				
				// Para la posición vertical, priorizar mostrar hacia abajo
				// Solo mover hacia arriba si definitivamente no cabe abajo
				if (y + rect.height > viewportHeight) {
					// Verificar si cabe mejor arriba
					const spaceAbove = e.clientY - 20;
					const spaceBelow = viewportHeight - (e.clientY + 20);
					
					if (spaceAbove > spaceBelow && spaceAbove >= rect.height) {
						// Solo mover arriba si hay más espacio arriba Y cabe completamente
						y = e.clientY - rect.height - 20;
					} else {
						// Mantener abajo pero ajustar para que quepa en pantalla
						y = Math.max(0, viewportHeight - rect.height - 10);
					}
				}
				
				hoverPopup.style.left = x + 'px';
				hoverPopup.style.top = y + 'px';
			});

			img.addEventListener('mouseleave', () => {
				hoverPopup.style.display = 'none';
			});

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
			const totalPieces = imgObj.totalPieces || 9; // Usar el total guardado o 9 por compatibilidad
			counter = document.createElement('div');
			counter.className = 'piece-counter';
			if (imgObj.completed) {
				counter.className += ' completed';
				counter.textContent = 'Completed ✅';
				// Cambiar colores a lima cuando está completado
				wrapper.classList.add('completed');
			} else {
				counter.textContent = `Pieces found: ${collected}/${totalPieces}`;
			}
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
				cleanupObsoletePopups();
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

// Función para ocultar todos los popups de hover
function hideAllHoverPopups() {
    const popups = document.querySelectorAll('.preview-hover-popup');
    popups.forEach(popup => {
        popup.style.display = 'none';
    });
}

function renderDetailView(imgObj, idx) {
	// Ocultar todos los popups antes de mostrar el detalle
	hideAllHoverPopups();
	
	// Actualizar el título de la página a Puzzle
	document.title = 'Find The Pieces - Puzzle';
	
	var uploadBlock = document.getElementById('uploadBlock');
	if (uploadBlock) uploadBlock.style.display = 'none';
	const size = imgObj.gridSize || 3; // Usar tamaño guardado o 3x3 por compatibilidad
	const rows = size, cols = size;
	const totalPieces = size * size;
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
			
			if (imgObj.completed) {
				collectedWrap.classList.add('completed');
				const winMsg = document.createElement('div');
				winMsg.className = 'puzzle-win-msg';
				winMsg.textContent = 'Puzzle completed!';
				winMsg.style.marginBottom = '16px';
				collectedWrap.appendChild(winMsg);
			}
			const title = document.createElement('div');
			title.style.color = imgObj.completed ? '#b2d900' : '#ff9100';
			title.style.fontWeight = '600';
			collectedWrap.appendChild(title);
            // Crear un canvas buffer fuera de pantalla para todo el grid
            const offscreenCanvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;
            offscreenCanvas.style.display = 'none';
            document.body.appendChild(offscreenCanvas);

			const grid = document.createElement('div');
			grid.style.display = 'grid';
			grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
			grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
			grid.style.gap = '2px';
			grid.style.background = '#fffbe6';
			grid.style.border = `4px solid ${imgObj.completed ? '#b2d900' : '#ff9100'}`;
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
			let collectedPuzzleState;
			if (Array.isArray(imgObj.puzzleState) && imgObj.puzzleState.length === totalPieces) {
				// Usar el estado guardado si existe
				collectedPuzzleState = [...imgObj.puzzleState];
			} else {
				// Función para verificar si una disposición es la solución
				const isSolved = (state, rotations) => {
					for (let i = 0; i < totalPieces; i++) {
						if (state[i] !== i || rotations[i] !== 0) {
							return false;
						}
					}
					return true;
				};

				// Función para mezclar array sin que quede en la posición original
				const shuffleUntilDifferent = (arr) => {
					let shuffled;
					let attempts = 0;
					do {
						shuffled = [...arr];
						// Fisher-Yates shuffle
						for (let i = shuffled.length - 1; i > 0; i--) {
							const j = Math.floor(Math.random() * (i + 1));
							[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
						}
						attempts++;
					} while (isSolved(shuffled, Array(totalPieces).fill(0)) && attempts < 100);
					return shuffled;
				};

				// Inicializar con las piezas mezcladas (no en la solución)
				collectedPuzzleState = Array(totalPieces).fill(null);
				
				if (collected.length === totalPieces) {
					// Si tenemos todas las piezas, las mezclamos para que no estén resueltas
					const shuffledPieces = shuffleUntilDifferent(collected);
					shuffledPieces.forEach((pieceIdx, i) => {
						collectedPuzzleState[i] = pieceIdx;
					});
				} else {
					// Si no tenemos todas las piezas, las colocamos secuencialmente
					collected.forEach((pieceIdx, i) => {
						collectedPuzzleState[i] = pieceIdx;
					});
				}
			}

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

                        // Usar el canvas fuera de pantalla para pre-renderizar
                        offscreenCanvas.width = canvas.width;
                        offscreenCanvas.height = canvas.height;
                        const offscreenCtx = offscreenCanvas.getContext('2d');
                        offscreenCtx.scale(dpr, dpr);

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

                            // Renderizar en el canvas fuera de pantalla primero
                            offscreenCtx.save();
                            offscreenCtx.translate(cellW/2, cellH/2);
                            offscreenCtx.rotate((rotationState[i] || 0) * Math.PI/2);
                            offscreenCtx.translate(-cellW/2, -cellH/2);
                            offscreenCtx.drawImage(imgThumb, sx, sy, srcPieceW, srcPieceH, 0, 0, cellW, cellH);
                            offscreenCtx.restore();

                            // Copiar al canvas visible de una sola vez
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(offscreenCanvas, 0, 0);
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
								// Obtener las celdas involucradas
								const selectedCell = grid.children[selectedCollectedIdx];
								const targetCell = cell;
								
								// Intercambiar los canvas
								const selectedCanvas = selectedCell.querySelector('canvas');
								targetCell.appendChild(selectedCanvas);
								selectedCell.innerHTML = ''; // Vaciar la celda origen
								
								// Actualizar estados
								collectedPuzzleState[i] = collectedPuzzleState[selectedCollectedIdx];
								collectedPuzzleState[selectedCollectedIdx] = null;
								rotationState[i] = rotationState[selectedCollectedIdx];
								rotationState[selectedCollectedIdx] = 0;
								
								// Quitar el outline de la celda seleccionada
								selectedCell.style.outline = '';
								
								selectedCollectedIdx = null;
								
								// Guardar el estado actual
								allImages[idx].puzzleState = [...collectedPuzzleState];
								allImages[idx].rotationState = [...rotationState];
								saveImages();
								
								checkCollectedWin();
							}
						} else {
							// Actualizar la selección visual sin redibujar todo
							if (selectedCollectedIdx !== null) {
								grid.children[selectedCollectedIdx].style.outline = '';
							}
							selectedCollectedIdx = selectedCollectedIdx === i ? null : i;
							if (selectedCollectedIdx !== null) {
								cell.style.outline = '3px solid #b2d900';
							}
						}
					});

					grid.appendChild(cell);
				}
			}

			let selectedCollectedIdx = null;

			// Función para mostrar popup de felicitación
			function showCongratulationsPopup() {
				// Eliminar popup existente si existe
				const existingPopup = document.getElementById('congratulations-popup');
				if (existingPopup) {
					existingPopup.remove();
				}
				
				const popup = document.createElement('div');
				popup.id = 'congratulations-popup';
				popup.style.cssText = `
					position: fixed;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%) scale(0);
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					color: white;
					padding: 30px;
					border-radius: 20px;
					text-align: center;
					box-shadow: 0 20px 40px rgba(0,0,0,0.3);
					z-index: 10000;
					font-family: Arial, sans-serif;
					min-width: 350px;
					animation: popup-appear 0.5s ease-out forwards;
				`;

				popup.innerHTML = `
					<div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
					<h2 style="margin: 0 0 10px 0; font-size: 28px;">¡Felicitaciones!</h2>
					<p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">¡Has completado el puzzle!</p>
					
					<div style="margin-bottom: 20px;">
						<p style="margin: 0 0 15px 0; font-size: 14px;">¿Quieres subir tu puzzle completado a Instagram?</p>
						<div style="display: flex; gap: 10px; justify-content: center;">
							<button id="upload-instagram" style="
								background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);
								border: none;
								color: white;
								padding: 12px 20px;
								border-radius: 25px;
								cursor: pointer;
								font-size: 14px;
								font-weight: bold;
								transition: all 0.3s ease;
								display: flex;
								align-items: center;
								gap: 8px;
							" onmouseover="this.style.transform='scale(1.05)'" 
							   onmouseout="this.style.transform='scale(1)'">
								📸 Subir a Instagram
							</button>
							<button id="skip-upload" style="
								background: rgba(255,255,255,0.2);
								border: 2px solid white;
								color: white;
								padding: 10px 20px;
								border-radius: 25px;
								cursor: pointer;
								font-size: 14px;
								transition: all 0.3s ease;
							" onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
							   onmouseout="this.style.background='rgba(255,255,255,0.2)'">
								Ahora no
							</button>
						</div>
					</div>
					
					<div id="upload-status" style="margin-top: 15px; font-size: 14px; min-height: 20px;"></div>
				`;

				// Añadir keyframes para la animación del popup si no existen
				if (!document.getElementById('popup-styles')) {
					const style = document.createElement('style');
					style.id = 'popup-styles';
					style.textContent = `
						@keyframes popup-appear {
							0% {
								transform: translate(-50%, -50%) scale(0);
								opacity: 0;
							}
							100% {
								transform: translate(-50%, -50%) scale(1);
								opacity: 1;
							}
						}
						@keyframes popup-disappear {
							0% {
								transform: translate(-50%, -50%) scale(1);
								opacity: 1;
							}
							100% {
								transform: translate(-50%, -50%) scale(0);
								opacity: 0;
							}
						}
						@keyframes spin {
							0% { transform: rotate(0deg); }
							100% { transform: rotate(360deg); }
						}
					`;
					document.head.appendChild(style);
				}

				document.body.appendChild(popup);

				// Manejar botones
				const uploadBtn = popup.querySelector('#upload-instagram');
				const skipBtn = popup.querySelector('#skip-upload');
				const statusDiv = popup.querySelector('#upload-status');

				// Función para cerrar el popup
				const closePopup = () => {
					popup.style.animation = 'popup-disappear 0.3s ease-in forwards';
					setTimeout(() => {
						if (popup.parentNode) {
							popup.parentNode.removeChild(popup);
						}
					}, 300);
				};

				// Función para subir a Instagram
				const uploadToInstagram = async () => {
					try {
						uploadBtn.disabled = true;
						uploadBtn.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span> Subiendo...';
						statusDiv.textContent = 'Preparando imagen...';

						// Generar imagen del puzzle completado
						const puzzleImageBase64 = await generatePuzzleImage();
						console.log('Generated image size:', puzzleImageBase64.length, 'characters');
						
						statusDiv.textContent = 'Enviando a CloudFlare Worker...';

						// Enviar al Worker de CloudFlare
						const response = await fetch('https://findthepieces-igproxy.jmtdev0.workers.dev/', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								imageBase64: puzzleImageBase64
							})
						});

						console.log('Worker response status:', response.status);
						console.log('Worker response headers:', Object.fromEntries(response.headers.entries()));

						const result = await response.json();
						console.log('Worker response body:', result);

						// Verificar si la respuesta del Worker es exitosa
						if (response.ok) {
							// Verificar si Freeimage.host respondió exitosamente
							if (result.status_code === 200 && result.image && result.image.url) {
								statusDiv.innerHTML = `
									<div style="color: #4CAF50;">✅ ¡Imagen subida exitosamente!</div>
									<a href="${result.image.url}" target="_blank" style="color: #lightblue; text-decoration: underline; font-size: 12px;">Ver imagen</a>
								`;
								
								// Esperar un poco y cerrar
								setTimeout(closePopup, 3000);
							} else {
								// Error de Freeimage.host
								const errorMsg = result.error?.message || result.error || 'Error en el servicio de imágenes';
								throw new Error(errorMsg);
							}
						} else {
							// Error del Worker de CloudFlare
							throw new Error(result.error || `Error del servidor (${response.status})`);
						}

					} catch (error) {
						console.error('Error uploading to Instagram:', error);
						statusDiv.innerHTML = `<div style="color: #ff6b6b;">❌ Error: ${error.message}</div>`;
						uploadBtn.disabled = false;
						uploadBtn.innerHTML = '📸 Subir a Instagram';
					}
				};

				// Función para generar la imagen del puzzle
				const generatePuzzleImage = async () => {
					return new Promise((resolve) => {
						// Crear un canvas para renderizar el puzzle completo
						const canvas = document.createElement('canvas');
						const ctx = canvas.getContext('2d');
						
						// Usar las dimensiones originales de la imagen
						canvas.width = imgObj.width;
						canvas.height = imgObj.height;
						
						const img = new Image();
						img.onload = () => {
							// Rellenar con fondo blanco para JPG (ya que JPG no soporta transparencia)
							ctx.fillStyle = '#ffffff';
							ctx.fillRect(0, 0, canvas.width, canvas.height);
							
							// Dibujar la imagen encima
							ctx.drawImage(img, 0, 0);
							
							// Convertir a JPG con calidad 90 (sin el prefijo data:image/jpeg;base64,)
							const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
							resolve(base64);
						};
						img.src = imgObj.src;
					});
				};

				uploadBtn.addEventListener('click', uploadToInstagram);
				skipBtn.addEventListener('click', closePopup);

				// Cerrar con Escape
				const handleEscape = (e) => {
					if (e.key === 'Escape') {
						closePopup();
						document.removeEventListener('keydown', handleEscape);
					}
				};
				document.addEventListener('keydown', handleEscape);
			}

			// Función para reproducir sonido de completado
			function playCompletionSound() {
				try {
					const audio = new Audio();
					audio.src = chrome.runtime.getURL('sounds/completion.mp3');
					audio.volume = 0.5; // Volumen moderado
					audio.play().catch(err => {
						console.log('No se pudo reproducir el sonido de completado:', err);
						// Intentar con formato alternativo
						audio.src = chrome.runtime.getURL('sounds/completion.wav');
						audio.play().catch(err2 => {
							console.log('No se pudo reproducir sonido alternativo:', err2);
						});
					});
				} catch (error) {
					console.log('Error al cargar sonido de completado:', error);
				}
			}

			// Función para verificar si se ha completado el puzzle en el grid de piezas coleccionadas
			function checkCollectedWin() {
				for (let i = 0; i < totalPieces; i++) {
					if (collectedPuzzleState[i] !== i || rotationState[i] !== 0) {
						return;
					}
				}
				// Marcar el puzzle como completado
				imgObj.completed = true;
				// Actualizar la clase del popup correspondiente
				const hoverPopup = document.querySelector(`.preview-hover-popup[data-image-index="${idx}"]`);
				if (hoverPopup) {
					hoverPopup.classList.add('completed');
				}
				saveImages();
				
				// Reproducir sonido de completado
				playCompletionSound();
				
				// Mostrar popup de felicitación
				showCongratulationsPopup();
				
				// Verificar si ya existe un mensaje de puzzle completado
				const existingWinMsg = collectedWrap.querySelector('.puzzle-win-msg');
				if (!existingWinMsg) {
					const winMsg = document.createElement('div');
					winMsg.className = 'puzzle-win-msg';
					winMsg.textContent = 'Puzzle completed!';
					collectedWrap.insertBefore(winMsg, grid);
				}
			}

			// Manejador de teclas para el grid de piezas coleccionadas
			function handleCollectedKeyControls(e) {
				if (selectedCollectedIdx === null) return;
				if (e.key.toLowerCase() === 'r') {
					rotationState[selectedCollectedIdx] = ((rotationState[selectedCollectedIdx] || 0) + 1) % 4;
					// Guardar el estado después de rotar
					allImages[idx].rotationState = [...rotationState];
					saveImages();
					renderCollectedGrid();
					checkCollectedWin();
					return;
				}

				let dir = null;
				if (e.key === 'ArrowUp') {
					dir = -cols;
					e.preventDefault();
				}
				else if (e.key === 'ArrowDown') {
					dir = cols;
					e.preventDefault();
				}
				else if (e.key === 'ArrowLeft') dir = -1;
				else if (e.key === 'ArrowRight') dir = 1;

				if (dir !== null) {
					const targetIdx = selectedCollectedIdx + dir;
					if (targetIdx >= 0 && targetIdx < totalPieces && isAdjacent(selectedCollectedIdx, targetIdx)) {
						const selectedCell = grid.children[selectedCollectedIdx];
						const targetCell = grid.children[targetIdx];
						
						if (collectedPuzzleState[targetIdx] !== null) {
							// Intercambiar piezas
							const selectedCanvas = selectedCell.querySelector('canvas');
							const targetCanvas = targetCell.querySelector('canvas');
							
							// Remover temporalmente los canvas de sus celdas
							selectedCell.removeChild(selectedCanvas);
							targetCell.removeChild(targetCanvas);
							
							// Intercambiar los canvas
							selectedCell.appendChild(targetCanvas);
							targetCell.appendChild(selectedCanvas);
							
							// Actualizar estados
							[collectedPuzzleState[targetIdx], collectedPuzzleState[selectedCollectedIdx]] = 
							[collectedPuzzleState[selectedCollectedIdx], collectedPuzzleState[targetIdx]];
							[rotationState[targetIdx], rotationState[selectedCollectedIdx]] = 
							[rotationState[selectedCollectedIdx], rotationState[targetIdx]];
							
						} else {
							// Mover canvas a la celda vacía
							const selectedCanvas = selectedCell.querySelector('canvas');
							targetCell.appendChild(selectedCanvas);
							
							// Actualizar estados
							collectedPuzzleState[targetIdx] = collectedPuzzleState[selectedCollectedIdx];
							rotationState[targetIdx] = rotationState[selectedCollectedIdx];
							collectedPuzzleState[selectedCollectedIdx] = null;
							rotationState[selectedCollectedIdx] = 0;
						}
						
						// Actualizar la selección visual
						selectedCell.style.outline = '';
						targetCell.style.outline = '3px solid #b2d900';
						selectedCollectedIdx = targetIdx;
						
						// Guardar el estado después de mover
						allImages[idx].puzzleState = [...collectedPuzzleState];
						allImages[idx].rotationState = [...rotationState];
						saveImages();
						
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
