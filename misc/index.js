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
      const { imageBase64 } = await request.json();

      if (!imageBase64) {
        return new Response(
          JSON.stringify({ error: "Missing imageBase64" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Construir el FormData para Imgur
      const formData = new FormData();
      formData.append("image", imageBase64);
      formData.append("type", "base64");

      // Hacer la petición a Imgur
      const resp = await fetch("https://api.imgur.com/3/image", {
        method: "POST",
        headers: {
          "Authorization": `Client-ID ${env.IMGUR_CLIENT_ID}`,
        },
        body: formData,
      });

      const result = await resp.json();

      if (!resp.ok) {
        return new Response(JSON.stringify(result), {
          status: resp.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Si la subida a Imgur fue exitosa, intentar publicar en Instagram
      let instagramResult = null;
      if (result.success && env.INSTAGRAM_ACCESS_TOKEN && env.IG_USER_ID) {
        try {
          // Usar una URL proxy si es necesario
          const imageUrl = `https://findthepieces-igproxy.jmtdev0.workers.dev/proxy?url=${encodeURIComponent(result.data.link)}`;
          
          instagramResult = await publishToInstagram(
            imageUrl,
            env.INSTAGRAM_ACCESS_TOKEN,
            env.IG_USER_ID
          );
        } catch (instagramError) {
          console.error("Instagram publish error:", instagramError);
          // No fallar la respuesta si Instagram falla, solo logear
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
async function publishToInstagram(imageUrl, accessToken, igUserId) {
  try {
    // Paso 1: Crear el media container
    console.log('Creating media container for IG user:', igUserId);
    console.log('Image URL:', imageUrl);
    
    const mediaUrl = `https://graph.facebook.com/v23.0/${igUserId}/media`;
    const mediaPayload = {
      image_url: imageUrl,
      caption: "🧩 ¡Puzzle completado! #FindThePieces #PuzzleGame #Completed",
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

    return {
      success: true,
      media_id: publishResult.id,
      creation_id: creationId,
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
