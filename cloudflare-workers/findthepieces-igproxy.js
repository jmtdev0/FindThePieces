export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Endpoint para proxy de imágenes
    if (url.pathname === '/proxy' && request.method === 'GET') {
      const imageUrl = url.searchParams.get('url');
      if (!imageUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }
      
      try {
        const response = await fetch(imageUrl);
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Cache-Control', 'public, max-age=31536000');
        
        return new Response(response.body, {
          status: response.status,
          headers: headers
        });
      } catch (error) {
        return new Response('Error fetching image', { status: 500 });
      }
    }

    if (request.method === "OPTIONS") {
      // CORS preflight
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      // Leer el JSON del body
      const { imageBase64, puzzleInfo } = await request.json();

      if (!imageBase64) {
        return new Response(
          JSON.stringify({ error: "Missing imageBase64" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Construir el FormData para Imgur
      const formData = new FormData();

      // Añadir logs de tamaño para depuración
      try {
        const sizeChars = imageBase64.length;
        console.log(`Uploading image to Imgur — base64 chars: ${sizeChars}`);
      } catch (e) {
        console.log('Could not measure imageBase64 size', e);
      }

      // Preferir enviar como Blob (binario) en lugar de base64 porque algunos endpoints pueden rechazar
      // cadenas grandes o interpretar mal el campo 'type'. Intentamos convertir base64 a Blob y subirlo.
      let usedBlob = false;
      try {
        // atob existe en Workers
        const binaryString = atob(imageBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        formData.append('image', blob, 'puzzle.jpg');
        // No añadir 'type' cuando enviamos binario
        usedBlob = true;
      } catch (convErr) {
        console.warn('Failed to convert base64 to Blob, falling back to base64 form upload:', convErr);
        // Fallback a envío como base64
        formData.append("image", imageBase64);
        formData.append("type", "base64");
      }

      // Hacer la petición a Imgur
      const resp = await fetch("https://api.imgur.com/3/image", {
        method: "POST",
        headers: {
          "Authorization": `Client-ID ${env.IMGUR_CLIENT_ID}`,
        },
        body: formData,
      });

      console.log('Imgur request sent. Used blob:', usedBlob, 'Status:', resp.status);

      // Leer la respuesta textual completa (por seguridad algunos errores vienen sin JSON)
      const respText = await resp.text();
      console.log('Imgur response text length:', respText ? respText.length : 0);
      console.log('Imgur response headers:', Object.fromEntries(resp.headers.entries()));

      // Intentar parsear JSON si es posible
      let result = null;
      try {
        result = JSON.parse(respText);
      } catch (parseErr) {
        // No JSON — mantendremos el texto crudo en el payload
        result = null;
      }

      if (!resp.ok) {
        const errorPayload = {
          error: result && result.error ? result.error : 'Imgur returned non-OK status',
          status: resp.status,
          imgurResponseText: respText,
          imgurResponseHeaders: Object.fromEntries(resp.headers.entries()),
          success: false
        };
        return new Response(JSON.stringify(errorPayload), {
          status: resp.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Si OK y parseable JSON, usamos el JSON; si no, incluimos el texto crudo
      if (result) {
        // ya parseado
      } else {
        try {
          result = JSON.parse(respText);
        } catch (_) {
          result = { data: null, raw: respText };
        }
      }

      // Si la subida a Imgur fue exitosa, intentar publicar en Instagram
      let instagramResult = null;
      if (result.success && env.INSTAGRAM_ACCESS_TOKEN && env.IG_USER_ID) {
        try {
          // Validar contenido antes de publicar en Instagram
          const moderationResult = await moderateContent(result.data.link, puzzleInfo, env.OPENAI_API_KEY);
          
          if (!moderationResult.approved) {
            // Contenido no apropiado, no publicar en Instagram
            // Si solo el texto personalizado fue marcado, NO bloquear permanentemente y permitir reintentar con otro texto
            const isTextOnly = moderationResult.reason === 'text';
            instagramResult = {
              success: false,
              error: "Content moderation failed",
              moderation: moderationResult,
              message: isTextOnly
                ? "Custom caption was flagged as inappropriate. Please try again with a different caption."
                : "Content was flagged as inappropriate and cannot be published to Instagram.",
              permanentlyBlocked: !isTextOnly // Bloquear solo si la imagen es el problema
            };
            
            // Devolver error 500 para fallos de moderación
            const moderationFailureResult = {
              ...result,
              instagram: instagramResult,
              success: false,
              error: "Content moderation failed"
            };
            
            return new Response(JSON.stringify(moderationFailureResult), {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            });
          } else {
            // Contenido apropiado, proceder con la publicación
            const imageUrl = `https://findthepieces-igproxy.jmtdev0.workers.dev/proxy?url=${encodeURIComponent(result.data.link)}`;
            
            instagramResult = await publishToInstagram(
              imageUrl,
              env.INSTAGRAM_ACCESS_TOKEN,
              env.IG_USER_ID,
              puzzleInfo
            );
          }
        } catch (instagramError) {
          console.error("Instagram publish error:", instagramError);
          // No fallar la respuesta si Instagram falla, solo logear
          instagramResult = {
            success: false,
            error: instagramError.message,
            message: "Failed to publish to Instagram"
          };
        }
      }

      // Devolver la respuesta combinada
      const finalResult = {
        ...result,
        instagram: instagramResult
      };

      return new Response(JSON.stringify(finalResult), {
        status: resp.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};

// Función para publicar en Instagram
async function publishToInstagram(imageUrl, accessToken, igUserId, puzzleInfo = null) {
  try {
    // Usar caption personalizado si está disponible, sino generar uno automático
    let caption = "🧩 Puzzle completed! #FindThePieces #PuzzleGame #Completed";
    
    if (puzzleInfo) {
      // Si hay un caption personalizado, usarlo
      if (puzzleInfo.customCaption) {
        caption = puzzleInfo.customCaption;
      } else {
        // Generar caption automático con información del puzzle
        const addedDate = new Date(puzzleInfo.addedAt);
        const completedDate = new Date(puzzleInfo.completedAt);
        
        const addedFormatted = addedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const completedFormatted = completedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Calcular el número de piezas basándose en las dimensiones si no está disponible
        let totalPieces = puzzleInfo.totalPieces;
        if (!totalPieces && puzzleInfo.dimensions) {
          // Extraer filas y columnas de "2x2" o "3x3", etc.
          const dimensions = puzzleInfo.dimensions.split('x');
          if (dimensions.length === 2) {
            const rows = parseInt(dimensions[0]);
            const cols = parseInt(dimensions[1]);
            totalPieces = rows * cols;
          }
        }
        
        caption = `🧩 Puzzle Completed! 

🎯 Image added on: ${addedFormatted}
✨ Puzzle completed on: ${completedFormatted}
🔢 Dimensions: ${puzzleInfo.dimensions} (${totalPieces || 'unknown'} pieces)`;
      }
    }

    // Paso 1: Crear el media container
    console.log('Creating media container for IG user:', igUserId);
    console.log('Image URL:', imageUrl);
    
    const mediaUrl = `https://graph.facebook.com/v23.0/${igUserId}/media`;
    const mediaPayload = {
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken
    };

    console.log('Media payload:', { ...mediaPayload, access_token: '[REDACTED]' });

    const mediaParams = new URLSearchParams(mediaPayload);
    
    const mediaResponse = await fetch(mediaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: mediaParams
    });

    const mediaResult = await mediaResponse.json();
    console.log('Media creation response:', mediaResult);
    
    if (!mediaResponse.ok) {
      throw new Error(`Media creation failed: ${JSON.stringify(mediaResult)}`);
    }

    const creationId = mediaResult.id;
    console.log('Media container created with ID:', creationId);

    // Paso 2: Publicar el media
    console.log('Publishing media...');
    const publishUrl = `https://graph.facebook.com/v19.0/${igUserId}/media_publish`;
    const publishPayload = {
      creation_id: creationId,
      access_token: accessToken
    };

    const publishParams = new URLSearchParams(publishPayload);

    const publishResponse = await fetch(publishUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: publishParams
    });

    const publishResult = await publishResponse.json();
    console.log('Publish response:', publishResult);

    if (!publishResponse.ok) {
      throw new Error(`Publish failed: ${JSON.stringify(publishResult)}`);
    }

    const mediaId = publishResult.id;
    console.log('Media published with ID:', mediaId);

    // Paso 3: Obtener el permalink del post
    let permalink = null;
    try {
      console.log('Getting permalink for media ID:', mediaId);
      const permalinkUrl = `https://graph.facebook.com/v23.0/${mediaId}?fields=permalink&access_token=${accessToken}`;
      
      const permalinkResponse = await fetch(permalinkUrl);
      const permalinkResult = await permalinkResponse.json();
      console.log('Permalink response:', permalinkResult);
      
      if (permalinkResponse.ok && permalinkResult.permalink) {
        permalink = permalinkResult.permalink;
        console.log('Got permalink:', permalink);
      }
    } catch (permalinkError) {
      console.error('Error getting permalink:', permalinkError);
      // No es crítico si no podemos obtener el permalink
    }

    return {
      success: true,
      media_id: mediaId,
      creation_id: creationId,
      permalink: permalink,
      message: "Successfully published to Instagram"
    };

  } catch (error) {
    console.error('Instagram publish error:', error);
    return {
      success: false,
      error: error.message,
      message: "Failed to publish to Instagram"
    };
  }
}

// Función para moderar contenido usando OpenAI Moderation
async function moderateContent(imageUrl, puzzleInfo, openaiApiKey) {
  try {
    console.log('Starting content moderation...');
    
    // Validar texto personalizado si existe
    let textModeration = { approved: true };
    if (puzzleInfo?.customCaption) {
      console.log('Moderating custom caption text...');
      textModeration = await moderateText(puzzleInfo.customCaption, openaiApiKey);
      
      if (!textModeration.approved) {
        console.log('Text moderation failed:', textModeration);
        return {
          approved: false,
          reason: 'text',
          textModeration: textModeration
        };
      }
    }
    
    // Validar imagen
    console.log('Moderating image...');
    const imageModeration = await moderateImage(imageUrl, openaiApiKey);
    
    if (!imageModeration.approved) {
      console.log('Image moderation failed:', imageModeration);
      return {
        approved: false,
        reason: 'image',
        imageModeration: imageModeration
      };
    }
    
    console.log('Content moderation passed');
    return {
      approved: true,
      textModeration: textModeration,
      imageModeration: imageModeration
    };
    
  } catch (error) {
    console.error('Moderation error:', error);
    // En caso de error en la moderación, permitir la publicación pero logear el error
    return {
      approved: true,
      error: error.message,
      message: "Moderation service unavailable, content allowed by default"
    };
  }
}

// Función para moderar texto
async function moderateText(text, openaiApiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'omni-moderation-2024-09-26',
        input: text
      })
    });
    
    const result = await response.json();
    console.log('Text moderation result:', result);
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${result.error?.message || 'Unknown error'}`);
    }
    
    const moderation = result.results[0];
    const flagged = moderation.flagged;
    
    // Extraer categorías que están flagged
    const flaggedCategories = [];
    if (moderation.categories) {
      for (const [category, isFlagged] of Object.entries(moderation.categories)) {
        if (isFlagged) {
          flaggedCategories.push(category);
        }
      }
    }
    
    return {
      approved: !flagged,
      flagged: flagged,
      categories: flaggedCategories,
      scores: moderation.category_scores,
      rawResult: moderation
    };
    
  } catch (error) {
    console.error('Text moderation error:', error);
    throw error;
  }
}

// Función para moderar imagen
async function moderateImage(imageUrl, openaiApiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      })
    });
    
    const result = await response.json();
    console.log('Image moderation result:', result);
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${result.error?.message || 'Unknown error'}`);
    }
    
    const moderation = result.results[0];
    const flagged = moderation.flagged;
    
    // Extraer categorías que están flagged
    const flaggedCategories = [];
    if (moderation.categories) {
      for (const [category, isFlagged] of Object.entries(moderation.categories)) {
        if (isFlagged) {
          flaggedCategories.push(category);
        }
      }
    }
    
    return {
      approved: !flagged,
      flagged: flagged,
      categories: flaggedCategories,
      scores: moderation.category_scores,
      rawResult: moderation
    };
    
  } catch (error) {
    console.error('Image moderation error:', error);
    throw error;
  }
}
