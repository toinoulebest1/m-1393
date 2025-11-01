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

// Fonction pour chercher une pochette sur Deezer
async function searchDeezerCover(title: string, artist: string): Promise<string | null> {
  try {
    const query = `${artist} ${title}`;
    const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}`;
    
    const res = await fetch(searchUrl);
    if (!res.ok) return null;
    
    const data = await res.json();
    
    if (data?.data && data.data.length > 0) {
      const track = data.data[0];
      const coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || track.album?.cover;
      
      if (coverUrl) {
        console.log(`🖼️ Pochette Deezer trouvée pour ${title}`);
        return coverUrl;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Erreur recherche Deezer pour ${title}:`, error);
    return null;
  }
}

// Fonction pour chercher les paroles sur lrclib
async function searchLrcLibLyrics(title: string, artist: string): Promise<string | null> {
  try {
    const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    
    const res = await fetch(searchUrl);
    if (!res.ok) return null;
    
    const data = await res.json();
    
    if (Array.isArray(data) && data.length > 0) {
      const lyrics = data[0];
      const syncedLyrics = lyrics.syncedLyrics || lyrics.plainLyrics;
      
      if (syncedLyrics) {
        console.log(`📝 Paroles trouvées pour ${title}`);
        return syncedLyrics;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Erreur recherche paroles pour ${title}:`, error);
    return null;
  }
}

// Fonction pour chercher un titre sur Tidal
async function searchTidalId(title: string, artist: string): Promise<string | null> {
  // Utiliser le format "titre, artiste" avec virgule pour plus de précision
  const queries = [
    `${title}, ${artist}`.trim(), // 1. Titre, artiste (format optimal - priorité)
    `${title} ${artist}`.trim(), // 2. Titre + artiste
    `${artist} ${title}`.trim(), // 3. Artiste + titre
    title.trim(), // 4. Titre seul (en dernier recours)
  ].filter(q => q.length > 0);

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
        const normalize = (s: string) => s
          ?.toLowerCase()
          ?.normalize('NFD')
          ?.replace(/[\u0300-\u036f]/g, '')
          ?.replace(/[^a-z0-9\s]/g, ' ')
          ?.replace(/\s+/g, ' ')
          ?.trim();
        const simplifyTitle = (s: string) => normalize(String(s || '')).split(/\s*-\s*|\(|\[|\{/)[0];

        const expectedArtist = normalize(artist);
        const expectedTitle = simplifyTitle(title);
        const aliases = new Set<string>([
          expectedArtist,
          expectedArtist.replace(/^maitre\s+/,'').trim(), // "maitre gims" -> "gims"
          expectedArtist.replace('gims','maitre gims').trim(),
        ]);

        let best: any = null;
        let bestScore = -1;

        for (const tr of results as any[]) {
          const candId = tr?.id ?? tr?.trackId ?? tr?.tidalId ?? null;
          if (!candId) continue;

          const candTitle = simplifyTitle(tr?.title || tr?.name || tr?.trackName || '');

          const artistsList: string[] = [];
          if (tr?.artist?.name) artistsList.push(tr.artist.name);
          if (Array.isArray(tr?.artists)) artistsList.push(...tr.artists.map((a: any) => a?.name).filter(Boolean));
          if (tr?.artist_name) artistsList.push(tr.artist_name);
          if (tr?.artist) artistsList.push(tr.artist);
          const candArtists = artistsList.map(normalize).filter(Boolean);

          const hasExactArtist = candArtists.some(a => aliases.has(a));
          const hasPartialArtist = candArtists.some(a => a?.includes(expectedArtist) || expectedArtist.includes(a));

          const titleExact = candTitle === expectedTitle;
          const titleStarts = candTitle.startsWith(expectedTitle);
          const titleIncludes = candTitle.includes(expectedTitle);

          let score = 0;
          if (hasExactArtist) score += 100;
          else if (hasPartialArtist) score += 50;

          if (titleExact) score += 30;
          else if (titleStarts) score += 15;
          else if (titleIncludes) score += 10;

          const popularity = tr?.popularity || tr?.popularityScore || 0;
          score += Math.min(5, Math.floor(popularity / 20));

          if (score > bestScore) {
            bestScore = score;
            best = tr;
          }
        }

        if (best) {
          const bestId = best?.id ?? best?.trackId ?? best?.tidalId;
          console.log(`✅ Tidal ID choisi avec correspondance stricte: ${bestId}`);
          return String(bestId);
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
    const addedSongIds: string[] = [];
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

        // Chercher la pochette sur Deezer
        const imageUrl = await searchDeezerCover(song.title, song.artist);

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

        // Chercher et ajouter les paroles
        const lyrics = await searchLrcLibLyrics(song.title, song.artist);
        if (lyrics && newSong) {
          const { error: lyricsError } = await supabaseClient
            .from('lyrics')
            .insert({
              song_id: newSong.id,
              content: lyrics,
            });

          if (lyricsError) {
            console.error(`⚠️ Erreur ajout paroles pour ${song.title}:`, lyricsError);
          } else {
            console.log(`📝 Paroles ajoutées pour ${song.title}`);
          }
        }

        console.log(`✅ Chanson ajoutée: ${song.title}`);
        addedSongs.push(`${song.title} - ${song.artist}`);
        addedSongIds.push(newSong.id);

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
        addedSongIds,
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
