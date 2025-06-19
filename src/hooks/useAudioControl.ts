
import { useCallback } from 'react';
import { getAudioFile } from '@/utils/storage';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';
import { Song } from '@/types/player';
import { isInCache, getFromCache, addToCache } from '@/utils/audioCache';

interface UseAudioControlProps {
  audioRef: React.MutableRefObject<HTMLAudioElement>;
  nextAudioRef: React.MutableRefObject<HTMLAudioElement>;
  currentSong: Song | null;
  setCurrentSong: (song: Song | null) => void;
  isChangingSong: boolean;
  setIsChangingSong: (value: boolean) => void;
  volume: number;
  setIsPlaying: (value: boolean) => void;
  changeTimeoutRef: React.MutableRefObject<number | null>;
  setNextSongPreloaded: (value: boolean) => void;
  preloadNextTracks: () => Promise<void>;
}

export const useAudioControl = ({
  audioRef,
  nextAudioRef,
  currentSong,
  setCurrentSong,
  isChangingSong,
  setIsChangingSong,
  volume,
  setIsPlaying,
  changeTimeoutRef,
  setNextSongPreloaded,
  preloadNextTracks
}: UseAudioControlProps) => {

  const play = useCallback(async (song?: Song) => {
    if (isChangingSong) {
      console.log("🚫 Changement déjà en cours, ignoré");
      return;
    }
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      setIsChangingSong(true);
      
      console.log("🎵 === LECTURE ULTRA-RAPIDE OPTIMISÉE ===");
      console.log("🎶 Chanson:", song.title, "par", song.artist);
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      // MediaSession en arrière-plan pour ne pas bloquer
      if ('mediaSession' in navigator) {
        setTimeout(() => updateMediaSessionMetadata(song), 0);
      }

      try {
        // Configuration audio ultra-optimisée AVANT la récupération
        console.log("⚡ Configuration audio instantanée");
        const audio = audioRef.current;
        audio.crossOrigin = "anonymous";
        audio.preload = "none";
        audio.volume = volume / 100;
        
        console.log("🚀 Récupération URL ultra-rapide...");
        const startTime = performance.now();
        
        // Cache check avec timeout très court (10ms max)
        const cachePromise = Promise.race([
          isInCache(song.url).then(async (inCache) => {
            if (inCache) {
              const cachedUrl = await getFromCache(song.url);
              if (cachedUrl && typeof cachedUrl === 'string') {
                console.log("⚡ Cache hit:", (performance.now() - startTime).toFixed(1), "ms");
                return { url: cachedUrl, fromCache: true };
              }
            }
            return null;
          }),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 10)) // 10ms timeout
        ]);
        
        // Récupération réseau en parallèle
        const networkPromise = getAudioFile(song.url).then(url => {
          if (typeof url === 'string') {
            return { url, fromCache: false };
          }
          throw new Error('URL invalide');
        });
        
        // Prendre la première URL disponible
        const audioData = await Promise.race([
          cachePromise.then(result => result || Promise.reject("No cache")),
          networkPromise
        ]).catch(() => networkPromise);
        
        const audioUrl = audioData.url;
        const elapsed = performance.now() - startTime;
        
        console.log("✅ URL en:", elapsed.toFixed(1), "ms", audioData.fromCache ? "(cache)" : "(réseau)");

        if (!audioUrl || typeof audioUrl !== 'string') {
          throw new Error('URL audio non disponible');
        }

        // Configuration streaming ultra-agressive
        console.log("⚡ Démarrage streaming instantané");
        audio.src = audioUrl;
        
        // Pour les URLs HTTP, configuration agressive
        if (audioUrl.startsWith('http')) {
          audio.preload = "metadata";
          
          // Cache en arrière-plan immédiat si pas en cache
          if (!audioData.fromCache) {
            setTimeout(async () => {
              try {
                const response = await fetch(audioUrl);
                if (response.ok) {
                  const blob = await response.blob();
                  await addToCache(song.url, blob);
                  console.log("💾 Cache terminé:", (blob.size / 1024 / 1024).toFixed(1), "MB");
                }
              } catch (e) {
                console.warn("⚠️ Cache différé échoué");
              }
            }, 50); // Démarrer après 50ms seulement
          }
        } else {
          audio.preload = "auto";
        }
        
        // Démarrage immédiat
        console.log("🚀 Play immédiat...");
        const playStartTime = performance.now();
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            const playElapsed = performance.now() - playStartTime;
            const totalElapsed = performance.now() - startTime;
            
            console.log("✅ === SUCCÈS ULTRA-RAPIDE ===");
            console.log("🎵 Chanson:", song.title);
            console.log("⚡ Play:", playElapsed.toFixed(1), "ms");
            console.log("⚡ Total:", totalElapsed.toFixed(1), "ms");
            console.log("🎯 Perf:", totalElapsed < 300 ? "EXCELLENT" : totalElapsed < 500 ? "BON" : "LENT");
            
            setIsPlaying(true);
            
            // Vérification streaming courte
            setTimeout(() => {
              if (audio.currentTime === 0 && !audio.paused) {
                console.log("📡 Buffering streaming...");
                
                // Attente très courte pour streaming
                setTimeout(() => {
                  if (audio.currentTime === 0 && !audio.paused) {
                    toast.error("Connexion lente", {
                      duration: 2000,
                      action: {
                        label: "Relancer",
                        onClick: () => {
                          audio.currentTime = 0;
                          audio.play();
                        }
                      }
                    });
                  }
                }, 1500); // Réduit à 1.5s
              }
            }, 300); // Réduit à 300ms
            
            // Préchargement différé très court
            setTimeout(() => preloadNextTracks(), 200);
            
            // Changement terminé ultra-rapide
            changeTimeoutRef.current = window.setTimeout(() => {
              setIsChangingSong(false);
              changeTimeoutRef.current = null;
            }, 100); // Réduit à 100ms seulement
            
          }).catch(error => {
            console.error("❌ Erreur play:", error.message);
            
            if (error.name === 'NotAllowedError') {
              toast.error("Cliquez pour activer l'audio", {
                action: {
                  label: "Activer",
                  onClick: () => audio.play().then(() => setIsPlaying(true))
                }
              });
            } else {
              toast.error(`Erreur: ${error.message}`);
            }
            
            setIsPlaying(false);
            setIsChangingSong(false);
          });
        }
      } catch (error) {
        console.error("💥 Erreur récupération:", error);
        
        toast.error(`Impossible de lire "${song.title}"`);
        setCurrentSong(null);
        localStorage.removeItem('currentSong');
        setIsPlaying(false);
        setIsChangingSong(false);
      }
    } else if (audioRef.current) {
      // Reprise instantanée
      console.log("⚡ Reprise instantanée");
      try {
        audioRef.current.volume = volume / 100;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("✅ Reprise OK");
            setIsPlaying(true);
          }).catch(error => {
            if (error.name === 'NotAllowedError') {
              toast.error("Cliquez pour reprendre", {
                action: {
                  label: "Reprendre",
                  onClick: () => audioRef.current.play().then(() => setIsPlaying(true))
                }
              });
            }
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error("❌ Erreur reprise:", error);
        setIsPlaying(false);
      }
    }
  }, [audioRef, currentSong, isChangingSong, preloadNextTracks, setCurrentSong, setIsChangingSong, setIsPlaying, setNextSongPreloaded, volume]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, [audioRef, setIsPlaying]);

  const updateVolume = useCallback((newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    return newVolume;
  }, [audioRef]);

  const updateProgress = useCallback((newProgress: number) => {
    if (audioRef.current) {
      const time = (newProgress / 100) * audioRef.current.duration;
      audioRef.current.currentTime = time;
    }
    return newProgress;
  }, [audioRef]);

  const updatePlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    return rate;
  }, [audioRef]);

  const stopCurrentSong = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      console.log("Chanson arrêtée immédiatement");
    }
  }, [audioRef]);

  const refreshCurrentSong = useCallback(async () => {
    if (!currentSong) return;
    
    const { supabase } = await import('@/integrations/supabase/client');
    
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', currentSong.id)
        .single();
      
      if (error) {
        console.error("Erreur refresh song:", error);
        return;
      }
      
      if (data) {
        const updatedSong: Song = {
          ...currentSong,
          title: data.title || currentSong.title,
          artist: data.artist || currentSong.artist,
          imageUrl: data.image_url || currentSong.imageUrl,
          genre: data.genre || currentSong.genre,
        };
        
        setCurrentSong(updatedSong);
        localStorage.setItem('currentSong', JSON.stringify(updatedSong));
        
        if ('mediaSession' in navigator) {
          updateMediaSessionMetadata(updatedSong);
        }
        
        console.log("Métadonnées mises à jour:", updatedSong.title);
      }
    } catch (error) {
      console.error("Erreur refreshCurrentSong:", error);
    }
  }, [currentSong, setCurrentSong]);

  const getCurrentAudioElement = useCallback(() => {
    return audioRef.current;
  }, [audioRef]);

  return {
    play,
    pause,
    updateVolume,
    updateProgress,
    updatePlaybackRate,
    stopCurrentSong,
    refreshCurrentSong,
    getCurrentAudioElement
  };
};
