import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadLyricsToDropbox } from './dropboxStorage';
import { toast } from 'sonner';

/**
 * Récupère automatiquement les paroles d'une chanson depuis LRCLIB
 */
export const fetchAndSaveLyrics = async (
  songId: string,
  songTitle: string,
  artist?: string,
  duration?: string,
  albumName?: string,
  isTidal?: boolean,
  tidalId?: string
): Promise<void> => {
  try {
    console.log('🎵 Récupération automatique des paroles pour:', songTitle, 'par', artist);

    // Pour les musiques Tidal, ne pas essayer de vérifier/sauvegarder dans la DB
    // car elles n'ont pas d'UUID valide
    if (!isTidal) {
      // Vérifier si les paroles existent déjà pour les musiques locales
      const { data: existingLyrics } = await supabase
        .from('lyrics')
        .select('content')
        .eq('song_id', songId)
        .maybeSingle();

      if (existingLyrics?.content) {
        console.log('✅ Paroles déjà en cache');
        return;
      }
    }

    // Étape 1: Essayer de récupérer les paroles depuis l'API Tidal si c'est une chanson Tidal
    if (isTidal && tidalId) {
      try {
        console.log(`[Tidal Lyrics] Tentative de récupération pour l'ID Tidal: ${tidalId}`);
        const tidalLyricsResponse = await fetch(`https://tidal.kinoplus.online/lyrics/?id=${tidalId}`);
        if (tidalLyricsResponse.ok) {
          const tidalLyricsData = await tidalLyricsResponse.json();
          // La réponse est un tableau, on prend le premier élément
          const lyricsInfo = Array.isArray(tidalLyricsData) ? tidalLyricsData[0] : tidalLyricsData;

          if (lyricsInfo && (lyricsInfo.subtitles || lyricsInfo.lyrics)) {
            const lyricsContent = lyricsInfo.subtitles || lyricsInfo.lyrics;
            console.log('[Tidal Lyrics] Paroles trouvées via l\'API Tidal.');

            // Sauvegarder les paroles dans la base de données pour les chansons locales
            if (!songId.startsWith('tidal-')) {
               await supabase.from('lyrics').upsert({ song_id: songId, content: lyricsContent });
               console.log('[Tidal Lyrics] Paroles sauvegardées dans la DB.');
            }
            
            // Mettre à jour l'UI (si nécessaire, dépend de l'architecture)
            // Pour l'instant, on se contente de sauvegarder.
            return; // On a trouvé les paroles, on arrête ici.
          }
        }
      } catch (e) {
        console.warn('[Tidal Lyrics] Erreur lors de la récupération des paroles depuis l\'API Tidal, fallback sur lrclib.', e);
      }
    }

    // Étape 2: Fallback sur l'edge function (lrclib) si l'étape 1 échoue ou n'est pas applicable
    console.log('[LRCLIB] Fallback: Utilisation de l\'edge function generate-lyrics.');

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
      return;
    }

    const lyricsContent = response.data.syncedLyrics || response.data.lyrics;

    // Sauvegarder dans la base de données uniquement pour les musiques locales (avec UUID valide)
    if (!isTidal) {
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
    } else {
      console.log('ℹ️ Paroles Tidal non sauvegardées (pas d\'UUID)');
    }

    console.log('✅ Paroles récupérées et sauvegardées');
  } catch (error) {
    console.error('❌ Erreur récupération paroles:', error);
    toast.error("Erreur de récupération des paroles", {
      description: error.message || "Impossible de récupérer les paroles pour cette chanson.",
    });
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
  isTidal?: boolean,
  tidalId?: string
): void => {
  // Lancer la récupération en arrière-plan sans attendre
  setTimeout(() => {
    fetchAndSaveLyrics(songId, songTitle, artist, duration, albumName, isTidal, tidalId)
      .catch(error => {
        console.warn('⚠️ Échec récupération paroles en arrière-plan:', error);
      });
  }, 2000); // Attendre 2 secondes après le début de la lecture
};