// ContentScript switch logic
window.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggleContentScript');
    if (!toggle) return;
        // Load state from chrome.storage.local
        if (window.chrome && chrome.storage && chrome.storage.local) {
            console.log('[FTP main] Initializing contentScript switch - reading storage.showPieces');
            chrome.storage.local.get(['showPieces'], (result) => {
                console.log('[FTP main] storage.get showPieces ->', result && result.showPieces);
                if (typeof result.showPieces !== 'undefined') {
                    toggle.checked = !!result.showPieces;
                }
            });
            toggle.addEventListener('change', () => {
                console.log('[FTP main] User toggled contentScriptSwitch ->', toggle.checked);
                chrome.storage.local.set({ showPieces: toggle.checked });
                // Notify content scripts via runtime message (legacy) and via tabs broadcast
                if (window.chrome && chrome.runtime) {
                    console.log('[FTP main] sending runtime message toggleContentScript ->', toggle.checked);
                    chrome.runtime.sendMessage({ type: 'toggleContentScript', enabled: toggle.checked });
                }
                // Also broadcast to all tabs to ensure content scripts receive the toggle
                if (window.MessageSystem && typeof window.MessageSystem.broadcastToContentScripts === 'function') {
                    console.log('[FTP main] broadcasting toggleContentScript to all tabs ->', toggle.checked);
                    window.MessageSystem.broadcastToContentScripts({ type: 'toggleContentScript', enabled: toggle.checked });
                }
            });
        }
});
// main.js
// Archivo principal simplificado que coordina todos los módulos

// Variables globales
let allImages = [];

// Sistema de comunicación con contentScript
const MessageSystem = {
    // Enviar mensaje a todos los tabs activos
    broadcastToContentScripts(message) {
        if (chrome.tabs) {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                        try {
                            const maybePromise = chrome.tabs.sendMessage(tab.id, message, (resp) => {
                                // callback form: if there was an error, chrome.runtime.lastError will be populated
                                if (chrome.runtime && chrome.runtime.lastError) {
                                    // Ignore noisy "Could not establish connection" errors when no receiver exists
                                    // console.debug('[FTP main] sendMessage lastError for tab', tab.id, chrome.runtime.lastError.message);
                                }
                            });

                            // If the API returned a Promise (MV3/service worker), handle rejection gracefully
                            if (maybePromise && typeof maybePromise.then === 'function') {
                                maybePromise.catch((err) => {
                                    // Ignore errors where there is no receiver in the tab
                                    // console.debug('[FTP main] sendMessage promise rejected for tab', tab.id, err && err.message);
                                });
                            }
                        } catch (e) {
                            // Defensive: ignore any synchronous errors
                        }
                    }
                });
            });
        }
    },

    // Notificar cambio de frecuencia
    notifyFrequencyChange(imageIndex, newFrequency) {
        console.log(`Broadcasting frequency change for image ${imageIndex}: ${newFrequency}`);
        this.broadcastToContentScripts({
            type: 'FREQUENCY_CHANGED',
            imageIndex: imageIndex,
            frequency: newFrequency,
            oldFrequency: typeof arguments[2] !== 'undefined' ? arguments[2] : null
        });
    },

    // Notificar cambio en piezas recolectadas
    notifyPiecesUpdate(imageIndex, collectedPieces) {
        console.log(`Broadcasting pieces update for image ${imageIndex}:`, collectedPieces);
        this.broadcastToContentScripts({
            type: 'PIECES_UPDATED',
            imageIndex: imageIndex,
            collectedPieces: collectedPieces
        });
    },

    // Notificar cambio de estado de puzzle
    notifyPuzzleStateUpdate(imageIndex, puzzleState) {
        console.log(`Broadcasting puzzle state update for image ${imageIndex}:`, puzzleState);
        this.broadcastToContentScripts({
            type: 'PUZZLE_STATE_UPDATED',
            imageIndex: imageIndex,
            puzzleState: puzzleState
        });
    },

    // Notificar que una imagen fue completada
    notifyPuzzleCompleted(imageIndex) {
        console.log(`Broadcasting puzzle completion for image ${imageIndex}`);
        this.broadcastToContentScripts({
            type: 'PUZZLE_COMPLETED',
            imageIndex: imageIndex
        });
    },

    // Notificar que se añadió una nueva imagen
    notifyNewImageAdded(imageIndex, imageData) {
        console.log(`Broadcasting new image added: ${imageIndex}`, imageData);
        this.broadcastToContentScripts({
            type: 'NEW_IMAGE_ADDED',
            imageIndex: imageIndex,
            imageData: imageData
        });
    },

    // Notificar que una imagen fue eliminada (para que los contentScripts limpien piezas asociadas)
    notifyImageRemoved(imageIndex) {
        console.log(`Broadcasting image removed: ${imageIndex}`);
        this.broadcastToContentScripts({
            type: 'IMAGE_REMOVED',
            imageIndex: imageIndex
        });
    },

    // Notificar que se recogió una pieza (para removerla de todas las pestañas)
    notifyPieceCollected(imageIndex, pieceIndex) {
        console.log(`Broadcasting piece collected: image ${imageIndex}, piece ${pieceIndex}`);
        this.broadcastToContentScripts({
            type: 'PIECE_COLLECTED_GLOBAL',
            imageIndex: imageIndex,
            pieceIndex: pieceIndex
        });
    }
};

