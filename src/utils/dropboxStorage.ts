import { DropboxConfig, DropboxFileReference, DropboxTokenResponse } from '@/types/dropbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { UserSettingInsert } from '@/types/userSettings';

// Type pour Json compatible avec DropboxConfig
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Fonction modifiée pour récupérer la configuration depuis Supabase
export const getDropboxConfig = async (): Promise<DropboxConfig> => {
  // Vérifier si l'utilisateur est connecté
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    console.log('Utilisateur non connecté, utilisation de la configuration locale');
    // Fallback vers localStorage si l'utilisateur n'est pas connecté
    const configStr = localStorage.getItem('dropbox_config');
    if (!configStr) {
      return { accessToken: '', isEnabled: false };
    }
    
    try {
      return JSON.parse(configStr) as DropboxConfig;
    } catch (e) {
      console.error('Error parsing Dropbox config:', e);
      return { accessToken: '', isEnabled: false };
    }
  }
  
  try {
    // Récupérer la configuration de l'utilisateur depuis Supabase
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('key', 'dropbox_config')
      .maybeSingle();  // Utiliser maybeSingle() au lieu de single()
    
    if (error) {
      console.error('Erreur lors de la récupération de la configuration Dropbox:', error);
      
      // Fallback vers localStorage si erreur avec Supabase
      const configStr = localStorage.getItem('dropbox_config');
      if (configStr) {
        try {
          return JSON.parse(configStr) as DropboxConfig;
        } catch (e) {
          console.error('Error parsing Dropbox config from localStorage:', e);
        }
      }
      
      return { accessToken: '', isEnabled: false };
    }
    
    if (!data) {
      // Si pas de configuration dans Supabase, essayer localStorage
      const configStr = localStorage.getItem('dropbox_config');
      if (configStr) {
        try {
          const localConfig = JSON.parse(configStr) as DropboxConfig;
          console.log('Using Dropbox config from localStorage:', localConfig.isEnabled ? 'enabled' : 'disabled');
          return localConfig;
        } catch (e) {
          console.error('Error parsing Dropbox config from localStorage:', e);
        }
      }
      return { accessToken: '', isEnabled: false };
    }
    
    // Conversion sûre de settings en DropboxConfig
    const settings = data.settings as Record<string, any>;
    const config: DropboxConfig = {
      accessToken: settings.accessToken || '',
      refreshToken: settings.refreshToken || undefined,
      clientId: settings.clientId || undefined,
      clientSecret: settings.clientSecret || undefined,
      expiresAt: settings.expiresAt || undefined,
      isEnabled: settings.isEnabled || false
    };
    
    console.log('Dropbox config from database:', config.isEnabled ? 'enabled' : 'disabled');
    return config;
  } catch (e) {
    console.error('Error fetching Dropbox config from Supabase:', e);
    
    // Fallback vers localStorage en cas d'erreur générale
    const configStr = localStorage.getItem('dropbox_config');
    if (configStr) {
      try {
        return JSON.parse(configStr) as DropboxConfig;
      } catch (parseError) {
        console.error('Error parsing Dropbox config from localStorage:', parseError);
      }
    }
    
    return { accessToken: '', isEnabled: false };
  }
};

export const saveDropboxConfig = async (config: DropboxConfig): Promise<void> => {
  // Vérifier si l'utilisateur est connecté
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    console.log('Utilisateur non connecté, sauvegarde locale seulement');
    // Fallback vers localStorage si l'utilisateur n'est pas connecté
    localStorage.setItem('dropbox_config', JSON.stringify(config));
    return;
  }
  
  try {
    // D'abord vérifier si l'entrée existe déjà
    const { data, error: fetchError } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('key', 'dropbox_config')
      .maybeSingle();
    
    if (fetchError) {
      console.error('Erreur lors de la vérification de la configuration existante:', fetchError);
      // Fallback vers localStorage en cas d'erreur
      localStorage.setItem('dropbox_config', JSON.stringify(config));
      return;
    }
    
    // Préparer l'objet settings pour stockage dans la base
    const settingsObject = {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      expiresAt: config.expiresAt,
      isEnabled: config.isEnabled
    };
    
    if (data) {
      // Mise à jour de la configuration existante
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ settings: settingsObject })
        .eq('id', data.id);
      
      if (updateError) {
        console.error('Erreur lors de la mise à jour de la configuration Dropbox:', updateError);
        // Fallback vers localStorage en cas d'erreur
        localStorage.setItem('dropbox_config', JSON.stringify(config));
      } else {
        console.log('Configuration Dropbox mise à jour dans Supabase');
      }
    } else {
      // Création d'une nouvelle entrée de configuration
      const newSettings: UserSettingInsert = {
        user_id: session.user.id,
        key: 'dropbox_config',
        settings: settingsObject
      };
      
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert(newSettings);
      
      if (insertError) {
        console.error('Erreur lors de la création de la configuration Dropbox:', insertError);
        // Fallback vers localStorage en cas d'erreur
        localStorage.setItem('dropbox_config', JSON.stringify(config));
      } else {
        console.log('Configuration Dropbox créée dans Supabase');
      }
    }
  } catch (e) {
    console.error('Error saving Dropbox config to Supabase:', e);
    // Fallback vers localStorage en cas d'erreur
    localStorage.setItem('dropbox_config', JSON.stringify(config));
  }
};

