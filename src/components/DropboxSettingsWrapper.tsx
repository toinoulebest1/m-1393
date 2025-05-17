
import React, { useEffect, useState } from 'react';
import { DropboxSettings } from './DropboxSettings';
import { useSettingsMigration } from '@/utils/userSettingsMigration';
import { getDropboxConfig } from '@/utils/dropboxStorage';

const DropboxSettingsWrapper: React.FC = () => {
  const { migrationComplete } = useSettingsMigration();
  const [isLoading, setIsLoading] = useState(true);
  const [dropboxStatus, setDropboxStatus] = useState<string | null>(null);
  
  // Vérifier l'état de Dropbox une fois la migration terminée
  useEffect(() => {
    if (migrationComplete) {
      const checkDropboxStatus = async () => {
        try {
          const config = await getDropboxConfig();
          setDropboxStatus(config.isEnabled ? 'enabled' : 'disabled');
          console.log('DropboxSettingsWrapper - Dropbox status:', config.isEnabled ? 'enabled' : 'disabled');
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
        <div className="mb-4 px-4 py-2 rounded-md bg-muted/50 text-sm">
          Statut actuel de Dropbox: <span className={dropboxStatus === 'enabled' ? 'text-green-500' : 'text-amber-500'}>
            {dropboxStatus === 'enabled' ? 'Activé' : 'Désactivé'}
          </span>
        </div>
      )}
      <DropboxSettings />
    </>
  );
};

export default DropboxSettingsWrapper;
