// fileUpload.js
// Manejo de carga de archivos y drag & drop

class FileUploadManager {
    constructor() {
        this.modal = document.getElementById('uploadModal');
        this.uploadArea = this.modal.querySelector('.upload-area');
        this.imageInput = document.getElementById('imageInput');
    // Configuración de compresión
    this.TARGET_MAX_MB = 4; // Límite objetivo para ofrecer compresión
    this.TARGET_MAX_BYTES = this.TARGET_MAX_MB * 1024 * 1024;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Modal handling
        document.getElementById('chooseImagesBtn').addEventListener('click', () => {
            // Reset file input so selecting the same file again will fire a change event
            try { this.imageInput.value = ''; } catch (_) {}
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

    async handleFiles(files) {
        // Allowed extensions and mime types
        const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
        const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

        const allowedFiles = [];
        const rejectedFiles = [];

        for (const file of files) {
            const name = (file && file.name) ? file.name : '';
            const dot = name.lastIndexOf('.');
            const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
            if (ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIMES.has(file.type)) {
                allowedFiles.push(file);
            } else {
                // If the file has an image/ mime but an uncommon extension, still reject to be strict
                rejectedFiles.push(name || file.type || 'Unknown file');
            }
        }

        if (rejectedFiles.length > 0) {
            alert(`These files are not supported and were skipped:\n${rejectedFiles.join('\n')}\n\nAllowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`);
        }

        if (allowedFiles.length === 0) {
            // Nothing to process
            return;
        }

        // No hard size limit anymore; every allowed image will be offered compression when applicable
        const candidates = allowedFiles;

        for (const file of candidates) {
            try {
                const processed = await this.processFileWithOptionalCompression(file);
                if (!processed) continue; // User cancelled or error

                const { dataURL, width, height, meta } = processed;

                const imageData = {
                    name: file.name,
                    src: dataURL,
                    date: new Date().toISOString(),
                    addedAt: new Date().toISOString(),
                    width,
                    height,
                    collectedPieces: [],
                    completed: false,
                    publishedToInstagram: false,
                    puzzle: true,
                    frequency: 10,
                    // Metadatos de compresión para diagnóstico
                    originalBytes: meta.originalBytes,
                    finalBytes: meta.finalBytes,
                    compressed: meta.compressed,
                    compressionQuality: meta.quality || null,
                    compressionFormat: meta.format || null
                };

                const puzzleDifficulty = document.getElementById('puzzleDifficulty');
                const difficulty = puzzleDifficulty ? puzzleDifficulty.value : 'easy';
                const { rows, cols } = this.calculatePuzzleDimensions(imageData, difficulty);
                imageData.puzzleRows = rows;
                imageData.puzzleCols = cols;

                console.log(`FileUpload: Image "${imageData.name}" (${(imageData.finalBytes/1024/1024).toFixed(2)} MB) - difficulty: ${difficulty}, puzzle: ${rows}x${cols}${imageData.compressed ? ' (compressed)' : ''}`);

                if (window.findThePiecesApp) {
                    window.findThePiecesApp.addImage(imageData);
                }
            } catch (err) {
                console.error('FileUpload: error processing file', file.name, err);
            }
        }

        // Cerrar modal y limpiar input
        this.modal.classList.remove('show');
        try { this.imageInput.value = ''; } catch (_) {}
    }

    async processFileWithOptionalCompression(file) {
        const originalBytes = file.size;
        const originalMB = originalBytes / 1024 / 1024;
        // SVGs are vector and not suitable for the canvas-based JPEG compression flow.
        // Treat SVG as non-compressible here (we will store as-is).
        const isSVG = file.type === 'image/svg+xml' || (file.name && file.name.toLowerCase().endsWith('.svg'));
        let needsCompression = !isSVG && originalBytes > this.TARGET_MAX_BYTES;

        if (needsCompression) {
            // Show the in-modal English prompt instead of a native confirm()
            const accept = await this.showCompressionPrompt(file, originalMB);
            if (!accept) return null;
        }

        // Leer a DataURL
        const dataURL = await this.readFileAsDataURL(file);
        const img = await this.loadImage(dataURL);

        if (!needsCompression) {
            return {
                dataURL,
                width: img.width,
                height: img.height,
                meta: { originalBytes, finalBytes: originalBytes, compressed: false }
            };
        }

        // Comprimir a ~TARGET_MAX_BYTES manteniendo dimensiones
        const compressionResult = await this.compressImageToTarget(img, this.TARGET_MAX_BYTES);
        return {
            dataURL: compressionResult.dataURL,
            width: img.width,
            height: img.height,
            meta: {
                originalBytes,
                finalBytes: compressionResult.bytes,
                compressed: true,
                quality: compressionResult.quality,
                format: compressionResult.format
            }
        };
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    loadImage(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataURL;
        });
    }

    blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    // Show the in-modal compression prompt (English) and resolve true if user accepts compression
    showCompressionPrompt(file, originalMB) {
        return new Promise((resolve) => {
            const warning = document.getElementById('uploadLargeWarning');
            const warningText = document.getElementById('uploadLargeWarningText');
            const compressBtn = document.getElementById('uploadCompressBtn');
            const skipBtn = document.getElementById('uploadSkipBtn');

            if (!warning || !warningText || !compressBtn || !skipBtn) {
                // Fallback to native confirm if modal elements are missing
                const ok = confirm(`The image "${file.name}" is ${originalMB.toFixed(2)} MB. Convert to a ~${this.TARGET_MAX_MB} MB version?`);
                resolve(!!ok);
                return;
            }

            warningText.textContent = `The image "${file.name}" is ${originalMB.toFixed(2)} MB. Large images may impact extension and browser performance. Do you want to convert it to a smaller (~${this.TARGET_MAX_MB} MB) image while keeping the original dimensions?`;
            warning.style.display = 'block';

            const cleanup = () => {
                warning.style.display = 'none';
                compressBtn.removeEventListener('click', onCompress);
                skipBtn.removeEventListener('click', onSkip);
            };

            const onCompress = () => { cleanup(); resolve(true); };
            const onSkip = () => { cleanup(); resolve(false); };

            compressBtn.addEventListener('click', onCompress);
            skipBtn.addEventListener('click', onSkip);
        });
    }

    async compressImageToTarget(img, targetBytes) {
        // Usamos JPEG siempre para maximizar compresión visual razonable
        const format = 'image/jpeg';
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Si una versión calidad 0.95 ya cabe, usarla directamente
        const initialBlob = await new Promise(res => canvas.toBlob(res, format, 0.95));
        if (!initialBlob) throw new Error('No se pudo generar blob inicial');
        if (initialBlob.size <= targetBytes * 1.05) {
            return {
                dataURL: await this.blobToDataURL(initialBlob),
                bytes: initialBlob.size,
                quality: 0.95,
                format
            };
        }

        let low = 0.4; // calidad mínima aceptable (ajustable)
        let high = 0.95;
        let best = { blob: initialBlob, quality: 0.95, diff: Math.abs(initialBlob.size - targetBytes) };
        const maxIterations = 8;
        const lowerBound = targetBytes * 0.85; // tolerancia inferior
        const upperBound = targetBytes * 1.05; // tolerancia superior

        for (let i = 0; i < maxIterations; i++) {
            const mid = (low + high) / 2;
            const blob = await new Promise(res => canvas.toBlob(res, format, mid));
            if (!blob) break;
            const size = blob.size;
            const diff = Math.abs(size - targetBytes);
            if (diff < best.diff) {
                best = { blob, quality: mid, diff };
            }

            if (size > upperBound) {
                // Demasiado grande -> reducir calidad
                high = mid;
            } else if (size < lowerBound) {
                // Demasiado pequeño -> podemos aumentar calidad
                low = mid;
            } else {
                // Dentro de tolerancia
                best = { blob, quality: mid, diff };
                break;
            }
        }

        return {
            dataURL: await this.blobToDataURL(best.blob),
            bytes: best.blob.size,
            quality: parseFloat(best.quality.toFixed(3)),
            format
        };
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
