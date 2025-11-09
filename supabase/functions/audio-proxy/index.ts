import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'audio/mp4', // Par défaut, nous renverrons du MP4
  'Accept-Ranges': 'bytes', // Permet le seeking
};

serve(async (req) => {
  console.log(`[AudioProxy] Incoming request URL: ${req.url}`);
  console.log(`[AudioProxy] Incoming request method: ${req.method}`);
  console.log(`[AudioProxy] Incoming request headers:`, Object.fromEntries(req.headers.entries()));

  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const tidalAudioUrl = url.searchParams.get('src');

  if (!tidalAudioUrl) {
    console.error('[AudioProxy] Missing "src" parameter.');
    return new Response('Missing "src" parameter (Tidal audio URL)', { status: 400, headers: corsHeaders });
  }

  console.log(`[AudioProxy] Extracted Tidal audio URL (src): ${tidalAudioUrl}`);

  try {
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
      // Passer les en-têtes de la requête originale (ex: Range pour le seeking)
      // Filtrer les en-têtes qui pourraient causer des problèmes ou ne sont pas pertinents pour le fetch en amont
      ...Object.fromEntries(Array.from(req.headers.entries()).filter(([key]) => 
        !['host', 'connection', 'accept-encoding', 'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip'].includes(key.toLowerCase())
      )),
    };
    console.log(`[AudioProxy] Fetching from Tidal with headers:`, fetchHeaders);

    const response = await fetch(tidalAudioUrl, {
      headers: fetchHeaders,
    });

    console.log(`[AudioProxy] Response from Tidal status: ${response.status}`);
    console.log(`[AudioProxy] Response from Tidal headers:`, Object.fromEntries(response.headers.entries()));

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
    // Si Tidal renvoie un Content-Type plus spécifique et compatible, nous pouvons le conserver
    if (response.headers.has('Content-Type') && response.headers.get('Content-Type')?.startsWith('audio/')) {
        responseHeaders.set('Content-Type', response.headers.get('Content-Type')!);
    }


    console.log(`[AudioProxy] Successfully proxied audio from Tidal. Final response headers:`, Object.fromEntries(responseHeaders.entries()));
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(`[AudioProxy] Error processing audio stream:`, error);
    return new Response(`Internal server error: ${error.message}`, { status: 500, headers: corsHeaders });
  }
});