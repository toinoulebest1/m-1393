import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artist, track, method = 'track.getSimilar' } = await req.json();
    const LASTFM_API_KEY = Deno.env.get('LASTFM_API_KEY');

    if (!LASTFM_API_KEY) {
      console.error('[LastFM] API key not configured');
      return new Response(
        JSON.stringify({ error: 'Last.fm API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[LastFM] Fetching recommendations using ${method}:`, { artist, track });

    let url: string;
    if (method === 'track.getSimilar' && track && artist) {
      url = `https://ws.audioscrobbler.com/2.0/?method=track.getSimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json&limit=50`;
    } else if (method === 'artist.getSimilar' && artist) {
      url = `https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar&artist=${encodeURIComponent(artist)}&api_key=${LASTFM_API_KEY}&format=json&limit=50`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('[LastFM] API request failed:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Last.fm API request failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('[LastFM] Successfully fetched recommendations');

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[LastFM] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
