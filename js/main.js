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
            frequency: newFrequency
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
                window.MessageSystem.notifyFrequencyChange(idx, updates.frequency);
            }
            
            if (updates.collectedPieces !== undefined) {
                window.MessageSystem.notifyPiecesUpdate(idx, updates.collectedPieces);
            }
            
            if (updates.puzzleState !== undefined) {
                window.MessageSystem.notifyPuzzleStateUpdate(idx, updates.puzzleState);
            }
            
            if (updates.completed === true && !oldImage.completed) {
                window.MessageSystem.notifyPuzzleCompleted(idx);
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
