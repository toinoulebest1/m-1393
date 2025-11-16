const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QOBUZ_API_BASE = 'https://www.qobuz.com/api.json/0.2';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');
    
    const appId = Deno.env.get('QOBUZ_APP_ID');
    const userToken = Deno.env.get('QOBUZ_API_TOKEN');

    if (!appId || !userToken) {
      console.error('[QobuzProxy] Missing QOBUZ_APP_ID or QOBUZ_API_TOKEN');
      return new Response(
        JSON.stringify({ error: 'Missing Qobuz credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search endpoint
    if (endpoint === 'search') {
      const query = url.searchParams.get('q') || '';
      const limit = url.searchParams.get('limit') || '50';
      const offset = url.searchParams.get('offset') || '0';

      const qobuzUrl = `${QOBUZ_API_BASE}/track/search?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&app_id=${appId}&user_auth_token=${userToken}`;
      
      console.log(`[QobuzProxy] Searching: ${query}`);
      
      const response = await fetch(qobuzUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[QobuzProxy] Qobuz API error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: 'Qobuz API error', details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      
      // Transform to our format
      const tracks = data.tracks?.items?.map((track: any) => ({
        id: track.id,
        title: track.title,
        artist: track.performer?.name || track.album?.artist?.name || 'Unknown Artist',
        albumTitle: track.album?.title,
        albumCover: track.album?.image?.large || track.album?.image?.small,
        duration: track.duration,
        genre: track.genre?.name
      })) || [];

      console.log(`[QobuzProxy] Found ${tracks.length} tracks`);

      return new Response(
        JSON.stringify({ tracks }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream endpoint
    if (endpoint === 'stream') {
      const trackId = url.searchParams.get('trackId');
      
      if (!trackId) {
        return new Response(
          JSON.stringify({ error: 'Missing trackId parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // format_id 5 = MP3 320kbps, 6 = FLAC 16bit, 27 = FLAC 24bit
      const formatId = '5'; // MP3 320kbps for compatibility
      const qobuzUrl = `${QOBUZ_API_BASE}/track/getFileUrl?track_id=${trackId}&format_id=${formatId}&app_id=${appId}&user_auth_token=${userToken}`;
      
      console.log(`[QobuzProxy] Getting stream URL for track: ${trackId}`);
      
      const response = await fetch(qobuzUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[QobuzProxy] Stream error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: 'Failed to get stream URL', details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      
      if (!data.url) {
        console.error('[QobuzProxy] No URL in response');
        return new Response(
          JSON.stringify({ error: 'No stream URL returned' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[QobuzProxy] Stream URL obtained for track ${trackId}`);

      return new Response(
        JSON.stringify({ url: data.url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid endpoint' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[QobuzProxy] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
