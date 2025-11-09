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
    console.log('🎵 [lyricsManager] Démarrage de fetchAndSaveLyrics pour:', { songId, songTitle, isTidal, tidalId });

    // 1. Vérifier si les paroles existent déjà dans la DB
    console.log(`[lyricsManager] 1. Vérification DB pour song_id: ${songId}`);
    const { data: existingLyrics, error: checkError } = await supabase
      .from('lyrics')
      .select('content')
      .eq('song_id', songId)
      .maybeSingle();

    if (checkError) {
      console.error(`[lyricsManager] Erreur lors de la vérification DB:`, checkError);
    }

    if (existingLyrics?.content) {
      console.log('✅ [lyricsManager] 1.1. Paroles déjà en cache dans la DB. Fin.');
      return;
    }
    console.log('[lyricsManager] 1.2. Aucune parole trouvée en cache.');

    // 2. Extraire l'ID Tidal et vérifier s'il existe
    let effectiveTidalId = tidalId;
    if (!effectiveTidalId && songId && songId.startsWith('tidal-')) {
      effectiveTidalId = songId.substring(6);
    }
    console.log(`[lyricsManager] 2. ID Tidal effectif: ${effectiveTidalId}`);

    // 3. Si ce n'est pas une chanson Tidal, on s'arrête ici.
    if (!effectiveTidalId) {
      console.log('[lyricsManager] 3. Pas un morceau Tidal. Arrêt de la recherche de paroles.');
      return;
    }

    // 4. Récupérer les paroles depuis l'API Tidal
    console.log(`[lyricsManager] 4. Tentative de récupération depuis l'API Tidal...`);
    const tidalApiUrl = `https://tidal.kinoplus.online/lyrics/?id=${effectiveTidalId}`;
    console.log(`[lyricsManager] 4.1. URL de l'API: ${tidalApiUrl}`);
    const tidalLyricsResponse = await fetch(tidalApiUrl);

    console.log(`[lyricsManager] 4.2. Réponse de l'API: Statut ${tidalLyricsResponse.status}`);
    if (!tidalLyricsResponse.ok) {
      console.warn(`[lyricsManager] L'API a répondu avec une erreur. Pas de paroles trouvées.`);
      return;
    }

    const tidalLyricsData = await tidalLyricsResponse.json();
    console.log('[lyricsManager] 4.3. Données JSON reçues:', tidalLyricsData);
    const lyricsInfo = Array.isArray(tidalLyricsData) ? tidalLyricsData[0] : tidalLyricsData;

    if (lyricsInfo && (lyricsInfo.subtitles || lyricsInfo.lyrics)) {
      const lyricsContent = lyricsInfo.subtitles || lyricsInfo.lyrics;
      console.log('[lyricsManager] 5. Paroles trouvées via l\'API Tidal. Contenu (100 premiers caractères):', lyricsContent.substring(0, 100));

      // 5. Sauvegarder les paroles dans la base de données
      console.log(`[lyricsManager] 6. Sauvegarde dans la DB pour song_id: ${songId}`);
      const { error: insertError } = await supabase
        .from('lyrics')
        .upsert({ song_id: songId, content: lyricsContent });

      if (insertError) {
        console.error('[lyricsManager] 6.1. ERREUR lors de la sauvegarde dans la DB:', insertError);
        throw insertError;
      }
      console.log(`[lyricsManager] 6.2. Paroles sauvegardées avec succès.`);

      // 6. Sauvegarder dans Dropbox si activé
      if (isDropboxEnabled()) {
        console.log('[lyricsManager] 7. Tentative de sauvegarde Dropbox...');
        try {
          await uploadLyricsToDropbox(songId, lyricsContent);
          console.log('✅ [lyricsManager] 7.1. Paroles sauvegardées dans Dropbox');
        } catch (error) {
          console.warn('⚠️ [lyricsManager] 7.2. Échec sauvegarde Dropbox:', error);
        }
      }
    } else {
      console.log('[lyricsManager] 5.1. Aucune parole (`subtitles` ou `lyrics`) trouvée dans la réponse JSON.');
    }
  } catch (error) {
    console.error('❌ [lyricsManager] Erreur globale dans fetchAndSaveLyrics:', error);
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
  console.log('[lyricsManager] Appel de fetchLyricsInBackground. Lancement de la tâche en arrière-plan...');
  // Lancer la récupération en arrière-plan sans attendre
  setTimeout(() => {
    fetchAndSaveLyrics(songId, songTitle, artist, duration, albumName, isTidal, tidalId)
      .catch(error => {
        console.warn('⚠️ [lyricsManager] Échec de la récupération des paroles en arrière-plan:', error);
      });
  }, 2000); // Attendre 2 secondes après le début de la lecture
};