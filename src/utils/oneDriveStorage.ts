
import { OneDriveConfig, OneDriveFileReference } from '@/types/onedrive';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Helper pour la configuration OneDrive
export const getOneDriveConfig = (): OneDriveConfig => {
  const configStr = localStorage.getItem('onedrive_config');
  if (!configStr) {
    return { accessToken: '', refreshToken: '', isEnabled: false };
  }
  
  try {
    return JSON.parse(configStr) as OneDriveConfig;
  } catch (e) {
    console.error('Error parsing OneDrive config:', e);
    return { accessToken: '', refreshToken: '', isEnabled: false };
  }
};

export const saveOneDriveConfig = (config: OneDriveConfig): void => {
  localStorage.setItem('onedrive_config', JSON.stringify(config));
};

export const isOneDriveEnabled = (): boolean => {
  const config = getOneDriveConfig();
  return config.isEnabled && !!config.accessToken;
};

// Fonction pour actualiser le token si nécessaire
export const refreshOneDriveToken = async (): Promise<string | null> => {
  const config = getOneDriveConfig();
  
  if (!config.refreshToken) {
    console.error("OneDrive refresh token not configured");
    return null;
  }
  
  try {
    const clientId = 'YOUR_CLIENT_ID'; // Remplacer par votre Client ID
    const clientSecret = 'YOUR_CLIENT_SECRET'; // Remplacer par votre Client Secret
    const redirectUri = window.location.origin + '/onedrive-callback';
    
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
        redirect_uri: redirectUri
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to refresh OneDrive token:', errorText);
      return null;
    }
    
    const data = await response.json();
    
    // Mise à jour du token dans la configuration
    saveOneDriveConfig({
      ...config,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || config.refreshToken
    });
    
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing OneDrive token:', error);
    return null;
  }
};

// Vérifier si un fichier existe sur OneDrive
export const checkFileExistsOnOneDrive = async (path: string): Promise<boolean> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    return false;
  }
  
  try {
    // D'abord, vérifier si nous avons ce chemin de fichier enregistré dans notre base de données
    let onedrivePath = `/app/${path}`;
    
    try {
      const { data: fileRef, error } = await supabase
        .from('onedrive_files')
        .select('onedrive_path')
        .eq('local_id', path)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching OneDrive file reference:', error);
      } else if (fileRef) {
        onedrivePath = fileRef.onedrive_path;
        console.log('Found stored OneDrive path:', onedrivePath);
      }
    } catch (dbError) {
      console.error('Database error when fetching reference:', dbError);
    }
    
    // Vérifier si le fichier existe sur OneDrive en utilisant l'API Graph
    const encodedPath = encodeURIComponent(onedrivePath);
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodedPath}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });
    
    if (response.status === 401) {
      // Token expiré, essayer de le rafraîchir
      const newToken = await refreshOneDriveToken();
      if (newToken) {
        // Réessayer avec le nouveau token
        const retryResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodedPath}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newToken}`
          }
        });
        
        return retryResponse.ok;
      }
      return false;
    }
    
    return response.ok;
  } catch (error) {
    console.error('Error checking if file exists on OneDrive:', error);
    return false;
  }
};

// Fonction pour télécharger un fichier vers OneDrive
export const uploadFileToOneDrive = async (
  file: File,
  path: string
): Promise<string> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    toast.error("Token d'accès OneDrive non configuré");
    throw new Error('OneDrive access token not configured');
  }
  
  console.log(`Uploading file to OneDrive: ${path}`, file);
  console.log(`File size: ${file.size} bytes, type: ${file.type}`);
  
  try {
    // Chemin complet du fichier sur OneDrive
    const onedrivePath = `/app/${path}`;
    
    // Pour les fichiers de moins de 4 Mo, utiliser l'upload simple
    if (file.size < 4 * 1024 * 1024) {
      // Première étape : créer le dossier parent si nécessaire
      const folderPath = onedrivePath.substring(0, onedrivePath.lastIndexOf('/'));
      
      try {
        // Créer le dossier parent récursivement
        await createFolderPath(folderPath);
      } catch (folderError) {
        console.error('Error creating parent folders:', folderError);
        // Continue anyway, the upload might still succeed
      }
      
      // Upload du fichier
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(onedrivePath)}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });
      
      if (response.status === 401) {
        // Token expiré, essayer de le rafraîchir
        const newToken = await refreshOneDriveToken();
        if (newToken) {
          // Réessayer avec le nouveau token
          const retryResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(onedrivePath)}:/content`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
          });
          
          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw new Error(`Failed to upload to OneDrive after token refresh: ${retryResponse.status} ${retryResponse.statusText} - ${errorText}`);
          }
          
          const data = await retryResponse.json();
          
          // Stocker la référence dans Supabase
          await storeFileReference(path, data.id, data.name);
          
          return data.webUrl || onedrivePath;
        }
        
        throw new Error('Failed to refresh OneDrive token');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload to OneDrive: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Stocker la référence dans Supabase
      await storeFileReference(path, data.id, data.name);
      
      return data.webUrl || onedrivePath;
    } else {
      // Pour les fichiers plus grands, implémenter l'upload en plusieurs parties ici
      // Cette partie est plus complexe et nécessite la création d'une session d'upload
      throw new Error('Large file upload not implemented yet');
    }
  } catch (error) {
    console.error('Error uploading to OneDrive:', error);
    toast.error("Échec de l'upload vers OneDrive. Vérifiez votre connexion et les permissions.");
    throw error;
  }
};

