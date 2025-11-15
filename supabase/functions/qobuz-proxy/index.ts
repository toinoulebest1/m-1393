import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_WORKER_URL = 'https://twilight-water-89ff.saumonlol5-711.workers.dev';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');
    
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing endpoint parameter' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construire l'URL du Worker avec tous les paramètres
    const workerUrl = new URL(CLOUDFLARE_WORKER_URL);
    workerUrl.searchParams.set('endpoint', endpoint);
    
    if (endpoint === 'search') {
      const query = url.searchParams.get('q');
      const offset = url.searchParams.get('offset') || '0';
      const type = url.searchParams.get('type') || 'track';
      
      if (!query) {
        return new Response(
          JSON.stringify({ error: 'Missing query parameter' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      workerUrl.searchParams.set('q', query);
      workerUrl.searchParams.set('offset', offset);
      workerUrl.searchParams.set('type', type);
    } else if (endpoint === 'stream') {
      const trackId = url.searchParams.get('trackId');
      
      if (!trackId) {
        return new Response(
          JSON.stringify({ error: 'Missing trackId parameter' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      workerUrl.searchParams.set('trackId', trackId);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[QobuzProxy] Calling Cloudflare Worker: ${workerUrl.toString()}`);

    const response = await fetch(workerUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText;
      let bodySnippet = '';
      try {
        const text = await response.text();
        bodySnippet = text.slice(0, 500);
      } catch (_) {}
      
      console.error(`[QobuzProxy] Worker error: ${status} ${statusText} Body: ${bodySnippet}`);
      return new Response(
        JSON.stringify({ error: `Cloudflare Worker error: ${status}`, statusText, bodySnippet }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('[QobuzProxy] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
