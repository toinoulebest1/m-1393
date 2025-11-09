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
    // console.log(`[lyricsManager] 4. Tentative de récupération depuis l'API Tidal...`);
    const tidalApiUrl = `https://tidal.kinoplus.online/lyrics/?id=${effectiveTidalId}`;
    // console.log(`[lyricsManager] 4.1. URL de l'API: ${tidalApiUrl}`);
    const tidalLyricsResponse = await fetch(tidalApiUrl);

    // console.log(`[lyricsManager] 4.2. Réponse de l'API: Statut ${tidalLyricsResponse.status}`);
    if (!tidalLyricsResponse.ok) {
      console.warn(`[lyricsManager] L'API a répondu avec une erreur. Pas de paroles trouvées.`);
      return null;
    }

    const tidalLyricsData = await tidalLyricsResponse.json();
    // console.log('[lyricsManager] 4.3. Données JSON reçues:', tidalLyricsData);
    const lyricsInfo = Array.isArray(tidalLyricsData) ? tidalLyricsData[0] : tidalLyricsData;

    if (lyricsInfo && (lyricsInfo.subtitles || lyricsInfo.lyrics)) {
      const lyricsContent = lyricsInfo.subtitles || lyricsInfo.lyrics;
      // console.log('[lyricsManager] 5. Paroles trouvées via l\'API Tidal. Contenu (100 premiers caractères):', lyricsContent.substring(0, 100));

      // <think>Initial files ranking:

supabase/functions/audio-proxy/index.ts: 0.98

src/contexts/PlayerContext.tsx: 0.95

src/utils/ultraFastStreaming.ts: 0.94

src/hooks/useAudioControl.ts: 0.94

src/types/player.ts: 0.88

src/hooks/usePlayerState.ts: 0.86

src/components/SyncedLyricsView.tsx: 0.82

src/hooks/useInstantPlayback.ts: 0.82

src/hooks/useUltraFastPlayer.ts: 0.82

src/hooks/usePlayerPreferences.ts: 0.77

src/components/Player.tsx: 0.73

src/components/CastButton.tsx: 0.70

src/hooks/usePlayerQueue.ts: 0.65

src/utils/ultraFastCache.ts: 0.64

src/pages/Index.tsx: 0.63

src/components/LyricsFullscreenView.tsx: 0.61

src/services/tidalService.ts: 0.60

src/App.tsx: 0.59

src/components/LrcPlayer.tsx: 0.57

src/utils/audioCache.ts: 0.53

src/components/SongPicker.tsx: 0.52

src/components/SongCard.tsx: 0.52

src/utils/clearAllCaches.ts: 0.52

src/pages/Favorites.tsx: 0.51

src/utils/audioElementPool.ts: 0.49

src/utils/mediaSession.ts: 0.48

src/pages/History.tsx: 0.46

src/components/TidalSearchDialog.tsx: 0.44

src/hooks/usePlayerFavorites.ts: 0.44

src/utils/predictivePreloader.ts: 0.43

src/hooks/useIntelligentPreloader.ts: 0.43

src/utils/autoplayManager.ts: 0.42

src/components/AudioCacheManager.tsx: 0.40

src/utils/audioAnalysis.ts: 0.38

src/pages/Search.tsx: 0.37

src/components/NowPlaying.tsx: 0.36

src/components/Sidebar.tsx: 0.36

src/components/MusicUploader.tsx: 0.34

src/integrations/supabase/client.ts: 0.32

src/utils/storage.ts: 0.31

src/utils/memoryCache.ts: 0.31

src/pages/Top100.tsx: 0.31

src/services/gameSongsService.ts: 0.30

src/components/ui/use-toast.ts: 0.28

src/components/ReportSongDialog.tsx: 0.28

src/utils/lyricsManager.ts: 0.28

src/lib/utils.ts: 0.27

src/components/UnavailableSongCard.tsx: 0.27

src/components/MusicDiscovery.tsx: 0.27

src/pages/Landing.tsx: 0.26

src/components/MusicPreferences.tsx: 0.26</think><think>Re-ranking the files. Please wait a moment...

Reasoning: undefined

</think><dyad-codebase-context files="supabase/functions/audio-proxy/index.ts,src/utils/ultraFastStreaming.ts,src/contexts/PlayerContext.tsx,src/components/LyricsFullscreenView.tsx,src/components/CastButton.tsx,src/components/MusicUploader.tsx,src/components/NowPlaying.tsx,src/components/Player.tsx,src/pages/Favorites.tsx,src/pages/Index.tsx,src/pages/Top100.tsx,src/pages/Search.tsx,src/pages/History.tsx,src/components/SyncedLyricsView.tsx,src/utils/lyricsManager.ts"></dyad-codebase-context><think>dyad-token-savings?original-tokens=283443.25&smart-context-tokens=63889.25</think> 5. Sauvegarder les paroles dans la base de données
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

      // 6. Sauvegarder dans Dropbox si activé
      if (isDropboxEnabled()) {
        // console.log('[lyricsManager] 7. Tentative de sauvegarde Dropbox...');
        uploadLyricsToDropbox(songId, lyricsContent).catch(error => {
          console.warn('⚠️ [lyricsManager] 7.2. Échec sauvegarde Dropbox:', error);
        });
      }
      
      return lyricsContent; // Retourner les paroles trouvées
    } else {
      // console.log('[lyricsManager] 5.1. Aucune parole (`subtitles` ou `lyrics`) trouvée dans la réponse JSON.');
      return null;
    }
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