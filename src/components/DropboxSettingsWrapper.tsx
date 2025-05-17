import React, { useEffect, useState } from 'react';
import { DropboxSettings } from './DropboxSettings';
import { useSettingsMigration } from '@/utils/userSettingsMigration';
import { getDropboxConfig, isDropboxEnabled, saveDropboxConfig } from '@/utils/dropboxStorage';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DropboxConfig } from '@/types/dropbox';

const DropboxSettingsWrapper: React.FC = () => {
  const { migrationComplete } = useSettingsMigration();
  const [isLoading, setIsLoading] = useState(true);
  const [dropboxStatus, setDropboxStatus] = useState<string | null>(null);
  const [enableDropbox, setEnableDropbox] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  
  // Vérifier l'état de Dropbox une fois la migration terminée
  useEffect(() => {
    if (migrationComplete) {
      const checkDropboxStatus = async () => {
        try {
          // Récupérer la configuration complète pour plus de détails
          const config = await getDropboxConfig();
          console.log('DropboxSettingsWrapper - Configuration Dropbox:', {
            isEnabled: config.isEnabled,
            hasAccessToken: !!config.accessToken && config.accessToken.length > 0,
            hasRefreshToken: !!config.refreshToken,
            hasClientId: !!config.clientId,
            hasClientSecret: !!config.clientSecret,
            expiresAt: config.expiresAt ? new Date(config.expiresAt).toISOString() : 'non défini'
          });
          
          // Vérifier si nous avons un token valide
          setHasToken(!!config.accessToken && config.accessToken.length > 0);
          
          // Définir le statut en fonction de la présence du token
          const finalStatus = !!config.accessToken && config.accessToken.length > 0 ? 'enabled' : 'disabled';
          setDropboxStatus(finalStatus);
          setEnableDropbox(!!config.accessToken && config.accessToken.length > 0);
          
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
      
      // Récupérer la configuration admin par défaut
      const { data: adminConfig, error: adminError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'default_dropbox_config')
        .maybeSingle();
        
      if (adminError) {
        console.error('Erreur récupération config admin:', adminError);
        toast.error("Impossible de récupérer la configuration admin");
        setIsActivating(false);
        return;
      }
      
      const adminDropboxConfig = adminConfig?.value as any;
      if (!adminDropboxConfig || !adminDropboxConfig.accessToken) {
        console.error('Configuration admin invalide ou sans token');
        toast.error("La configuration admin ne contient pas de token valide");
        setIsActivating(false);
        return;
      }
      
      // Appliquer la configuration admin
      const config: DropboxConfig = {
        accessToken: adminDropboxConfig.accessToken,
        refreshToken: adminDropboxConfig.refreshToken,
        clientId: adminDropboxConfig.clientId,
        clientSecret: adminDropboxConfig.clientSecret,
        expiresAt: adminDropboxConfig.expiresAt,
        isEnabled: true
      };
      
      await saveDropboxConfig(config);
      toast.success("Dropbox a été activé avec succès avec les paramètres admin");
      setDropboxStatus('enabled');
      setEnableDropbox(true);
      setHasToken(true);
      
      // Rafraîchir la page pour prendre en compte les changements
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Erreur lors de l'activation de Dropbox:", error);
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
                  Dropbox n'est pas configuré avec un token valide.
                  Cliquez ci-dessous pour utiliser le token de l'administrateur.
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
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Utiliser le token admin
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