// Hacer MessageSystem disponible globalmente
window.MessageSystem = MessageSystem;

// Sistema de recepción de mensajes desde contentScript
if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Main: Received message from contentScript:', message);
        
        switch (message.type) {
            case 'PIECE_COLLECTED':
                handlePieceCollectedFromContent(message.imageIndex, message.pieceIndex, message.collectedPieces);
                break;
        }
    });
}

// Manejar pieza recogida desde contentScript
function handlePieceCollectedFromContent(imageIndex, pieceIndex, collectedPieces) {
    console.log(`Main: Piece ${pieceIndex} collected for image ${imageIndex}. Total pieces now: ${collectedPieces.length}`, collectedPieces);
    
    // Notificar a todos los contentScripts que esta pieza fue recogida
    // Esto hará que desaparezca de todas las pestañas donde esté visible
    if (window.MessageSystem) {
        window.MessageSystem.notifyPieceCollected(imageIndex, pieceIndex);
    }
    
    // Actualizar la imagen localmente
    if (imageIndex >= 0 && imageIndex < allImages.length) {
        allImages[imageIndex].collectedPieces = collectedPieces;
        window.allImages = allImages;

    try { updateBuyMeVisibility(); } catch (e) {}
        
        console.log(`Main: Updated allImages[${imageIndex}].collectedPieces:`, allImages[imageIndex].collectedPieces);
        
        // Determinar si estamos viendo el puzzle de esta imagen
        const isViewingThisPuzzle = window.puzzleManager && 
                                   window.puzzleManager.isViewingPuzzle && 
                                   window.puzzleManager.currentImageIndex === imageIndex;
        
        const isViewingAnyPuzzle = window.puzzleManager && window.puzzleManager.isViewingPuzzle;
        
        console.log(`Main: isViewingThisPuzzle: ${isViewingThisPuzzle}, isViewingAnyPuzzle: ${isViewingAnyPuzzle}`);
        
        // Si el usuario está viendo el puzzle de esta imagen, agregar la pieza automáticamente
        if (isViewingThisPuzzle) {
            // Actualizar currentImageObj con los datos más recientes
            if (window.puzzleManager && window.puzzleManager.currentImageObj) {
                console.log(`Main: Updating currentImageObj.collectedPieces from`, window.puzzleManager.currentImageObj.collectedPieces, 'to', collectedPieces);
                window.puzzleManager.currentImageObj.collectedPieces = collectedPieces;
            }
            
            // Agregar la nueva pieza al puzzle en una posición aleatoria
            if (window.uiManager) {
                window.uiManager.addPieceToCurrentPuzzle(pieceIndex);
            }
        }
        
        // Siempre actualizar la galería en background para mantener contadores actualizados
        // Esto no afecta la vista actual si se está viendo un puzzle
        if (window.uiManager && window.uiManager.renderPreviews) {
            // Solo renderizar si no estamos viendo un puzzle
            if (!isViewingAnyPuzzle) {
                console.log('Updating gallery view with new piece count');
                window.uiManager.renderPreviews();
            } else {
                // Si estamos viendo un puzzle, actualizar los datos en memoria pero no re-renderizar la galería
                console.log('Puzzle view active, gallery data updated in background');
                // Los contadores se actualizarán cuando el usuario regrese a la galería
            }
        }
    }
}

