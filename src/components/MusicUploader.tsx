import { useState, useEffect } from 'react';
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlayer } from "@/contexts/PlayerContext";
import * as mm from 'music-metadata-browser';
import { storeAudioFile } from "@/utils/storage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [uploadToastId, setUploadToastId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isUploading && uploadProgress > 0) {
      if (!uploadToastId) {
        const id = toast.loading("Upload en cours...", {
          description: `${uploadProgress}%`
        }).toString();
        setUploadToastId(id);
      } else {
        toast.loading("Upload en cours...", {
          id: uploadToastId,
          description: `${uploadProgress}%`
        });
      }
    } else if (!isUploading && uploadToastId) {
      toast.success("Upload terminé!", {
        id: uploadToastId
      });
      setUploadToastId(null);
    }
  }, [uploadProgress, isUploading]);

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

  const generateUUID = () => {
    return crypto.randomUUID();
  };

  const searchDeezerTrack = async (artist: string, title: string): Promise<string | null> => {
    try {
      const query = encodeURIComponent(`${artist} ${title}`);
      console.log("Recherche Deezer pour:", { artist, title });
      
      const response = await fetch(`https://cors-anywhere.herokuapp.com/https://api.deezer.com/search?q=${query}`);
      
      if (!response.ok) {
        console.error("Erreur API Deezer:", response.status);
        return null;
      }

      const data = await response.json();
      console.log("Résultat de la recherche Deezer:", data);
      
      if (data.data && data.data.length > 0) {
        const track = data.data[0];
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

  const processAudioFile = async (file: File) => {
    console.log("Début du traitement pour:", file.name);
    
    if (!file.type.startsWith('audio/')) {
      toast.error("Type de fichier non supporté");
      return null;
    }

    const fileId = generateUUID();

    try {
      console.log("Stockage du fichier audio:", fileId);
      setUploadProgress(0);
      setIsUploading(true);

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + 5;
          if (newProgress >= 90) {
            clearInterval(progressInterval);
          }
          return Math.min(newProgress, 90);
        });
      }, 100);

      await storeAudioFile(fileId, file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      
      const duration = await new Promise<number>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => {
          resolve(audio.duration);
        });
        audio.addEventListener('error', (e) => {
          console.error("Erreur lors du chargement de l'audio:", e);
          reject(e);
        });
      });

      const bitrate = formatBitrate(file.size, duration);
      console.log("Informations du fichier:", {
        taille: file.size,
        duree: duration,
        bitrate: bitrate
      });

      URL.revokeObjectURL(audioUrl);

      let imageUrl = "https://picsum.photos/240/240";
      let { artist, title } = parseFileName(file.name);
      console.log("Informations extraites du nom:", { artist, title });

      const metadataResult = await extractMetadata(file);
      if (metadataResult) {
        if (metadataResult.artist) {
          console.log("Artiste trouvé dans les métadonnées:", metadataResult.artist);
          artist = metadataResult.artist;
        }
        if (metadataResult.title) {
          console.log("Titre trouvé dans les métadonnées:", metadataResult.title);
          title = metadataResult.title;
        }
        
        if (metadataResult.picture) {
          try {
            const blob = new Blob([metadataResult.picture.data], { type: metadataResult.picture.format });
            imageUrl = URL.createObjectURL(blob);
            console.log("Pochette créée depuis les métadonnées");
          } catch (error) {
            console.error("Erreur lors de la création du blob:", error);
          }
        }
      }

      if (imageUrl === "https://picsum.photos/240/240") {
        const deezerCover = await searchDeezerTrack(artist, title);
        if (deezerCover) {
          console.log("Pochette Deezer trouvée:", deezerCover);
          imageUrl = deezerCover;
        } else {
          console.log("Aucune pochette trouvée sur Deezer");
        }
      }

      setIsUploading(false);
      setUploadProgress(0);

      return {
        id: fileId,
        title,
        artist,
        duration: formatDuration(duration),
        url: fileId,
        imageUrl,
        bitrate
      };

    } catch (error) {
      console.error("Erreur lors du traitement du fichier:", error);
      toast.error("Erreur lors de l'upload du fichier");
      setIsUploading(false);
      setUploadProgress(0);
      return null;
    }
  };

  const processFiles = async (files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'));
    
    if (audioFiles.length === 0) {
      toast.error("Aucun fichier audio trouvé");
      return;
    }

    console.log("Nombre de fichiers audio trouvés:", audioFiles.length);

    const processedSongs = await Promise.all(
      audioFiles.map(processAudioFile)
    );

    const validSongs = processedSongs.filter((song): song is NonNullable<typeof song> => song !== null);
    console.log("Chansons valides traitées:", validSongs);

    if (validSongs.length > 0) {
      validSongs.forEach(song => addToQueue(song));
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    const processEntry = async (entry: FileSystemEntry) => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => {
          (entry as FileSystemFileEntry).file(resolve);
        });
        if (file.type.startsWith('audio/')) {
          files.push(file);
        }
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve) => {
          reader.readEntries(resolve);
        });
        await Promise.all(entries.map(processEntry));
      }
    };

    await Promise.all(
      items
        .filter(item => item.webkitGetAsEntry())
        .map(item => processEntry(item.webkitGetAsEntry()!))
    );

    if (files.length > 0) {
      await processFiles(files);
    } else {
      toast.error("Aucun fichier audio trouvé dans le dossier");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
  };

  return (
    <div 
      className={cn(
        "p-4 relative transition-all duration-300",
        isDragging && "bg-white/5 rounded-lg"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <label className="flex items-center space-x-2 text-spotify-neutral hover:text-white cursor-pointer transition-colors">
        <Upload className="w-5 h-5" />
        <span>{t('common.upload')}</span>
        <input
          type="file"
          accept="audio/*"
          multiple
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={handleFileUpload}
        />
      </label>
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-sm">
          <p className="text-white text-lg font-medium">
            Déposez vos fichiers ici
          </p>
        </div>
      )}
    </div>
  );
};
