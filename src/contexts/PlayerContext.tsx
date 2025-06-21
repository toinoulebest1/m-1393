
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { Song, PlayerContextType, EqualizerSettings } from '@/types/player';
import { useAudioControl } from '@/hooks/useAudioControl';
import { usePlayerFavorites } from '@/hooks/usePlayerFavorites';
import { usePlayerQueue } from '@/hooks/usePlayerQueue';
import { usePlayerState } from '@/hooks/usePlayerState';
import { usePlayerPreferences } from '@/hooks/usePlayerPreferences';
import { useEqualizer } from '@/hooks/useEqualizer';
import { useUltraFastPlayer } from '@/hooks/useUltraFastPlayer';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';

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

  // Préchargement ultra-intelligent
  const preloadNextTracks = useCallback(async () => {
    if (!currentSong) return;

    console.log("🚀 Préchargement ultra-agressif démarré");
    
    try {
      // Trouver les 3 prochaines chansons probables depuis la queue
      const savedQueue = localStorage.getItem('queue');
      if (!savedQueue) return;
      
      const queue = JSON.parse(savedQueue);
      const currentIndex = queue.findIndex((s: Song) => s.id === currentSong.id);
      const nextSongs: Song[] = [];
      
      if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
        // Ajouter les 3 chansons suivantes dans la queue
        for (let i = 1; i <= 3 && currentIndex + i < queue.length; i++) {
          nextSongs.push(queue[currentIndex + i]);
        }
      }
      
      if (nextSongs.length > 0) {
        console.log("🎯 Préchargement batch:", nextSongs.map(s => s.title));
        await UltraFastStreaming.preloadBatch(nextSongs.map(s => s.url));
        setNextSongPreloaded(true);
      }
    } catch (error) {
      console.warn("⚠️ Erreur préchargement:", error);
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

  // Hook pour le système ultra-rapide
  const { getCacheStats } = useUltraFastPlayer({
    currentSong,
    queue,
    isPlaying
  });

  const nextSong = useCallback(async () => {
    const savedQueue = localStorage.getItem('queue');
    if (!savedQueue || !currentSong) return;
    
    const queueArray = JSON.parse(savedQueue);
    const currentIndex = queueArray.findIndex((s: Song) => s.id === currentSong.id);
    
    if (currentIndex !== -1 && currentIndex + 1 < queueArray.length) {
      const next = queueArray[currentIndex + 1];
      console.log("⏭️ Chanson suivante ultra-rapide:", next.title);
      await play(next);
    }
  }, [currentSong, play]);

  const previousSong = useCallback(async () => {
    const savedQueue = localStorage.getItem('queue');
    if (!savedQueue || !currentSong) return;
    
    const queueArray = JSON.parse(savedQueue);
    const currentIndex = queueArray.findIndex((s: Song) => s.id === currentSong.id);
    
    if (currentIndex > 0) {
      const previous = queueArray[currentIndex - 1];
      console.log("⏮️ Chanson précédente ultra-rapide:", previous.title);
      await play(previous);
    }
  }, [currentSong, play]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    updateVolume(newVolume);
  }, [setVolume, updateVolume]);

  const removeSong = useCallback((songId: string) => {
    setQueue(prevQueue => prevQueue.filter(song => song.id !== songId));
  }, [setQueue]);

  // Préchargement automatique au changement de chanson
  useEffect(() => {
    if (currentSong && isPlaying) {
      // Délai ultra-court pour le préchargement
      const timeout = setTimeout(() => {
        preloadNextTracks();
      }, 100); // 100ms après le début de la lecture
      
      return () => clearTimeout(timeout);
    }
  }, [currentSong, isPlaying, preloadNextTracks]);

  // Préchargement de la queue au changement
  useEffect(() => {
    if (queue.length > 0 && currentSong) {
      // Préchargement différé de toute la queue visible
      const timeout = setTimeout(async () => {
        const visibleSongs = queue.slice(0, 10); // Précharger les 10 premières
        console.log("🎯 Préchargement queue visible:", visibleSongs.length);
        await UltraFastStreaming.preloadBatch(visibleSongs.map(s => s.url));
      }, 2000); // 2 secondes après
      
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
