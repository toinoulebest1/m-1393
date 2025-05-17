
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDropboxConfig, saveDropboxConfig } from './dropboxStorage';

export const useSettingsMigration = () => {
  const [migrationComplete, setMigrationComplete] = useState(false);
  
  useEffect(() => {
    const migrateSettings = async () => {
      try {
        console.log('useSettingsMigration - Début de la migration des paramètres');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('useSettingsMigration - Aucune session active, migration ignorée');
          setMigrationComplete(true);
          return;
        }
        
        // Migrer les paramètres Dropbox de localStorage vers Supabase
        const dropboxConfigStr = localStorage.getItem('dropbox_config');
        if (dropboxConfigStr) {
          try {
            console.log('useSettingsMigration - Config Dropbox trouvée dans localStorage, migration vers DB...');
            const localConfig = JSON.parse(dropboxConfigStr);
            
            // Vérifier si la configuration est déjà dans la base de données
            const { data, error } = await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('key', 'dropbox_config')
              .maybeSingle();
            
            if (error) {
              console.error('useSettingsMigration - Erreur vérification config Dropbox dans DB:', error);
            } else if (!data) {
              console.log('useSettingsMigration - Aucune config dans DB, sauvegarde de la config locale');
              // Si pas de configuration dans la base de données, sauvegarder celle du localStorage
              await saveDropboxConfig(localConfig);
            } else {
              console.log('useSettingsMigration - Config existante en DB, comparaison avec localStorage');
              // Si la configuration existe déjà, vérifier si la version locale est plus récente
              const dbConfig = data.settings as any;
              
              console.log('useSettingsMigration - Config DB:', {
                isEnabled: dbConfig.isEnabled,
                hasToken: !!dbConfig.accessToken
              });
              console.log('useSettingsMigration - Config locale:', {
                isEnabled: localConfig.isEnabled,
                hasToken: !!localConfig.accessToken
              });
              
              // Si la configuration locale est activée mais pas celle de la base de données,
              // ou si la configuration locale a un token plus récent, la synchroniser
              if ((localConfig.isEnabled && !dbConfig.isEnabled) || 
                  (localConfig.expiresAt && dbConfig.expiresAt && localConfig.expiresAt > dbConfig.expiresAt)) {
                console.log('useSettingsMigration - Config locale plus récente, mise à jour DB');
                await saveDropboxConfig(localConfig);
              } else {
                console.log('useSettingsMigration - Config DB plus récente ou identique, sync vers localStorage');
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
            console.error('useSettingsMigration - Erreur migration config Dropbox:', e);
          }
        } else {
          console.log('useSettingsMigration - Aucune config Dropbox dans localStorage');
        }
        
        console.log('useSettingsMigration - Migration terminée');
        setMigrationComplete(true);
      } catch (error) {
        console.error('useSettingsMigration - Erreur de migration:', error);
        setMigrationComplete(true);
      }
    };
    
    migrateSettings();
  }, []);
  
  return { migrationComplete };
};
