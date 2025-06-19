import { supabase } from '@/integrations/supabase/client';
import { isOneDriveEnabled, uploadFileToOneDrive, getOneDriveSharedLink } from './oneDriveStorage';
import { preloadAudio, isInCache, getFromCache, addToCache } from './audioCache';
import { memoryCache } from './memoryCache';

export const storeAudioFile = async (id: string, file: File | string) => {
  console.log("Stockage du fichier audio:", id);
  
  const useOneDrive = await isOneDriveEnabled();
  console.log("Provider de stockage:", useOneDrive ? "OneDrive" : "Supabase");
  
  let fileToUpload: File;
  if (typeof file === 'string') {
    try {
      console.log("Récupération fichier depuis URL:", file);
      const response = await fetch(file);
      if (!response.ok) {
        throw new Error(`Échec récupération: ${response.statusText}`);
      }
      const blob = await response.blob();
      fileToUpload = new File([blob], id, { type: blob.type || 'audio/mpeg' });
    } catch (error) {
      console.error("Erreur conversion URL:", error);
      throw error;
    }
  } else {
    fileToUpload = file;
  }

  try {
    if (useOneDrive) {
      console.log("Upload OneDrive:", id);
      await uploadFileToOneDrive(fileToUpload, `audio/${id}`);
      return `audio/${id}`;
    } else {
      console.log("Upload Supabase:", id);
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(id, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileToUpload.type || 'audio/mpeg'
        });

      if (error) {
        console.error("Erreur stockage:", error);
        throw error;
      }

      console.log("Upload réussi:", data);
      return data.path;
    }
  } catch (error) {
    console.error("Erreur stockage:", error);
    throw error;
  }
};

export const getAudioFile = async (path: string) => {
  console.log("=== RÉCUPÉRATION ULTRA-INSTANTANÉE ===");
  console.log("⚡ Chemin:", path);
  const startTime = performance.now();
  
  if (!path) {
    throw new Error("Chemin non fourni");
  }

  try {
    // 1. Cache mémoire ultra-rapide (< 1ms)
    console.log("⚡ Cache mémoire...");
    const memoryUrl = memoryCache.get(path);
    if (memoryUrl) {
      const elapsed = performance.now() - startTime;
      console.log("⚡ CACHE MÉMOIRE:", elapsed.toFixed(1), "ms");
      return memoryUrl;
    }

    // 2. Cache IndexedDB avec timeout ultra-court (2ms)
    console.log("💾 Cache IndexedDB...");
    const cacheCheck = Promise.race([
      isInCache(path).then(async (inCache) => {
        if (inCache) {
          const cachedUrl = await getFromCache(path);
          if (cachedUrl) {
            const elapsed = performance.now() - startTime;
            console.log("💾 CACHE INDEXEDDB:", elapsed.toFixed(1), "ms");
            
            // Ajouter au cache mémoire pour la prochaine fois
            memoryCache.set(path, cachedUrl);
            
            return cachedUrl;
          }
        }
        return null;
      }),
      new Promise(resolve => setTimeout(() => resolve(null), 2)) // 2ms timeout
    ]);

    const cachedResult = await cacheCheck;
    if (cachedResult) {
      return cachedResult;
    }

    // 3. Récupération réseau ultra-optimisée
    console.log("📡 Réseau ultra-rapide...");
    const useOneDrive = await isOneDriveEnabled();
    console.log("Provider:", useOneDrive ? "OneDrive" : "Supabase");

    let audioUrl: string;
    
    if (useOneDrive) {
      console.log("⚡ OneDrive...");
      try {
        audioUrl = await getOneDriveSharedLink(`audio/${path}`);
        console.log("✅ OneDrive:", (performance.now() - startTime).toFixed(1), "ms");
      } catch (oneDriveError) {
        console.error("❌ OneDrive:", oneDriveError);
        throw new Error(`OneDrive indisponible: ${oneDriveError instanceof Error ? oneDriveError.message : 'Erreur'}`);
      }
    } else {
      console.log("⚡ Supabase...");
      
      const { data, error } = await supabase.storage
        .from('audio')
        .createSignedUrl(path, 3600);

      if (error) {
        throw new Error(`Erreur URL: ${error.message}`);
      }

      if (!data?.signedUrl) {
        throw new Error("URL non générée");
      }

      audioUrl = data.signedUrl;
      console.log("✅ Supabase:", (performance.now() - startTime).toFixed(1), "ms");
    }

    // Ajouter au cache mémoire immédiatement
    memoryCache.set(path, audioUrl);

    // Cache différé ultra-rapide (25ms)
    console.log("💾 Cache différé");
    setTimeout(async () => {
      try {
        if (!(await isInCache(path))) {
          console.log("📡 Cache différé...");
          const response = await fetch(audioUrl);
          if (response.ok) {
            const blob = await response.blob();
            await addToCache(path, blob);
            console.log("✅ Cache:", (blob.size / 1024 / 1024).toFixed(1), "MB");
          }
        }
      } catch (e) {
        console.warn("⚠️ Cache différé échoué");
      }
    }, 25); // 25ms

    const totalElapsed = performance.now() - startTime;
    console.log("⚡ TOTAL:", totalElapsed.toFixed(1), "ms");
    console.log("==============================");
    return audioUrl;
  } catch (error) {
    console.error("❌ ERREUR:", error);
    throw error;
  }
};

