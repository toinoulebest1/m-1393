import React, { useState } from 'react';
import { Cast, Airplay, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useCast } from '@/contexts/CastContext';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export const CastButton = () => {
  const {
    devices,
    activeDevice,
    isDiscovering,
    isCasting,
    discoverDevices,
    connectToDevice,
    disconnectFromDevice
  } = useCast();
  const [open, setOpen] = useState(false);
  const { currentSong } = usePlayerContext();
  const [dlnaUrl, setDlnaUrl] = useState<string | null>(null);
  const [dlnaLoading, setDlnaLoading] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && devices.length === 0 && !isDiscovering) {
      // console.log('🔍 Opening Cast menu, discovering devices...');
      discoverDevices();
    }
  };

  const prepareDlnaLink = async () => {
    try {
      if (!currentSong) {
        toast.error("Aucune piste en cours");
        return;
      }
      setDlnaLoading(true);
      setDlnaUrl(null);
      // console.log('🧩 Resolving DLNA link for:', currentSong.title);
      const result = await UltraFastStreaming.getAudioUrlUltraFast(
        currentSong.url,
        currentSong.title,
        currentSong.artist
      );
      setDlnaUrl(result.url);
      toast.success('Lien DLNA prêt', { description: 'Vous pouvez l\'utiliser dans votre app DLNA' });
    } catch (e) {
      console.error('DLNA link error:', e);
      toast.error('Impossible de préparer le lien DLNA');
    } finally {
      setDlnaLoading(false);
    }
  };
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-spotify-neutral hover:text-white transition-all duration-300",
            isCasting && "text-spotify-accent animate-pulse"
          )}
          title={isCasting ? `Diffusion sur ${activeDevice?.name}` : 'Diffuser'}
        >
          {isDiscovering ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isCasting ? (
            <Airplay className="w-5 h-5" />
          ) : (
            <Cast className="w-5 h-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 bg-spotify-card/95 backdrop-blur-xl border-white/10 shadow-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Diffuser sur</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // console.log('🔄 Manual device discovery requested');
                discoverDevices();
              }}
              disabled={isDiscovering}
              className="text-spotify-accent hover:bg-spotify-accent/10 transition-colors"
            >
              {isDiscovering ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recherche...</>
              ) : (
                'Actualiser'
              )}
            </Button>
          </div>

          {isCasting && activeDevice && (
            <div className="bg-spotify-accent/10 border border-spotify-accent/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-spotify-accent rounded-full animate-pulse" />
                <span className="text-sm font-medium text-spotify-accent">
                  Diffusion en cours
                </span>
              </div>
              <div className="flex items-center gap-2 text-spotify-light">
                {activeDevice.type === 'chromecast' && <Cast className="w-4 h-4" />}
                {activeDevice.type === 'airplay' && <Airplay className="w-4 h-4" />}
                <span className="text-sm">{activeDevice.name}</span>
              </div>
            </div>
          )}

          {!isCasting && (
            <>
              {devices.length === 0 && !isDiscovering && (
                <div className="text-center py-6">
                  <Cast className="w-12 h-12 text-spotify-neutral/50 mx-auto mb-3" />
                  <p className="text-sm text-spotify-neutral mb-2">
                    Aucun appareil trouvé
                  </p>
                  <p className="text-xs text-spotify-neutral/70">
                    Assurez-vous que votre appareil Cast est allumé et sur le même réseau
                  </p>
                </div>
              )}

              {isDiscovering && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-spotify-accent animate-spin mb-3" />
                  <p className="text-sm text-spotify-light">Recherche d'appareils...</p>
                </div>
              )}

              {devices.length > 0 && (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {devices.map((device) => (
                    <li key={device.id}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start text-left py-3 hover:bg-white/10 transition-colors",
                          activeDevice?.id === device.id && "bg-spotify-accent/20 text-spotify-accent hover:bg-spotify-accent/30"
                        )}
                        onClick={() => {
                          // console.log('🎯 Connecting to device:', device.name);
                          if (activeDevice?.id === device.id) {
                            disconnectFromDevice();
                          } else {
                            connectToDevice(device);
                          }
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {device.type === 'chromecast' && <Cast className="w-5 h-5" />}
                          {device.type === 'airplay' && <Airplay className="w-5 h-5" />}
                          <span className="font-medium">{device.name}</span>
                        </div>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* DLNA manual section */}
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">DLNA (manuel)</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={prepareDlnaLink}
                disabled={dlnaLoading || !currentSong}
                className="text-spotify-accent hover:bg-spotify-accent/10"
              >
                {dlnaLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Préparation...</> : 'Préparer le lien'}
              </Button>
            </div>
            <p className="text-xs text-spotify-neutral mb-2">Générez un lien direct à utiliser dans votre application DLNA (VLC, BubbleUPnP, etc.).</p>
            {dlnaUrl && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-md p-2">
                <input
                  className="flex-1 bg-transparent text-xs text-spotify-light outline-none"
                  value={dlnaUrl}
                  readOnly
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(dlnaUrl);
                    toast.success('Lien copié dans le presse-papiers');
                  }}
                  className="text-spotify-accent hover:bg-spotify-accent/10"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {activeDevice && (
            <div className="pt-3 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // console.log('🔌 Disconnecting from Cast device');
                  disconnectFromDevice();
                  setOpen(false);
                }}
                className="w-full justify-center text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
              >
                Arrêter la diffusion
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};