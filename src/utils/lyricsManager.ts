import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadLyricsToDropbox } from './dropboxStorage';
import { toast } from 'sonner';

/**
 * Récupère automatiquement les paroles d'une chanson DEPUIS TIDAL UNIQUEMENT.
 * Retourne les paroles si trouvées, sinon null.
 */
export const fetchAndSaveLyrics = async (
  songId: string,
  songTitle: string,
  artist?: string,
  duration?: string,
  albumName?: string,
  isTidal?: boolean,
  tidalId?: string
): Promise<string | null> => {
  try {
    // console.log('🎵 [lyricsManager] Démarrage de fetchAndSaveLyrics pour:', { songId, songTitle, isTidal, tidalId });

    // 1. Vérifier si les paroles existent déjà dans la DB
    // console.log(`[lyricsManager] 1. Vérification DB pour song_id: ${songId}`);
    const { data: existingLyrics, error: checkError } = await supabase
      .from('lyrics')
      .select('content')
      .eq('song_id', songId)
      .limit(1)
      .maybeSingle();

    if (checkError) {
      console.error(`[lyricsManager] Erreur lors de la vérification DB:`, checkError);
    }

    if (existingLyrics?.content) {
      // console.log('✅ [lyricsManager] 1.1. Paroles déjà en cache dans la DB. Fin.');
      return existingLyrics.content;
    }
    // console.log('[lyricsManager] 1.2. Aucune parole trouvée en cache.');

    // 2. Extraire l'ID Tidal et vérifier s'il existe
    let effectiveTidalId = tidalId;
    if (!effectiveTidalId && songId && songId.startsWith('tidal-')) {
      effectiveTidalId = songId.substring(6);
    }
    // console.log(`[lyricsManager] 2. ID Tidal effectif: ${effectiveTidalId}`);

    // 3. Si ce n'est pas une chanson Tidal, on s'arrête ici.
    if (!effectiveTidalId) {
      // console.log('[lyricsManager] 3. Pas un morceau Tidal. Arrêt de la recherche de paroles.');
      return null;
    }

    // 4. Récupérer les paroles depuis l'API Tidal
    let lyricsContent: string | null = null;
    
    if (effectiveTidalId) {
      // console.log(`[lyricsManager] 4. Tentative de récupération depuis l'API Tidal...`);
      const tidalApiUrl = `https://tidal.kinoplus.online/lyrics/?id=${effectiveTidalId}`;
      // console.log(`[lyricsManager] 4.1. URL de l'API: ${tidalApiUrl}`);
      const tidalLyricsResponse = await fetch(tidalApiUrl);

      // console.log(`[lyricsManager] 4.2. Réponse de l'API: Statut ${tidalLyricsResponse.status}`);
      if (tidalLyricsResponse.ok) {
        const tidalLyricsData = await tidalLyricsResponse.json();
        // console.log('[lyricsManager] 4.3. Données JSON reçues:', tidalLyricsData);
        const lyricsInfo = Array.isArray(tidalLyricsData) ? tidalLyricsData[0] : tidalLyricsData;

        if (lyricsInfo && (lyricsInfo.subtitles || lyricsInfo.lyrics)) {
          lyricsContent = lyricsInfo.subtitles || lyricsInfo.lyrics;
          // console.log('[lyricsManager] 5. Paroles trouvées via l\'API Tidal. Contenu (100 premiers caractères):', lyricsContent.substring(0, 100));
        }
      } else {
        console.warn(`[lyricsManager] L'API Tidal a répondu avec une erreur.`);
      }
    }

    // 5. Si pas de paroles Tidal, essayer l'API de paroles synchronisées générique
    if (!lyricsContent && artist && songTitle) {
      // console.log('[lyricsManager] 5.1. Tentative de récupération depuis l\'API de paroles synchronisées...');
      try {
        const lyricsApiUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(songTitle)}`;
        const lyricsResponse = await fetch(lyricsApiUrl);
        
        if (lyricsResponse.ok) {
          const lyricsData = await lyricsResponse.json();
          if (lyricsData && lyricsData.syncedLyrics) {
            lyricsContent = lyricsData.syncedLyrics;
            // console.log('[lyricsManager] 5.2. Paroles synchronisées trouvées via l\'API générique.');
          } else if (lyricsData && lyricsData.plainLyrics) {
            lyricsContent = lyricsData.plainLyrics;
            // console.log('[lyricsManager] 5.3. Paroles non synchronisées trouvées via l\'API générique.');
          }
        }
      } catch (error) {
        console.warn('[lyricsManager] Erreur lors de la récupération depuis l\'API de paroles:', error);
      }
    }

    if (lyricsContent) {

      // 6. Sauvegarder les paroles dans la base de données
      // console.log(`[lyricsManager] 6. Sauvegarde dans la DB pour song_id: ${songId}`);
      const { error: insertError } = await supabase
        .from('lyrics')
        .upsert({ song_id: songId, content: lyricsContent }, { onConflict: 'song_id' });

      if (insertError) {
        console.error('[lyricsManager] 6.1. ERREUR lors de la sauvegarde dans la DB:', insertError);
        // Ne pas bloquer le retour des paroles même si la sauvegarde échoue
      } else {
        // console.log(`[lyricsManager] 6.2. Paroles sauvegardées avec succès.`);
      }

      // 7. Sauvegarder dans Dropbox si activé
      if (isDropboxEnabled()) {
        // console.log('[lyricsManager] 7. Tentative de sauvegarde Dropbox...');
        uploadLyricsToDropbox(songId, lyricsContent).catch(error => {
          console.warn('⚠️ [lyricsManager] 7.2. Échec sauvegarde Dropbox:', error);
        });
      }
      
      return lyricsContent; // Retourner les paroles trouvées
    }

    // console.log('[lyricsManager] Aucune parole trouvée depuis aucune source.');
    return null;
  } catch (error) {
    console.error('❌ [lyricsManager] Erreur globale dans fetchAndSaveLyrics:', error);
    toast.error("Erreur de récupération des paroles", {
      description: (error as Error).message || "Impossible de récupérer les paroles pour cette chanson.",
    });
    return null;
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
  // console.log('[lyricsManager] Appel de fetchLyricsInBackground. Lancement de la tâche en arrière-plan...');
  // Lancer la récupération en arrière-plan sans attendre
  setTimeout(() => {
    fetchAndSaveLyrics(songId, songTitle, artist, duration, albumName, isTidal, tidalId)
      .catch(error => {
        console.warn('⚠️ [lyricsManager] Échec de la récupération des paroles en arrière-plan:', error);
      });
  }, 2000); // Attendre 2 secondes après le début de la lecture
};