
import { useState, useEffect, useRef, useCallback } from 'react';
import { PlayerPreferences } from '@/types/player';
import { isInCache, getFromCache, addToCache } from '@/utils/audioCache';

export const usePlayerPreferences = () => {
  const [preferences, setPreferences] = useState<PlayerPreferences>({
    crossfadeEnabled: false,
    crossfadeDuration: 3,
  });
  
  const overlapTimeRef = useRef<number>(3);
  const fadingRef = useRef<boolean>(false);
  const fadeIntervalRef = useRef<number | null>(null);

  // Charger les préférences de l'utilisateur depuis Supabase
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data } = await supabase
          .from('music_preferences')
          .select('crossfade_enabled, crossfade_duration')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (data) {
          setPreferences({
            crossfadeEnabled: data.crossfade_enabled,
            crossfadeDuration: data.crossfade_duration,
          });
          overlapTimeRef.current = data.crossfade_duration || 3;
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    };

    loadPreferences();
  }, []);

  // Fonction pour précharger les pistes suivantes (optimisée)
  const preloadNextTracks = useCallback(async () => {
    try {
      const currentSongStr = localStorage.getItem('currentSong');
      const queueStr = localStorage.getItem('queue');
      
      if (!currentSongStr || !queueStr) return;
      
      const currentSong = JSON.parse(currentSongStr);
      const queue = JSON.parse(queueStr);
      
      if (!currentSong || queue.length === 0) return;
      
      const currentIndex = queue.findIndex((song: any) => song.id === currentSong.id);
      if (currentIndex === -1) return;
      
      const tracksToPreload = queue.slice(currentIndex + 1, currentIndex + 2); // Réduit à 1 seule piste
      
      for (const track of tracksToPreload) {
        if (await isInCache(track.url)) {
          continue; // Déjà en cache
        }
        
        // Préchargement léger (HEAD request d'abord)
        const { getAudioFile } = await import('@/utils/storage');
        const audioUrl = await getAudioFile(track.url);
        if (!audioUrl || typeof audioUrl !== 'string') continue;
        
        // Téléchargement différé pour ne pas impacter les performances
        setTimeout(async () => {
          try {
            const response = await fetch(audioUrl, { 
              cache: 'force-cache',
              priority: 'low' as any // Priorité basse pour ne pas interférer
            });
            if (response.ok) {
              const blob = await response.blob();
              await addToCache(track.url, blob);
            }
          } catch (e) { /* Silent fail */ }
        }, 200);
      }
    } catch (error) {
      // Silent fail pour éviter de ralentir l'interface
    }
  }, []);

  return {
    preferences,
    overlapTimeRef,
    fadingRef,
    fadeIntervalRef,
    preloadNextTracks
  };
};