// Fonction modifiée pour vérifier si Dropbox est réellement configuré ET activé
export const isDropboxEnabled = async (): Promise<boolean> => {
  console.log('isDropboxEnabled - Vérification du statut Dropbox');
  
  try {
    // Vérifier d'abord dans localStorage pour une réponse rapide
    const localConfigStr = localStorage.getItem('dropbox_config');
    let localEnabled = false;
    
    if (localConfigStr) {
      try {
        const localConfig = JSON.parse(localConfigStr);
        localEnabled = !!(localConfig.isEnabled);
        console.log('isDropboxEnabled - Statut depuis localStorage:', localEnabled ? 'activé' : 'désactivé');
      } catch (e) {
        console.error('isDropboxEnabled - Erreur parsing localStorage config:', e);
      }
    }
    
    // Récupérer la configuration depuis la base de données
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.log('isDropboxEnabled - Aucune session utilisateur, utilisation de localStorage uniquement:', localEnabled ? 'activé' : 'désactivé');
      if (!localEnabled) {
        // Si pas de configuration locale ou désactivée, créer une par défaut et activée
        const defaultConfig = createDefaultConfig();
        localStorage.setItem('dropbox_config', JSON.stringify(defaultConfig));
        localEnabled = true;
        console.log('isDropboxEnabled - Configuration par défaut créée et activée');
      }
      return localEnabled;
    }
    
    // Vérifier directement dans la base de données pour les utilisateurs connectés
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', session.user.id)
      .eq('key', 'dropbox_config')
      .maybeSingle();
    
    if (error) {
      console.error('isDropboxEnabled - Erreur lors de la vérification en base de données:', error);
      if (!localEnabled) {
        // Si erreur et pas de config locale, créer une par défaut
        const defaultConfig = createDefaultConfig();
        localStorage.setItem('dropbox_config', JSON.stringify(defaultConfig));
        console.log('isDropboxEnabled - Erreur DB mais config par défaut créée et activée');
        return true;
      }
      return localEnabled;
    }
    
    // Si aucune donnée n'est trouvée, créer une configuration par défaut
    if (!data) {
      console.log('isDropboxEnabled - Pas de configuration en base de données, création d\'une configuration par défaut');
      
      const defaultConfig = createDefaultConfig();
      await saveDropboxConfig(defaultConfig);
      localStorage.setItem('dropbox_config', JSON.stringify(defaultConfig));
      
      console.log('isDropboxEnabled - Configuration par défaut créée et activée');
      return true;
    }
    
    // Vérifier si Dropbox est activé dans la base de données
    const dbSettings = data.settings as Record<string, any>;
    const dbEnabled = !!(dbSettings.isEnabled);
    console.log('isDropboxEnabled - Statut depuis base de données:', dbEnabled ? 'activé' : 'désactivé');
    
    // Si les deux sont différents, mettre à jour localStorage
    if (localEnabled !== dbEnabled) {
      console.log('isDropboxEnabled - Incohérence détectée entre localStorage et base de données, mise à jour localStorage');
      try {
        localStorage.setItem('dropbox_config', JSON.stringify({
          accessToken: dbSettings.accessToken || '',
          refreshToken: dbSettings.refreshToken || undefined,
          clientId: dbSettings.clientId || undefined,
          clientSecret: dbSettings.clientSecret || undefined,
          expiresAt: dbSettings.expiresAt || undefined,
          isEnabled: dbEnabled
        }));
      } catch (e) {
        console.error('isDropboxEnabled - Erreur mise à jour localStorage:', e);
      }
    }
    
    // Si désactivé mais devrait être activé, activer
    if (!dbEnabled) {
      console.log('isDropboxEnabled - Dropbox désactivé, activation forcée');
      const updatedConfig: DropboxConfig = {
        accessToken: dbSettings.accessToken || '',
        refreshToken: dbSettings.refreshToken || undefined,
        clientId: dbSettings.clientId || undefined,
        clientSecret: dbSettings.clientSecret || undefined,
        expiresAt: dbSettings.expiresAt || undefined,
        isEnabled: true
      };
      
      try {
        await saveDropboxConfig(updatedConfig);
        console.log('isDropboxEnabled - Dropbox forcé à activé avec succès');
        return true;
      } catch (e) {
        console.error('isDropboxEnabled - Erreur lors de l\'activation forcée:', e);
      }
    }
    
    console.log('isDropboxEnabled - Vérification du fournisseur de stockage - Dropbox activé:', true);
    return true; // Toujours retourner true car nous voulons forcer l'activation
  } catch (error) {
    console.error('isDropboxEnabled - Erreur vérification statut Dropbox:', error);
    
    // En cas d'erreur, s'assurer que Dropbox est activé
    try {
      const defaultConfig = createDefaultConfig();
      localStorage.setItem('dropbox_config', JSON.stringify(defaultConfig));
      console.log('isDropboxEnabled - Erreur mais configuration par défaut créée et activée');
    } catch (e) {
      console.error('isDropboxEnabled - Erreur avec fallback localStorage:', e);
    }
    
    return true; // En cas d'erreur complète, activer Dropbox par défaut
  }
};

