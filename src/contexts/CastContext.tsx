import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { usePlayerContext } from './PlayerContext';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';

interface CastDevice {
  id: string;
  name: string;
  type: 'chromecast' | 'airplay' | 'other';
}

interface CastContextType {
  devices: CastDevice[];
  activeDevice: CastDevice | null;
  isDiscovering: boolean;
  isCasting: boolean;
  discoverDevices: () => Promise<void>;
  connectToDevice: (device: CastDevice) => Promise<void>;
  disconnectFromDevice: () => void;
}

const CastContext = createContext<CastContextType | null>(null);

// Extend window interface for Cast API
declare global {
  interface Window {
    __onGCastApiAvailable: (isAvailable: boolean) => void;
    chrome: {
      cast: any;
    };
    cast: any;
  }
}

export const CastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const playerContext = usePlayerContext();
  
  const currentSong = playerContext?.currentSong;
  const isPlaying = playerContext?.isPlaying;
  const progress = playerContext?.progress;
  const getCurrentAudioElement = playerContext?.getCurrentAudioElement || (() => null);
  
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<CastDevice | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castSession, setCastSession] = useState<any>(null);
  const [isApiReady, setIsApiReady] = useState(false);

  const handleDisconnectRef = useRef<() => void>(() => {});
  const lastSyncedProgressRef = useRef<number>(0);

  // Initialize Google Cast API (Cast Framework)
  useEffect(() => {
    console.log('🎬 Initializing Cast Framework...');

    /* if (window.top !== window.self) {
      console.warn('⚠️ Cast in iframe preview may be limited. Open the app in a new tab.');
      toast.info('Cast indisponible en mode aperçu', {
        description: 'Ouvrez l\'application dans un nouvel onglet pour détecter vos appareils Cast.'
      });
    } */

    const onCastReady = () => {
      const castAny: any = (window as any).cast;
      if (!castAny?.framework) {
        console.warn('⚠️ cast.framework not available');
        return;
      }

      try {
        const context = castAny.framework.CastContext.getInstance();
        context.setOptions({
          receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.TAB_AND_ORIGIN_SCOPED || 'tab_and_origin_scoped',
        });

        console.log('✅ Cast Framework initialized');
        setIsApiReady(true);

        // Listen to session changes
        context.addEventListener(castAny.framework.CastContextEventType.SESSION_STATE_CHANGED, (e: any) => {
          console.log('🔁 Session state:', e.sessionState);
          if (e.sessionState === castAny.framework.SessionState.SESSION_STARTED || e.sessionState === castAny.framework.SessionState.SESSION_RESUMED) {
            const session = context.getCurrentSession();
            setCastSession(session);
            setIsCasting(true);
            try {
              const friendlyName = session?.getCastDevice()?.friendlyName || 'Appareil Cast';
              setActiveDevice({ id: session?.getSessionId?.() || 'cast-session', name: friendlyName, type: 'chromecast' });
              toast.success(`Connecté à ${friendlyName}`);
            } catch {}
          }
          if (e.sessionState === castAny.framework.SessionState.SESSION_ENDED) {
            handleDisconnectRef.current();
          }
        });
      } catch (err) {
        console.error('❌ Error initializing Cast Framework:', err);
      }
    };

    if ((window as any).cast && (window as any).cast.framework) {
      onCastReady();
      return;
    }

    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      console.log('📡 __onGCastApiAvailable:', isAvailable);
      if (isAvailable) onCastReady();
    };
  }, []);

  const discoverDevices = useCallback(async () => {
    if (window.top !== window.self) {
      toast.error('Fonctionnalité Cast non disponible en aperçu', {
        description: 'Pour utiliser cette fonctionnalité, veuillez ouvrir l\'application dans un nouvel onglet.',
        action: {
          label: 'Ouvrir',
          onClick: () => window.open(window.location.href, '_blank'),
        },
      });
      return;
    }

    if (!isApiReady) {
      toast.warning("L'API Cast n'est pas encore prête. Veuillez réessayer dans quelques instants.");
      return;
    }

    setIsDiscovering(true);
    
    try {
      const cast = window.chrome?.cast || window.cast;
      
      if (!cast) {
        throw new Error('Cast API not available');
      }

      // Request a cast session (this will show the device picker)
      await new Promise((resolve, reject) => {
        cast.requestSession(
          (session: any) => {
            console.log('Session obtained:', session);
            setCastSession(session);
            setIsCasting(true);
            setActiveDevice({
              id: session.sessionId,
              name: session.receiver.friendlyName,
              type: 'chromecast'
            });
            
            // Set up session event listeners
            session.addUpdateListener((isAlive: boolean) => {
              if (!isAlive) {
                handleDisconnectRef.current();
              }
            });
            
            toast.success(`Connecté à ${session.receiver.friendlyName}`);
            resolve(session);
          },
          (error: any) => {
            console.error('Session request error:', error);
            if (error.code !== 'cancel') {
              toast.error('Aucun appareil trouvé');
            }
            reject(error);
          }
        );
      });
    } catch (error: any) {
      console.error('Erreur lors de la découverte:', error);
      if (error.code !== 'cancel') {
        toast.error('Impossible de découvrir les appareils');
      }
    } finally {
      setIsDiscovering(false);
    }
  }, [isApiReady]);

  const connectToDevice = async (device: CastDevice) => {
    // This is now handled by discoverDevices through requestSession
    console.log('Connect to device:', device);
  };

  const handleDisconnect = useCallback(() => {
    setIsCasting(false);
    const deviceName = activeDevice?.name;
    setActiveDevice(null);
    setCastSession(null);
    try {
      const castAny: any = (window as any).cast;
      const context = castAny?.framework?.CastContext?.getInstance?.();
      context?.endCurrentSession?.(true);
    } catch {}
    if (deviceName) {
      toast.success(`Déconnecté de ${deviceName}`);
    }
  }, [activeDevice]);

  useEffect(() => {
    handleDisconnectRef.current = handleDisconnect;
  }, [handleDisconnect]);

  const disconnectFromDevice = useCallback(() => {
    try {
      const castAny: any = (window as any).cast;
      const context = castAny?.framework?.CastContext?.getInstance?.();
      if (context) {
        context.endCurrentSession(true);
        handleDisconnect();
        return;
      }
    } catch {}

    if (castSession) {
      castSession.stop(
        () => {
          console.log('Session stopped');
          handleDisconnect();
        },
        (error: any) => {
          console.error('Error stopping session:', error);
          handleDisconnect();
        }
      );
    } else {
      handleDisconnect();
    }
  }, [castSession, handleDisconnect]);

  // Load media when song changes
  useEffect(() => {
    const loadMediaToCast = async () => {
      if (!isCasting || !castSession || !currentSong) {
        console.log('❌ Cast conditions not met:', { isCasting, hasSession: !!castSession, hasSong: !!currentSong });
        return;
      }

      const cast = window.chrome?.cast || window.cast;
      
      if (!cast) {
        console.error('❌ Cast API not available');
        toast.error('API Cast non disponible');
        return;
      }

      try {
        console.log('🎵 Preparing to cast:', currentSong.title);
        console.log('📍 Original URL:', currentSong.url);
        
        // Obtenir l'URL réelle via UltraFastStreaming
        const result = await UltraFastStreaming.getAudioUrlUltraFast(
          currentSong.url,
          currentSong.deezer_id,
          currentSong.title,
          currentSong.artist
        );
        
        if (!result || !result.url || typeof result.url !== 'string') {
          throw new Error('URL audio invalide');
        }
        
        const audioUrl = result.url;

        console.log('✅ Resolved URL for cast:', audioUrl);

        // Déterminer le type MIME
        let contentType = 'audio/mpeg';
        if (audioUrl.includes('.m3u8')) {
          contentType = 'application/x-mpegURL';
        } else if (audioUrl.includes('.mp3')) {
          contentType = 'audio/mpeg';
        } else if (audioUrl.includes('.m4a') || audioUrl.includes('.aac')) {
          contentType = 'audio/mp4';
        }

        const mediaInfo = new cast.media.MediaInfo(audioUrl, contentType);
        mediaInfo.metadata = new cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = currentSong.title;
        mediaInfo.metadata.subtitle = currentSong.artist || 'Artiste inconnu';
        
        if (currentSong.imageUrl) {
          mediaInfo.metadata.images = [
            new cast.Image(currentSong.imageUrl)
          ];
        }

        // Ajouter des métadonnées supplémentaires
        if (currentSong.album_name) {
          mediaInfo.metadata.albumName = currentSong.album_name;
        }

        const request = new cast.media.LoadRequest(mediaInfo);
        request.autoplay = isPlaying;
        request.currentTime = 0;

        console.log('📡 Sending to Cast device...');

        castSession.loadMedia(
          request,
          () => {
            console.log('✅ Media loaded successfully to Cast');
            toast.success(`🎵 Diffusion de "${currentSong.title}"`, {
              description: `Sur ${activeDevice?.name}`
            });
          },
          (error: any) => {
            console.error('❌ Error loading media to Cast:', error);
            toast.error('Erreur lors du chargement', {
              description: 'Impossible de diffuser cette piste'
            });
          }
        );
      } catch (error) {
        console.error('❌ Error preparing cast media:', error);
        toast.error('Erreur de préparation', {
          description: 'Impossible d\'obtenir l\'URL audio'
        });
      }
    };

    loadMediaToCast();
  }, [currentSong, isCasting, castSession, activeDevice]);

  // Control playback on cast device
  useEffect(() => {
    if (!isCasting || !castSession) {
      return;
    }

    const media = castSession.getMediaSession();
    if (!media) {
      console.log('⚠️ No media session available yet');
      return;
    }

    try {
      if (isPlaying) {
        console.log('▶️ Sending play command to Cast');
        media.play(
          null,
          () => console.log('✅ Play command sent'),
          (error: any) => console.error('❌ Play error:', error)
        );
      } else {
        console.log('⏸️ Sending pause command to Cast');
        media.pause(
          null,
          () => console.log('✅ Pause command sent'),
          (error: any) => console.error('❌ Pause error:', error)
        );
      }
    } catch (error) {
      console.error('❌ Error controlling playback:', error);
    }
  }, [isPlaying, isCasting, castSession]);

  // Sync seek position to cast device
  useEffect(() => {
    if (!isCasting || !castSession || !currentSong) {
      return;
    }

    const media = castSession.getMediaSession();
    if (!media) {
      return;
    }

    const audioElement = getCurrentAudioElement();
    if (!audioElement || !audioElement.duration) {
      return;
    }

    // Calculate current time from progress
    const currentTime = (progress / 100) * audioElement.duration;
    
    // Detect manual seek (significant jump in position > 2 seconds)
    const timeDifference = Math.abs(currentTime - lastSyncedProgressRef.current);
    
    if (timeDifference > 2) {
      console.log(`⏩ Seeking Cast to ${currentTime.toFixed(1)}s (was ${lastSyncedProgressRef.current.toFixed(1)}s)`);
      
      const seekRequest = new (window.chrome?.cast || window.cast).media.SeekRequest();
      seekRequest.currentTime = currentTime;
      
      media.seek(
        seekRequest,
        () => {
          console.log('✅ Seek command sent to Cast');
          lastSyncedProgressRef.current = currentTime;
        },
        (error: any) => console.error('❌ Seek error:', error)
      );
    } else {
      // Update ref for normal playback progression
      lastSyncedProgressRef.current = currentTime;
    }
  }, [progress, isCasting, castSession, currentSong, getCurrentAudioElement]);

  return (
    <CastContext.Provider value={{
      devices,
      activeDevice,
      isDiscovering,
      isCasting,
      discoverDevices,
      connectToDevice,
      disconnectFromDevice
    }}>
      {children}
    </CastContext.Provider>
  );
};

export const useCast = () => {
  const context = useContext(CastContext);
  if (!context) {
    throw new Error('useCast must be used within a CastProvider');
  }
  return context;
};

export default CastProvider;