// instagram.js
// Integración con Instagram y manejo de publicaciones

class InstagramManager {
    constructor() {
        this.workerUrl = 'https://findthepieces-igproxy.jmtdev0.workers.dev/';
        // Instagram supported aspect ratios
        this.instagramAspectRatios = {
            minRatio: 0.8, // 4:5 portrait
            maxRatio: 1.91, // 1.91:1 landscape
            square: 1.0 // 1:1 square
        };
    }

    // Check if aspect ratio is supported by Instagram
    isValidAspectRatio(width, height) {
        const ratio = width / height;
        return ratio >= this.instagramAspectRatios.minRatio && ratio <= this.instagramAspectRatios.maxRatio;
    }

    // Get the closest valid aspect ratio for an image
    getClosestValidAspectRatio(width, height) {
        const ratio = width / height;
        
        if (ratio < this.instagramAspectRatios.minRatio) {
            // Too tall, need to make it wider (add padding to sides)
            return { ratio: this.instagramAspectRatios.minRatio, type: 'portrait' };
        } else if (ratio > this.instagramAspectRatios.maxRatio) {
            // Too wide, need to make it taller (add padding to top/bottom)
            return { ratio: this.instagramAspectRatios.maxRatio, type: 'landscape' };
        }
        
        // Already valid
        return { ratio: ratio, type: 'valid' };
    }

    // Generate image with white padding to match Instagram aspect ratio
    async generateImageWithPadding(imgObj, targetRatio) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const originalWidth = imgObj.width;
            const originalHeight = imgObj.height;
            const originalRatio = originalWidth / originalHeight;
            
            let newWidth, newHeight;
            
            if (targetRatio > originalRatio) {
                // Need to add padding to sides
                newHeight = originalHeight;
                newWidth = Math.round(originalHeight * targetRatio);
            } else {
                // Need to add padding to top/bottom
                newWidth = originalWidth;
                newHeight = Math.round(originalWidth / targetRatio);
            }
            
            canvas.width = newWidth;
            canvas.height = newHeight;
            
