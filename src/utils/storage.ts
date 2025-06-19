import { supabase } from '@/integrations/supabase/client';
import { isOneDriveEnabled, uploadFileToOneDrive, getOneDriveSharedLink } from './oneDriveStorage';
import { preloadAudio, isInCache, getFromCache, addToCache } from './audioCache';

export const storeAudioFile = async (id: string, file: File | string) => {
  console.log("Storing playlist cover for:", playlistId, typeof file);
  
  try {
    let fileToUpload: File;
    
    if (file instanceof Blob) {
      fileToUpload = new File([file], `playlist-${playlistId}.jpg`, { 
        type: 'image/jpeg' 
      });
      console.log("Converted Blob to File object");
    } else if (typeof file === 'string') {
      if (file.startsWith('data:')) {
        console.log("Processing data URL");
        const response = await fetch(file);
        const blob = await response.blob();
        fileToUpload = new File([blob], `playlist-${playlistId}.jpg`, { 
          type: 'image/jpeg' 
        });
        console.log("Converted data URL to File object", blob.size, "bytes");
      } else {
        console.log("Fetching remote URL:", file);
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        fileToUpload = new File([blob], `playlist-${playlistId}.jpg`, { 
          type: blob.type || 'image/jpeg' 
        });
        console.log("Converted remote URL to File object", blob.size, "bytes");
      }
    } else {
      fileToUpload = file;
      console.log("Using provided File object");
    }
    
    if (!fileToUpload || fileToUpload.size === 0) {
      console.error("Invalid file or empty file");
      throw new Error("Invalid or empty file");
    }
    
    const fileName = `playlist-covers/${playlistId}.jpg`;
    console.log(`Uploading playlist cover to storage: ${fileName}, size: ${fileToUpload.size} bytes`);
    
    const { data, error } = await supabase.storage
      .from('media')
      .upload(fileName, fileToUpload, {
        upsert: true,
        contentType: fileToUpload.type || 'image/jpeg',
        cacheControl: '3600'
      });
    
    if (error) {
      console.error("Error during storage upload:", error);
      throw error;
    }
    
    console.log("Upload succeeded, path:", data.path);
    
    const timestamp = new Date().getTime();
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(`${fileName}?t=${timestamp}`);
    
    console.log("Public URL generated:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error storing playlist cover:", error);
    throw error;
  }
};

export const getPlaylistCover = async (playlistId: string): Promise<string | null> => {
  try {
    const fileName = `playlist-covers/${playlistId}.jpg`;
    
    const { data: fileExists } = await supabase.storage
      .from('media')
      .list('playlist-covers', {
        search: `${playlistId}.jpg`,
        limit: 1
      });
      
    if (!fileExists || fileExists.length === 0) {
      console.log("No existing cover found for playlist:", playlistId);
      return null;
    }
    
    const timestamp = new Date().getTime();
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(`${fileName}?t=${timestamp}`);
    
    console.log("Existing cover found:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error checking for playlist cover:", error);
    return null;
  }
};

export const generateImageFromSongs = async (songs: any[]): Promise<string | null> => {
  try {
    const songsWithImages = songs.filter(song => 
      song.songs?.imageUrl && song.songs.imageUrl.startsWith('http')
    );
    
    console.log(`Generating playlist cover from ${songsWithImages.length} songs with images`);
    
    if (songsWithImages.length === 0) {
      console.log("No songs with valid image URLs found");
      return null;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get canvas context");
      return null;
    }

    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = Math.min(songsWithImages.length, 4) === 1 ? 1 : 2;
    const imageSize = canvas.width / gridSize;
    
    console.log(`Using grid size: ${gridSize}x${gridSize}, image size: ${imageSize}px`);

    const loadImage = (url: string): Promise<HTMLImageElement | null> => {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => {
          console.error(`Error loading image ${url}:`, e);
          resolve(null);
        };
        const cacheBuster = `?t=${new Date().getTime()}`;
        img.src = url.includes('?') ? `${url}&cb=${cacheBuster}` : `${url}${cacheBuster}`;
      });
    };

    const imagePromises = await Promise.all(
      songsWithImages.slice(0, 4).map(song => loadImage(song.songs.imageUrl))
    );
    
    const validImages = imagePromises.filter(img => img !== null) as HTMLImageElement[];
    
    console.log(`Successfully loaded ${validImages.length} images out of ${songsWithImages.length} attempted`);
    
    if (validImages.length === 0) {
      console.log("No images could be loaded successfully");
      return null;
    }

    validImages.forEach((img, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      ctx.drawImage(img, col * imageSize, row * imageSize, imageSize, imageSize);
      console.log(`Drew image ${index + 1} at position [${row},${col}]`);
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    console.log(`Generated data URL of length ${dataUrl.length}`);
    
    return dataUrl;
  } catch (error) {
    console.error('Error generating playlist cover:', error);
    return null;
  }
};
import { supabase } from '@/integrations/supabase/client';
import { isOneDriveEnabled, uploadFileToOneDrive, getOneDriveSharedLink } from './oneDriveStorage';
import { preloadAudio, isInCache, getFromCache, addToCache } from './audioCache';

