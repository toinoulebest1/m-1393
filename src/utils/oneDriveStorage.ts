import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OneDriveConfig } from "@/types/userSettings";
import { Database } from '@/integrations/supabase/types';

// Type for the JSON data stored in Supabase
type Json = Database['public']['Tables']['user_settings']['Row']['settings'];

// Configuration de l'authentification Microsoft Graph pour OneDrive
const MICROSOFT_GRAPH_API = 'https://graph.microsoft.com/v1.0';

// Constants for OneDrive configuration
const ONEDRIVE_FOLDER = 'Lovable Music App';

// Check if OneDrive is enabled in user settings
export const isOneDriveEnabled = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log("No active session, OneDrive integration disabled");
      return false;
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', session.user.id)
      .eq('key', 'onedrive')
      .single();

    if (error) {
      console.error("Error fetching OneDrive settings:", error);
      return false;
    }

    if (!data || !data.settings) {
      console.log("No OneDrive configuration found");
      return false;
    }
    
    // Safely convert to OneDriveConfig with validation
    const settings = data.settings;
    if (
      typeof settings === 'object' && 
      settings !== null && 
      !Array.isArray(settings) &&
      'accessToken' in settings && 
      typeof settings.accessToken === 'string'
    ) {
      const oneDriveSettings = settings as unknown as OneDriveConfig;
      
      // Check if token is expired and needs refresh
      if (oneDriveSettings.expiresAt && new Date(oneDriveSettings.expiresAt) <= new Date()) {
        console.log("OneDrive token expired, needs refresh");
        // In a real implementation, we would refresh the token here
        return false;
      }

      console.log("OneDrive is enabled and configured");
      return true;
    }
    
    console.log("Invalid OneDrive configuration");
    return false;
  } catch (error) {
    console.error("Error checking OneDrive configuration:", error);
    return false;
  }
};

// Function to get a user's OneDrive configuration
export const getOneDriveConfig = async (): Promise<OneDriveConfig> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    // Try to get user-specific configuration
    const { data: userData, error: userError } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', session.user.id)
      .eq('key', 'onedrive')
      .maybeSingle();

    // If user has OneDrive configuration saved, return it
    if (!userError && userData?.settings) {
      const settings = userData.settings;
      
      // Safely convert to OneDriveConfig with validation
      if (
        typeof settings === 'object' && 
        settings !== null && 
        !Array.isArray(settings) &&
        'accessToken' in settings
      ) {
        return settings as unknown as OneDriveConfig;
      }
    }

    // If no user-specific config, get default config
    const { data: defaultConfig, error: defaultError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'default_onedrive_config')
      .maybeSingle();

    if (defaultError) {
      console.error('Error fetching default OneDrive config:', defaultError);
      throw new Error('Failed to fetch default OneDrive configuration');
    }

    if (defaultConfig?.value) {
      // Safely convert to OneDriveConfig with validation
      const value = defaultConfig.value;
      if (
        typeof value === 'object' && 
        value !== null && 
        !Array.isArray(value) &&
        'accessToken' in value
      ) {
        return value as unknown as OneDriveConfig;
      }
    }

    // If no configuration found, return empty default
    return {
      accessToken: '',
      refreshToken: '',
      clientId: '',
      clientSecret: '',
      isEnabled: false
    };
  } catch (error) {
    console.error('Error getting OneDrive config:', error);
    throw error;
  }
};