// Buy-me widget: rounded icon that appears when the user has completed at least one puzzle
let __buyMeWidget = null;
let __buyMeAudio = null;
// Playback rate state for hover acceleration
let __buyMePlaybackRate = 1.0;
const __buyMePlaybackIncrement = 0.25;
const __buyMePlaybackMax = 5.0;
function showBuyMeWidget() {
    try {
    // Do not show the widget while viewing a puzzle
    if (window.puzzleManager && window.puzzleManager.isViewingPuzzle) return;
    if (__buyMeWidget) return;
        const a = document.createElement('a');
        a.id = 'ftp-buyme-widget';
        a.href = 'https://buymeacoffee.com/jmtdev';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.cssText = [
            'position:fixed',
            'right:18px',
            'bottom:18px',
            'width:56px',
            'height:56px',
            'border-radius:50%',
            'overflow:hidden',
            'z-index:10000',
            'box-shadow:0 6px 18px rgba(0,0,0,0.25)',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'background:#fff'
        ].join(';');

        const img = document.createElement('img');
        img.src = chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('icons/buymeacoffee.png') : './icons/buymeacoffee.png';
        img.alt = 'Buy me a coffee';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
        a.appendChild(img);

        // Prepare audio
        try {
            const audioSrc = chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('sounds/buymeabook.mp3') : './sounds/buymeabook.mp3';
            __buyMeAudio = new Audio(audioSrc);
            __buyMeAudio.preload = 'auto';
            __buyMeAudio.loop = false;
        } catch (e) { __buyMeAudio = null; }

        // Play on hover (mouseenter) and stop on mouseleave
        a.addEventListener('mouseenter', () => {
            try {
                if (!__buyMeAudio) return;
                // Use current playback rate, then increment for next hover
                __buyMeAudio.playbackRate = __buyMePlaybackRate;
                __buyMeAudio.currentTime = 0;
                __buyMeAudio.play && __buyMeAudio.play().catch(() => {});
                // Increase for next time, but cap at max
                __buyMePlaybackRate = Math.min(__buyMePlaybackMax, (__buyMePlaybackRate + __buyMePlaybackIncrement));
            } catch (e) {}
        });
        a.addEventListener('mouseleave', () => { try { if (__buyMeAudio) { __buyMeAudio.pause(); __buyMeAudio.currentTime = 0; } } catch (e) {} });

        document.body.appendChild(a);
        __buyMeWidget = a;
    } catch (e) {}
}

function removeBuyMeWidget() {
    try {
        if (__buyMeWidget && __buyMeWidget.parentNode) __buyMeWidget.parentNode.removeChild(__buyMeWidget);
    } catch (e) {}
    __buyMeWidget = null;
    try { if (__buyMeAudio) { __buyMeAudio.pause(); __buyMeAudio = null; } } catch (e) {}
    // Reset playback rate to default when widget removed
    __buyMePlaybackRate = 1.0;
}

function updateBuyMeVisibility() {
    try {
    // If the user is viewing a puzzle, hide the widget (only show in gallery)
    if (window.puzzleManager && window.puzzleManager.isViewingPuzzle) { removeBuyMeWidget(); return; }
    // Check if any image is fully completed (explicit completed flag)
    if (!window.allImages || !Array.isArray(window.allImages)) return;
    const anyCompleted = window.allImages.some(img => !!img && img.completed === true);
    if (anyCompleted) showBuyMeWidget(); else removeBuyMeWidget();
    } catch (e) {}
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('FindThePieces - Inicializando aplicación...');
    
    try {
        // Cargar imágenes del almacenamiento
        allImages = await window.storageManager.loadImages();
        console.log('Imágenes cargadas:', allImages.length);
        
        // Actualizar referencia global
        window.allImages = allImages;
        
        // Renderizar previews iniciales
        window.uiManager.renderPreviews();
    // Update visibility of buy-me widget based on completed puzzles
    try { updateBuyMeVisibility(); } catch (e) {}
        
        // Configurar event listeners globales
        setupGlobalEventListeners();
        
        console.log('Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
    }
});

