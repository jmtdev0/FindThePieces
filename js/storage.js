// storage.js
// Manejo de almacenamiento de datos

class StorageManager {
    constructor() {
        this.storageKey = 'findThePixelsImages';
    this._pendingImagesRef = null;
    this._saveScheduled = false;
    this._lastSaveStart = 0;
    this._lastSaveEnd = 0;
    this._saveQueueId = 0;
    this._activeOverlay = null;
    this._overlayShownAt = 0;
    this._overlayMinMs = 350; // mínimo visible para percepción
    }

    // Crear overlay si no existe
    _ensureOverlay(text = 'Saving…') {
        if (this._activeOverlay) return;
        try {
            const existing = document.getElementById('global-storage-loader');
            if (existing) {
                this._activeOverlay = existing; return;
            }
            const overlay = document.createElement('div');
            overlay.id = 'global-storage-loader';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.40);backdrop-filter:blur(1px);font-family:system-ui,Arial,sans-serif;';
            overlay.innerHTML = `
              <div style="background:#111;padding:20px 26px;border-radius:14px;color:#fff;display:flex;align-items:center;gap:14px;box-shadow:0 6px 28px rgba(0,0,0,0.35);min-width:220px;">
                <div style="width:22px;height:22px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:ftp-spin 0.9s linear infinite"></div>
                <div style="font-size:14px;font-weight:600;letter-spacing:0.4px;">${text}</div>
              </div>
              <style>@keyframes ftp-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}</style>`;
            document.body.appendChild(overlay);
            this._activeOverlay = overlay;
            this._overlayShownAt = (performance && performance.now) ? performance.now() : Date.now();
        } catch(e) { /* no-op */ }
    }

    _hideOverlay() {
        if (!this._activeOverlay) return;
        const now = (performance && performance.now) ? performance.now() : Date.now();
        const elapsed = now - this._overlayShownAt;
        const remove = () => {
            try { if (this._activeOverlay && this._activeOverlay.parentNode) this._activeOverlay.parentNode.removeChild(this._activeOverlay); } catch(_) {}
            this._activeOverlay = null;
        };
        if (elapsed < this._overlayMinMs) {
            setTimeout(remove, this._overlayMinMs - elapsed);
        } else {
            remove();
        }
    }

    // Guardar imágenes en el almacenamiento
    saveImages(allImages, { showLoader = false } = {}) {
    // Allow callers to suppress the overlay for the next save by setting _suppressNextOverlay
    const effectiveShowLoader = (!!showLoader) && !this._suppressNextOverlay;
    // Clear the one-time suppress flag after reading it
    if (this._suppressNextOverlay) this._suppressNextOverlay = false;
    if (effectiveShowLoader) this._ensureOverlay();
        chrome.storage.local.set({ [this.storageKey]: allImages }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving images:', chrome.runtime.lastError);
            } else {
                const end = (performance && performance.now) ? performance.now() : Date.now();
                this._lastSaveEnd = end;
                const dur = (end - this._lastSaveStart).toFixed(2);
                console.log(`[Storage] Images saved successfully in ${dur} ms (queueId=${this._saveQueueId})`);
            }
            if (effectiveShowLoader) this._hideOverlay();
        });
    }

    // Schedule a non-blocking save using requestIdleCallback or a timeout fallback.
    scheduleSave(allImages, { timeout = 1200, immediate = false } = {}) {
        // If immediate requested, flush synchronously (still async under the hood but without deferral)
        if (immediate) {
            this._pendingImagesRef = allImages;
            this._saveQueueId++;
            this._lastSaveStart = (performance && performance.now) ? performance.now() : Date.now();
            // For immediate flushes, respect any suppress flag set on the manager
            const immediateShow = !this._suppressNextOverlay;
            if (this._suppressNextOverlay) this._suppressNextOverlay = false;
            this.saveImages(this._pendingImagesRef, { showLoader: immediateShow });
            return Promise.resolve('immediate');
        }

        this._pendingImagesRef = allImages; // Always keep latest reference

        if (this._saveScheduled) {
            // Already scheduled; will use latest reference
            return Promise.resolve('batched');
        }

        this._saveScheduled = true;
        this._saveQueueId++;
        const queueId = this._saveQueueId;
        const startSchedule = (performance && performance.now) ? performance.now() : Date.now();
        console.log(`[Storage] scheduleSave queued (queueId=${queueId})`);

        return new Promise((resolve) => {
            const runner = () => {
                this._saveScheduled = false;
                // Capture reference at execution time
                const imgs = this._pendingImagesRef;
                this._lastSaveStart = (performance && performance.now) ? performance.now() : Date.now();
                console.log(`[Storage] executing deferred save (queueId=${queueId}) after ${(this._lastSaveStart - startSchedule).toFixed(2)} ms defer`);
                try {
                    this.saveImages(imgs, { showLoader: true });
                } finally {
                    resolve('saved');
                }
            };
            if (typeof requestIdleCallback === 'function') {
                try {
                    requestIdleCallback(runner, { timeout });
                } catch (_) { setTimeout(runner, 0); }
            } else {
                setTimeout(runner, 0);
            }
        });
    }

    flushPending() {
        if (!this._pendingImagesRef) return;
        console.log('[Storage] flushPending invoked');
        this.scheduleSave(this._pendingImagesRef, { immediate: true });
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

    // Log approximate sizes of stored images (callable from console)
    async logStoredImagesSizes() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([this.storageKey], (res) => {
                    try {
                        const arr = (res && res[this.storageKey]) || [];
                        if (!Array.isArray(arr) || arr.length === 0) {
                            console.log('[Storage] No images stored.');
                            resolve({ totalBytes: 0, images: [] });
                            return;
                        }

                        const imagesReport = arr.map((img, idx) => {
                            try {
                                const s = JSON.stringify(img || {});
                                // approximate byte length using UTF-16 -> UTF-8 heuristic: count code units and assume 1-3 bytes per unit
                                const bytes = new Blob([s]).size;
                                return { index: idx, name: img && img.name ? img.name : `image#${idx}`, bytes };
                            } catch (e) {
                                return { index: idx, name: img && img.name ? img.name : `image#${idx}`, bytes: 0 };
                            }
                        });

                        const total = imagesReport.reduce((acc, it) => acc + (it.bytes || 0), 0);
                        console.table(imagesReport.map(r => ({ index: r.index, name: r.name, sizeBytes: r.bytes, sizeMB: (r.bytes / (1024*1024)).toFixed(3) })));
                        console.log(`[Storage] Total approx size: ${total} bytes (${(total / (1024*1024)).toFixed(3)} MB)`);
                        resolve({ totalBytes: total, images: imagesReport });
                    } catch (e) {
                        console.error('[Storage] Error calculating sizes:', e);
                        resolve({ totalBytes: 0, images: [] });
                    }
                });
            } catch (err) {
                console.error('[Storage] Error reading storage for sizes:', err);
                resolve({ totalBytes: 0, images: [] });
            }
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
// Convenience alias: call from console as `await window.logStoredImagesSizes()`
try {
    if (!window.logStoredImagesSizes) {
        window.logStoredImagesSizes = function() {
            if (window.storageManager && typeof window.storageManager.logStoredImagesSizes === 'function') {
                return window.storageManager.logStoredImagesSizes();
            }
            console.warn('[Storage] storageManager not available in this context');
            return Promise.resolve({ totalBytes: 0, images: [] });
        };
    }
} catch (e) {
    // ignore in restricted contexts
}
