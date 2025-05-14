
import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadFileToDropbox, getDropboxSharedLink } from './dropboxStorage';

export const storeAudioFile = async (id: string, file: File | string) => {
  console.log("Stockage du fichier audio:", id);
  
  // Check if we should use Dropbox instead of Supabase
  const useDropbox = isDropboxEnabled();
  console.log("Using storage provider:", useDropbox ? "Dropbox" : "Supabase");
  
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
    if (useDropbox) {
      console.log("Uploading file to Dropbox storage:", id);
      await uploadFileToDropbox(fileToUpload, `audio/${id}`);
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
  console.log("Récupération du fichier audio:", path);
  
  if (!path) {
    console.error("Chemin du fichier non fourni");
    throw new Error("Chemin du fichier non fourni");
  }

  // Check if we should use Dropbox instead of Supabase
  const useDropbox = isDropboxEnabled();
  console.log("Using storage provider for retrieval:", useDropbox ? "Dropbox" : "Supabase");

  try {
    if (useDropbox) {
      return await getDropboxSharedLink(`audio/${path}`);
    }
    
    // Amélioration de la détection du bucket audio
    console.log("Checking if audio bucket exists...");
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("Erreur lors de la vérification des buckets:", bucketsError);
      throw bucketsError;
    }
    
    const audioBucketExists = buckets?.some(bucket => bucket.name === 'audio');
    
    if (!audioBucketExists) {
      console.log("Audio bucket doesn't exist. Creating now...");
      // Création automatique du bucket audio s'il n'existe pas
      const { error: createBucketError } = await supabase.storage.createBucket('audio', {
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (createBucketError) {
        console.error("Erreur lors de la création du bucket audio:", createBucketError);
        throw createBucketError;
      }
      console.log("Audio bucket created successfully");
    }
    
    // Vérifier si le fichier existe
    console.log("Checking if file exists in the audio bucket:", path);
    const { data: fileExists, error: fileExistsError } = await supabase.storage
      .from('audio')
      .list('', {
        search: path
      });

    if (fileExistsError) {
      console.error("Erreur lors de la vérification du fichier:", fileExistsError);
      throw fileExistsError;
    }

    if (!fileExists || fileExists.length === 0) {
      console.error("Fichier non trouvé dans le stockage:", path);
      throw new Error("Fichier audio non trouvé");
    }

    console.log("File found. Creating signed URL.");
    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(path, 3600);

    if (error) {
      console.error("Erreur lors de la création de l'URL signée:", error);
      
      // Tenter de récupérer l'URL publique comme solution de secours
      console.log("Trying to get public URL as fallback...");
      const { data: publicUrlData } = supabase.storage
        .from('audio')
        .getPublicUrl(path);
      
      if (publicUrlData?.publicUrl) {
        console.log("Using public URL instead:", publicUrlData.publicUrl);
        return publicUrlData.publicUrl;
      }
      
      throw error;
    }

    if (!data?.signedUrl) {
      console.error("URL signée non générée");
      throw new Error("URL signée non générée");
    }

    console.log("Signed URL generated successfully:", data.signedUrl);
    return data.signedUrl;
  } catch (error) {
    console.error("Erreur lors de la récupération du fichier:", error);
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

// Enhanced function to store playlist cover images
export const storePlaylistCover = async (playlistId: string, file: File | string | Blob) => {
  console.log("Storing playlist cover for:", playlistId, typeof file);
  
  try {
    // First, check if the 'media' bucket exists, and create it if it doesn't
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError);
      throw bucketsError;
    }
    
    const mediaBucketExists = buckets?.some(bucket => bucket.name === 'media');
    
    if (!mediaBucketExists) {
      console.log("Media bucket doesn't exist. Creating now...");
      // We need to create the bucket first since it doesn't exist
      const { error: createBucketError } = await supabase.storage.createBucket('media', {
        public: true,
        fileSizeLimit: 5242880 // 5MB
      });
      
      if (createBucketError) {
        console.error("Error creating media bucket:", createBucketError);
        throw createBucketError;
      }
      console.log("Media bucket created successfully");
    }
    
    let fileToUpload: File;
    
    if (file instanceof Blob) {
      fileToUpload = new File([file], `playlist-${playlistId}.jpg`, { 
        type: 'image/jpeg' 
      });
      console.log("Converted Blob to File object");
    } else if (typeof file === 'string') {
      // Handle data URL or remote URL
      if (file.startsWith('data:')) {
        console.log("Processing data URL");
        // Convert data URL to Blob
        const response = await fetch(file);
        const blob = await response.blob();
        fileToUpload = new File([blob], `playlist-${playlistId}.jpg`, { 
          type: 'image/jpeg' 
        });
        console.log("Converted data URL to File object", blob.size, "bytes");
      } else {
        console.log("Fetching remote URL:", file);
        // Fetch remote URL
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
    
    // Make sure we have a valid image file before proceeding
    if (!fileToUpload || fileToUpload.size === 0) {
      console.error("Invalid file or empty file");
      throw new Error("Invalid or empty file");
    }
    
    const fileName = `playlist-covers/${playlistId}.jpg`;
    console.log(`Uploading playlist cover to storage: ${fileName}, size: ${fileToUpload.size} bytes`);
    
    // Upload the file
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
    
    // Get public URL with cache-busting parameter
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

// New function to fetch an existing playlist cover
export const getPlaylistCover = async (playlistId: string): Promise<string | null> => {
  try {
    const fileName = `playlist-covers/${playlistId}.jpg`;
    
    // Check if the file exists
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
    
    // Get public URL with cache-busting parameter
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

// Better image generation with error handling and higher quality
export const generateImageFromSongs = async (songs: any[]): Promise<string | null> => {
  try {
    // Filter songs that have images
    const songsWithImages = songs.filter(song => 
      song.songs?.imageUrl && song.songs.imageUrl.startsWith('http')
    );
    
    console.log(`Generating playlist cover from ${songsWithImages.length} songs with images`);
    
    if (songsWithImages.length === 0) {
      console.log("No songs with valid image URLs found");
      return null;
    }
    
    // Create canvas with higher resolution
    const canvas = document.createElement('canvas');
    canvas.width = 600;  // Higher resolution
    canvas.height = 600; // Higher resolution
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get canvas context");
      return null;
    }

    // Fill with dark background
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Determine grid size based on number of images (up to 4)
    const gridSize = Math.min(songsWithImages.length, 4) === 1 ? 1 : 2;
    const imageSize = canvas.width / gridSize;
    
    console.log(`Using grid size: ${gridSize}x${gridSize}, image size: ${imageSize}px`);

    // Load images with proper error handling
    const loadImage = (url: string): Promise<HTMLImageElement | null> => {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => {
          console.error(`Error loading image ${url}:`, e);
          resolve(null);
        };
        // Add cache-busting parameter
        const cacheBuster = `?t=${new Date().getTime()}`;
        img.src = url.includes('?') ? `${url}&cb=${cacheBuster}` : `${url}${cacheBuster}`;
      });
    };

    // Process images in parallel with proper error handling
    const imagePromises = await Promise.all(
      songsWithImages.slice(0, 4).map(song => loadImage(song.songs.imageUrl))
    );
    
    // Filter out any failed images
    const validImages = imagePromises.filter(img => img !== null) as HTMLImageElement[];
    
    console.log(`Successfully loaded ${validImages.length} images out of ${songsWithImages.length} attempted`);
    
    if (validImages.length === 0) {
      console.log("No images could be loaded successfully");
      return null;
    }

    // Draw valid images to the canvas
    validImages.forEach((img, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      ctx.drawImage(img, col * imageSize, row * imageSize, imageSize, imageSize);
      console.log(`Drew image ${index + 1} at position [${row},${col}]`);
    });

    // Convert to high-quality data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    console.log(`Generated data URL of length ${dataUrl.length}`);
    
    return dataUrl;
  } catch (error) {
    console.error('Error generating playlist cover:', error);
    return null;
  }
};
