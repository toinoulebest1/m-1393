
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const isDropboxEnabled = (): boolean => {
  return localStorage.getItem('use_dropbox_storage') === 'true';
};

// Added getDropboxConfig function
export const getDropboxConfig = () => {
  return {
    accessToken: localStorage.getItem('dropbox_access_token') || '',
    isEnabled: localStorage.getItem('use_dropbox_storage') === 'true'
  };
};

// Added saveDropboxConfig function
export const saveDropboxConfig = (config: { accessToken: string, isEnabled: boolean }) => {
  localStorage.setItem('dropbox_access_token', config.accessToken);
  localStorage.setItem('use_dropbox_storage', config.isEnabled ? 'true' : 'false');
};

export const uploadFileToDropbox = async (file: File, path: string, folderPath?: string) => {
  try {
    console.log(`Uploading file to Dropbox: ${file.name} to path: ${path}`);

    const accessToken = localStorage.getItem('dropbox_access_token');
    if (!accessToken) {
      throw new Error('Dropbox access token not found. Please authenticate with Dropbox.');
    }

    let dropboxPath = `/${path}`;
    if (folderPath) {
      dropboxPath = `/${folderPath}/${file.name}`;
    }

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode: 'add',
          autorename: true,
          mute: false,
          strict_conflict: false,
        }),
      },
      body: file,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dropbox upload error:', errorData);
      throw new Error(`Dropbox upload failed: ${errorData.error_summary || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Dropbox upload success:', data);
    toast.success(`${file.name} uploaded to Dropbox successfully!`);
    return data;
  } catch (error) {
    console.error('Dropbox upload error:', error);
    toast.error(`Failed to upload ${file.name} to Dropbox. See console for details.`);
    throw error;
  }
};

// Added checkFileExistsOnDropbox function
export const checkFileExistsOnDropbox = async (path: string): Promise<boolean> => {
  try {
    console.log(`Checking if file exists on Dropbox: ${path}`);
    
    const accessToken = localStorage.getItem('dropbox_access_token');
    if (!accessToken) {
      console.warn('Dropbox access token not found.');
      return false;
    }

    // Using Dropbox API to check if the file exists
    const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: `/${path}`,
        include_media_info: false
      })
    });

    // If response is OK, the file exists
    return response.ok;
  } catch (error) {
    console.error('Error checking if file exists on Dropbox:', error);
    return false;
  }
};

export const getDropboxSharedLink = async (path: string) => {
  try {
    console.log(`Retrieving Dropbox shared link for: ${path}`);
    
    // First try to see if a shared link already exists
    try {
      console.log("Checking if shared link already exists");
      const response = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('dropbox_access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: `/${path}`
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.links && data.links.length > 0) {
          console.log("Shared link already exists, fetching it");
          // Use the existing shared link
          let url = data.links[0].url;
          // Convert www.dropbox.com to dl.dropboxusercontent.com for direct download
          url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
          return url;
        }
      } else {
        console.error("Failed to list shared links:", await response.json());
      }
    } catch (error) {
      console.error("Error getting Dropbox shared links:", error);
    }
    
    // If no shared link exists or we couldn't retrieve it, create a new one
    console.log("Creating new shared link");
    const response = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('dropbox_access_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: `/${path}`,
        settings: {
          requested_visibility: "public"
        }
      })
    });
    
    if (!response.ok) {
      const errorResponse = await response.json();
      console.error("Error creating shared link:", errorResponse);
      
      // Check if the path doesn't exist - rethrow for better handling
      if (errorResponse.error && errorResponse.error.path && 
          errorResponse.error.path['.tag'] === 'not_found') {
        throw new Error(`File not found at path: ${path}`);
      }
      
      throw new Error(`Failed to create shared link: ${errorResponse.error_summary}`);
    }
    
    const data = await response.json();
    let url = data.url;
    
    // Convert www.dropbox.com to dl.dropboxusercontent.com for direct download
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    
    return url;
  } catch (error) {
    console.error("Error getting Dropbox shared link:", error);
    throw error;
  }
};

export const getLrcFile = async (songId: string): Promise<string | null> => {
  try {
    const accessToken = localStorage.getItem('dropbox_access_token');
    if (!accessToken) {
      console.warn('Dropbox access token not found.');
      return null;
    }

    const filePath = `songs/${songId}/${songId}.lrc`;
    console.log(`Attempting to fetch LRC file from Dropbox: ${filePath}`);

    const url = await getDropboxSharedLink(filePath);
    if (!url) {
      console.warn('Could not generate a shared link for the LRC file.');
      return null;
    }

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch LRC file: ${response.status} - ${response.statusText}`);
      return null;
    }

    const content = await response.text();
    console.log('LRC file content fetched successfully.');
    return content;
  } catch (error) {
    console.error('Error fetching LRC file from Dropbox:', error);
    return null;
  }
};

