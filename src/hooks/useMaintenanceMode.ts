
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceSettings {
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  isLoading: boolean;
}

export const useMaintenanceMode = () => {
  const [settings, setSettings] = useState<MaintenanceSettings>({
    isMaintenanceMode: false,
    maintenanceMessage: '',
    isLoading: true
  });

  const checkMaintenanceMode = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['maintenance_mode', 'maintenance_message']);

      if (error) {
        console.error('Erreur lors de la vérification du mode maintenance:', error);
        return;
      }

      const settingsMap = data.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>);

      setSettings({
        isMaintenanceMode: settingsMap.maintenance_mode === 'true',
        maintenanceMessage: settingsMap.maintenance_message || 'Le site est actuellement en maintenance. Nous reviendrons bientôt !',
        isLoading: false
      });
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
          filter: 'key=in.(maintenance_mode,maintenance_message)'
        },
        () => {
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
