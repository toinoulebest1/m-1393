
import React, { useEffect, useState } from 'react';
import { DropboxSettings } from './DropboxSettings';
import { useSettingsMigration } from '@/utils/userSettingsMigration';
import { getDropboxConfig, isDropboxEnabled, saveDropboxConfig } from '@/utils/dropboxStorage';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DropboxConfig } from '@/types/dropbox';
import AdminDropboxConfigForm from './AdminDropboxConfigForm';

const DropboxSettingsWrapper: React.FC = () => {
  const { migrationComplete } = useSettingsMigration();
  const [isLoading, setIsLoading] = useState(true);
  const [dropboxStatus, setDropboxStatus] = useState<string | null>(null);
  const [enableDropbox, setEnableDropbox] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastTokenUpdate, setLastTokenUpdate] = useState<string | null>(null);
  const [refreshTokenStatus, setRefreshTokenStatus] = useState<'present' | 'missing' | 'unknown'>('unknown');
  
  // Checking if the current user is an admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();
            
          setIsAdmin(roles?.role === 'admin');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdminStatus();
  }, []);
  
  // Check Dropbox status once migration is completed
  useEffect(() => {
    if (migrationComplete) {
      const checkDropboxStatus = async () => {
        try {
          // Retrieve complete configuration for more details
          const config = await getDropboxConfig();
          console.log('DropboxSettingsWrapper - Configuration Dropbox:', {
            isEnabled: config.isEnabled,
            hasAccessToken: !!config.accessToken && config.accessToken.length > 0,
            hasRefreshToken: !!config.refreshToken && config.refreshToken.length > 0,
            hasClientId: !!config.clientId,
            hasClientSecret: !!config.clientSecret,
            expiresAt: config.expiresAt ? new Date(config.expiresAt).toISOString() : 'non défini'
          });
          
          // Vérifier le statut du refresh token
          setRefreshTokenStatus(
            !!config.refreshToken && config.refreshToken.length > 0 ? 'present' : 'missing'
          );
          
          // Get the last update time of the admin token
          const { data: adminConfig } = await supabase
            .from('app_settings')
            .select('updated_at')
            .eq('key', 'default_dropbox_config')
            .maybeSingle();
            
          if (adminConfig) {
            setLastTokenUpdate(new Date(adminConfig.updated_at).toLocaleString());
          }
          
          // Check if we have a valid token
          const hasValidToken = !!config.accessToken && 
                               config.accessToken.length > 0 && 
                               config.accessToken !== 'YOUR_DEFAULT_ACCESS_TOKEN';
          setHasToken(hasValidToken);
          
          // Set status based on token presence
          const finalStatus = hasValidToken ? 'enabled' : 'disabled';
          setDropboxStatus(finalStatus);
          setEnableDropbox(hasValidToken);
          
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
      
      // Retrieve default admin configuration
      const { data: adminConfig, error: adminError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'default_dropbox_config')
        .maybeSingle();
        
      if (adminError) {
        console.error('Error retrieving admin config:', adminError);
        toast.error("Impossible de récupérer la configuration admin");
        setIsActivating(false);
        return;
      }
      
      const adminDropboxConfig = adminConfig?.value as any;
      if (!adminDropboxConfig || 
          !adminDropboxConfig.accessToken || 
          adminDropboxConfig.accessToken === 'YOUR_DEFAULT_ACCESS_TOKEN') {
        console.error('Invalid admin configuration or token not configured');
        toast.error("La configuration admin n'est pas configurée. Un administrateur doit d'abord configurer les identifiants Dropbox.");
        setIsActivating(false);
        return;
      }
      
      // Apply admin configuration but only copy the necessary fields
      // Do NOT include refresh token or credentials for non-admin users
      const config: DropboxConfig = {
        accessToken: adminDropboxConfig.accessToken,
        refreshToken: '', // Intentionally empty - non-admins shouldn't refresh the token
        clientId: '',     // Intentionally empty - non-admins don't need these credentials
        clientSecret: '', // Intentionally empty - non-admins don't need these credentials
        expiresAt: adminDropboxConfig.expiresAt,
        isEnabled: true
      };
      
      // Save the limited configuration to the user's settings
      await saveDropboxConfig(config);
      toast.success("Dropbox a été activé avec succès avec le token admin");
      setDropboxStatus('enabled');
      setEnableDropbox(true);
      setHasToken(true);
      
      // Refresh page to apply changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Error activating Dropbox:", error);
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
      {isAdmin && (
        <div className="mb-4">
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <span className="font-semibold">Mode administrateur activé.</span> Vous pouvez configurer tous les paramètres Dropbox, y compris le refresh token.
              <div className="mt-2 text-sm">
                Le refresh token se trouve dans le champ <span className="font-mono bg-blue-100 dark:bg-blue-800/40 px-1.5 py-0.5 rounded">Refresh Token</span> du formulaire ci-dessous.
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      {isAdmin && <AdminDropboxConfigForm />}
      
      {dropboxStatus && (
        <div className="mb-6">
          {dropboxStatus === 'enabled' ? (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Dropbox est actuellement <span className="font-semibold">activé</span>. 
                Tous les nouveaux fichiers seront stockés sur Dropbox.
                {lastTokenUpdate && !isAdmin && (
                  <div className="text-xs mt-1 text-green-700 dark:text-green-300">
                    Token admin mis à jour le : {lastTokenUpdate}
                  </div>
                )}
                {refreshTokenStatus === 'present' && isAdmin && (
                  <div className="flex items-center gap-1 mt-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> 
                    <span>Refresh Token configuré et utilisable pour un accès permanent</span>
                  </div>
                )}
                {refreshTokenStatus === 'missing' && isAdmin && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" /> 
                    <span>Refresh Token non configuré. L'accès expirera après quelques heures.</span>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          ) : dropboxStatus === 'disabled' ? (
            <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <div className="flex flex-col space-y-2 w-full">
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  {isAdmin ? 
                    "Dropbox n'est pas configuré. Utilisez le formulaire ci-dessus pour configurer les paramètres admin." :
                    "Dropbox n'est pas activé. Vous pouvez utiliser le token configuré par l'administrateur en cliquant ci-dessous."}
                </AlertDescription>
                <div className="flex flex-wrap gap-2 mt-2">
                  {!isAdmin && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleQuickEnable}
                      disabled={isActivating}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700"
                    >
                      {isActivating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Activation...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Utiliser le token admin
                        </>
                      )}
                    </Button>
                  )}
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
      
      {/* Modification pour afficher le contenu de DropboxSettings.tsx aux utilisateurs non-admin seulement si Dropbox est activé */}
      {(isAdmin || dropboxStatus === 'enabled') && <DropboxSettings />}
    </>
  );
};

export default DropboxSettingsWrapper;
