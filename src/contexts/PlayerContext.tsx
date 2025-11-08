import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Song, PlayerContextType } from '@/types/player';
import { usePlayerState } from '@/hooks/usePlayerState';
import { usePlayerFavorites } from '@/hooks/usePlayerFavorites';
import { useAudioControl } from '@/hooks/useAudioControl';
import { usePlayerPreferences } from '@/hooks/usePlayerPreferences';
import { useIntelligentPreloader } from '@/hooks/useIntelligentPreloader';
import { useToast } from "@/hooks/use-toast";
import { AutoplayManager } from "@/utils/autoplayManager";

import { getAudioFileUrl } from '@/utils/storage';
import { toast } from 'sonner';
import { updateMediaSessionMetadata, updatePositionState, durationToSeconds } from '@/utils/mediaSession';
import { getFromCache } from '@/utils/audioCache';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';

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
  // Nettoyage complet du localStorage (supprimer toutes les queues)
  useEffect(() => {
    console.log("🧹 Nettoyage COMPLET - suppression de toutes les anciennes données...");
    localStorage.removeItem('queue');
    localStorage.removeItem('lastSearchResults');
    localStorage.removeItem('shuffleMode');
    localStorage.removeItem('repeatMode');
    localStorage.removeItem('currentSong');
    localStorage.removeItem('audioProgress');
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
  
  // Stocker la durée de l'API pour MediaSession
  const apiDurationRef = useRef<number | undefined>(undefined);

  // États de répétition (sans queue)
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');

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
            console.warn(`La chanson ${currentSong.id} n'existe pas dans la table 'songs'. Tentative d'insertion.`);
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
          console.log('✅ Chanson enregistrée dans l\'historique:', currentSong.title);
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
      recordTransition(previousSongRef.current, currentSong);
    }
    previousSongRef.current = currentSong;
    
    (async () => {
      try {
        console.log("🔄 Début prédiction pour:", currentSong.title, "ID:", currentSong.id);
        const preds = await predictNextSongs(currentSong, history);
        predictedNextRef.current = preds[0] || null;
        
        if (predictedNextRef.current) {
          console.log("✅ Prédiction FIXÉE:", predictedNextRef.current.title, "ID:", predictedNextRef.current.id);
          console.log("📦 Référence stockée dans predictedNextRef.current");
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

  // Wrapper function for setVolume that updates both state and audio element
  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    updateVolume(newVolume);
  }, [setVolumeState, updateVolume]);

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
      console.log('Prochaine piste prête pour crossfade:', song.title);
    } catch (e) {
      console.error('Préparation prochaine piste échouée:', e);
      setNextSongPreloaded(false);
    }
  };

  // Fonctions de navigation SANS QUEUE - uniquement prédictions
  const nextSong = useCallback(async () => {
    if (isChangingSong) {
      console.log("Changement de chanson déjà en cours");
      return;
    }

    console.log("=== BOUTON SUIVANT CLIQUÉ ===");
    
    // Annuler les préchargements intelligents
    cancelAllPreloads();

    const nextPredicted = predictedNextRef.current;
    console.log("🔍 DEBUG NEXT SONG:");
    console.log("- Chanson actuelle:", currentSong?.title, "ID:", currentSong?.id);
    console.log("- Chanson prédite:", nextPredicted?.title, "ID:", nextPredicted?.id);
    console.log("- Historique (dernières 15):", history.slice(-15).map(s => s.title).join(", "));
    
    if (nextPredicted && nextPredicted.id !== currentSong?.id) {
      console.log("✅ Lecture de la chanson prédite:", nextPredicted.title, "ID:", nextPredicted.id);
      await play(nextPredicted);
    } else if (currentSong && nextPredicted?.id === currentSong?.id) {
      console.warn("⚠️ Prédiction obsolète (même chanson), nouvelle prédiction...");
      toast.info("Recherche d'une chanson suivante...");
      
      const newPreds = await predictNextSongs(currentSong, history);
      const newNextSong = newPreds[0];

      if (newNextSong && newNextSong.id !== currentSong.id) {
        console.log("✅ Nouvelle prédiction trouvée, lecture:", newNextSong.title);
        predictedNextRef.current = newNextSong;
        await play(newNextSong);
      } else {
        console.error("❌ Impossible de trouver une chanson suivante différente.");
        toast.error("Erreur: chanson suivante non trouvée.");
      }
    } else if (nextPredicted?.id === currentSong?.id) {
      console.error("❌ BUG: La prédiction pointe vers la même chanson!");
      toast.error("Erreur: même chanson détectée");
    } else {
      console.warn("⚠️ Aucune chanson prédite disponible");
      toast.info("Pas de chanson suivante disponible");
    }
    console.log("=================================");
  }, [isChangingSong, play, cancelAllPreloads, currentSong, history]);

  const previousSong = useCallback(async () => {
    if (isChangingSong) {
      console.log("Changement de chanson déjà en cours");
      return;
    }

    console.log("=== BOUTON PRÉCÉDENT CLIQUÉ ===");

    // Annuler les préchargements intelligents
    cancelAllPreloads();

    if (history.length > 1) {
      // Revenir à la chanson précédente dans l'historique
      const prevSong = history[history.length - 2];
      console.log("◀️ Lecture de la chanson précédente:", prevSong.title);
      await play(prevSong);
    } else {
      toast.info("Pas de chanson précédente");
    }
  }, [isChangingSong, history, play, cancelAllPreloads]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(current => {
      if (current === 'none') return 'all';
      if (current === 'all') return 'one';
      return 'none';
    });
  }, []);

  // Restauration de la lecture au chargement - OPTIMISÉ
  useEffect(() => {
    const restorePlayback = async () => {
      const savedSong = localStorage.getItem('currentSong');
      const savedProgressValue = localStorage.getItem('audioProgress');
      const savedIsPlaying = localStorage.getItem('isPlaying'); // Récupérer l'état de lecture sauvegardé
      
      console.log("🔄 Restauration de la lecture...");
      console.log("Chanson sauvegardée:", savedSong ? "OUI" : "NON");
      console.log("Position sauvegardée:", savedProgressValue);
      console.log("État de lecture sauvegardé:", savedIsPlaying);
      
      if (savedSong) {
        const song = JSON.parse(savedSong);
        const shouldResumePlaying = savedIsPlaying ? JSON.parse(savedIsPlaying) : false; // Déterminer si la lecture doit reprendre
        
        // *** LA CORRECTION EST ICI ***
        // On fournit immédiatement la durée à partir des métadonnées sauvegardées,
        // sans attendre que l'élément audio la charge.
        apiDurationRef.current = durationToSeconds(song.duration);
        console.log(`✅ Durée API restaurée depuis localStorage: ${apiDurationRef.current}s pour "${song.title}"`);

        try {
          console.log("🎵 Restauration de:", song.title, "ID:", song.id);
          setIsAudioReady(false);
          
          // Utiliser UltraFastStreaming pour obtenir l'URL
          console.log("📡 Récupération via UltraFastStreaming...");
          const result = await UltraFastStreaming.getAudioUrlUltraFast(
            song.url,
            song.title,
            song.artist,
            song.id
          );
          
          if (!result || !result.url || typeof result.url !== 'string') {
            console.log("❌ Pas d'URL audio disponible");
            return;
          }

          // Configuration audio avec gestion d'état
          audioRef.current.src = result.url;
          audioRef.current.preload = "auto";
          
          // Gestionnaires d'événements pour le chargement
          const handleCanPlay = async () => { // Rendre async pour await play()
            console.log("🎵 Audio prêt à être lu");
            setIsAudioReady(true);
            
            if (savedProgressValue) {
              const savedTime = parseFloat(savedProgressValue);
              console.log("⏰ Restauration position à:", savedTime, "secondes");
              audioRef.current.currentTime = savedTime;
              setProgress((savedTime / audioRef.current.duration) * 100);
            }
            
            // Si la chanson était en lecture, tenter de la relancer
            if (shouldResumePlaying) {
              console.log("▶️ Tentative de reprise de la lecture...");
              try {
                await audioRef.current.play();
                setIsPlaying(true);
              } catch (playError) {
                console.warn("⚠️ Échec de la reprise automatique de la lecture:", playError);
                toast.info("La lecture n'a pas pu reprendre automatiquement. Veuillez cliquer sur Play.");
                setIsPlaying(false);
              }
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
            localStorage.removeItem('isPlaying'); // Supprimer aussi l'état de lecture en cas d'erreur
            
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
          
          console.log("✅ Restauration initiée, attente du chargement...");
        } catch (error) {
          console.error("❌ Erreur lors de la restauration de la lecture:", error);
          localStorage.removeItem('currentSong');
          localStorage.removeItem('audioProgress');
          localStorage.removeItem('isPlaying');
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
      updatePositionState(duration, currentTime, audio.playbackRate);
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
        updatePositionState(duration, currentTime, audio.playbackRate);
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
      
      // Mettre à jour MediaSession quand la lecture démarre
      if ('mediaSession' in navigator && audio) {
        navigator.mediaSession.playbackState = 'playing';
        try {
          // S'assurer que la durée de l'API est définie
          if (!apiDurationRef.current && currentSong?.duration) {
            apiDurationRef.current = durationToSeconds(currentSong.duration);
          }
          const duration = apiDurationRef.current || audio.duration;
          if (duration && !isNaN(duration) && duration !== Infinity) {
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
          if (duration && !isNaN(duration) && duration !== Infinity) {
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
      localStorage.setItem('currentSong', JSON.stringify(currentSong));
      localStorage.setItem('isPlaying', JSON.stringify(isPlaying)); // Persister l'état de lecture
    } else {
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
        console.log(`Démarrage du fondu enchaîné, temps restant: ${timeLeft.toFixed(2)}s, durée du fondu: ${transitionTime}s`);
        
        const nextSongPredicted = predictedNextRef.current;
        if (!nextSongPredicted) {
          console.log("Pas de chanson suivante disponible");
          return;
        }

        fadingRef.current = true;
        
        const alertElement = document.getElementById('next-song-alert');
        const titleElement = document.getElementById('next-song-title');
        const artistElement = document.getElementById('next-song-artist');

        if (alertElement && titleElement && artistElement) {
          titleElement.textContent = nextSongPredicted.title;
          artistElement.textContent = nextSongPredicted.artist;
          alertElement.classList.remove('opacity-0', 'translate-y-2');
          alertElement.classList.add('opacity-100', 'translate-y-0');

          setTimeout(() => {
            alertElement.classList.add('opacity-0', 'translate-y-2');
            alertElement.classList.remove('opacity-100', 'translate-y-0');
          }, 3000);
        }

        if (!nextAudioRef.current.src || !nextSongPreloaded) {
          console.log("Préparation de la prochaine piste pour le crossfade...");
          prepareNextAudio(nextSongPredicted).then(() => {
            startCrossfade(timeLeft, nextSongPredicted);
          }).catch((e) => {
            console.error('Impossible de préparer la prochaine piste:', e);
            // Tentative de fallback: démarrer quand même avec préchargement intelligent
            preloadNextTracks().finally(() => startCrossfade(timeLeft, nextSongPredicted));
          });
        } else {
          startCrossfade(timeLeft, nextSongPredicted);
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
              
              const nextTrack = predictedNextRef.current;
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
      console.log("=== SONG ENDED ===");
      console.log("Chanson terminée:", currentSong?.title);
      console.log("Fondu en cours:", fadingRef.current);
      console.log("Chanson suivante prédite:", predictedNextRef.current?.title);
      
      if (!fadingRef.current) {
        console.log("Lecture terminée naturellement sans crossfade");
        setProgress(0);
        
        if (repeatMode === 'one') {
          console.log("Répétition de la chanson actuelle");
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(err => console.error("Erreur lors de la répétition:", err));
        } else {
          const nextTrack = predictedNextRef.current;
          
          if (nextTrack) {
            console.log("Passage à la chanson suivante prédite:", nextTrack.title);
            
            if ('mediaSession' in navigator) {
              updateMediaSessionMetadata(nextTrack);
            }
            
            play(nextTrack);
          } else {
            console.log("Pas de chanson suivante");
            setIsPlaying(false);
            toast.info("Lecture terminée");
          }
        }
      }
      console.log("==================");
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
  }, [currentSong, nextSongPreloaded, play, repeatMode, preferences.crossfadeEnabled, volume]);

  // Fonction pour supprimer une chanson de toutes les listes
  const removeSong = useCallback((songId: string) => {
    if (currentSong?.id === songId) {
      stopCurrentSong();
      setCurrentSong(null);
      localStorage.removeItem('currentSong');
    }
    
    setHistory(prevHistory => prevHistory.filter(song => song.id !== songId));
    
    if (favorites.some(song => song.id === songId)) {
      removeFavorite(songId);
    }
    
    toast.success("La chanson a été supprimée de votre bibliothèque");
  }, [currentSong, setCurrentSong, stopCurrentSong, setHistory, favorites, removeFavorite]);

  // L'objet context complet sans queue
  const value = {
    currentSong,
    displayedSong,
    isPlaying,
    progress,
    volume,
    queue: [], // Queue désactivée
    shuffleMode: false, // Pas de shuffle sans queue
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
    setQueue: () => {}, // Fonction vide
    setHistory,
    play,
    pause,
    resume,
    setVolume,
    setProgress,
    nextSong,
    previousSong,
    addToQueue: () => {}, // Fonction vide
    toggleShuffle: () => {}, // Fonction vide
    toggleRepeat,
    toggleFavorite,
    removeFavorite,
    setSearchQuery,
    setPlaybackRate: updatePlaybackRate,
    refreshCurrentSong,
    getCurrentAudioElement,
    isSeeking,
    setIsSeeking
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