export const storeAudioFile = async (id: string, file: File | string) => {
  const useOneDrive = await isOneDriveEnabled();
  
  let fileToUpload: File;
  if (typeof file === 'string') {
    try {
      const response = await fetch(file);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const blob = await response.blob();
      fileToUpload = new File([blob], id, { type: blob.type || 'audio/mpeg' });
    } catch (error) {
      console.error("Erreur lors de la conversion de l'URL en fichier:", error);
      throw error;
    }
  } else {
    fileToUpload = file;
  }

  try {
    if (useOneDrive) {
      await uploadFileToOneDrive(fileToUpload, `audio/${id}`);
      return `audio/${id}`;
    } else {
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(id, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileToUpload.type || 'audio/mpeg'
        });

      if (error) {
        throw error;
      }

      return data.path;
    }
  } catch (error) {
    console.error("Erreur lors du stockage du fichier:", error);
    throw error;
  }
};

export const getAudioFile = async (path: string) => {
  if (!path) {
    throw new Error("Chemin du fichier non fourni");
  }

  try {
    // Cache ultra-rapide (30ms max)
    const cacheResult = await Promise.race([
      isInCache(path).then(async (inCache) => {
        if (inCache) {
          const cached = await getFromCache(path);
          if (cached) {
            return cached;
          }
        }
        return null;
      }),
      new Promise(resolve => setTimeout(() => resolve(null), 30))
    ]);

    if (cacheResult) {
      return cacheResult;
    }

    // Récupération réseau hyper-optimisée
    const useOneDrive = await isOneDriveEnabled();
    let audioUrl: string;
    
    if (useOneDrive) {
      try {
        audioUrl = await getOneDriveSharedLink(`audio/${path}`);
      } catch (oneDriveError) {
        throw new Error(`OneDrive indisponible: ${oneDriveError instanceof Error ? oneDriveError.message : 'Erreur inconnue'}`);
      }
    } else {
      // Récupération Supabase optimisée (sans vérification d'existence pour la vitesse)
      const { data, error } = await supabase.storage
        .from('audio')
        .createSignedUrl(path, 3600);

      if (error) {
        throw new Error(`Erreur URL signée: ${error.message}`);
      }

      if (!data?.signedUrl) {
        throw new Error("URL signée non générée");
      }

      audioUrl = data.signedUrl;
    }

    // Cache différé ultra-léger (ne pas bloquer)
    setTimeout(async () => {
      try {
        if (!(await isInCache(path))) {
          fetch(audioUrl, { 
            method: 'HEAD',
            cache: 'force-cache'
          }).then(response => {
            if (response.ok) {
              fetch(audioUrl).then(r => r.blob()).then(blob => {
                addToCache(path, blob);
              });
            }
          });
        }
      } catch (e) { /* Silent */ }
    }, 100);

    return audioUrl;
  } catch (error) {
    throw error;
  }
};

