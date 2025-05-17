
import React, { useEffect, useState } from 'react';
import OneDriveSettings from './OneDriveSettings';
import { useSettingsMigration } from '@/utils/userSettingsMigration';
import { isOneDriveEnabled } from '@/utils/oneDriveStorage';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminOneDriveConfigForm from './AdminOneDriveConfigForm';

const OneDriveSettingsWrapper: React.FC = () => {
  const { migrationComplete } = useSettingsMigration();
  const [isLoading, setIsLoading] = useState(true);
  const [oneDriveStatus, setOneDriveStatus] = useState<'enabled' | 'disabled' | 'error'>('disabled');
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastTokenUpdate, setLastTokenUpdate] = useState<string | null>(null);
  
  // Check if current user is an admin
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
  
  // Check OneDrive status once migration is completed
  useEffect(() => {
    if (migrationComplete) {
      const checkOneDriveStatus = async () => {
        try {
          // Check if OneDrive is enabled
          const enabled = await isOneDriveEnabled();
          
          // Get the last update time of the admin token
          const { data: adminConfig } = await supabase
            .from('app_settings')
            .select('updated_at')
            .eq('key', 'default_onedrive_config')
            .maybeSingle();
            
          if (adminConfig) {
            setLastTokenUpdate(new Date(adminConfig.updated_at).toLocaleString());
          }
          
          setOneDriveStatus(enabled ? 'enabled' : 'disabled');
        } catch (error) {
          console.error('Error checking OneDrive status:', error);
          setOneDriveStatus('error');
        } finally {
          setIsLoading(false);
        }
      };
      
      checkOneDriveStatus();
    }
  }, [migrationComplete]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold">Configuration Microsoft OneDrive</h1>
      
      {isAdmin && <AdminOneDriveConfigForm />}
      
      {oneDriveStatus && (
        <div className="mb-6">
          {oneDriveStatus === 'enabled' ? (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                OneDrive est actuellement <span className="font-semibold">activé</span>. 
                {lastTokenUpdate && (
                  <div className="text-xs mt-1">
                    Dernière mise à jour: {lastTokenUpdate}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          ) : oneDriveStatus === 'disabled' ? (
            <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                OneDrive n'est pas activé. Configurez vos paramètres ci-dessous.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Erreur de vérification du statut OneDrive. Veuillez réessayer.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      
      <OneDriveSettings />
    </div>
  );
};

export default OneDriveSettingsWrapper;
