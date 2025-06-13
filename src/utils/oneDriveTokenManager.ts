
import { supabase } from '@/integrations/supabase/client';
import { OneDriveConfig } from '@/types/onedrive';
import { saveOneDriveConfig, getOneDriveConfigSync } from './oneDriveStorage';
import { toast } from '@/hooks/use-toast';

interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

// Flag pour éviter les rafraîchissements multiples simultanés
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const refreshOneDriveToken = async (): Promise<string | null> => {
  // Si un rafraîchissement est déjà en cours, retourner la promesse existante
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  
  refreshPromise = (async (): Promise<string | null> => {
    try {
      const config = getOneDriveConfigSync();
      
      if (!config.refreshToken || !config.clientId) {
        console.error('Refresh token or client ID not available');
        toast.error('Configuration OneDrive incomplète pour le rafraîchissement');
        return null;
      }

      console.log('Rafraîchissement du jeton OneDrive en cours...');

      // Appeler la edge function pour rafraîchir le jeton
      const { data, error } = await supabase.functions.invoke('onedrive-refresh-token', {
        body: {
          refreshToken: config.refreshToken,
          clientId: config.clientId
        }
      });

      if (error || !data) {
        console.error('Erreur lors du rafraîchissement du jeton:', error);
        toast.error('Impossible de rafraîchir le jeton OneDrive');
        return null;
      }

      const tokenData = data as RefreshTokenResponse;

      // Mettre à jour la configuration avec le nouveau jeton
      const updatedConfig: OneDriveConfig = {
        ...config,
        accessToken: tokenData.access_token,
        // Utiliser le nouveau refresh token s'il est fourni, sinon garder l'ancien
        refreshToken: tokenData.refresh_token || config.refreshToken
      };

      saveOneDriveConfig(updatedConfig);
      
      console.log('Jeton OneDrive rafraîchi avec succès');
      toast.success('Jeton OneDrive rafraîchi automatiquement');
      
      return tokenData.access_token;
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du jeton OneDrive:', error);
      toast.error('Échec du rafraîchissement automatique du jeton');
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Fonction pour exécuter une requête avec retry automatique en cas d'expiration du jeton
export const executeWithTokenRefresh = async <T>(
  operation: (accessToken: string) => Promise<T>
): Promise<T> => {
  const config = getOneDriveConfigSync();
  
  if (!config.accessToken) {
    throw new Error('Aucun jeton d\'accès OneDrive configuré');
  }

  try {
    // Première tentative avec le jeton actuel
    return await operation(config.accessToken);
  } catch (error: any) {
    // Vérifier si l'erreur est due à un jeton expiré (401)
    if (error.message?.includes('401') || error.status === 401 || 
        (typeof error === 'object' && error.response?.status === 401)) {
      
      console.log('Jeton OneDrive expiré, tentative de rafraîchissement...');
      
      // Tenter de rafraîchir le jeton
      const newAccessToken = await refreshOneDriveToken();
      
      if (!newAccessToken) {
        throw new Error('Impossible de rafraîchir le jeton OneDrive');
      }
      
      // Retry l'opération avec le nouveau jeton
      console.log('Retry de l\'opération avec le nouveau jeton...');
      return await operation(newAccessToken);
    }
    
    // Si ce n'est pas une erreur de jeton expiré, re-lancer l'erreur
    throw error;
  }
};

// Fonction pour vérifier si une réponse indique un jeton expiré
export const isTokenExpiredError = (response: Response): boolean => {
  return response.status === 401;
};

// Fonction pour vérifier si une erreur indique un jeton expiré
export const isTokenExpiredFromError = (error: any): boolean => {
  return error.status === 401 || 
         error.message?.includes('401') || 
         (typeof error === 'object' && error.response?.status === 401);
};
