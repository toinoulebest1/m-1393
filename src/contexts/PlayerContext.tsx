import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Song, PlayerContextType, MaskingState } from '@/types/player';
import { usePlayerState } from '@/hooks/usePlayerState';
import { usePlayerFavorites } from '@/hooks/usePlayerFavorites';
import { useAudioControl } from '@/hooks/useAudioControl';
import { usePlayerPreferences } from '@/hooks/usePlayerPreferences';
import { useIntelligentPreloader } from '@/hooks/useIntelligentPreloader';
import { useToast } from "@/hooks/use-toast";
import { AutoplayManager } from "@/utils/autoplayManager";
import { usePlayerQueue } from '@/hooks/usePlayerQueue';

import { getAudioFileUrl } from '@/utils/storage';
import { toast } from 'sonner';
import { updateMediaSessionMetadata, updatePositionState, durationToSeconds } from '@/utils/mediaSession';
import { getFromCache } from '@/utils/audioCache';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';
import { fetchLyricsInBackground } from '@/utils/lyricsManager';
import { lastfmService } from '@/services/lastfmService';

import { optimizeAudioElement, createOptimizedAudio } from '@/utils/audioOptimization';

// ... keep existing code

// Contexte global et audio optimisé
const PlayerContext = createContext<PlayerContextType | null>(null);
const globalAudio = createOptimizedAudio();

