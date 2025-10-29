
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { usePlayerContext } from './PlayerContext';

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
    const initializeCastApi = () => {
      window['__onGCastApiAvailable'] = (isAvailable: boolean) => {
        if (isAvailable) {
          const cast = window.chrome?.cast || window.cast;
          
          if (!cast) {
            console.log('Cast API not available');
            return;
          }

          const sessionRequest = new cast.SessionRequest(cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
          const apiConfig = new cast.ApiConfig(
            sessionRequest,
            (session: any) => {
              console.log('Cast session started:', session);
              setCastSession(session);
              setIsCasting(true);
              setActiveDevice({
                id: session.sessionId,
                name: session.receiver.friendlyName,
                type: 'chromecast'
              });
              toast.success(`Connecté à ${session.receiver.friendlyName}`);
            },
            (status: string) => {
              console.log('Cast session status:', status);
              if (status === 'disconnected') {
                handleDisconnect();
              }
            }
          );

          cast.initialize(apiConfig, () => {
            console.log('Cast API initialized');
            setIsApiReady(true);
          }, (error: any) => {
            console.error('Cast initialization error:', error);
          });
        }
      };
    };

    // Wait for Cast SDK to load
    if (typeof window.chrome?.cast !== 'undefined') {
      initializeCastApi();
    } else {
      // Poll for Cast API availability
      const checkInterval = setInterval(() => {
        if (typeof window.chrome?.cast !== 'undefined') {
          initializeCastApi();
          clearInterval(checkInterval);
        }
      }, 100);

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
    if (isCasting && castSession && currentSong && isPlaying) {
      const cast = window.chrome?.cast || window.cast;
      
      if (!cast) return;

      const mediaInfo = new cast.media.MediaInfo(currentSong.url, 'audio/mp3');
      mediaInfo.metadata = new cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = currentSong.title;
      mediaInfo.metadata.subtitle = currentSong.artist || 'Unknown Artist';
      
      if (currentSong.imageUrl) {
        mediaInfo.metadata.images = [
          new cast.Image(currentSong.imageUrl)
        ];
      }

      const request = new cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;

      castSession.loadMedia(
        request,
        () => {
          console.log('Media loaded successfully');
          toast(`Diffusion de ${currentSong.title}`);
        },
        (error: any) => {
          console.error('Error loading media:', error);
          toast.error('Erreur lors du chargement du média');
        }
      );
    }
  }, [currentSong, isPlaying, isCasting, castSession]);

  // Control playback on cast device
  useEffect(() => {
    if (isCasting && castSession) {
      const media = castSession.getMediaSession();
      if (media) {
        if (isPlaying) {
          media.play(null, () => {}, () => {});
        } else {
          media.pause(null, () => {}, () => {});
        }
      }
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
