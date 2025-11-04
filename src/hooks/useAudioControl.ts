import { useCallback } from 'react';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';
import { Song } from '@/types/player';
import { fetchLyricsInBackground } from '@/utils/lyricsManager';
import { AutoplayManager } from '@/utils/autoplayManager';
import { cacheCurrentSong } from '@/utils/audioCache';

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
      
      console.log("🎵 === DÉMARRAGE MUSIQUE ===");
      console.log("🎶 Chanson:", song.title, "par", song.artist);
      
      // Sauvegarder la musique précédente au cas où il y a une erreur
      const previousSong = currentSong;
      const previousAudioState = {
        currentTime: audioRef.current.currentTime,
        isPlaying: !audioRef.current.paused,
        src: audioRef.current.src
      } as const;
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      // Enregistrer l'interaction utilisateur IMMÉDIATEMENT
      AutoplayManager.registerUserInteraction();
      
      // MediaSession en arrière-plan immédiat
      if ('mediaSession' in navigator) {
        setTimeout(() => updateMediaSessionMetadata(song), 0);
      }

      try {
        console.log("⚡ Configuration audio");
        const audio = audioRef.current;
        audio.crossOrigin = "anonymous";
        audio.volume = volume / 100;
        audio.preload = "auto"; // Force preload auto pour la chanson courante
        
        console.log("🚀 Récupération URL ultra-rapide...");
        const startTime = performance.now();
        
        // Récupération ultra-rapide de l'URL audio
        let audioUrl: string;
        try {
          audioUrl = await UltraFastStreaming.getAudioUrlUltraFast(
            song.url, 
            song.deezer_id,
            song.title,
            song.artist,
            song.id
          );
          const elapsed = performance.now() - startTime;
          console.log("✅ URL récupérée en:", elapsed.toFixed(1), "ms");
        } catch (error: any) {
          console.error("❌ Erreur récupération audio:", error.message);
          
          // Gestion spécifique des erreurs
          if (error.message.includes('OneDrive') || error.message.includes('jeton')) {
            throw new Error('OneDrive non configuré ou jeton expiré. Veuillez configurer OneDrive dans les paramètres.');
          }
          
          if (error.message.includes('not found') || error.message.includes('File not found')) {
            throw new Error(`Fichier audio introuvable: ${song.title}. Le fichier a peut-être été supprimé du stockage.`);
          }
          
          throw error;
        }

        if (!audioUrl || typeof audioUrl !== 'string') {
          throw new Error('URL audio non disponible');
        }

        // Configuration streaming instantané optimisé
        console.log("⚡ Démarrage instantané");
        
        // Démarrage ULTRA-RAPIDE sans attendre loadeddata
        // Le navigateur buffera en arrière-plan
        audio.src = audioUrl;
        
        // Gestionnaire d'erreur permanent pour détecter les liens expirés/invalides
        const handleAudioError = async (e: Event) => {
          const audioError = (e.target as HTMLAudioElement).error;
          console.error("❌ Erreur audio détectée:", {
            code: audioError?.code,
            message: audioError?.message,
            src: audio.src
          });
          
          // Si c'est une erreur réseau ou abort (lien expiré/invalide)
          if (audioError?.code === MediaError.MEDIA_ERR_NETWORK || 
              audioError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ||
              audioError?.code === MediaError.MEDIA_ERR_DECODE) {
            
            console.log("🔄 Lien expiré/invalide détecté, rechargement automatique...");
            
            // Récupérer un nouveau lien
            try {
              console.log("🔄 Récupération d'un nouveau lien pour:", song.title);
              const newAudioUrl = await UltraFastStreaming.getAudioUrlUltraFast(
                song.url, 
                song.deezer_id,
                song.title,
                song.artist,
                song.id
              );
              
              if (newAudioUrl && newAudioUrl !== audio.src) {
                console.log("✅ Nouveau lien obtenu:", newAudioUrl.substring(0, 100) + "...");
                const currentTime = audio.currentTime;
                const wasPlaying = !audio.paused;
                
                // Retirer l'ancien listener pour éviter la boucle
                audio.removeEventListener('error', handleAudioError);
                
                audio.src = newAudioUrl;
                audio.load();
                audio.currentTime = currentTime;
                
                if (wasPlaying) {
                  await audio.play();
                  console.log("✅ Lecture reprise avec le nouveau lien");
                }
                
                // Remettre le listener
                audio.addEventListener('error', handleAudioError);
              } else {
                console.warn("⚠️ Nouveau lien identique ou vide");
              }
            } catch (reloadError) {
              console.error("❌ Impossible de recharger le lien:", reloadError);
              toast.error("Impossible de recharger la musique", {
                description: "Le lien audio n'est plus disponible"
              });
            }
          }
        };
        
        // Ajouter le listener permanent (pas once pour capturer les erreurs pendant la lecture)
        audio.removeEventListener('error', handleAudioError); // Supprimer l'ancien si existant
        audio.addEventListener('error', handleAudioError);
        
        // Démarrage INSTANTANÉ sans attendre - streaming progressif
        // On essaie de jouer immédiatement, le navigateur buffera en arrière-plan
        try {
          // Si déjà quelques données disponibles, on démarre directement
          if (audio.readyState >= 2) {
            console.log("✅ Données déjà disponibles, démarrage immédiat");
          } else {
            // Sinon on attend juste loadeddata (premier frame)
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.warn("⚠️ Timeout atteint, tentative de lecture quand même");
                resolve(); // On essaie quand même
              }, 300); // 300ms max - timeout agressif pour démarrage rapide
              
              const onLoadedData = () => {
                clearTimeout(timeout);
                audio.removeEventListener('loadeddata', onLoadedData);
                audio.removeEventListener('error', onError);
                console.log("✅ Premières données chargées");
                resolve();
              };
              
              const onError = () => {
                clearTimeout(timeout);
                audio.removeEventListener('loadeddata', onLoadedData);
                audio.removeEventListener('error', onError);
                reject(new Error('Erreur chargement audio'));
              };
              
              audio.addEventListener('loadeddata', onLoadedData, { once: true });
              audio.addEventListener('error', onError, { once: true });
              
              // Check immédiat
              if (audio.readyState >= 2) {
                onLoadedData();
              }
            });
          }
        } catch (error) {
          console.warn("⚠️ Erreur attente données:", error);
          // On continue quand même, le navigateur gérera
        }
        
        // Démarrage de la lecture avec AutoplayManager SYSTÉMATIQUEMENT
        console.log("🚀 Démarrage lecture avec AutoplayManager...");
        const playStartTime = performance.now();
        
        const success = await AutoplayManager.playAudio(audio);
        
        if (success) {
          const playElapsed = performance.now() - playStartTime;
          const totalElapsed = performance.now() - startTime;
          
          console.log("✅ === LECTURE DÉMARRÉE AVEC SUCCÈS ===");
          console.log("🎵 Chanson:", song.title);
          console.log("⚡ Temps de lecture:", playElapsed.toFixed(1), "ms");
          console.log("⚡ Temps total:", totalElapsed.toFixed(1), "ms");
          
          setIsPlaying(true);

          // Mettre la chanson en cache (en arrière-plan, sans bloquer)
          ;(async () => {
            try {
              const response = await fetch(audioUrl);
              if (response.ok) {
                const blob = await response.blob();
                await cacheCurrentSong(audioUrl, blob, song.id);
              }
            } catch (e) {
              console.warn('Impossible de mettre en cache:', e);
            }
          })();

          // Enregistrer dans l'historique de lecture (asynchrone, sans bloquer l'UI)
          ;(async () => {
            try {
              const { supabase } = await import('@/integrations/supabase/client');
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user?.id) {
                // Vérifier que le song existe avant d'insérer (évite erreur FK)
                const { data: existingSong } = await supabase
                  .from('songs')
                  .select('id')
                  .eq('id', song.id)
                  .single();
                
                if (existingSong) {
                  const { error } = await supabase.from('play_history').insert({
                    user_id: session.user.id,
                    song_id: song.id,
                  });
                  if (error) console.error("Erreur enregistrement historique:", error);
                } else {
                  console.warn("⚠️ Song non trouvé dans la BDD, historique non enregistré:", song.id);
                }
              }
            } catch (e) {
              console.error('Impossible d\'enregistrer l\'historique:', e);
            }
          })();
          
          // Récupération des paroles en arrière-plan pour les musiques Deezer
          if (song.isDeezer) {
            fetchLyricsInBackground(
              song.id,
              song.title,
              song.artist,
              song.duration,
              song.album_name,
              song.isDeezer
            );
          }
          
          // Préchargement de la chanson suivante en arrière-plan
          setTimeout(() => preloadNextTracks(), 1000);
          
          // Changement terminé
          changeTimeoutRef.current = window.setTimeout(() => {
            setIsChangingSong(false);
            changeTimeoutRef.current = null;
          }, 50);
        } else {
          console.log("⚠️ Lecture en attente d'activation utilisateur");
          setIsChangingSong(false);
          
          toast.info("Cliquez pour activer la lecture audio", {
            duration: 5000,
            position: "top-center"
          });
        }
        
      } catch (error) {
        console.error("💥 Erreur récupération:", error);
        
        // IMPORTANT: Débloquer immédiatement l'interface
        setIsChangingSong(false);
        
        // Revenir à la musique précédente si elle existait
        if (previousSong) {
          console.log("🔄 Retour à la musique précédente:", previousSong.title);
          setCurrentSong(previousSong);
          localStorage.setItem('currentSong', JSON.stringify(previousSong));
          
          // Restaurer l'état audio si la musique jouait
          if (previousAudioState.isPlaying) {
            // Restaurer la source précédente si elle existait
            if (previousAudioState.src) {
              audioRef.current.src = previousAudioState.src;
              audioRef.current.preload = 'auto';
              audioRef.current.crossOrigin = 'anonymous';
              audioRef.current.volume = volume / 100;
            }
            audioRef.current.currentTime = previousAudioState.currentTime;
            try {
              await audioRef.current.play();
              setIsPlaying(true);
            } catch (playError) {
              console.error("Erreur restauration lecture:", playError);
              setIsPlaying(false);
            }
          } else {
            setIsPlaying(false);
          }
        } else {
          setIsPlaying(false);
        }
        
        handlePlayError(error as any, song);
      }
    } else if (audioRef.current) {
      // Reprise avec gestion autoplay
      console.log("⚡ Reprise avec gestion autoplay");
      try {
        audioRef.current.volume = volume / 100;
        const success = await AutoplayManager.playAudio(audioRef.current);
        
        if (success) {
          console.log("✅ Reprise OK");
          setIsPlaying(true);
        } else {
          console.log("⚠️ Reprise en attente d'activation");
        }
      } catch (error) {
        console.error("❌ Erreur reprise:", error);
        setIsPlaying(false);
      }
    }
  }, [audioRef, currentSong, isChangingSong, preloadNextTracks, setCurrentSong, setIsChangingSong, setIsPlaying, setNextSongPreloaded, volume]);

  const handlePlayError = useCallback((error: any, song: Song | null) => {
    console.error("❌ Erreur lecture:", error);
    
    if (error.name === 'NotAllowedError') {
      const browserInfo = AutoplayManager.getBrowserInfo();
      toast.error(`${browserInfo.name} bloque la lecture audio`, {
        description: "Cliquez sur le bouton d'activation qui va apparaître",
        duration: 5000,
        action: {
          label: "Info",
          onClick: () => {
            toast.info("Utilisez Firefox pour une expérience optimale sans restrictions d'autoplay", {
              duration: 8000
            });
          }
        }
      });
    } else if (error.message?.includes('OneDrive') || error.message?.includes('jeton')) {
      toast.error("Configuration OneDrive requise", {
        description: "OneDrive n'est pas configuré ou le jeton a expiré",
        duration: 8000,
        action: {
          label: "Configurer",
          onClick: () => {
            // Rediriger vers les paramètres OneDrive
            window.location.href = '/onedrive-settings';
          }
        }
      });
    } else if (error.message?.includes('Fichier audio introuvable') || error.message?.includes('not found')) {
      toast.error("Fichier audio introuvable", {
        description: `La chanson "${song?.title || 'inconnue'}" n'est plus disponible dans le stockage`,
        duration: 8000,
        action: {
          label: "Passer",
          onClick: () => {
            // Passer à la chanson suivante si possible
            console.log("Passage à la chanson suivante...");
          }
        }
      });
    } else {
      toast.error(`Erreur: ${error.message}`);
    }
    
    const audio = audioRef.current;
    const stillPlaying = audio && !audio.paused && !!audio.src;
    setIsPlaying(!!stillPlaying);
    setIsChangingSong(false);
  }, [audioRef, setIsPlaying, setIsChangingSong]);

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