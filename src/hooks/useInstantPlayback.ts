import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Précharge instantanée des URLs audio pour lecture ultra-rapide
export const useInstantPlayback = (songs: any[]) => {
  useEffect(() => {
    if (!songs || songs.length === 0) return;

    const preloadSongs = async () => {
      // Précharger les 10 premières chansons en parallèle
      const preloadPromises = songs.slice(0, 10).map(async (song) => {
        try {
          // Préchargement via Deezmate/Flacdownloader
          if (song.deezer_id) {
            try {
              console.log('🎵 Préchargement Deezmate/Flacdownloader:', song.deezer_id);
              const { audioProxyService } = await import('@/services/audioProxyService');
              await audioProxyService.preloadTrack(song.deezer_id, 'LOSSLESS');
              console.log('✅ Préchargement terminé:', song.title);
            } catch (error) {
              console.warn('⚠️ Préchargement échoué:', song.title, error);
            }
          }
        } catch (error) {
          console.warn('⚠️ Erreur préchargement:', song.title, error);
        }
      });

      await Promise.all(preloadPromises);
      console.log('🎯 Préchargement terminé pour', songs.slice(0, 10).length, 'chansons');
    };

    // Lancer le préchargement après un court délai pour ne pas bloquer le rendu
    const timer = setTimeout(() => {
      preloadSongs();
    }, 100);

    return () => clearTimeout(timer);
  }, [songs]);
};