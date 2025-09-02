// instagram.js
// Integración con Instagram y manejo de publicaciones

class InstagramManager {
    constructor() {
        this.workerUrl = 'https://findthepieces-igproxy.jmtdev0.workers.dev/';
    }

    // Generar imagen del puzzle completado
    async generatePuzzleImage(imgObj, puzzleManager) {
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
                resolve(base64);
            };
            img.src = imgObj.src;
        });
    }

    // Subir imagen a Instagram
    async uploadToInstagram(imgObj, puzzleManager, customCaption = null) {
        try {
            // Generar imagen del puzzle completado
            const puzzleImageBase64 = await this.generatePuzzleImage(imgObj, puzzleManager);
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
}

// Instancia global del manager de Instagram
window.instagramManager = new InstagramManager();
