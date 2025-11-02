
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fonction pour normaliser le texte en enlevant les accents
function normalizeText(text: string): string {
  return text
    .normalize('NFD') // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques
    .toLowerCase()
    .trim();
}

// Fonction pour extraire les variantes d'artistes
function generateArtistVariants(artist: string): string[] {
  const variants = new Set<string>();
  
  // Ajouter l'artiste original
  variants.add(artist);
  variants.add(normalizeText(artist));
  
  // Séparateurs courants pour plusieurs artistes
  const separators = [' & ', ' feat. ', ' feat ', ' ft. ', ' ft ', ' x ', ' X ', ', '];
  
  for (const separator of separators) {
    if (artist.includes(separator)) {
      // Prendre le premier artiste
      const firstArtist = artist.split(separator)[0].trim();
      variants.add(firstArtist);
      variants.add(normalizeText(firstArtist));
      
      // Aussi essayer avec tous les artistes séparés par le séparateur standard
      const allArtists = artist.split(separator).map(a => a.trim()).join(' & ');
      variants.add(allArtists);
      variants.add(normalizeText(allArtists));
      break;
    }
  }
  
  // Variantes d'apostrophes
  const apostropheVariants = [...variants].flatMap(v => [
    v,
    v.replace(/'/g, "'"),
    v.replace(/'/g, "'"),
  ]);
  
  return [...new Set(apostropheVariants)];
}

// Fonction pour générer des variantes orthographiques
function generateTextVariants(text: string): string[] {
  const variants = [
    text, // Original
    normalizeText(text), // Sans accents
    text.replace(/'/g, "'"), // Apostrophe droite vs courbe
    normalizeText(text).replace(/'/g, "'"),
  ];
  // Retourner uniquement les variantes uniques
  return [...new Set(variants)];
}

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
    
    // Générer des variantes du titre et de l'artiste
    const titleVariants = generateTextVariants(songTitle);
    const artistVariants = generateArtistVariants(artist);
    const albumVariants = albumName ? generateTextVariants(albumName) : [undefined];
    
    console.log(`Trying ${titleVariants.length} title variants, ${artistVariants.length} artist variants`);
    console.log('Artist variants:', artistVariants);
    
    // Try with exact duration first, then with ±2 seconds tolerance
    const durationsToTry = duration 
      ? [Math.round(duration), Math.round(duration) - 2, Math.round(duration) + 2]
      : [undefined];
    
    let lyricsResponse;
    let foundWithDuration = null;
    let successfulParams = null;
    
    // Essayer toutes les combinaisons de variantes
    for (const titleVariant of titleVariants) {
      for (const artistVariant of artistVariants) {
        for (const albumVariant of albumVariants) {
          for (const tryDuration of durationsToTry) {
            const tryParams = new URLSearchParams({
              artist_name: artistVariant,
              track_name: titleVariant,
            });
            
            if (albumVariant) {
              tryParams.append('album_name', albumVariant);
            }
            
            if (tryDuration !== undefined) {
              tryParams.append('duration', tryDuration.toString());
            }
            
            const apiUrl = `https://lrclib.net/api/get?${tryParams.toString()}`;
            console.log('Fetching lyrics from LRCLIB:', apiUrl);
            
            lyricsResponse = await fetch(apiUrl, {
              headers: {
                'User-Agent': 'MusicApp v1.0.0 (https://github.com/your-app)',
              }
            });
            
            if (lyricsResponse.ok) {
              foundWithDuration = tryDuration;
              successfulParams = { titleVariant, artistVariant, albumVariant };
              console.log(`Found lyrics with: title="${titleVariant}", artist="${artistVariant}", duration=${tryDuration}`);
              break;
            }
            
            if (lyricsResponse.status !== 404) {
              throw new Error(`LRCLIB API error: ${lyricsResponse.status} ${lyricsResponse.statusText}`);
            }
          }
          if (lyricsResponse?.ok) break;
        }
        if (lyricsResponse?.ok) break;
      }
      if (lyricsResponse?.ok) break;
    }
    
    if (!lyricsResponse || !lyricsResponse.ok) {
      console.log('Lyrics not found for:', songTitle, 'by', artist);
      return new Response(
        JSON.stringify({ 
          lyrics: `Aucune parole trouvée pour "${songTitle}" par ${artist}.`,
          syncedLyrics: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