// Nouvelle fonction pour vérifier si le token d'accès est expiré
export const isAccessTokenExpired = async (): Promise<boolean> => {
  const config = await getDropboxConfig();
  if (!config.expiresAt) return true;
  
  // Ajouter une marge de 5 minutes avant l'expiration réelle
  const safetyMarginMs = 5 * 60 * 1000;
  return Date.now() >= (config.expiresAt - safetyMarginMs);
};

// Fonction pour créer une configuration par défaut vide mais activée
const createDefaultConfig = (): DropboxConfig => {
  return {
    accessToken: '',
    isEnabled: true
  };
};

// Nouvelle fonction pour rafraîchir le token d'accès si nécessaire
export const refreshAccessTokenIfNeeded = async (): Promise<boolean> => {
  const config = await getDropboxConfig();
  
  // Si pas de refresh token ou pas d'identifiants client, impossible de rafraîchir
  if (!config.refreshToken || !config.clientId || !config.clientSecret) {
    return false;
  }
  
  // Si le token n'est pas expiré, pas besoin de rafraîchir
  if (config.expiresAt && Date.now() < config.expiresAt) {
    return true;
  }
  
  try {
    console.log('Rafraîchissement du token Dropbox...');
    
    const formData = new URLSearchParams();
    formData.append('grant_type', 'refresh_token');
    formData.append('refresh_token', config.refreshToken);
    formData.append('client_id', config.clientId);
    formData.append('client_secret', config.clientSecret);
    
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Échec du rafraîchissement du token:', response.status, errorText);
      return false;
    }
    
    const data = await response.json() as DropboxTokenResponse;
    
    // Mettre à jour le token et sa date d'expiration
    const updatedConfig: DropboxConfig = {
      ...config,
      accessToken: data.access_token,
      // Le nouveau token est valide pour data.expires_in secondes
      expiresAt: Date.now() + ((data.expires_in || 14400) * 1000) // 4h par défaut
    };
    
    await saveDropboxConfig(updatedConfig);
    console.log('Token Dropbox rafraîchi avec succès');
    return true;
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token Dropbox:', error);
    return false;
  }
};

// Fonction pour échanger un code d'autorisation contre des tokens
export const exchangeCodeForTokens = async (
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<DropboxTokenResponse | null> => {
  try {
    const formData = new URLSearchParams();
    formData.append('code', code);
    formData.append('grant_type', 'authorization_code');
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    formData.append('redirect_uri', redirectUri);
    
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Échec de l\'échange de code:', response.status, errorText);
      return null;
    }
    
    return await response.json() as DropboxTokenResponse;
  } catch (error) {
    console.error('Erreur lors de l\'échange de code:', error);
    return null;
  }
};

