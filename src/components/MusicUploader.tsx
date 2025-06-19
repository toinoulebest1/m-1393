import { useState, useEffect, useRef } from 'react';
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlayer } from "@/contexts/PlayerContext";
import { storeAudioFile, searchDeezerTrack } from "@/utils/storage";
import { isOneDriveEnabled } from "@/utils/oneDriveStorage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseLrc, lrcToPlainText } from "@/utils/lrcParser";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GlobalUploadProgress } from "@/components/GlobalUploadProgress";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { ParallelUploadService } from "@/services/uploadService";
import { uploadFileInChunks } from "@/utils/chunkUpload";

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
  const [currentUploadingSong, setCurrentUploadingSong] = useState<string | null>(null);
  const lrcFilesRef = useRef<Map<string, File>>(new Map());
  
  // Nouveau hook pour la progression globale
  const { stats: globalStats, startUpload, updateProgress, completeUpload, cancelUpload } = useUploadProgress();

  useEffect(() => {
    // Check which storage provider is active
    const checkStorageProvider = () => {
      const useOneDrive = isOneDriveEnabled();
      setStorageProvider(useOneDrive ? "OneDrive" : "Supabase");
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

  const generateUUID = () => {
    return crypto.randomUUID();
  };

  // Extraction métadonnées simplifiée pour éviter les erreurs Buffer
  const extractMetadata = async (file: File) => {
    try {
      console.log("Tentative d'extraction des métadonnées pour:", file.name);
      
      // Pour les fichiers FLAC, on skip l'extraction de métadonnées pour éviter l'erreur Buffer
      if (file.name.toLowerCase().endsWith('.flac')) {
        console.log("Fichier FLAC détecté - skip extraction métadonnées pour éviter erreur Buffer");
        return null;
      }
      
      // Dynamically import music-metadata-browser seulement pour les autres formats
      const mm = await import('music-metadata-browser');
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

  // Fonction modifiée pour traiter un fichier LRC et l'associer correctement à un fichier audio
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
      
      // Si OneDrive est activé, sauvegarder également les paroles brutes sur OneDrive
      if (isOneDriveEnabled()) {
        try {
          const { uploadLyricsToOneDrive } = await import('@/utils/oneDriveStorage');
          await uploadLyricsToOneDrive(songId, lrcContent);
          console.log("Contenu LRC brut téléchargé vers OneDrive");
        } catch (oneDriveError) {
          console.error("Erreur lors de l'upload du fichier LRC vers OneDrive:", oneDriveError);
          // Ne pas échouer complètement si l'upload OneDrive échoue
        }
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

  // Fonction pour traiter les paroles en arrière-plan
  const processLyricsInBackground = async (file: File, fileId: string, title: string, artist: string) => {
    try {
      const baseFileName = file.name.replace(/\.[^/.]+$/, "");
      const possibleLrcNames = [
        `${baseFileName}.lrc`,
        `${title}.lrc`,
        `${artist} - ${title}.lrc`,
        `${title} - ${artist}.lrc`,
        baseFileName.toLowerCase() + ".lrc",
        title.toLowerCase() + ".lrc",
        `${artist.toLowerCase()} - ${title.toLowerCase()}.lrc`
      ];
      
      let lyricsFound = false;
      let lrcFile: File | undefined;
      
      for (const lrcName of possibleLrcNames) {
        if (lrcFilesRef.current.has(lrcName)) {
          lrcFile = lrcFilesRef.current.get(lrcName);
          break;
        }
      }
      
      if (lrcFile) {
        lyricsFound = await processLrcFile(lrcFile, fileId, title, artist);
        if (lyricsFound) {
          toast.success(`Paroles synchronisées importées`);
        }
      } else if (artist !== "Unknown Artist") {
        const lyrics = await fetchLyrics(title, artist, fileId);
        if (lyrics) {
          toast.success(`Paroles récupérées pour "${title}"`);
        }
      }
    } catch (error) {
      console.warn("Erreur traitement paroles (non critique):", error);
    }
  };

  const processAudioFile = async (file: File, fileIndex: number, totalFiles: number) => {
    console.log("🎵 Traitement optimisé pour:", file.name);
    
    if (!file.type.startsWith('audio/')) {
      toast.error("Type de fichier non supporté");
      return null;
    }

    const fileId = generateUUID();
    setCurrentUploadingSong(file.name);

    try {
      let { artist, title } = parseFileName(file.name);
      
      // Extraction métadonnées en parallèle (seulement si pas FLAC)
      const metadataPromise = extractMetadata(file);
      const existsPromise = checkIfSongExists(artist, title);
      
      const [metadataResult, songExists] = await Promise.all([metadataPromise, existsPromise]);
      
      if (metadataResult) {
        if (metadataResult.artist) artist = metadataResult.artist;
        if (metadataResult.title) title = metadataResult.title;
      }

      if (songExists) {
        toast.error(`"${title}" par ${artist} existe déjà dans la bibliothèque`);
        return null;
      }

      console.log("⚡ Upload optimisé du fichier:", fileId);
      setIsUploading(true);

      // Upload avec chunks optimisé
      let uploadProgress = 0;
      const progressInterval = setInterval(() => {
        uploadProgress = Math.min(uploadProgress + 2, 90);
        setUploadProgress(uploadProgress);
      }, 50);

      await uploadFileInChunks(file, fileId, {
        onProgress: (progress) => {
          setUploadProgress(progress);
          updateProgress(file.name, fileIndex, 30 + (progress * 0.4));
        }
      });
      
      clearInterval(progressInterval);
      
      // Traitement audio en parallèle
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio();
      
      const [duration] = await Promise.all([
        new Promise<number>((resolve, reject) => {
          audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
          audio.addEventListener('error', reject);
          audio.src = audioUrl;
        })
      ]);

      URL.revokeObjectURL(audioUrl);
      const formattedDuration = formatDuration(duration);

      // Recherche de pochette en parallèle avec la base de données
      let imageUrl = "https://picsum.photos/240/240";
      const imagePromises = [];
      
      if (metadataResult?.picture) {
        imagePromises.push(
          Promise.resolve().then(() => {
            const blob = new Blob([metadataResult.picture.data], { type: metadataResult.picture.format });
            return URL.createObjectURL(blob);
          })
        );
      }
      
      imagePromises.push(searchDeezerTrack(artist, title));
      
      const imageResults = await Promise.allSettled(imagePromises);
      
      for (const result of imageResults) {
        if (result.status === 'fulfilled' && result.value) {
          imageUrl = result.value;
          break;
        }
      }

      // Insertion en base de données
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
        console.error("Erreur lors de l'enregistrement:", songError);
        toast.error("Erreur lors de l'enregistrement de la chanson");
        return null;
      }
      
      // Traitement des paroles en arrière-plan (non bloquant)
      setTimeout(() => {
        processLyricsInBackground(file, fileId, title, artist);
      }, 0);

      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUploadingSong(null);

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
      console.error("Erreur lors du traitement:", error);
      toast.error("Erreur lors de l'upload du fichier");
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUploadingSong(null);
      return null;
    }
  };

  const processFiles = async (files: FileList | File[]) => {
    lrcFilesRef.current.clear();
    
    const allFiles = Array.from(files);
    const audioFiles: File[] = [];
    
    // Identification des fichiers
    allFiles.forEach(file => {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.lrc')) {
        lrcFilesRef.current.set(file.name, file);
        console.log("📝 Fichier LRC détecté:", file.name);
        toast.info(`Fichier de paroles détecté: ${file.name}`);
      } else if (file.type.startsWith('audio/')) {
        audioFiles.push(file);
      }
    });
    
    if (audioFiles.length === 0) {
      toast.error("Aucun fichier audio trouvé");
      return;
    }

    console.log(`🚀 Upload parallèle de ${audioFiles.length} fichiers`);
    startUpload(audioFiles.length);

    // Service d'upload parallèle
    const uploadService = new ParallelUploadService(
      (progress) => {
        updateProgress(
          progress.currentFile || "Traitement...",
          progress.completed,
          progress.progress
        );
      },
      (results) => {
        completeUpload();
        
        const validSongs = results
          .filter(result => result.success && result.song)
          .map(result => result.song);

        console.log(`✅ Upload terminé: ${validSongs.length}/${audioFiles.length} réussis`);
        
        if (validSongs.length > 0) {
          validSongs.forEach(song => addToQueue(song));
          toast.success(`${validSongs.length} chanson(s) ajoutée(s) avec succès!`);
        }
        
        const failedCount = results.length - validSongs.length;
        if (failedCount > 0) {
          toast.error(`${failedCount} fichier(s) ont échoué`);
        }
        
        lrcFilesRef.current.clear();
      }
    );

    await uploadService.uploadFiles(audioFiles, processAudioFile);
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
    event.target.value = '';
  };

  return (
    <>
      <GlobalUploadProgress
        isVisible={globalStats.isUploading}
        progress={globalStats.progress}
        currentFile={globalStats.currentFile}
        filesProcessed={globalStats.filesProcessed}
        totalFiles={globalStats.totalFiles}
        estimatedTimeLeft={globalStats.estimatedTimeLeft}
        uploadSpeed={globalStats.uploadSpeed}
      />
      
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
          <div className="text-xs text-spotify-neutral">
            Using: {storageProvider}
          </div>
        </div>

        {/* Upload progress bar */}
        {isUploading && (
          <div className="mb-4 p-4 bg-spotify-dark/50 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-foreground">
                Upload en cours: {currentUploadingSong}
              </div>
              <div className="text-sm text-muted-foreground">
                {Math.round(uploadProgress)}%
              </div>
            </div>
            <Progress 
              value={uploadProgress} 
              className="h-2"
              indicatorClassName="bg-spotify-accent transition-all duration-300"
            />
          </div>
        )}

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
    </>
  );
};
