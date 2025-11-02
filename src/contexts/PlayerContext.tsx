import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Song, PlayerContextType } from '@/types/player';
import { usePlayerState } from '@/hooks/usePlayerState';
import { usePlayerFavorites } from '@/hooks/usePlayerFavorites';
import { usePlayerQueue } from '@/hooks/usePlayerQueue';
import { useAudioControl } from '@/hooks/useAudioControl';
import { usePlayerPreferences } from '@/hooks/usePlayerPreferences';
import { useUltraFastPlayer } from '@/hooks/useUltraFastPlayer';

import { UltraFastStreaming } from '@/utils/ultraFastStreaming';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';

// Contexte global et audio
const PlayerContext = createContext<PlayerContextType | null>(null);
const globalAudio = new Audio();
globalAudio.crossOrigin = "anonymous";

// Helper function to create next audio element
const createNextAudio = () => {
  const nextAudio = new Audio();
  nextAudio.crossOrigin = "anonymous";
  return nextAudio;
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Hooks personnalisés qui encapsulent la logique
  const { 
    currentSong, setCurrentSong,
    isPlaying, setIsPlaying,
    progress, setProgress, savedProgress, setSavedProgress,
    volume, setVolume: setVolumeState,
    isChangingSong, setIsChangingSong,
    history, setHistory,
    searchQuery, setSearchQuery,
    playbackRate, setPlaybackRate
  } = usePlayerState();

  const {
    favorites, setFavorites,
    favoriteStats, setFavoriteStats,
    toggleFavorite, removeFavorite
  } = usePlayerFavorites();

  const {
    preferences, 
    overlapTimeRef,
    fadingRef,
    fadeIntervalRef,
    preloadNextTracks
  } = usePlayerPreferences();

  // Refs audio
  const audioRef = useRef<HTMLAudioElement>(globalAudio);
  const nextAudioRef = useRef<HTMLAudioElement>(createNextAudio());
  const changeTimeoutRef = useRef<number | null>(null);
  const [nextSongPreloaded, setNextSongPreloaded] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [displayedSong, setDisplayedSong] = useState<Song | null>(null);

  // Hook pour la queue - doit être déclaré AVANT useUltraFastPlayer
  const queueHook = usePlayerQueue({ currentSong, isChangingSong, setIsChangingSong, play: async () => {} });
  const {
    queue, setQueue,
    shuffleMode, setShuffleMode,
    repeatMode, setRepeatMode,
    addToQueue, toggleShuffle, toggleRepeat,
    nextSong, previousSong, getNextSong
  } = queueHook;

  // Hook ultra-rapide pour le préchargement intelligent - APRÈS usePlayerQueue
  const { getCacheStats } = useUltraFastPlayer({
    currentSong,
    queue,
    isPlaying
  });


  // Fonctions exposées à travers le contexte - définies après les hooks
  const { 
    play, 
    pause, 
    updateVolume, 
    updateProgress, 
    updatePlaybackRate, 
    stopCurrentSong,
    refreshCurrentSong,
    getCurrentAudioElement
  } = useAudioControl({ 
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
  });

  // Wrapper function for setVolume that updates both state and audio element
  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    updateVolume(newVolume);
  }, [setVolumeState, updateVolume]);

  // Prépare l'élément audio suivant avec l'URL et attend le canplay
  const prepareNextAudio = async (song: Song) => {
    try {
      const url = await UltraFastStreaming.getAudioUrlUltraFast(
        song.url,
        song.deezer_id,
        song.tidal_id,
        song.title,
        song.artist
      );
      if (!url || typeof url !== 'string') throw new Error('URL invalide pour la prochaine piste');
      nextAudioRef.current.src = url;
      nextAudioRef.current.preload = 'auto';
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error('Erreur chargement prochaine piste')); };
        const cleanup = () => {
          nextAudioRef.current.removeEventListener('canplay', onCanPlay);
          nextAudioRef.current.removeEventListener('error', onError);
        };
        nextAudioRef.current.addEventListener('canplay', onCanPlay, { once: true });
        nextAudioRef.current.addEventListener('error', onError, { once: true });
        if (nextAudioRef.current.readyState >= 3) resolve();
      });
      setNextSongPreloaded(true);
      console.log('Prochaine piste prête pour crossfade:', song.title);
    } catch (e) {
      console.error('Préparation prochaine piste échouée:', e);
      setNextSongPreloaded(false);
    }
  };

  // Mettre à jour les fonctions du hook queue avec la vraie fonction play
  useEffect(() => {
    queueHook.nextSong = async () => {
      if (isChangingSong) {
        console.log("Changement de chanson déjà en cours, ignorer nextSong()");
        return;
      }
      
      console.log("=== NEXT SONG DEBUG ===");
      console.log("Current song:", currentSong?.title, "ID:", currentSong?.id);
      
      // Relire la queue depuis localStorage pour être sûr d'avoir la version la plus récente
      let currentQueue = queue;
      try {
        const savedQueue = localStorage.getItem('queue');
        if (savedQueue) {
          const parsedQueue = JSON.parse(savedQueue);
          if (parsedQueue.length > currentQueue.length) {
            console.log("🔄 Queue reloaded from localStorage:", parsedQueue.length, "songs (was", currentQueue.length, ")");
            currentQueue = parsedQueue;
          }
        }
        // Fallback: utiliser les derniers résultats de recherche si la queue est trop courte
        if (currentQueue.length <= 1) {
          const lastResultsRaw = localStorage.getItem('lastSearchResults');
          if (lastResultsRaw) {
            const lastResults = JSON.parse(lastResultsRaw);
            if (Array.isArray(lastResults) && lastResults.length > currentQueue.length) {
              console.log("🧭 Using lastSearchResults as queue:", lastResults.length, "songs");
              currentQueue = lastResults;
              // Mettre à jour l'état et persister
              setQueue(currentQueue);
              localStorage.setItem('queue', JSON.stringify(currentQueue));
            }
          }
        }
      } catch (error) {
        console.error("Error reading queue from localStorage:", error);
      }
      
      console.log("Queue length:", currentQueue.length);
      console.log("Full queue:", currentQueue.map((s, idx) => `${idx}: ${s.title} - ${s.artist} (${s.id})`));
      
      if (!currentSong || currentQueue.length === 0) {
        console.log("No current song or queue is empty");
        return;
      }
      
      const currentIndex = currentQueue.findIndex(song => song.id === currentSong.id);
      console.log("Current index in queue:", currentIndex);
      console.log("Looking for song ID:", currentSong.id);
      console.log("Queue IDs:", currentQueue.map(s => s.id));
      
      if (currentIndex === -1) {
        console.log("Current song not found in queue by ID");
        const fallbackIndex = currentQueue.findIndex(song => 
          song.title === currentSong.title && song.artist === currentSong.artist
        );
        
        if (fallbackIndex !== -1) {
          console.log("Found song by title/artist at index:", fallbackIndex);
          const nextIndex = fallbackIndex + 1;
          if (nextIndex < currentQueue.length) {
            console.log(`Playing next song at index ${nextIndex}: ${currentQueue[nextIndex].title}`);
            await play(currentQueue[nextIndex]);
            return;
          } else {
            console.log("Fallback found song but it's the last one");
          }
        }
        
        console.log("Could not find current song in queue, playing first song");
        if (currentQueue.length > 0) {
          await play(currentQueue[0]);
        }
        return;
      }
      
      const nextIndex = currentIndex + 1;
      console.log("Next index would be:", nextIndex, "out of", currentQueue.length);
      if (nextIndex < currentQueue.length) {
        console.log(`Playing next song at index ${nextIndex}: ${currentQueue[nextIndex].title}`);
        await play(currentQueue[nextIndex]);
      } else {
        console.log("End of queue reached");
        if (repeatMode === 'all' && currentQueue.length > 0) {
          console.log("Repeating playlist from beginning");
          await play(currentQueue[0]);
        } else {
          toast.info("Fin de la playlist");
        }
      }
      console.log("=====================");
    };

    queueHook.previousSong = async () => {
      if (isChangingSong) {
        console.log("Changement de chanson déjà en cours, ignorer previousSong()");
        return;
      }
      
      console.log("=== PREVIOUS SONG DEBUG ===");
      console.log("Current song:", currentSong?.title, "ID:", currentSong?.id);
      console.log("Queue length:", queue.length);
      
      if (!currentSong || queue.length === 0) {
        console.log("No current song or queue is empty");
        return;
      }
      
      const currentIndex = queue.findIndex(song => song.id === currentSong.id);
      console.log("Current index in queue:", currentIndex);
      
      if (currentIndex === -1) {
        console.log("Current song not found in queue");
        const fallbackIndex = queue.findIndex(song => 
          song.title === currentSong.title && song.artist === currentSong.artist
        );
        
        if (fallbackIndex !== -1) {
          console.log("Found song by title/artist at index:", fallbackIndex);
          if (fallbackIndex > 0) {
            console.log(`Playing previous song: ${queue[fallbackIndex - 1].title}`);
            await play(queue[fallbackIndex - 1]);
            return;
          }
        }
        
        console.log("Could not find current song in queue, playing last song");
        if (queue.length > 0) {
          await play(queue[queue.length - 1]);
        }
        return;
      }
      
      if (currentIndex > 0) {
        console.log(`Playing previous song: ${queue[currentIndex - 1].title}`);
        await play(queue[currentIndex - 1]);
      } else {
        console.log("Already at first track");
        if (repeatMode === 'all' && queue.length > 0) {
          console.log("Going to last song in playlist");
          await play(queue[queue.length - 1]);
        } else {
          toast.info("Déjà au début de la playlist");
        }
      }
      console.log("=========================");
    };
  }, [play, currentSong, queue, isChangingSong, repeatMode]);

  // Restauration de la lecture au chargement - OPTIMISÉ
  useEffect(() => {
    const restorePlayback = async () => {
      const savedSong = localStorage.getItem('currentSong');
      const savedProgressValue = localStorage.getItem('audioProgress');
      
      console.log("🔄 Restauration de la lecture...");
      console.log("Chanson sauvegardée:", savedSong ? "OUI" : "NON");
      console.log("Position sauvegardée:", savedProgressValue);
      
      if (savedSong) {
        const song = JSON.parse(savedSong);
        try {
          console.log("🎵 Restauration de:", song.title);
          setIsAudioReady(false);
          
          const audioUrl = await UltraFastStreaming.getAudioUrlUltraFast(
            song.url,
            song.deezer_id,
            song.tidal_id,
            song.title,
            song.artist
          );
          if (!audioUrl || typeof audioUrl !== 'string') return;

          // Configuration audio avec gestion d'état
          audioRef.current.src = audioUrl;
          audioRef.current.preload = "auto";
          
          // Gestionnaires d'événements pour le chargement
          const handleCanPlay = () => {
            console.log("🎵 Audio prêt à être lu");
            setIsAudioReady(true);
            
            if (savedProgressValue) {
              const savedTime = parseFloat(savedProgressValue);
              console.log("⏰ Restauration position à:", savedTime, "secondes");
              audioRef.current.currentTime = savedTime;
              setProgress((savedTime / audioRef.current.duration) * 100);
            }
            
            // Nettoyer les event listeners
            audioRef.current.removeEventListener('canplay', handleCanPlay);
            audioRef.current.removeEventListener('error', handleError);
          };

          const handleError = (error: any) => {
            console.error("❌ Erreur chargement audio:", error);
            setIsAudioReady(false);
            localStorage.removeItem('currentSong');
            localStorage.removeItem('audioProgress');
            
            // Nettoyer les event listeners
            audioRef.current.removeEventListener('canplay', handleCanPlay);
            audioRef.current.removeEventListener('error', handleError);
          };

          // Ajouter les event listeners
          audioRef.current.addEventListener('canplay', handleCanPlay);
          audioRef.current.addEventListener('error', handleError);
          
          // Démarrer le chargement
          audioRef.current.load();
          
          setCurrentSong(song);
          const updatedQueue = [...queue];
          if (!updatedQueue.some(s => s.id === song.id)) {
            updatedQueue.unshift(song);
          }
          setQueue(updatedQueue);
          
          console.log("✅ Restauration initiée, attente du chargement...");
        } catch (error) {
          console.error("❌ Erreur lors de la restauration de la lecture:", error);
          localStorage.removeItem('currentSong');
          localStorage.removeItem('audioProgress');
          setIsAudioReady(false);
        }
      } else {
        setIsAudioReady(true); // Prêt si pas de chanson à restaurer
      }
    };

    restorePlayback();
  }, []);

  // Garder affichage aligné quand la chanson change naturellement
  useEffect(() => {
    setDisplayedSong(currentSong);
  }, [currentSong]);

  // Sauvegarde en temps réel de la position - OPTIMISÉ
  useEffect(() => {
    if (!audioRef.current) return;

    const handleTimeUpdate = () => {
      if (audioRef.current && currentSong && !isNaN(audioRef.current.currentTime)) {
        const currentTime = audioRef.current.currentTime;
        
        // Sauvegarder seulement toutes les 2 secondes pour optimiser
        if (Math.floor(currentTime) % 2 === 0) {
          localStorage.setItem('audioProgress', currentTime.toString());
        }
        
        // Mettre à jour le progress dans l'état
        if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
          const progressPercent = (currentTime / audioRef.current.duration) * 100;
          setProgress(progressPercent);
        }
      }
    };

    const handleLoadStart = () => {
      // Seulement mettre à false si on change de chanson, pas pendant le préchargement
      if (isChangingSong) {
        console.log("🔄 Début du chargement audio");
        setIsAudioReady(false);
      }
    };

    const handleCanPlay = () => {
      console.log("✅ Audio prêt");
      setIsAudioReady(true);
    };
    
    const handlePlaying = () => {
      // S'assurer que isAudioReady est true quand la lecture démarre
      setIsAudioReady(true);
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('loadstart', handleLoadStart);
    audioRef.current.addEventListener('canplay', handleCanPlay);
    audioRef.current.addEventListener('playing', handlePlaying);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('loadstart', handleLoadStart);
        audioRef.current.removeEventListener('canplay', handleCanPlay);
        audioRef.current.removeEventListener('playing', handlePlaying);
      }
    };
  }, [currentSong, setProgress]);

  // Persistance des données
  useEffect(() => {
    if (currentSong) {
      localStorage.setItem('currentSong', JSON.stringify(currentSong));
    }
  }, [currentSong]);

  useEffect(() => {
    localStorage.setItem('queue', JSON.stringify(queue));
  }, [queue]);


  // Logique de crossfade et de fin de piste
  useEffect(() => {
    if (!audioRef.current) return;

    const handleTimeUpdate = () => {
      if (!audioRef.current || !currentSong || !preferences.crossfadeEnabled || fadingRef.current) {
        return;
      }

      const timeLeft = audioRef.current.duration - audioRef.current.currentTime;
      const transitionTime = overlapTimeRef.current;
      
      if (timeLeft <= transitionTime && timeLeft > 0 && !fadingRef.current) {
        console.log(`Démarrage du fondu enchaîné, temps restant: ${timeLeft.toFixed(2)}s, durée du fondu: ${transitionTime}s`);
        
        const nextSong = getNextSong();
        if (!nextSong) {
          console.log("Pas de chanson suivante disponible");
          return;
        }

        fadingRef.current = true;
        
        const alertElement = document.getElementById('next-song-alert');
        const titleElement = document.getElementById('next-song-title');
        const artistElement = document.getElementById('next-song-artist');

        if (alertElement && titleElement && artistElement) {
          titleElement.textContent = nextSong.title;
          artistElement.textContent = nextSong.artist;
          alertElement.classList.remove('opacity-0', 'translate-y-2');
          alertElement.classList.add('opacity-100', 'translate-y-0');

          setTimeout(() => {
            alertElement.classList.add('opacity-0', 'translate-y-2');
            alertElement.classList.remove('opacity-100', 'translate-y-0');
          }, 3000);
        }

        if (!nextAudioRef.current.src || !nextSongPreloaded) {
          console.log("Préparation de la prochaine piste pour le crossfade...");
          prepareNextAudio(nextSong).then(() => {
            startCrossfade(timeLeft, nextSong);
          }).catch((e) => {
            console.error('Impossible de préparer la prochaine piste:', e);
            // Tentative de fallback: démarrer quand même avec préchargement intelligent
            preloadNextTracks().finally(() => startCrossfade(timeLeft, nextSong));
          });
        } else {
          startCrossfade(timeLeft, nextSong);
        }
      }
    };
    
    const startCrossfade = (timeLeft: number, nextSong: Song) => {
      console.log(`Début du fondu enchaîné pour ${nextSong.title}`);
      
      nextAudioRef.current.volume = 0;
      const playPromise = nextAudioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log("Lecture de la prochaine chanson démarrée avec succès");
          
          // Afficher immédiatement la prochaine chanson dans l'UI, sans changer la source principale
          setDisplayedSong(nextSong);
          
          if ('mediaSession' in navigator) {
            updateMediaSessionMetadata(nextSong);
            console.log("Métadonnées MediaSession mises à jour au début du crossfade:", nextSong.title);
          }
          
          const crossfadeDuration = overlapTimeRef.current;
          
          const fadeDuration = Math.min(timeLeft * 1000, crossfadeDuration * 1000);
          const steps = Math.max(50, fadeDuration / 20);
          const intervalTime = fadeDuration / steps;
          const volumeStep = (volume / 100) / steps;
          
          console.log(`Paramètres du fondu: durée=${fadeDuration}ms, étapes=${steps}, intervalleTemps=${intervalTime}ms, pas de volume=${volumeStep}`);
          
          let currentOutVolume = audioRef.current.volume;
          let currentInVolume = 0;
          let stepCount = 0;
          
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
          }
          
          fadeIntervalRef.current = window.setInterval(() => {
            stepCount++;
            
            if (currentOutVolume > 0 || currentInVolume < (volume / 100)) {
              currentOutVolume = Math.max(0, currentOutVolume - volumeStep);
              currentInVolume = Math.min(volume / 100, currentInVolume + volumeStep);
              
              if (audioRef.current) audioRef.current.volume = currentOutVolume;
              if (nextAudioRef.current) nextAudioRef.current.volume = currentInVolume;
              
              if (stepCount % 10 === 0) {
                console.log(`Progression du fondu: out=${Math.round(currentOutVolume*100)}%, in=${Math.round(currentInVolume*100)}%, étape=${stepCount}`);
              }
            } else {
              console.log("Fondu enchaîné terminé, passage à la chanson suivante");
              
              if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
              }
              
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
              
              const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
              const nextTrack = queue[currentIndex + 1];
              if (nextTrack) {
                const tempAudio = audioRef.current;
                audioRef.current = nextAudioRef.current;
                nextAudioRef.current = tempAudio;
                nextAudioRef.current.src = '';
                setCurrentSong(nextTrack);
                localStorage.setItem('currentSong', JSON.stringify(nextTrack));
                setNextSongPreloaded(false);
                fadingRef.current = false;
                
                if ('mediaSession' in navigator) {
                  updateMediaSessionMetadata(nextTrack);
                  console.log("Métadonnées MediaSession mises à jour lors du crossfade:", nextTrack.title);
                }
                
                setTimeout(() => preloadNextTracks(), 1000);
              }
            }
          }, intervalTime);
        }).catch(error => {
          console.error("Erreur lors du démarrage du fondu:", error);
          fadingRef.current = false;
          toast.error("Erreur lors de la transition entre les pistes");
        });
      }
    };

    const handleEnded = () => {
      console.log("=== SONG ENDED DEBUG ===");
      console.log("Chanson terminée:", currentSong?.title);
      console.log("Fondu en cours:", fadingRef.current);
      console.log("Queue length:", queue.length);
      console.log("Current song in queue:", queue.some(s => s.id === currentSong?.id));
      
      if (!fadingRef.current) {
        console.log("Lecture terminée naturellement sans crossfade");
        setProgress(0);
        
        if (repeatMode === 'one') {
          console.log("Répétition de la chanson actuelle");
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(err => console.error("Erreur lors de la répétition:", err));
        } else {
          const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
          console.log("Current index in queue:", currentIndex);
          const nextTrack = queue[currentIndex + 1];
          console.log("Next track:", nextTrack?.title);
          
          if (nextTrack) {
            console.log("Passage à la chanson suivante:", nextTrack.title);
            
            if ('mediaSession' in navigator) {
              updateMediaSessionMetadata(nextTrack);
              console.log("Métadonnées MediaSession mises à jour lors du passage automatique:", nextTrack.title);
            }
            
            play(nextTrack);
          } else if (repeatMode === 'all' && queue.length > 0) {
            console.log("Répétition de la playlist depuis le début");
            
            if ('mediaSession' in navigator) {
              updateMediaSessionMetadata(queue[0]);
              console.log("Métadonnées MediaSession mises à jour lors de la répétition de playlist:", queue[0].title);
            }
            
            play(queue[0]);
          } else {
            console.log("Fin de la playlist");
            setIsPlaying(false);
          }
        }
      }
      console.log("========================");
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('ended', handleEnded);
      }
      
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, [currentSong, nextSongPreloaded, queue, play, repeatMode, preferences.crossfadeEnabled, volume]);

  // Fonction pour supprimer une chanson de toutes les listes
  const removeSong = useCallback((songId: string) => {
    if (currentSong?.id === songId) {
      stopCurrentSong();
      setCurrentSong(null);
      localStorage.removeItem('currentSong');
    }
    
    setQueue(prevQueue => prevQueue.filter(song => song.id !== songId));
    setHistory(prevHistory => prevHistory.filter(song => song.id !== songId));
    
    if (favorites.some(song => song.id === songId)) {
      removeFavorite(songId);
    }
    
    toast.success("La chanson a été supprimée de votre bibliothèque");
  }, [currentSong, setCurrentSong, stopCurrentSong, setQueue, setHistory, favorites, removeFavorite]);

  // Wrapper pour setProgress qui met à jour à la fois l'état et l'audio
  const handleSetProgress = useCallback((newProgress: number) => {
    setProgress(newProgress);
    updateProgress(newProgress);
  }, [setProgress, updateProgress]);

  // L'objet context complet avec l'égaliseur - Fix type mapping
  const playerContext: PlayerContextType = {
    currentSong,
    displayedSong,
    isPlaying,
    progress,
    volume,
    queue,
    shuffleMode,
    repeatMode,
    favorites,
    searchQuery,
    favoriteStats,
    playbackRate,
    history,
    isChangingSong,
    isAudioReady,
    stopCurrentSong,
    removeSong,
    setQueue,
    setHistory,
    play,
    pause,
    setVolume,
    setProgress: handleSetProgress,
    nextSong,
    previousSong,
    addToQueue,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
    removeFavorite,
    setSearchQuery,
    setPlaybackRate: updatePlaybackRate,
    refreshCurrentSong,
    getCurrentAudioElement
  };

  return (
    <PlayerContext.Provider value={playerContext}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayerContext must be used within a PlayerProvider");
  }
  return context;
};

export default PlayerProvider;