// Fonction pour générer l'URL d'autorisation avec des paramètres améliorés
export const getAuthorizationUrl = (clientId: string, redirectUri: string): string => {
  console.log("Génération d'URL d'autorisation avec:", { clientId, redirectUri });
  
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    token_access_type: 'offline',
    redirect_uri: redirectUri
  });
  
  const url = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  console.log("URL d'autorisation générée:", url);
  return url;
};

// Version modifiée de la fonction existante pour vérifier/rafraîchir le token avant utilisation
export const checkFileExistsOnDropbox = async (path: string): Promise<boolean> => {
  const config = await getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    return false;
  }
  
  // Rafraîchir le token si nécessaire
  if (await isAccessTokenExpired()) {
    const refreshed = await refreshAccessTokenIfNeeded();
    if (!refreshed) {
      console.error("Failed to refresh access token");
      return false;
    }
    // Récupérer la config mise à jour
    const updatedConfig = await getDropboxConfig();
    if (!updatedConfig.accessToken) {
      console.error("No access token available after refresh");
      return false;
    }
  }
  
  try {
    // First check if we have this file path saved in our database
    let dropboxPath = `/${path}`;
    
    try {
      const { data: fileRef, error } = await supabase
        .from('dropbox_files')
        .select('dropbox_path')
        .eq('local_id', path)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching Dropbox file reference:', error);
      } else if (fileRef) {
        dropboxPath = fileRef.dropbox_path;
        console.log('Found stored Dropbox path:', dropboxPath);
      }
    } catch (dbError) {
      console.error('Database error when fetching reference:', dbError);
    }
    
    // Get the current config to use the most recent token
    const currentConfig = await getDropboxConfig();
    
    // Check if the file exists on Dropbox using the get_metadata API
    const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentConfig.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: dropboxPath
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error checking if file exists on Dropbox:', error);
    return false;
  }
};