// Helper function to create next audio element
const createNextAudio = () => {
  return createOptimizedAudio();
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Historique des artistes pour éviter les répétitions
  const recentArtistsRef = useRef<string[]>([]);
  
  // Cache des recommandations Last.fm préchargées
  const lastfmCacheRef = useRef<Song | null>(null);
  const lastfmPreloadingRef = useRef(false);
  
  // Nettoyage des anciennes données de queue, mais CONSERVATION des données de restauration
  useEffect(() => {
    // console.log("🧹 Nettoyage des anciennes données (sauf restauration)...");
    localStorage.removeItem('queue');
    localStorage.removeItem('lastSearchResults');
    localStorage.removeItem('shuffleMode');
    localStorage.removeItem('repeatMode');
  }, []);

  // Hooks personnalisés qui encapsulent la logique
  const { 
    currentSong, setCurrentSong,
    isPlaying, setIsPlaying,
    progress, setProgress, savedProgress, setSavedProgress,
    volume, setVolume: setVolumeState,
    isChangingSong, setIsChangingSong,
    history, setHistory,
    searchQuery, setSearchQuery,
    playbackRate, setPlaybackRate,
    isSeeking, setIsSeeking
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
  const [maskingState, setMaskingState] = useState<MaskingState | null>(null);
  
  // Stocker la durée de l'API pour MediaSession
  const apiDurationRef = useRef<number | undefined>(undefined);

  // Prédiction intelligente de la prochaine chanson
  const { predictNextSongs, preloadPredictedSongs, recordTransition, cancelAllPreloads } = useIntelligentPreloader();
  const predictedNextRef = useRef<Song | null>(null);
  const previousSongRef = useRef<Song | null>(null);

  // Enregistrer dans l'historique Supabase quand une chanson est jouée
  useEffect(() => {
    if (!currentSong) return;

    const saveToHistory = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // La logique complexe de résolution d'ID Deezer est supprimée.
        // On assume que currentSong.id est l'ID correct de la table 'songs'.
        const { error } = await supabase
          .from('play_history')
          .insert({
            user_id: session.user.id,
            song_id: currentSong.id,
            played_at: new Date().toISOString()
          });

        if (error) {
          // Gérer le cas où la chanson n'existe pas encore dans la table 'songs'
          // (par exemple, juste après un upload ou pour une chanson Tidal)
          if (error.code === '23503') { // Foreign key violation
            // console.warn(`La chanson ${currentSong.id} n'existe pas dans la table 'songs'. Tentative d'insertion.`);
            const { error: insertError } = await supabase.from('songs').insert({
              id: currentSong.id,
              title: currentSong.title,
              artist: currentSong.artist,
              file_path: currentSong.url,
              image_url: currentSong.imageUrl,
              duration: currentSong.duration,
              uploaded_by: session.user.id,
              tidal_id: currentSong.tidal_id // Inclure tidal_id si présent
            });

            if (insertError) {
              console.error("❌ Échec de l'insertion de la nouvelle chanson:", insertError);
            } else {
              // Réessayer d'insérer dans l'historique
              await supabase.from('play_history').insert({
                user_id: session.user.id,
                song_id: currentSong.id,
                played_at: new Date().toISOString()
              });
            }
          } else {
            console.error('❌ Erreur enregistrement historique:', error);
          }
        } else {
          // console.log('✅ Chanson enregistrée dans l\'historique:', currentSong.title);
        }
      } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement dans l\'historique:', error);
      }
    };

    saveToHistory();
  }, [currentSong?.id]);

  // Mettre à jour la prédiction quand la chanson change
  useEffect(() => {
    if (!currentSong) { 
      predictedNextRef.current = null; 
      return; 
    }
    
    // Enregistrer la transition
    if (previousSongRef.current && previousSongRef.current.id !== currentSong.id) {
      // console.log("🔄 Détection de transition pour prédiction:", previousSongRef.current.title, "->", currentSong.title);
      recordTransition(previousSongRef.current, currentSong);
    }
    previousSongRef.current = currentSong;
    
    (async () => {
      try {
        // console.log("🔄 Début prédiction pour:", currentSong.title, "ID:", currentSong.id);
        
        // Lancer la recherche de paroles en arrière-plan
        // console.log('[PlayerContext] Appel de fetchLyricsInBackground avec:', {
        //   songId: currentSong.id,
        //   songTitle: currentSong.title,
        //   artist: currentSong.artist,
        //   duration: currentSong.duration,
        //   albumName: currentSong.album_name,
        //   isTidal: !!currentSong.tidal_id,
        //   tidalId: currentSong.tidal_id
        // });
        fetchLyricsInBackground(
          currentSong.id, 
          currentSong.title, 
          currentSong.artist, 
          currentSong.duration, 
          currentSong.album_name,
          !!currentSong.tidal_id,
          currentSong.tidal_id
        );

        const preds = await predictNextSongs(currentSong, history);
        predictedNextRef.current = preds[0] || null;
        
        if (predictedNextRef.current) {
          // console.log("✅ Prédiction FIXÉE:", predictedNextRef.current.title, "ID:", predictedNextRef.current.id);
          // console.log("📦 Référence stockée dans predictedNextRef.current");
          // Précharger immédiatement
          await preloadPredictedSongs(preds);
        }
      } catch (e) {
        console.warn("⚠️ Erreur prédiction:", e);
        predictedNextRef.current = null;
      }
    })();
  }, [currentSong, predictNextSongs, preloadPredictedSongs, recordTransition]);
  // Fonctions exposées à travers le contexte - définies après les hooks
  const { 
    play, 
    pause, 
    resume,
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
    preloadNextTracks,
    setDisplayedSong,
    apiDurationRef
  });

  const {
    queue,
    setQueue,
    shuffleMode,
    shuffledQueue,
    repeatMode,
    addToQueue,
    toggleShuffle,
    toggleRepeat,
    nextSong: nextSongFromQueue,
    previousSong: previousSongFromQueue,
    playFromQueue,
  } = usePlayerQueue({
    currentSong,
    play,
    history,
    setHistory,
  });

  // Wrapper function for setVolume that updates both state and audio element
  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    updateVolume(newVolume);
  }, [setVolumeState, updateVolume]);

  // Ajoute la chanson à l'historique local quand elle change
  useEffect(() => {
    if (currentSong) {
      setHistory(prevHistory => {
        // Éviter d'ajouter la même chanson deux fois de suite
        if (prevHistory.length > 0 && prevHistory[prevHistory.length - 1].id === currentSong.id) {
          return prevHistory;
        }
        return [...prevHistory, currentSong];
      });
      
      // Ajouter l'artiste à l'historique pour éviter les répétitions Last.fm
      if (currentSong.artist) {
        const artistLower = currentSong.artist.toLowerCase();
        // Ne pas ajouter si c'est déjà le dernier artiste de l'historique
        if (recentArtistsRef.current[recentArtistsRef.current.length - 1] !== artistLower) {
          recentArtistsRef.current.push(artistLower);
          // Garder seulement les 5 derniers artistes
          if (recentArtistsRef.current.length > 5) {
            recentArtistsRef.current.shift();
          }
          console.log('[Artist History] Historique des artistes:', recentArtistsRef.current);
        }
      }
    }
  }, [currentSong, setHistory]);

  // Prépare l'élément audio suivant avec l'URL et attend le canplay
  const prepareNextAudio = async (song: Song) => {
    try {
      // Utiliser UltraFastStreaming pour obtenir l'URL, car il gère toutes les sources
      const result = await UltraFastStreaming.getAudioUrlUltraFast(
        song.url,
        song.title,
        song.artist,
        song.id
      );
      if (!result || !result.url || typeof result.url !== 'string') throw new Error('URL invalide pour la prochaine piste');
      nextAudioRef.current.src = result.url;
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
      // console.log('Prochaine piste prête pour crossfade:', song.title);
    } catch (e) {
      console.error('Préparation prochaine piste échouée:', e);
      setNextSongPreloaded(false);
    }
  };

  // Fonctions de navigation SANS QUEUE - uniquement prédictions
  const nextSong = useCallback(async () => {
    if (isChangingSong) {
      // console.log("Changement de chanson déjà en cours");
      return;
    }
    await nextSongFromQueue();
  }, [isChangingSong, nextSongFromQueue]);

  const previousSong = useCallback(async () => {
    if (isChangingSong) {
      // console.log("Changement de chanson déjà en cours");
      return;
    }
    await previousSongFromQueue();
  }, [isChangingSong, previousSongFromQueue]);

  // Restauration de la lecture au chargement - OPTIMISÉ
  useEffect(() => {
    const restorePlayback = async () => {
      // console.log('🔄 [RESTORE] Starting playback restoration...');
      
      const savedSongString = localStorage.getItem('currentSong');
      const savedProgressValue = localStorage.getItem('audioProgress');
      const savedIsPlaying = localStorage.getItem('isPlaying');
      
      // console.log(`[RESTORE] Found in localStorage:`, {
      //   savedSong: savedSongString ? 'YES' : 'NO',
      //   savedProgress: savedProgressValue || 'NO',
      //   savedIsPlaying: savedIsPlaying || 'NO',
      // });
      
      if (savedSongString) {
        let song: Song;
        try {
          song = JSON.parse(savedSongString);
          // console.log('[RESTORE] Successfully parsed song from localStorage:', {
          //   id: song.id,
          //   title: song.title,
          //   url: song.url,
          //   tidal_id: song.tidal_id, // Ajout pour le débogage
          // });
        } catch (e) {
          console.error('[RESTORE] FAILED to parse song from localStorage. Clearing invalid data.', e);
          localStorage.removeItem('currentSong');
          localStorage.removeItem('audioProgress');
          localStorage.removeItem('isPlaying');
          return;
        }
        
        const shouldResumePlaying = savedIsPlaying ? JSON.parse(savedIsPlaying) : false;
        
        apiDurationRef.current = durationToSeconds(song.duration);
        // console.log(`[RESTORE] API duration restored from localStorage: ${apiDurationRef.current}s for "${song.title}"`);

        try {
          // console.log(`[RESTORE] Attempting to restore: "${song.title}" (ID: ${song.id})`);
          setIsAudioReady(false);
          
          // console.log(`[RESTORE] Calling UltraFastStreaming with URL key: "${song.url}"`);
          const result = await UltraFastStreaming.getAudioUrlUltraFast(
            song.url,
            song.title,
            song.artist,
            song.id
          );
          
          if (!result || !result.url || typeof result.url !== 'string') {
            console.error("[RESTORE] FAILED: UltraFastStreaming did not return a valid URL.");
            return;
          }
          // console.log(`[RESTORE] SUCCESS: UltraFastStreaming returned a playable URL: ${result.url.substring(0, 100)}...`);

          // Configuration audio avec gestion d'état
          audioRef.current.src = result.url;
          audioRef.current.preload = "auto";
          
          // Gestionnaires d'événements pour le chargement
          const handleCanPlay = async () => {
            // console.log("[RESTORE] Event 'canplay' triggered.");
            setIsAudioReady(true);
            
            if (savedProgressValue) {
              const savedTime = parseFloat(savedProgressValue);
              // console.log(`[RESTORE] Restoring progress to ${savedTime} seconds.`);
              audioRef.current.currentTime = savedTime;
              setProgress((savedTime / audioRef.current.duration) * 100);
            }
            
            if (shouldResumePlaying) {
              // console.log("[RESTORE] Attempting to resume playback...");
              try {
                await audioRef.current.play();
                setIsPlaying(true);
                // console.log("[RESTORE] Playback resumed successfully.");
              } catch (playError) {
                console.warn("[RESTORE] Autoplay failed:", playError);
                setIsPlaying(false);
              }
            }
            
            audioRef.current.removeEventListener('canplay', handleCanPlay);
            audioRef.current.removeEventListener('error', handleError);
          };

          const handleError = (error: any) => {
            console.error("[RESTORE] FAILED: Error loading audio:", error);
            setIsAudioReady(false);
            localStorage.removeItem('currentSong');
            localStorage.removeItem('audioProgress');
            localStorage.removeItem('isPlaying');
            
            audioRef.current.removeEventListener('canplay', handleCanPlay);
            audioRef.current.removeEventListener('error', handleError);
          };

          audioRef.current.addEventListener('canplay', handleCanPlay);
          audioRef.current.addEventListener('error', handleError);
          
          audioRef.current.load();
          
          setCurrentSong(song);
          setDisplayedSong(song); // S'assurer que l'affichage est aussi mis à jour
          
          // console.log("[RESTORE] Restoration initiated, waiting for audio element events...");
        } catch (error) {
          console.error("[RESTORE] FAILED: Critical error during restoration process:", error);
          localStorage.removeItem('currentSong');
          localStorage.removeItem('audioProgress');
          localStorage.removeItem('isPlaying');
          setIsAudioReady(false);
        }
      } else {
        // console.log('[RESTORE] No saved song found. Restoration complete.');
        setIsAudioReady(true);
      }
    };

    restorePlayback();
  }, []);

  // Garder affichage aligné quand la chanson change naturellement
  useEffect(() => {
    setDisplayedSong(currentSong);
    console.log('[PlayerContext] displayedSong updated:', currentSong?.title, 'Image URL:', currentSong?.imageUrl);
  }, [currentSong]);

  // Sauvegarde en temps réel de la position - OPTIMISÉ
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // NE PAS METTRE À JOUR si l'utilisateur est en train de déplacer le curseur
      if (isSeeking) return;

      const currentTime = audio.currentTime;
      const duration = apiDurationRef.current || audio.duration;

      // Mettre à jour l'état de la progression pour l'UI
      if (duration && !isNaN(duration) && duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        setProgress(progressPercent);
      }
      
      // Sauvegarder la position toutes les 2 secondes pour optimiser
      if (Math.floor(currentTime) % 2 === 0) {
        localStorage.setItem('audioProgress', currentTime.toString());
      }

      // Mettre à jour la Media Session uniquement avec des données valides
      // La durée de l'API est prioritaire, sinon on utilise la durée réelle de l'élément audio
      const validDuration = apiDurationRef.current || audio.duration;
      if (validDuration && !isNaN(validDuration) && validDuration > 0) {
        updatePositionState(validDuration, currentTime, audio.playbackRate);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio && currentSong && !isNaN(audio.currentTime)) {
        const currentTime = audio.currentTime;
        const duration = apiDurationRef.current || audio.duration;
        
        // Mettre à jour le progress dans l'état
        if (duration && !isNaN(duration) && duration > 0) {
          const progressPercent = (currentTime / duration) * 100;
          setProgress(progressPercent);
        }
        
        // Mettre à jour MediaSession avec la durée
        if (duration && !isNaN(duration) && duration > 0) {
          updatePositionState(duration, currentTime, audio.playbackRate);
        }
      }
    };

    const handleLoadStart = () => {
      // Seulement mettre à false si on change de chanson, pas pendant le préchargement
      if (isChangingSong) {
        // console.log("🔄 Début du chargement audio");
        setIsAudioReady(false);
      }
    };

    const handleCanPlay = () => {
      // console.log("✅ Audio prêt");
      setIsAudioReady(true);
    };
    
    const handlePlaying = () => {
      // S'assurer que isAudioReady est true quand la lecture démarre
      setIsAudioReady(true);
      
      // Mettre à jour MediaSession quand la lecture démarre
      if ('mediaSession' in navigator && audio) {
        navigator.mediaSession.playbackState = 'playing';
        try {
          // S'assurer que la durée de l'API est définie
          if (!apiDurationRef.current && currentSong?.duration) {
            apiDurationRef.current = durationToSeconds(currentSong.duration);
          }
          const duration = apiDurationRef.current || audio.duration;
          if (duration && !isNaN(duration) && duration > 0) {
            updatePositionState(duration, audio.currentTime, audio.playbackRate);
          }
        } catch (e) {
          // Ignorer les erreurs
        }
      }
    };
    
    const handlePause = () => {
      // Mettre à jour MediaSession quand la lecture est en pause
      if ('mediaSession' in navigator && audio) {
        navigator.mediaSession.playbackState = 'paused';
        try {
          const duration = apiDurationRef.current || audio.duration;
          if (duration && !isNaN(duration) && duration > 0) {
            updatePositionState(duration, audio.currentTime, audio.playbackRate);
          }
        } catch (e) {
          // Ignorer les erreurs
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);

    // Action handlers for seeking
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const audio = audioRef.current;
          if (!audio) return;
          const skipTime = details.seekOffset || 10;
          const newTime = Math.max(audio.currentTime - skipTime, 0);
          audio.currentTime = newTime;
          updatePositionState(apiDurationRef.current || audio.duration, newTime, audio.playbackRate);
        });
      } catch (e) { console.warn("Could not set seekbackward handler"); }

      try {
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const audio = audioRef.current;
          if (!audio) return;
          const skipTime = details.seekOffset || 10;
          const newTime = Math.min(audio.currentTime + skipTime, apiDurationRef.current || audio.duration);
          audio.currentTime = newTime;
          updatePositionState(apiDurationRef.current || audio.duration, newTime, audio.playbackRate);
        });
      } catch (e) { console.warn("Could not set seekforward handler"); }

      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          const audio = audioRef.current;
          if (!audio) return;
          if (details.seekTime != null && (apiDurationRef.current || audio.duration)) {
            const newTime = Math.max(0, Math.min(details.seekTime, apiDurationRef.current || audio.duration));
            audio.currentTime = newTime;
            updatePositionState(apiDurationRef.current || audio.duration, newTime, audio.playbackRate);
          }
        });
      } catch (e) { console.warn("Could not set seekto handler"); }

      try {
        navigator.mediaSession.setActionHandler('stop', () => {
          stopCurrentSong();
        });
      } catch (e) { console.warn("Could not set stop handler"); }
    }

    return () => {
      if (audio) {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('playing', handlePlaying);
        audio.removeEventListener('pause', handlePause);
      }
      // Clear handlers
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('seekto', null);
        navigator.mediaSession.setActionHandler('stop', null);
      }
    };
  }, [currentSong, setProgress, isChangingSong, stopCurrentSong, isSeeking]);

  // Persistance des données
  useEffect(() => {
    if (currentSong) {
      // console.log('[PERSISTENCE] Saving currentSong to localStorage:', {
      //   id: currentSong.id,
      //   title: currentSong.title,
      //   url: currentSong.url,
      // });
      localStorage.setItem('currentSong', JSON.stringify(currentSong));
      localStorage.setItem('isPlaying', JSON.stringify(isPlaying)); // Persister l'état de lecture
    } else {
      // console.log('[PERSISTENCE] currentSong is null, clearing localStorage.');
      // Si currentSong est null, effacer toutes les données de lecture persistées
      localStorage.removeItem('currentSong');
      localStorage.removeItem('audioProgress');
      localStorage.removeItem('isPlaying');
    }
  }, [currentSong, isPlaying]); // Ajouter isPlaying aux dépendances

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
        // console.log(`Démarrage du fondu enchaîné, temps restant: ${timeLeft.toFixed(2)}s, durée du fondu: ${transitionTime}s`);
        
        // Utiliser la logique de file d'attente pour la prochaine chanson
        const activeQueue = shuffleMode ? shuffledQueue : queue;
        const currentIndex = activeQueue.findIndex(s => s.id === currentSong.id);
        const nextSongInQueue = activeQueue[currentIndex + 1];

        if (!nextSongInQueue) {
          // console.log("Pas de chanson suivante dans la file d'attente pour le crossfade.");
          return;
        }

        fadingRef.current = true;
        
        const alertElement = document.getElementById('next-song-alert');
        const titleElement = document.getElementById('next-song-title');
        const artistElement = document.getElementById('next-song-artist');

        if (alertElement && titleElement && artistElement) {
          titleElement.textContent = nextSongInQueue.title;
          artistElement.textContent = nextSongInQueue.artist;
          alertElement.classList.remove('opacity-0', 'translate-y-2');
          alertElement.classList.add('opacity-100', 'translate-y-0');

          setTimeout(() => {
            alertElement.classList.add('opacity-0', 'translate-y-2');
            alertElement.classList.remove('opacity-100', 'translate-y-0');
          }, 3000);
        }

        if (!nextAudioRef.current.src || !nextSongPreloaded) {
          // console.log("Préparation de la prochaine piste pour le crossfade...");
          prepareNextAudio(nextSongInQueue).then(() => {
            startCrossfade(timeLeft, nextSongInQueue);
          }).catch((e) => {
            console.error('Impossible de préparer la prochaine piste:', e);
            // Tentative de fallback: démarrer quand même
            startCrossfade(timeLeft, nextSongInQueue);
          });
        } else {
          startCrossfade(timeLeft, nextSongInQueue);
        }
      }
    };
    
    const startCrossfade = (timeLeft: number, nextSong: Song) => {
      // console.log(`Début du fondu enchaîné pour ${nextSong.title}`);
      
      nextAudioRef.current.volume = 0;
      const playPromise = nextAudioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // console.log("Lecture de la prochaine chanson démarrée avec succès");
          
          // Afficher immédiatement la prochaine chanson dans l'UI, sans changer la source principale
          setDisplayedSong(nextSong);
          
          if ('mediaSession' in navigator) {
            updateMediaSessionMetadata(nextSong);
            // console.log("Métadonnées MediaSession mises à jour au début du crossfade:", nextSong.title);
          }
          
          const crossfadeDuration = overlapTimeRef.current;
          
          const fadeDuration = Math.min(timeLeft * 1000, crossfadeDuration * 1000);
          const steps = Math.max(50, fadeDuration / 20);
          const intervalTime = fadeDuration / steps;
          const volumeStep = (volume / 100) / steps;
          
          // console.log(`Paramètres du fondu: durée=${fadeDuration}ms, étapes=${steps}, intervalleTemps=${intervalTime}ms, pas de volume=${volumeStep}`);
          
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
              
              // if (stepCount % 10 === 0) {
              //   console.log(`Progression du fondu: out=${Math.round(currentOutVolume*100)}%, in=${Math.round(currentInVolume*100)}%, étape=${stepCount}`);
              // }
            } else {
              // console.log("Fondu enchaîné terminé, passage à la chanson suivante");
              
              if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
              }
              
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
              
              const nextTrack = nextSong;
              if (nextTrack) {
                // Mettre à jour la durée de l'API pour la nouvelle chanson
                apiDurationRef.current = durationToSeconds(nextTrack.duration);
                
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
                  // console.log("Métadonnées MediaSession mises à jour lors du crossfade:", nextTrack.title);
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

    const handleEnded = async () => {
      // console.log("=== SONG ENDED ===");
      // console.log("Chanson terminée:", currentSong?.title);
      // console.log("Fondu en cours:", fadingRef.current);
      
      if (!fadingRef.current) {
        // console.log("Lecture terminée naturellement sans crossfade");
        setProgress(0);
        
        if (repeatMode === 'one') {
          // console.log("Répétition de la chanson actuelle");
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(err => console.error("Erreur lors de la répétition:", err));
        } else {
          const activeQueue = shuffleMode ? shuffledQueue : queue;
          
          // Si la queue est vide, essayer de trouver une chanson similaire via Last.fm
          if (activeQueue.length === 0 && currentSong) {
            // Utiliser la recommandation préchargée si disponible
            if (lastfmCacheRef.current) {
              console.log('[LastFM Autoplay] Utilisation de la recommandation préchargée:', lastfmCacheRef.current.title);
              const cachedSong = lastfmCacheRef.current;
              lastfmCacheRef.current = null;
              toast.success(`Lecture automatique: ${cachedSong.title} par ${cachedSong.artist}`);
              await play(cachedSong);
              return;
            }
            
            console.log('[LastFM Autoplay] Queue vide, recherche immédiate de chanson similaire...');
            
            try {
              let nextSongToPlay = null;
              
              // 1. Essayer de trouver des chansons similaires avec track.getsimilar
              if (currentSong.artist && currentSong.title) {
                const similarTracks = await lastfmService.getSimilarTracks(
                  currentSong.artist,
                  currentSong.title
                );
                
                // Chercher ces chansons dans la base de données ou sur les services de streaming
                for (const track of similarTracks) {
                  if (recentArtistsRef.current.includes(track.artist.name.toLowerCase())) {
                    continue;
                  }
                  
                  let song = await lastfmService.findSongInDatabase(
                    track.artist.name,
                    track.name
                  );
                  
                  if (!song) {
                    song = await lastfmService.searchTrackOnStreamingService(track.artist.name, track.name) as any;
                  }
                  
                  if (song && song.id !== currentSong.id) {
                    nextSongToPlay = song;
                    break;
                  }
                }
              }
              
              // 2. Si aucune chanson similaire, essayer des artistes similaires
              if (!nextSongToPlay && currentSong.artist) {
                const similarArtists = await lastfmService.getSimilarArtists(currentSong.artist);
                
                for (const artist of similarArtists) {
                  if (recentArtistsRef.current.includes(artist.name.toLowerCase())) {
                    continue;
                  }
                  
                  let song = await lastfmService.findSongsByArtist(artist.name);
                  
                  if (!song) {
                    song = await lastfmService.searchArtistOnStreamingService(artist.name) as any;
                  }
                  
                  if (song && song.id !== currentSong.id) {
                    nextSongToPlay = song;
                    console.log('[LastFM Autoplay] Chanson d\'artiste similaire trouvée:', song.title, 'by', song.artist);
                    break;
                  }
                }
              }
              
              // 3. Jouer la chanson trouvée
              if (nextSongToPlay) {
                toast.success(`Lecture automatique: ${nextSongToPlay.title} par ${nextSongToPlay.artist}`);
                await play(nextSongToPlay);
              } else {
                console.log('[LastFM Autoplay] Aucune recommandation trouvée');
                toast.info("Aucune recommandation trouvée");
              }
            } catch (error) {
              console.error('[LastFM Autoplay] Erreur:', error);
              toast.error("Erreur lors de la recherche de recommandations");
            }
          } else {
            // Utiliser la logique de file d'attente normale
            nextSongFromQueue();
          }
        }
      }
      // console.log("==================");
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
  }, [currentSong, nextSongPreloaded, play, repeatMode, preferences.crossfadeEnabled, volume, queue, shuffleMode, shuffledQueue, nextSongFromQueue]);

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

  // L'objet context complet sans queue
  const value = {
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
    resume,
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
    isSeeking,
    setIsSeeking,
    maskingState,
    setMaskingState,
    playFromQueue,
  };

  return (
    <PlayerContext.Provider value={value}>
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