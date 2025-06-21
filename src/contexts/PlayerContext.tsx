import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Song, PlayerContextType } from '@/types/player';
import { usePlayerState } from '@/hooks/usePlayerState';
import { usePlayerFavorites } from '@/hooks/usePlayerFavorites';
import { usePlayerQueue } from '@/hooks/usePlayerQueue';
import { useAudioControl } from '@/hooks/useAudioControl';
import { usePlayerPreferences } from '@/hooks/usePlayerPreferences';
import { useEqualizer } from '@/hooks/useEqualizer';
import { useUltraFastPlayer } from '@/hooks/useUltraFastPlayer';
import { getAudioFileUrl } from '@/utils/storage';
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
    volume, setVolume,
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

  // Hook d'égaliseur
  const equalizer = useEqualizer({ audioElement: audioRef.current });

  // Hook pour la queue - doit être déclaré AVANT useUltraFastPlayer
  const {
    queue, setQueue,
    shuffleMode, setShuffleMode,
    repeatMode, setRepeatMode,
    addToQueue, toggleShuffle, toggleRepeat,
    nextSong, previousSong, getNextSong
  } = usePlayerQueue({ currentSong, isChangingSong, setIsChangingSong, play: async () => {} });

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

  // Restauration de la lecture au chargement
  useEffect(() => {
    const restorePlayback = async () => {
      const savedSong = localStorage.getItem('currentSong');
      const savedProgress = localStorage.getItem('audioProgress');
      
      if (savedSong) {
        const song = JSON.parse(savedSong);
        try {
          const audioUrl = await getAudioFileUrl(song.url);
          if (!audioUrl || typeof audioUrl !== 'string') return;

          audioRef.current.src = audioUrl;
          audioRef.current.load();
          
          if (savedProgress) {
            audioRef.current.currentTime = parseFloat(savedProgress);
          }

          setCurrentSong(song);
          const updatedQueue = [...queue];
          if (!updatedQueue.some(s => s.id === song.id)) {
            updatedQueue.unshift(song);
          }
          setQueue(updatedQueue);
        } catch (error) {
          console.error("Erreur lors de la restauration de la lecture:", error);
          localStorage.removeItem('currentSong');
          localStorage.removeItem('audioProgress');
        }
      }
    };

    restorePlayback();
  }, []);

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
      
      if (timeLeft <= overlapTimeRef.current && timeLeft > 0 && !fadingRef.current) {
        console.log(`Démarrage du fondu enchaîné, temps restant: ${timeLeft.toFixed(2)}s, durée du fondu: ${overlapTimeRef.current}s`);
        
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
          console.log("La prochaine chanson n'est pas préchargée correctement, préchargement forcé");
          preloadNextTracks().then(() => {
            startCrossfade(timeLeft, nextSong);
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
          
          const fadeDuration = Math.min(timeLeft * 1000, overlapTimeRef.current * 1000);
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
      console.log("Chanson terminée, fondu en cours:", fadingRef.current);
      
      if (!fadingRef.current) {
        console.log("Lecture terminée naturellement sans crossfade");
        setProgress(0);
        
        if (repeatMode === 'one') {
          console.log("Répétition de la chanson actuelle");
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(err => console.error("Erreur lors de la répétition:", err));
        } else {
          const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
          const nextTrack = queue[currentIndex + 1];
          
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

  // L'objet context complet avec l'égaliseur
  const playerContext: PlayerContextType = {
    currentSong,
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
    stopCurrentSong,
    removeSong,
    setQueue,
    setHistory,
    play,
    pause,
    setVolume,
    setProgress,
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
    getCurrentAudioElement,
    equalizerSettings: equalizer.settings,
    equalizerPresets: equalizer.presets,
    currentEqualizerPreset: equalizer.currentPreset,
    isEqualizerEnabled: equalizer.isEnabled,
    isEqualizerInitialized: equalizer.isInitialized,
    updateEqualizerBand: equalizer.updateBand,
    applyEqualizerPreset: equalizer.applyPreset,
    toggleEqualizer: equalizer.toggleEnabled,
    resetEqualizer: equalizer.resetEqualizer,
    setEqualizerPreAmp: equalizer.setPreAmp,
    initializeEqualizer: equalizer.initializeAudioContext
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