// Mettre à jour toutes les autres fonctions pour vérifier/rafraîchir le token avant utilisation
// Par exemple, pour uploadFileToDropbox:
export const uploadFileToDropbox = async (
  file: File,
  path: string
): Promise<string> => {
  const config = await getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    toast.error("Token d'accès Dropbox non configuré");
    throw new Error('Dropbox access token not configured');
  }
  
  // Rafraîchir le token si nécessaire
  if (await isAccessTokenExpired()) {
    const refreshed = await refreshAccessTokenIfNeeded();
    if (!refreshed) {
      console.error("Failed to refresh access token");
      toast.error("Impossible de rafraîchir le token Dropbox");
      throw new Error('Failed to refresh access token');
    }
  }
  
  console.log(`Uploading file to Dropbox: ${path}`, file);
  console.log(`File size: ${file.size} bytes, type: ${file.type}`);
  
  try {
    // Get the current config to use the most recent token
    const currentConfig = await getDropboxConfig();
    
    // Using Dropbox API v2 with fetch
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentConfig.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: `/${path}`,
          mode: 'overwrite',
          autorename: true,
          mute: false
        })
      },
      body: file
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dropbox upload error status:', response.status, response.statusText);
      console.error('Dropbox upload error details:', errorText);
      
      // More specific error messages based on status code
      if (response.status === 400) {
        toast.error("Erreur 400: Requête invalide. Vérifiez la taille du fichier et les permissions Dropbox.");
        console.error("Possible causes: invalid file format, file too large, or incorrect parameters");
      } else if (response.status === 401) {
        toast.error("Erreur 401: Token invalide ou expiré. Veuillez mettre à jour votre token Dropbox.");
      } else if (response.status === 403) {
        toast.error("Erreur 403: Accès refusé. Vérifiez les permissions de votre app Dropbox.");
      } else if (response.status === 429) {
        toast.error("Erreur 429: Trop de requêtes. Veuillez réessayer plus tard.");
      } else {
        toast.error(`Erreur Dropbox: ${response.status} ${response.statusText}`);
      }
      
      throw new Error(`Failed to upload to Dropbox: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Dropbox upload successful:', data);
    toast.success("Fichier téléchargé avec succès vers Dropbox");
    
    // Store the reference in Supabase
    try {
      // Insert using a raw query instead of the typed client
      const { error } = await supabase
        .from('dropbox_files')
        .insert({
          local_id: path,
          dropbox_path: data.path_display || `/${path}`
        });
        
      if (error) {
        console.error('Error saving Dropbox reference:', error);
        // Continue anyway since the upload succeeded
      }
    } catch (dbError) {
      console.error('Database error when saving reference:', dbError);
      // Continue anyway since the upload succeeded
    }
    
    return data.path_display || `/${path}`;
  } catch (error) {
    console.error('Error uploading to Dropbox:', error);
    toast.error("Échec de l'upload vers Dropbox. Vérifiez votre connexion et les permissions.");
    throw error;
  }
};

// De même, nous mettrions à jour getDropboxSharedLink et toutes les autres fonctions qui utilisent l'API Dropbox
// en ajoutant la logique de rafraîchissement du token

// Fonction pour récupérer un lien partagé pour un fichier sur Dropbox
export const getDropboxSharedLink = async (path: string): Promise<string> => {
  const config = await getDropboxConfig();
  
  if (!config.accessToken || !config.isEnabled) {
    console.error("Dropbox access token not configured or Dropbox is not enabled");
    throw new Error('Dropbox configuration non valide ou désactivée');
  }
  
  try {
    // First check if we have this file path saved in our database
    let dropboxPath = `/${path}`;
    
    try {
      const { data: fileRef, error } = await supabase
        .from('dropbox_files')
        .select('dropbox_path')
        .eq('local_id', path)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching Dropbox file reference:', error);
      } else if (fileRef) {
        dropboxPath = fileRef.dropbox_path;
        console.log('Found stored Dropbox path:', dropboxPath);
      }
    } catch (dbError) {
      console.error('Database error when fetching reference:', dbError);
    }
    
    const response = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: dropboxPath,
        settings: {
          requested_visibility: "public"
        }
      })
    });
    
    // If link already exists, fetch it
    if (response.status === 409) {
      console.log('Shared link already exists, fetching it');
      const listResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: dropboxPath
        })
      });
      
      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error('Failed to list shared links:', errorText);
        toast.error("Impossible de récupérer le lien de partage");
        throw new Error('Failed to list shared links');
      }
      
      const listData = await listResponse.json();
      
      if (listData.links && listData.links.length > 0) {
        // Convert the shared link to a direct download link
        let url = listData.links[0].url;
        url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        url = url.replace('?dl=0', '');
        
        return url;
      }
      
      toast.error("Aucun lien de partage trouvé");
      throw new Error('No shared links found');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dropbox shared link error:', errorText);
      toast.error("Impossible de créer un lien de partage");
      throw new Error(`Failed to create shared link: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Convert the shared link to a direct download link
    let url = data.url;
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    url = url.replace('?dl=0', '');
    
    return url;
  } catch (error) {
    console.error('Error getting Dropbox shared link:', error);
    toast.error("Impossible d'obtenir un lien de partage Dropbox");
    throw error;
  }
};

