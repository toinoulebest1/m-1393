import { useEffect } from 'react';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';

// Précharge instantanée des URLs audio pour lecture ultra-rapide
export const useInstantPlayback = (songs: any[], enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled || !songs || songs.length === 0) {
      console.log("[useInstantPlayback] Preloading disabled or no songs to preload.");
      return;
    }

    const preloadSongUrls = async () => {
      // Précharger les 5 premières chansons en parallèle
      const songsToPreload = songs.slice(0, 5);
      console.log(`🎵 Début du préchargement pour ${songsToPreload.length} chansons.`);

      const preloadPromises = songsToPreload.map(async (song) => {
        try {
          console.log(`⚡ Préchargement URL pour: ${song.title}`);
          await UltraFastStreaming.getAudioUrlUltraFast(song.url, song.title, song.artist, song.id);
          console.log(`✅ URL préchargée pour: ${song.title}`);
        } catch (error) {
          console.warn(`⚠️ Échec du préchargement pour: ${song.title}`, error);
        }
      });

      await Promise.all(preloadPromises);
      console.log(`🎯 Préchargement des URLs terminé pour ${songsToPreload.length} chansons.`);
    };

    // Lancer le préchargement quasi-immédiatement
    const timer = setTimeout(() => {
      preloadSongUrls();
    }, 100); // Réduit à 100ms pour démarrage ultra-rapide

    return () => clearTimeout(timer);
  }, [songs, enabled]);
};