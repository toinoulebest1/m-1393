
import React, { useEffect, useState } from 'react';
import { DropboxSettings } from './DropboxSettings';
import { useSettingsMigration } from '@/utils/userSettingsMigration';
import { getDropboxConfig, isDropboxEnabled } from '@/utils/dropboxStorage';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const DropboxSettingsWrapper: React.FC = () => {
  const { migrationComplete } = useSettingsMigration();
  const [isLoading, setIsLoading] = useState(true);
  const [dropboxStatus, setDropboxStatus] = useState<string | null>(null);
  const [enableDropbox, setEnableDropbox] = useState(false);
  
  // Vérifier l'état de Dropbox une fois la migration terminée
  useEffect(() => {
    if (migrationComplete) {
      const checkDropboxStatus = async () => {
        try {
          // Premièrement, vérifier si Dropbox est activé
          const isEnabled = await isDropboxEnabled();
          console.log('DropboxSettingsWrapper - Dropbox activé:', isEnabled);
          
          // Ensuite, récupérer la configuration complète pour plus de détails
          const config = await getDropboxConfig();
          console.log('DropboxSettingsWrapper - Configuration Dropbox:', {
            isEnabled: config.isEnabled,
            hasAccessToken: !!config.accessToken && config.accessToken.length > 0,
            hasRefreshToken: !!config.refreshToken,
            hasClientId: !!config.clientId,
            hasClientSecret: !!config.clientSecret,
            expiresAt: config.expiresAt ? new Date(config.expiresAt).toISOString() : 'non défini'
          });
          
          // Définir le statut en fonction des deux vérifications
          const finalStatus = isEnabled ? 'enabled' : 'disabled';
          setDropboxStatus(finalStatus);
          
          // Si les deux valeurs sont incohérentes, c'est potentiellement un problème
          if (isEnabled !== config.isEnabled) {
            console.warn('Incohérence détectée: isDropboxEnabled() retourne', isEnabled, 
                         'mais config.isEnabled est', config.isEnabled);
          }
          
          setEnableDropbox(config.isEnabled && !!config.accessToken);
        } catch (error) {
          console.error('Error checking Dropbox status:', error);
          setDropboxStatus('error');
        } finally {
          setIsLoading(false);
        }
      };
      
      checkDropboxStatus();
    }
  }, [migrationComplete]);
  
  const handleQuickEnable = async () => {
    try {
      const config = await getDropboxConfig();
      // Activer Dropbox uniquement si on a un token valide
      if (config.accessToken) {
        config.isEnabled = true;
        await import('@/utils/dropboxStorage').then(module => {
          module.saveDropboxConfig(config).then(() => {
            toast.success("Dropbox a été activé avec succès");
            setDropboxStatus('enabled');
            setEnableDropbox(true);
            // Rafraîchir la page pour prendre en compte les changements
            window.location.reload();
          });
        });
      } else {
        toast.error("Impossible d'activer Dropbox: aucun token d'accès configuré");
      }
    } catch (error) {
      console.error("Erreur lors de l'activation de Dropbox:", error);
      toast.error("Une erreur est survenue lors de l'activation de Dropbox");
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-spotify-accent"></div>
      </div>
    );
  }
  
  return (
    <>
      {dropboxStatus && (
        <div className="mb-4">
          {dropboxStatus === 'enabled' ? (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Dropbox est actuellement <span className="font-semibold">activé</span>. 
                Tous les nouveaux fichiers seront stockés sur Dropbox.
              </AlertDescription>
            </Alert>
          ) : dropboxStatus === 'disabled' ? (
            <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Dropbox est actuellement <span className="font-semibold">désactivé</span>. 
                {!enableDropbox && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleQuickEnable} 
                    className="ml-2"
                  >
                    Activer maintenant
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Erreur lors de la vérification du statut Dropbox. Vérifiez la console pour plus d'informations.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      <DropboxSettings />
    </>
  );
};

export default DropboxSettingsWrapper;