// Fonction améliorée pour migrer les fichiers audio de Supabase vers Dropbox
export const migrateFilesToDropbox = async (
  files: Array<{ id: string; file_path: string }>,
  callbacks?: {
    onProgress?: (processed: number, total: number) => void;
    onSuccess?: (fileId: string) => void;
    onError?: (fileId: string, error: string) => void;
  }
): Promise<{ success: number; failed: number; failedFiles: Array<{ id: string; error: string }> }> => {
  const config = await getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    throw new Error('Dropbox access token not configured');
  }
  
  console.log(`Starting migration of ${files.length} files from Supabase to Dropbox`);
  
  let successCount = 0;
  let failedCount = 0;
  const failedFiles: Array<{ id: string; error: string }> = [];

  // Vérifier si le fichier existe déjà dans Dropbox
  const checkFileExistsInDropbox = async (path: string): Promise<boolean> => {
    try {
      const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: `/${path}`
        })
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  };
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const processedCount = i + 1;
    
    // Appeler la callback de progression si elle existe
    if (callbacks?.onProgress) {
      callbacks.onProgress(processedCount, files.length);
    }
    
    try {
      console.log(`Processing file ${processedCount}/${files.length}: ${file.id}`);
      
      // Vérifier si le fichier existe déjà dans Dropbox
      const fileExists = await checkFileExistsInDropbox(`audio/${file.id}`);
      
      if (fileExists) {
        console.log(`File already exists in Dropbox: ${file.id}`);
        
        // Enregistrer la référence dans la base de données
        await supabase
          .from('dropbox_files')
          .upsert({
            local_id: `audio/${file.id}`,
            dropbox_path: `/audio/${file.id}`
          });
        
        successCount++;
        if (callbacks?.onSuccess) {
          callbacks.onSuccess(file.id);
        }
        continue;
      }
      
      // Télécharger le fichier depuis Supabase
      const { data: fileData, error: fileError } = await supabase.storage
        .from('audio')
        .download(file.file_path || file.id);
      
      if (fileError || !fileData) {
        console.error(`Error downloading file ${file.id} from Supabase:`, fileError);
        failedCount++;
        const errorMessage = fileError ? fileError.message : "Fichier introuvable dans Supabase";
        failedFiles.push({ id: file.id, error: errorMessage });
        
        if (callbacks?.onError) {
          callbacks.onError(file.id, errorMessage);
        }
        continue;
      }
      
      // Créer un objet File à partir du Blob
      const audioFile = new File([fileData], file.id, { 
        type: fileData.type || 'audio/mpeg' 
      });
      
      console.log(`Successfully downloaded file from Supabase: ${file.id}, size: ${audioFile.size} bytes`);
      
      // Uploader vers Dropbox
      if (audioFile.size > 0) {
        const dropboxPath = await uploadFileToDropbox(audioFile, `audio/${file.id}`);
        console.log(`Successfully uploaded ${file.id} to Dropbox: ${dropboxPath}`);
        
        successCount++;
        if (callbacks?.onSuccess) {
          callbacks.onSuccess(file.id);
        }
      } else {
        console.error(`File ${file.id} has zero size, skipping upload`);
        failedCount++;
        failedFiles.push({ id: file.id, error: "Fichier de taille nulle" });
        
        if (callbacks?.onError) {
          callbacks.onError(file.id, "Fichier de taille nulle");
        }
      }
    } catch (error) {
      console.error(`Error migrating file ${file.id}:`, error);
      failedCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      failedFiles.push({ id: file.id, error: errorMessage });
      
      if (callbacks?.onError) {
        callbacks.onError(file.id, errorMessage);
      }
    }
  }
  
  console.log(`Migration completed: ${successCount} successful, ${failedCount} failed`);
  
  return {
    success: successCount,
    failed: failedCount,
    failedFiles
  };
};

// Nouvelles fonctions pour gérer les paroles dans Dropbox

/**
 * Télécharge les paroles d'une chanson vers Dropbox
 * @param songId ID de la chanson
 * @param lyricsContent Contenu des paroles
 * @returns Chemin Dropbox des paroles
 */
export const uploadLyricsToDropbox = async (songId: string, lyricsContent: string): Promise<string> => {
  const config = await getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    toast.error("Token d'accès Dropbox non configuré");
    throw new Error('Dropbox access token not configured');
  }
  
  console.log(`Uploading lyrics for song ${songId} to Dropbox`);
  
  try {
    // Convertir le contenu des paroles en fichier
    const lyricsBlob = new Blob([lyricsContent], { type: 'text/plain' });
    const lyricsFile = new File([lyricsBlob], `${songId}_lyrics.txt`, { type: 'text/plain' });
    
    // Chemin Dropbox pour les paroles
    const path = `lyrics/${songId}`;
    
    // Utiliser la fonction existante pour télécharger le fichier
    const dropboxPath = await uploadFileToDropbox(lyricsFile, path);
    
    // Enregistrer la référence dans la base de données
    try {
      const { error } = await supabase
        .from('dropbox_files')
        .upsert({
          local_id: `lyrics/${songId}`,
          dropbox_path: dropboxPath
        });
        
      if (error) {
        console.error('Error saving lyrics reference:', error);
      }
    } catch (dbError) {
      console.error('Database error when saving lyrics reference:', dbError);
    }
    
    return dropboxPath;
  } catch (error) {
    console.error('Error uploading lyrics to Dropbox:', error);
    toast.error("Échec de l'upload des paroles vers Dropbox");
    throw error;
  }
};

/**
 * Récupère les paroles d'une chanson depuis Dropbox
 * @param songId ID de la chanson
 * @returns Contenu des paroles
 */