export const searchDeezerTrack = async (artist: string, title: string): Promise<string | null> => {
  try {
    const query = `${artist} ${title}`;
    console.log("Recherche Deezer:", { artist, title });
    
    const { data: supabaseData, error } = await supabase.functions.invoke('deezer-search', {
      body: { query }
    });
    
    if (error) {
      console.error("Erreur Deezer:", error);
      return null;
    }

    console.log("Résultat Deezer:", supabaseData);
    
    if (supabaseData?.data && supabaseData.data.length > 0) {
      const track = supabaseData.data[0];
      if (track.album?.cover_xl) {
        console.log("Pochette trouvée:", track.album.cover_xl);
        return track.album.cover_xl;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Erreur recherche Deezer:", error);
    return "https://picsum.photos/240/240";
  }
};

export const storePlaylistCover = async (playlistId: string, file: File | string | Blob) => {
  console.log("Stockage couverture playlist:", playlistId, typeof file);
  
  try {
    let fileToUpload: File;
    
    if (file instanceof Blob) {
      fileToUpload = new File([file], `playlist-${playlistId}.jpg`, { 
        type: 'image/jpeg' 
      });
      console.log("Blob vers File");
    } else if (typeof file === 'string') {
      if (file.startsWith('data:')) {
        console.log("Data URL");
        const response = await fetch(file);
        const blob = await response.blob();
        fileToUpload = new File([blob], `playlist-${playlistId}.jpg`, { 
          type: 'image/jpeg' 
        });
        console.log("Data URL vers File", blob.size, "bytes");
      } else {
        console.log("URL distante:", file);
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`Échec récupération: ${response.statusText}`);
        }
        const blob = await response.blob();
        fileToUpload = new File([blob], `playlist-${playlistId}.jpg`, { 
          type: blob.type || 'image/jpeg' 
        });
        console.log("URL vers File", blob.size, "bytes");
      }
    } else {
      fileToUpload = file;
      console.log("File fourni");
    }
    
    if (!fileToUpload || fileToUpload.size === 0) {
      console.error("Fichier invalide");
      throw new Error("Fichier invalide");
    }
    
    const fileName = `playlist-covers/${playlistId}.jpg`;
    console.log(`Upload: ${fileName}, taille: ${fileToUpload.size} bytes`);
    
    const { data, error } = await supabase.storage
      .from('media')
      .upload(fileName, fileToUpload, {
        upsert: true,
        contentType: fileToUpload.type || 'image/jpeg',
        cacheControl: '3600'
      });
    
    if (error) {
      console.error("Erreur upload:", error);
      throw error;
    }
    
    console.log("Upload réussi:", data.path);
    
    const timestamp = new Date().getTime();
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(`${fileName}?t=${timestamp}`);
    
    console.log("URL publique:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Erreur stockage couverture:", error);
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
      console.log("Pas de couverture:", playlistId);
      return null;
    }
    
    const timestamp = new Date().getTime();
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(`${fileName}?t=${timestamp}`);
    
    console.log("Couverture trouvée:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Erreur récupération couverture:", error);
    return null;
  }
};

export const generateImageFromSongs = async (songs: any[]): Promise<string | null> => {
  try {
    const songsWithImages = songs.filter(song => 
      song.songs?.imageUrl && song.songs.imageUrl.startsWith('http')
    );
    
    console.log(`Génération couverture depuis ${songsWithImages.length} chansons`);
    
    if (songsWithImages.length === 0) {
      console.log("Aucune chanson avec image");
      return null;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Échec contexte canvas");
      return null;
    }

    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = Math.min(songsWithImages.length, 4) === 1 ? 1 : 2;
    const imageSize = canvas.width / gridSize;
    
    console.log(`Grille: ${gridSize}x${gridSize}, taille: ${imageSize}px`);

    const loadImage = (url: string): Promise<HTMLImageElement | null> => {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => {
          console.error(`Erreur image ${url}:`, e);
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
    
    console.log(`${validImages.length} images chargées sur ${songsWithImages.length}`);
    
    if (validImages.length === 0) {
      console.log("Aucune image chargée");
      return null;
    }

    validImages.forEach((img, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      ctx.drawImage(img, col * imageSize, row * imageSize, imageSize, imageSize);
      console.log(`Image ${index + 1} à [${row},${col}]`);
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    console.log(`Data URL générée: ${dataUrl.length} caractères`);
    
    return dataUrl;
  } catch (error) {
    console.error('Erreur génération couverture:', error);
    return null;
  }
};
