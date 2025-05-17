
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDropboxConfig, saveDropboxConfig } from './dropboxStorage';

export const useSettingsMigration = () => {
  const [migrationComplete, setMigrationComplete] = useState(false);
  
  useEffect(() => {
    const migrateSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('No active session, skipping settings migration');
          setMigrationComplete(true);
          return;
        }
        
        // Migrer les paramètres Dropbox de localStorage vers Supabase
        const dropboxConfigStr = localStorage.getItem('dropbox_config');
        if (dropboxConfigStr) {
          try {
            console.log('Dropbox config found in localStorage, migrating to database...');
            const localConfig = JSON.parse(dropboxConfigStr);
            
            // Vérifier si la configuration est déjà dans la base de données
            const { data, error } = await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('key', 'dropbox_config')
              .maybeSingle();
            
            if (error) {
              console.error('Error checking existing Dropbox config in database:', error);
            } else if (!data) {
              console.log('No Dropbox config found in database, saving local config...');
              // Si pas de configuration dans la base de données, sauvegarder celle du localStorage
              await saveDropboxConfig(localConfig);
            } else {
              console.log('Dropbox config exists in database, comparing with localStorage...');
              // Si la configuration existe déjà, vérifier si la version locale est plus récente
              const dbConfig = data.settings as any;
              
              // Si la configuration locale est activée mais pas celle de la base de données,
              // ou si la configuration locale a un token plus récent, la synchroniser
              if ((localConfig.isEnabled && !dbConfig.isEnabled) || 
                  (localConfig.expiresAt && dbConfig.expiresAt && localConfig.expiresAt > dbConfig.expiresAt)) {
                console.log('Local Dropbox config is more recent, updating database...');
                await saveDropboxConfig(localConfig);
              } else {
                console.log('Database Dropbox config is more recent or the same, syncing to localStorage...');
                // Sinon, synchroniser la configuration de la base de données vers le localStorage
                localStorage.setItem('dropbox_config', JSON.stringify({
                  accessToken: dbConfig.accessToken || '',
                  refreshToken: dbConfig.refreshToken || undefined,
                  clientId: dbConfig.clientId || undefined,
                  clientSecret: dbConfig.clientSecret || undefined,
                  expiresAt: dbConfig.expiresAt || undefined,
                  isEnabled: dbConfig.isEnabled || false
                }));
              }
            }
          } catch (e) {
            console.error('Error during Dropbox config migration:', e);
          }
        }
        
        setMigrationComplete(true);
      } catch (error) {
        console.error('Settings migration error:', error);
        setMigrationComplete(true);
      }
    };
    
    migrateSettings();
  }, []);
  
  return { migrationComplete };
};