// Configurar event listeners globales
function setupGlobalEventListeners() {
    // Event listener para cambio de dificultad
    const puzzleDifficulty = document.getElementById('puzzleDifficulty');
    if (puzzleDifficulty) {
        puzzleDifficulty.addEventListener('change', () => {
            // Re-renderizar previews cuando cambie la dificultad
            window.uiManager.renderPreviews();
        });
    }
    
    // Limpiar popups al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.preview-hover-popup') && !e.target.closest('.image-preview img')) {
            window.uiManager.hideAllHoverPopups();
        }
    });
}

// Funciones globales que pueden ser llamadas desde otros módulos
window.findThePiecesApp = {
    // Obtener todas las imágenes
    getAllImages: () => allImages,
    
    // Añadir una nueva imagen
    addImage: (imageData) => {
        const newIndex = allImages.length;
        allImages.push(imageData);
        window.allImages = allImages; // Actualizar referencia global
        window.storageManager.saveImages(allImages);
        window.uiManager.renderPreviews();
        
        // Notificar a todos los contentScripts sobre la nueva imagen
        if (window.MessageSystem) {
            window.MessageSystem.notifyNewImageAdded(newIndex, imageData);
        }
        
        return newIndex; // Retornar índice de la nueva imagen
    },
    
    // Actualizar una imagen específica
    updateImage: (idx, updates) => {
        if (idx >= 0 && idx < allImages.length) {
            Object.assign(allImages[idx], updates);
            window.allImages = allImages; // Actualizar referencia global
            window.storageManager.saveImages(allImages);
            window.uiManager.renderPreviews();
        }
    },
    
    // Actualizar una imagen específica sin re-renderizar la galería
    updateImageSilent: (idx, updates) => {
        if (idx >= 0 && idx < allImages.length) {
            const oldImage = { ...allImages[idx] };
            Object.assign(allImages[idx], updates);
            window.allImages = allImages; // Actualizar referencia global
            window.storageManager.saveImages(allImages);
            
            // Notificar cambios específicos al contentScript
            if (updates.frequency !== undefined && updates.frequency !== oldImage.frequency) {
                window.MessageSystem.notifyFrequencyChange(idx, updates.frequency, oldImage.frequency);
            }
            
            if (updates.collectedPieces !== undefined) {
                window.MessageSystem.notifyPiecesUpdate(idx, updates.collectedPieces);
            }
            
            if (updates.puzzleState !== undefined) {
                window.MessageSystem.notifyPuzzleStateUpdate(idx, updates.puzzleState);
            }
            
            if (updates.completed === true && !oldImage.completed) {
                window.MessageSystem.notifyPuzzleCompleted(idx);
                try { updateBuyMeVisibility(); } catch (e) {}
            }
        }
    },
    
    // Eliminar una imagen
    removeImage: (idx) => {
        if (idx >= 0 && idx < allImages.length) {
            allImages.splice(idx, 1);
            window.allImages = allImages; // Actualizar referencia global
            window.storageManager.saveImages(allImages);
            window.uiManager.renderPreviews();
            // Notify content scripts to remove any pieces belonging to this image
            if (window.MessageSystem) {
                window.MessageSystem.notifyImageRemoved(idx);
            }
            return true;
        }
        return false;
    },
    
    // Limpiar todas las imágenes
    clearAllImages: () => {
        allImages = [];
        window.allImages = allImages; // Actualizar referencia global
        window.storageManager.clearStorage();
        window.uiManager.renderPreviews();
    },
    
    // Re-renderizar la interfaz
    refresh: () => {
        window.uiManager.renderPreviews();
    }
};

// Exponer variables globales para compatibilidad
window.allImages = allImages;

console.log('FindThePieces - Main.js cargado');