export const uploadLrcFile = async (songId: string, lrcContent: string): Promise<void> => {
    try {
      const accessToken = localStorage.getItem('dropbox_access_token');
      if (!accessToken) {
        throw new Error('Dropbox access token not found. Please authenticate with Dropbox.');
      }
  
      const filePath = `songs/${songId}/${songId}.lrc`;
      console.log(`Uploading LRC file to Dropbox: ${filePath}`);
  
      const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: `/${filePath}`,
            mode: 'overwrite',
            autorename: false,
            mute: true,
            strict_conflict: false,
          }),
        },
        body: new Blob([lrcContent], { type: 'text/plain' }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Dropbox upload error:', errorData);
        throw new Error(`Dropbox upload failed: ${errorData.error_summary || 'Unknown error'}`);
      }
  
      const data = await response.json();
      console.log('Dropbox upload success:', data);
      toast.success(`LRC file for song ${songId} uploaded to Dropbox successfully!`);
    } catch (error) {
      console.error('Dropbox upload error:', error);
      toast.error(`Failed to upload LRC file for song ${songId} to Dropbox. See console for details.`);
      throw error;
    }
};

// Added migrateFilesToDropbox function
export const migrateFilesToDropbox = async (
  songs: Array<{ id: string, file_path?: string }>,
  callbacks?: {
    onProgress?: (processed: number, total: number) => void,
    onSuccess?: (fileId: string) => void,
    onError?: (fileId: string, error: string) => void
  }
): Promise<{ success: number, failed: number, failedFiles: Array<{ id: string, error: string }> }> => {
  const results = {
    success: 0,
    failed: 0,
    failedFiles: [] as Array<{ id: string, error: string }>
  };

  // Check if Dropbox is enabled and configured
  const accessToken = localStorage.getItem('dropbox_access_token');
  if (!accessToken) {
    toast.error('Dropbox access token not found. Please configure Dropbox first.');
    throw new Error('Dropbox access token not found');
  }

  const totalSongs = songs.length;
  
  // Process each song
  for (let i = 0; i < totalSongs; i++) {
    const song = songs[i];
    
    // Update progress
    if (callbacks?.onProgress) {
      callbacks.onProgress(i + 1, totalSongs);
    }
    
    try {
      // Skip songs without file path
      if (!song.file_path) {
        throw new Error('No file path available');
      }
      
      // Download the file from Supabase
      console.log(`Downloading file from Supabase for song ID: ${song.id}`);
      const { data: fileData, error: fileError } = await supabase.storage
        .from('audio')
        .download(song.file_path);
        
      if (fileError || !fileData) {
        throw new Error(`Failed to download file from Supabase: ${fileError?.message || 'Unknown error'}`);
      }
      
      // Create a File object from the blob
      const file = new File([fileData], song.file_path.split('/').pop() || `${song.id}.mp3`, {
        type: 'audio/mpeg'
      });
      
      // Upload to Dropbox
      console.log(`Uploading file to Dropbox: ${song.id}`);
      const dropboxFolderPath = `songs/${song.id}`;
      await uploadFileToDropbox(file, '', dropboxFolderPath);
      
      // Migration successful for this song
      results.success++;
      if (callbacks?.onSuccess) {
        callbacks.onSuccess(song.id);
      }
      
    } catch (error) {
      // Migration failed for this song
      console.error(`Migration failed for song ${song.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      results.failed++;
      results.failedFiles.push({
        id: song.id,
        error: errorMessage
      });
      
      if (callbacks?.onError) {
        callbacks.onError(song.id, errorMessage);
      }
    }
  }
  
  return results;
};
