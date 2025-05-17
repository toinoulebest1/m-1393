
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDropboxConfig, saveDropboxConfig, isDropboxEnabled } from './dropboxStorage';

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
              // S'assurer que isEnabled est à true pour les nouveaux utilisateurs
              const updatedLocalConfig = {
                ...localConfig,
                isEnabled: true // Force enable Dropbox for new users
              };
              
              console.log('useSettingsMigration - Configuration forcée à Enabled=true pour le nouvel utilisateur');
              await saveDropboxConfig(updatedLocalConfig);
              
              // Mettre également à jour le localStorage
              localStorage.setItem('dropbox_config', JSON.stringify(updatedLocalConfig));
              
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
              
              // Pour les utilisateurs existants, s'assurer que Dropbox est activé s'ils ont un token valide
              if (dbConfig.accessToken && dbConfig.accessToken.length > 0) {
                if (!dbConfig.isEnabled) {
                  console.log('useSettingsMigration - Token trouvé mais Dropbox désactivé, activation forcée');
                  const updatedConfig = {
                    ...dbConfig,
                    isEnabled: true
                  };
                  await saveDropboxConfig(updatedConfig);
                  
                  // Mettre également à jour le localStorage
                  localStorage.setItem('dropbox_config', JSON.stringify(updatedConfig));
                }
              }
              
              // Si la configuration locale est activée mais pas celle de la base de données,
              // ou si la configuration locale a un token plus récent, la synchroniser
              else if ((localConfig.isEnabled && !dbConfig.isEnabled) || 
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
          
          // Pour les nouveaux utilisateurs sans configuration Dropbox, vérifier s'il existe une configuration par défaut
          // dans la base de données (paramètres globaux) et l'appliquer
          try {
            const { data, error } = await supabase
              .from('app_settings')
              .select('*')
              .eq('key', 'default_dropbox_config')
              .maybeSingle();
              
            if (!error && data) {
              console.log('useSettingsMigration - Configuration Dropbox par défaut trouvée dans app_settings');
              const defaultConfig = data.value as any;
              
              if (defaultConfig && defaultConfig.accessToken) {
                console.log('useSettingsMigration - Application de la configuration par défaut pour le nouvel utilisateur');
                await saveDropboxConfig({
                  accessToken: defaultConfig.accessToken,
                  refreshToken: defaultConfig.refreshToken,
                  clientId: defaultConfig.clientId,
                  clientSecret: defaultConfig.clientSecret,
                  expiresAt: defaultConfig.expiresAt,
                  isEnabled: true // Force enable for new users
                });
              }
            }
          } catch (e) {
            console.error('useSettingsMigration - Erreur lors de la recherche de config par défaut:', e);
          }
        }
        
        // Exécution d'une vérification finale pour s'assurer que l'état est correctement reflété partout
        const isDropboxEnabledNow = await isDropboxEnabled();
        console.log('useSettingsMigration - État final de Dropbox après migration:', isDropboxEnabledNow ? 'activé' : 'désactivé');
        
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
