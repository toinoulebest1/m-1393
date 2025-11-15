import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TidalTrack {
  id: number;
  title: string;
  artist: {
    name: string;
  };
  artists: Array<{ name: string }>;
  album: {
    title: string;
    cover: string;
  };
  duration: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer la clé API Tidal depuis site_settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'tidal_api_key')
      .maybeSingle();

    if (settingsError || !settingsData?.value) {
      console.error('Tidal API key not configured:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Tidal API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tidalApiKey = settingsData.value;
    const { action, query, trackId, quality = 'HIGH' } = await req.json();

    console.log(`[Tidal API] Action: ${action}, Query: ${query}, TrackId: ${trackId}`);

    if (action === 'search') {
      // Recherche de tracks via l'API Tidal officielle
      const searchResponse = await fetch(
        `https://api.tidal.com/v1/search/tracks?query=${encodeURIComponent(query)}&limit=20&countryCode=US`,
        {
          headers: {
            'x-tidal-token': tidalApiKey,
          },
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Tidal search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      console.log(`[Tidal API] Search returned ${searchData.items?.length || 0} results`);

      const tracks = (searchData.items || []).map((item: TidalTrack) => ({
        id: `tidal-${item.id}`,
        title: item.title,
        artist: item.artist?.name || item.artists?.[0]?.name || 'Unknown',
        album_name: item.album?.title || 'Unknown',
        duration: Math.floor(item.duration),
        image_url: item.album?.cover 
          ? `https://resources.tidal.com/images/${item.album.cover.replace(/-/g, '/')}/640x640.jpg`
          : null,
        tidal_id: item.id.toString(),
      }));

      return new Response(
        JSON.stringify({ tracks }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'stream') {
      // Obtenir l'URL de streaming via l'API Tidal officielle
      const streamResponse = await fetch(
        `https://api.tidal.com/v1/tracks/${trackId}/streamUrl?soundQuality=${quality}&countryCode=US`,
        {
          headers: {
            'x-tidal-token': tidalApiKey,
          },
        }
      );

      if (!streamResponse.ok) {
        throw new Error(`Tidal stream failed: ${streamResponse.status}`);
      }

      const streamData = await streamResponse.json();
      console.log(`[Tidal API] Stream URL obtained for track ${trackId}`);

      return new Response(
        JSON.stringify({ url: streamData.url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Tidal API] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
