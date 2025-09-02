// uiManager.js
// Manejo de la interfaz de usuario y renderizado
// Debug helper for puzzle interactions
const PUZZLE_DEBUG = true;
function puzzleDebug(...args) {
    if (PUZZLE_DEBUG && typeof console !== 'undefined' && console.log) {
        try { console.log('[FindThePieces][Puzzle]', ...args); } catch (_) {}
    }
}

class UIManager {
    constructor() {
        this.previewContainer = document.getElementById('previewContainer');
        this.puzzleDifficulty = document.getElementById('puzzleDifficulty');
        this.filterControls = document.getElementById('filterControls');
        this.setupFilterControls();
    }

    // Configurar eventos de los controles de filtrado
    setupFilterControls() {
        const statusFilter = document.getElementById('statusFilter');
        const difficultyFilter = document.getElementById('difficultyFilter');
        const sortBy = document.getElementById('sortBy');
        const clearFilters = document.getElementById('clearFilters');

        // Aplicar filtros cuando cambien
        if (statusFilter) statusFilter.addEventListener('change', () => this.applyFilters());
        if (difficultyFilter) difficultyFilter.addEventListener('change', () => this.applyFilters());
        if (sortBy) sortBy.addEventListener('change', () => this.applyFilters());
        
        // Limpiar filtros
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                statusFilter.value = 'all';
                difficultyFilter.value = 'all';
                sortBy.value = 'newest';
                this.applyFilters();
            });
        }
    }

    // Aplicar filtros y ordenación
    applyFilters() {
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        const difficultyFilter = document.getElementById('difficultyFilter')?.value || 'all';
        const sortBy = document.getElementById('sortBy')?.value || 'newest';

        // Filtrar imágenes
        let filteredImages = window.allImages.filter((imgObj, idx) => {
            // Filtro por estado
            if (statusFilter === 'completed' && !imgObj.completed) return false;
            if (statusFilter === 'incomplete' && imgObj.completed) return false;
            
            // Filtro por dificultad
            if (difficultyFilter !== 'all') {
                const { rows, cols } = this.calculatePuzzleDimensions(imgObj);
                const size = Math.max(rows, cols);
                if (size.toString() !== difficultyFilter) return false;
            }
            
            return true;
        });

        // Ordenar imágenes
        filteredImages.sort((a, b) => {
            const aDate = new Date(a.date || a.addedAt || 0);
            const bDate = new Date(b.date || b.addedAt || 0);
            const aDiff = Math.max(...Object.values(this.calculatePuzzleDimensions(a)));
            const bDiff = Math.max(...Object.values(this.calculatePuzzleDimensions(b)));
            switch (sortBy) {
                case 'oldest':
                    return aDate - bDate;
                case 'newest':
                    return bDate - aDate;
                case 'completed-first':
                    if (a.completed && !b.completed) return -1;
                    if (!a.completed && b.completed) return 1;
                    return bDate - aDate;
                case 'incomplete-first':
                    if (!a.completed && b.completed) return -1;
                    if (a.completed && !b.completed) return 1;
                    return bDate - aDate;
                case 'difficulty':
                    return bDiff - aDiff; // Descendente: más difícil primero
                default:
                    return bDate - aDate;
            }
        });

        // Renderizar con imágenes filtradas
        this.renderFilteredPreviews(filteredImages);
    }

    // Renderizar previews filtradas
    renderFilteredPreviews(filteredImages) {
        this.previewContainer.innerHTML = '';
        
        // Restaurar estilos originales del grid
        this.previewContainer.style.display = 'grid';
        this.previewContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        this.previewContainer.style.flexDirection = '';
        this.previewContainer.style.alignItems = '';
        this.previewContainer.style.gap = '24px';
        this.previewContainer.style.padding = '16px 32px 32px 16px';
        this.previewContainer.style.paddingTop = 'calc(16px + var(--upload-collapsed-height) + 70px)';
        
        // Mostrar uploadBlock y filterControls en la vista de galería
        const uploadBlock = document.getElementById('uploadBlock');
        if (uploadBlock) uploadBlock.style.display = '';
        if (this.filterControls) this.filterControls.style.display = '';
        
        filteredImages.forEach((imgObj) => {
            const originalIndex = window.allImages.indexOf(imgObj);
            this.createImagePreview(imgObj, originalIndex);
        });

        // Mostrar mensaje si no hay resultados
        if (filteredImages.length === 0) {
            const noResults = document.createElement('div');
            noResults.style.cssText = `
                grid-column: 1 / -1;
                text-align: center;
                color: #aaa;
                font-size: 18px;
                padding: 40px;
            `;
            noResults.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <p>No se encontraron imágenes con los filtros seleccionados</p>
                <p style="font-size: 14px; margin-top: 8px;">Prueba a cambiar los filtros o agregar más imágenes</p>
            `;
            this.previewContainer.appendChild(noResults);
        }
    }

    // Renderizar previews de todas las imágenes
    renderPreviews() {
    // Ensure page title reflects gallery view
    try { document.title = 'Find the Pieces - Gallery'; } catch (e) {}
        // Mostrar el switch de contentScript en la vista de galería
        const contentScriptSwitch = document.getElementById('contentScriptSwitch');
        if (contentScriptSwitch) {
            contentScriptSwitch.style.display = 'flex';
        }
        
        // Mostrar controles de filtrado si hay imágenes
        if (window.allImages && window.allImages.length > 0) {
            if (this.filterControls) this.filterControls.style.display = '';
            this.applyFilters();
        } else {
            // Ocultar controles si no hay imágenes
            if (this.filterControls) this.filterControls.style.display = 'none';
            this.previewContainer.innerHTML = '';
            
            // Restaurar estilos originales del grid
            this.previewContainer.style.display = 'grid';
            this.previewContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
            this.previewContainer.style.flexDirection = '';
            this.previewContainer.style.alignItems = '';
            this.previewContainer.style.gap = '24px';
            this.previewContainer.style.padding = '16px 32px 32px 16px';
            this.previewContainer.style.paddingTop = 'calc(16px + var(--upload-collapsed-height) + 20px)';
            
            // Mostrar uploadBlock en la vista de galería
            const uploadBlock = document.getElementById('uploadBlock');
            if (uploadBlock) uploadBlock.style.display = '';
        }
    }

    // Crear preview de una imagen
    createImagePreview(imgObj, idx) {
        const preview = document.createElement('div');
        preview.className = 'preview-wrapper';
        if (imgObj.completed) {
            preview.classList.add('completed');
        }
        
        const img = document.createElement('img');
        img.className = 'preview-image';
        img.src = imgObj.src;
        img.alt = imgObj.name;
        
        // Crear popup hover
        this.setupHoverPopup(img, imgObj, idx);
        
        // Crear información de la imagen
        const info = this.createImageInfo(imgObj, idx);
        
        // Crear botón de eliminar
        const deleteBtn = this.createDeleteButton(imgObj, idx);
        
        // Event listener para abrir detalles en todo el div
        const openDetail = () => this.openImageDetail(imgObj, idx);
        preview.addEventListener('click', (e) => {
            // Evitar que el botón de eliminar o el input range disparen el detalle
            if (e.target.closest('.delete-btn')) return;
            if (e.target.matches('input[type="range"]')) return;
            // Evitar que el click en el enlace de Instagram abra el detalle
            if (e.target.closest('.ig-link-badge')) return;
            openDetail();
        });

        preview.appendChild(img);
        preview.appendChild(info);
        preview.appendChild(deleteBtn);
        this.previewContainer.appendChild(preview);
    }

    // Configurar popup hover
    setupHoverPopup(img, imgObj, idx) {
        let hoverPopup = null;
        
        img.addEventListener('mouseenter', () => {
            this.hideAllHoverPopups();
            
            hoverPopup = document.createElement('div');
            hoverPopup.className = 'preview-hover-popup' + (imgObj.completed ? ' completed' : '');
            
            hoverPopup.innerHTML = `
                <img src="${imgObj.src}" alt="${imgObj.name}" />
            `;
            
            hoverPopup.style.display = 'block';
            document.body.appendChild(hoverPopup);
        });
        
        img.addEventListener('mousemove', (e) => {
            if (hoverPopup) {
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                const popupWidth = 300;
                const popupHeight = 120;
                
                let left = mouseX + 15;
                let top = mouseY - popupHeight / 2;
                
                if (left + popupWidth > windowWidth) {
                    left = mouseX - popupWidth - 15;
                }
                
                if (top < 10) {
                    top = 10;
                } else if (top + popupHeight > windowHeight - 10) {
                    top = windowHeight - popupHeight - 10;
                }
                
                hoverPopup.style.left = left + 'px';
                hoverPopup.style.top = top + 'px';
            }
        });
        
        img.addEventListener('mouseleave', () => {
            if (hoverPopup) {
                document.body.removeChild(hoverPopup);
                hoverPopup = null;
            }
        });
    }

    // Crear información de la imagen
    createImageInfo(imgObj, idx) {
        const info = document.createElement('div');
        info.className = 'preview-side';
        
        const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces : [];
        const { rows, cols } = this.calculatePuzzleDimensions(imgObj);
        const totalPieces = rows * cols;


        const previewInfo = document.createElement('div');
        previewInfo.className = 'preview-info';
        
        // Control de frecuencia si no está completado
        let frequencyControl = '';
        if (!imgObj.completed) {
            frequencyControl = `
                <div class="frequency-control">
                    <label>
                        <span>Pieces' appearance frequency:</span>
                        <input type="range" min="1" max="100" value="${imgObj.frequency || 10}" class="freq-slider" data-idx="${idx}">
                        <span class="freq-value">${this.getFrequencyText(imgObj.frequency || 10)}</span>
                    </label>
                </div>
            `;
        }
        

        previewInfo.innerHTML = `
            <div class="img-name">${imgObj.name}</div>
            <div class="img-date">${this.formatImageDate(imgObj)}</div>
            <div class="piece-counter">${collected.length}/${totalPieces} pieces found</div>
            ${imgObj.completed ? `<div style=\"color: #b2d900; font-weight: bold; display: flex; align-items: center; gap: 8px;\">✅ Completed!${(() => {
                if (imgObj.publishedToInstagram) {
                    const hasLink = !!imgObj.instagramPermalink;
                    const commonStyle = 'color:#0095f6;font-weight:600;font-size:14px;border-radius:6px;background:#eaf6ff;padding:2px 8px;';
                    if (hasLink) {
                        const safeHref = imgObj.instagramPermalink.replace(/\\"/g,'&quot;');
                        return `<a class="ig-link-badge" href="${safeHref}" target="_blank" rel="noopener noreferrer" style="${commonStyle} text-decoration:none;">Posted on Instagram</a>`;
                    } else {
                        return `<span style="${commonStyle}">Posted on Instagram</span>`;
                    }
                } else {
                    return '';
                }
            })()}</div>` : ''}
            ${frequencyControl}
        `;
        
        info.appendChild(previewInfo);
        
        // Event listeners para control de frecuencia
        if (!imgObj.completed) {
            this.setupFrequencyControl(info, imgObj, idx);
        }
        
        return info;
    }

    // Configurar control de frecuencia
    setupFrequencyControl(info, imgObj, idx) {
        const freqInput = info.querySelector('.freq-slider');
        const freqValue = info.querySelector('.freq-value');
        
        freqInput.addEventListener('input', () => {
            freqValue.textContent = this.getFrequencyText(freqInput.value);
        });
        
        freqInput.addEventListener('change', () => {
            const newFrequency = parseInt(freqInput.value);
            // Usar updateImageSilent para notificar al contentScript automáticamente
            if (window.findThePiecesApp) {
                window.findThePiecesApp.updateImageSilent(idx, { frequency: newFrequency });
            } else {
                // Fallback para compatibilidad
                imgObj.frequency = newFrequency;
                window.storageManager.saveImages(window.allImages);
            }
        });
    }

    // Calcular dimensiones del puzzle
    calculatePuzzleDimensions(imgObj) {
        // Si la imagen ya tiene dimensiones guardadas, usarlas
        if (imgObj.puzzleRows && imgObj.puzzleCols) {
            return { rows: imgObj.puzzleRows, cols: imgObj.puzzleCols };
        }

    // Si no, calcular basándose en el selector actual
    // NOTE: Respect the user's selected difficulty as an N×N grid unless
    // explicit puzzleRows/puzzleCols are already stored for the image.
    const difficulty = this.puzzleDifficulty.value;
    const size = Math.max(2, parseInt(difficulty) || 3);
    const rows = size;
    const cols = size;
    return { rows, cols, totalPieces: rows * cols };
    }

    // Ocultar todos los popups hover
    hideAllHoverPopups() {
        document.querySelectorAll('.preview-hover-popup').forEach(popup => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        });
    }

    // Abrir detalle de imagen
    openImageDetail(imgObj, idx) {
        this.hideAllHoverPopups();
        
        // Limpiar popup de felicitaciones existente
        this.cleanupObsoletePopups();
        
        // Ocultar el switch de contentScript en la vista de detalle
        const contentScriptSwitch = document.getElementById('contentScriptSwitch');
        if (contentScriptSwitch) {
            contentScriptSwitch.style.display = 'none';
        }
        
        // Inicializar puzzle
        const puzzleData = window.puzzleManager.initializePuzzle(imgObj, idx);
        
        // Renderizar vista de detalle
    // Update page title for detail view
    try { document.title = 'Find the Pieces - Puzzle'; } catch (e) {}
    this.renderDetailView(imgObj, idx, puzzleData);
    }

    // Renderizar vista de detalle
    renderDetailView(imgObj, idx, puzzleData) {
        const { rows, cols, totalPieces } = puzzleData;
        
        // Crear botón de regreso
        const backBtn = document.createElement('button');
        backBtn.textContent = '← Back to Gallery';
        backBtn.className = 'back-btn';
        backBtn.addEventListener('click', () => {
            // Limpiar listener de teclado
            if (window.currentKeyboardHandler) {
                document.removeEventListener('keydown', window.currentKeyboardHandler);
                window.currentKeyboardHandler = null;
            }
            
            // Ocultar cualquier popup de felicitación activo
            const existingPopups = document.querySelectorAll('#congratulations-popup');
            existingPopups.forEach(popup => {
                popup.style.animation = 'popup-disappear 0.3s ease-in forwards';
                setTimeout(() => {
                    if (popup.parentNode) {
                        popup.parentNode.removeChild(popup);
                    }
                }, 300);
            });
            
            // Mostrar el switch de contentScript al regresar a la galería
            const contentScriptSwitch = document.getElementById('contentScriptSwitch');
            if (contentScriptSwitch) {
                contentScriptSwitch.style.display = 'flex';
            }
            // Cleanup any active drag ghost if present
            try {
                if (window.currentPuzzleDragGhost && window.currentPuzzleDragGhost.parentNode) {
                    window.currentPuzzleDragGhost.parentNode.removeChild(window.currentPuzzleDragGhost);
                }
                window.currentPuzzleDragGhost = null;
            } catch (cleanupErr) {
                console.warn('Error cleaning up puzzle drag ghost:', cleanupErr);
            }

            window.puzzleManager.cleanup();
            this.renderPreviews();
        });

        // Limpiar contenedor y configurarlo para centrado
        this.previewContainer.innerHTML = '';
        this.previewContainer.style.display = 'flex';
        this.previewContainer.style.flexDirection = 'column';
        this.previewContainer.style.alignItems = 'center';
        this.previewContainer.style.gap = '20px';
        this.previewContainer.style.padding = '20px';
        
        // Ocultar uploadBlock y filterControls en la vista de detalle
        const uploadBlock = document.getElementById('uploadBlock');
        if (uploadBlock) {
            uploadBlock.style.display = 'none';
        }
        if (this.filterControls) {
            this.filterControls.style.display = 'none';
        }
        
        this.previewContainer.appendChild(backBtn);

        // Mostrar piezas recolectadas o mensaje vacío
        const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces : [];
        
        const puzzleContainer = document.createElement('div');
        puzzleContainer.id = 'puzzle-container';
        puzzleContainer.style.display = 'flex';
        puzzleContainer.style.flexDirection = 'column';
        puzzleContainer.style.alignItems = 'center';
        puzzleContainer.style.gap = '16px';
        
        if (imgObj.completed) {
            const winMsg = document.createElement('div');
            winMsg.className = 'puzzle-win-msg';
            winMsg.textContent = 'Puzzle completed!';
            winMsg.style.color = '#b2d900';
            winMsg.style.fontSize = '24px';
            winMsg.style.fontWeight = 'bold';
            winMsg.style.textAlign = 'center';
            puzzleContainer.appendChild(winMsg);
            // The scramble button is rendered directly under the .detail-title inside renderPuzzleGrid
        }
        
        if (collected.length > 0) {
            this.renderPuzzleGrid(imgObj, idx, puzzleData, puzzleContainer);
        } else {
            this.renderEmptyPuzzleMessage(puzzleContainer);
        }
        
        this.previewContainer.appendChild(puzzleContainer);
        
        // Añadir metadatos debajo del puzzle
        this.renderImageMetadata(imgObj);
        
        // Configurar controles de teclado
        document.addEventListener('keydown', window.puzzleManager.handleKeyControls.bind(window.puzzleManager));
    }

    // Renderizar grid del puzzle
    renderPuzzleGrid(imgObj, idx, puzzleData, container) {
        
        const { rows, cols, totalPieces } = puzzleData;
        const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces : [];
        
        // Título
        const title = document.createElement('div');
        title.className = 'detail-title'; // Añadir clase para facilitar identificación
        title.textContent = `Puzzle: ${rows}×${cols} (${collected.length}/${totalPieces} pieces)`;
        title.style.color = imgObj.completed ? '#b2d900' : '#ff9100';
        title.style.fontWeight = '600';
        title.style.fontSize = '18px';
        title.style.textAlign = 'center';
        title.style.marginBottom = '16px';
        container.appendChild(title);

        // If puzzle is completed, render a single "Scramble pieces" button directly under the title
        try {
            if (imgObj.completed) {
                const titleScramble = document.createElement('button');
                titleScramble.id = `scramble-button`;
                titleScramble.textContent = 'Scramble pieces';
                titleScramble.title = 'Randomize all collected pieces and mark the puzzle as not completed so you can solve it again.';
                titleScramble.setAttribute('aria-label', 'Scramble pieces');
                titleScramble.style.cssText = `
                    background: linear-gradient(180deg, #ffffff 0%, #f6f6f6 100%);
                    color: #333;
                    border: 1px solid #dcdcdc;
                    padding: 8px 14px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 13px;
                    margin: 8px auto 12px auto;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                    transition: transform 0.12s ease, box-shadow 0.12s ease;
                    display: inline-block;
                `;

                titleScramble.addEventListener('mouseenter', () => {
                    titleScramble.style.transform = 'translateY(-1px)';
                    titleScramble.style.boxShadow = '0 4px 10px rgba(0,0,0,0.08)';
                });
                titleScramble.addEventListener('mouseleave', () => {
                    titleScramble.style.transform = '';
                    titleScramble.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                });

                titleScramble.addEventListener('click', async () => {
                    titleScramble.disabled = true;
                    const originalText = titleScramble.textContent;
                    titleScramble.textContent = 'Scrambling...';

                    // Prepare new shuffled state
                    const pieces = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces.slice() : [];
                    const newState = new Array(totalPieces).fill(null);
                    if (pieces.length > 0) {
                        this.placePiecesRandomly(newState, pieces, totalPieces);
                    }

                    // Update object and persist
                    imgObj.puzzleState = newState;
                    imgObj.completed = false;
                    if (window.findThePiecesApp && typeof window.findThePiecesApp.updateImageSilent === 'function') {
                        try {
                            await window.findThePiecesApp.updateImageSilent(idx, { puzzleState: newState, completed: false });
                        } catch (err) {
                            console.warn('updateImageSilent failed:', err);
                            window.storageManager && window.storageManager.saveImages && window.storageManager.saveImages(window.allImages);
                        }
                    } else {
                        window.storageManager && window.storageManager.saveImages && window.storageManager.saveImages(window.allImages);
                    }

                    // Re-initialize puzzle and re-render detail view
                    try {
                        const newPuzzleData = window.puzzleManager && window.puzzleManager.initializePuzzle ? window.puzzleManager.initializePuzzle(imgObj, idx) : { rows: rows, cols: cols, totalPieces: totalPieces };
                        this.renderDetailView(imgObj, idx, newPuzzleData);
                    } catch (renderErr) {
                        console.error('Error re-rendering detail after scramble:', renderErr);
                        // Restore button state if re-rendering failed
                        titleScramble.disabled = false;
                        titleScramble.textContent = originalText;
                    }
                });

                // Insert the button right after the title
                title.parentNode && title.parentNode.insertBefore(titleScramble, title.nextSibling);
            }
        } catch (err) {
            console.error('Error adding scramble button under title:', err);
        }
        
        // Crear contenedor del grid centrado
        const gridWrapper = document.createElement('div');
        gridWrapper.style.display = 'flex';
        gridWrapper.style.justifyContent = 'center';
        gridWrapper.style.alignItems = 'center';
        gridWrapper.style.width = '100%';
        
        // Crear grid
        const grid = document.createElement('div');
        grid.id = 'puzzle-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        grid.style.background = '#fffbe6';
        grid.style.border = `4px solid ${imgObj.completed ? '#b2d900' : '#ff9100'}`;
        grid.style.position = 'relative';
        
        // Calcular tamaño del grid manteniendo proporción
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 400;
        const aspect = imgObj.width / imgObj.height;
        let gridWidth = Math.min(imgObj.width * 0.6, MAX_WIDTH);
        let gridHeight = Math.min(imgObj.height * 0.6, MAX_HEIGHT);
        
        if (gridWidth / MAX_WIDTH > gridHeight / MAX_HEIGHT) {
            gridWidth = MAX_WIDTH;
            gridHeight = Math.round(MAX_WIDTH / aspect);
        } else {
            gridHeight = MAX_HEIGHT;
            gridWidth = Math.round(MAX_HEIGHT * aspect);
        }
        
        grid.style.width = gridWidth + 'px';
        grid.style.height = gridHeight + 'px';
        
        // Estado para drag & drop y teclado
    let selectedCell = null;
    let selectedIdx = null;
    let puzzleState = [];
    let keyboardHandler = null;
    // Drag state to avoid stray clicks causing extra swaps
    let isDragging = false;
    let suppressClicksUntil = 0;
        
        // Inicializar estado del puzzle
        if (imgObj.puzzleState && imgObj.puzzleState.length === totalPieces) {
            puzzleState = [...imgObj.puzzleState];
            
            // Verificar si hay nuevas piezas recolectadas que no están en el estado actual
            const piecesInState = new Set(puzzleState.filter(p => p !== null));
            const newPieces = collected.filter(pieceIdx => !piecesInState.has(pieceIdx));
            
            if (newPieces.length > 0) {
                // Colocar nuevas piezas en posiciones aleatorias que no resuelvan el puzzle
                this.placePiecesRandomly(puzzleState, newPieces, totalPieces);
            }
        } else {
            // Crear estado inicial con piezas en posiciones aleatorias (no resueltas)
            puzzleState = new Array(totalPieces).fill(null);
            if (collected.length > 0) {
                this.placePiecesRandomly(puzzleState, collected, totalPieces);
            }
        }
        
        // Renderizar celdas
        // Calcular espacio disponible considerando gaps y padding
        const gap = 2;
        const padding = 2;
        const totalGapWidth = (cols - 1) * gap;
        const totalGapHeight = (rows - 1) * gap;
        const availableWidth = gridWidth - (padding * 2) - totalGapWidth;
        const availableHeight = gridHeight - (padding * 2) - totalGapHeight;
        
        const cellW = Math.floor(availableWidth / cols);
        const cellH = Math.floor(availableHeight / rows);
        
        for (let i = 0; i < totalPieces; i++) {
            const cell = document.createElement('div');
            cell.className = 'puzzle-cell';
            cell.style.width = cellW + 'px';
            cell.style.height = cellH + 'px';
            cell.style.background = '#fff';
            cell.style.border = '1px solid #ddd';
            cell.style.boxSizing = 'border-box'; // Incluir borde en el tamaño
            cell.style.display = 'flex';
            cell.style.alignItems = 'center';
            cell.style.justifyContent = 'center';
            cell.style.fontSize = '12px';
            cell.style.color = '#666';
            cell.style.position = 'relative';
            cell.style.overflow = 'hidden';
            cell.dataset.index = i;
            
            const pieceIdx = puzzleState[i];
            
            if (pieceIdx !== null && collected.includes(pieceIdx)) {
                // Mostrar pieza del puzzle
                const pieceImg = document.createElement('canvas');
                pieceImg.width = cellW * 2; // Mejor resolución
                pieceImg.height = cellH * 2;
                pieceImg.style.width = '100%';
                pieceImg.style.height = '100%';
                pieceImg.style.cursor = 'grab';
                
                const ctx = pieceImg.getContext('2d');
                const img = new Image();
                // Tag canvas with the piece index for debug/tests
                try { pieceImg.dataset.pieceIndex = String(pieceIdx); } catch (_) {}
                img.onload = () => {
                    const col = pieceIdx % cols;
                    const row = Math.floor(pieceIdx / cols);
                    const srcW = img.naturalWidth;
                    const srcH = img.naturalHeight;
                    const srcPieceW = srcW / cols;
                    const srcPieceH = srcH / rows;
                    const sx = col * srcPieceW;
                    const sy = row * srcPieceH;
                    
                    ctx.drawImage(img, sx, sy, srcPieceW, srcPieceH, 0, 0, cellW * 2, cellH * 2);
                };
                img.src = imgObj.src;
                
                cell.appendChild(pieceImg);
                cell.style.background = '#f0f8ff';
                cell.style.cursor = 'grab';
                
        // Añadir funcionalidad de click (solo selección para movimiento con teclado)
                cell.addEventListener('click', (ev) => {
                    // Ignore clicks fired right after a drag-drop
                    if (isDragging || Date.now() < suppressClicksUntil) {
                        puzzleDebug('Click suprimido tras arrastre/cooldown', { now: Date.now(), suppressClicksUntil });
                        ev.preventDefault();
                        ev.stopPropagation();
                        return;
                    }
                    const clickedPiece = puzzleState[i];
                    if (clickedPiece !== null) {
                        puzzleDebug(`Click en pieza ${clickedPiece} (celda ${i})${selectedCell ? ' con selección previa' : ''}`, { cellIndex: i, pieceIndex: clickedPiece, hadSelection: !!selectedCell });
                    }
                    if (selectedCell === cell) {
                        // Deseleccionar si se hace click en la misma pieza
                        selectedCell.style.border = '1px solid #ddd';
                        selectedCell.style.zIndex = '';
                        selectedCell = null;
                        selectedIdx = null;
                        puzzleDebug(`Deseleccionar pieza ${clickedPiece} (celda ${i})`, { cellIndex: i, pieceIndex: clickedPiece });
                    } else if (selectedCell === null) {
                        // Seleccionar si no hay nada seleccionado
                        selectedCell = cell;
                        selectedIdx = i;
                        cell.style.border = '3px solid #b2d900';
                        cell.style.zIndex = '10';
                        puzzleDebug(`Seleccionar pieza ${clickedPiece} (celda ${i})`, { cellIndex: i, pieceIndex: clickedPiece });
                    } else {
            // Si hay otra pieza seleccionada y se hace click en una pieza diferente,
            // cambiar el foco a la nueva pieza (no intercambiar ni mover)
                        if (puzzleState[i] !== null) {
                            // Quitar selección de la pieza anterior
                            selectedCell.style.border = '1px solid #ddd';
                            selectedCell.style.zIndex = '';
                            
                            // Seleccionar la nueva pieza
                            selectedCell = cell;
                            selectedIdx = i;
                            cell.style.border = '3px solid #b2d900';
                            cell.style.zIndex = '10';
                            puzzleDebug(`Cambiar selección a pieza ${clickedPiece} (celda ${i})`, { newCellIndex: i, pieceIndex: clickedPiece });
            }
                    }
                });

                // Drag & drop: start on mousedown without prior selection; on drop over another cell, swap or move
                pieceImg.addEventListener('mousedown', (ev) => {
                    if (ev.button !== 0) return; // left button only
                    // Do not prevent default here; allow the click to be delivered if no drag starts
                    const fromIdx = parseInt(cell.dataset.index);
                    const fromPiece = puzzleState[fromIdx];
                    puzzleDebug(`Iniciar arrastre de pieza ${fromPiece} (desde celda ${fromIdx})`, { fromIdx, pieceIndex: fromPiece });

                    try {
                        let didDrag = false;
                        let hoverCell = null; // candidate drop cell to highlight
                        let hoverIdx = null;
                        let cellRects = null; // precomputed rects of grid cells
                        let gridRect = null;
                        const startX = ev.clientX;
                        const startY = ev.clientY;
                        let ghost = null;

                        const ensureGhost = () => {
                            if (didDrag) return;
                            didDrag = true;
                            isDragging = true;
                            // Create drag ghost from the canvas content
                            const srcCanvas = pieceImg;
                            ghost = document.createElement('canvas');
                            ghost.width = srcCanvas.width;
                            ghost.height = srcCanvas.height;
                            const gctx = ghost.getContext('2d');
                            try { gctx.drawImage(srcCanvas, 0, 0); } catch (err) { console.warn('Drag ghost draw fail:', err); }
                            ghost.style.position = 'fixed';
                            ghost.style.pointerEvents = 'none';
                            ghost.style.opacity = '0.95';
                            ghost.style.zIndex = 20000;
                            const rect = pieceImg.getBoundingClientRect();
                            ghost.style.width = rect.width + 'px';
                            ghost.style.height = rect.height + 'px';
                            ghost.style.boxShadow = '0 8px 20px rgba(0,0,0,0.18)';
                            ghost.style.borderRadius = '4px';
                            document.body.appendChild(ghost);
                            window.currentPuzzleDragGhost = ghost;
                            ghost.style.left = (startX - ghost.offsetWidth / 2) + 'px';
                            ghost.style.top = (startY - ghost.offsetHeight / 2) + 'px';
                            puzzleDebug(`Comienza arrastre de pieza ${fromPiece} (celda ${fromIdx}) en (${startX}, ${startY})`, { fromIdx, pieceIndex: fromPiece, startX, startY });

                            // Precompute cell rectangles for robust hit testing
                            try {
                                gridRect = grid.getBoundingClientRect();
                                cellRects = Array.from(grid.children).map(el => ({
                                    el,
                                    idx: parseInt(el.dataset.index),
                                    rect: el.getBoundingClientRect(),
                                    cx: el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2,
                                    cy: el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2
                                }));
                            } catch (_) { cellRects = null; }
                        };

                        const pickCell = (x, y) => {
                            if (!cellRects || !gridRect) return { el: null, idx: null };
                            // If pointer within grid bounds, prefer containment
                            if (x >= gridRect.left && x <= gridRect.right && y >= gridRect.top && y <= gridRect.bottom) {
                                for (const c of cellRects) {
                                    const r = c.rect;
                                    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                                        return { el: c.el, idx: c.idx };
                                    }
                                }
                                // On borders between cells, choose nearest center
                                let best = null, bestD2 = Infinity;
                                for (const c of cellRects) {
                                    const dx = x - c.cx, dy = y - c.cy;
                                    const d2 = dx*dx + dy*dy;
                                    if (d2 < bestD2) { bestD2 = d2; best = c; }
                                }
                                return best ? { el: best.el, idx: best.idx } : { el: null, idx: null };
                            }
                            return { el: null, idx: null };
                        };

                        const onMove = (e) => {
                            const dx = Math.abs(e.clientX - startX);
                            const dy = Math.abs(e.clientY - startY);
                            if (!didDrag && (dx > 4 || dy > 4)) {
                                ensureGhost();
                            }
                            if (!didDrag) return;
                            if (!window.currentPuzzleDragGhost) return;
                            window.currentPuzzleDragGhost.style.left = (e.clientX - window.currentPuzzleDragGhost.offsetWidth / 2) + 'px';
                            window.currentPuzzleDragGhost.style.top = (e.clientY - window.currentPuzzleDragGhost.offsetHeight / 2) + 'px';

                // Determine and highlight current candidate drop cell
                            try {
                                const { el: validCandidate, idx: overIdx } = pickCell(e.clientX, e.clientY);
                                if (hoverCell !== validCandidate) {
                                    if (hoverCell) { hoverCell.style.outline = ''; hoverCell.style.outlineOffset = ''; }
                                    if (validCandidate) { validCandidate.style.outline = '3px solid #ff9100'; validCandidate.style.outlineOffset = '-3px'; }
                                    hoverCell = validCandidate;
                                    hoverIdx = overIdx;
                                    if (overIdx !== null) {
                                        const overPiece = puzzleState[overIdx];
                                        if (overPiece !== null) {
                                            puzzleDebug(`Arrastrando sobre pieza ${overPiece} (celda ${overIdx}) en (${e.clientX}, ${e.clientY})`, { fromIdx, overIdx, overPiece, x: e.clientX, y: e.clientY });
                                        } else {
                                            puzzleDebug(`Arrastrando sobre celda vacía ${overIdx} en (${e.clientX}, ${e.clientY})`, { fromIdx, overIdx, x: e.clientX, y: e.clientY });
                                        }
                                    } else {
                                        puzzleDebug(`Arrastrando fuera de celdas (${e.clientX}, ${e.clientY})`, { fromIdx, x: e.clientX, y: e.clientY });
                                    }
                                }
                            } catch (_) { /* ignore */ }
                        };

                        const onUp = (e) => {
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                            if (!didDrag) {
                                // Simple click; let click handler manage selection
                                puzzleDebug(`MouseUp sin arrastre (click) en pieza ${fromPiece} (celda ${fromIdx})`, { fromIdx, pieceIndex: fromPiece });
                                return;
                            }
                            try { if (hoverCell) { hoverCell.style.outline = ''; hoverCell.style.outlineOffset = ''; } } catch (_) {}
                            if (window.currentPuzzleDragGhost && window.currentPuzzleDragGhost.parentNode) {
                                window.currentPuzzleDragGhost.parentNode.removeChild(window.currentPuzzleDragGhost);
                            }
                            window.currentPuzzleDragGhost = null;
                            isDragging = false;
                            suppressClicksUntil = Date.now() + 300;
                            puzzleDebug(`Fin de arrastre de pieza ${fromPiece} (celda ${fromIdx}) en (${e.clientX}, ${e.clientY})`, { fromIdx, pieceIndex: fromPiece, endX: e.clientX, endY: e.clientY });

                            // Determine drop target cell within this grid using robust hit testing
                            let dropCell = (hoverCell && hoverCell.parentElement === grid) ? hoverCell : null;
                            let toIdx = (hoverIdx !== null) ? hoverIdx : null;
                            if (!dropCell || toIdx === null) {
                                const picked = pickCell(e.clientX, e.clientY);
                                dropCell = picked.el;
                                toIdx = picked.idx;
                            }
                            if (!dropCell || dropCell.parentElement !== grid || toIdx === null) {
                                puzzleDebug('Soltar fuera del grid o destino inválido', { fromIdx, x: e.clientX, y: e.clientY });
                                return; // dropped outside grid or on another grid
                            }
                            toIdx = parseInt(toIdx);
                            if (isNaN(toIdx) || toIdx === fromIdx) {
                                puzzleDebug('Soltar sobre la misma celda o índice inválido (sin cambios)', { fromIdx, toIdx });
                                return;
                            }

                            const prevCompletedDrag = !!imgObj.completed;
                            // Resolve the current index of the dragged piece to guarantee it participates in the swap/move
                            const draggedPiece = fromPiece; // captured at mousedown
                            const currentFromIdx = puzzleState.indexOf(draggedPiece);
                            if (currentFromIdx === -1) {
                                puzzleDebug('Advertencia: pieza arrastrada ya no está en puzzleState; se cancela drop', { draggedPiece });
                                return;
                            }
                            if (toIdx === currentFromIdx) {
                                puzzleDebug('Soltar sobre la misma celda (sin cambios)', { currentFromIdx, toIdx });
                                return;
                            }
                            const targetHadPiece = puzzleState[toIdx] !== null;
                            const toPieceBefore = puzzleState[toIdx];
                            const fromPieceBefore = puzzleState[currentFromIdx];
                            if (currentFromIdx !== fromIdx) {
                                puzzleDebug('Nota: índice origen cambió durante arrastre', { initialFromIdx: fromIdx, currentFromIdx, draggedPiece });
                            }

                            // Swap if target has a piece; otherwise move to empty
                            if (puzzleState[toIdx] !== null) {
                                const tmp = puzzleState[toIdx];
                                puzzleState[toIdx] = puzzleState[currentFromIdx];
                                puzzleState[currentFromIdx] = tmp;
                                puzzleDebug(`Intercambio (arrastre): pieza ${fromPieceBefore} (celda ${currentFromIdx}) ↔ pieza ${toPieceBefore} (celda ${toIdx})`, { fromIdx: currentFromIdx, toIdx, fromPiece: fromPieceBefore, toPiece: toPieceBefore });
                            } else {
                                puzzleState[toIdx] = puzzleState[currentFromIdx];
                                puzzleState[currentFromIdx] = null;
                                puzzleDebug(`Mover (arrastre): pieza ${fromPieceBefore} de celda ${currentFromIdx} a celda ${toIdx} (vacía)`, { fromIdx: currentFromIdx, toIdx, pieceIndex: fromPieceBefore });
                            }

                            // Check completion and persist
                            const isCompletedNow = this.checkPuzzleCompletion(puzzleState, totalPieces);
                            imgObj.puzzleState = [...puzzleState];
                            imgObj.completed = !!isCompletedNow;
                            if (imgObj.completed && !imgObj.completedAt) {
                                imgObj.completedAt = new Date().toISOString();
                            }
                            if (window.findThePiecesApp) {
                                window.findThePiecesApp.updateImageSilent(idx, {
                                    puzzleState: puzzleState,
                                    completed: imgObj.completed,
                                    completedAt: imgObj.completedAt
                                });
                                puzzleDebug(`Estado persistido tras arrastre. ¿Completado?: ${imgObj.completed ? 'sí' : 'no'}`, { completed: imgObj.completed });
                            }

                            if (prevCompletedDrag && !imgObj.completed) {
                                try {
                                    const newPuzzleData = window.puzzleManager && window.puzzleManager.initializePuzzle ? window.puzzleManager.initializePuzzle(imgObj, idx) : { rows: rows, cols: cols, totalPieces: totalPieces };
                                    this.renderDetailView(imgObj, idx, newPuzzleData);
                                    return;
                                } catch (reErr) {
                                    console.error('Error re-rendering after drag un-complete:', reErr);
                                }
                            }

                            if (isCompletedNow) {
                                setTimeout(() => {
                                    grid.style.animation = 'pulse 0.5s ease-in-out 3';
                                    grid.style.boxShadow = '0 0 20px #b2d900';
                                    if (keyboardHandler) { document.removeEventListener('keydown', keyboardHandler); }
                                    this.playCompletionSound();
                                    this.showCongratulationsPopup(imgObj, idx);
                                    puzzleDebug('Puzzle completado por arrastre');
                                    try {
                                        const newPuzzleData = window.puzzleManager && window.puzzleManager.initializePuzzle ? window.puzzleManager.initializePuzzle(imgObj, idx) : { rows: rows, cols: cols, totalPieces: totalPieces };
                                        this.renderDetailView(imgObj, idx, newPuzzleData);
                                    } catch (reErr) { console.error('Error re-rendering detail after drag completion:', reErr); }
                                }, 200);
                            }

                            // Update visuals for the two affected cells (safe re-render)
                            this.updatePuzzleCells(grid, puzzleState, imgObj, rows, cols, currentFromIdx, toIdx);
                        };

                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                    } catch (err) {
                        console.error('Error during drag & drop:', err);
                    }
                });
            } else {
                // Mostrar placeholder para pieza faltante o celda vacía
                if (puzzleState[i] === null) {
                    cell.style.background = '#f5f5f5';
                    cell.style.cursor = 'pointer';
                    
                    // Clicks on empty cells do nothing (movement via drag or keyboard only)
                    cell.addEventListener('click', (ev) => {
                        if (isDragging || Date.now() < suppressClicksUntil) {
                            ev.preventDefault();
                            ev.stopPropagation();
                        }
                        // Intentionally no action on empty cell click
                    });
                }
            }
            
            grid.appendChild(cell);
        }
        
        gridWrapper.appendChild(grid);
        container.appendChild(gridWrapper);

        
        // Manejador de teclado para el puzzle
    keyboardHandler = (e) => {
            // No permitir movimientos de teclado durante un arrastre activo
            if (isDragging) {
                puzzleDebug('Teclado ignorado: arrastre en curso');
                return;
            }
            // Solo procesar si hay una celda seleccionada
            if (selectedIdx === null) return;
            
            let dir = null;
            if (e.key === 'ArrowUp') {
                dir = -cols;
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                dir = cols;
                e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                dir = -1;
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                dir = 1;
                e.preventDefault();
            }
            
            if (dir !== null) {
                const targetIdx = selectedIdx + dir;
                if (targetIdx >= 0 && targetIdx < totalPieces && this.isAdjacent(selectedIdx, targetIdx, cols)) {
                    // Guardar los índices originales antes del intercambio
                    const originalSelectedIdx = selectedIdx;
                    const originalTargetIdx = targetIdx;
                    const fromPieceKB = puzzleState[originalSelectedIdx];
                    const toPieceKB = puzzleState[originalTargetIdx];
                    
                    if (puzzleState[targetIdx] !== null) {
                        // Intercambiar piezas
                        [puzzleState[targetIdx], puzzleState[selectedIdx]] = 
                        [puzzleState[selectedIdx], puzzleState[targetIdx]];
                        puzzleDebug(`Intercambio (teclado): pieza ${fromPieceKB} (celda ${originalSelectedIdx}) ↔ pieza ${toPieceKB} (celda ${originalTargetIdx})`, { fromIdx: originalSelectedIdx, toIdx: originalTargetIdx, fromPiece: fromPieceKB, toPiece: toPieceKB });
                    } else {
                        // Mover a celda vacía
                        puzzleState[targetIdx] = puzzleState[selectedIdx];
                        puzzleState[selectedIdx] = null;
                        puzzleDebug(`Mover (teclado): pieza ${fromPieceKB} de celda ${originalSelectedIdx} a celda ${originalTargetIdx} (vacía)`, { fromIdx: originalSelectedIdx, toIdx: originalTargetIdx, pieceIndex: fromPieceKB });
                    }
                    
                    // Verificar si el puzzle está completo
                    const isCompletedKB = this.checkPuzzleCompletion(puzzleState, totalPieces);
                    // Guardar estado (actualizar siempre completed)
                    const prevCompletedKB = !!imgObj.completed;
                    imgObj.puzzleState = [...puzzleState];
                    imgObj.completed = !!isCompletedKB;
                    if (imgObj.completed && !imgObj.completedAt) {
                        imgObj.completedAt = new Date().toISOString();
                    }
                    if (window.findThePiecesApp) {
                        window.findThePiecesApp.updateImageSilent(idx, { 
                            puzzleState: puzzleState,
                            completed: imgObj.completed,
                            completedAt: imgObj.completedAt
                        });
                    }

                    if (prevCompletedKB && !imgObj.completed) {
                        try {
                            const newPuzzleData = window.puzzleManager && window.puzzleManager.initializePuzzle ? window.puzzleManager.initializePuzzle(imgObj, idx) : { rows: rows, cols: cols, totalPieces: totalPieces };
                            this.renderDetailView(imgObj, idx, newPuzzleData);
                            return;
                        } catch (reErr) {
                            console.error('Error re-rendering after un-complete move (keyboard):', reErr);
                        }
                    }
                    puzzleDebug(`Estado persistido tras teclado. ¿Completado?: ${imgObj.completed ? 'sí' : 'no'}`, { completed: imgObj.completed });
                    
                    // Actualizar las celdas afectadas (usar índices originales)
                    this.updatePuzzleCells(grid, puzzleState, imgObj, rows, cols, originalSelectedIdx, originalTargetIdx);
                    
                    // Actualizar selección visual (la selección se mueve al destino)
                    const selectedElement = grid.children[originalSelectedIdx];
                    const targetElement = grid.children[originalTargetIdx];
                    selectedElement.style.border = '1px solid #ddd';
                    selectedElement.style.zIndex = '';
                    targetElement.style.border = '3px solid #b2d900';
                    targetElement.style.zIndex = '10';
                    selectedIdx = originalTargetIdx;
                    selectedCell = targetElement;
                    
                    // Efecto visual de completado
                    if (isCompletedKB) {
                        setTimeout(() => {
                            grid.style.animation = 'pulse 0.5s ease-in-out 3';
                            grid.style.boxShadow = '0 0 20px #b2d900';
                            // Remover listener cuando se completa
                            document.removeEventListener('keydown', keyboardHandler);
                            
                                    // Reproducir sonido y mostrar popup de felicitación
                                    this.playCompletionSound();
                                    this.showCongratulationsPopup(imgObj, idx);
                                    puzzleDebug('Puzzle completado por teclado');
                                    try {
                                        const newPuzzleData = window.puzzleManager && window.puzzleManager.initializePuzzle ? window.puzzleManager.initializePuzzle(imgObj, idx) : { rows: rows, cols: cols, totalPieces: totalPieces };
                                        this.renderDetailView(imgObj, idx, newPuzzleData);
                                    } catch (reErr) {
                                        console.error('Error re-rendering detail after completion popup (keyboard):', reErr);
                                    }
                        }, 200);
                    }
                }
            }
        };
        
        // Agregar listener de teclado (remover cualquier listener previo)
        if (window.currentKeyboardHandler) {
            document.removeEventListener('keydown', window.currentKeyboardHandler);
        }
        window.currentKeyboardHandler = keyboardHandler;
        document.addEventListener('keydown', keyboardHandler);
        
        // Mensaje de estado
    const statusMsg = document.createElement('div');
    statusMsg.id = 'puzzle-status-msg';
        statusMsg.style.textAlign = 'center';
        statusMsg.style.color = '#888';
        statusMsg.style.fontSize = '14px';
        statusMsg.style.marginTop = '16px';
        statusMsg.style.maxWidth = '600px';
        
    if (imgObj.completed) {
            statusMsg.textContent = '🎉 Puzzle completed! Well done!';
            statusMsg.style.color = '#b2d900';
            statusMsg.style.fontWeight = 'bold';
        } else if (collected.length === totalPieces) {
            statusMsg.innerHTML = '🧩 All pieces collected!<br><small style="color: #666;">Click on pieces to select them and move them using arrow keys ↑↓←→.</small>';
            statusMsg.style.color = '#ff9100';
        } else {
            statusMsg.textContent = `🔍 Collect more pieces by browsing websites. ${totalPieces - collected.length} pieces remaining.`;
        }
        
        container.appendChild(statusMsg);
    }

    // Verificar si el puzzle está completo
    checkPuzzleCompletion(puzzleState, totalPieces) {
        if (!puzzleState || puzzleState.length !== totalPieces) return false;
        
        // Verificar que todas las piezas están en su posición correcta
        for (let i = 0; i < totalPieces; i++) {
            if (puzzleState[i] !== i) {
                return false;
            }
        }
        return true;
    }

    // Función para colocar piezas en posiciones aleatorias que no resuelvan el puzzle
    placePiecesRandomly(puzzleState, piecesToPlace, totalPieces) {
        // Crear una lista de posiciones vacías
        const emptyPositions = [];
        for (let i = 0; i < totalPieces; i++) {
            if (puzzleState[i] === null) {
                emptyPositions.push(i);
            }
        }

        // Mezclar las posiciones vacías aleatoriamente
        for (let i = emptyPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [emptyPositions[i], emptyPositions[j]] = [emptyPositions[j], emptyPositions[i]];
        }

        // Colocar cada pieza en una posición aleatoria
        piecesToPlace.forEach((pieceIdx, index) => {
            if (index < emptyPositions.length) {
                const position = emptyPositions[index];
                
                // Solo colocar si la posición NO resuelve el puzzle (pieza != posición)
                if (pieceIdx !== position) {
                    puzzleState[position] = pieceIdx;
                } else {
                    // Si la posición resolvería el puzzle, buscar otra posición
                    let alternativeFound = false;
                    for (let i = index + 1; i < emptyPositions.length; i++) {
                        const altPos = emptyPositions[i];
                        if (pieceIdx !== altPos) {
                            // Intercambiar posiciones
                            puzzleState[altPos] = pieceIdx;
                            emptyPositions[i] = position;
                            alternativeFound = true;
                            break;
                        }
                    }
                    
                    // Si no se encontró alternativa, colocar en cualquier posición libre
                    if (!alternativeFound) {
                        puzzleState[position] = pieceIdx;
                    }
                }
            }
        });
    }

    // Función para verificar si dos celdas son adyacentes
    isAdjacent(a, b, cols) {
        const ax = a % cols, ay = Math.floor(a / cols);
        const bx = b % cols, by = Math.floor(b / cols);
        return (Math.abs(ax - bx) + Math.abs(ay - by)) === 1;
    }

    // Actualizar celdas específicas del puzzle sin re-renderizar todo
    updatePuzzleCells(grid, puzzleState, imgObj, rows, cols, fromIdx, toIdx) {
        const fromCell = grid.children[fromIdx];
        const toCell = grid.children[toIdx];
        
        // Obtener el contenido visual de ambas celdas
        const fromCanvas = fromCell.querySelector('canvas');
        const toCanvas = toCell.querySelector('canvas');
        
        // Intercambiar el contenido visual
        if (fromCanvas && toCanvas) {
            // Intercambio: ambas celdas tienen canvas
            const fromParent = fromCanvas.parentNode;
            const toParent = toCanvas.parentNode;
            const fromNextSibling = fromCanvas.nextSibling;
            const toNextSibling = toCanvas.nextSibling;
            
            // Intercambiar los canvas
            toParent.insertBefore(fromCanvas, toNextSibling);
            fromParent.insertBefore(toCanvas, fromNextSibling);
            
        } else if (fromCanvas && !toCanvas) {
            // Mover de origen a destino (destino estaba vacío)
            toCell.appendChild(fromCanvas);
            toCell.style.background = '#f0f8ff';
            toCell.style.cursor = 'grab';
            
            // Origen queda vacío
            fromCell.style.background = '#f5f5f5';
            fromCell.style.cursor = 'pointer';
            
        } else if (!fromCanvas && toCanvas) {
            // Mover de destino a origen (origen estaba vacío)
            fromCell.appendChild(toCanvas);
            fromCell.style.background = '#f0f8ff';
            fromCell.style.cursor = 'grab';
            
            // Destino queda vacío
            toCell.style.background = '#f5f5f5';
            toCell.style.cursor = 'pointer';
        }
    }

    // Función para reproducir sonido de completado
    playCompletionSound() {
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

    // Función para mostrar popup de felicitación
    showCongratulationsPopup(imgObj, idx) {
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

        // Verificar si ya se publicó en Instagram o está bloqueada
        const alreadyPublished = imgObj.publishedToInstagram || false;
        const isBlocked = imgObj.instagramBlocked || false;
        
        popup.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
            <h2 style="margin: 0 0 10px 0; font-size: 28px;">Congratulations!</h2>
            <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">You've completed the puzzle!</p>
            <div style="margin-bottom: 20px;">
                ${alreadyPublished ? 
                    `<p style="margin: 0 0 15px 0; font-size: 14px; color: #22d07a;">✅ Successfully shared on Instagram!</p>
                    ${imgObj.instagramPermalink ? 
                        `<a href="${imgObj.instagramPermalink}" target="_blank" style="
                            display: inline-block;
                            background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);
                            color: white;
                            text-decoration: none;
                            padding: 10px 20px;
                            border-radius: 25px;
                            font-size: 14px;
                            font-weight: bold;
                            margin: 0 10px 15px 0;
                            transition: transform 0.3s ease;
                        ">
                            📱 View on Instagram
                        </a>` : ''
                    }
                    <button id="skip-upload" style="
                        background: rgba(255,255,255,0.2);
                        border: 2px solid white;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 25px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.3s ease;
                        margin: 20px auto 0 auto;
                        display: block;
                    ">
                        Close
                    </button>` :
                    isBlocked ?
                    // If the image is blocked, show a friendly non-retry message.
                    // If we have a stored Instagram failure message, surface it for the user.
                    (imgObj.instagramFailureMessage ?
                        `
                        <p style="margin: 0 0 15px 0; font-size: 14px; color: #ff6b6b;">⚠️ We couldn't share your puzzle on Instagram</p>
                        <p style="margin: 0 0 12px 0; font-size: 13px; color: rgba(255,255,255,0.95); line-height: 1.4;">Instagram message:</p>
                        <div style="margin: 0 0 12px 0; padding: 12px; background: rgba(0,0,0,0.12); color: #ffdede; border-radius: 8px; font-size: 13px; word-wrap: break-word; text-align: left;">
                            ${String(imgObj.instagramFailureMessage).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                        </div>
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: rgba(255,255,255,0.8);">This image cannot be uploaded to Instagram and further attempts will not succeed.</p>
                        <button id="skip-upload" style="
                            background: rgba(255,255,255,0.2);
                            border: 2px solid white;
                            color: white;
                            padding: 10px 20px;
                            border-radius: 25px;
                            cursor: pointer;
                            font-size: 14px;
                            transition: all 0.3s ease;
                            margin: 20px auto 0 auto;
                            display: block;
                        ">
                            Close
                        </button>
                        ` :
                        `
                        <p style="margin: 0 0 15px 0; font-size: 14px; color: #ff6b6b;">⚠️ This image cannot be shared on Instagram</p>
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.4;">Content was flagged as inappropriate during moderation</p>
                        ${imgObj.instagramModerationCategories && imgObj.instagramModerationCategories.length > 0 ? 
                            `<p style="margin: 0 0 15px 0; font-size: 11px; color: rgba(255,255,255,0.6); font-style: italic; word-wrap: break-word;">Categories: ${imgObj.instagramModerationCategories.join(', ')}</p>` : 
                            `<div style="margin-bottom: 15px;"></div>`
                        }
                        <button id="skip-upload" style="
                            background: rgba(255,255,255,0.2);
                            border: 2px solid white;
                            color: white;
                            padding: 10px 20px;
                            border-radius: 25px;
                            cursor: pointer;
                            font-size: 14px;
                            transition: all 0.3s ease;
                            margin: 20px auto 0 auto;
                            display: block;
                        ">
                            Close
                        </button>
                        `)
                    :
                    `<p style="margin: 0 0 15px 0; font-size: 14px;">Would you like to share your completed puzzle on Instagram?</p>
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: white; cursor: pointer;">
                            <input type="checkbox" id="customize-caption" style="cursor: pointer;">
                            <span>Customize caption text</span>
                        </label>
                    </div>
                    <div id="caption-container" style="display: none; margin-bottom: 15px;">
                        <textarea id="custom-caption" placeholder="🧩 Write your custom Instagram caption here...\n\nYou can include emojis, hashtags, and mentions!\nMax 2000 characters." maxlength="2000" style="
                            width: 100%;
                            height: 100px;
                            padding: 12px;
                            border-radius: 8px;
                            border: 1px solid rgba(255,255,255,0.3);
                            background: rgba(255,255,255,0.1);
                            color: white;
                            font-size: 14px;
                            resize: vertical;
                            font-family: Arial, sans-serif;
                            line-height: 1.4;
                        "></textarea>
                        <div style="text-align: right; font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 8px;">
                            <span id="char-count">0</span>/2000 characters
                        </div>
                    </div>
                    <div id="upload-status" style="margin-bottom: 15px; text-align: center; font-size: 14px;"></div>
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
                        ">
                            📸 Share on Instagram
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
                        ">
                            Maybe later
                        </button>
                    </div>`
                }
            </div>
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
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(popup);

        // Ensure the scramble button exists under the .detail-title (in case the grid was rendered before completion)
        try {
            const existing = document.getElementById('scramble-button');
            const titleEl = document.querySelector('.detail-title');
            if (titleEl && !existing) {
                const totalPiecesLocal = (imgObj.puzzleState && imgObj.puzzleState.length) ? imgObj.puzzleState.length : (this.calculatePuzzleDimensions(imgObj).totalPieces || 0);
                const titleScramble = document.createElement('button');
                titleScramble.id = 'scramble-button';
                titleScramble.textContent = 'Scramble pieces';
                titleScramble.title = 'Randomize all collected pieces and mark the puzzle as not completed so you can solve it again.';
                titleScramble.setAttribute('aria-label', 'Scramble pieces');
                titleScramble.style.cssText = `
                    background: linear-gradient(180deg, #ffffff 0%, #f6f6f6 100%);
                    color: #333;
                    border: 1px solid #dcdcdc;
                    padding: 8px 14px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 13px;
                    margin: 8px auto 12px auto;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                    transition: transform 0.12s ease, box-shadow 0.12s ease;
                    display: inline-block;
                `;

                titleScramble.addEventListener('mouseenter', () => {
                    titleScramble.style.transform = 'translateY(-1px)';
                    titleScramble.style.boxShadow = '0 4px 10px rgba(0,0,0,0.08)';
                });
                titleScramble.addEventListener('mouseleave', () => {
                    titleScramble.style.transform = '';
                    titleScramble.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                });

                titleScramble.addEventListener('click', async () => {
                    titleScramble.disabled = true;
                    const originalText = titleScramble.textContent;
                    titleScramble.textContent = 'Scrambling...';

                    const pieces = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces.slice() : [];
                    const newState = new Array(totalPiecesLocal).fill(null);
                    if (pieces.length > 0) {
                        this.placePiecesRandomly(newState, pieces, totalPiecesLocal);
                    }

                    imgObj.puzzleState = newState;
                    imgObj.completed = false;
                    if (window.findThePiecesApp && typeof window.findThePiecesApp.updateImageSilent === 'function') {
                        try {
                            await window.findThePiecesApp.updateImageSilent(idx, { puzzleState: newState, completed: false });
                        } catch (err) {
                            console.warn('updateImageSilent failed:', err);
                            window.storageManager && window.storageManager.saveImages && window.storageManager.saveImages(window.allImages);
                        }
                    } else {
                        window.storageManager && window.storageManager.saveImages && window.storageManager.saveImages(window.allImages);
                    }

                    // Close popup then re-render detail view
                    popup.style.animation = 'popup-disappear 0.3s ease-in forwards';
                    setTimeout(() => {
                        if (popup.parentNode) popup.parentNode.removeChild(popup);
                        try {
                            const newPuzzleData = window.puzzleManager && window.puzzleManager.initializePuzzle ? window.puzzleManager.initializePuzzle(imgObj, idx) : { rows: 0, cols: 0, totalPieces: totalPiecesLocal };
                            this.renderDetailView(imgObj, idx, newPuzzleData);
                        } catch (renderErr) {
                            console.error('Error rendering detail after scramble from popup helper:', renderErr);
                        }
                    }, 300);
                });

                titleEl.parentNode && titleEl.parentNode.insertBefore(titleScramble, titleEl.nextSibling);
            }
        } catch (err) {
            console.error('Error ensuring scramble button under title from popup:', err);
        }

    // Popup no longer renders a scramble button; the scramble control is shown under the puzzle's .detail-title

        // Manejar botones
        const uploadBtn = popup.querySelector('#upload-instagram');
        const skipBtn = popup.querySelector('#skip-upload');
        const statusDiv = popup.querySelector('#upload-status');

        // Manejar personalización de caption
        const customizeCheckbox = popup.querySelector('#customize-caption');
        const captionContainer = popup.querySelector('#caption-container');
        const customCaptionTextarea = popup.querySelector('#custom-caption');
        const charCountSpan = popup.querySelector('#char-count');

        if (customizeCheckbox && captionContainer) {
            customizeCheckbox.addEventListener('change', () => {
                if (customizeCheckbox.checked) {
                    captionContainer.style.display = 'block';
                    if (customCaptionTextarea) {
                        customCaptionTextarea.focus();
                    }
                } else {
                    captionContainer.style.display = 'none';
                }
            });
        }

        if (customCaptionTextarea && charCountSpan) {
            customCaptionTextarea.addEventListener('input', () => {
                const length = customCaptionTextarea.value.length;
                charCountSpan.textContent = length;
                
                // Cambiar color si se acerca al límite
                if (length > 1800) {
                    charCountSpan.style.color = '#ff6b6b';
                } else if (length > 1500) {
                    charCountSpan.style.color = '#ffd93d';
                } else {
                    charCountSpan.style.color = 'rgba(255,255,255,0.7)';
                }
            });

            // Prevenir propagación de eventos de teclado mientras se escribe
            customCaptionTextarea.addEventListener('keydown', (e) => {
                e.stopPropagation();
            });

            customCaptionTextarea.addEventListener('keyup', (e) => {
                e.stopPropagation();
            });

            customCaptionTextarea.addEventListener('keypress', (e) => {
                e.stopPropagation();
            });
        }

        // Funcionalidad de botones
        if (uploadBtn && !isBlocked) {
            uploadBtn.addEventListener('click', () => {
                this.handleInstagramUpload(imgObj, idx, statusDiv, popup, uploadBtn, skipBtn, customizeCheckbox, customCaptionTextarea);
            });
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                popup.style.animation = 'popup-disappear 0.3s ease-in forwards';
                setTimeout(() => {
                    if (popup.parentNode) {
                        popup.parentNode.removeChild(popup);
                    }
                }, 300);
            });
        }
    }

    // Función para manejar la subida a Instagram
    async handleInstagramUpload(imgObj, idx, statusDiv, popup, uploadBtn, skipBtn, customizeCheckbox, customCaptionTextarea) {
        let result = null;
        try {
            if (uploadBtn) uploadBtn.disabled = true;
            if (uploadBtn) uploadBtn.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span> Uploading...';
            if (statusDiv) statusDiv.textContent = 'Preparing image...';

            // Generar imagen del puzzle completado
            const puzzleImageBase64 = await this.generatePuzzleImage(imgObj, idx);
            console.log('Generated image size:', puzzleImageBase64.length, 'characters');

            if (statusDiv) statusDiv.textContent = 'Uploading to Instagram...';

            // Asegurar que tengamos las fechas necesarias
            let addedDate, completedDate;
            
            // Usar date o addedAt para la fecha de adición
            if (imgObj.date) {
                addedDate = new Date(imgObj.date);
            } else if (imgObj.addedAt) {
                addedDate = new Date(imgObj.addedAt);
            } else {
                // Fallback: usar fecha actual
                addedDate = new Date();
                console.warn('No date found for image, using current date');
            }
            
            // Usar completedAt si existe, si no usar la fecha de adición
            if (imgObj.completedAt) {
                completedDate = new Date(imgObj.completedAt);
            } else {
                // Fallback: usar la fecha de adición
                completedDate = addedDate;
                console.warn('No completedAt found for image, using added date');
            }

            // Obtener dimensiones del puzzle
            const puzzleData = window.puzzleManager.calculatePuzzleDimensions(imgObj);
            const { rows, cols, totalPieces } = puzzleData;
            
            // Verificar si hay caption personalizado
            let customCaption = null;
            if (customizeCheckbox && customizeCheckbox.checked && customCaptionTextarea && customCaptionTextarea.value.trim()) {
                customCaption = customCaptionTextarea.value.trim();
            }
            
            const puzzleInfo = {
                addedAt: addedDate.toISOString(),
                completedAt: completedDate.toISOString(),
                dimensions: `${cols}x${rows}`,
                totalPieces: totalPieces,
                imageUrl: imgObj.src,
                customCaption: customCaption
            };

            // Enviar al Worker de CloudFlare
            const response = await fetch('https://findthepieces-igproxy.jmtdev0.workers.dev/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageBase64: puzzleImageBase64,
                    puzzleInfo: puzzleInfo
                })
            });
            if (typeof response !== 'undefined') {
                console.log('[Instagram Upload] Worker response status:', response.status);
            }
            try {
                result = await response.json();
            } catch (jsonError) {
                console.log('[Instagram Upload] Error parsing JSON:', jsonError);
                result = null;
            }
            if (typeof result !== 'undefined' && result !== null) {
                console.log('[Instagram Upload] Worker response body:', result);
            }
            // First, check if the worker returned a nested Instagram-level failure
            if (result && result.instagram && result.instagram.success !== true) {
                const ig = result.instagram;
                const igMessage = ig.error_user_msg || ig.error || ig.message || result.message || result.error || 'Failed to publish to Instagram';
                console.log('[Instagram Upload] Instagram reported failure:', igMessage, ig);

                // Special handling for content moderation failures reported by Instagram
                if (ig.error === 'Content moderation failed' && ig.moderation) {
                    // Mark image as permanently blocked and persist moderation categories
                    imgObj.instagramBlocked = true;
                    const categories = ig.moderation.imageModeration?.categories || [];
                    imgObj.instagramModerationCategories = categories;
                    if (window.findThePiecesApp) {
                        window.findThePiecesApp.updateImageSilent(idx, {
                            instagramBlocked: true,
                            instagramModerationCategories: categories
                        });
                    }
                    // Throw so the existing catch block handles closing/re-opening the popup
                    const categoriesText = categories.length > 0 ? categories.join(', ') : 'inappropriate content';
                    throw new Error(`Content moderation failed: Image was flagged as ${categoriesText} and cannot be published to Instagram`);
                } else {
                    // Generic Instagram-level failure: persist failure message, mark blocked (non-retriable)
                    imgObj.instagramBlocked = true;
                    imgObj.instagramFailureMessage = ig.error_user_msg || ig.error || ig.message || result.message || result.error || 'Failed to publish to Instagram';
                    if (window.findThePiecesApp) {
                        window.findThePiecesApp.updateImageSilent(idx, {
                            instagramBlocked: true,
                            instagramFailureMessage: imgObj.instagramFailureMessage
                        });
                    }

                    console.log('[Instagram Upload] Persisted instagramFailureMessage for image idx', idx, imgObj.instagramFailureMessage);

                    // Reopen the popup in blocked state so user sees the friendly message (close current popup first)
                    if (popup && popup.parentNode) {
                        popup.parentNode.removeChild(popup);
                    }
                    setTimeout(() => {
                        this.showCongratulationsPopup(imgObj, idx);
                    }, 100);
                    return;
                }
            }

            if (response.ok && result && result.success) {
                // Marcar como publicado en Instagram
                imgObj.publishedToInstagram = true;
                if (result.instagram && result.instagram.permalink) {
                    imgObj.instagramPermalink = result.instagram.permalink;
                }
                if (window.findThePiecesApp) {
                    window.findThePiecesApp.updateImageSilent(idx, {
                        publishedToInstagram: true,
                        instagramPermalink: result.instagram?.permalink || null
                    });
                }
                // Cerrar el popup actual
                if (popup && popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
                // Volver a mostrar el popup con el estado actualizado
                setTimeout(() => {
                    this.showCongratulationsPopup(imgObj, idx);
                }, 100);
                return;
            } else {
                if (result && result.instagram && result.instagram.error === "Content moderation failed" && result.instagram.moderation) {
                    console.log('[Instagram Upload] Moderation error:', result.instagram.moderation);
                    // Marcar imagen como permanentemente bloqueada para Instagram
                    if (result.instagram.permanentlyBlocked) {
                        imgObj.instagramBlocked = true;
                        // Guardar las categorías de moderación
                        const categories = result.instagram.moderation.imageModeration?.categories || [];
                        imgObj.instagramModerationCategories = categories;
                        if (window.findThePiecesApp) {
                            window.findThePiecesApp.updateImageSilent(idx, {
                                instagramBlocked: true,
                                instagramModerationCategories: categories
                            });
                        }
                    }
                } else {
                    console.log('[Instagram Upload] Error:', result ? (result.error || result.instagram?.error || 'Upload failed') : 'No result from worker');
                }
                if (result && result.instagram && result.instagram.error === "Content moderation failed" && result.instagram.moderation) {
                    const categories = result.instagram.moderation.imageModeration?.categories || [];
                    const categoriesText = categories.length > 0 ? categories.join(', ') : 'inappropriate content';
                    throw new Error(`Content moderation failed: Image was flagged as ${categoriesText} and cannot be published to Instagram`);
                } else {
                    throw new Error(result ? (result.error || result.instagram?.error || 'Upload failed') : 'No response from worker');
                }
            }
        } catch (error) {
            console.log('[Instagram Upload] Catch error:', error);
            
            // Verificar si es un error de moderación de contenido
            if (error.message && error.message.includes('Content moderation failed')) {
                // Marcar imagen como permanentemente bloqueada
                imgObj.instagramBlocked = true;
                
                // Intentar extraer categorías del mensaje de error
                let categories = [];
                const match = error.message.match(/flagged as (.+?) and cannot be published/);
                if (match) {
                    const categoriesText = match[1].trim();
                    categories = categoriesText.split(',').map(cat => cat.trim());
                }
                imgObj.instagramModerationCategories = categories;
                
                if (window.findThePiecesApp) {
                    window.findThePiecesApp.updateImageSilent(idx, {
                        instagramBlocked: true,
                        instagramModerationCategories: categories
                    });
                }
            }
            
            if (!statusDiv) {
                console.log('[Instagram Upload] statusDiv no existe, no se puede mostrar el error al usuario');
            } else {
                const style = window.getComputedStyle(statusDiv);
                console.log('[Instagram Upload] statusDiv existe. display:', style.display, 'visibility:', style.visibility);
            }
            if (statusDiv) {
                statusDiv.innerHTML = `<div style="color: #f44336; margin: 10px 0; padding: 10px; background: rgba(244, 67, 54, 0.1); border-radius: 6px;">❌ Error: ${error.message}</div>`;
            }
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '📸 Share on Instagram';
            }
            
            // Si la imagen fue marcada como bloqueada permanentemente, cerrar y reabrir popup
            if (imgObj.instagramBlocked) {
                const popup = document.getElementById('congratulations-popup');
                if (popup && popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
                // Volver a mostrar el popup con el estado actualizado
                setTimeout(() => {
                    this.showCongratulationsPopup(imgObj, idx);
                }, 100);
            }
        }
    }

    // Función para generar imagen del puzzle completado
    async generatePuzzleImage(imgObj, idx) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Configurar tamaño del canvas
            const maxWidth = 1080;
            const maxHeight = 1080;
            const aspect = imgObj.width / imgObj.height;
            
            let canvasWidth, canvasHeight;
            if (aspect > 1) {
                canvasWidth = maxWidth;
                canvasHeight = Math.round(maxWidth / aspect);
            } else {
                canvasHeight = maxHeight;
                canvasWidth = Math.round(maxHeight * aspect);
            }
            
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            
            // Cargar y dibujar la imagen original
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
                
                // Convertir a base64
                const dataURL = canvas.toDataURL('image/jpeg', 0.9);
                const base64 = dataURL.split(',')[1];
                resolve(base64);
            };
            img.src = imgObj.src;
        });
    }

    // Renderizar una sola celda del puzzle
    renderSingleCell(cell, pieceIdx, collected, imgObj, rows, cols, cellW, cellH, forceRender = false) {
        // Limpiar contenido de la celda
        cell.innerHTML = '';
        
        // Verificar si la pieza debe mostrarse (está en collected o se forza el renderizado)
        const shouldShow = pieceIdx !== null && (collected.includes(pieceIdx) || forceRender);
        
        if (shouldShow) {
            
            // Mostrar pieza del puzzle
            const pieceImg = document.createElement('canvas');
            pieceImg.width = cellW * 2; // Mejor resolución
            pieceImg.height = cellH * 2;
            pieceImg.style.width = '100%';
            pieceImg.style.height = '100%';
            pieceImg.style.cursor = 'grab';
            
            const ctx = pieceImg.getContext('2d');
            const img = new Image();
            // Tag canvas with the piece index for debug/tests
            try { pieceImg.dataset.pieceIndex = String(pieceIdx); } catch (_) {}
            img.onload = () => {
                const col = pieceIdx % cols;
                const row = Math.floor(pieceIdx / cols);
                const srcW = img.naturalWidth;
                const srcH = img.naturalHeight;
                const srcPieceW = srcW / cols;
                const srcPieceH = srcH / rows;
                const sx = col * srcPieceW;
                const sy = row * srcPieceH;
                
                ctx.drawImage(img, sx, sy, srcPieceW, srcPieceH, 0, 0, cellW * 2, cellH * 2);
            };
            img.src = imgObj.src;
            
            cell.appendChild(pieceImg);
            cell.style.background = '#f0f8ff';
            cell.style.cursor = 'grab';
        } else {
            // Mostrar placeholder para pieza faltante o celda vacía
            cell.style.background = '#f5f5f5';
            cell.style.cursor = 'pointer';
        }
    }

    // Renderizar mensaje de puzzle vacío
    renderEmptyPuzzleMessage(container) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.padding = '40px 20px';
        emptyMsg.style.color = '#666';
        emptyMsg.style.fontSize = '16px';
        emptyMsg.style.lineHeight = '1.6';
        emptyMsg.innerHTML = `
            <div style="margin-bottom: 20px; font-size: 48px;">🧩</div>
            <div style="font-weight: 600; margin-bottom: 12px; color: #ff9100;">Ready to start this puzzle!</div>
            <div style="margin-bottom: 8px;">Pieces will appear here as you find them.</div>
            <div style="font-size: 14px; color: #888;">Look for puzzle pieces on web pages and click them to collect!</div>
        `;
        container.appendChild(emptyMsg);
    }

    // Renderizar metadatos de la imagen
    renderImageMetadata(imgObj) {
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
        this.previewContainer.appendChild(meta);
    }

    // Limpiar popups obsoletos
    cleanupObsoletePopups() {
        const congratulationsPopup = document.getElementById('congratulations-popup');
        if (congratulationsPopup) {
            congratulationsPopup.style.animation = 'popup-disappear 0.3s ease-in forwards';
            setTimeout(() => {
                if (congratulationsPopup.parentNode) {
                    congratulationsPopup.parentNode.removeChild(congratulationsPopup);
                }
            }, 300);
        }
    }

    // Formatear fecha de imagen
    formatImageDate(imgObj) {
        if (imgObj.completedAt) {
            return `Completed: ${new Date(imgObj.completedAt).toLocaleDateString()}`;
        } else if (imgObj.addedAt) {
            return `Added: ${new Date(imgObj.addedAt).toLocaleDateString()}`;
        } else if (imgObj.date) {
            return `Added: ${new Date(imgObj.date).toLocaleDateString()}`;
        }
        return 'Recently added';
    }

    // Convertir valor numérico de frecuencia a texto descriptivo
    getFrequencyText(value) {
        const numValue = parseInt(value);
        if (numValue <= 5) return 'Always';
        if (numValue <= 15) return 'Very often';
        if (numValue <= 30) return 'Often';
        if (numValue <= 50) return 'Sometimes';
        if (numValue <= 70) return 'Rarely';
        if (numValue <= 85) return 'Very rarely';
        return 'Almost never';
    }

    // Crear botón de eliminar
    createDeleteButton(imgObj, idx) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete this image';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que se abra el detalle
            this.showDeleteConfirmation(imgObj, idx);
        });
        return deleteBtn;
    }

    // Mostrar popup de confirmación de eliminación
    showDeleteConfirmation(imgObj, idx) {
        const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces : [];
        const { rows, cols } = this.calculatePuzzleDimensions(imgObj);
        const totalPieces = rows * cols;
        const progressText = imgObj.completed ? 
            'This puzzle is completed.' : 
            `You have collected ${collected.length}/${totalPieces} pieces.`;

        // Crear modal de confirmación
        const modal = document.createElement('div');
        modal.className = 'modal delete-modal show';
        modal.innerHTML = `
            <div class="modal-content delete-confirmation">
                <div class="delete-header">
                    <span class="delete-icon">⚠️</span>
                    <h3>Delete Puzzle</h3>
                </div>
                <div class="delete-message">
                    <p><strong>Are you sure you want to delete "${imgObj.name}"?</strong></p>
                    <p class="progress-warning">${progressText}</p>
                    <p class="warning-text">This action cannot be undone. All progress will be lost.</p>
                </div>
                <div class="delete-actions">
                    <button class="cancel-btn">Cancel</button>
                    <button class="confirm-delete-btn">Delete</button>
                </div>
            </div>
        `;

        // Event listeners
        const cancelBtn = modal.querySelector('.cancel-btn');
        const confirmBtn = modal.querySelector('.confirm-delete-btn');

        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => document.body.removeChild(modal), 200);
        });

        confirmBtn.addEventListener('click', () => {
            // Eliminar imagen usando la API centralizada
            if (window.findThePiecesApp) {
                window.findThePiecesApp.removeImage(idx);
            }
            modal.classList.remove('show');
            setTimeout(() => document.body.removeChild(modal), 200);
        });

        // Cerrar con ESC o click fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cancelBtn.click();
            }
        });

        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', escHandler);
            }
        });

        document.body.appendChild(modal);
    }

    // Agregar nueva pieza al puzzle actual en tiempo real
    addPieceToCurrentPuzzle(pieceIndex) {
        if (!window.puzzleManager || !window.puzzleManager.isViewingPuzzle) {
            console.warn('addPieceToCurrentPuzzle: Not viewing a puzzle');
            return;
        }
        
        const imgObj = window.puzzleManager.currentImageObj;
        const idx = window.puzzleManager.currentImageIndex;
        
        if (!imgObj) {
            console.warn('addPieceToCurrentPuzzle: No current image object');
            return;
        }
        
        // Buscar el grid actual del puzzle
        const currentGrid = document.getElementById('puzzle-grid');
        if (!currentGrid) return;
        
        // Obtener estado actual del puzzle
        let puzzleState = imgObj.puzzleState || [];
        const { rows, cols } = window.puzzleManager.calculatePuzzleDimensions(imgObj);
        const totalPieces = rows * cols;
        
        // Inicializar puzzleState si está vacío
        if (puzzleState.length !== totalPieces) {
            puzzleState = new Array(totalPieces).fill(null);
        }
        
        // Verificar si la pieza ya está en el puzzle
        if (puzzleState.includes(pieceIndex)) {
            return;
        }
        
        // Encontrar una posición vacía aleatoria que no resuelva el puzzle
        const emptyPositions = [];
        for (let i = 0; i < puzzleState.length; i++) {
            if (puzzleState[i] === null) {
                emptyPositions.push(i);
            }
        }
        
        if (emptyPositions.length === 0) {
            return;
        }
        
        // Encontrar una posición que no resuelva el puzzle
        let targetPosition = null;
        for (let pos of emptyPositions) {
            if (pos !== pieceIndex) { // No colocar en la posición correcta
                targetPosition = pos;
                break;
            }
        }
        
        // Si todas las posiciones resuelven el puzzle, usar la primera disponible
        if (targetPosition === null && emptyPositions.length > 0) {
            targetPosition = emptyPositions[0];
        }
        
        if (targetPosition !== null) {
            // Actualizar el estado del puzzle
            puzzleState[targetPosition] = pieceIndex;
            
            // Guardar cambios
            if (window.findThePiecesApp) {
                window.findThePiecesApp.updateImageSilent(idx, { puzzleState: puzzleState });
            }
            
            // Actualizar la celda visual
            const targetCell = currentGrid.children[targetPosition];
            
            if (targetCell) {
                // Obtener dimensiones de la celda de manera más robusta
                const cellRect = targetCell.getBoundingClientRect();
                const cellWidth = parseInt(targetCell.style.width) || cellRect.width || 100;
                const cellHeight = parseInt(targetCell.style.height) || cellRect.height || 100;
                
                this.renderSingleCell(targetCell, pieceIndex, imgObj.collectedPieces, imgObj, rows, cols, 
                    cellWidth, cellHeight, true); // Forzar renderizado de la nueva pieza
                
                // Añadir efecto visual de nueva pieza
                targetCell.style.animation = 'pulse 0.5s ease-in-out';
                setTimeout(() => {
                    targetCell.style.animation = '';
                }, 500);
                
            } else {
                console.error(`UIManager: Could not find target cell at position ${targetPosition}`);
            }
            
            // Actualizar el título del puzzle con el nuevo conteo
            const collected = imgObj.collectedPieces || [];
            
            // Buscar el título del puzzle de manera más específica
            let puzzleTitle = document.querySelector('.detail-title');
            if (!puzzleTitle) {
                // Fallback: buscar en el contenedor del grid
                puzzleTitle = currentGrid.parentElement.querySelector('div');
            }
            
            if (puzzleTitle && puzzleTitle.textContent.includes('Puzzle:')) {
                puzzleTitle.textContent = `Puzzle: ${rows}×${cols} (${collected.length}/${totalPieces} pieces)`;
            } else {
                console.warn('Could not find puzzle title element to update');
            }
            
            // Also update the puzzle status message so the remaining count is shown in real time
            try {
                const statusEl = document.getElementById('puzzle-status-msg');
                if (statusEl) {
                    if (imgObj.completed) {
                        statusEl.textContent = '🎉 Puzzle completed! Well done!';
                        statusEl.style.color = '#b2d900';
                        statusEl.style.fontWeight = 'bold';
                    } else if ((collected.length) === totalPieces) {
                        statusEl.innerHTML = '🧩 All pieces collected!<br><small style="color: #666;">Click on pieces to select them and move them using arrow keys ↑↓←→.</small>';
                        statusEl.style.color = '#ff9100';
                        statusEl.style.fontWeight = '';
                    } else {
                        statusEl.textContent = `🔍 Collect more pieces by browsing websites. ${totalPieces - (collected.length)} pieces remaining.`;
                        statusEl.style.color = '#888';
                        statusEl.style.fontWeight = '';
                    }
                }
            } catch (statusErr) {
                console.warn('Failed to update puzzle status element:', statusErr);
            }

            console.log(`Piece ${pieceIndex} added to position ${targetPosition} in current puzzle`);
        }
    }
}

// Instancia global del manager de UI
window.uiManager = new UIManager();
