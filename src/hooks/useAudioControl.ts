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
      console.log("🚫 Changement de chanson déjà en cours, ignorer l'appel");
      return;
    }
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      setIsChangingSong(true);
      
      console.log("🎵 === LECTURE ULTRA-RAPIDE ===");
      console.log("🎶 Chanson:", song.title, "par", song.artist);
      console.log("⚡ Mode streaming optimisé activé");
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      if ('mediaSession' in navigator) {
        updateMediaSessionMetadata(song);
      }

      try {
        // Configuration audio optimisée AVANT la récupération de l'URL
        console.log("⚡ Pré-configuration audio pour streaming instantané");
        audioRef.current.crossOrigin = "anonymous";
        audioRef.current.preload = "none"; // Pas de préchargement, on veut juste commencer
        audioRef.current.volume = volume / 100;
        
        // Optimisation streaming
        if (audioRef.current.buffered) {
          // Vider les anciens buffers si possible
          audioRef.current.currentTime = 0;
        }
        
        console.log("🚀 Récupération URL ultra-rapide...");
        const startTime = performance.now();
        
        // Vérification cache ULTRA rapide (sans await pour les opérations lentes)
        const cacheCheckPromise = isInCache(song.url).then(async (inCache) => {
          if (inCache) {
            const cachedUrl = await getFromCache(song.url);
            if (cachedUrl && typeof cachedUrl === 'string') {
              console.log("⚡ Cache hit - URL immédiate:", (performance.now() - startTime).toFixed(1), "ms");
              return { url: cachedUrl, fromCache: true };
            }
          }
          return null;
        });
        
        // Récupération URL en parallèle (ne pas attendre le cache)
        const urlPromise = getAudioFile(song.url).then(url => {
          if (typeof url === 'string') {
            return { url, fromCache: false };
          }
          throw new Error('URL audio invalide');
        });
        
        // Prendre la première URL disponible (cache ou réseau)
        const audioData = await Promise.race([
          cacheCheckPromise.then(result => result || Promise.reject("No cache")),
          urlPromise
        ]).catch(() => urlPromise); // Fallback sur l'URL réseau si cache échoue
        
        const audioUrl = audioData.url;
        const elapsed = performance.now() - startTime;
        
        console.log("✅ URL récupérée en:", elapsed.toFixed(1), "ms", audioData.fromCache ? "(cache)" : "(réseau)");

        if (!audioUrl || typeof audioUrl !== 'string') {
          throw new Error('URL audio non disponible');
        }

        // Configuration streaming ultra-optimisée
        console.log("⚡ Configuration streaming instantané");
        audioRef.current.src = audioUrl;
        
        // Optimisations pour streaming HTTP
        if (audioUrl.startsWith('http')) {
          // Configuration aggressive pour démarrage immédiat
          audioRef.current.preload = "metadata";
          
          // Si pas encore en cache, démarrer le téléchargement en arrière-plan APRÈS le démarrage
          if (!audioData.fromCache) {
            // Téléchargement différé pour ne pas bloquer la lecture
            setTimeout(async () => {
              try {
                console.log("📡 Téléchargement arrière-plan démarré");
                const response = await fetch(audioUrl);
                if (response.ok) {
                  const blob = await response.blob();
                  await addToCache(song.url, blob);
                  console.log("💾 Mise en cache terminée:", blob.size, "bytes");
                }
              } catch (error) {
                console.warn("⚠️ Cache en arrière-plan échoué:", error);
              }
            }, 100); // Démarrer après 100ms seulement
          }
        } else {
          audioRef.current.preload = "auto";
        }
        
        // Démarrage immédiat sans attendre load
        console.log("🚀 Démarrage immédiat...");
        const playStartTime = performance.now();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            const playElapsed = performance.now() - playStartTime;
            const totalElapsed = performance.now() - startTime;
            
            console.log("✅ === LECTURE INSTANTANÉE RÉUSSIE ===");
            console.log("🎵 Chanson:", song.title);
            console.log("⚡ Temps de démarrage:", playElapsed.toFixed(1), "ms");
            console.log("⚡ Temps total:", totalElapsed.toFixed(1), "ms");
            console.log("🎯 Performance:", totalElapsed < 500 ? "EXCELLENT" : totalElapsed < 1000 ? "BON" : "À AMÉLIORER");
            
            setIsPlaying(true);
            
            // Vérification rapide du streaming
            setTimeout(() => {
              if (audioRef.current.currentTime === 0 && !audioRef.current.paused) {
                console.log("📡 Streaming en cours - buffering initial...");
                
                // Attente courte pour le buffering streaming
                setTimeout(() => {
                  if (audioRef.current.currentTime === 0 && !audioRef.current.paused) {
                    console.log("⚠️ Streaming lent - cliquez pour forcer");
                    toast.error("Connexion lente - cliquez pour relancer", {
                      duration: 3000,
                      action: {
                        label: "Relancer",
                        onClick: () => {
                          audioRef.current.currentTime = 0;
                          audioRef.current.play();
                        }
                      }
                    });
                  }
                }, 2000);
              }
            }, 500);
            
            // Préchargement des pistes suivantes (différé)
            setTimeout(() => preloadNextTracks(), 500);
            
            // Fin du changement (très rapide)
            changeTimeoutRef.current = window.setTimeout(() => {
              setIsChangingSong(false);
              changeTimeoutRef.current = null;
            }, 300); // Réduit de 1200ms à 300ms
            
          }).catch(error => {
            console.error("❌ === ERREUR STREAMING INSTANTANÉ ===");
            console.error("🔴 Erreur:", error.message);
            
            if (error.name === 'NotAllowedError') {
              toast.error("Cliquez d'abord sur la page pour activer l'audio", {
                action: {
                  label: "Réessayer",
                  onClick: () => audioRef.current.play().then(() => setIsPlaying(true))
                }
              });
            } else {
              toast.error(`Erreur streaming: ${error.message}`);
            }
            
            setIsPlaying(false);
            setIsChangingSong(false);
          });
        }
      } catch (error) {
        console.error("💥 === ERREUR RÉCUPÉRATION ULTRA-RAPIDE ===");
        console.error("🔴 Erreur:", error);
        
        toast.error(`Impossible de lire "${song.title}"`);
        setCurrentSong(null);
        localStorage.removeItem('currentSong');
        setIsPlaying(false);
        setIsChangingSong(false);
      }
    } else if (audioRef.current) {
      // Reprise ultra-rapide
      console.log("⚡ Reprise instantanée");
      try {
        audioRef.current.volume = volume / 100;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("✅ Reprise réussie");
            setIsPlaying(true);
          }).catch(error => {
            if (error.name === 'NotAllowedError') {
              toast.error("Cliquez pour reprendre la lecture", {
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
      console.log("Current song stopped immediately");
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
        console.error("Error refreshing current song data:", error);
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
        
        console.log("Current song metadata refreshed:", updatedSong.title);
      }
    } catch (error) {
      console.error("Error in refreshCurrentSong:", error);
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
