
import { OneDriveConfig, OneDriveFileReference } from '@/types/onedrive';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { fetchSharedOneDriveConfig } from './sharedOneDriveConfig';
import { executeWithTokenRefresh, isTokenExpiredError } from './oneDriveTokenManager';

// Add a simple local storage helper for OneDrive configuration
export const getOneDriveConfig = async (): Promise<OneDriveConfig> => {
  // First, try to get the shared config if it's enabled
  try {
    const sharedConfig = await fetchSharedOneDriveConfig();
    if (sharedConfig && sharedConfig.accessToken && sharedConfig.isEnabled) {
      console.log('Using shared OneDrive configuration');
      return {
        ...sharedConfig,
        isEnabled: true, // Enable it automatically for the user
      };
    }
  } catch (error) {
    console.error('Error fetching shared OneDrive config:', error);
  }
  
  // If no shared config or it's not enabled, try to get user's personal configuration
  const configStr = localStorage.getItem('onedrive_config');
  if (configStr) {
    try {
      const userConfig = JSON.parse(configStr) as OneDriveConfig;
      if (userConfig.accessToken && userConfig.isEnabled) {
        return userConfig;
      }
    } catch (e) {
      console.error('Error parsing OneDrive config:', e);
    }
  }
  
  // Return empty config if nothing else is available
  return { 
    accessToken: '', 
    refreshToken: '', 
    isEnabled: false, 
    clientId: '' 
  };
};

// Synchronous version for backward compatibility
export const getOneDriveConfigSync = (): OneDriveConfig => {
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

// Only updating isOneDriveEnabled function to be async-compatible
export const isOneDriveEnabled = async (): Promise<boolean> => {
  const config = await getOneDriveConfig();
  return config.isEnabled && !!config.accessToken;
};

// Synchronous version for backward compatibility
export const isOneDriveEnabledSync = (): boolean => {
  const config = getOneDriveConfigSync();
  return config.isEnabled && !!config.accessToken;
};

// Function to check if a file exists on OneDrive
export const checkFileExistsOnOneDrive = async (path: string): Promise<boolean> => {
  return executeWithTokenRefresh(async (accessToken: string) => {
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
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          if (isTokenExpiredError(response)) {
            throw new Error('401');
          }
          
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
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (isTokenExpiredError(response)) {
      throw new Error('401');
    }
    
    return response.ok;
  });
};

// Updated function to upload a file to OneDrive
export const uploadFileToOneDrive = async (
  file: File,
  path: string
): Promise<string> => {
  return executeWithTokenRefresh(async (accessToken: string) => {
    console.log(`Uploading file to OneDrive: ${path}`, file);
    console.log(`File size: ${file.size} bytes, type: ${file.type}`);
    
    // For small files (< 4MB), use simple upload
    if (file.size < 4 * 1024 * 1024) {
      console.log('Using simple upload for small file');
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });

      if (isTokenExpiredError(response)) {
        throw new Error('401');
      }

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
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "replace",
          name: path.split('/').pop()
        }
      })
    });
    
    if (isTokenExpiredError(sessionResponse)) {
      throw new Error('401');
    }
    
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
  });
};

// Updated function to get a download URL for a file on OneDrive
export const getOneDriveSharedLink = async (path: string): Promise<string> => {
  return executeWithTokenRefresh(async (accessToken: string) => {
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
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (isTokenExpiredError(itemResponse)) {
        throw new Error('401');
      }
      
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
    
    // Use the Graph API to get a direct download URL instead of a sharing link
    const downloadUrlResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}?select=@microsoft.graph.downloadUrl`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (isTokenExpiredError(downloadUrlResponse)) {
      throw new Error('401');
    }
    
    if (!downloadUrlResponse.ok) {
      const errorText = await downloadUrlResponse.text();
      console.error('OneDrive download URL error:', errorText);
      throw new Error(`Failed to get OneDrive download URL: ${downloadUrlResponse.status} ${downloadUrlResponse.statusText}`);
    }
    
    const downloadUrlData = await downloadUrlResponse.json();
    
    // The download URL is returned as '@microsoft.graph.downloadUrl'
    const downloadUrl = downloadUrlData['@microsoft.graph.downloadUrl'];
    
    if (!downloadUrl) {
      throw new Error('No download URL returned from OneDrive API');
    }
    
    console.log('OneDrive direct download URL obtained:', downloadUrl);
    return downloadUrl;
  });
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
  const config = await getOneDriveConfig();
  
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
  const config = await getOneDriveConfig();
  
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
  console.log(`Uploading lyrics for song ${songId} to OneDrive`);
  
  // Convert the lyrics content to a file
  const lyricsBlob = new Blob([lyricsContent], { type: 'text/plain' });
  const lyricsFile = new File([lyricsBlob], `${songId}_lyrics.txt`, { type: 'text/plain' });
  
  // OneDrive path for lyrics
  const path = `lyrics/${songId}`;
  
  // Use the existing function to upload the file
  const onedrivePath = await uploadFileToOneDrive(lyricsFile, path);
  
  return onedrivePath;
};

// Function to get lyrics from OneDrive
export const getLyricsFromOneDrive = async (songId: string): Promise<string | null> => {
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
