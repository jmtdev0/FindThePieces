// celebrations.js
// Manejo de celebraciones y popups de felicitación

class CelebrationManager {
    constructor() {
        this.currentPopup = null;
        this.initializeStyles();
    }

    // Inicializar estilos CSS para las animaciones
    initializeStyles() {
        if (!document.getElementById('celebration-styles')) {
            const style = document.createElement('style');
            style.id = 'celebration-styles';
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
    }

    // Mostrar popup de felicitación
    showCongratulationsPopup(imgObj, idx) {
        // Eliminar popup existente si existe
        this.removeExistingPopup();
        
        const popup = this.createPopupElement(imgObj);
        document.body.appendChild(popup);
        this.currentPopup = popup;

        // Configurar event listeners
        this.setupEventListeners(popup, imgObj, idx);
    }

    // Eliminar popup existente
    removeExistingPopup() {
        const existingPopup = document.getElementById('congratulations-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
    }

    // Crear elemento del popup
    createPopupElement(imgObj) {
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

        popup.innerHTML = this.generatePopupHTML(imgObj);
        return popup;
    }

    // Generar HTML del popup
    generatePopupHTML(imgObj) {
        const alreadyPublished = imgObj.publishedToInstagram || false;
        
        return `
            <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
            <h2 style="margin: 0 0 10px 0; font-size: 28px;">Congratulations!</h2>
            <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">You've completed the puzzle!</p>
            
            <div style="margin-bottom: 20px;">
                ${alreadyPublished ? this.generateAlreadyPublishedHTML(imgObj) : this.generateShareOptionsHTML()}
            </div>
            
            <div id="upload-status" style="margin-top: 15px; font-size: 14px; min-height: 20px;"></div>
        `;
    }

    // Generar HTML para puzzle ya publicado
    generateAlreadyPublishedHTML(imgObj) {
        return `
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #FFD700;">✨ Already shared on Instagram!</p>
            ${imgObj.instagramPermalink ? `
                <a href="${imgObj.instagramPermalink}" target="_blank" style="
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
                </a>
            ` : ''}
            <button id="skip-upload" style="
                background: rgba(255,255,255,0.2);
                border: 2px solid white;
                color: white;
                padding: 10px 20px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.3s ease;
                margin: 0 auto;
                display: block;
            ">
                Close
            </button>
        `;
    }

    // Generar HTML para opciones de compartir
    generateShareOptionsHTML() {
        return `
            <p style="margin: 0 0 15px 0; font-size: 14px;">Would you like to share your completed puzzle on Instagram?</p>
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: white; cursor: pointer;">
                    <input type="checkbox" id="customize-caption" style="cursor: pointer;">
                    <span>Customize caption text</span>
                </label>
            </div>
            <div id="caption-container" style="display: none; margin-bottom: 15px;">
                <textarea id="custom-caption" placeholder="🧩 Write your custom Instagram caption here...

You can include emojis, hashtags, and mentions!
Max 2000 characters." maxlength="2000" style="
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
                <style>
                    #custom-caption::placeholder {
                        color: rgba(255,255,255,0.5);
                    }
                </style>
                <div style="text-align: right; font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 8px;">
                    <span id="char-count">0</span>/2000 characters
                </div>
            </div>
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
            </div>
        `;
    }

    // Configurar event listeners del popup
    setupEventListeners(popup, imgObj, idx) {
        const uploadBtn = popup.querySelector('#upload-instagram');
        const skipBtn = popup.querySelector('#skip-upload');
        const statusDiv = popup.querySelector('#upload-status');

        // Efectos hover
        this.setupHoverEffects(popup);

        // Manejo de personalización de caption
        this.setupCaptionCustomization(popup);

        // Función para cerrar el popup
        const closePopup = () => {
            popup.style.animation = 'popup-disappear 0.3s ease-in forwards';
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
                this.currentPopup = null;
            }, 300);
        };

        // Función para subir a Instagram
        const uploadToInstagram = async () => {
            if (!window.instagramManager) return;

            try {
                uploadBtn.disabled = true;
                uploadBtn.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span> Uploading...';
                statusDiv.textContent = 'Preparing image...';

                // Obtener caption personalizado si existe
                const customizeCheckbox = popup.querySelector('#customize-caption');
                const customCaptionTextarea = popup.querySelector('#custom-caption');
                let customCaption = null;
                
                if (customizeCheckbox && customizeCheckbox.checked && customCaptionTextarea && customCaptionTextarea.value.trim()) {
                    customCaption = customCaptionTextarea.value.trim();
                }

                statusDiv.textContent = 'Uploading to Instagram...';

                // Subir a Instagram
                const { response, result } = await window.instagramManager.uploadToInstagram(
                    imgObj, 
                    window.puzzleManager, 
                    customCaption
                );

                // Procesar respuesta
                const processResult = window.instagramManager.processInstagramResponse(response, result, imgObj);

                if (processResult.success) {
                    // Éxito - actualizar UI
                    const successMessage = window.instagramManager.createSuccessMessage(processResult.result);
                    
                    uploadBtn.style.background = 'rgba(255,255,255,0.2)';
                    uploadBtn.style.border = '2px solid white';
                    uploadBtn.innerHTML = 'Close';
                    uploadBtn.disabled = false;
                    uploadBtn.removeEventListener('click', uploadToInstagram);
                    uploadBtn.addEventListener('click', closePopup);
                    
                    if (skipBtn) {
                        skipBtn.style.display = 'none';
                    }
                    
                    statusDiv.innerHTML = successMessage;
                } else if (processResult.isModeration) {
                    // Error de moderación
                    const moderationMessage = window.instagramManager.createModerationErrorMessage(processResult.moderation);
                    statusDiv.innerHTML = moderationMessage;
                    uploadBtn.disabled = false;
                    uploadBtn.innerHTML = '📸 Share on Instagram';
                }

            } catch (error) {
                console.error('Error uploading to Instagram:', error);
                
                if (error.message && error.message.includes('moderation')) {
                    return;
                }
                
                statusDiv.innerHTML = `<div style="color: #ff6b6b;">❌ Error: ${error.message}</div>`;
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '📸 Share on Instagram';
            }
        };

        // Configurar event listeners según el estado de publicación
        if (uploadBtn) {
            uploadBtn.addEventListener('click', uploadToInstagram);
        }
        if (skipBtn) {
            skipBtn.addEventListener('click', closePopup);
        }

        // Cerrar con Escape
        const handleEscape = (e) => {
            if (e.target && e.target.id === 'custom-caption') {
                return;
            }
            if (e.key === 'Escape') {
                closePopup();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // Configurar efectos hover
    setupHoverEffects(popup) {
        const uploadBtn = popup.querySelector('#upload-instagram');
        const skipBtn = popup.querySelector('#skip-upload');
        const instagramLink = popup.querySelector('a[href*="instagram.com"]');

        if (uploadBtn) {
            uploadBtn.addEventListener('mouseenter', () => {
                uploadBtn.style.transform = 'scale(1.05)';
            });
            uploadBtn.addEventListener('mouseleave', () => {
                uploadBtn.style.transform = 'scale(1)';
            });
        }

        if (skipBtn) {
            skipBtn.addEventListener('mouseenter', () => {
                skipBtn.style.background = 'rgba(255,255,255,0.3)';
            });
            skipBtn.addEventListener('mouseleave', () => {
                skipBtn.style.background = 'rgba(255,255,255,0.2)';
            });
        }

        if (instagramLink) {
            instagramLink.addEventListener('mouseenter', () => {
                instagramLink.style.transform = 'scale(1.05)';
            });
            instagramLink.addEventListener('mouseleave', () => {
                instagramLink.style.transform = 'scale(1)';
            });
        }
    }

    // Configurar personalización de caption
    setupCaptionCustomization(popup) {
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
    }
}

// Instancia global del manager de celebraciones
window.celebrationManager = new CelebrationManager();
