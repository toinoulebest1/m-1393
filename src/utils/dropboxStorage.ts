
import { DropboxConfig, DropboxFileReference } from '@/types/dropbox';
import { supabase } from '@/integrations/supabase/client';

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
    throw new Error('Dropbox access token not configured');
  }
  
  console.log(`Uploading file to Dropbox: ${path}`, file);
  
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
          autorename: false,
          mute: false
        })
      },
      body: file
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dropbox upload error:', errorData);
      throw new Error(`Failed to upload to Dropbox: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Dropbox upload successful:', data);
    
    // Store the reference in a local object instead of directly using Supabase
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
      }
    } catch (dbError) {
      console.error('Database error when saving reference:', dbError);
    }
    
    return data.path_display || `/${path}`;
  } catch (error) {
    console.error('Error uploading to Dropbox:', error);
    throw error;
  }
};

// Function to get a shared link for a file on Dropbox
export const getDropboxSharedLink = async (path: string): Promise<string> => {
  const config = getDropboxConfig();
  
  if (!config.accessToken) {
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
      
      const listData = await listResponse.json();
      
      if (listData.links && listData.links.length > 0) {
        // Convert the shared link to a direct download link
        let url = listData.links[0].url;
        url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        url = url.replace('?dl=0', '');
        
        return url;
      }
      
      throw new Error('No shared links found');
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dropbox shared link error:', errorData);
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
    throw error;
  }
};
