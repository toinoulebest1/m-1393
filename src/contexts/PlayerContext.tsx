
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { Song, PlayerContextType } from '@/types/player';
import { useAudioControl } from '@/hooks/useAudioControl';
import { usePlayerFavorites } from '@/hooks/usePlayerFavorites';
import { usePlayerQueue } from '@/hooks/usePlayerQueue';
import { usePlayerState } from '@/hooks/usePlayerState';
import { useEqualizer } from '@/hooks/useEqualizer';
import { useInstantPlayer } from '@/hooks/useInstantPlayer';
import { InstantStreaming } from '@/utils/instantStreaming';

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const nextAudioRef = useRef<HTMLAudioElement>(new Audio());
  const changeTimeoutRef = useRef<number | null>(null);

  const [nextSongPreloaded, setNextSongPreloaded] = useState(false);

  const {
    currentSong,
    setCurrentSong,
    isPlaying,
    setIsPlaying,
    progress,
    setProgress,
    volume,
    setVolume,
    playbackRate,
    setPlaybackRate,
    history,
    setHistory,
    isChangingSong,
    setIsChangingSong,
    searchQuery,
    setSearchQuery
  } = usePlayerState();

  // Préchargement optimisé avec gestion d'erreur améliorée
  const preloadNextTracks = useCallback(async () => {
    if (!currentSong) return;

    console.log("🚀 Préchargement optimisé avec gestion d'erreur");
    
    try {
      const savedQueue = localStorage.getItem('queue');
      if (!savedQueue) return;
      
      const queue = JSON.parse(savedQueue);
      const currentIndex = queue.findIndex((s: Song) => s.id === currentSong.id);
      const nextSongs: Song[] = [];
      
      if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
        // Précharger seulement les 3 prochaines chansons pour éviter la surcharge
        for (let i = 1; i <= 3 && currentIndex + i < queue.length; i++) {
          nextSongs.push(queue[currentIndex + i]);
        }
      }
      
      if (nextSongs.length > 0) {
        console.log("🎯 Préchargement instantané optimisé:", nextSongs.map(s => s.title));
        await InstantStreaming.prefetchNext(nextSongs.map(s => s.url));
        setNextSongPreloaded(true);
      }
    } catch (error) {
      console.warn("⚠️ Erreur préchargement (ignorée):", error);
      // Ne pas faire échouer le processus à cause d'erreurs de préchargement
    }
  }, [currentSong]);

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

  const {
    queue,
    setQueue,
    shuffleMode,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
    addToQueue
  } = usePlayerQueue({
    currentSong,
    isChangingSong,
    setIsChangingSong,
    play
  });

  const {
    favorites,
    favoriteStats,
    toggleFavorite,
    removeFavorite
  } = usePlayerFavorites();

  const {
    settings: equalizerSettings,
    presets: equalizerPresets,
    currentPreset: currentEqualizerPreset,
    isEnabled: isEqualizerEnabled,
    isInitialized: isEqualizerInitialized,
    updateBand: updateEqualizerBand,
    applyPreset: applyEqualizerPreset,
    toggleEnabled: toggleEqualizer,
    resetEqualizer,
    setPreAmp: setEqualizerPreAmp,
    initializeAudioContext: initializeEqualizer
  } = useEqualizer({ audioElement: audioRef.current });

  // Hook pour le système instantané optimisé
  const { getInstantAudioUrl, getStreamingStats, clearNotFoundCache } = useInstantPlayer({
    currentSong,
    queue,
    isPlaying
  });

  // Navigation optimisée avec gestion d'erreur
  const nextSong = useCallback(async () => {
    const savedQueue = localStorage.getItem('queue');
    if (!savedQueue || !currentSong) return;
    
    const queueArray = JSON.parse(savedQueue);
    const currentIndex = queueArray.findIndex((s: Song) => s.id === currentSong.id);
    
    if (currentIndex !== -1 && currentIndex + 1 < queueArray.length) {
      const next = queueArray[currentIndex + 1];
      console.log("⏭️ Chanson suivante instantanée:", next.title);
      try {
        await play(next);
      } catch (error) {
        console.error("❌ Erreur lecture chanson suivante:", error);
        // Essayer la chanson d'après si celle-ci échoue
        if (currentIndex + 2 < queueArray.length) {
          const nextNext = queueArray[currentIndex + 2];
          console.log("🔄 Tentative chanson suivante:", nextNext.title);
          await play(nextNext);
        }
      }
    }
  }, [currentSong, play]);

  const previousSong = useCallback(async () => {
    const savedQueue = localStorage.getItem('queue');
    if (!savedQueue || !currentSong) return;
    
    const queueArray = JSON.parse(savedQueue);
    const currentIndex = queueArray.findIndex((s: Song) => s.id === currentSong.id);
    
    if (currentIndex > 0) {
      const previous = queueArray[currentIndex - 1];
      console.log("⏮️ Chanson précédente instantanée:", previous.title);
      try {
        await play(previous);
      } catch (error) {
        console.error("❌ Erreur lecture chanson précédente:", error);
        // Essayer la chanson d'avant si celle-ci échoue
        if (currentIndex > 1) {
          const prevPrev = queueArray[currentIndex - 2];
          console.log("🔄 Tentative chanson précédente:", prevPrev.title);
          await play(prevPrev);
        }
      }
    }
  }, [currentSong, play]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    updateVolume(newVolume);
  }, [setVolume, updateVolume]);

  const removeSong = useCallback((songId: string) => {
    setQueue(prevQueue => prevQueue.filter(song => song.id !== songId));
  }, [setQueue]);

  // Préchargement automatique optimisé
  useEffect(() => {
    if (currentSong && isPlaying) {
      // Délai ultra-court pour le préchargement
      const timeout = setTimeout(() => {
        preloadNextTracks();
      }, 15); // 15ms seulement
      
      return () => clearTimeout(timeout);
    }
  }, [currentSong, isPlaying, preloadNextTracks]);

  // Préchargement de la queue optimisé et plus conservateur
  useEffect(() => {
    if (queue.length > 0 && currentSong) {
      // Préchargement moins agressif de la queue visible
      const timeout = setTimeout(async () => {
        // Seulement 8 chansons pour éviter la surcharge
        const visibleSongs = queue.slice(0, 8);
        console.log("🎯 Préchargement queue conservateur:", visibleSongs.length);
        await InstantStreaming.prefetchNext(visibleSongs.map(s => s.url));
      }, 400); // 400ms pour laisser le temps à la lecture principale
      
      return () => clearTimeout(timeout);
    }
  }, [queue, currentSong]);

  const contextValue: PlayerContextType = {
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
    play,
    pause,
    setVolume: handleVolumeChange,
    setProgress: updateProgress,
    nextSong,
    previousSong,
    addToQueue,
    removeSong,
    setQueue,
    setHistory,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
    removeFavorite,
    setSearchQuery,
    setPlaybackRate: updatePlaybackRate,
    stopCurrentSong,
    refreshCurrentSong,
    getCurrentAudioElement,
    equalizerSettings,
    equalizerPresets,
    currentEqualizerPreset,
    isEqualizerEnabled,
    isEqualizerInitialized,
    updateEqualizerBand,
    applyEqualizerPreset,
    toggleEqualizer,
    resetEqualizer,
    setEqualizerPreAmp,
    initializeEqualizer
  };

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

// Export both for backward compatibility
export const usePlayerContext = usePlayer;
