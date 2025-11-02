import { useCallback } from 'react';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';
import { Song } from '@/types/player';
import { fetchLyricsInBackground } from '@/utils/lyricsManager';
import { AutoplayManager } from '@/utils/autoplayManager';

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
        const startTime = performance.now();
        console.log("🚀 Récupération URL ultra-rapide...");
        
        const audio = audioRef.current;
        audio.crossOrigin = "anonymous";
        audio.volume = volume / 100;
        
        // Récupération ultra-rapide de l'URL audio
        let audioUrl: string;
        try {
          audioUrl = await UltraFastStreaming.getAudioUrlUltraFast(
            song.url, 
            song.deezer_id,
            song.tidal_id,
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

        // Configuration streaming avec preload
        console.log("⚡ Démarrage instantané");
        audio.preload = "auto"; // Preload activé pour permettre la navigation
        
        // Gestionnaire d'erreur permanent pour détecter les liens expirés/invalides
        const handleAudioError = async (e: Event) => {
          const audioError = (e.target as HTMLAudioElement).error;
          console.error("❌ Erreur audio détectée:", {
            code: audioError?.code,
            message: audioError?.message,
            src: audio.src
          });
          const errorSongId = song.id;
          const originalSrc = audio.src;
          
          // Si c'est une erreur réseau ou abort (lien expiré/invalide)
          if (audioError?.code === MediaError.MEDIA_ERR_NETWORK || 
              audioError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ||
              audioError?.code === MediaError.MEDIA_ERR_DECODE) {
            // Anti-réentrée: éviter de lancer plusieurs récupérations en parallèle
            if ((audio as any).dataset?.recovering === '1') {
              console.log('⏳ Récupération déjà en cours, on ignore cette erreur');
              return;
            }
            (audio as any).dataset = { ...(audio as any).dataset, recovering: '1' } as DOMStringMap;
            
            console.log("🔄 Lien expiré/invalide détecté, rechargement automatique...");
            
            // Supprimer le lien expiré du cache si c'est un lien Tidal
            if (song.tidal_id && audio.src.includes('tidal.com')) {
              try {
                const { supabase } = await import('@/integrations/supabase/client');
                await supabase
                  .from('tidal_audio_links')
                  .delete()
                  .eq('tidal_id', song.tidal_id);
                console.log("🗑️ Lien expiré supprimé du cache pour tidal_id:", song.tidal_id);
              } catch (err) {
                console.error("Erreur suppression cache:", err);
              }
            }
            
            // Récupérer un nouveau lien
            try {
              console.log("🔄 Récupération d'un nouveau lien pour:", song.title);
              
              // Si l'URL actuelle était Deezer/Deezmate, forcer le passage à Tidal
              const isDeezerUrl = audio.src.includes('purr.rip') || 
                                 audio.src.includes('deezer') || 
                                 audio.src.includes('deezmate') ||
                                 audio.src.includes('dzcdn.net');
              
              let newAudioUrl: string | null = null;
              
              if (isDeezerUrl && song.title && song.artist) {
                console.log("🎵 [FALLBACK] URL Deezer échouée, essai Tidal...");
                
                // Importer les fonctions Tidal depuis storage.ts
                const { searchTidalIds, getTidalAudioUrl } = await import('@/utils/storage');
                
                // Essayer de récupérer l'URL via Tidal
                try {
                  // Chercher le Tidal ID
                  let foundTidalId = song.tidal_id;
                  
                  if (!foundTidalId) {
                    console.log("🔍 [TIDAL] Recherche Tidal ID...");
                    const tidalIds = await searchTidalIds(song.title, song.artist, 1);
                    foundTidalId = tidalIds[0] || null;
                  }
                  
                  if (foundTidalId) {
                    console.log("🎵 [TIDAL] ID trouvé:", foundTidalId);
                    newAudioUrl = await getTidalAudioUrl(foundTidalId);
                    
                    if (newAudioUrl) {
                      console.log("✅ [TIDAL] Nouvelle URL obtenue via Tidal");
                      
                      // Sauvegarder le Tidal ID dans la DB
                      const { supabase } = await import('@/integrations/supabase/client');
                      await supabase
                        .from('songs')
                        .update({ tidal_id: foundTidalId })
                        .eq('id', song.id);
                    }
                  }
                } catch (tidalError) {
                  console.error("❌ [TIDAL] Échec aussi:", tidalError);
                }
              }
              
              // Si Tidal n'a pas fonctionné ou ce n'était pas une URL Deezer, réessayer normalement
              if (!newAudioUrl) {
                newAudioUrl = await UltraFastStreaming.getAudioUrlUltraFast(
                  song.url, 
                  song.deezer_id,
                  song.tidal_id,
                  song.title,
                  song.artist,
                  song.id
                );
              }
              
              // Vérifier que la source audio n'a pas été modifiée entre-temps (évite les conflits si la chanson change)
              if (audio.src !== originalSrc) {
                console.warn("⚠️ Source audio changée pendant la recherche, abandon du rechargement");
                (audio as any).dataset && ((audio as any).dataset.recovering = '0');
                return;
              }
              
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
                  try {
                    await audio.play();
                    console.log("✅ Lecture reprise avec le nouveau lien");
                    setIsPlaying(true);
                  } catch (playError) {
                    console.error("❌ Erreur reprise lecture:", playError);
                  }
                }
                
                // Remettre le listener
                audio.addEventListener('error', handleAudioError);
                (audio as any).dataset && ((audio as any).dataset.recovering = '0');
              } else {
                console.warn("⚠️ Nouveau lien identique ou vide");
                (audio as any).dataset && ((audio as any).dataset.recovering = '0');
              }
            } catch (reloadError) {
              console.error("❌ Impossible de recharger le lien:", reloadError);
              toast.error("Impossible de recharger la musique", {
                description: "Le lien audio n'est plus disponible"
              });
              (audio as any).dataset && ((audio as any).dataset.recovering = '0');
            }
          }
        };
        
        // Ajouter le listener permanent (pas once pour capturer les erreurs pendant la lecture)
        audio.removeEventListener('error', handleAudioError); // Supprimer l'ancien si existant
        audio.addEventListener('error', handleAudioError);
        audio.src = audioUrl;
        
        // Démarrage INSTANTANÉ avec AutoplayManager
        const playStartTime = performance.now();
        console.log("🚀 Lecture immédiate...");
        
        const success = await AutoplayManager.playAudio(audio);
        
        if (success) {
          const playElapsed = performance.now() - playStartTime;
          const totalElapsed = performance.now() - startTime;
          
          console.log("✅ === LECTURE DÉMARRÉE AVEC SUCCÈS ===");
          console.log("🎵 Chanson:", song.title);
          console.log("⚡ Temps de lecture:", playElapsed.toFixed(1), "ms");
          console.log("⚡ Temps total:", totalElapsed.toFixed(1), "ms");
          
          setIsPlaying(true);

          // Enregistrer dans l'historique de lecture (asynchrone, sans bloquer l'UI)
          ;(async () => {
            try {
              const { supabase } = await import('@/integrations/supabase/client');
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user?.id) {
                const { error } = await supabase.from('play_history').insert({
                  user_id: session.user.id,
                  song_id: song.id,
                });
                if (error) console.error("Erreur enregistrement historique:", error);
              }
            } catch (e) {
              console.error('Impossible d\'enregistrer l\'historique:', e);
            }
          })();
          
          // Récupération des paroles en arrière-plan pour les musiques Deezer/Tidal
          if (song.isDeezer || song.tidal_id) {
            fetchLyricsInBackground(
              song.id,
              song.title,
              song.artist,
              song.duration,
              song.album_name,
              song.isDeezer
            );
          }
          
          // Préchargement désactivé
          
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
        
        // Si erreur média non supportée, ne pas revenir immédiatement à la précédente
        const isMediaNotSupported = (error as any)?.name === 'NotSupportedError' || (error as any)?.message?.toLowerCase?.().includes('not suitable');
        if (!isMediaNotSupported) {
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
        } else {
          console.log("⏳ Erreur média: tentative de récupération sans changer de chanson");
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
          tidal_id: (data as any).tidal_id || currentSong.tidal_id,
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