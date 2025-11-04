
import { useState, useEffect, useRef, useCallback } from 'react';
import { PlayerPreferences } from '@/types/player';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';

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
          console.log('Durée du fondu mise à jour:', data.crossfade_duration);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    };

    loadPreferences();
  }, []);

  // Fonction pour précharger les pistes suivantes avec système ultra-rapide
  const preloadNextTracks = useCallback(async () => {
    try {
      // On récupère les données du contexte 
      const currentSongStr = localStorage.getItem('currentSong');
      const queueStr = localStorage.getItem('queue');
      
      if (!currentSongStr || !queueStr) return;
      
      const currentSong = JSON.parse(currentSongStr);
      const queue = JSON.parse(queueStr);
      
      if (!currentSong || queue.length === 0) return;
      
      const currentIndex = queue.findIndex((song: any) => song.id === currentSong.id);
      if (currentIndex === -1) return;
      
      // Précharger uniquement la prochaine chanson pour ne pas surcharger
      const nextTrack = queue[currentIndex + 1];
      
      if (nextTrack) {
        console.log(`🔮 Préchargement intelligent: ${nextTrack.title}`);
        await UltraFastStreaming.getAudioUrlUltraFast(
          nextTrack.url,
          nextTrack.deezer_id,
          
          nextTrack.title,
          nextTrack.artist,
          nextTrack.id
        );
        console.log(`✅ Préchargement terminé: ${nextTrack.title}`);
      }
    } catch (error) {
      console.error("Erreur lors du préchargement des pistes:", error);
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