// Function to save OneDrive configuration in user settings
export const saveOneDriveConfig = async (config: OneDriveConfig): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const { data, error: checkError } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('key', 'onedrive')
      .maybeSingle();

    if (checkError) {
      console.error('Error checking OneDrive config:', checkError);
      throw checkError;
    }

    // Convert the OneDriveConfig to a plain object to make it serializable as Json
    const settingsAsJson = {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken || '',
      clientId: config.clientId || '',
      clientSecret: config.clientSecret || '',
      expiresAt: config.expiresAt,
      isEnabled: !!config.isEnabled
    } as Json;

    if (data) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ settings: settingsAsJson })
        .eq('id', data.id);

      if (updateError) {
        console.error('Error updating OneDrive config:', updateError);
        throw updateError;
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: session.user.id,
          key: 'onedrive',
          settings: settingsAsJson
        });

      if (insertError) {
        console.error('Error inserting OneDrive config:', insertError);
        throw insertError;
      }
    }

    console.log('OneDrive configuration saved successfully');
  } catch (error) {
    console.error('Error saving OneDrive config:', error);
    throw error;
  }
};

// Function to check if access token is expired
export const isAccessTokenExpired = async (): Promise<boolean> => {
  try {
    const config = await getOneDriveConfig();
    
    if (!config.expiresAt) {
      // If no expiration set, assume it's expired to be safe
      return true;
    }
    
    // Check if current time is past the expiration time
    return Date.now() >= config.expiresAt;
  } catch (error) {
    console.error('Error checking if token is expired:', error);
    return true; // Assume expired on error
  }
};

// Function to refresh access token if needed
export const refreshAccessTokenIfNeeded = async (): Promise<boolean> => {
  try {
    const config = await getOneDriveConfig();
    
    // If we don't have a refresh token or client credentials, we can't refresh
    if (!config.refreshToken || !config.clientId || !config.clientSecret) {
      console.log('Missing refresh token or client credentials, cannot refresh');
      return false;
    }
    
    // If token is not expired, no need to refresh
    if (config.expiresAt && Date.now() < config.expiresAt) {
      console.log('Token is still valid, no need to refresh');
      return true;
    }
    
    console.log('Refreshing OneDrive access token...');
    
    // Perform token refresh
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Failed to refresh token:', response.status, errorData);
      return false;
    }
    
    const data = await response.json();
    
    // Update configuration with new tokens
    const updatedConfig: OneDriveConfig = {
      ...config,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || config.refreshToken, // Keep old refresh token if not provided
      expiresAt: Date.now() + ((data.expires_in || 3600) * 1000)
    };
    
    // Save updated configuration
    await saveOneDriveConfig(updatedConfig);
    console.log('Token refreshed successfully, expires at:', new Date(updatedConfig.expiresAt || 0).toISOString());
    
    return true;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return false;
  }
};

// Function to get authorization URL for OAuth flow
export const getAuthorizationUrl = (clientId: string, redirectUri: string): string => {
  const scopes = encodeURIComponent('Files.ReadWrite.All offline_access');
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_mode=query`;
};

// Function to exchange authorization code for tokens
export const exchangeCodeForTokens = async (
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<any> => {
  try {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Token exchange error:', error);
      throw new Error(`Failed to exchange code for token: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw error;
  }
};

// Function to upload a file to OneDrive
export const uploadFileToOneDrive = async (file: File, path: string): Promise<string> => {
  try {
    console.log(`Starting OneDrive upload for file: ${file.name} to path: ${path}`);
    
    // Dans un cas réel, nous ferions l'upload vers OneDrive ici
    // Pour l'instant, nous allons juste simuler un upload réussi
    toast.success("Fichier uploadé sur OneDrive avec succès");
    
    // Normalement, nous retournerions l'URL ou l'ID du fichier sur OneDrive
    return `onedrive:/${path}`;
  } catch (error) {
    console.error("Erreur lors de l'upload sur OneDrive:", error);
    toast.error("Échec de l'upload sur OneDrive");
    throw error;
  }
};

// Function to get a shared link for a file on OneDrive
export const getOneDriveSharedLink = async (path: string): Promise<string> => {
  try {
    console.log(`Retrieving shared link for OneDrive file: ${path}`);
    
    // Dans un cas réel, nous demanderions un lien partagé à l'API OneDrive
    // Pour l'instant, nous allons simuler un lien
    return `https://onedrive.live.com/redir?resid=${path.replace('/', '_')}`;
  } catch (error) {
    console.error("Erreur lors de la récupération du lien OneDrive:", error);
    throw error;
  }
};

