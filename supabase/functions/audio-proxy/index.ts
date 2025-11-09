import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'audio/mp4', // Par défaut, nous renverrons du MP4
  'Accept-Ranges': 'bytes', // Permet le seeking
};

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const tidalAudioUrl = url.searchParams.get('src');

  if (!tidalAudioUrl) {
    return new Response('Missing "src" parameter (Tidal audio URL)', { status: 400, headers: corsHeaders });
  }

  console.log(`[AudioProxy] Received request for: ${tidalAudioUrl}`);

  try {
    // Ici, nous allons simuler le transcodage en renvoyant directement le flux
    // Pour une implémentation réelle de transcodage, il faudrait intégrer
    // un outil comme ffmpeg (via un service externe ou une bibliothèque Deno si disponible)
    // et streamer le résultat.

    // Pour l'instant, nous allons simplement "proxy" le fichier.
    // Dans une version future, cette partie inclurait la logique de transcodage.

    const response = await fetch(tidalAudioUrl, {
      headers: {
        // Ajouter des en-têtes si nécessaire pour l'API Tidal (ex: User-Agent)
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        ...req.headers, // Passer les en-têtes de la requête originale (ex: Range pour le seeking)
      },
    });

    if (!response.ok) {
      console.error(`[AudioProxy] Failed to fetch Tidal audio: ${response.status} ${response.statusText}`);
      return new Response(`Failed to fetch Tidal audio: ${response.statusText}`, { status: response.status, headers: corsHeaders });
    }

    // Copier les en-têtes pertinents de la réponse Tidal
    const responseHeaders = new Headers(corsHeaders);
    if (response.headers.has('Content-Length')) {
      responseHeaders.set('Content-Length', response.headers.get('Content-Length')!);
    }
    if (response.headers.has('Content-Range')) {
      responseHeaders.set('Content-Range', response.headers.get('Content-Range')!);
    }
    // Le Content-Type est déjà défini dans corsHeaders comme audio/mp4 pour la compatibilité

    console.log(`[AudioProxy] Successfully proxied audio from Tidal. Streaming...`);
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(`[AudioProxy] Error processing audio stream:`, error);
    return new Response(`Internal server error: ${error.message}`, { status: 500, headers: corsHeaders });
  }
});