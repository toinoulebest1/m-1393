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
    const { songTitle, artist, duration, albumName } = await req.json()

    console.log(`Recherche de paroles pour: ${songTitle} par ${artist}`)

    // Étape 1: Essayer de récupérer les paroles depuis l'API Tidal si un ID Tidal est fourni
    // (Cette logique est maintenant principalement côté client, mais on la garde en fallback)
    // Pour l'instant, on se concentre sur LRCLIB comme demandé.

    // Étape 2: Utiliser LRCLIB si l'étape 1 échoue ou n'est pas applicable
    try {
      let apiUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(songTitle)}&artist_name=${encodeURIComponent(artist)}`
      if (albumName) {
        apiUrl += `&album_name=${encodeURIComponent(albumName)}`
      }
      if (duration) {
        apiUrl += `&duration=${duration}`
      }

      console.log("Appel à l'API LRCLIB:", apiUrl)

      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error(`Erreur de l'API LRCLIB: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Réponse de LRCLIB:", data)

      if (data && data.length > 0) {
        const bestMatch = data[0]
        const lyrics = bestMatch.syncedLyrics || bestMatch.plainLyrics

        if (lyrics) {
          console.log("Paroles trouvées via LRCLIB")
          return new Response(
            JSON.stringify({ 
              lyrics: bestMatch.plainLyrics,
              syncedLyrics: bestMatch.syncedLyrics 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      console.log("Aucune parole trouvée sur LRCLIB")
      return new Response(
        JSON.stringify({ error: 'Paroles non trouvées sur LRCLIB' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error("Erreur lors de la récupération des paroles:", error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
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