// Fonction auxiliaire pour créer un chemin de dossier récursivement
const createFolderPath = async (path: string): Promise<void> => {
  if (!path || path === '/' || path === '') return;
  
  const config = getOneDriveConfig();
  if (!config.accessToken) return;
  
  const folders = path.split('/').filter(f => f);
  let currentPath = '';
  
  for (const folder of folders) {
    currentPath = currentPath ? `${currentPath}/${folder}` : `/${folder}`;
    
    // Vérifier si le dossier existe déjà
    const checkResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(currentPath)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });
    
    // Si le dossier n'existe pas, le créer
    if (!checkResponse.ok) {
      const createResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folder,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail'
        })
      });
      
      if (!createResponse.ok && createResponse.status !== 409) {
        // Ignorer l'erreur de conflit (409) si le dossier existe déjà
        const errorText = await createResponse.text();
        console.warn(`Conflict when creating folder: ${currentPath}`, errorText);
      }
    }
  }
};

// Fonction pour stocker la référence de fichier dans Supabase
const storeFileReference = async (localPath: string, fileId: string, fileName: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('onedrive_files')
      .insert({
        local_id: localPath,
        onedrive_path: `/app/${localPath}`,
        file_id: fileId,
        file_name: fileName
      });
      
    if (error) {
      console.error('Error saving OneDrive reference:', error);
    }
  } catch (dbError) {
    console.error('Database error when saving OneDrive reference:', dbError);
  }
};

