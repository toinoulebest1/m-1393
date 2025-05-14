import { DropboxConfig, DropboxFileReference } from '@/types/dropbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Add a simple local storage helper for Dropbox configuration
export const getDropboxConfig = (): DropboxConfig => {
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
};

export const saveDropboxConfig = (config: DropboxConfig): void => {
  localStorage.setItem('dropbox_config', JSON.stringify(config));
};

export const isDropboxEnabled = (): boolean => {
  const config = getDropboxConfig();
  return config.isEnabled && !!config.accessToken;
};

// Function to upload a file to Dropbox
export const uploadFileToDropbox = async (
  file: File,
  path: string
): Promise<string> => {
  const config = getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    toast.error("Token d'accès Dropbox non configuré");
    throw new Error('Dropbox access token not configured');
  }
  
  console.log(`Uploading file to Dropbox: ${path}`, file);
  console.log(`File size: ${file.size} bytes, type: ${file.type}`);
  
  try {
    // Using Dropbox API v2 with fetch
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
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

// Function to get a shared link for a file on Dropbox
export const getDropboxSharedLink = async (path: string): Promise<string> => {
  const config = getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    toast.error("Token d'accès Dropbox non configuré");
    throw new Error('Dropbox access token not configured');
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
  const config = getDropboxConfig();
  
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
      
      // Uploader vers Dropbox
      const dropboxPath = await uploadFileToDropbox(audioFile, `audio/${file.id}`);
      console.log(`Successfully uploaded ${file.id} to Dropbox: ${dropboxPath}`);
      
      successCount++;
      if (callbacks?.onSuccess) {
        callbacks.onSuccess(file.id);
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
