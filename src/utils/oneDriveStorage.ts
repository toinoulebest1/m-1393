import { OneDriveConfig, OneDriveFileReference } from '@/types/onedrive';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Add a simple local storage helper for OneDrive configuration
export const getOneDriveConfig = (): OneDriveConfig => {
  const configStr = localStorage.getItem('onedrive_config');
  if (!configStr) {
    return { accessToken: '', refreshToken: '', isEnabled: false, clientId: '' };
  }
  
  try {
    return JSON.parse(configStr) as OneDriveConfig;
  } catch (e) {
    console.error('Error parsing OneDrive config:', e);
    return { accessToken: '', refreshToken: '', isEnabled: false, clientId: '' };
  }
};

export const saveOneDriveConfig = (config: OneDriveConfig): void => {
  localStorage.setItem('onedrive_config', JSON.stringify(config));
};

export const isOneDriveEnabled = (): boolean => {
  const config = getOneDriveConfig();
  return config.isEnabled && !!config.accessToken;
};

// Function to check if a file exists on OneDrive
export const checkFileExistsOnOneDrive = async (path: string): Promise<boolean> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    return false;
  }
  
  try {
    // First check if we have this file path saved in our database
    let onedrivePath = `/${path}`;
    
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
        console.log('Found stored OneDrive path:', onedrivePath);
        
        // If we have the file_id, use it directly
        if (fileRef.file_id) {
          const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileRef.file_id}`, {
            headers: {
              'Authorization': `Bearer ${config.accessToken}`
            }
          });
          
          return response.ok;
        }
      }
    } catch (dbError) {
      console.error('Database error when fetching reference:', dbError);
    }
    
    // Use path-based approach if we don't have the file_id
    const encodedPath = encodeURIComponent(onedrivePath);
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodedPath}`, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error checking if file exists on OneDrive:', error);
    return false;
  }
};

// Updated function to upload a file to OneDrive
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
    // For small files (< 4MB), use simple upload
    if (file.size < 4 * 1024 * 1024) {
      console.log('Using simple upload for small file');
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OneDrive simple upload error status:', response.status, response.statusText);
        console.error('OneDrive simple upload error details:', errorText);
        throw new Error(`Failed to upload to OneDrive: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('OneDrive upload successful:', data);
      
      // Store the reference in Supabase
      try {
        await supabase
          .from('onedrive_files')
          .upsert({
            local_id: path,
            onedrive_path: path,
            file_id: data.id,
            file_name: data.name
          });
      } catch (dbError) {
        console.error('Database error when saving reference:', dbError);
      }
      
      return path;
    }
    
    // For larger files, use upload session with proper chunking
    console.log('Creating upload session for large file');
    const sessionResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/createUploadSession`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "replace",
          name: path.split('/').pop()
        }
      })
    });
    
    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('OneDrive upload session error status:', sessionResponse.status, sessionResponse.statusText);
      console.error('OneDrive upload session error details:', errorText);
      throw new Error(`Failed to create OneDrive upload session: ${sessionResponse.status} ${sessionResponse.statusText} - ${errorText}`);
    }
    
    const sessionData = await sessionResponse.json();
    const uploadUrl = sessionData.uploadUrl;
    
    // Calculate optimal chunk size: 5MB for good balance of performance/reliability
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / chunkSize);
    
    console.log(`Uploading file in ${totalChunks} chunks of ${chunkSize} bytes each`);
    
    let uploadedBytes = 0;
    const fileBuffer = await file.arrayBuffer();
    
    // Upload each chunk with proper Content-Range header
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(fileSize, start + chunkSize) - 1;
      
      const chunk = new Uint8Array(fileBuffer.slice(start, end + 1));
      
      console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks}. Bytes ${start}-${end}/${fileSize}`);
      
      const chunkResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': `${chunk.length}`,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`
        },
        body: chunk
      });
      
      if (!chunkResponse.ok) {
        const errorText = await chunkResponse.text();
        console.error(`Chunk upload error (${chunkIndex + 1}/${totalChunks}):`, chunkResponse.status, errorText);
        throw new Error(`Failed to upload chunk ${chunkIndex + 1}: ${chunkResponse.status} ${chunkResponse.statusText} - ${errorText}`);
      }
      
      uploadedBytes += chunk.length;
      
      // If it's the last chunk, parse the response to get file data
      if (chunkIndex === totalChunks - 1) {
        const uploadData = await chunkResponse.json();
        console.log('OneDrive chunked upload successful:', uploadData);
        toast.success("Fichier téléchargé avec succès vers OneDrive");
        
        // Store the reference in Supabase
        try {
          await supabase
            .from('onedrive_files')
            .upsert({
              local_id: path,
              onedrive_path: path,
              file_id: uploadData.id,
              file_name: uploadData.name
            });
        } catch (dbError) {
          console.error('Database error when saving reference:', dbError);
        }
      }
    }
    
    return path;
  } catch (error) {
    console.error('Error uploading to OneDrive:', error);
    toast.error("Échec de l'upload vers OneDrive. Vérifiez votre connexion et les permissions.");
    throw error;
  }
};

