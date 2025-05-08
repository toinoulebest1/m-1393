
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
    
    // Step 1: Search for songs using the song title and artist
    const searchQuery = encodeURIComponent(`${songTitle} ${artist || ''}`);
    const searchResponse = await fetch(`https://api.genius.com/search?q=${searchQuery}`, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GENIUS_API_KEY')}`,
      },
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('Genius search API error:', errorData);
      throw new Error(`Genius API error: ${errorData.meta?.message || 'Unknown error'}`);
    }

    const searchData = await searchResponse.json();
    
    // Check if we got any search results
    if (!searchData.response.hits || searchData.response.hits.length === 0) {
      console.log('No results found on Genius for:', searchQuery);
      return new Response(
        JSON.stringify({ 
          lyrics: `Aucune parole trouvée pour "${songTitle}" ${artist ? `par ${artist}` : ''}.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the first match from search results
    const firstHit = searchData.response.hits[0];
    const songId = firstHit.result.id;
    const songUrl = firstHit.result.url;
    
    console.log('Found song on Genius:', firstHit.result.title, 'by', firstHit.result.primary_artist.name);
    console.log('Song URL:', songUrl);

    // Step 2: We need to scrape the lyrics from the Genius web page
    // since the API doesn't directly provide lyrics
    const songPageResponse = await fetch(songUrl);
    if (!songPageResponse.ok) {
      throw new Error('Failed to fetch the song page from Genius');
    }

    const html = await songPageResponse.text();
    
    // Extract lyrics from HTML using a simple approach
    // This is not ideal but works for a basic implementation
    let lyrics = '';
    const lyricsMatch = html.match(/<div class="Lyrics__Container-sc-[^>]*>([\s\S]*?)<\/div>/g);
    
    if (lyricsMatch) {
      // Remove HTML tags to get clean lyrics
      lyrics = lyricsMatch.join('\n')
        .replace(/<[^>]*>/g, '')  // Remove HTML tags
        .replace(/\[.*?\]/g, '')  // Remove [Verse], [Chorus], etc.
        .replace(/\n{3,}/g, '\n\n')  // Normalize multiple newlines
        .trim();
    }

    if (!lyrics) {
      // If traditional extraction method fails, try an alternative approach
      const alternativeLyricsMatch = html.match(/window\.__PRELOADED_STATE__ = JSON\.parse\('(.+?)'\)/);
      if (alternativeLyricsMatch && alternativeLyricsMatch[1]) {
        try {
          // The lyrics might be in the preloaded state
          const jsonString = alternativeLyricsMatch[1].replace(/\\(.)/g, "$1");
          const preloadedState = JSON.parse(jsonString);
          
          // Navigate through the JSON structure to find lyrics
          // Note: the exact path may vary depending on Genius's implementation
          const pages = preloadedState.songPage || {};
          const lyricsData = pages.lyricsData || {};
          
          if (lyricsData.body && lyricsData.body.html) {
            lyrics = lyricsData.body.html
              .replace(/<[^>]*>/g, '')
              .replace(/\[.*?\]/g, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
          }
        } catch (e) {
          console.error('Error parsing preloaded state:', e);
        }
      }
    }

    // If we still don't have lyrics, return a message
    if (!lyrics) {
      lyrics = `Les paroles n'ont pas pu être extraites pour "${songTitle}" ${artist ? `par ${artist}` : ''}.\n` +
               `Vous pouvez les consulter directement sur Genius: ${songUrl}`;
    }

    console.log('Successfully extracted lyrics for:', songTitle);

    return new Response(
      JSON.stringify({ lyrics }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-lyrics function:', error);
    
    // Return a user-friendly error message
    return new Response(
      JSON.stringify({ 
        error: "Impossible de récupérer les paroles. Veuillez vérifier votre clé API Genius ou réessayer plus tard." 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
