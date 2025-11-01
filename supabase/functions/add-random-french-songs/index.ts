import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Liste de chansons françaises populaires
const FRENCH_SONGS = [
  { title: "La Bohème", artist: "Charles Aznavour" },
  { title: "Non, je ne regrette rien", artist: "Édith Piaf" },
  { title: "Dernière Danse", artist: "Indila" },
  { title: "Formidable", artist: "Stromae" },
  { title: "Papaoutai", artist: "Stromae" },
  { title: "Alors on danse", artist: "Stromae" },
  { title: "Bijou", artist: "Ninho" },
  { title: "Bande organisée", artist: "13 Organisé" },
  { title: "Tout oublier", artist: "Angèle" },
  { title: "Balance ton quoi", artist: "Angèle" },
  { title: "Djadja", artist: "Aya Nakamura" },
  { title: "Copines", artist: "Aya Nakamura" },
  { title: "Pookie", artist: "Aya Nakamura" },
  { title: "Bella", artist: "Maître Gims" },
  { title: "Sapés comme jamais", artist: "Maître Gims" },
  { title: "J'me tire", artist: "Maître Gims" },
  { title: "Ramenez la coupe à la maison", artist: "Vegedream" },
  { title: "Andalouse", artist: "Kendji Girac" },
  { title: "Color Gitano", artist: "Kendji Girac" },
  { title: "Dans ma paranoïa", artist: "Jul" },
  { title: "Bande Organisée", artist: "Jul" },
  { title: "La Kiffance", artist: "Naps" },
  { title: "Best Life", artist: "Naps" },
  { title: "Comme d'hab", artist: "Niska" },
  { title: "Réseaux", artist: "Niska" },
  { title: "La puissance", artist: "Ninho" },
  { title: "Lettre à une femme", artist: "Ninho" },
  { title: "Blanka", artist: "Naps" },
  { title: "Coco", artist: "Jul" },
  { title: "Evidemment", artist: "Jul" },
];

// Fonction pour chercher un titre sur Tidal
async function searchTidalId(title: string, artist: string): Promise<string | null> {
  const queries = [
    title.trim(),
    `${title} ${artist}`.trim(),
    `${artist} ${title}`.trim(),
  ];

  for (const query of queries) {
    try {
      // Essayer Frankfurt en priorité
      let searchUrl = `https://frankfurt.monochrome.tf/search/?s=${encodeURIComponent(query)}`;
      let res = await fetch(searchUrl, { headers: { Accept: 'application/json' } });

      // Fallback sur Phoenix si Frankfurt échoue
      if (!res.ok) {
        searchUrl = `https://phoenix.squid.wtf/search/?s=${encodeURIComponent(query)}`;
        res = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
        
        if (!res.ok) continue;
      }

      const data = await res.json();
      let results = [];
      
      if (Array.isArray(data)) {
        results = data;
      } else if (data?.tracks) {
        results = data.tracks;
      } else if (data?.results) {
        results = data.results;
      } else if (data?.data) {
        results = data.data;
      } else if (data?.items) {
        results = data.items;
      }

      if (results && results.length > 0) {
        const track = results[0];
        const tidalId = track?.id ?? track?.trackId ?? track?.tidalId ?? null;
        
        if (tidalId) {
          console.log(`✅ Tidal ID trouvé: ${tidalId} pour ${title}`);
          return tidalId.toString();
        }
      }
    } catch (error) {
      console.error(`❌ Erreur recherche ${query}:`, error);
      continue;
    }
  }

  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { count = 10 } = await req.json();

    console.log(`🎵 Ajout de ${count} chansons françaises...`);

    // Sélectionner aléatoirement des chansons
    const shuffled = [...FRENCH_SONGS].sort(() => 0.5 - Math.random());
    const selectedSongs = shuffled.slice(0, count);

    const addedSongs: string[] = [];
    const errors: string[] = [];

    for (const song of selectedSongs) {
      try {
        console.log(`🔍 Recherche: ${song.title} - ${song.artist}`);

        // Vérifier si la chanson existe déjà
        const { data: existingSong } = await supabaseClient
          .from('songs')
          .select('id')
          .ilike('title', song.title)
          .ilike('artist', song.artist)
          .maybeSingle();

        if (existingSong) {
          console.log(`⏭️ Chanson déjà existante: ${song.title}`);
          continue;
        }

        // Chercher le Tidal ID
        const tidalId = await searchTidalId(song.title, song.artist);

        if (!tidalId) {
          console.warn(`⚠️ Tidal ID introuvable pour: ${song.title}`);
          errors.push(`${song.title} - ${song.artist}`);
          continue;
        }

        // Récupérer les métadonnées depuis Tidal
        const frankfurtUrl = `https://frankfurt.monochrome.tf/track/?id=${tidalId}&quality=LOSSLESS`;
        const tidalRes = await fetch(frankfurtUrl, { headers: { Accept: 'application/json' } });
        
        let imageUrl = null;
        if (tidalRes.ok) {
          const tidalData = await tidalRes.json();
          if (Array.isArray(tidalData) && tidalData[0]?.album?.cover) {
            imageUrl = tidalData[0].album.cover;
          } else if (tidalData?.album?.cover) {
            imageUrl = tidalData.album.cover;
          }
        }

        // Ajouter la chanson dans la base
        const { data: newSong, error: insertError } = await supabaseClient
          .from('songs')
          .insert({
            title: song.title,
            artist: song.artist,
            file_path: `tidal:${tidalId}`,
            tidal_id: tidalId,
            image_url: imageUrl,
            duration: '3:30', // Durée par défaut
          })
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Erreur insertion ${song.title}:`, insertError);
          errors.push(`${song.title} - ${song.artist}`);
          continue;
        }

        console.log(`✅ Chanson ajoutée: ${song.title}`);
        addedSongs.push(`${song.title} - ${song.artist}`);

      } catch (error) {
        console.error(`❌ Erreur traitement ${song.title}:`, error);
        errors.push(`${song.title} - ${song.artist}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: addedSongs.length,
        addedSongs,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Erreur:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
