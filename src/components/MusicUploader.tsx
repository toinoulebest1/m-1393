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
  const [dragCounter, setDragCounter] = useState(0);

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
    console.log("Début du traitement pour:", file.name);
    
    if (!file.type.startsWith('audio/')) {
      toast.error("Type de fichier non supporté");
      return null;
    }

    const fileId = generateUUID();

    try {
      let { artist, title } = parseFileName(file.name);
      const metadataResult = await extractMetadata(file);
      
      if (metadataResult) {
        if (metadataResult.artist) artist = metadataResult.artist;
        if (metadataResult.title) title = metadataResult.title;
      }

      const songExists = await checkIfSongExists(artist, title);
      if (songExists) {
        toast.error(`"${title}" par ${artist} existe déjà dans la bibliothèque`);
        return null;
      }

      console.log("Stockage du fichier audio:", fileId);
      setUploadProgress(0);
      setIsUploading(true);

      await storeAudioFile(fileId, file);

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
          file_path: fileId,
          duration: formattedDuration,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (songError) {
        console.error("Erreur lors de l'enregistrement dans la base de données:", songError);
        toast.error("Erreur lors de l'enregistrement de la chanson");
        return null;
      }

      setIsUploading(false);
      setUploadProgress(0);

      return {
        id: fileId,
        title,
        artist,
        duration: formattedDuration,
        url: fileId,
        imageUrl,
        bitrate: formatBitrate(file.size, duration)
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
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-sm"
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
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
