import { DropboxConfig, DropboxFileReference } from '@/types/dropbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

// Fonction pour convertir le chemin local vers le chemin Dropbox réel
const getDropboxPath = (localPath: string): string => {
  // Si le chemin commence par 'audio/', on le convertit vers la structure réelle
  if (localPath.startsWith('audio/')) {
    const filename = localPath.replace('audio/', '');
    return `/home/tux com/audio/${filename}`;
  }
  
  // Si le chemin commence par 'lyrics/', on le convertit également
  if (localPath.startsWith('lyrics/')) {
    const filename = localPath.replace('lyrics/', '');
    return `/home/tux com/lyrics/${filename}`;
  }
  
  // Si le chemin ne commence pas par '/', on l'ajoute
  if (!localPath.startsWith('/')) {
    return `/${localPath}`;
  }
  
  return localPath;
};

// Function to check if a file exists on Dropbox
export const checkFileExistsOnDropbox = async (path: string): Promise<boolean> => {
  const config = getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    return false;
  }
  
  try {
    // Convertir le chemin local vers le chemin Dropbox réel
    let dropboxPath = getDropboxPath(path);
    
    // Vérifier d'abord si nous avons ce chemin sauvegardé dans notre base de données
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
    
    console.log(`🔍 Vérification existence fichier Dropbox: ${dropboxPath}`);
    
    // Check if the file exists on Dropbox using the get_metadata API
    const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: dropboxPath
      })
    });
    
    if (response.ok) {
      console.log('✅ Fichier existe sur Dropbox:', dropboxPath);
      return true;
    } else {
      const errorData = await response.json();
      console.warn('⚠️ Fichier non trouvé sur Dropbox:', dropboxPath, errorData);
      return false;
    }
  } catch (error) {
    console.error('Error checking if file exists on Dropbox:', error);
    return false;
  }
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
  
  // Convertir le chemin local vers le chemin Dropbox réel
  const dropboxPath = getDropboxPath(path);
  
  console.log(`Uploading file to Dropbox: ${dropboxPath}`, file);
  console.log(`File size: ${file.size} bytes, type: ${file.type}`);
  
  try {
    // Using Dropbox API v2 with fetch
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
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
        .upsert({
          local_id: path,
          dropbox_path: data.path_display || dropboxPath
        });
        
      if (error) {
        console.error('Error saving Dropbox reference:', error);
        // Continue anyway since the upload succeeded
      }
    } catch (dbError) {
      console.error('Database error when saving reference:', dbError);
      // Continue anyway since the upload succeeded
    }
    
    return data.path_display || dropboxPath;
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
    // Convertir le chemin local vers le chemin Dropbox réel
    let dropboxPath = getDropboxPath(path);
    
    // Vérifier d'abord si nous avons ce chemin sauvegardé dans notre base de données
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
    
    console.log(`🔗 Récupération lien partagé pour: ${dropboxPath}`);
    
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
        console.error('❌ Failed to list shared links:', errorText);
        
        // Parse l'erreur pour voir si c'est un fichier non trouvé
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.path && errorData.error.path['.tag'] === 'not_found') {
            throw new Error(`File not found on Dropbox: ${dropboxPath}`);
          }
        } catch (parseError) {
          // Ignore parse error, throw original error
        }
        
        throw new Error(`Failed to list shared links: ${listResponse.status} ${listResponse.statusText}`);
      }
      
      const listData = await listResponse.json();
      
      if (listData.links && listData.links.length > 0) {
        // Convert the shared link to a direct download link
        let url = listData.links[0].url;
        url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        url = url.replace('?dl=0', '');
        
        console.log('✅ URL partagée Dropbox récupérée:', url);
        return url;
      }
      
      throw new Error('No shared links found for this file');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dropbox shared link error:', errorText);
      
      // Parse l'erreur pour des messages plus clairs
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && errorData.error.path && errorData.error.path['.tag'] === 'not_found') {
          throw new Error(`File not found on Dropbox: ${dropboxPath}`);
        }
      } catch (parseError) {
        // Ignore parse error, throw original error
      }
      
      throw new Error(`Failed to create shared link: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Convert the shared link to a direct download link
    let url = data.url;
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    url = url.replace('?dl=0', '');
    
    console.log('✅ URL partagée Dropbox créée:', url);
    return url;
  } catch (error) {
    console.error('Error getting Dropbox shared link:', error);
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
      const dropboxPath = getDropboxPath(`audio/${path}`);
      const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: dropboxPath
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
      const fileExists = await checkFileExistsInDropbox(file.id);
      
      if (fileExists) {
        console.log(`File already exists in Dropbox: ${file.id}`);
        
        // Enregistrer la référence dans la base de données avec le bon chemin
        const dropboxPath = getDropboxPath(`audio/${file.id}`);
        await supabase
          .from('dropbox_files')
          .upsert({
            local_id: `audio/${file.id}`,
            dropbox_path: dropboxPath
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

/**
 * Télécharge les paroles d'une chanson vers Dropbox
 * @param songId ID de la chanson
 * @param lyricsContent Contenu des paroles
 * @returns Chemin Dropbox des paroles
 */
export const uploadLyricsToDropbox = async (songId: string, lyricsContent: string): Promise<string> => {
  const config = getDropboxConfig();
  
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
    
    // Chemin local pour les paroles
    const path = `lyrics/${songId}`;
    
    // Utiliser la fonction existante pour télécharger le fichier
    const dropboxPath = await uploadFileToDropbox(lyricsFile, path);
    
    // Enregistrer la référence dans la base de données
    try {
      const { error } = await supabase
        .from('dropbox_files')
        .upsert({
          local_id: path,
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
  const config = getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    return null;
  }
  
  try {
    // Convertir le chemin local vers le chemin Dropbox réel
    let dropboxPath = getDropboxPath(`lyrics/${songId}`);
    
    // Vérifier d'abord si nous avons déjà une référence dans la base de données
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
  const config = getDropboxConfig();
  
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
