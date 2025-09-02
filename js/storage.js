// storage.js
// Manejo de almacenamiento de datos

class StorageManager {
    constructor() {
        this.storageKey = 'findThePixelsImages';
    }

    // Guardar imágenes en el almacenamiento
    saveImages(allImages) {
        chrome.storage.local.set({ [this.storageKey]: allImages }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving images:', chrome.runtime.lastError);
            } else {
                console.log('Images saved successfully');
            }
        });
    }

    // Cargar imágenes del almacenamiento
    async loadImages() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Error loading images:', chrome.runtime.lastError);
                    resolve([]);
                } else {
                    const images = result[this.storageKey] || [];
                    console.log('Loaded images:', images.length);
                    resolve(images);
                }
            });
        });
    }

    // Limpiar almacenamiento
    clearStorage() {
        chrome.storage.local.remove([this.storageKey], () => {
            if (chrome.runtime.lastError) {
                console.error('Error clearing storage:', chrome.runtime.lastError);
            } else {
                console.log('Storage cleared successfully');
            }
        });
    }
}

// Instancia global del manager de almacenamiento
window.storageManager = new StorageManager();
