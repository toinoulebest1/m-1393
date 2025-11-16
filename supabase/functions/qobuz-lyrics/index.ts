import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const artist = url.searchParams.get('artist');
    const title = url.searchParams.get('title');

    if (!artist || !title) {
      return new Response(
        JSON.stringify({ error: 'Missing artist or title parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[QobuzLyrics] Fetching lyrics for: ${artist} - ${title}`);

    const QOBUZ_API_TOKEN = Deno.env.get('QOBUZ_API_TOKEN');
    
    if (!QOBUZ_API_TOKEN) {
      console.error('[QobuzLyrics] QOBUZ_API_TOKEN not found');
      return new Response(
        JSON.stringify({ error: 'API configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Qobuz API for lyrics
    const qobuzUrl = `https://api.kinoplus.online/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
    
    const response = await fetch(qobuzUrl, {
      headers: {
        'apikey': QOBUZ_API_TOKEN,
      },
    });

    if (!response.ok) {
      console.warn(`[QobuzLyrics] API returned ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Lyrics not found', lyrics: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[QobuzLyrics] Lyrics found for: ${artist} - ${title}`);

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[QobuzLyrics] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', lyrics: null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
