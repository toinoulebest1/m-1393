import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadLyricsToDropbox } from './dropboxStorage';
import { getInstances } from '@/services/audioProxyService';

/**
 * NOUVEAU: Tente de récupérer les paroles depuis les instances proxy.
 */
const fetchLyricsFromInstances = async (tidalId: string): Promise<string | null> => {
  if (!tidalId) return null;

  console.log(`🎤 Recherche des paroles sur les instances pour l'ID Tidal: ${tidalId}`);
  const instances = await getInstances();

  for (const instance of instances) {
    try {
      const url = new URL(instance);
      const lyricsUrl = `${url.origin}/lyrics/?id=${tidalId}`;
      
      console.log(`Essayage de l'instance: ${lyricsUrl}`);
      const response = await fetch(lyricsUrl, {
        signal: AbortSignal.timeout(3000) // 3s timeout par instance
      });

      if (response.ok) {
        const data = await response.json();
        if (data.subtitle && typeof data.subtitle === 'string' && data.subtitle.trim() !== '') {
          console.log(`✅ Paroles trouvées sur ${url.origin}`);
          return data.subtitle;
        }
      }
    } catch (error: any) {
      const errorMessage = error.name === 'AbortError' ? 'Timeout' : error.message;
      console.warn(`⚠️ Échec de l'instance: ${errorMessage}`);
    }
  }

  console.log('🎤 Aucune parole trouvée sur les instances.');
  return null;
};


/**
 * Récupère automatiquement les paroles d'une chanson depuis LRCLIB
 */
export const fetchAndSaveLyrics = async (
  songId: string,
  songTitle: string,
  artist: string,
  duration?: string,
  albumName?: string,
  isDeezer?: boolean
): Promise<{ syncedLyrics: string | null; plainLyrics: string | null }> => {
  try {
    console.log('🎵 Recherche de paroles pour:', songTitle, 'par', artist);

    // Pour les musiques Deezer/Tidal, ne pas essayer de vérifier/sauvegarder dans la DB
    // car elles n'ont pas d'UUID valide
    if (!isDeezer && !songId.startsWith('deezer-')) {
      // Vérifier si les paroles existent déjà pour les musiques locales
      const { data: existingLyrics } = await supabase
        .from('lyrics')
        .select('content')
        .eq('song_id', songId)
        .maybeSingle();

      if (existingLyrics?.content) {
        console.log('✅ Paroles déjà en cache');
        return {
          syncedLyrics: existingLyrics.content.includes('[') ? existingLyrics.content : null,
          plainLyrics: existingLyrics.content
        };
      }
    }

    let lyricsContent: string | null = null;

    // NOUVEAU: Tenter de récupérer les paroles depuis les instances proxy
    if (!isDeezer && !songId.startsWith('deezer-')) {
      const { data: songData } = await supabase
        .from('songs')
        .select('tidal_id')
        .eq('id', songId)
        .single();
      
      if (songData?.tidal_id) {
        lyricsContent = await fetchLyricsFromInstances(songData.tidal_id);
      }
    }

    // Si les instances n'ont rien donné, utiliser LRCLIB
    if (!lyricsContent) {
      console.log('🎵 Paroles non trouvées sur les instances, appel de LRCLIB.');
      // Convertir la durée de MM:SS en secondes
      let durationInSeconds: number | undefined;
      if (duration) {
        const parts = duration.split(':');
        if (parts.length === 2) {
          durationInSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }

      // Appeler l'edge function pour récupérer les paroles
      const response = await supabase.functions.invoke('generate-lyrics', {
        body: {
          songTitle,
          artist,
          duration: durationInSeconds,
          albumName
        }
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) {
        console.warn('⚠️ Paroles non trouvées sur LRCLIB:', response.data.error);
      } else {
        lyricsContent = response.data.syncedLyrics || response.data.lyrics;
      }
    }

    // Sauvegarder dans la base de données uniquement pour les musiques locales (avec UUID valide)
    if (lyricsContent && !isDeezer && !songId.startsWith('deezer-')) {
      const { error: insertError } = await supabase
        .from('lyrics')
        .upsert({
          song_id: songId,
          content: lyricsContent
        });

      if (insertError) {
        console.error('❌ Erreur sauvegarde paroles:', insertError);
      } else {
        console.log('✅ Paroles sauvegardées dans la DB');
      }

      // Sauvegarder dans Dropbox si activé
      if (isDropboxEnabled()) {
        try {
          await uploadLyricsToDropbox(songId, lyricsContent);
          console.log('✅ Paroles sauvegardées dans Dropbox');
        } catch (error) {
          console.warn('⚠️ Échec sauvegarde Dropbox:', error);
        }
      }
    } else if (!lyricsContent) {
      console.log('ℹ️ Aucune parole trouvée pour cette chanson.');
    }

    return {
      syncedLyrics: lyricsContent && lyricsContent.includes('[') ? lyricsContent : null,
      plainLyrics: lyricsContent
    };
  } catch (error) {
    console.error('❌ Erreur récupération paroles:', error);
    return { syncedLyrics: null, plainLyrics: null };
  }
};

/**
 * Récupère les paroles en arrière-plan sans bloquer la lecture
 */
export const fetchLyricsInBackground = (
  songId: string,
  songTitle: string,
  artist: string,
  duration?: string,
  albumName?: string,
  isDeezer?: boolean
): void => {
  // Lancer la récupération en arrière-plan sans attendre
  setTimeout(() => {
    fetchAndSaveLyrics(songId, songTitle, artist, duration, albumName, isDeezer)
      .catch(error => {
        console.warn('⚠️ Échec récupération paroles en arrière-plan:', error);
      });
  }, 2000); // Attendre 2 secondes après le début de la lecture
};