export const getLyricsFromDropbox = async (songId: string): Promise<string | null> => {
  const config = await getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    return null;
  }
  
  try {
    // Vérifier d'abord si nous avons déjà une référence dans la base de données
    let dropboxPath = `/lyrics/${songId}`;
    
    try {
      const { data: fileRef, error } = await supabase
        .from('dropbox_files')
        .select('dropbox_path')
        .eq('local_id', `lyrics/${songId}`)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching lyrics reference:', error);
      } else if (fileRef) {
        dropboxPath = fileRef.dropbox_path;
        console.log('Found stored Dropbox lyrics path:', dropboxPath);
      }
    } catch (dbError) {
      console.error('Database error when fetching lyrics reference:', dbError);
    }
    
    // Obtenir un lien partagé pour télécharger les paroles
    const url = await getDropboxSharedLink(dropboxPath.startsWith('/') ? dropboxPath.substring(1) : dropboxPath);
    
    // Télécharger le contenu des paroles
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Error downloading lyrics from Dropbox:', response.status, response.statusText);
      return null;
    }
    
    const lyrics = await response.text();
    return lyrics;
  } catch (error) {
    console.error('Error retrieving lyrics from Dropbox:', error);
    return null;
  }
};

/**
 * Migre les paroles de Supabase vers Dropbox
 * @param callbacks Callbacks pour suivre la progression
 * @returns Résultats de la migration
 */
export const migrateLyricsToDropbox = async (
  callbacks?: {
    onProgress?: (processed: number, total: number) => void;
    onSuccess?: (songId: string) => void;
    onError?: (songId: string, error: string) => void;
  }
): Promise<{ success: number; failed: number; failedItems: Array<{ id: string; error: string }> }> => {
  const config = await getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    throw new Error('Dropbox access token not configured');
  }
  
  console.log('Starting migration of lyrics from Supabase to Dropbox');
  
  try {
    // Récupérer toutes les paroles stockées dans Supabase
    const { data: lyrics, error } = await supabase
      .from('lyrics')
      .select('song_id, content');
    
    if (error) {
      console.error('Error fetching lyrics from Supabase:', error);
      throw error;
    }
    
    if (!lyrics || lyrics.length === 0) {
      console.log('No lyrics found in Supabase');
      return { success: 0, failed: 0, failedItems: [] };
    }
    
    console.log(`Found ${lyrics.length} lyrics to migrate`);
    
    let successCount = 0;
    let failedCount = 0;
    const failedItems: Array<{ id: string; error: string }> = [];
    
    for (let i = 0; i < lyrics.length; i++) {
      const lyric = lyrics[i];
      const processedCount = i + 1;
      
      // Appeler la callback de progression si elle existe
      if (callbacks?.onProgress) {
        callbacks.onProgress(processedCount, lyrics.length);
      }
      
      try {
        console.log(`Processing lyrics ${processedCount}/${lyrics.length}: ${lyric.song_id}`);
        
        // Vérifier si les paroles existent déjà dans Dropbox
        const fileExists = await checkFileExistsOnDropbox(`lyrics/${lyric.song_id}`);
        
        if (fileExists) {
          console.log(`Lyrics already exist in Dropbox: ${lyric.song_id}`);
          successCount++;
          if (callbacks?.onSuccess) {
            callbacks.onSuccess(lyric.song_id);
          }
          continue;
        }
        
        // Télécharger les paroles vers Dropbox
        if (lyric.content) {
          await uploadLyricsToDropbox(lyric.song_id, lyric.content);
          console.log(`Successfully uploaded lyrics for ${lyric.song_id} to Dropbox`);
          
          successCount++;
          if (callbacks?.onSuccess) {
            callbacks.onSuccess(lyric.song_id);
          }
        } else {
          console.error(`Lyrics for ${lyric.song_id} are empty, skipping upload`);
          failedCount++;
          failedItems.push({ id: lyric.song_id, error: "Paroles vides" });
          
          if (callbacks?.onError) {
            callbacks.onError(lyric.song_id, "Paroles vides");
          }
        }
      } catch (error) {
        console.error(`Error migrating lyrics for ${lyric.song_id}:`, error);
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        failedItems.push({ id: lyric.song_id, error: errorMessage });
        
        if (callbacks?.onError) {
          callbacks.onError(lyric.song_id, errorMessage);
        }
      }
    }
    
    console.log(`Lyrics migration completed: ${successCount} successful, ${failedCount} failed`);
    
    return {
      success: successCount,
      failed: failedCount,
      failedItems
    };
  } catch (error) {
    console.error('Error migrating lyrics to Dropbox:', error);
    throw error;
  }
};
