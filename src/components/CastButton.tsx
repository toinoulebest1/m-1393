import React, { useState } from 'react';
import { Cast, Airplay } from 'lucide-react';
import { toast } from 'sonner';
import { useCast } from '@/contexts/CastContext';
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
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && devices.length === 0 && !isDiscovering) {
      discoverDevices();
    }
  };
  return <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("text-spotify-neutral hover:text-white transition-colors", isCasting && "text-spotify-accent")}>
          {isCasting ? <Airplay className="w-5 h-5" /> : <Cast className="w-5 h-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-spotify-dark border-spotify-neutral/20">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[9b87f5] text-spotify-accent/[0.97]">Diffuser sur</h3>
            <Button variant="ghost" size="sm" onClick={() => discoverDevices()} disabled={isDiscovering} className="text-[9b87f5] text-spotify-accent bg-gray-800 hover:bg-gray-700">
              {isDiscovering ? 'Recherche...' : 'Actualiser'}
            </Button>
          </div>
          
          {devices.length === 0 && !isDiscovering && <p className="text-xs text-spotify-neutral py-2">Aucun appareil trouvé</p>}
          
          {isDiscovering && <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-spotify-accent"></div>
            </div>}
          
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {devices.map(device => <li key={device.id}>
                <Button variant="ghost" className={cn("w-full justify-start text-left text-sm py-1", activeDevice?.id === device.id && "bg-spotify-accent/20 text-spotify-accent")} onClick={() => {
              if (activeDevice?.id === device.id) {
                disconnectFromDevice();
              } else {
                connectToDevice(device);
              }
              setOpen(false);
            }}>
                  <div className="flex items-center">
                    {device.type === 'chromecast' && <Cast className="w-4 h-4 mr-2" />}
                    {device.type === 'airplay' && <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 16L7 21H17L12 16Z" fill="currentColor" />
                        <path d="M5 12C5 8.13401 8.13401 5 12 5C15.866 5 19 8.13401 19 12" stroke="currentColor" strokeWidth="2" />
                      </svg>}
                    {device.type === 'other' && <div className="w-4 h-4 mr-2 border border-current rounded-full flex items-center justify-center">
                        <div className="w-1 h-1 bg-current rounded-full"></div>
                      </div>}
                    <span>{device.name}</span>
                  </div>
                </Button>
              </li>)}
          </ul>
          
          {activeDevice && <div className="pt-2 border-t border-spotify-neutral/20">
              <Button variant="ghost" size="sm" onClick={() => {
            disconnectFromDevice();
            setOpen(false);
          }} className="w-full justify-center text-red-400 hover:text-red-300 text-xs">
                Arrêter la diffusion
              </Button>
            </div>}
        </div>
      </PopoverContent>
    </Popover>;
};