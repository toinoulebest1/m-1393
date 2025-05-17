import React, { useEffect, useState } from 'react';
import { DropboxSettings } from './DropboxSettings';
import { useSettingsMigration } from '@/utils/userSettingsMigration';
import { getDropboxConfig, isDropboxEnabled, saveDropboxConfig } from '@/utils/dropboxStorage';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

const DropboxSettingsWrapper: React.FC = () => {
  const { migrationComplete } = useSettingsMigration();
  const [isLoading, setIsLoading] = useState(true);
  const [dropboxStatus, setDropboxStatus] = useState<string | null>(null);
  const [enableDropbox, setEnableDropbox] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  
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
            
            // Auto-correction: si nous avons un token mais que Dropbox n'est pas activé, l'activer
            if (config.accessToken && config.accessToken.length > 0 && !config.isEnabled) {
              console.log('Auto-correction: Dropbox a un token mais n\'est pas activé, correction...');
              const updatedConfig = { ...config, isEnabled: true };
              await saveDropboxConfig(updatedConfig);
              setDropboxStatus('enabled');
            }
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
      setIsActivating(true);
      const config = await getDropboxConfig();
      
      // Activer Dropbox pour tous les cas
      config.isEnabled = true;
      
      await saveDropboxConfig(config);
      toast.success("Dropbox a été activé avec succès");
      setDropboxStatus('enabled');
      setEnableDropbox(true);
      
      // Rafraîchir la page pour prendre en compte les changements
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors de l'activation de Dropbox:", error);
      toast.error("Une erreur est survenue lors de l'activation de Dropbox");
    } finally {
      setIsActivating(false);
    }
  };
  
  const handleForceEnable = async () => {
    try {
      setIsActivating(true);
      let config = await getDropboxConfig();
      
      // Si on n'a pas de token, utiliser les tokens par défaut depuis app_settings
      if (!config.accessToken) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'default_dropbox_config')
          .maybeSingle();
        
        if (error || !data) {
          console.error("Erreur lors de la récupération de la configuration par défaut:", error || "Aucune donnée");
          toast.error("Impossible de trouver une configuration par défaut");
          setIsActivating(false);
          return;
        }
        
        const defaultConfig = data.value as any;
        if (defaultConfig && defaultConfig.accessToken) {
          // Appliquer la configuration par défaut
          config = {
            accessToken: defaultConfig.accessToken,
            refreshToken: defaultConfig.refreshToken,
            clientId: defaultConfig.clientId,
            clientSecret: defaultConfig.clientSecret,
            expiresAt: defaultConfig.expiresAt,
            isEnabled: true
          };
          console.log("Configuration par défaut appliquée depuis app_settings");
        } else {
          toast.error("La configuration par défaut ne contient pas de token valide");
          setIsActivating(false);
          return;
        }
      } else {
        // Juste activer la configuration existante
        config.isEnabled = true;
      }
      
      // Activer Dropbox
      await saveDropboxConfig(config);
      toast.success("Dropbox a été activé avec succès");
      setDropboxStatus('enabled');
      setEnableDropbox(true);
      
      // Rafraîchir la page pour prendre en compte les changements
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Erreur lors de l'activation forcée de Dropbox:", error);
      toast.error("Une erreur est survenue lors de l'activation de Dropbox");
    } finally {
      setIsActivating(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-spotify-accent"></div>
      </div>
    );
  }

  if (!migrationComplete) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-spotify-accent mr-2"></div>
        <span>Migration des paramètres en cours...</span>
      </div>
    );
  }
  
  return (
    <>
      {dropboxStatus && (
        <div className="mb-6">
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
              <div className="flex flex-col space-y-2 w-full">
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  Dropbox est actuellement <span className="font-semibold">désactivé</span>.
                  Les fichiers seront stockés sur Supabase.
                </AlertDescription>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleQuickEnable}
                    disabled={isActivating}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700"
                  >
                    {isActivating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2"></div>
                        Activation...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Activer maintenant
                      </>
                    )}
                  </Button>
                </div>
              </div>
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
