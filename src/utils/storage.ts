
import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadFileToDropbox, getDropboxSharedLink } from './dropboxStorage';
import { isOneDriveEnabled, uploadFileToOneDrive, getOneDriveSharedLink } from './oneDriveStorage';

export const uploadAudioFile = async (file: File, fileName: string): Promise<string> => {
  // Priorité à Dropbox, puis OneDrive, puis Supabase
  if (isDropboxEnabled()) {
    console.log('Using Dropbox for file upload');
    return await uploadFileToDropbox(file, `audio/${fileName}`);
  } else if (isOneDriveEnabled()) {
    console.log('Using OneDrive for file upload');
    return await uploadFileToOneDrive(file, `audio/${fileName}`);
  } else {
    console.log('Using Supabase for file upload');
    // Fallback vers Supabase
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Error uploading to Supabase:', error);
      throw error;
    }

    return data.path;
  }
};

export const getAudioFileUrl = async (filePath: string): Promise<string> => {
  // Priorité à Dropbox, puis OneDrive, puis Supabase
  if (isDropboxEnabled()) {
    console.log('Getting file URL from Dropbox');
    try {
      return await getDropboxSharedLink(filePath);
    } catch (error) {
      console.error('Error getting Dropbox shared link:', error);
      // Fallback vers Supabase si Dropbox échoue
    }
  } else if (isOneDriveEnabled()) {
    console.log('Getting file URL from OneDrive');
    try {
      return await getOneDriveSharedLink(filePath);
    } catch (error) {
      console.error('Error getting OneDrive shared link:', error);
      // Fallback vers Supabase si OneDrive échoue
    }
  }
  
  console.log('Getting file URL from Supabase');
  // Fallback vers Supabase
  const { data } = await supabase.storage
    .from('audio')
    .createSignedUrl(filePath, 3600);

  if (!data?.signedUrl) {
    throw new Error('Failed to get file URL from Supabase');
  }

  return data.signedUrl;
};
