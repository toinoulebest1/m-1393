const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trackId, quality = 2 } = await req.json();

    if (!trackId) {
      return new Response(
        JSON.stringify({ error: 'Track ID requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const flaskUrl = Deno.env.get('DEEZER_FLASK_URL');
    if (!flaskUrl) {
      return new Response(
        JSON.stringify({ error: 'DEEZER_FLASK_URL non configuré' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Deezer Stream] Demande pour track ${trackId}, qualité ${quality}`);

    // Appeler Flask pour obtenir l'URL de stream
    const streamResponse = await fetch(`${flaskUrl}/get_stream_url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trackId, quality })
    });

    if (!streamResponse.ok) {
      const error = await streamResponse.text();
      console.error(`[Deezer Stream] Erreur Flask: ${error}`);
      return new Response(
        JSON.stringify({ error: `Erreur serveur Deezer: ${error}` }),
        { status: streamResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const streamData = await streamResponse.json();
    
    if (!streamData.success || !streamData.stream_url) {
      return new Response(
        JSON.stringify({ error: streamData.error || 'URL de stream non disponible' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construire l'URL complète du stream Flask
    const fullStreamUrl = `${flaskUrl}${streamData.stream_url}`;
    
    console.log(`[Deezer Stream] URL générée: ${fullStreamUrl}`);

    // Retourner l'URL pour que le frontend puisse streamer directement
    return new Response(
      JSON.stringify({ 
        url: fullStreamUrl,
        trackInfo: streamData.track_info
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('[Deezer Stream] Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
