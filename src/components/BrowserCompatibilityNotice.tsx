
import { useEffect, useState, useRef } from 'react';
import { AutoplayManager } from '@/utils/autoplayManager';
import { AlertTriangle, Globe } from 'lucide-react';

export const BrowserCompatibilityNotice = () => {
  const [browserInfo, setBrowserInfo] = useState<{ name: string; supportsAutoplay: boolean } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const info = AutoplayManager.getBrowserInfo();
    setBrowserInfo(info);
  }, []);

  useEffect(() => {
    // Si c'est Firefox, ne rien faire
    if (!browserInfo || browserInfo.supportsAutoplay) {
      return;
    }

    // Fonction pour créer et surveiller l'overlay
    const createAndWatchOverlay = () => {
      // Surveiller si l'overlay est supprimé du DOM
      if (overlayRef.current) {
        observerRef.current = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              // Vérifier si notre overlay a été supprimé
              const overlayExists = document.querySelector('#browser-compatibility-overlay');
              if (!overlayExists && overlayRef.current) {
                console.log('🚫 Tentative de contournement détectée - recréation de l\'overlay');
                // Recréer immédiatement l'overlay
                setTimeout(() => {
                  window.location.reload();
                }, 100);
              }
            }
          });
        });

        // Observer les changements dans le body
        observerRef.current.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    };

    // Créer l'observer après le montage
    setTimeout(createAndWatchOverlay, 100);

    // Bloquer les touches F12, Ctrl+Shift+I, etc.
    const blockDevTools = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+U
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Bloquer le clic droit
    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('keydown', blockDevTools);
    document.addEventListener('contextmenu', blockContextMenu);

    // Nettoyage
    return () => {
      document.removeEventListener('keydown', blockDevTools);
      document.removeEventListener('contextmenu', blockContextMenu);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [browserInfo]);

  // Si c'est Firefox, ne rien afficher
  if (!browserInfo || browserInfo.supportsAutoplay) {
    return null;
  }

  // Overlay plein écran pour tous les autres navigateurs - bloque TOUT
  return (
    <div 
      id="browser-compatibility-overlay"
      ref={overlayRef}
      className="fixed inset-0 z-[99999] bg-black flex items-center justify-center" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 99999,
        pointerEvents: 'all'
      }}
    >
      <div className="text-center max-w-2xl mx-4 p-8">
        {/* Icône d'avertissement */}
        <div className="w-32 h-32 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-8">
          <AlertTriangle className="w-16 h-16 text-white" />
        </div>
        
        {/* Titre principal */}
        <h1 className="text-4xl font-bold text-white mb-4">
          🔥 Firefox Requis !
        </h1>
        
        {/* Message d'explication */}
        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg p-6 mb-8">
          <p className="text-xl text-white mb-4">
            <strong>{browserInfo.name}</strong> bloque l'autoplay audio et n'est pas compatible avec cette application musicale.
          </p>
          <p className="text-lg text-gray-300">
            Pour une <strong>expérience optimale sans restrictions</strong>, vous devez utiliser <strong>Firefox</strong>.
          </p>
        </div>
        
        {/* Instructions */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center justify-center gap-2">
            <Globe className="w-6 h-6" />
            Comment installer Firefox
          </h3>
          <div className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
              <p className="text-gray-300">Allez sur <strong className="text-white">firefox.com</strong></p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
              <p className="text-gray-300">Téléchargez et installez Firefox</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
              <p className="text-gray-300">Revenez sur ce site avec Firefox</p>
            </div>
          </div>
        </div>
        
        {/* Bouton de téléchargement */}
        <a 
          href="https://www.mozilla.org/fr/firefox/new/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold px-8 py-4 rounded-lg text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Globe className="w-6 h-6" />
          Télécharger Firefox
        </a>
        
        {/* Note technique */}
        <div className="mt-8 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
          <p className="text-sm text-gray-400">
            <strong>Pourquoi Firefox ?</strong> Firefox permet l'autoplay audio sans restrictions, 
            contrairement à Chrome, Safari et Edge qui bloquent la lecture automatique.
          </p>
        </div>

        {/* Message anti-contournement */}
        <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
          <p className="text-xs text-red-300">
            ⚠️ Les tentatives de contournement sont détectées et provoquent un rechargement automatique de la page.
          </p>
        </div>
      </div>
    </div>
  );
};
