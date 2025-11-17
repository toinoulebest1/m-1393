const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Appel API Deezer
async function deezerApiCall(arl: string, query: string): Promise<any> {
  const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=50`, {
    headers: {
      'Cookie': `arl=${arl}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Deezer API error: ${response.status}`);
  }
  
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const arl = Deno.env.get('DEEZER_ARL');
    if (!arl) {
      return new Response(
        JSON.stringify({ error: 'DEEZER_ARL non configuré' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Deezer Search] Recherche pour: ${query}`);

    const searchResults = await deezerApiCall(arl, query);
    
    if (!searchResults.data) {
      return new Response(
        JSON.stringify({ tracks: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formater les résultats au format attendu par l'application
    const tracks = searchResults.data.map((track: any) => ({
      id: `deezer:${track.id}`,
      title: track.title,
      artist: track.artist?.name || 'Unknown Artist',
      album: track.album?.title || 'Unknown Album',
      duration: track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '0:00',
      imageUrl: track.album?.cover_medium || track.album?.cover_big || track.album?.cover_xl || null,
      url: `deezer:${track.id}`,
      deezer_id: String(track.id),
    }));

    console.log(`[Deezer Search] ${tracks.length} résultats trouvés`);

    return new Response(
      JSON.stringify({ tracks }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Deezer Search] Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message, tracks: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
