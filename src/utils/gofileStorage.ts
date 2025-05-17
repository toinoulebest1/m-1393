
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GofileUploadResponse {
  status: string;
  data: {
    downloadPage: string;
    code: string;
    parentFolder: string;
    fileId: string;
    fileName: string;
    md5: string;
    directLink: string;
    info: string;
  };
}

// Function to check if Gofile is configured and enabled
export const isGofileEnabled = (): boolean => {
  // For now, we simply return true as we don't have
  // any particular configuration required for Gofile
  return true;
};

// Function to get current Gofile server
export async function getGofileServer(): Promise<string> {
  try {
    const response = await fetch('https://api.gofile.io/getServer');
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.status !== 'ok' || !data.data?.server) {
      throw new Error('Invalid server response');
    }
    
    return data.data.server;
  } catch (error) {
    console.error("Error getting Gofile server:", error);
    throw new Error('Failed to get Gofile server');
  }
}

// Function to upload an audio file to Gofile
export const uploadToGofile = async (file: File): Promise<string> => {
  try {
    console.log("Uploading to Gofile:", file.name);
    
    // Get the best available server first
    const server = await getGofileServer();
    console.log("Using Gofile server:", server);
    
    // Create a FormData for the upload
    const formData = new FormData();
    formData.append('file', file);
    
    // Make a POST request to the Gofile API using the assigned server
    const response = await fetch(`https://${server}.gofile.io/uploadFile`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const result: GofileUploadResponse = await response.json();
    
    if (result.status !== 'ok') {
      throw new Error(`Gofile Error: ${result.status}`);
    }
    
    console.log("Gofile upload successful:", result.data);
    
    // Return the direct link
    return result.data.directLink;
  } catch (error) {
    console.error("Error uploading to Gofile:", error);
    toast.error("Error uploading to Gofile");
    throw error;
  }
};

// Function to store the Gofile file information in the database
export const storeGofileReference = async (
  songId: string, 
  gofileUrl: string
): Promise<void> => {
  try {
    // Ensure songId is a UUID string with the correct format
    if (!songId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      throw new Error("Invalid song ID format");
    }

    const { error } = await supabase
      .from('gofile_references')
      .insert({
        song_id: songId,
        gofile_url: gofileUrl,
        created_at: new Date().toISOString()
      });
      
    if (error) {
      throw error;
    }
    
    console.log("Gofile reference stored successfully for:", songId);
  } catch (error) {
    console.error("Error storing Gofile reference:", error);
    toast.error("Error storing Gofile reference");
    throw error;
  }
};

// Function to check if a file exists on Gofile
export const checkFileExistsOnGofile = async (gofileUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(gofileUrl, {
      method: 'HEAD'
    });
    return response.ok;
  } catch (error) {
    console.error("Error checking Gofile file:", error);
    return false;
  }
};