export const searchDeezerTrack = async (artist: string, title: string): Promise<string | null> => {
  try {
    const query = `${artist} ${title}`;
    
    const { data: supabaseData, error } = await supabase.functions.invoke('deezer-search', {
      body: { query }
    });
    
    if (error) {
      console.error("Erreur lors de l'appel à l'edge function Deezer:", error);
      return null;
    }
    
    if (supabaseData?.data && supabaseData.data.length > 0) {
      const track = supabaseData.data[0];
      if (track.album?.cover_xl) {
        return track.album.cover_xl;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Erreur lors de la recherche Deezer:", error);
    return "https://picsum.photos/240/240";
  }
};

export const storePlaylistCover = async (playlistId: string, file: File | string | Blob) => {
  console.log("Storing playlist cover for:", playlistId, typeof file);
  
  try {
    let fileToUpload: File;
    
    if (file instanceof Blob) {
      fileToUpload = new File([file], `playlist-${playlistId}.jpg`, { 
        type: 'image/jpeg' 
      });
      console.log("Converted Blob to File object");
    } else if (typeof file === 'string') {
      if (file.startsWith('data:')) {
        console.log("Processing data URL");
        const response = await fetch(file);
        const blob = await response.blob();
        fileToUpload = new File([blob], `playlist-${playlistId}.jpg`, { 
          type: 'image/jpeg' 
        });
        console.log("Converted data URL to File object", blob.size, "bytes");
      } else {
        console.log("Fetching remote URL:", file);
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        fileToUpload = new File([blob], `playlist-${playlistId}.jpg`, { 
          type: blob.type || 'image/jpeg' 
        });
        console.log("Converted remote URL to File object", blob.size, "bytes");
      }
    } else {
      fileToUpload = file;
      console.log("Using provided File object");
    }
    
    if (!fileToUpload || fileToUpload.size === 0) {
      console.error("Invalid file or empty file");
      throw new Error("Invalid or empty file");
    }
    
    const fileName = `playlist-covers/${playlistId}.jpg`;
    console.log(`Uploading playlist cover to storage: ${fileName}, size: ${fileToUpload.size} bytes`);
    
    const { data, error } = await supabase.storage
      .from('media')
      .upload(fileName, fileToUpload, {
        upsert: true,
        contentType: fileToUpload.type || 'image/jpeg',
        cacheControl: '3600'
      });
    
    if (error) {
      console.error("Error during storage upload:", error);
      throw error;
    }
    
    console.log("Upload succeeded, path:", data.path);
    
    const timestamp = new Date().getTime();
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(`${fileName}?t=${timestamp}`);
    
    console.log("Public URL generated:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error storing playlist cover:", error);
    throw error;
  }
};

export const getPlaylistCover = async (playlistId: string): Promise<string | null> => {
  try {
    const fileName = `playlist-covers/${playlistId}.jpg`;
    
    const { data: fileExists } = await supabase.storage
      .from('media')
      .list('playlist-covers', {
        search: `${playlistId}.jpg`,
        limit: 1
      });
      
    if (!fileExists || fileExists.length === 0) {
      console.log("No existing cover found for playlist:", playlistId);
      return null;
    }
    
    const timestamp = new Date().getTime();
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(`${fileName}?t=${timestamp}`);
    
    console.log("Existing cover found:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error checking for playlist cover:", error);
    return null;
  }
};

export const generateImageFromSongs = async (songs: any[]): Promise<string | null> => {
  try {
    const songsWithImages = songs.filter(song => 
      song.songs?.imageUrl && song.songs.imageUrl.startsWith('http')
    );
    
    console.log(`Generating playlist cover from ${songsWithImages.length} songs with images`);
    
    if (songsWithImages.length === 0) {
      console.log("No songs with valid image URLs found");
      return null;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get canvas context");
      return null;
    }

    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = Math.min(songsWithImages.length, 4) === 1 ? 1 : 2;
    const imageSize = canvas.width / gridSize;
    
    console.log(`Using grid size: ${gridSize}x${gridSize}, image size: ${imageSize}px`);

    const loadImage = (url: string): Promise<HTMLImageElement | null> => {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => {
          console.error(`Error loading image ${url}:`, e);
          resolve(null);
        };
        const cacheBuster = `?t=${new Date().getTime()}`;
        img.src = url.includes('?') ? `${url}&cb=${cacheBuster}` : `${url}${cacheBuster}`;
      });
    };

    const imagePromises = await Promise.all(
      songsWithImages.slice(0, 4).map(song => loadImage(song.songs.imageUrl))
    );
    
    const validImages = imagePromises.filter(img => img !== null) as HTMLImageElement[];
    
    console.log(`Successfully loaded ${validImages.length} images out of ${songsWithImages.length} attempted`);
    
    if (validImages.length === 0) {
      console.log("No images could be loaded successfully");
      return null;
    }

    validImages.forEach((img, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      ctx.drawImage(img, col * imageSize, row * imageSize, imageSize, imageSize);
      console.log(`Drew image ${index + 1} at position [${row},${col}]`);
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    console.log(`Generated data URL of length ${dataUrl.length}`);
    
    return dataUrl;
  } catch (error) {
    console.error('Error generating playlist cover:', error);
    return null;
  }
};
