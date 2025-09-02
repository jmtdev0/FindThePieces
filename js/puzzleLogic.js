// puzzleLogic.js
// Lógica principal del puzzle y juego

class PuzzleManager {
    constructor() {
        this.selectedCollectedIdx = null;
        this.rotationState = [];
        this.collectedPuzzleState = [];
        this.currentImageObj = null;
        this.currentIdx = null;
        this.currentImageIndex = null; // Índice de la imagen actual
        this.grid = null;
        this.totalPieces = 0;
        this.rows = 0;
        this.cols = 0;
        this.isViewingPuzzle = false; // Flag para saber si se está viendo un puzzle
    }

    // Inicializar puzzle con una imagen
    initializePuzzle(imgObj, idx) {
        this.currentImageObj = imgObj;
        this.currentIdx = idx;
        this.currentImageIndex = idx;
        this.isViewingPuzzle = true;
        
        // Calcular dimensiones del puzzle basado en la dificultad
        const difficulty = document.getElementById('puzzleDifficulty').value;
        const { rows, cols } = this.calculatePuzzleDimensions(imgObj, difficulty);
        
        this.rows = rows;
        this.cols = cols;
        this.totalPieces = rows * cols;
        
        // Inicializar estados
        this.initializePuzzleStates(imgObj);
        
        return { rows, cols, totalPieces: this.totalPieces };
    }

    // Calcular dimensiones del puzzle
    calculatePuzzleDimensions(imgObj, difficulty) {
        // Si la imagen ya tiene dimensiones guardadas, usarlas
        if (imgObj.puzzleRows && imgObj.puzzleCols) {
            return { rows: imgObj.puzzleRows, cols: imgObj.puzzleCols };
        }

        // Por compatibilidad con la UI, usar siempre N x N según dificultad
        const size = parseInt(difficulty) || 3;
        return { rows: size, cols: size };
    }

    // Inicializar estados del puzzle
    initializePuzzleStates(imgObj) {
        if (Array.isArray(imgObj.puzzleState) && imgObj.puzzleState.length === this.totalPieces) {
            this.collectedPuzzleState = [...imgObj.puzzleState];
        } else {
            this.collectedPuzzleState = new Array(this.totalPieces).fill(null);
            const collected = Array.isArray(imgObj.collectedPieces) ? imgObj.collectedPieces : [];
            collected.forEach((pieceIdx, index) => {
                if (pieceIdx < this.totalPieces) {
                    this.collectedPuzzleState[pieceIdx] = pieceIdx;
                }
            });
        }

        if (Array.isArray(imgObj.rotationState) && imgObj.rotationState.length === this.totalPieces) {
            this.rotationState = [...imgObj.rotationState];
        } else {
            this.rotationState = new Array(this.totalPieces).fill(0);
        }
    }

    // Verificar si dos posiciones son adyacentes
    isAdjacent(a, b) {
        const ax = a % this.cols;
        const ay = Math.floor(a / this.cols);
        const bx = b % this.cols;
        const by = Math.floor(b / this.cols);
        return (Math.abs(ax - bx) + Math.abs(ay - by)) === 1;
    }

    // Rotar pieza
    rotatePiece(pieceIndex) {
        if (pieceIndex < 0 || pieceIndex >= this.totalPieces) return false;
        
        this.rotationState[pieceIndex] = ((this.rotationState[pieceIndex] || 0) + 1) % 4;
        
        // Guardar el estado
        this.saveCurrentState();
        
        return true;
    }

    // Mover piezas (intercambiar)
    movePieces(fromIndex, toIndex) {
        if (!this.isAdjacent(fromIndex, toIndex)) return false;
        if (this.collectedPuzzleState[toIndex] === null) return false;
        
        // Intercambiar piezas en el estado
        const temp = this.collectedPuzzleState[fromIndex];
        this.collectedPuzzleState[fromIndex] = this.collectedPuzzleState[toIndex];
        this.collectedPuzzleState[toIndex] = temp;
        
        // Intercambiar rotaciones también
        const tempRotation = this.rotationState[fromIndex];
        this.rotationState[fromIndex] = this.rotationState[toIndex];
        this.rotationState[toIndex] = tempRotation;
        
        // Guardar el estado
        this.saveCurrentState();
        
        return true;
    }

