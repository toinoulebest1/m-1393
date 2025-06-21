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

// Fonction pour vérifier si le token est valide
export const validateDropboxToken = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(null)
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error validating Dropbox token:', error);
    return false;
  }
};

// Fonction simplifiée pour convertir le chemin local vers le chemin Dropbox à la racine
const getDropboxPath = (localPath: string): string => {
  console.log('🔍 Conversion chemin:', localPath);
  
  // Si le chemin commence par 'audio/', on extrait juste le nom du fichier
  if (localPath.startsWith('audio/')) {
    const filename = localPath.replace('audio/', '');
    const dropboxPath = `/${filename}`;
    console.log('📂 Chemin audio converti (racine):', dropboxPath);
    return dropboxPath;
  }
  
  // Si le chemin commence par 'lyrics/', on extrait le nom et ajoute un préfixe
  if (localPath.startsWith('lyrics/')) {
    const filename = localPath.replace('lyrics/', '');
    const dropboxPath = `/lyrics_${filename}`;
    console.log('📝 Chemin lyrics converti (racine):', dropboxPath);
    return dropboxPath;
  }
  
  // Si c'est juste un ID (UUID format), on le met directement à la racine
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(localPath)) {
    const dropboxPath = `/${localPath}`;
    console.log('🎵 ID converti en chemin racine:', dropboxPath);
    return dropboxPath;
  }
  
  // Si le chemin ne commence pas par '/', on l'ajoute (racine)
  if (!localPath.startsWith('/')) {
    const dropboxPath = `/${localPath}`;
    console.log('🎶 Chemin converti vers racine:', dropboxPath);
    return dropboxPath;
  }
  
  console.log('🔄 Chemin utilisé tel quel:', localPath);
  return localPath;
};

// Function to check if a file exists on Dropbox
export const checkFileExistsOnDropbox = async (path: string): Promise<boolean> => {
  const config = getDropboxConfig();
  
  if (!config.accessToken) {
    console.error("Dropbox access token not configured");
    return false;
  }
  
  // Vérifier la validité du token avant de l'utiliser
  const isTokenValid = await validateDropboxToken(config.accessToken);
  if (!isTokenValid) {
    console.error("Dropbox token is expired or invalid");
    toast.error("Token Dropbox expiré ou invalide. Veuillez le renouveler.");
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

// Fonction avec retry et gestion d'erreurs améliorée
const uploadToDropboxWithRetry = async (
  file: File,
  dropboxPath: string,
  accessToken: string,
  maxRetries: number = 3
): Promise<any> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tentative ${attempt}/${maxRetries} d'upload vers Dropbox: ${dropboxPath}`);
      
      // Attendre un délai croissant entre les tentatives
      if (attempt > 1) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Backoff exponentiel
        console.log(`Attente de ${delay}ms avant la tentative ${attempt}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Upload réussi à la tentative ${attempt}:`, data);
        return data;
      }
      
      const errorText = await response.text();
      console.error(`❌ Échec tentative ${attempt}:`, response.status, response.statusText, errorText);
      
      // Si c'est une erreur 429 (rate limit), attendre plus longtemps
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limit atteint, attente de ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Si c'est une erreur 401 (token expiré), arrêter immédiatement
      if (response.status === 401) {
        throw new Error('Token Dropbox expiré ou invalide');
      }
      
      lastError = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      
    } catch (error) {
      console.error(`❌ Erreur à la tentative ${attempt}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Si c'est une erreur de réseau ou CORS, arrêter immédiatement
      if (error instanceof TypeError && error.message.includes('NetworkError')) {
        throw new Error('Erreur CORS ou réseau - impossible d\'accéder à Dropbox depuis le navigateur');
      }
    }
  }
  
  throw lastError || new Error('Échec après plusieurs tentatives');
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
  
  // Vérifier la validité du token avant de l'utiliser
  const isTokenValid = await validateDropboxToken(config.accessToken);
  if (!isTokenValid) {
    console.error("Dropbox token is expired or invalid");
    toast.error("Token Dropbox expiré ou invalide. Veuillez le renouveler.");
    throw new Error('Dropbox token is expired or invalid');
  }
  
  // Convertir le chemin local vers le chemin Dropbox réel
  const dropboxPath = getDropboxPath(path);
  
  console.log(`Upload vers Dropbox: ${dropboxPath}`, file);
  console.log(`Taille fichier: ${file.size} bytes, type: ${file.type}`);
  
  try {
    // Utiliser la fonction avec retry
    const data = await uploadToDropboxWithRetry(file, dropboxPath, config.accessToken);
    
    console.log('✅ Upload Dropbox réussi:', data);
    toast.success("Fichier téléchargé avec succès vers Dropbox");
    
    // Store the reference in Supabase
    try {
      const { error } = await supabase
        .from('dropbox_files')
        .upsert({
          local_id: path,
          dropbox_path: data.path_display || dropboxPath
        });
        
      if (error) {
        console.error('Error saving Dropbox reference:', error);
      }
    } catch (dbError) {
      console.error('Database error when saving reference:', dbError);
    }
    
    return data.path_display || dropboxPath;
  } catch (error) {
    console.error('❌ Échec final upload Dropbox:', error);
    
    // Messages d'erreur plus spécifiques
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('CORS') || errorMessage.includes('NetworkError')) {
      toast.error("Erreur CORS - Dropbox ne peut pas être utilisé directement depuis le navigateur");
    } else if (errorMessage.includes('429')) {
      toast.error("Limite de taux Dropbox atteinte - veuillez réessayer plus tard");
    } else if (errorMessage.includes('401') || errorMessage.includes('expiré')) {
      toast.error("Token Dropbox expiré - veuillez le renouveler dans les paramètres");
    } else {
      toast.error(`Échec de l'upload Dropbox: ${errorMessage}`);
    }
    
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