// Fonction pour obtenir un lien partagé pour un fichier sur OneDrive
export const getOneDriveSharedLink = async (path: string): Promise<string> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    toast.error("Token d'accès OneDrive non configuré");
    throw new Error('OneDrive access token not configured');
  }
  
  try {
    // D'abord, vérifier si nous avons ce chemin de fichier enregistré dans notre base de données
    let onedrivePath = `/app/${path}`;
    let fileId = '';
    
    try {
      const { data: fileRef, error } = await supabase
        .from('onedrive_files')
        .select('onedrive_path, file_id')
        .eq('local_id', path)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching OneDrive file reference:', error);
      } else if (fileRef) {
        onedrivePath = fileRef.onedrive_path;
        fileId = fileRef.file_id;
        console.log('Found stored OneDrive path:', onedrivePath);
      }
    } catch (dbError) {
      console.error('Database error when fetching reference:', dbError);
    }
    
    // Si nous avons un ID de fichier, l'utiliser directement
    let apiPath = fileId 
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/createLink` 
      : `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(onedrivePath)}:/createLink`;
    
    const response = await fetch(apiPath, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'view',
        scope: 'anonymous'
      })
    });
    
    if (response.status === 401) {
      // Token expiré, essayer de le rafraîchir
      const newToken = await refreshOneDriveToken();
      if (newToken) {
        // Réessayer avec le nouveau token
        const retryResponse = await fetch(apiPath, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'view',
            scope: 'anonymous'
          })
        });
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          throw new Error(`Failed to create shared link after token refresh: ${retryResponse.status} ${retryResponse.statusText} - ${errorText}`);
        }
        
        const data = await retryResponse.json();
        return data.link.webUrl;
      }
      
      throw new Error('Failed to refresh OneDrive token');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create shared link: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.link.webUrl;
  } catch (error) {
    console.error('Error getting OneDrive shared link:', error);
    toast.error("Impossible d'obtenir un lien de partage OneDrive");
    throw error;
  }
};

// Fonction pour migrer les fichiers audio de Supabase vers OneDrive
export const migrateFilesToOneDrive = async (
  files: Array<{ id: string; file_path: string }>,
  callbacks?: {
    onProgress?: (processed: number, total: number) => void;
    onSuccess?: (fileId: string) => void;
    onError?: (fileId: string, error: string) => void;
  }
): Promise<{ success: number; failed: number; failedFiles: Array<{ id: string; error: string }> }> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    throw new Error('OneDrive access token not configured');
  }
  
  console.log(`Starting migration of ${files.length} files from Supabase to OneDrive`);
  
  let successCount = 0;
  let failedCount = 0;
  const failedFiles: Array<{ id: string; error: string }> = [];

  // Vérifier si le fichier existe déjà dans OneDrive
  const checkFileExistsInOneDrive = async (path: string): Promise<boolean> => {
    return await checkFileExistsOnOneDrive(path);
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
      
      // Vérifier si le fichier existe déjà dans OneDrive
      const fileExists = await checkFileExistsInOneDrive(`audio/${file.id}`);
      
      if (fileExists) {
        console.log(`File already exists in OneDrive: ${file.id}`);
        
        // Enregistrer la référence dans la base de données si elle n'existe pas déjà
        try {
          const { data, error } = await supabase
            .from('onedrive_files')
            .select('id')
            .eq('local_id', `audio/${file.id}`)
            .maybeSingle();
            
          if (error) {
            console.error(`Error checking OneDrive reference for ${file.id}:`, error);
          } else if (!data) {
            // La référence n'existe pas, l'ajouter
            await supabase
              .from('onedrive_files')
              .upsert({
                local_id: `audio/${file.id}`,
                onedrive_path: `/app/audio/${file.id}`
              });
          }
        } catch (dbError) {
          console.error('Database error when checking reference:', dbError);
        }
        
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
      
      // Uploader vers OneDrive
      if (audioFile.size > 0) {
        try {
          await uploadFileToOneDrive(audioFile, `audio/${file.id}`);
          console.log(`Successfully uploaded ${file.id} to OneDrive`);
          
          successCount++;
          if (callbacks?.onSuccess) {
            callbacks.onSuccess(file.id);
          }
        } catch (uploadError) {
          console.error(`Error uploading file ${file.id} to OneDrive:`, uploadError);
          failedCount++;
          const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
          failedFiles.push({ id: file.id, error: errorMessage });
          
          if (callbacks?.onError) {
            callbacks.onError(file.id, errorMessage);
          }
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

// Fonctions pour gérer les paroles dans OneDrive
export const uploadLyricsToOneDrive = async (songId: string, lyricsContent: string): Promise<string> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    toast.error("Token d'accès OneDrive non configuré");
    throw new Error('OneDrive access token not configured');
  }
  
  console.log(`Uploading lyrics for song ${songId} to OneDrive`);
  
  try {
    // Convertir le contenu des paroles en fichier
    const lyricsBlob = new Blob([lyricsContent], { type: 'text/plain' });
    const lyricsFile = new File([lyricsBlob], `${songId}_lyrics.txt`, { type: 'text/plain' });
    
    // Chemin OneDrive pour les paroles
    const path = `lyrics/${songId}`;
    
    // Utiliser la fonction existante pour télécharger le fichier
    const onedrivePath = await uploadFileToOneDrive(lyricsFile, path);
    
    return onedrivePath;
  } catch (error) {
    console.error('Error uploading lyrics to OneDrive:', error);
    toast.error("Échec de l'upload des paroles vers OneDrive");
    throw error;
  }
};

export const getLyricsFromOneDrive = async (songId: string): Promise<string | null> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    return null;
  }
  
  try {
    // Vérifier d'abord si nous avons déjà une référence dans la base de données
    let onedrivePath = `/app/lyrics/${songId}`;
    let fileId = '';
    
    try {
      const { data: fileRef, error } = await supabase
        .from('onedrive_files')
        .select('onedrive_path, file_id')
        .eq('local_id', `lyrics/${songId}`)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching lyrics reference:', error);
      } else if (fileRef) {
        onedrivePath = fileRef.onedrive_path;
        fileId = fileRef.file_id;
        console.log('Found stored OneDrive lyrics path:', onedrivePath);
      }
    } catch (dbError) {
      console.error('Database error when fetching lyrics reference:', dbError);
    }
    
    // Utiliser l'API Graph pour récupérer le contenu du fichier
    let apiPath = fileId 
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`
      : `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(onedrivePath)}:/content`;
    
    const response = await fetch(apiPath, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });
    
    if (response.status === 401) {
      // Token expiré, essayer de le rafraîchir
      const newToken = await refreshOneDriveToken();
      if (newToken) {
        // Réessayer avec le nouveau token
        const retryResponse = await fetch(apiPath, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newToken}`
          }
        });
        
        if (!retryResponse.ok) {
          console.error('Error downloading lyrics from OneDrive after token refresh:', retryResponse.status, retryResponse.statusText);
          return null;
        }
        
        const lyrics = await retryResponse.text();
        return lyrics;
      }
      
      return null;
    }
    
    if (!response.ok) {
      console.error('Error downloading lyrics from OneDrive:', response.status, response.statusText);
      return null;
    }
    
    const lyrics = await response.text();
    return lyrics;
  } catch (error) {
    console.error('Error retrieving lyrics from OneDrive:', error);
    return null;
  }
};

export const migrateLyricsToOneDrive = async (
  callbacks?: {
    onProgress?: (processed: number, total: number) => void;
    onSuccess?: (songId: string) => void;
    onError?: (songId: string, error: string) => void;
  }
): Promise<{ success: number; failed: number; failedItems: Array<{ id: string; error: string }> }> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    throw new Error('OneDrive access token not configured');
  }
  
  console.log('Starting migration of lyrics from Supabase to OneDrive');
  
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
        
        // Vérifier si les paroles existent déjà dans OneDrive
        const fileExists = await checkFileExistsOnOneDrive(`lyrics/${lyric.song_id}`);
        
        if (fileExists) {
          console.log(`Lyrics already exist in OneDrive: ${lyric.song_id}`);
          successCount++;
          if (callbacks?.onSuccess) {
            callbacks.onSuccess(lyric.song_id);
          }
          continue;
        }
        
        // Télécharger les paroles vers OneDrive
        if (lyric.content) {
          await uploadLyricsToOneDrive(lyric.song_id, lyric.content);
          console.log(`Successfully uploaded lyrics for ${lyric.song_id} to OneDrive`);
          
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
    console.error('Error migrating lyrics to OneDrive:', error);
    throw error;
  }
};
