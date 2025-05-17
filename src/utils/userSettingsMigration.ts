
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDropboxConfig, saveDropboxConfig, isDropboxEnabled } from './dropboxStorage';
import { DropboxConfig } from '@/types/dropbox';

export const useSettingsMigration = () => {
  const [migrationComplete, setMigrationComplete] = useState(false);
  
  useEffect(() => {
    const migrateSettings = async () => {
      try {
        console.log('useSettingsMigration - Début de la migration des paramètres');
        const { data: { session } } = await supabase.auth.getSession();
        
        // Récupérer la configuration admin par défaut
        console.log('useSettingsMigration - Recherche d\'une configuration admin par défaut');
        const { data: adminConfig, error: adminError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'default_dropbox_config')
          .maybeSingle();
          
        if (adminError) {
          console.error('useSettingsMigration - Erreur récupération config admin:', adminError);
        }
        
        const adminDropboxConfig = adminConfig?.value as any;
        if (adminDropboxConfig) {
          console.log('useSettingsMigration - Configuration admin trouvée avec token:', !!adminDropboxConfig.accessToken);
        } else {
          console.log('useSettingsMigration - Aucune configuration admin trouvée');
        }
        
        // Si l'utilisateur n'est pas connecté, mettre à jour uniquement le localStorage
        if (!session) {
          console.log('useSettingsMigration - Aucune session active, mise à jour locale uniquement');
          
          // Appliquer la configuration admin si disponible
          if (adminDropboxConfig) {
            const localConfig: DropboxConfig = {
              accessToken: adminDropboxConfig.accessToken || '',
              refreshToken: adminDropboxConfig.refreshToken,
              clientId: adminDropboxConfig.clientId,
              clientSecret: adminDropboxConfig.clientSecret,
              expiresAt: adminDropboxConfig.expiresAt,
              isEnabled: true // Toujours activé
            };
            
            localStorage.setItem('dropbox_config', JSON.stringify(localConfig));
            console.log('useSettingsMigration - Configuration locale mise à jour avec config admin');
          } else {
            // Forcer l'activation dans la config locale existante
            const configStr = localStorage.getItem('dropbox_config');
            if (configStr) {
              try {
                const localConfig = JSON.parse(configStr) as DropboxConfig;
                localConfig.isEnabled = true; // Forcer l'activation
                localStorage.setItem('dropbox_config', JSON.stringify(localConfig));
                console.log('useSettingsMigration - Configuration locale existante activée');
              } catch (e) {
                console.error('useSettingsMigration - Erreur mise à jour locale:', e);
              }
            } else {
              // Créer une config vide mais activée
              localStorage.setItem('dropbox_config', JSON.stringify({
                accessToken: '',
                isEnabled: true
              }));
              console.log('useSettingsMigration - Nouvelle configuration locale vide créée et activée');
            }
          }
          
          setMigrationComplete(true);
          return;
        }
        
        // Pour les utilisateurs connectés, vérifier leur configuration
        console.log('useSettingsMigration - Vérification de la configuration utilisateur');
        const { data: userConfig, error: userError } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('key', 'dropbox_config')
          .maybeSingle();
          
        if (userError) {
          console.error('useSettingsMigration - Erreur vérification config utilisateur:', userError);
        }
        
        // Si l'utilisateur n'a pas de configuration
        if (!userConfig) {
          console.log('useSettingsMigration - Aucune config utilisateur, création d\'une nouvelle');
          
          // Si une configuration admin existe, l'utiliser
          if (adminDropboxConfig) {
            console.log('useSettingsMigration - Application de la configuration admin');
            const newConfig: DropboxConfig = {
              accessToken: adminDropboxConfig.accessToken || '',
              refreshToken: adminDropboxConfig.refreshToken,
              clientId: adminDropboxConfig.clientId,
              clientSecret: adminDropboxConfig.clientSecret,
              expiresAt: adminDropboxConfig.expiresAt,
              isEnabled: true // Toujours activé
            };
            
            await saveDropboxConfig(newConfig);
            localStorage.setItem('dropbox_config', JSON.stringify(newConfig));
            console.log('useSettingsMigration - Configuration utilisateur créée avec config admin');
          } else {
            // Créer une configuration vide mais activée
            const emptyConfig: DropboxConfig = {
              accessToken: '',
              isEnabled: true
            };
            
            await saveDropboxConfig(emptyConfig);
            localStorage.setItem('dropbox_config', JSON.stringify(emptyConfig));
            console.log('useSettingsMigration - Configuration utilisateur vide créée et activée');
          }
        } 
        // Si l'utilisateur a déjà une configuration
        else {
          console.log('useSettingsMigration - Configuration utilisateur existante trouvée');
          const userSettings = userConfig.settings as any;
          
          // Si l'utilisateur n'a pas de token mais qu'une config admin existe
          if ((!userSettings.accessToken || userSettings.accessToken.length === 0) && adminDropboxConfig && adminDropboxConfig.accessToken) {
            console.log('useSettingsMigration - Utilisateur sans token mais config admin disponible, mise à jour');
            const updatedConfig: DropboxConfig = {
              accessToken: adminDropboxConfig.accessToken,
              refreshToken: adminDropboxConfig.refreshToken,
              clientId: adminDropboxConfig.clientId,
              clientSecret: adminDropboxConfig.clientSecret,
              expiresAt: adminDropboxConfig.expiresAt,
              isEnabled: true
            };
            
            await saveDropboxConfig(updatedConfig);
            localStorage.setItem('dropbox_config', JSON.stringify(updatedConfig));
            console.log('useSettingsMigration - Configuration utilisateur mise à jour avec token admin');
          } 
          // Sinon, s'assurer que Dropbox est activé
          else if (!userSettings.isEnabled) {
            console.log('useSettingsMigration - Activation forcée de Dropbox pour l\'utilisateur');
            const updatedConfig: DropboxConfig = {
              ...userSettings,
              isEnabled: true
            };
            
            await saveDropboxConfig(updatedConfig);
            localStorage.setItem('dropbox_config', JSON.stringify(updatedConfig));
            console.log('useSettingsMigration - Dropbox activé pour l\'utilisateur');
          } else {
            console.log('useSettingsMigration - Configuration utilisateur déjà correcte');
          }
        }
        
        // Exécution d'une vérification finale
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
