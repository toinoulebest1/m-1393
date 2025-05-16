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

export const isDropboxEnabled = async (): Promise<boolean> => {
  try {
    console.log("Vérification si Dropbox est activé...");
    
    // Vérifier d'abord la configuration locale
    const localConfig = getDropboxConfig();
    console.log("Configuration locale Dropbox:", localConfig);
    
    // Si la configuration locale indique que Dropbox est activé, on peut utiliser cette information
    // pour une réponse immédiate, tout en vérifiant avec le serveur en arrière-plan
    if (localConfig.isEnabled) {
      // Toujours vérifier avec le serveur en arrière-plan pour rester synchronisé
      checkAndUpdateDropboxStatus().catch(err => 
        console.error("Erreur lors de la vérification en arrière-plan:", err)
      );
      return true;
    }
    
    // Si la configuration locale indique que Dropbox n'est pas activé,
    // on vérifie avec le serveur pour être sûr
    const status = await checkAndUpdateDropboxStatus();
    return status;
  } catch (error) {
    console.error("Erreur lors de la vérification du statut Dropbox:", error);
    // En cas d'erreur, se rabattre sur la configuration locale
    return getDropboxConfig().isEnabled;
  }
};

// Nouvelle fonction pour vérifier et mettre à jour le statut Dropbox
export const checkAndUpdateDropboxStatus = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('dropbox-config', {
      method: 'GET',
    });
    
    console.log("Réponse du serveur dropbox-config:", { data, error });
    
    if (error) {
      console.error("Erreur lors de la vérification du serveur:", error);
      return getDropboxConfig().isEnabled;
    }
    
    if (data && typeof data.isEnabled === 'boolean') {
      console.log("Statut Dropbox selon le serveur:", data.isEnabled);
      
      // Mettre à jour la configuration locale
      saveDropboxConfig({
        accessToken: '',
        isEnabled: data.isEnabled
      });
      
      return data.isEnabled;
    }
    
    return getDropboxConfig().isEnabled;
  } catch (serverError) {
    console.error("Exception lors de la vérification du serveur:", serverError);
    return getDropboxConfig().isEnabled;
  }
};

