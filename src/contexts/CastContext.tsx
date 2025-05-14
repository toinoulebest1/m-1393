
import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const CastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use usePlayerContext instead of usePlayer to match the export name
  const { currentSong, isPlaying, progress, play, pause } = usePlayerContext();
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<CastDevice | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCasting, setIsCasting] = useState(false);

  // Simuler la découverte des appareils (dans une vraie application, 
  // vous utiliseriez des API comme Web Bluetooth, Google Cast, ou AirPlay)
  const discoverDevices = async () => {
    setIsDiscovering(true);
    
    try {
      // Simulation de la découverte d'appareils
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockDevices: CastDevice[] = [
        { id: '1', name: 'Salon TV', type: 'chromecast' },
        { id: '2', name: 'Haut-parleur cuisine', type: 'airplay' },
        { id: '3', name: 'Chambre Speaker', type: 'other' }
      ];
      
      setDevices(mockDevices);
      toast.success('Appareils découverts');
    } catch (error) {
      console.error('Erreur lors de la découverte des appareils:', error);
      toast.error('Impossible de découvrir les appareils');
    } finally {
      setIsDiscovering(false);
    }
  };

  const connectToDevice = async (device: CastDevice) => {
    try {
      // Simulation de la connexion à un appareil
      toast.loading(`Connexion à ${device.name}...`, { id: 'cast-connect' });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setActiveDevice(device);
      setIsCasting(true);
      toast.success(`Connecté à ${device.name}`, { id: 'cast-connect' });
      
      // Si une chanson est en cours de lecture, la diffuser sur le nouvel appareil
      if (currentSong && isPlaying) {
        toast(`Diffusion de ${currentSong.title} sur ${device.name}`);
      }
    } catch (error) {
      console.error('Erreur lors de la connexion à l\'appareil:', error);
      toast.error(`Impossible de se connecter à ${device.name}`, { id: 'cast-connect' });
    }
  };

  const disconnectFromDevice = () => {
    if (!activeDevice) return;
    
    try {
      // Simulation de la déconnexion
      setIsCasting(false);
      toast.success(`Déconnecté de ${activeDevice.name}`);
      setActiveDevice(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  // Écouter les changements de chanson pour mettre à jour la diffusion
  useEffect(() => {
    if (isCasting && activeDevice && currentSong) {
      console.log(`[Cast] Mise à jour de la diffusion sur ${activeDevice.name}: ${currentSong.title}`);
    }
  }, [currentSong, activeDevice, isCasting]);

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
