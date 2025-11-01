import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadLyricsToDropbox } from './dropboxStorage';

/**
 * Récupère automatiquement les paroles d'une chanson depuis LRCLIB
 */
export const fetchAndSaveLyrics = async (
  songId: string,
  songTitle: string,
  artist: string,
  duration?: string,
  albumName?: string
): Promise<{ syncedLyrics: string | null; plainLyrics: string | null }> => {
  try {
    console.log('🎵 Récupération automatique des paroles pour:', songTitle, 'par', artist);

    // Vérifier si les paroles existent déjà
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

    if (response.error) {
      throw new Error(response.error.message);
    }

    if (response.data.error) {
      console.warn('⚠️ Paroles non trouvées:', response.data.error);
      return { syncedLyrics: null, plainLyrics: null };
    }

    const lyricsContent = response.data.syncedLyrics || response.data.lyrics;

    // Sauvegarder dans la base de données
    const { error: insertError } = await supabase
      .from('lyrics')
      .upsert({
        song_id: songId,
        content: lyricsContent
      });

    if (insertError) {
      console.error('❌ Erreur sauvegarde paroles:', insertError);
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

    console.log('✅ Paroles récupérées et sauvegardées');
    return {
      syncedLyrics: response.data.syncedLyrics,
      plainLyrics: response.data.lyrics
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
  albumName?: string
): void => {
  // Lancer la récupération en arrière-plan sans attendre
  setTimeout(() => {
    fetchAndSaveLyrics(songId, songTitle, artist, duration, albumName)
      .catch(error => {
        console.warn('⚠️ Échec récupération paroles en arrière-plan:', error);
      });
  }, 2000); // Attendre 2 secondes après le début de la lecture
};