    // Verificar si el puzzle está completo
    checkPuzzleCompletion() {
        for (let i = 0; i < this.totalPieces; i++) {
            if (this.collectedPuzzleState[i] !== i || this.rotationState[i] !== 0) {
                return false;
            }
        }
        return true;
    }

    // Verificar si hay suficientes piezas para completar
    hasAllPieces() {
        const collected = this.collectedPuzzleState.filter(piece => piece !== null);
        return collected.length === this.totalPieces;
    }

    // Guardar estado actual
    saveCurrentState() {
        if (this.currentImageObj && this.currentIdx !== null) {
            this.currentImageObj.puzzleState = [...this.collectedPuzzleState];
            this.currentImageObj.rotationState = [...this.rotationState];
            
            // Verificar si se completó el puzzle
            if (this.hasAllPieces() && this.checkPuzzleCompletion()) {
                if (!this.currentImageObj.completed) {
                    this.currentImageObj.completed = true;
                    this.currentImageObj.completedAt = new Date().toISOString();
                    this.onPuzzleCompleted();
                }
            }
            
            window.storageManager.saveImages(window.allImages);
        }
    }

    // Callback cuando se completa el puzzle
    onPuzzleCompleted() {
        console.log('¡Puzzle completado!');
        
        // Reproducir sonido de completado
        if (window.audioManager) {
            window.audioManager.playCompletionSound();
        }
        
        // Mostrar popup de felicitación
        if (window.celebrationManager) {
            window.celebrationManager.showCongratulationsPopup(this.currentImageObj, this.currentIdx);
        }
    }

    // Manejar controles de teclado
    handleKeyControls(e) {
        // No procesar si se está escribiendo en el textarea
        if (e.target && e.target.id === 'custom-caption') {
            return;
        }
        
        if (this.selectedCollectedIdx === null) return;
        
        if (e.key.toLowerCase() === 'r') {
            this.rotatePiece(this.selectedCollectedIdx);
            this.renderGrid();
            return;
        }

        let dir = null;
        if (e.key === 'ArrowUp') {
            dir = -this.cols;
            e.preventDefault();
        }
        else if (e.key === 'ArrowDown') {
            dir = this.cols;
            e.preventDefault();
        }
        else if (e.key === 'ArrowLeft') dir = -1;
        else if (e.key === 'ArrowRight') dir = 1;

        if (dir !== null) {
            const targetIdx = this.selectedCollectedIdx + dir;
            if (targetIdx >= 0 && targetIdx < this.totalPieces && this.isAdjacent(this.selectedCollectedIdx, targetIdx)) {
                if (this.movePieces(this.selectedCollectedIdx, targetIdx)) {
                    this.selectedCollectedIdx = targetIdx;
                    this.renderGrid();
                }
            }
        }
    }

    // Renderizar grid (esta función se implementará en el uiManager)
    renderGrid() {
        if (window.uiManager && this.grid) {
            window.uiManager.renderPuzzleGrid(this);
        }
    }

    // Limpiar event listeners
    cleanup() {
        document.removeEventListener('keydown', this.handleKeyControls.bind(this));
        this.isViewingPuzzle = false;
        this.currentImageIndex = null;
    }

    // Agregar nueva pieza al puzzle en tiempo real
    addNewPieceToPuzzle(pieceIndex) {
        if (!this.isViewingPuzzle || !this.currentImageObj) return;
        
        console.log(`PuzzleManager: Adding new piece ${pieceIndex} to current puzzle`);
        
        // Verificar que el UI Manager tenga el método para agregar la pieza
        if (window.uiManager && window.uiManager.addPieceToCurrentPuzzle) {
            window.uiManager.addPieceToCurrentPuzzle(pieceIndex);
        }
    }
}

// Instancia global del manager de puzzle
window.puzzleManager = new PuzzleManager();
