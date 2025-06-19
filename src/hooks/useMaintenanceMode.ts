
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceSettings {
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  endTime?: string;
  currentStep?: number;
  totalSteps?: number;
  isLoading: boolean;
}

export const useMaintenanceMode = () => {
  const [settings, setSettings] = useState<MaintenanceSettings>({
    isMaintenanceMode: false,
    maintenanceMessage: '',
    endTime: undefined,
    currentStep: undefined,
    totalSteps: undefined,
    isLoading: true
  });

  const checkMaintenanceMode = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', [
          'maintenance_mode', 
          'maintenance_message', 
          'maintenance_end_time', 
          'maintenance_current_step', 
          'maintenance_total_steps'
        ]);

      if (error) {
        console.error('Erreur lors de la vérification du mode maintenance:', error);
        setSettings(prev => ({ ...prev, isLoading: false }));
        return;
      }

      console.log('useMaintenanceMode - Données récupérées:', data);

      const settingsMap = data?.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>) || {};

      console.log('useMaintenanceMode - Settings mappés:', settingsMap);
      console.log('useMaintenanceMode - maintenance_end_time brut:', settingsMap.maintenance_end_time);

      const newSettings = {
        isMaintenanceMode: settingsMap.maintenance_mode === 'true',
        maintenanceMessage: settingsMap.maintenance_message || 'Le site est actuellement en maintenance. Nous reviendrons bientôt !',
        endTime: settingsMap.maintenance_end_time || undefined,
        currentStep: settingsMap.maintenance_current_step ? parseInt(settingsMap.maintenance_current_step) : undefined,
        totalSteps: settingsMap.maintenance_total_steps ? parseInt(settingsMap.maintenance_total_steps) : undefined,
        isLoading: false
      };

      console.log('useMaintenanceMode - Nouveaux settings:', newSettings);
      console.log('useMaintenanceMode - endTime final:', newSettings.endTime);

      setSettings(newSettings);
    } catch (error) {
      console.error('Erreur lors de la vérification du mode maintenance:', error);
      setSettings(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    checkMaintenanceMode();

    // Écouter les changements en temps réel
    const channel = supabase
      .channel('site-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_settings',
          filter: 'key=in.(maintenance_mode,maintenance_message,maintenance_end_time,maintenance_current_step,maintenance_total_steps)'
        },
        () => {
          console.log('useMaintenanceMode - Changement détecté, rechargement...');
          checkMaintenanceMode();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    ...settings,
    refetch: checkMaintenanceMode
  };
};
