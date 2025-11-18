import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

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
    const appId = Deno.env.get('QOBUZ_APP_ID');
    const userToken = Deno.env.get('QOBUZ_API_TOKEN');

    if (!appId || !userToken) {
      console.error('[QobuzCharts] Missing QOBUZ_APP_ID or QOBUZ_API_TOKEN');
      return new Response(
        JSON.stringify({ error: 'Missing Qobuz credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestTs = Math.floor(Date.now() / 1000);
    
    // Récupérer les playlists featured (contient les charts)
    // type accepte: "last-created" ou "editor-picks"
    const featuredUrl = `${QOBUZ_API_BASE}/playlist/getFeatured?type=editor-picks&limit=20&app_id=${appId}&user_auth_token=${userToken}&request_ts=${requestTs}`;
    
    console.log('[QobuzCharts] Fetching featured playlists...');
    
    const featuredResponse = await fetch(featuredUrl);
    
    if (!featuredResponse.ok) {
      const errorText = await featuredResponse.text();
      console.error(`[QobuzCharts] Qobuz API error: ${featuredResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Qobuz API error', details: errorText }),
        { status: featuredResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const featuredData = await featuredResponse.json();
    
    // Trouver la playlist "Top Charts" ou similaire
    const chartsPlaylist = featuredData.playlists?.items?.find((playlist: any) => 
      playlist.name?.toLowerCase().includes('chart') || 
      playlist.name?.toLowerCase().includes('top') ||
      playlist.name?.toLowerCase().includes('hits')
    ) || featuredData.playlists?.items?.[0];

    if (!chartsPlaylist) {
      console.error('[QobuzCharts] No charts playlist found');
      return new Response(
        JSON.stringify({ tracks: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[QobuzCharts] Found playlist: ${chartsPlaylist.name}`);

    // Récupérer les tracks de la playlist
    const playlistUrl = `${QOBUZ_API_BASE}/playlist/get?playlist_id=${chartsPlaylist.id}&limit=50&app_id=${appId}&user_auth_token=${userToken}&request_ts=${requestTs}`;
    
    const playlistResponse = await fetch(playlistUrl);
    
    if (!playlistResponse.ok) {
      const errorText = await playlistResponse.text();
      console.error(`[QobuzCharts] Playlist API error: ${playlistResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Playlist API error', details: errorText }),
        { status: playlistResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const playlistData = await playlistResponse.json();
    
    // Transform to our format
    const tracks = playlistData.tracks?.items?.slice(0, 20).map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.performer?.name || track.album?.artist?.name || 'Unknown Artist',
      albumTitle: track.album?.title,
      albumCover: track.album?.image?.large || track.album?.image?.small,
      duration: track.duration,
      genre: track.genre?.name,
      maximum_bit_depth: track.maximum_bit_depth,
      maximum_sampling_rate: track.maximum_sampling_rate
    })) || [];

    console.log(`[QobuzCharts] Returning ${tracks.length} chart tracks`);

    return new Response(
      JSON.stringify({ tracks, playlistName: chartsPlaylist.name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[QobuzCharts] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