            const img = new Image();
            img.onload = () => {
                // Fill with white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, newWidth, newHeight);
                
                // Calculate position to center the original image
                const x = (newWidth - originalWidth) / 2;
                const y = (newHeight - originalHeight) / 2;
                
                // Draw the original image centered
                ctx.drawImage(img, x, y, originalWidth, originalHeight);
                
                // Convert to JPG with quality 90
                const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
                resolve({
                    base64,
                    paddedWidth: newWidth,
                    paddedHeight: newHeight,
                    paddingX: x,
                    paddingY: y
                });
            };
            img.src = imgObj.src;
        });
    }

    // Generar imagen del puzzle completado
    async generatePuzzleImage(imgObj, puzzleManager, useAspectRatioCorrection = false) {
        if (useAspectRatioCorrection && !this.isValidAspectRatio(imgObj.width, imgObj.height)) {
            const closestRatio = this.getClosestValidAspectRatio(imgObj.width, imgObj.height);
            return await this.generateImageWithPadding(imgObj, closestRatio.ratio);
        }
        
        return new Promise((resolve) => {
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
                resolve({ base64 });
            };
            img.src = imgObj.src;
        });
    }

    // Subir imagen a Instagram
    async uploadToInstagram(imgObj, puzzleManager, customCaption = null, useAspectRatioCorrection = false) {
        try {
            // Generar imagen del puzzle completado
            const imageResult = await this.generatePuzzleImage(imgObj, puzzleManager, useAspectRatioCorrection);
            const puzzleImageBase64 = imageResult.base64;
            console.log('Generated image size:', puzzleImageBase64.length, 'characters');

            // Preparar información temporal y del puzzle
            console.log('Debug timestamps:', {
                added: imgObj.date,
                completed: imgObj.completedAt,
                wasCompleted: imgObj.completed
            });
            
            if (!imgObj.date || !imgObj.completedAt) {
                throw new Error('Missing timestamp information. Please complete the puzzle again.');
            }
            
            const addedDate = new Date(imgObj.date);
            const completedDate = new Date(imgObj.completedAt);
            const puzzleInfo = {
                addedAt: addedDate.toISOString(),
                completedAt: completedDate.toISOString(),
                dimensions: `${puzzleManager.cols}x${puzzleManager.rows}`,
                totalPieces: puzzleManager.totalPieces,
                imageUrl: imgObj.src,
                customCaption: customCaption
            };

            // Enviar al Worker de CloudFlare
            const response = await fetch(this.workerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageBase64: puzzleImageBase64,
                    puzzleInfo: puzzleInfo
                })
            });

            console.log('Worker response status:', response.status);
            console.log('Worker response headers:', Object.fromEntries(response.headers.entries()));

            const result = await response.json();
            console.log('Worker response body:', result);

            return { response, result };

        } catch (error) {
            console.error('Error uploading to Instagram:', error);
            throw error;
        }
    }

    // Procesar respuesta de Instagram
    processInstagramResponse(response, result, imgObj) {
        // Verificar si la respuesta del Worker es exitosa
        if (response.ok) {
            // Verificar si la subida fue exitosa (tanto Imgur como Instagram)
            if (result.success) {
                // Marcar como publicado en Instagram
                imgObj.publishedToInstagram = true;
                
                // Guardar el permalink si está disponible
                if (result.instagram && result.instagram.permalink) {
                    imgObj.instagramPermalink = result.instagram.permalink;
                }
                
                window.storageManager.saveImages(window.allImages);
                
                return {
                    success: true,
                    result: result
                };
            } else {
                // Error en la subida - verificar si es por moderación
                if (result.instagram && result.instagram.moderation) {
                    return {
                        success: false,
                        isModeration: true,
                        moderation: result.instagram.moderation
                    };
                } else {
                    // Error normal en la subida
                    const errorMsg = result.error || 'Upload failed';
                    throw new Error(errorMsg);
                }
            }
        } else {
            // Error del Worker de CloudFlare
            throw new Error(result.error || `Server error (${response.status})`);
        }
    }

    // Crear mensaje de éxito para Instagram
    createSuccessMessage(result) {
        let successMessage = `<div style="color: #4CAF50; margin-bottom: 15px;">✅ Successfully shared on Instagram!</div>`;
        
        if (result.instagram && result.instagram.permalink) {
            successMessage += `
                <a href="${result.instagram.permalink}" target="_blank" style="
                    display: inline-block;
                    background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);
                    color: white;
                    text-decoration: none;
                    padding: 10px 20px;
                    border-radius: 25px;
                    font-size: 14px;
                    font-weight: bold;
                    margin: 10px 0;
                    transition: transform 0.3s ease;
                ">
                    📱 View on Instagram
                </a>
                <div style="color: #90EE90; font-size: 12px; margin-top: 10px;">
                    Post ID: ${result.instagram.media_id || 'Created'}
                </div>
            `;
        } else if (result.instagram && result.instagram.success) {
            successMessage += `
                <div style="color: #90EE90; font-size: 12px; margin-top: 10px;">
                    Instagram post ID: ${result.instagram.media_id}
                </div>
            `;
        }
        
        return successMessage;
    }

    // Crear mensaje de error de moderación
    createModerationErrorMessage(moderation) {
        let moderationMessage = '';
        
        if (moderation.reason === 'text') {
            moderationMessage = `<div style="color: #ff6b6b; margin-bottom: 10px;">❌ Custom caption was flagged as inappropriate</div>`;
            if (moderation.textModeration && moderation.textModeration.categories.length > 0) {
                moderationMessage += `<div style="color: #ffa726; font-size: 12px;">Flagged categories: ${moderation.textModeration.categories.join(', ')}</div>`;
            }
        } else if (moderation.reason === 'image') {
            moderationMessage = `<div style="color: #ff6b6b; margin-bottom: 10px;">❌ Image content was flagged as inappropriate</div>`;
            if (moderation.imageModeration && moderation.imageModeration.categories.length > 0) {
                moderationMessage += `<div style="color: #ffa726; font-size: 12px;">Flagged categories: ${moderation.imageModeration.categories.join(', ')}</div>`;
            }
        }
        
        moderationMessage += `<div style="color: #90a4ae; font-size: 12px; margin-top: 8px;">Please try with different content that follows Instagram's community guidelines.</div>`;
        
        return moderationMessage;
    }

    // Show aspect ratio warning dialog with preview
    async showAspectRatioDialog(imgObj) {
        return new Promise((resolve) => {
            const ratio = imgObj.width / imgObj.height;
            const closestRatio = this.getClosestValidAspectRatio(imgObj.width, imgObj.height);
            
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: #2a2a2a;
                border-radius: 12px;
                padding: 20px;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                color: white;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                transform: scale(0.9);
                transition: transform 0.3s ease;
            `;
            
            // Generate preview image with padding
            this.generateImageWithPadding(imgObj, closestRatio.ratio).then(imageResult => {
                const previewCanvas = document.createElement('canvas');
                const previewCtx = previewCanvas.getContext('2d');

                // Create a smaller preview (max 400px width)
                const maxPreviewWidth = 400;
                const previewScale = Math.min(maxPreviewWidth / imageResult.paddedWidth, 1);
                previewCanvas.width = Math.round(imageResult.paddedWidth * previewScale);
                previewCanvas.height = Math.round(imageResult.paddedHeight * previewScale);

                const previewImg = new Image();
                previewImg.onload = () => {
                    // Draw the preview onto the canvas
                    previewCtx.fillStyle = '#ffffff';
                    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                    previewCtx.drawImage(
                        previewImg,
                        imageResult.paddingX * previewScale,
                        imageResult.paddingY * previewScale,
                        imgObj.width * previewScale,
                        imgObj.height * previewScale
                    );

                    // Build modal HTML but leave a placeholder for the canvas node
                    modal.innerHTML = `
                        <h3 style="margin: 0 0 15px 0; color: #ff9100;">📐 Aspect Ratio Not Supported</h3>
                        <p style="margin: 0 0 15px 0; color: #ccc; line-height: 1.4;">
                            Your image has an aspect ratio of <strong>${ratio.toFixed(2)}:1</strong>, which is not supported by Instagram.
                        </p>
                        <p style="margin: 0 0 15px 0; color: #ccc; line-height: 1.4;">
                            Instagram supports ratios between <strong>0.8:1</strong> (portrait) and <strong>1.91:1</strong> (landscape).
                        </p>
                        <p style="margin: 0 0 20px 0; color: #b2d900; line-height: 1.4;">
                            We can add white padding to make your image compatible. Here's how it would look:
                        </p>
                        <div style="text-align: center; margin: 20px 0;">
                            <div style="margin-bottom: 10px;">
                                <strong>Preview with white padding:</strong>
                            </div>
                            <div id="preview-canvas-wrapper" style="display: inline-block; border: 2px solid #666; border-radius: 8px; padding: 5px; background: #666;"></div>
                            <div style="margin-top: 10px; font-size: 12px; color: #aaa;">
                                New dimensions: ${imageResult.paddedWidth} × ${imageResult.paddedHeight}
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                            <button id="cancel-upload" style="
                                background: rgba(255, 255, 255, 0.1);
                                border: 2px solid #666;
                                color: white;
                                padding: 12px 20px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.3s ease;
                            ">Cancel</button>
                            <button id="upload-with-padding" style="
                                background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);
                                border: none;
                                color: white;
                                padding: 12px 20px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: bold;
                                transition: all 0.3s ease;
                            ">Upload with Padding</button>
                        </div>
                    `;

                    // Insert the actual canvas node into the placeholder so the bitmap is visible
                    const wrapper = modal.querySelector('#preview-canvas-wrapper');
                    if (wrapper) {
                        // Ensure the canvas displays at its natural size inside the wrapper
                        previewCanvas.style.display = 'block';
                        previewCanvas.style.maxWidth = '100%';
                        previewCanvas.style.height = 'auto';
                        wrapper.appendChild(previewCanvas);
                    }

                    // Add event listeners
                    const cancelBtn = modal.querySelector('#cancel-upload');
                    const uploadBtn = modal.querySelector('#upload-with-padding');

                    cancelBtn.addEventListener('click', () => {
                        overlay.style.opacity = '0';
                        modal.style.transform = 'scale(0.9)';
                        setTimeout(() => {
                            document.body.removeChild(overlay);
                            resolve({ proceed: false });
                        }, 300);
                    });

                    uploadBtn.addEventListener('click', () => {
                        overlay.style.opacity = '0';
                        modal.style.transform = 'scale(0.9)';
                        setTimeout(() => {
                            document.body.removeChild(overlay);
                            resolve({ proceed: true, useCorrection: true });
                        }, 300);
                    });

                    // Add hover effects
                    cancelBtn.addEventListener('mouseenter', () => {
                        cancelBtn.style.background = 'rgba(255, 255, 255, 0.2)';
                        cancelBtn.style.borderColor = '#999';
                    });
                    cancelBtn.addEventListener('mouseleave', () => {
                        cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                        cancelBtn.style.borderColor = '#666';
                    });

                    uploadBtn.addEventListener('mouseenter', () => {
                        uploadBtn.style.transform = 'scale(1.05)';
                    });
                    uploadBtn.addEventListener('mouseleave', () => {
                        uploadBtn.style.transform = 'scale(1)';
                    });
                };

                previewImg.src = 'data:image/jpeg;base64,' + imageResult.base64;
            });
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Animate in
            setTimeout(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            }, 10);
        });
    }
}

// Instancia global del manager de Instagram
window.instagramManager = new InstagramManager();
