import { useState, useEffect, useRef } from 'react';
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlayer } from "@/contexts/PlayerContext";
import * as mm from 'music-metadata-browser';
import { storeAudioFile, searchDeezerTrack } from "@/utils/storage";
import { isDropboxEnabled } from "@/utils/dropboxStorage";
import { isGofileEnabled, uploadToGofile, storeGofileReference } from "@/utils/gofileStorage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseLrc, lrcToPlainText } from "@/utils/lrcParser";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  bitrate?: string;
}

export const MusicUploader = () => {
  const { t } = useTranslation();
  const { addToQueue } = usePlayer();
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToastId, setUploadToastId] = useState<string | number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [storageProvider, setStorageProvider] = useState<string>("Supabase");
  // Référence pour stocker temporairement les fichiers LRC trouvés
  const lrcFilesRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    // Check which storage provider is active
    const checkStorageProvider = () => {
      if (isGofileEnabled()) {
        setStorageProvider("Gofile");
      } else if (isDropboxEnabled()) {
        setStorageProvider("Dropbox");
      } else {
        setStorageProvider("Supabase");
      }
    };
    
    checkStorageProvider();
    
    // Re-check when the window gets focus
    const handleFocus = () => {
      checkStorageProvider();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatBitrate = (size: number, duration: number) => {
    const bitsPerSecond = (size * 8) / duration;
    const kbps = Math.round(bitsPerSecond / 1000);
    return `${kbps} kbps`;
  };

  const parseFileName = (fileName: string) => {
    // Supprimer l'extension de fichier
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const match = nameWithoutExt.match(/^(.*?)\s*-\s*(.*)$/);
    
    if (match) {
      return {
        artist: match[1].trim(),
        title: match[2].trim()
      };
    }
    
    return {
      artist: "Unknown Artist",
      title: nameWithoutExt.trim()
    };
  };

  const extractMetadata = async (file: File) => {
    try {
      console.log("Tentative d'extraction des métadonnées pour:", file.name);
      const metadata = await mm.parseBlob(file);
      console.log("Métadonnées extraites avec succès:", metadata.common);
      
      if (!metadata.common.picture || metadata.common.picture.length === 0) {
        console.log("Pas de pochette dans les métadonnées");
        return {
          artist: metadata.common.artist,
          title: metadata.common.title,
          picture: undefined
        };
      }

      const picture = metadata.common.picture[0];
      console.log("Pochette trouvée dans les métadonnées:", {
        format: picture.format,
        taille: picture.data.length
      });

      return {
        artist: metadata.common.artist || undefined,
        title: metadata.common.title || undefined,
        picture: picture
      };
    } catch (error) {
      console.error("Erreur détaillée lors de l'extraction des métadonnées:", error);
      return null;
    }
  };

  // Fonction pour traiter un fichier LRC
  const processLrcFile = async (lrcFile: File, songId: string, title: string, artist: string): Promise<boolean> => {
    try {
      console.log(`Traitement du fichier LRC pour la chanson ${title}:`, lrcFile.name);
      
      // Lire le contenu du fichier LRC
      const lrcContent = await lrcFile.text();
      
      // Parser le fichier LRC
      const parsedLrc = parseLrc(lrcContent);
      console.log("Fichier LRC parsé:", parsedLrc);
      
      if (parsedLrc.lines.length === 0) {
        console.log("Le fichier LRC ne contient pas de paroles valides");
        return false;
      }
      
      // Convertir en texte brut pour stockage dans la base de données
      const lyricsText = lrcToPlainText(parsedLrc);
      
      // Enregistrer les paroles dans la base de données
      const { error } = await supabase
        .from('lyrics')
        .insert({
          song_id: songId,
          content: lyricsText
        });
      
      if (error) {
        console.error("Erreur lors de l'enregistrement des paroles:", error);
        return false;
      }
      
      console.log("Paroles du fichier LRC enregistrées avec succès pour:", songId);
      return true;
    } catch (error) {
      console.error("Erreur lors du traitement du fichier LRC:", error);
      return false;
    }
  };

  const fetchLyrics = async (title: string, artist: string, songId: string) => {
    try {
      console.log(`Récupération des paroles pour: ${title} de ${artist}`);
      
      const { data, error } = await supabase.functions.invoke('generate-lyrics', {
        body: { songTitle: title, artist: artist }
      });
      
      if (error) {
        console.error("Erreur lors de la récupération des paroles:", error);
        return null;
      }
      
      if (data && data.lyrics) {
        console.log("Paroles récupérées avec succès");
        
        // Enregistrer les paroles dans la base de données
        const { error: saveLyricsError } = await supabase
          .from('lyrics')
          .insert({
            song_id: songId,
            content: data.lyrics
          });
        
        if (saveLyricsError) {
          console.error("Erreur lors de l'enregistrement des paroles:", saveLyricsError);
        } else {
          console.log("Paroles enregistrées avec succès pour:", songId);
        }
        
        return data.lyrics;
      }
      
      return null;
    } catch (error) {
      console.error("Erreur lors de la récupération des paroles:", error);
      return null;
    }
  };

  const checkIfSongExists = async (artist: string, title: string): Promise<boolean> => {
    try {
      const { data: existingSongs, error } = await supabase
        .from('songs')
        .select('id')
        .ilike('artist', artist)
        .ilike('title', title)
        .limit(1);

      if (error) {
        console.error("Erreur lors de la vérification de la chanson:", error);
        return false;
      }

      return existingSongs && existingSongs.length > 0;
    } catch (error) {
      console.error("Erreur lors de la vérification de la chanson:", error);
      return false;
    }
  };

  const processAudioFile = async (file: File) => {
    console.log("Beginning processing for:", file.name);
    
    if (!file.type.startsWith('audio/')) {
      toast.error("Unsupported file type");
      return null;
    }

    // Generate a UUID that matches the TypeScript template literal type requirement
    const fileId = crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`;

    try {
      let { artist, title } = parseFileName(file.name);
      const metadataResult = await extractMetadata(file);
      
      if (metadataResult) {
        if (metadataResult.artist) artist = metadataResult.artist;
        if (metadataResult.title) title = metadataResult.title;
      }

      const songExists = await checkIfSongExists(artist, title);
      if (songExists) {
        toast.error(`"${title}" by ${artist} already exists in the library`);
        return null;
      }

      console.log("Storing audio file:", fileId);
      setUploadProgress(0);
      setIsUploading(true);

      // Choose where to store the file based on the active provider
      let fileUrl = fileId; // By default, the file ID is used for Supabase
      
      if (storageProvider === "Gofile") {
        // Upload to Gofile.io
        fileUrl = await uploadToGofile(file);
        console.log("File successfully uploaded to Gofile:", fileUrl);
        
        // Store the Gofile reference in the database
        await storeGofileReference(fileId, fileUrl);
      } else {
        // Upload to Supabase or Dropbox (existing behavior)
        await storeAudioFile(fileId, file);
      }

      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio();
      
      const duration = await new Promise<number>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => {
          resolve(audio.duration);
        });
        audio.addEventListener('error', (e) => {
          console.error("Erreur lors du chargement de l'audio:", e);
          reject(e);
        });
        audio.src = audioUrl;
      });

      const formattedDuration = formatDuration(duration);
      URL.revokeObjectURL(audioUrl);

      let imageUrl = "https://picsum.photos/240/240";
      
      if (metadataResult?.picture) {
        try {
          const blob = new Blob([metadataResult.picture.data], { type: metadataResult.picture.format });
          imageUrl = URL.createObjectURL(blob);
          console.log("Pochette créée depuis les métadonnées");
        } catch (error) {
          console.error("Erreur lors de la création du blob:", error);
        }
      }

      if (imageUrl === "https://picsum.photos/240/240") {
        const deezerCover = await searchDeezerTrack(artist, title);
        if (deezerCover) {
          console.log("Pochette Deezer trouvée:", deezerCover);
          imageUrl = deezerCover;
        }
      }

      const { data: songData, error: songError } = await supabase
        .from('songs')
        .insert({
          id: fileId,
          title: title,
          artist: artist,
          file_path: storageProvider === "Gofile" ? fileUrl : fileId,
          duration: formattedDuration,
          image_url: imageUrl,
          storage_provider: storageProvider.toLowerCase()  // Ajout du provider
        })
        .select()
        .single();

      if (songError) {
        console.error("Erreur lors de l'enregistrement dans la base de données:", songError);
        toast.error("Erreur lors de l'enregistrement de la chanson");
        return null;
      }
      
      // Vérifier si un fichier LRC correspondant a été trouvé
      const baseFileName = file.name.replace(/\.[^/.]+$/, "");
      const lrcFileName = `${baseFileName}.lrc`;
      
      console.log("Recherche d'un fichier LRC correspondant:", lrcFileName);
      
      let lyricsFound = false;
      
      // Vérifier si nous avons un fichier LRC correspondant dans notre cache temporaire
      if (lrcFilesRef.current.has(lrcFileName)) {
        console.log("Fichier LRC correspondant trouvé dans le cache:", lrcFileName);
        const lrcFile = lrcFilesRef.current.get(lrcFileName)!;
        lyricsFound = await processLrcFile(lrcFile, fileId, title, artist);
        
        if (lyricsFound) {
          toast.success(`Paroles importées depuis le fichier ${lrcFileName}`);
        }
      }
      
      // Si aucun fichier LRC n'a été trouvé, essayer de récupérer les paroles en ligne
      if (!lyricsFound && artist !== "Unknown Artist") {
        // Toast de chargement des paroles
        const lyricsToastId = toast.loading(`Récupération des paroles pour "${title}"...`);
        
        // Récupération des paroles en arrière-plan
        fetchLyrics(title, artist, fileId).then(lyrics => {
          if (lyrics) {
            toast.success(`Paroles récupérées pour "${title}"`, {
              id: lyricsToastId
            });
          } else {
            toast.error(`Impossible de trouver les paroles pour "${title}"`, {
              id: lyricsToastId
            });
          }
        });
      }

      setIsUploading(false);
      setUploadProgress(0);

      return {
        id: fileId,
        title,
        artist,
        duration: formattedDuration,
        url: fileUrl,
        imageUrl,
        bitrate: formatBitrate(file.size, duration)
      };

    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Error uploading file");
      setIsUploading(false);
      setUploadProgress(0);
      return null;
    }
  };

  const processFiles = async (files: FileList | File[]) => {
    // Réinitialiser le cache des fichiers LRC
    lrcFilesRef.current.clear();
    
    const allFiles = Array.from(files);
    const audioFiles: File[] = [];
    
    // Première passe pour identifier les fichiers audio et LRC
    allFiles.forEach(file => {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.lrc')) {
        // Stocker temporairement les fichiers LRC par nom
        lrcFilesRef.current.set(file.name, file);
        console.log("Fichier LRC détecté et mis en cache:", file.name);
      } else if (file.type.startsWith('audio/')) {
        audioFiles.push(file);
      }
    });
    
    if (audioFiles.length === 0) {
      toast.error("Aucun fichier audio trouvé");
      return;
    }

    console.log("Nombre de fichiers audio trouvés:", audioFiles.length);
    console.log("Nombre de fichiers LRC trouvés:", lrcFilesRef.current.size);

    const processedSongs = await Promise.all(
      audioFiles.map(processAudioFile)
    );

    const validSongs = processedSongs.filter((song): song is NonNullable<typeof song> => song !== null);
    console.log("Chansons valides traitées:", validSongs);

    if (validSongs.length > 0) {
      validSongs.forEach(song => addToQueue(song));
    }
    
    // Nettoyer le cache des fichiers LRC
    lrcFilesRef.current.clear();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(0);
    setIsDragging(false);

    // Vérifier si nous avons des fichiers
    if (e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items);
      const files: File[] = [];

      const processEntry = async (entry: FileSystemEntry | null) => {
        if (!entry) return;
        
        if (entry.isFile) {
          const file = await new Promise<File>((resolve) => {
            (entry as FileSystemFileEntry).file(resolve);
          });
          if (file.type.startsWith('audio/')) {
            files.push(file);
          }
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          try {
            const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
              reader.readEntries((entries) => resolve(entries), reject);
            });
            await Promise.all(entries.map(processEntry));
          } catch (error) {
            console.error("Erreur lors de la lecture du dossier:", error);
          }
        }
      };

      try {
        await Promise.all(
          items
            .map(item => item.webkitGetAsEntry())
            .filter((entry): entry is FileSystemEntry => entry !== null)
            .map(processEntry)
        );

        if (files.length > 0) {
          await processFiles(files);
        } else {
          // Essayer de récupérer les fichiers directement si la méthode webkitGetAsEntry a échoué
          const directFiles = Array.from(e.dataTransfer.files);
          if (directFiles.length > 0) {
            await processFiles(directFiles);
          } else {
            toast.error("Aucun fichier audio trouvé dans le dossier");
          }
        }
      } catch (error) {
        console.error("Erreur lors du traitement des fichiers:", error);
        toast.error("Erreur lors du traitement des fichiers");
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter - 1 === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Modified function to handle both single file and directory uploads
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    // Réinitialiser l'input pour permettre de sélectionner le même dossier plusieurs fois
    event.target.value = '';
  };

  return (
    <div 
      className={cn(
        "p-4 relative transition-all duration-300",
        isDragging && "bg-white/5 rounded-lg"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2">
          {/* Single file upload button */}
          <label className="flex items-center space-x-2 text-spotify-neutral hover:text-white cursor-pointer transition-colors">
            <Upload className="w-5 h-5" />
            <span>{t('common.upload')} un fichier</span>
            <input
              type="file"
              accept="audio/*,.lrc"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          
          {/* Directory upload button */}
          <label className="flex items-center space-x-2 text-spotify-neutral hover:text-white cursor-pointer transition-colors">
            <Upload className="w-5 h-5" />
            <span>{t('common.upload')} un dossier</span>
            <input
              type="file"
              accept="audio/*,.lrc"
              multiple
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-spotify-neutral">
            Using:
          </span>
          <Select
            defaultValue={storageProvider.toLowerCase()}
            onValueChange={(value) => setStorageProvider(value === "gofile" ? "Gofile" : 
                                              value === "dropbox" ? "Dropbox" : "Supabase")}
          >
            <SelectTrigger className="h-8 w-28">
              <SelectValue placeholder="Storage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gofile">Gofile.io</SelectItem>
              <SelectItem value="dropbox">Dropbox</SelectItem>
              <SelectItem value="supabase">Supabase</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {isDragging && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-sm"
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleLeave}
          onDrop={handleDrop}
        >
          <p className="text-white text-lg font-medium">
            Déposez vos fichiers ici
          </p>
        </div>
      )}
    </div>
  );
};
