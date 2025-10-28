
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { songTitle, artist, albumName, duration } = await req.json();
    console.log('Attempting to find lyrics for:', songTitle, 'by', artist);
    
    if (!artist || !songTitle) {
      console.log('Missing required parameters');
      return new Response(
        JSON.stringify({ 
          lyrics: `Impossible de trouver les paroles sans le titre et l'artiste.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Build LRCLIB API URL with required and optional parameters
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: songTitle,
    });
    
    if (albumName) {
      params.append('album_name', albumName);
    }
    
    if (duration) {
      params.append('duration', Math.round(duration).toString());
    }
    
    const apiUrl = `https://lrclib.net/api/get?${params.toString()}`;
    console.log('Fetching lyrics from LRCLIB:', apiUrl);
    
    const lyricsResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'MusicApp v1.0.0 (https://github.com/your-app)',
      }
    });
    
    if (!lyricsResponse.ok) {
      if (lyricsResponse.status === 404) {
        console.log('Lyrics not found for:', songTitle, 'by', artist);
        return new Response(
          JSON.stringify({ 
            lyrics: `Aucune parole trouvée pour "${songTitle}" par ${artist}.`,
            syncedLyrics: null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`LRCLIB API error: ${lyricsResponse.status} ${lyricsResponse.statusText}`);
    }

    const lyricsData = await lyricsResponse.json();
    console.log('Successfully retrieved lyrics for:', songTitle, 'by', artist);

    // Check if track is instrumental
    if (lyricsData.instrumental) {
      return new Response(
        JSON.stringify({ 
          lyrics: `Cette piste est instrumentale.`,
          syncedLyrics: null
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Return both plain and synced lyrics
    const plainLyrics = lyricsData.plainLyrics || `Aucune parole disponible pour "${songTitle}" par ${artist}.`;
    const syncedLyrics = lyricsData.syncedLyrics || null;

    return new Response(
      JSON.stringify({ 
        lyrics: plainLyrics,
        syncedLyrics: syncedLyrics
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in generate-lyrics function:', error);
    
    // Return a user-friendly error message
    return new Response(
      JSON.stringify({ 
        error: "Impossible de récupérer les paroles. Veuillez réessayer plus tard." 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
