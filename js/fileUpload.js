// fileUpload.js
// Manejo de carga de archivos y drag & drop

class FileUploadManager {
    constructor() {
        this.modal = document.getElementById('uploadModal');
        this.uploadArea = this.modal.querySelector('.upload-area');
        this.imageInput = document.getElementById('imageInput');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Modal handling
        document.getElementById('chooseImagesBtn').addEventListener('click', () => {
            this.modal.classList.add('show');
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.modal.classList.remove('show');
            }
        });

        // Drag and drop handling
        this.uploadArea.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        // File input handling
        this.imageInput.addEventListener('change', (event) => {
            const files = Array.from(event.target.files);
            this.handleFiles(files);
        });
    }

    handleDragEnter(e) {
        e.preventDefault();
        this.uploadArea.style.borderColor = '#ff9100';
        this.uploadArea.style.background = 'rgba(255,145,0,0.1)';
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.style.borderColor = '#b2d900';
        this.uploadArea.style.background = 'transparent';
    }

    handleDragOver(e) {
        e.preventDefault();
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.style.borderColor = '#b2d900';
        this.uploadArea.style.background = 'transparent';
        
        const files = Array.from(e.dataTransfer.files);
        this.handleFiles(files);
    }

    handleFiles(files) {
        const validFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (validFiles.length === 0) {
            alert('Please select valid image files.');
            return;
        }

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = {
                    name: file.name,
                    src: e.target.result,
                    date: new Date().toISOString(),
                    addedAt: new Date().toISOString(),
                    width: 0,
                    height: 0,
                    collectedPieces: [],
                    completed: false,
                    publishedToInstagram: false,
                    puzzle: true,
                    frequency: 10
                };

                // Determinar dimensiones de la imagen
                const img = new Image();
                img.onload = () => {
                    imageData.width = img.width;
                    imageData.height = img.height;
                    
                    // Calcular dimensiones del puzzle según la dificultad actual
                    const puzzleDifficulty = document.getElementById('puzzleDifficulty');
                    const difficulty = puzzleDifficulty ? puzzleDifficulty.value : 'easy';
                    const { rows, cols } = this.calculatePuzzleDimensions(imageData, difficulty);
                    
                    console.log(`FileUpload: Image "${imageData.name}" - difficulty: ${difficulty}, dimensions: ${rows}x${cols}`);
                    
                    // Guardar las dimensiones del puzzle
                    imageData.puzzleRows = rows;
                    imageData.puzzleCols = cols;
                    
                    // Añadir imagen usando la API centralizada
                    if (window.findThePiecesApp) {
                        window.findThePiecesApp.addImage(imageData);
                    }
                    
                    // Cerrar modal
                    this.modal.classList.remove('show');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Calcular dimensiones del puzzle basándose en la dificultad
    calculatePuzzleDimensions(imgObj, difficulty) {
    // Forzar N x N por defecto, a menos que la imagen tenga dimensiones explícitas
    const size = parseInt(difficulty) || 3; // Convertir a número
    return { rows: size, cols: size };
    }
}

// Instancia global del manager de carga de archivos
window.fileUploadManager = new FileUploadManager();
