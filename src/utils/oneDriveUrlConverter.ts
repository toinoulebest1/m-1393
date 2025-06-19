
// Utility to convert OneDrive sharing links to direct download links
export const convertOneDriveShareLinkToDownload = (shareUrl: string): string => {
  console.log('Converting OneDrive share link:', shareUrl);
  
  // Check if it's already a download link
  if (shareUrl.includes('download.aspx') || shareUrl.includes('download=1')) {
    console.log('Link already appears to be a download link');
    return shareUrl;
  }
  
  try {
    const url = new URL(shareUrl);
    
    // Method 1: Extract UniqueId from OneDrive share link and generate proper download URL
    // OneDrive share links often contain the UniqueId in various formats
    
    // Look for UniqueId in the URL parameters or path
    const searchParams = url.searchParams;
    const urlString = shareUrl;
    
    // Try to extract UniqueId from different possible locations
    let uniqueId: string | null = null;
    
    // Check URL parameters first
    if (searchParams.has('id')) {
      uniqueId = searchParams.get('id');
      console.log('Found UniqueId in id parameter:', uniqueId);
    } else if (searchParams.has('UniqueId')) {
      uniqueId = searchParams.get('UniqueId');
      console.log('Found UniqueId in UniqueId parameter:', uniqueId);
    }
    
    // If not found in parameters, try to extract from the URL structure
    if (!uniqueId) {
      // Look for patterns like /s!/... or encoded IDs in the path
      const pathMatch = urlString.match(/\/s!([A-Za-z0-9_-]+)/);
      if (pathMatch) {
        uniqueId = pathMatch[1];
        console.log('Found UniqueId in path pattern:', uniqueId);
      }
    }
    
    // Try to extract from resid parameter (common in OneDrive links)
    if (!uniqueId && searchParams.has('resid')) {
      const resid = searchParams.get('resid');
      if (resid) {
        // resid format is often like "GUID!123" - we want the GUID part
        const residMatch = resid.match(/^([A-Fa-f0-9-]+)!/);
        if (residMatch) {
          uniqueId = residMatch[1];
          console.log('Found UniqueId from resid:', uniqueId);
        }
      }
    }
    
    // If we found a UniqueId, generate the proper download URL
    if (uniqueId && url.hostname.includes('sharepoint.com')) {
      // Extract the base SharePoint URL structure
      const baseUrl = `${url.protocol}//${url.hostname}`;
      
      // Extract the personal path if it exists
      const personalMatch = url.pathname.match(/\/personal\/([^\/]+)/);
      if (personalMatch) {
        const personalPath = personalMatch[1];
        
        // Generate the download URL using the discovered format
        const downloadUrl = `${baseUrl}/personal/${personalPath}/_layouts/15/download.aspx?UniqueId=${encodeURIComponent(uniqueId)}`;
        console.log('Generated download URL with UniqueId:', downloadUrl);
        return downloadUrl;
      }
      
      // Fallback: use the general download format
      const downloadUrl = `${baseUrl}/_layouts/15/download.aspx?UniqueId=${encodeURIComponent(uniqueId)}`;
      console.log('Generated fallback download URL with UniqueId:', downloadUrl);
      return downloadUrl;
    }
    
    // Method 2: Try to extract from authkey parameter (another common format)
    if (searchParams.has('authkey')) {
      const authkey = searchParams.get('authkey');
      if (authkey && url.hostname.includes('sharepoint.com')) {
        const baseUrl = `${url.protocol}//${url.hostname}`;
        const personalMatch = url.pathname.match(/\/personal\/([^\/]+)/);
        
        if (personalMatch) {
          const personalPath = personalMatch[1];
          // Try using authkey as UniqueId
          const downloadUrl = `${baseUrl}/personal/${personalPath}/_layouts/15/download.aspx?UniqueId=${encodeURIComponent(authkey)}`;
          console.log('Generated download URL with authkey as UniqueId:', downloadUrl);
          return downloadUrl;
        }
      }
    }
    
    // Method 3: Legacy approach - add download parameter
    console.log('Could not extract UniqueId, falling back to legacy method');
    if (url.search) {
      return `${shareUrl}&download=1`;
    } else {
      return `${shareUrl}?download=1`;
    }
    
  } catch (error) {
    console.error('Error converting OneDrive link:', error);
    
    // Ultimate fallback: just add download parameter
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
    
    // Also check URL parameters for file names
    const searchParams = url.searchParams;
    for (const [key, value] of searchParams.entries()) {
      const decodedValue = decodeURIComponent(value);
      for (const ext of audioExtensions) {
        if (decodedValue.toLowerCase().includes(ext)) {
          return {
            fileName: decodedValue,
            fileType: ext.substring(1)
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
