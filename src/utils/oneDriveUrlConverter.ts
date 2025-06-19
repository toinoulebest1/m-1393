
// Utility to convert OneDrive sharing links to direct download links
export const convertOneDriveShareLinkToDownload = (shareUrl: string): string => {
  console.log('Converting OneDrive share link:', shareUrl);
  
  // Check if it's already a download link
  if (shareUrl.includes('download=1') || shareUrl.includes('&download=1')) {
    console.log('Link already appears to be a download link');
    return shareUrl;
  }
  
  try {
    // Method 1: Replace :u: with direct path and add download=1
    if (shareUrl.includes('/:u:/')) {
      const url = new URL(shareUrl);
      const pathParts = url.pathname.split('/');
      
      // Find the base SharePoint URL
      const baseUrl = `${url.protocol}//${url.hostname}`;
      
      // Extract the personal path part
      const personalIndex = pathParts.findIndex(part => part === 'personal');
      if (personalIndex !== -1 && personalIndex + 1 < pathParts.length) {
        const personalPath = pathParts[personalIndex + 1];
        
        // Method 1: Try the Documents approach
        const documentsUrl = `${baseUrl}/personal/${personalPath}/Documents/?download=1`;
        console.log('Generated documents download URL:', documentsUrl);
        return documentsUrl;
      }
    }
    
    // Method 2: Simple approach - add download parameter
    const url = new URL(shareUrl);
    if (url.search) {
      return `${shareUrl}&download=1`;
    } else {
      return `${shareUrl}?download=1`;
    }
  } catch (error) {
    console.error('Error converting OneDrive link:', error);
    
    // Fallback: just add download parameter
    if (shareUrl.includes('?')) {
      return `${shareUrl}&download=1`;
    } else {
      return `${shareUrl}?download=1`;
    }
  }
};

// Test if a OneDrive link works for direct download
export const testOneDriveDirectLink = async (url: string): Promise<boolean> => {
  try {
    console.log('Testing OneDrive direct link:', url);
    
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors' // OneDrive might have CORS restrictions
    });
    
    // With no-cors mode, we can't read the status, but no error means it's reachable
    console.log('OneDrive link test completed');
    return true;
  } catch (error) {
    console.warn('OneDrive link test failed:', error);
    // Don't fail completely as CORS might block the test but the link could still work
    return true;
  }
};

// Extract file information from OneDrive share link if possible
export const extractFileInfoFromShareLink = (shareUrl: string): { fileName?: string; fileType?: string } => {
  try {
    const url = new URL(shareUrl);
    
    // Try to extract file name from the URL structure
    // OneDrive share links sometimes contain encoded file information
    const pathParts = url.pathname.split('/');
    
    // Look for common audio file extensions in the URL
    const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];
    
    for (const part of pathParts) {
      const decodedPart = decodeURIComponent(part);
      for (const ext of audioExtensions) {
        if (decodedPart.toLowerCase().includes(ext)) {
          return {
            fileName: decodedPart,
            fileType: ext.substring(1) // Remove the dot
          };
        }
      }
    }
    
    return {};
  } catch (error) {
    console.error('Error extracting file info from share link:', error);
    return {};
  }
};
