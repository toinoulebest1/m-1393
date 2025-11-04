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

      // Préchargement Deezer via Deezmate (priorité absolue)
      if (song.deezer_id) {
        try {
          const deezmateUrl = `https://api.deezmate.com/dl/${song.deezer_id}`;
          const res = await fetch(deezmateUrl);
          
          if (res.ok) {
            const audioUrl = await res.text();
            if (audioUrl && audioUrl.startsWith('http')) {
              console.log('✅ URL Deezmate préchargée:', song.title);
            }
          }
        } catch (error) {
          console.warn('⚠️ Préchargement Deezmate échoué:', song.title, error);
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
