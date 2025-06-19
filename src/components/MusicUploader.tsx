
import { useState, useEffect } from 'react';
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlayer } from "@/contexts/PlayerContext";
import { storeAudioFile, searchDeezerTrack } from "@/utils/storage";
import { isOneDriveEnabled } from "@/utils/oneDriveStorage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GlobalUploadProgress } from "@/components/GlobalUploadProgress";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { ParallelUploadService } from "@/services/uploadService";
import { uploadFileInChunks } from "@/utils/chunkUpload";
import { useUploadState } from "@/hooks/useUploadState";
import { formatDuration, formatBitrate, parseFileName, generateUUID } from "@/utils/fileUtils";
import { extractMetadata } from "@/utils/metadataExtraction";
import { processLyricsInBackground } from "@/utils/lyricsProcessor";
import { checkIfSongExists } from "@/utils/songChecker";
import { handleDrop, handleDragEnter, handleDragLeave, handleDragOver } from "@/utils/dragHandler";

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
  
  const {
    uploadProgress,
    setUploadProgress,
    isUploading,
    setIsUploading,
    isDragging,
    setIsDragging,
    dragCounter,
    setDragCounter,
    storageProvider,
    setStorageProvider,
    currentUploadingSong,
    setCurrentUploadingSong,
    lrcFilesRef
  } = useUploadState();
  
  // Nouveau hook pour la progression globale
  const { stats: globalStats, startUpload, updateProgress, completeUpload } = useUploadProgress();

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
        processLyricsInBackground(file, fileId, title, artist, lrcFilesRef);
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
        onDrop={(e) => handleDrop(e, setDragCounter, setIsDragging, processFiles)}
        onDragOver={handleDragOver}
        onDragEnter={(e) => handleDragEnter(e, setDragCounter, setIsDragging)}
        onDragLeave={(e) => handleDragLeave(e, dragCounter, setDragCounter, setIsDragging)}
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
            onDragEnter={(e) => handleDragEnter(e, setDragCounter, setIsDragging)}
            onDragLeave={(e) => handleDragLeave(e, dragCounter, setDragCounter, setIsDragging)}
            onDrop={(e) => handleDrop(e, setDragCounter, setIsDragging, processFiles)}
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
