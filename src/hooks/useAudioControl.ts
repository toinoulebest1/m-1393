import { useCallback, useRef } from 'react';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';
import { Song } from '@/types/player';
import { fetchLyricsInBackground } from '@/utils/lyricsManager';
import { AutoplayManager } from '@/utils/autoplayManager';
import { cacheCurrentSong, getFromCache } from '@/utils/audioCache';

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
  setDisplayedSong: (song: Song | null) => void;
}

// Compteur d'appels pour debugging
let playCallCounter = 0;

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
  preloadNextTracks,
  setDisplayedSong
}: UseAudioControlProps) => {

  // Handlers et intervalle persistants
  const errorHandlerRef = useRef<((e: Event) => void) | null>(null);
  const stalledHandlerRef = useRef<((e: Event) => void) | null>(null);
  const renewalIntervalRef = useRef<number | null>(null);

  const play = useCallback(async (song?: Song) => {
    playCallCounter++;
    const callId = playCallCounter;
    const timestamp = new Date().toISOString();
    
    console.log(`\n🎬 === APPEL PLAY #${callId} à ${timestamp} ===`);
    console.log(`📝 Song demandée:`, song ? `"${song.title}" (ID: ${song.id})` : "AUCUNE");
    console.log(`📝 Current song:`, currentSong ? `"${currentSong.title}" (ID: ${currentSong.id})` : "AUCUNE");
    console.log(`⏱️ isChangingSong:`, isChangingSong);
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      console.log(`✅ APPEL #${callId}: Changement de chanson confirmé`);
      console.log(`   De: ${currentSong?.title || "RIEN"} (${currentSong?.id || "N/A"})`);
      console.log(`   Vers: ${song.title} (${song.id})`);
      
      // ✅ TOUJOURS arrêter tous les audios avant de commencer
      console.log("🛑 Arrêt complet de tous les audios avant nouvelle lecture");
      console.log("Nouvelle chanson:", song.title);
      console.log("Chanson actuelle:", currentSong?.title);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
      }
      if (nextAudioRef.current) {
        nextAudioRef.current.pause();
        nextAudioRef.current.currentTime = 0;
        nextAudioRef.current.src = '';
      }
      
      setIsChangingSong(true);
      
      console.log("🎵 === DÉMARRAGE MUSIQUE ===");
      console.log("🎶 Chanson:", song.title, "par", song.artist);
      
      // ✅ Mettre à jour l'état ET l'affichage EN MÊME TEMPS
      setCurrentSong(song);
      setDisplayedSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      console.log("✅ État synchronisé - Affichage:", song.title);
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
        
        // Nettoyage des anciens listeners et intervalles
        if (errorHandlerRef.current) {
          audio.removeEventListener('error', errorHandlerRef.current);
          errorHandlerRef.current = null;
        }
        if (stalledHandlerRef.current) {
          audio.removeEventListener('stalled', stalledHandlerRef.current as any);
          stalledHandlerRef.current = null;
        }
        if (renewalIntervalRef.current) {
          clearInterval(renewalIntervalRef.current);
          renewalIntervalRef.current = null;
        }
        
        console.log("🚀 Récupération URL ultra-rapide pour:", song.title, "ID:", song.id);
        const startTime = performance.now();
        
        // ✅ SIMPLIFIÉ: Vérifier directement le cache avec l'URL de la chanson demandée
        // Ne plus se fier à cachedCurrentSong qui peut être désynchronisé
        let audioUrl: string;
        let apiDuration: number | undefined;
        
        console.log("🔍 Vérification cache IndexedDB pour:", song.title);
        const cachedUrl = await getFromCache(song.url);
        
        if (cachedUrl) {
          audioUrl = cachedUrl;
          const elapsed = performance.now() - startTime;
          console.log("✅ ⚡ CACHE HIT! URL récupérée depuis IndexedDB en:", elapsed.toFixed(1), "ms");
          console.log("✅ Chanson depuis cache:", song.title, "ID:", song.id);
        } else {
          console.log("⚠️ Pas en cache, récupération réseau pour:", song.title);
          const result = await UltraFastStreaming.getAudioUrlUltraFast(
            song.url, 
            song.deezer_id,
            song.title,
            song.artist,
            song.id
          );
          audioUrl = result.url;
          apiDuration = result.duration;
          const elapsed = performance.now() - startTime;
          console.log("✅ URL réseau récupérée en:", elapsed.toFixed(1), "ms pour:", song.title);
          if (apiDuration) {
            console.log("✅ Durée API récupérée:", apiDuration, "secondes");
            // Mettre à jour immédiatement MediaSession avec la durée API
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
              try {
                navigator.mediaSession.setPositionState({
                  duration: apiDuration,
                  position: 0,
                  playbackRate: 1
                });
                console.log("📊 MediaSession durée définie AVANT lecture:", apiDuration);
              } catch (e) {
                console.warn("⚠️ Erreur setPositionState:", e);
              }
            }
          }
        }
        
        // Gestion des erreurs si pas d'URL
        try {
          if (!audioUrl || typeof audioUrl !== 'string') {
            throw new Error('URL audio non disponible');
          }
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

        // Configuration streaming instantané optimisé
        console.log("⚡ Démarrage instantané de:", song.title);
        console.log("🔗 URL audio:", audioUrl.substring(0, 50) + "...");
        
        // ✅ SÉCURITÉ: S'assurer qu'aucun audio ne joue avant de charger le nouveau
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        
        // Attendre un micro-instant pour que le navigateur libère les ressources
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Maintenant on peut charger la nouvelle source
        audio.src = audioUrl;
        console.log("✅ Source audio assignée pour:", song.title);
        
        // Petit helper pour attendre la lisibilité
        const waitForCanPlay = (timeoutMs = 2000) => new Promise<void>((resolve, reject) => {
          if (audio.readyState >= 3) return resolve();
          let done = false;
          const cleanup = () => { if (done) return; done = true; audio.removeEventListener('canplay', onCanPlay); audio.removeEventListener('error', onErr); clearTimeout(timer); };
          const onCanPlay = () => { cleanup(); resolve(); };
          const onErr = () => { cleanup(); reject(new Error('audio error before canplay')); };
          const timer = setTimeout(() => { cleanup(); reject(new Error('canplay timeout')); }, timeoutMs);
          audio.addEventListener('canplay', onCanPlay, { once: true });
          audio.addEventListener('error', onErr, { once: true });
        });
        
        // Gestionnaire d'erreur permanent pour détecter les liens expirés/invalides
        let isHandlingError = false;
        const handleAudioError = async (e: Event) => {
          const audioError = (e.target as HTMLAudioElement).error;
          
          // Ignorer les erreurs "aborted" (code 1) - changement de chanson normal
          if (audioError?.code === 1) {
            console.log("⚠️ Chargement annulé (changement de chanson)");
            return;
          }
          
          console.error("❌ Erreur audio détectée:", {
            code: audioError?.code,
            message: audioError?.message,
            src: audio.src
          });
          
          // Éviter les boucles de fallback
          if (isHandlingError) {
            console.log("⚠️ Erreur déjà en cours de traitement, ignoré");
            return;
          }
          
          // Laisser l'utilisateur recliquer sur play au lieu de relancer automatiquement
          isHandlingError = true;
          console.log("⚠️ Erreur audio - utilisateur doit recliquer sur play");
          toast.error("Erreur de lecture, cliquez sur play pour réessayer");
          isHandlingError = false;
        };
        
        // Gestionnaire de stalled (buffering bloqué) - DÉSACTIVÉ
        const handleStalled = async () => {
          console.warn("⚠️ Buffering bloqué (stalled) - ignoré");
          // Ne rien faire, laisser le navigateur gérer
        };
        
        // Renouvellement préventif DÉSACTIVÉ (causait des arrêts intempestifs)
        // Le lien sera renouvelé uniquement en cas d'erreur via handleAudioError
        const setupLinkRenewal = () => {
          // Fonction vide pour éviter les interruptions
          console.log("ℹ️ Renouvellement automatique désactivé (éviter les interruptions)");
        };
        
        // Nettoyage du renouvellement (au cas où)
        const cleanupRenewal = () => {
          if (renewalIntervalRef.current) {
            clearInterval(renewalIntervalRef.current);
            renewalIntervalRef.current = null;
          }
        };
        
        audio.addEventListener('ended', cleanupRenewal);
        
        // Ajouter les listeners (avec refs stables)
        if (errorHandlerRef.current) audio.removeEventListener('error', errorHandlerRef.current);
        if (stalledHandlerRef.current) audio.removeEventListener('stalled', stalledHandlerRef.current as any);
        errorHandlerRef.current = handleAudioError;
        stalledHandlerRef.current = handleStalled;
        audio.addEventListener('error', errorHandlerRef.current);
        audio.addEventListener('stalled', stalledHandlerRef.current as any);
        
        // Activer le renouvellement automatique
        setupLinkRenewal();
        
        // Listener pour mettre à jour MediaSession dès que la durée est connue
        const onLoadedMetadata = () => {
          if ('mediaSession' in navigator && audio.duration && !isNaN(audio.duration)) {
            // Importer la fonction updatePositionState
            import('@/utils/mediaSession').then(({ updatePositionState }) => {
              updatePositionState(audio.duration, audio.currentTime || 0, audio.playbackRate || 1);
              console.log("📊 MediaSession: metadata loaded, duration:", audio.duration.toFixed(1));
            });
          }
        };
        audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        
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
        
        // Timeout de 15 secondes pour détecter si la musique ne démarre pas
        let hasStartedPlaying = false;
        const playbackTimeout = setTimeout(() => {
          if (!hasStartedPlaying) {
            console.error("❌ Timeout: La musique n'a pas démarré après 15 secondes");
            audio.pause();
            audio.src = '';
            setIsChangingSong(false);
            setIsPlaying(false);
            
            toast.error("Musique indisponible", {
              description: `"${song.title}" ne peut pas être lue pour le moment. Veuillez réessayer plus tard.`,
              duration: 5000
            });
          }
        }, 15000);
        
        let success = false;
        try {
          success = await AutoplayManager.playAudio(audio);
        } catch (err: any) {
          const errMsg = String(err?.message || err);
          if (errMsg.includes('interrupted by a new load request')) {
            console.warn('⚠️ play() interrompu par un nouveau chargement - attente de playing');
            // Attendre que le navigateur stabilise la lecture
            await new Promise<void>((resolve) => {
              const onPlaying = () => { audio.removeEventListener('playing', onPlaying); resolve(); };
              audio.addEventListener('playing', onPlaying, { once: true });
              // Sécurité: si déjà en lecture
              if (!audio.paused) { audio.removeEventListener('playing', onPlaying); resolve(); }
            });
            success = true;
          } else {
            clearTimeout(playbackTimeout);
            throw err;
          }
        }
        
        if (success) {
          hasStartedPlaying = true;
          clearTimeout(playbackTimeout);
          
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
                await cacheCurrentSong(audioUrl, blob, song.id, song.title);
                console.log("✅ Chanson actuelle mise en cache avec succès:", song.title);
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
            console.log(`🏁 FIN APPEL PLAY #${callId}: ${song.title} terminé avec SUCCÈS`);
            setIsChangingSong(false);
            changeTimeoutRef.current = null;
          }, 50);
        } else {
          console.log("⚠️ Lecture en attente d'activation utilisateur");
          console.log(`🏁 FIN APPEL PLAY #${callId}: ${song.title} en attente`);
          setIsChangingSong(false);
          
          toast.info("Cliquez pour activer la lecture audio", {
            duration: 5000,
            position: "top-center"
          });
        }
        
        } catch (error) {
          const errMsg = (error as any)?.message ? String((error as any).message) : String(error);
          // Cas fréquent sur Chrome: play() interrompu par un nouveau chargement
          if (errMsg.includes('interrupted by a new load request')) {
            console.warn('⚠️ play() interrompu par un nouveau chargement - pas de rollback');
            console.log(`🏁 FIN APPEL PLAY #${callId}: INTERROMPU (nouveau chargement)`);
            setIsChangingSong(false);
            setIsPlaying(!audioRef.current?.paused);
            return;
          }

          console.error("💥 Erreur récupération:", error);
          
          // IMPORTANT: Stopper COMPLÈTEMENT l'audio en erreur
          console.log("🛑 Arrêt complet de l'audio en erreur");
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
          
          // Débloquer l'interface
          console.log(`🏁 FIN APPEL PLAY #${callId}: ERREUR - ${errMsg}`);
          setIsChangingSong(false);
          setIsPlaying(false);
          
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
      toast.error("Musique indisponible pour le moment, veuillez réessayer ultérieurement");
    } else {
      toast.error("Musique indisponible pour le moment, veuillez réessayer ultérieurement");
    }
    
    const audio = audioRef.current;
    const stillPlaying = audio && !audio.paused && !!audio.src;
    setIsPlaying(!!stillPlaying);
    setIsChangingSong(false);
  }, [audioRef, setIsPlaying, setIsChangingSong]);

  const pause = useCallback(() => {
    console.log("=== PAUSE DEBUG ===");
    console.log("isChangingSong:", isChangingSong);
    console.log("audioRef paused:", audioRef.current?.paused);
    
    if (audioRef.current) {
      audioRef.current.pause();
      console.log("✅ Audio mis en pause");
    }
    if (nextAudioRef.current && !nextAudioRef.current.paused) {
      nextAudioRef.current.pause();
      console.log("✅ NextAudio mis en pause aussi");
    }
    setIsPlaying(false);
    console.log("==================");
  }, [audioRef, nextAudioRef, setIsPlaying, isChangingSong]);

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