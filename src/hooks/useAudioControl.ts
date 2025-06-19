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
      
      console.log("🎵 === DÉBUT LECTURE NOUVELLE CHANSON ===");
      console.log("🎶 Chanson:", song.title, "par", song.artist);
      console.log("🆔 ID:", song.id);
      console.log("📁 Chemin:", song.url);
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      if ('mediaSession' in navigator) {
        updateMediaSessionMetadata(song);
      }

      try {
        console.log("🔍 Récupération du fichier audio...");
        
        // Démarrer la récupération de l'URL audio
        const audioUrlPromise = getAudioFile(song.url);
        
        // Vérifier d'abord le cache pour une lecture immédiate
        console.log("🚀 Vérification cache pour lecture immédiate...");
        const isAlreadyCached = await isInCache(song.url);
        
        let audioUrl: string;
        
        if (isAlreadyCached) {
          console.log("✅ Fichier trouvé dans le cache - lecture immédiate");
          const cachedUrl = await getFromCache(song.url);
          if (cachedUrl) {
            audioUrl = cachedUrl;
          } else {
            console.log("⚠️ Cache invalide, attente de l'URL principale");
            audioUrl = await audioUrlPromise;
          }
        } else {
          console.log("📡 Pas de cache - récupération depuis le stockage");
          audioUrl = await audioUrlPromise;
        }

        if (!audioUrl) {
          console.error("❌ Aucune URL audio retournée");
          throw new Error('Fichier audio non trouvé');
        }

        console.log("✅ URL audio récupérée:", audioUrl);
        console.log("🔗 Type d'URL:", audioUrl.startsWith('http') ? 'HTTP' : audioUrl.startsWith('blob:') ? 'Blob' : 'Autre');

        // Configuration de l'élément audio pour streaming
        audioRef.current.crossOrigin = "anonymous";
        audioRef.current.src = audioUrl;
        audioRef.current.currentTime = 0;
        
        // Configuration optimisée pour le streaming
        if (audioUrl.startsWith('http')) {
          console.log("🌐 Configuration streaming pour URL HTTP");
          audioRef.current.preload = "metadata"; // Charge seulement les métadonnées au début
          
          // Si ce n'est pas déjà en cache, démarrer le téléchargement en arrière-plan
          if (!isAlreadyCached) {
            console.log("💾 Démarrage du téléchargement en arrière-plan pour cache");
            // Téléchargement asynchrone sans bloquer la lecture
            fetch(audioUrl)
              .then(response => {
                if (response.ok) {
                  return response.blob();
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              })
              .then(blob => {
                console.log("✅ Téléchargement terminé, ajout au cache:", blob.size, "bytes");
                return addToCache(song.url, blob);
              })
              .catch(error => {
                console.warn("⚠️ Échec du téléchargement en arrière-plan:", error);
                // La lecture continue même si le cache échoue
              });
          }
        } else {
          console.log("💿 Configuration standard pour URL locale/blob");
          audioRef.current.preload = "auto";
        }
        
        console.log("⚙️ Configuration audio element terminée");
        console.log("🔊 Volume initial:", volume / 100);

        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("✅ === LECTURE RÉUSSIE (STREAMING) ===");
            console.log("🎵 Chanson:", song.title);
            console.log("🔊 Volume:", audioRef.current.volume);
            console.log("📡 Mode streaming:", audioUrl.startsWith('http') ? 'Activé' : 'Local');
            
            setIsPlaying(true);
            audioRef.current.volume = volume / 100;
            
            // Vérification de progression adaptée au streaming
            const timeCheckTimeout = setTimeout(() => {
              console.log("🕐 === VÉRIFICATION PROGRESSION STREAMING ===");
              console.log("⏰ Temps actuel après 2 secondes:", audioRef.current.currentTime);
              console.log("⏸️ État pause:", audioRef.current.paused);
              console.log("🔇 État muet:", audioRef.current.muted);
              console.log("🔊 Volume:", audioRef.current.volume);
              console.log("📊 Ready state:", audioRef.current.readyState);
              console.log("🌐 Network state:", audioRef.current.networkState);
              
              // Pour le streaming, accepter un démarrage plus lent
              if (audioRef.current.currentTime === 0 && !audioRef.current.paused && audioRef.current.readyState < 3) {
                console.log("📡 Streaming en cours - attente du buffering...");
                
                // Attendre encore un peu pour le buffering
                setTimeout(() => {
                  if (audioRef.current.currentTime === 0 && !audioRef.current.paused) {
                    console.log("🚨 PROBLÈME STREAMING: Aucune progression après buffering");
                    toast.error("Problème de streaming - cliquez pour réessayer", {
                      duration: 5000,
                      action: {
                        label: "Réessayer",
                        onClick: () => {
                          console.log("🔄 Nouvelle tentative de streaming");
                          audioRef.current.pause();
                          audioRef.current.currentTime = 0;
                          audioRef.current.play().then(() => {
                            console.log("✅ Streaming réussi après nouvelle tentative");
                            setIsPlaying(true);
                          }).catch(err => {
                            console.error("❌ Échec streaming même après nouvelle tentative:", err);
                            setIsPlaying(false);
                          });
                        }
                      }
                    });
                    setIsPlaying(false);
                  } else {
                    console.log("✅ Streaming démarré avec succès:", audioRef.current.currentTime, "secondes");
                  }
                }, 3000); // Attente supplémentaire pour le streaming
                
              } else if (audioRef.current.currentTime > 0) {
                console.log("✅ Lecture progresse normalement:", audioRef.current.currentTime, "secondes");
              }
              console.log("=======================================");
            }, 2000);
            
            setTimeout(() => preloadNextTracks(), 1000);
            
            changeTimeoutRef.current = window.setTimeout(() => {
              setIsChangingSong(false);
              changeTimeoutRef.current = null;
            }, 1200);
          }).catch(error => {
            console.error("❌ === ERREUR DE LECTURE STREAMING ===");
            console.error("🔴 Type:", error.name);
            console.error("💬 Message:", error.message);
            console.error("🔍 Détails:", error);
            
            // Gestion spécifique des erreurs de streaming
            if (error.name === 'NotAllowedError') {
              console.log("🔒 Erreur de permission - interaction utilisateur requise");
              toast.error("Cliquez sur la page puis réessayez la lecture", {
                duration: 5000,
                action: {
                  label: "Réessayer",
                  onClick: () => {
                    audioRef.current.play().then(() => {
                      setIsPlaying(true);
                    }).catch(err => {
                      console.error("Échec après interaction:", err);
                      setIsPlaying(false);
                    });
                  }
                }
              });
            } else if (error.name === 'NotSupportedError') {
              console.log("🚫 Format non supporté");
              toast.error("Format audio non supporté pour le streaming");
            } else if (error.name === 'NetworkError') {
              console.log("🌐 Erreur réseau streaming");
              toast.error("Erreur réseau - vérifiez votre connexion");
            } else {
              toast.error(`Erreur streaming: ${error.message}`);
            }
            
            setIsPlaying(false);
            setIsChangingSong(false);
          });
        }
      } catch (error) {
        console.error("💥 === ERREUR RÉCUPÉRATION FICHIER STREAMING ===");
        console.error("🔴 Erreur:", error);
        console.error("💬 Message:", error instanceof Error ? error.message : 'Erreur inconnue');
        
        if (error instanceof Error) {
          if (error.message.includes('non trouvé') || error.message.includes('not found')) {
            toast.error(`Fichier audio introuvable pour "${song.title}"`);
          } else {
            toast.error(`Erreur: ${error.message}`);
          }
        } else {
          toast.error("Erreur inconnue lors du streaming");
        }
        
        setCurrentSong(null);
        localStorage.removeItem('currentSong');
        setIsPlaying(false);
        setIsChangingSong(false);
      }
    } else if (audioRef.current) {
      // Reprendre la lecture existante
      console.log("▶️ Reprise de la lecture existante");
      try {
        audioRef.current.volume = volume / 100;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("✅ Reprise réussie");
            setIsPlaying(true);
          }).catch(error => {
            console.error("❌ Erreur reprise:", error);
            if (error.name === 'NotAllowedError') {
              toast.error("Veuillez cliquer sur la page puis réessayer", {
                action: {
                  label: "Réessayer",
                  onClick: () => {
                    audioRef.current.play().then(() => setIsPlaying(true));
                  }
                }
              });
            }
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error("💥 Erreur reprise audio:", error);
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
        // Update the current song with the fresh data
        const updatedSong: Song = {
          ...currentSong,
          title: data.title || currentSong.title,
          artist: data.artist || currentSong.artist,
          imageUrl: data.image_url || currentSong.imageUrl,
          genre: data.genre || currentSong.genre,
        };
        
        setCurrentSong(updatedSong);
        localStorage.setItem('currentSong', JSON.stringify(updatedSong));
        
        // Update media session metadata
        if ('mediaSession' in navigator) {
          updateMediaSessionMetadata(updatedSong);
        }
        
        console.log("Current song metadata refreshed:", updatedSong.title);
      }
    } catch (error) {
      console.error("Error in refreshCurrentSong:", error);
    }
  }, [currentSong, setCurrentSong]);

  // Function to directly access the audio element
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
