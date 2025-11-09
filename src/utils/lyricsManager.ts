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
  isTidal?: boolean, // Cet argument est conservé pour la compatibilité mais ne sera plus la source de vérité
  tidalId?: string
): Promise<void> => {
  try {
    console.log('🎵 [lyricsManager] Démarrage de fetchAndSaveLyrics pour:', songTitle);
    console.log('   [lyricsManager] Données reçues:', { songId, songTitle, artist, duration, albumName, isTidal, tidalId });

    // Logique améliorée : extraire l'ID Tidal depuis le songId si possible
    let effectiveTidalId = tidalId;
    if (!effectiveTidalId && songId && songId.startsWith('tidal-')) {
      effectiveTidalId = songId.substring(6); // Prend tout ce qui suit "tidal-"
      console.log(`[lyricsManager] ID Tidal extrait depuis songId: ${effectiveTidalId}`);
    }

    // Si un ID Tidal est présent (soit via la prop, soit extrait), c'est notre source prioritaire.
    if (effectiveTidalId) {
      try {
        console.log(`[Tidal Lyrics] ID Tidal détecté: ${effectiveTidalId}. Tentative de récupération...`);
        const tidalApiUrl = `https://tidal.kinoplus.online/lyrics/?id=${effectiveTidalId}`;
        console.log(`[Tidal Lyrics] Appel de l'API: ${tidalApiUrl}`);
        const tidalLyricsResponse = await fetch(tidalApiUrl);
        
        console.log(`[Tidal Lyrics] Réponse de l'API: statut ${tidalLyricsResponse.status}`);

        if (tidalLyricsResponse.ok) {
          const tidalLyricsData = await tidalLyricsResponse.json();
          console.log('[Tidal Lyrics] Données JSON reçues:', tidalLyricsData);
          const lyricsInfo = Array.isArray(tidalLyricsData) ? tidalLyricsData[0] : tidalLyricsData;

          if (lyricsInfo && (lyricsInfo.subtitles || lyricsInfo.lyrics)) {
            const lyricsContent = lyricsInfo.subtitles || lyricsInfo.lyrics;
            console.log('[Tidal Lyrics] Paroles trouvées via l\'API Tidal. Contenu:', lyricsContent.substring(0, 100) + '...');

            // Sauvegarder les paroles dans la base de données, même pour les chansons Tidal,
            // en utilisant l'UUID de la chanson locale comme clé.
            console.log(`[Tidal Lyrics] Sauvegarde dans la DB pour song_id: ${songId}.`);
            await supabase.from('lyrics').upsert({ song_id: songId, content: lyricsContent });
            console.log(`[Tidal Lyrics] Paroles sauvegardées avec succès.`);
            
            return; // On a trouvé et sauvegardé les paroles, on arrête ici.
          } else {
            console.log('[Tidal Lyrics] Aucune parole (`subtitles` ou `lyrics`) trouvée dans la réponse JSON.');
          }
        }
      } catch (e) {
        console.warn('[Tidal Lyrics] Erreur lors de la récupération via l\'API Tidal, fallback sur lrclib.', e);
      }
    } else {
      console.log('[lyricsManager] Aucun ID Tidal fourni ou extrait. Passage à la vérification de la DB.');
    }

    // Vérifier si les paroles existent déjà dans la DB (pour les musiques non-Tidal ou si l'API Tidal a échoué)
    console.log(`[DB Check] Vérification des paroles existantes pour song_id: ${songId}`);
    const { data: existingLyrics } = await supabase
      .from('lyrics')
      .select('content')
      .eq('song_id', songId)
      .maybeSingle();

    if (existingLyrics?.content) {
      console.log('✅ [DB Check] Paroles déjà en cache dans la DB. Fin.');
      return;
    }

    // Fallback sur l'edge function (lrclib) si aucune parole n'a été trouvée jusqu'à présent
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

    // Sauvegarder dans la base de données
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
  console.log('[lyricsManager] fetchLyricsInBackground a été appelé.');
  // Lancer la récupération en arrière-plan sans attendre
  setTimeout(() => {
    fetchAndSaveLyrics(songId, songTitle, artist, duration, albumName, isTidal, tidalId)
      .catch(error => {
        console.warn('⚠️ Échec récupération paroles en arrière-plan:', error);
      });
  }, 2000); // Attendre 2 secondes après le début de la lecture
};