
import { supabase } from '@/integrations/supabase/client';
import { OneDriveConfig, OneDriveConfigJson } from '@/types/onedrive';
import { toast } from '@/hooks/use-toast';

// Cache for the shared configuration to avoid repeated database queries
let sharedConfigCache: OneDriveConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

/**
 * Fetches the shared OneDrive configuration from the database
 */
export const fetchSharedOneDriveConfig = async (): Promise<OneDriveConfig | null> => {
  // Use cached version if available and not expired
  const now = Date.now();
  if (sharedConfigCache && now - lastFetchTime < CACHE_TTL) {
    return sharedConfigCache;
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'shared_onedrive_config')
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching shared OneDrive config:', error);
      return null;
    }

    if (!data || !data.value) {
      console.log('No shared OneDrive configuration found');
      return null;
    }

    // Cast the data.value to OneDriveConfig with proper type checking
    // First ensure it's an object with the expected structure
    const value = data.value as Record<string, any>;
    const config: OneDriveConfig = {
      accessToken: typeof value.accessToken === 'string' ? value.accessToken : '',
      refreshToken: typeof value.refreshToken === 'string' ? value.refreshToken : '',
      isEnabled: !!value.isEnabled,
      clientId: typeof value.clientId === 'string' ? value.clientId : '',
      isShared: true
    };
    
    // Update cache
    sharedConfigCache = config;
    lastFetchTime = now;
    
    return config;
  } catch (error) {
    console.error('Exception while fetching shared OneDrive config:', error);
    return null;
  }
};

/**
 * Saves the shared OneDrive configuration to the database
 * Only admin users should be able to call this function
 */
export const saveSharedOneDriveConfig = async (config: OneDriveConfig): Promise<boolean> => {
  try {
    // Ensure we're storing a value that matches Supabase's expectations for JSONB
    const configValue: OneDriveConfigJson = {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      isEnabled: config.isEnabled,
      clientId: config.clientId,
      isShared: true
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { 
          key: 'shared_onedrive_config', 
          value: configValue
        },
        { 
          onConflict: 'key',
          ignoreDuplicates: false
        }
      );
    
    if (error) {
      console.error('Error saving shared OneDrive config:', error);
      toast({
        title: "Erreur",
        description: 'Erreur lors de l\'enregistrement de la configuration OneDrive partagée',
        variant: "destructive"
      });
      return false;
    }

    // Update cache
    sharedConfigCache = config;
    lastFetchTime = Date.now();
    
    toast({
      title: "Succès",
      description: 'Configuration OneDrive partagée enregistrée avec succès',
      variant: "default"
    });
    return true;
  } catch (error) {
    console.error('Exception while saving shared OneDrive config:', error);
    toast({
      title: "Erreur",
      description: 'Erreur lors de l\'enregistrement de la configuration OneDrive partagée',
      variant: "destructive"
    });
    return false;
  }
};

/**
 * Invalidates the shared configuration cache
 */
export const invalidateSharedConfigCache = () => {
  sharedConfigCache = null;
  lastFetchTime = 0;
};
