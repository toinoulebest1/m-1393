import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadLyricsToDropbox } from './dropboxStorage';
import { toast } from 'sonner';

/**
 * Récupère automatiquement les paroles d'une chanson DEPUIS TIDAL UNIQUEMENT.
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
    console.log('🎵 [lyricsManager] Démarrage de fetchAndSaveLyrics pour:', songTitle);

    // 1. Vérifier si les paroles existent déjà dans la DB
    const { data: existingLyrics } = await supabase
      .from('lyrics')
      .select('content')
      .eq('song_id', songId)
      .maybeSingle();

    if (existingLyrics?.content) {
      console.log('✅ [DB Check] Paroles déjà en cache dans la DB. Fin.');
      return;
    }

    // 2. Extraire l'ID Tidal et vérifier s'il existe
    let effectiveTidalId = tidalId;
    if (!effectiveTidalId && songId && songId.startsWith('tidal-')) {
      effectiveTidalId = songId.substring(6);
    }

    // 3. Si ce n'est pas une chanson Tidal, on s'arrête ici.
    if (!effectiveTidalId) {
      console.log('[lyricsManager] Pas un morceau Tidal. Arrêt de la recherche de paroles.');
      return;
    }

    // 4. Récupérer les paroles depuis l'API Tidal
    console.log(`[Tidal Lyrics] ID Tidal détecté: ${effectiveTidalId}. Tentative de récupération...`);
    const tidalApiUrl = `https://tidal.kinoplus.online/lyrics/?id=${effectiveTidalId}`;
    const tidalLyricsResponse = await fetch(tidalApiUrl);

    if (!tidalLyricsResponse.ok) {
      console.warn(`[Tidal Lyrics] L'API a répondu avec le statut ${tidalLyricsResponse.status}. Pas de paroles trouvées.`);
      return;
    }

    const tidalLyricsData = await tidalLyricsResponse.json();
    const lyricsInfo = Array.isArray(tidalLyricsData) ? tidalLyricsData[0] : tidalLyricsData;

    if (lyricsInfo && (lyricsInfo.subtitles || lyricsInfo.lyrics)) {
      const lyricsContent = lyricsInfo.subtitles || lyricsInfo.lyrics;
      console.log('[Tidal Lyrics] Paroles trouvées via l\'API Tidal.');

      // 5. Sauvegarder les paroles dans la base de données
      const { error: insertError } = await supabase
        .from('lyrics')
        .upsert({ song_id: songId, content: lyricsContent });

      if (insertError) {
        throw insertError;
      }
      console.log(`[Tidal Lyrics] Paroles sauvegardées avec succès pour song_id: ${songId}.`);

      // 6. Sauvegarder dans Dropbox si activé
      if (isDropboxEnabled()) {
        try {
          await uploadLyricsToDropbox(songId, lyricsContent);
          console.log('✅ Paroles sauvegardées dans Dropbox');
        } catch (error) {
          console.warn('⚠️ Échec sauvegarde Dropbox:', error);
        }
      }
    } else {
      console.log('[Tidal Lyrics] Aucune parole (`subtitles` ou `lyrics`) trouvée dans la réponse JSON.');
    }
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
  console.log('[lyricsManager] fetchLyricsInBackground a été appelé.');
  // Lancer la récupération en arrière-plan sans attendre
  setTimeout(() => {
    fetchAndSaveLyrics(songId, songTitle, artist, duration, albumName, isTidal, tidalId)
      .catch(error => {
        console.warn('⚠️ Échec récupération paroles en arrière-plan:', error);
      });
  }, 2000); // Attendre 2 secondes après le début de la lecture
};