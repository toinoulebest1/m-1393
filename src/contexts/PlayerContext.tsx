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
    setIsChangingSong
  } = usePlayerState(audioRef);

  const {
    queue,
    setQueue,
    shuffleMode,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
    nextSong: getNextSong,
    previousSong: getPreviousSong,
    addToQueue,
    removeSong
  } = usePlayerQueue(currentSong);

  const {
    favorites,
    favoriteStats,
    searchQuery,
    setSearchQuery,
    toggleFavorite,
    removeFavorite
  } = usePlayerFavorites();

  const {
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
  } = useEqualizer(audioRef);

  // Préchargement ultra-intelligent
  const preloadNextTracks = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;

    console.log("🚀 Préchargement ultra-agressif démarré");
    
    try {
      // Trouver les 3 prochaines chansons probables
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
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
  }, [currentSong, queue]);

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

  // Hook pour le système ultra-rapide
  const { getCacheStats } = useUltraFastPlayer({
    currentSong,
    queue,
    isPlaying
  });

  const nextSong = useCallback(() => {
    const next = getNextSong();
    if (next) {
      console.log("⏭️ Chanson suivante ultra-rapide:", next.title);
      play(next);
    }
  }, [getNextSong, play]);

  const previousSong = useCallback(() => {
    const previous = getPreviousSong();
    if (previous) {
      console.log("⏮️ Chanson précédente ultra-rapide:", previous.title);
      play(previous);
    }
  }, [getPreviousSong, play]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    updateVolume(newVolume);
  }, [setVolume, updateVolume]);

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
