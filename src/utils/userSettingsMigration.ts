
import React, { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserSettingInsert } from '@/types/userSettings';

/**
 * Utilitaire pour migrer les paramètres de localStorage vers Supabase
 */
export const migrateLocalStorageToSupabase = async (): Promise<void> => {
  // Vérifier si l'utilisateur est connecté
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    console.log('Aucun utilisateur connecté, impossible de migrer les données');
    return;
  }
  
  // Liste des clés à migrer
  const keysToMigrate = ['dropbox_config'];
  
  for (const key of keysToMigrate) {
    try {
      // Vérifier si la configuration existe déjà dans Supabase
      const { data, error } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('key', key)
        .maybeSingle();  // Utiliser maybeSingle() au lieu de single()
        
      if (error) {
        console.error(`Erreur lors de la vérification de ${key}:`, error);
        continue;
      }
      
      // Si la configuration existe déjà, passer à la suite
      if (data) {
        console.log(`${key} existe déjà dans Supabase, ignoré`);
        continue;
      }
      
      // Récupérer la configuration depuis localStorage
      const localValue = localStorage.getItem(key);
      if (!localValue) {
        console.log(`${key} n'existe pas dans localStorage, ignoré`);
        continue;
      }
      
      // Analyser la valeur
      try {
        const settings = JSON.parse(localValue);
        
        // Créer une nouvelle entrée dans Supabase
        const newSetting: UserSettingInsert = {
          user_id: session.user.id,
          key,
          settings
        };
        
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert(newSetting);
          
        if (insertError) {
          console.error(`Erreur lors de la migration de ${key}:`, insertError);
        } else {
          console.log(`${key} migré avec succès vers Supabase`);
        }
      } catch (parseError) {
        console.error(`Erreur lors de l'analyse de ${key}:`, parseError);
      }
    } catch (e) {
      console.error(`Erreur lors de la migration de ${key}:`, e);
    }
  }
};

/**
 * Hook à utiliser dans les composants principaux pour déclencher la migration
 */
export const useSettingsMigration = (): void => {
  useEffect(() => {
    migrateLocalStorageToSupabase();
  }, []);
};
