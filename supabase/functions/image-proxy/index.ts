import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const imageUrl = url.searchParams.get('src');

  if (!imageUrl) {
    return new Response('Missing "src" parameter (image URL)', { status: 400, headers: corsHeaders });
  }

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return new Response(`Failed to fetch image: ${response.statusText}`, { status: response.status, headers: corsHeaders });
    }

    // Copier les en-têtes pertinents de la réponse de l'image
    const responseHeaders = new Headers(corsHeaders);
    if (response.headers.has('Content-Type')) {
      responseHeaders.set('Content-Type', response.headers.get('Content-Type')!);
    }
    if (response.headers.has('Content-Length')) {
      responseHeaders.set('Content-Length', response.headers.get('Content-Length')!);
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(`[ImageProxy] Error processing image:`, error);
    return new Response(`Internal server error: ${error.message}`, { status: 500, headers: corsHeaders });
  }
});