// Function to get a shared link for a file on OneDrive
export const getOneDriveSharedLink = async (path: string): Promise<string> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    toast.error("Token d'accès OneDrive non configuré");
    throw new Error('OneDrive access token not configured');
  }
  
  try {
    // First check if we have this file path saved in our database
    let fileId: string | undefined;
    
    try {
      const { data: fileRef, error } = await supabase
        .from('onedrive_files')
        .select('file_id')
        .eq('local_id', path)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching OneDrive file reference:', error);
      } else if (fileRef?.file_id) {
        fileId = fileRef.file_id;
        console.log('Found stored OneDrive file ID:', fileId);
      }
    } catch (dbError) {
      console.error('Database error when fetching reference:', dbError);
    }
    
    // If we don't have the file ID, try to get it by path
    if (!fileId) {
      const encodedPath = encodeURIComponent(path.startsWith('/') ? path : `/${path}`);
      const itemResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodedPath}`, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`
        }
      });
      
      if (!itemResponse.ok) {
        const errorText = await itemResponse.text();
        console.error('OneDrive file lookup error:', errorText);
        throw new Error(`Failed to find OneDrive file: ${itemResponse.status} ${itemResponse.statusText}`);
      }
      
      const itemData = await itemResponse.json();
      fileId = itemData.id;
      
      // Save this file_id for future reference
      if (fileId) {
        try {
          await supabase
            .from('onedrive_files')
            .upsert({
              local_id: path,
              onedrive_path: path,
              file_id: fileId,
              file_name: itemData.name
            });
        } catch (dbError) {
          console.error('Database error when saving file ID:', dbError);
        }
      }
    }
    
    if (!fileId) {
      throw new Error('Could not find file ID in OneDrive');
    }
    
    // Create a sharing link
    const linkResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/createLink`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: "view",
        scope: "anonymous"
      })
    });
    
    if (!linkResponse.ok) {
      const errorText = await linkResponse.text();
      console.error('OneDrive shared link error:', errorText);
      throw new Error(`Failed to create OneDrive shared link: ${linkResponse.status} ${linkResponse.statusText}`);
    }
    
    const linkData = await linkResponse.json();
    const url = linkData.link.webUrl;
    
    // For audio files, we need to convert the URL to a direct download link
    // This may need to be adjusted depending on how OneDrive handles direct downloads
    const downloadUrl = url.replace("view.aspx", "download.aspx");
    
    return downloadUrl;
  } catch (error) {
    console.error('Error getting OneDrive shared link:', error);
    toast.error("Impossible d'obtenir un lien de partage OneDrive");
    throw error;
  }
};

// Function to migrate files from Supabase to OneDrive
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

  // Check if file exists in OneDrive
  const checkFileExistsInOneDrive = async (path: string): Promise<boolean> => {
    return checkFileExistsOnOneDrive(path);
  };
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const processedCount = i + 1;
    
    // Call the progress callback if it exists
    if (callbacks?.onProgress) {
      callbacks.onProgress(processedCount, files.length);
    }
    
    try {
      console.log(`Processing file ${processedCount}/${files.length}: ${file.id}`);
      
      // Check if the file already exists in OneDrive
      const fileExists = await checkFileExistsInOneDrive(`audio/${file.id}`);
      
      if (fileExists) {
        console.log(`File already exists in OneDrive: ${file.id}`);
        successCount++;
        if (callbacks?.onSuccess) {
          callbacks.onSuccess(file.id);
        }
        continue;
      }
      
      // Download the file from Supabase
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
      
      // Create a File object from the Blob
      const audioFile = new File([fileData], file.id, { 
        type: fileData.type || 'audio/mpeg' 
      });
      
      console.log(`Successfully downloaded file from Supabase: ${file.id}, size: ${audioFile.size} bytes`);
      
      // Upload to OneDrive
      if (audioFile.size > 0) {
        const onedrivePath = await uploadFileToOneDrive(audioFile, `audio/${file.id}`);
        console.log(`Successfully uploaded ${file.id} to OneDrive: ${onedrivePath}`);
        
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

// Function to migrate lyrics to OneDrive
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
    // Get all lyrics stored in Supabase
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
      
      // Call the progress callback if it exists
      if (callbacks?.onProgress) {
        callbacks.onProgress(processedCount, lyrics.length);
      }
      
      try {
        console.log(`Processing lyrics ${processedCount}/${lyrics.length}: ${lyric.song_id}`);
        
        // Check if the lyrics already exist in OneDrive
        const fileExists = await checkFileExistsOnOneDrive(`lyrics/${lyric.song_id}`);
        
        if (fileExists) {
          console.log(`Lyrics already exist in OneDrive: ${lyric.song_id}`);
          successCount++;
          if (callbacks?.onSuccess) {
            callbacks.onSuccess(lyric.song_id);
          }
          continue;
        }
        
        // Upload the lyrics to OneDrive
        if (lyric.content) {
          // Convert the lyrics content to a file
          const lyricsBlob = new Blob([lyric.content], { type: 'text/plain' });
          const lyricsFile = new File([lyricsBlob], `${lyric.song_id}_lyrics.txt`, { type: 'text/plain' });
          
          await uploadFileToOneDrive(lyricsFile, `lyrics/${lyric.song_id}`);
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

// Function to upload lyrics to OneDrive
export const uploadLyricsToOneDrive = async (songId: string, lyricsContent: string): Promise<string> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    toast.error("Token d'accès OneDrive non configuré");
    throw new Error('OneDrive access token not configured');
  }
  
  console.log(`Uploading lyrics for song ${songId} to OneDrive`);
  
  try {
    // Convert the lyrics content to a file
    const lyricsBlob = new Blob([lyricsContent], { type: 'text/plain' });
    const lyricsFile = new File([lyricsBlob], `${songId}_lyrics.txt`, { type: 'text/plain' });
    
    // OneDrive path for lyrics
    const path = `lyrics/${songId}`;
    
    // Use the existing function to upload the file
    const onedrivePath = await uploadFileToOneDrive(lyricsFile, path);
    
    return onedrivePath;
  } catch (error) {
    console.error('Error uploading lyrics to OneDrive:', error);
    toast.error("Échec de l'upload des paroles vers OneDrive");
    throw error;
  }
};

// Function to get lyrics from OneDrive
export const getLyricsFromOneDrive = async (songId: string): Promise<string | null> => {
  const config = getOneDriveConfig();
  
  if (!config.accessToken) {
    console.error("OneDrive access token not configured");
    return null;
  }
  
  try {
    // Get a shared link to download the lyrics
    const url = await getOneDriveSharedLink(`lyrics/${songId}`);
    
    // Download the lyrics content
    const response = await fetch(url);
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
