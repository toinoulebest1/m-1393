
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const { currentSong, isPlaying } = usePlayerContext();
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<CastDevice | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castSession, setCastSession] = useState<any>(null);
  const [isApiReady, setIsApiReady] = useState(false);

  // Initialize Google Cast API
  useEffect(() => {
    console.log('🎬 Initializing Cast API...');
    
    const initializeCastApi = () => {
      window['__onGCastApiAvailable'] = (isAvailable: boolean) => {
        console.log('📡 Cast API available:', isAvailable);
        
        if (isAvailable) {
          const cast = window.chrome?.cast || window.cast;
          
          if (!cast) {
            console.warn('⚠️ Cast API not available in window object');
            toast.error('Cast non disponible', {
              description: 'Votre navigateur ne supporte pas Google Cast'
            });
            return;
          }

          try {
            const sessionRequest = new cast.SessionRequest(cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
            const apiConfig = new cast.ApiConfig(
              sessionRequest,
              (session: any) => {
                console.log('✅ Cast session started:', session.sessionId);
                setCastSession(session);
                setIsCasting(true);
                setActiveDevice({
                  id: session.sessionId,
                  name: session.receiver.friendlyName,
                  type: 'chromecast'
                });
                toast.success(`✅ Connecté à ${session.receiver.friendlyName}`);
              },
              (status: string) => {
                console.log('📊 Cast session status:', status);
                if (status === 'disconnected') {
                  handleDisconnect();
                }
              }
            );

            cast.initialize(apiConfig, () => {
              console.log('✅ Cast API initialized successfully');
              setIsApiReady(true);
              toast.success('Cast prêt', {
                description: 'Vous pouvez maintenant diffuser vers un appareil'
              });
            }, (error: any) => {
              console.error('❌ Cast initialization error:', error);
              toast.error('Erreur d\'initialisation Cast');
            });
          } catch (error) {
            console.error('❌ Error setting up Cast API:', error);
            toast.error('Erreur de configuration Cast');
          }
        }
      };
    };

    // Wait for Cast SDK to load
    if (typeof window.chrome?.cast !== 'undefined') {
      console.log('✅ Cast SDK already loaded');
      initializeCastApi();
    } else {
      console.log('⏳ Waiting for Cast SDK to load...');
      // Poll for Cast API availability
      const checkInterval = setInterval(() => {
        if (typeof window.chrome?.cast !== 'undefined') {
          console.log('✅ Cast SDK loaded');
          initializeCastApi();
          clearInterval(checkInterval);
        }
      }, 100);

      // Timeout après 10 secondes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!isApiReady) {
          console.warn('⏱️ Cast SDK loading timeout');
        }
      }, 10000);

      return () => clearInterval(checkInterval);
    }
  }, []);

  const discoverDevices = useCallback(async () => {
    if (!isApiReady) {
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
                handleDisconnect();
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
    if (deviceName) {
      toast.success(`Déconnecté de ${deviceName}`);
    }
  }, [activeDevice]);

  const disconnectFromDevice = useCallback(() => {
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
      if (!isCasting || !castSession || !currentSong || !isPlaying) {
        console.log('❌ Cast conditions not met:', { isCasting, hasSession: !!castSession, hasSong: !!currentSong, isPlaying });
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
        const audioUrl = await UltraFastStreaming.getAudioUrlUltraFast(currentSong.url);
        
        if (!audioUrl || typeof audioUrl !== 'string') {
          throw new Error('URL audio invalide');
        }

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
        request.autoplay = true;
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
  }, [currentSong, isPlaying, isCasting, castSession, activeDevice]);

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
