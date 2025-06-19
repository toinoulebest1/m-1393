import { supabase } from '@/integrations/supabase/client';
import { isOneDriveEnabled, uploadFileToOneDrive, getOneDriveSharedLink } from './oneDriveStorage';
import { preloadAudio, isInCache, getFromCache, addToCache } from './audioCache';

export const storeAudioFile = async (id: string, file: File | string) => {
  console.log("Stockage du fichier audio:", id);
  
  const useOneDrive = await isOneDriveEnabled();
  console.log("Using storage provider:", useOneDrive ? "OneDrive" : "Supabase");
  
  let fileToUpload: File;
  if (typeof file === 'string') {
    try {
      console.log("Fetching file from URL:", file);
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
      console.log("Uploading file to OneDrive storage:", id);
      await uploadFileToOneDrive(fileToUpload, `audio/${id}`);
      return `audio/${id}`;
    } else {
      console.log("Uploading file to Supabase storage:", id);
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(id, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileToUpload.type || 'audio/mpeg'
        });

      if (error) {
        console.error("Erreur lors du stockage du fichier:", error);
        throw error;
      }

      console.log("File uploaded successfully:", data);
      return data.path;
    }
  } catch (error) {
    console.error("Erreur lors du stockage du fichier:", error);
    throw error;
  }
};

export const getAudioFile = async (path: string) => {
  console.log("=== RÉCUPÉRATION ULTRA-RAPIDE ===");
  console.log("⚡ Chemin:", path);
  const startTime = performance.now();
  
  if (!path) {
    throw new Error("Chemin du fichier non fourni");
  }

  try {
    // Vérification cache ULTRA-RAPIDE (Promise.race avec timeout)
    console.log("🚀 Cache check ultra-rapide...");
    const cacheCheck = Promise.race([
      isInCache(path).then(async (inCache) => {
        if (inCache) {
          const cachedUrl = await getFromCache(path);
          if (cachedUrl) {
            const elapsed = performance.now() - startTime;
            console.log("⚡ CACHE HIT:", elapsed.toFixed(1), "ms");
            return cachedUrl;
          }
        }
        return null;
      }),
      new Promise(resolve => setTimeout(() => resolve(null), 50)) // Timeout cache à 50ms
    ]);

    const cachedResult = await cacheCheck;
    if (cachedResult) {
      return cachedResult;
    }

    // Récupération réseau optimisée
    console.log("📡 Récupération réseau rapide...");
    const useOneDrive = await isOneDriveEnabled();
    console.log("Provider:", useOneDrive ? "OneDrive" : "Supabase");

    let audioUrl: string;
    
    if (useOneDrive) {
      console.log("⚡ OneDrive streaming...");
      try {
        audioUrl = await getOneDriveSharedLink(`audio/${path}`);
        console.log("✅ OneDrive URL:", (performance.now() - startTime).toFixed(1), "ms");
      } catch (oneDriveError) {
        console.error("❌ OneDrive error:", oneDriveError);
        throw new Error(`OneDrive indisponible: ${oneDriveError instanceof Error ? oneDriveError.message : 'Erreur inconnue'}`);
      }
    } else {
      console.log("⚡ Supabase streaming...");
      
      // Vérification d'existence rapide (avec timeout)
      const fileCheckPromise = Promise.race([
        supabase.storage.from('audio').list('', { search: path }).then(({ data, error }) => {
          if (error) throw error;
          return data && data.length > 0;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
      ]);

      try {
        const fileExists = await fileCheckPromise;
        if (!fileExists) {
          throw new Error(`Fichier non trouvé: ${path}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Timeout") {
          console.warn("⚠️ Vérification fichier timeout - tentative directe");
        } else {
          throw error;
        }
      }

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
      console.log("✅ Supabase URL:", (performance.now() - startTime).toFixed(1), "ms");
    }

    // Mise en cache différée (ne pas bloquer le streaming)
    console.log("💾 Cache arrière-plan démarré");
    setTimeout(async () => {
      try {
        if (!(await isInCache(path))) {
          console.log("📡 Téléchargement cache...");
          const response = await fetch(audioUrl);
          if (response.ok) {
            const blob = await response.blob();
            await addToCache(path, blob);
            console.log("✅ Cache terminé:", blob.size, "bytes");
          }
        }
      } catch (cacheError) {
        console.warn("⚠️ Cache arrière-plan échoué:", cacheError);
      }
    }, 200); // Démarrer après 200ms

    const totalElapsed = performance.now() - startTime;
    console.log("⚡ TOTAL:", totalElapsed.toFixed(1), "ms");
    console.log("=============================");
    return audioUrl;
  } catch (error) {
    console.error("❌ ERREUR RÉCUPÉRATION:", error);
    throw error;
  }
};

export const searchDeezerTrack = async (artist: string, title: string): Promise<string | null> => {
  try {
    const query = `${artist} ${title}`;
    console.log("Recherche Deezer pour:", { artist, title });
    
    const { data: supabaseData, error } = await supabase.functions.invoke('deezer-search', {
      body: { query }
    });
    
    if (error) {
      console.error("Erreur lors de l'appel à l'edge function Deezer:", error);
      return null;
    }

    console.log("Résultat de la recherche Deezer:", supabaseData);
    
    if (supabaseData?.data && supabaseData.data.length > 0) {
      const track = supabaseData.data[0];
      if (track.album?.cover_xl) {
        console.log("Pochette trouvée:", track.album.cover_xl);
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
