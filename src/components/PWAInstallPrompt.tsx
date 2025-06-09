
import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Empêcher l'affichage automatique du prompt d'installation
      e.preventDefault();
      // Stocker l'événement pour l'utiliser plus tard
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA installée avec succès');
      setShowInstallButton(false);
      setDeferredPrompt(null);
      toast.success('Application installée avec succès !');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Vérifier si l'app est déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      // Afficher le prompt d'installation
      await deferredPrompt.prompt();
      
      // Attendre le choix de l'utilisateur
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('Utilisateur a accepté l\'installation');
        toast.success('Installation en cours...');
      } else {
        console.log('Utilisateur a refusé l\'installation');
      }
      
      // Nettoyer
      setDeferredPrompt(null);
      setShowInstallButton(false);
    } catch (error) {
      console.error('Erreur lors de l\'installation:', error);
      toast.error('Erreur lors de l\'installation');
    }
  };

  if (!showInstallButton) return null;

  return (
    <Button
      onClick={handleInstallClick}
      variant="outline"
      size="sm"
      className="flex items-center gap-2 bg-spotify-dark/50 border-spotify-accent/20 hover:border-spotify-accent/40 text-spotify-accent hover:text-spotify-accent hover:bg-spotify-dark/70"
    >
      <Download className="w-4 h-4" />
      Installer l'app
    </Button>
  );
};
