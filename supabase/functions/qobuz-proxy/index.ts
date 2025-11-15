import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QOBUZ_API_BASE = 'https://dab.yeet.su/api';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint'); // 'search' or 'stream'
    
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing endpoint parameter' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let qobuzUrl: string;
    
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
      
      qobuzUrl = `${QOBUZ_API_BASE}/search?q=${encodeURIComponent(query)}&offset=${offset}&type=${type}`;
    } else if (endpoint === 'stream') {
      const trackId = url.searchParams.get('trackId');
      
      if (!trackId) {
        return new Response(
          JSON.stringify({ error: 'Missing trackId parameter' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      qobuzUrl = `${QOBUZ_API_BASE}/stream?trackId=${trackId}`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[QobuzProxy] Fetching from: ${qobuzUrl}`);

    const response = await fetch(qobuzUrl);

    if (!response.ok) {
      console.error(`[QobuzProxy] Error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: `Qobuz API error: ${response.status}` }), 
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