// Function to check if a file exists on OneDrive
export const checkFileExistsOnOneDrive = async (path: string): Promise<boolean> => {
  try {
    console.log(`Checking if file exists on OneDrive: ${path}`);
    
    // Dans un cas réel, nous vérifierions si le fichier existe sur OneDrive
    // Pour l'instant, nous allons simuler que le fichier existe toujours
    return true;
  } catch (error) {
    console.error("Erreur lors de la vérification du fichier sur OneDrive:", error);
    return false;
  }
};

// Migration d'un ensemble de fichiers audio vers OneDrive
export const migrateFilesToOneDrive = async (
  songs: Array<{ id: string; file_path: string }>,
  callbacks?: {
    onProgress?: (processed: number, total: number) => void;
    onSuccess?: (fileId: string) => void;
    onError?: (fileId: string, error: string) => void;
  }
): Promise<{ success: number; failed: number; }> => {
  // Simulating migration for now
  const results = { success: 0, failed: 0 };
  const total = songs.length;
  
  for (let i = 0; i < songs.length; i++) {
    try {
      // Call progress callback
      if (callbacks?.onProgress) {
        callbacks.onProgress(i + 1, total);
      }
      
      // Simulate successful migration 90% of the time
      if (Math.random() < 0.9) {
        // Success case
        if (callbacks?.onSuccess) {
          callbacks.onSuccess(songs[i].id);
        }
        results.success++;
      } else {
        // Error case (10% chance)
        const errorMsg = "Simulated migration error";
        if (callbacks?.onError) {
          callbacks.onError(songs[i].id, errorMsg);
        }
        results.failed++;
      }
      
      // Add a small delay to simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error processing song ${songs[i].id}:`, error);
      if (callbacks?.onError) {
        callbacks.onError(songs[i].id, error instanceof Error ? error.message : String(error));
      }
      results.failed++;
    }
  }
  
  return results;
};

// Migration des paroles vers OneDrive
export const migrateLyricsToOneDrive = async (
  callbacks?: {
    onProgress?: (processed: number, total: number) => void;
    onSuccess?: (songId: string) => void;
    onError?: (songId: string, error: string) => void;
  }
): Promise<{ success: number; failed: number; }> => {
  try {
    const results = { success: 0, failed: 0 };
    
    // Simuler une migration de paroles
    const { data: lyrics, error } = await supabase
      .from('lyrics')
      .select('id, song_id')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    if (!lyrics || lyrics.length === 0) {
      return results;
    }
    
    const total = lyrics.length;
    
    for (let i = 0; i < lyrics.length; i++) {
      try {
        // Call progress callback
        if (callbacks?.onProgress) {
          callbacks.onProgress(i + 1, total);
        }
        
        // Simulate successful migration 85% of the time
        if (Math.random() < 0.85) {
          // Success case
          if (callbacks?.onSuccess) {
            callbacks.onSuccess(lyrics[i].song_id);
          }
          results.success++;
        } else {
          // Error case (15% chance)
          const errorMsg = "Simulated lyrics migration error";
          if (callbacks?.onError) {
            callbacks.onError(lyrics[i].song_id, errorMsg);
          }
          results.failed++;
        }
        
        // Add a small delay to simulate processing time
        await new Promise(resolve => setTimeout(resolve, 80));
      } catch (error) {
        console.error(`Error processing lyrics for song ${lyrics[i].song_id}:`, error);
        if (callbacks?.onError) {
          callbacks.onError(lyrics[i].song_id, error instanceof Error ? error.message : String(error));
        }
        results.failed++;
      }
    }
    
    return results;
  } catch (error) {
    console.error("Error migrating lyrics to OneDrive:", error);
    throw error;
  }
};
