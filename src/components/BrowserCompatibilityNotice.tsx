
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AutoplayManager } from '@/utils/autoplayManager';
import { X } from 'lucide-react';

export const BrowserCompatibilityNotice = () => {
  const [showNotice, setShowNotice] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{ name: string; supportsAutoplay: boolean } | null>(null);

  useEffect(() => {
    const info = AutoplayManager.getBrowserInfo();
    setBrowserInfo(info);
    
    // Afficher la notice seulement pour les navigateurs avec restrictions
    if (!info.supportsAutoplay) {
      const hasSeenNotice = localStorage.getItem('browser-autoplay-notice');
      if (!hasSeenNotice) {
        setShowNotice(true);
      }
    }
  }, []);

  const dismissNotice = () => {
    setShowNotice(false);
    localStorage.setItem('browser-autoplay-notice', 'true');
  };

  if (!showNotice || !browserInfo || browserInfo.supportsAutoplay) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg shadow-lg p-4 relative">
        <button 
          onClick={dismissNotice}
          className="absolute top-2 right-2 text-white/80 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="pr-6">
          <h3 className="font-bold text-sm mb-1">
            🔥 Firefox recommandé !
          </h3>
          <p className="text-xs leading-relaxed">
            <strong>{browserInfo.name}</strong> bloque l'autoplay audio. 
            Pour une <strong>expérience optimale sans restrictions</strong>, 
            utilisez <strong>Firefox</strong> ou cliquez sur "Activer" quand demandé.
          </p>
        </div>
      </div>
    </div>
  );
};