// Function to check if a file exists on Dropbox
export const checkFileExistsOnDropbox = async (path: string): Promise<boolean> => {
  try {
    // D'abord vérifier si Dropbox est activé
    const dropboxEnabled = await isDropboxEnabled();
    console.log(`Dropbox activé: ${dropboxEnabled} pour le chemin: ${path}`);
    
    if (!dropboxEnabled) {
      return false;
    }

    // First check if we have this file path saved in our database
    let dropboxPath = path.startsWith('/') ? path : `/${path}`;
    
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
    
    // Utiliser l'edge function pour vérifier si le fichier existe
    const { data, error } = await supabase.functions.invoke('dropbox-storage', {
      method: 'POST',
      body: {
        action: 'check',
        path: dropboxPath.startsWith('/') ? dropboxPath.substring(1) : dropboxPath
      }
    });
    
    if (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
    
    return data?.exists || false;
  } catch (error) {
    console.error('Error checking if file exists on Dropbox:', error);
    return false;
  }
};

// Function to get a shared link for a file on Dropbox
export const getDropboxSharedLink = async (path: string): Promise<string> => {
  try {
    // Vérifier si Dropbox est activé
    const dropboxEnabled = await isDropboxEnabled();
    console.log(`Dropbox activé: ${dropboxEnabled} pour le chemin: ${path}`);
    
    if (!dropboxEnabled) {
      throw new Error('Dropbox n\'est pas activé');
    }

    // First check if we have this file path saved in our database
    let dropboxPath = path;
    
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
    
    console.log(`Demande de l'URL pour le chemin: ${dropboxPath}`);
    
    // Ensure the path is properly formatted
    const formattedPath = dropboxPath.startsWith('/') 
      ? dropboxPath.substring(1) 
      : dropboxPath;
    
    console.log(`Chemin formaté pour la requête: ${formattedPath}`);
    
    // Vérifier d'abord si le fichier existe
    const { data: existCheck, error: existError } = await supabase.functions.invoke('dropbox-storage', {
      method: 'POST',
      body: {
        action: 'check',
        path: formattedPath
      }
    });
    
    if (existError || !existCheck?.exists) {
      console.error(`Fichier non trouvé: ${formattedPath}`, existError);
      throw new Error(`Le fichier ${formattedPath} n'existe pas sur Dropbox`);
    }
    
    // Utiliser l'edge function pour récupérer l'URL
    const { data, error } = await supabase.functions.invoke('dropbox-storage', {
      method: 'POST',
      body: {
        action: 'get',
        path: formattedPath
      }
    });
    
    console.log("Réponse de dropbox-storage:", { data, error });
    
    if (error) {
      console.error("Erreur avec dropbox-storage:", error);
      throw new Error(`Erreur lors de la récupération du lien: ${error.message || JSON.stringify(error)}`);
    }
    
    if (!data?.url) {
      console.error("Pas d'URL dans la réponse");
      throw new Error('URL manquante dans la réponse');
    }
    
    console.log(`URL partagée obtenue: ${data.url}`);
    return data.url;
  } catch (error) {
    console.error('Error getting Dropbox shared link:', error);
    toast.error("Impossible d'obtenir un lien de partage Dropbox");
    throw error;
  }
};

// Fonction pour récupérer les paroles depuis Dropbox
export const getLyricsFromDropbox = async (songId: string): Promise<string | null> => {
  try {
    // Vérifier si Dropbox est activé
    const dropboxEnabled = await isDropboxEnabled();
    if (!dropboxEnabled) {
      return null;
    }
    
    // Utiliser l'edge function pour récupérer les paroles
    const { data, error } = await supabase.functions.invoke('dropbox-storage', {
      method: 'GET',
      body: {
        action: 'get-lyrics',
        songId
      }
    });
    
    if (error || !data?.lyrics) {
      console.error('Error fetching lyrics:', error || 'No lyrics data');
      return null;
    }
    
    return data.lyrics;
  } catch (error) {
    console.error('Error retrieving lyrics from Dropbox:', error);
    return null;
  }
};

// Fonction améliorée pour uploader les fichiers de n'importe quelle taille directement sur Dropbox
export const uploadFileToDropbox = async (
  file: File,
  path: string
): Promise<string> => {
  try {
    // Check if Dropbox is enabled
    const dropboxEnabled = await isDropboxEnabled();
    if (!dropboxEnabled) {
      throw new Error('Dropbox n\'est pas activé');
    }
    
    console.log(`Uploading file to Dropbox: ${path}`, file);
    
    // Pour tous les fichiers volumineux (plus de 10 Mo), utiliser l'endpoint direct pour éviter les problèmes de sérialisation
    if (file.size > 10 * 1024 * 1024) {
      console.log(`Fichier volumineux détecté: ${file.size} octets, utilisation de la méthode directe`);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);
      
      // Appel direct à l'edge function de Dropbox
      const response = await fetch(`https://pwknncursthenghqgevl.functions.supabase.co/dropbox-storage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabase.auth.session()?.access_token || ''}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur lors de l'upload: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`Fichier téléchargé avec succès vers: ${data.path}`);
      return data.path;
    }
    
    // Pour les fichiers plus petits, continuer avec la méthode existante
    // Convert the file to an array of bytes for better transfer performance
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);
    
    console.log(`Taille du fichier: ${fileBytes.length} octets`);
    
    // Utilisation standard de l'edge function pour les fichiers plus petits
    const { data, error } = await supabase.functions.invoke('dropbox-storage', {
      method: 'POST',
      body: {
        action: 'upload',
        path: path,
        fileContent: Array.from(fileBytes), // Convert to array for JSON serialization
        contentType: file.type
      }
    });
    
    if (error) {
      console.error("Erreur lors de l'upload vers Dropbox:", error);
      throw error;
    }
    
    if (!data?.path) {
      throw new Error('Chemin du fichier manquant dans la réponse');
    }
    
    console.log(`Fichier téléchargé avec succès vers: ${data.path}`);
    return data.path;
  } catch (error) {
    console.error('Error during file upload to Dropbox:', error);
    toast.error("Échec de l'upload vers Dropbox");
    throw error;
  }
};

// Fonction pour télécharger des paroles sur Dropbox
export const uploadLyricsToDropbox = async (songId: string, lyricsContent: string): Promise<string> => {
  try {
    // Vérifier si Dropbox est activé
    const dropboxEnabled = await isDropboxEnabled();
    if (!dropboxEnabled) {
      throw new Error('Dropbox n\'est pas activé');
    }
    
    // Utiliser l'edge function pour upload les paroles
    const { data, error } = await supabase.functions.invoke('dropbox-storage', {
      method: 'POST',
      body: {
        action: 'upload',
        path: `lyrics/${songId}`,
        fileContent: lyricsContent,
        contentType: 'text/plain'
      }
    });
    
    if (error) {
      console.error("Erreur lors de l'upload des paroles vers Dropbox:", error);
      throw error;
    }
    
    if (!data?.path) {
      throw new Error('Chemin du fichier de paroles manquant dans la réponse');
    }
    
    return data.path;
  } catch (error) {
    console.error('Error uploading lyrics to Dropbox:', error);
    toast.error("Échec de l'upload des paroles vers Dropbox");
    throw error;
  }
};

// Fonction pour migrer les fichiers audio de Supabase vers Dropbox
export const migrateFilesToDropbox = async (
  files: Array<{ id: string; file_path: string }>,
  callbacks?: {
    onProgress?: (processed: number, total: number) => void;
    onSuccess?: (fileId: string) => void;
    onError?: (fileId: string, error: string) => void;
  }
): Promise<{ success: number; failed: number; failedFiles: Array<{ id: string; error: string }> }> => {
  try {
    // Vérifier si Dropbox est activé
    const dropboxEnabled = await isDropboxEnabled();
    if (!dropboxEnabled) {
      throw new Error('Dropbox n\'est pas activé');
    }
    
    const { data: migrationData, error: migrationError } = await supabase.functions.invoke('dropbox-migration', {
      method: 'POST',
      body: {
        files,
        type: 'audio'
      }
    });
    
    if (migrationError || !migrationData) {
      console.error('Error during migration:', migrationError);
      throw new Error('Erreur lors de la migration des fichiers');
    }
    
    // Simuler les callbacks pour la progression
    if (callbacks) {
      const progressIntervals = 10;
      let processedCount = 0;
      
      // Simuler la progression avec des intervalles
      const updateProgress = setInterval(() => {
        processedCount += Math.ceil(files.length / progressIntervals);
        const completed = Math.min(processedCount, files.length);
        
        if (callbacks.onProgress) {
          callbacks.onProgress(completed, files.length);
        }
        
        // Arrêter quand la migration est terminée
        if (completed >= files.length) {
          clearInterval(updateProgress);
        }
      }, 1000);
      
      // Attendre un peu avant de renvoyer le résultat pour permettre les animations
      await new Promise(resolve => setTimeout(resolve, files.length * 100));
    }
    
    return migrationData;
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
};

// Fonction pour migrer les paroles de Supabase vers Dropbox
export const migrateLyricsToDropbox = async (
  callbacks?: {
    onProgress?: (processed: number, total: number) => void;
    onSuccess?: (songId: string) => void;
    onError?: (songId: string, error: string) => void;
  }
): Promise<{ success: number; failed: number; failedItems: Array<{ id: string; error: string }> }> => {
  try {
    // Vérifier si Dropbox est activé
    const dropboxEnabled = await isDropboxEnabled();
    if (!dropboxEnabled) {
      throw new Error('Dropbox n\'est pas activé');
    }
    
    const { data: migrationData, error: migrationError } = await supabase.functions.invoke('dropbox-migration', {
      method: 'POST',
      body: {
        type: 'lyrics'
      }
    });
    
    if (migrationError || !migrationData) {
      console.error('Error during lyrics migration:', migrationError);
      throw new Error('Erreur lors de la migration des paroles');
    }
    
    // Simuler les callbacks pour la progression
    if (callbacks && migrationData.totalCount) {
      const progressIntervals = 10;
      let processedCount = 0;
      const totalCount = migrationData.totalCount;
      
      // Simuler la progression avec des intervalles
      const updateProgress = setInterval(() => {
        processedCount += Math.ceil(totalCount / progressIntervals);
        const completed = Math.min(processedCount, totalCount);
        
        if (callbacks.onProgress) {
          callbacks.onProgress(completed, totalCount);
        }
        
        // Arrêter quand la migration est terminée
        if (completed >= totalCount) {
          clearInterval(updateProgress);
        }
      }, 1000);
      
      // Attendre un peu avant de renvoyer le résultat pour permettre les animations
      await new Promise(resolve => setTimeout(resolve, totalCount * 100));
    }
    
    return migrationData;
  } catch (error) {
    console.error('Error during lyrics migration:', error);
    throw error;
  }
};
