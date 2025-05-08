
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
    const { songTitle, artist } = await req.json();
    console.log('Attempting to find lyrics for:', songTitle, 'by', artist);
    
    if (!artist) {
      console.log('No artist provided, cannot search for lyrics');
      return new Response(
        JSON.stringify({ 
          lyrics: `Impossible de trouver les paroles sans le nom de l'artiste.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use the lyrics.ovh API
    const apiUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(songTitle)}`;
    console.log('Fetching lyrics from URL:', apiUrl);
    
    const lyricsResponse = await fetch(apiUrl);
    
    if (!lyricsResponse.ok) {
      if (lyricsResponse.status === 404) {
        console.log('Lyrics not found for:', songTitle, 'by', artist);
        return new Response(
          JSON.stringify({ 
            lyrics: `Aucune parole trouvée pour "${songTitle}" par ${artist}.` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Lyrics.ovh API error: ${lyricsResponse.status} ${lyricsResponse.statusText}`);
    }

    const lyricsData = await lyricsResponse.json();
    console.log('Successfully retrieved lyrics for:', songTitle, 'by', artist);

    // Format lyrics for better display (remove excessive newlines, etc.)
    let formattedLyrics = lyricsData.lyrics
      .replace(/\n{3,}/g, '\n\n')  // Normalize multiple newlines
      .trim();
    
    if (!formattedLyrics) {
      formattedLyrics = `Aucune parole disponible pour "${songTitle}" par ${artist}.`;
    }

    return new Response(
      JSON.stringify({ lyrics: formattedLyrics }),
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
