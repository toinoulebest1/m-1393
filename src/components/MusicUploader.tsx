import { useState, useEffect, useRef } from 'react';
import { Upload, FolderOpen, Music } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlayer } from "@/contexts/PlayerContext";
import * as mm from 'music-metadata-browser';
import { uploadAudioFile, searchDeezerTrack } from "@/utils/storage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseLrc, lrcToPlainText } from "@/utils/lrcParser";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  // Référence pour stocker temporairement les fichiers LRC trouvés
  const lrcFilesRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    // Always use Supabase as storage provider since OneDrive is removed
    setStorageProvider("Supabase");
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
      
      console.log("Paroles du fichier LRC enregistrées avec succès pour:", songId);
      return true;
    } catch (error) {
      console.error("Erreur lors du traitement du fichier LRC:", error);
      return false;
    }
  };

  const fetchLyrics = async (title: string, artist: string, songId: string, duration?: number, albumName?: string) => {
    try {
      console.log(`Récupération des paroles pour: ${title} de ${artist}`);
      
      const { data, error } = await supabase.functions.invoke('generate-lyrics', {
        body: { 
          songTitle: title, 
          artist: artist,
          duration: duration,
          albumName: albumName
        }
      });
      
      if (error) {
        console.error("Erreur lors de la récupération des paroles:", error);
        return null;
      }
      
      if (data && data.lyrics) {
        console.log("Paroles récupérées avec succès");
        
        // Utiliser syncedLyrics si disponible, sinon utiliser plainLyrics
        const lyricsContent = data.syncedLyrics || data.lyrics;
        
        // Enregistrer les paroles dans la base de données
        const { error: saveLyricsError } = await supabase
          .from('lyrics')
          .insert({
            song_id: songId,
            content: lyricsContent
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

  const checkIfSongExists = async (artist: string, title: string, duration?: number): Promise<boolean> => {
    try {
      // Normaliser les chaînes pour comparaison
      const normalizedArtist = artist.trim().toLowerCase();
      const normalizedTitle = title.trim().toLowerCase();
      
      const { data: existingSongs, error } = await supabase
        .from('songs')
        .select('id, title, artist, duration')
        .ilike('artist', normalizedArtist)
        .ilike('title', normalizedTitle);

      if (error) {
        console.error("Erreur lors de la vérification de la chanson:", error);
        return false;
      }

      if (!existingSongs || existingSongs.length === 0) {
        return false;
      }

      // Si la durée est fournie, vérifier avec une tolérance de ±2 secondes
      if (duration) {
        for (const song of existingSongs) {
          if (song.duration) {
            // Convertir la durée MM:SS en secondes
            const [minutes, seconds] = song.duration.split(':').map(Number);
            const songDuration = minutes * 60 + seconds;
            
            // Vérifier si la durée correspond avec ±2 secondes de tolérance
            if (Math.abs(songDuration - duration) <= 2) {
              console.log(`Doublon détecté: "${song.title}" par ${song.artist} (durées: ${songDuration}s vs ${duration}s)`);
              return true;
            }
          }
        }
        // Si aucune durée ne correspond, ce n'est pas un doublon
        return false;
      }

      // Sans durée, considérer comme doublon si titre et artiste correspondent
      return true;
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
    setCurrentUploadingSong(file.name);

    try {
      let { artist, title } = parseFileName(file.name);
      const metadataResult = await extractMetadata(file);
      
      if (metadataResult) {
        if (metadataResult.artist) artist = metadataResult.artist;
        if (metadataResult.title) title = metadataResult.title;
      }

      // Créer un objet audio temporaire pour obtenir la durée AVANT de vérifier les doublons
      const tempAudioUrl = URL.createObjectURL(file);
      const tempAudio = new Audio();
      
      const tempDuration = await new Promise<number>((resolve, reject) => {
        tempAudio.addEventListener('loadedmetadata', () => {
          resolve(tempAudio.duration);
        });
        tempAudio.addEventListener('error', (e) => {
          console.error("Erreur lors du chargement de l'audio:", e);
          reject(e);
        });
        tempAudio.src = tempAudioUrl;
      });
      
      URL.revokeObjectURL(tempAudioUrl);

      const songExists = await checkIfSongExists(artist, title, tempDuration);
      if (songExists) {
        toast.error(`"${title}" par ${artist} existe déjà dans la bibliothèque`);
        setCurrentUploadingSong(null);
        return null;
      }

      console.log("Stockage du fichier audio:", fileId);
      setUploadProgress(0);
      setIsUploading(true);

      // Simuler la progression d'upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      await uploadAudioFile(file, fileId);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

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
      
      // 1. Priorité à la pochette dans les métadonnées du fichier
      if (metadataResult?.picture) {
        try {
          const uint8Array = new Uint8Array(metadataResult.picture.data);
          const blob = new Blob([uint8Array.buffer], { type: metadataResult.picture.format });
          imageUrl = URL.createObjectURL(blob);
          console.log("Pochette créée depuis les métadonnées");
        } catch (error) {
          console.error("Erreur lors de la création du blob:", error);
        }
      }

      // 2. Si pas de pochette dans les métadonnées, utiliser Deezer
      if (imageUrl === "https://picsum.photos/240/240" && artist !== "Unknown Artist") {
        console.log("Recherche de pochette sur Deezer...");
        const deezerCover = await searchDeezerTrack(`${artist} ${title}`);
        if (deezerCover) {
          console.log("Pochette Deezer trouvée:", deezerCover);
          imageUrl = deezerCover;
          toast.success(`Pochette trouvée via Deezer pour "${title}"`);
        } else {
          console.log("Aucune pochette trouvée sur Deezer");
          toast.info(`Aucune pochette trouvée pour "${title}"`);
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
        setCurrentUploadingSong(null);
        return null;
      }
      
      // Recherche améliorée des fichiers LRC correspondants
      const baseFileName = file.name.replace(/\.[^/.]+$/, "");
      console.log("Recherche de fichiers LRC pour le nom de base:", baseFileName);
      
      // Vérifier différents formats possibles de noms de fichiers LRC
      const possibleLrcNames = [
        `${baseFileName}.lrc`,                       // même nom que l'audio
        `${title}.lrc`,                             // titre uniquement
        `${artist} - ${title}.lrc`,                 // artiste - titre
        `${title} - ${artist}.lrc`,                 // titre - artiste
        baseFileName.toLowerCase() + ".lrc",        // nom de base en minuscules
        title.toLowerCase() + ".lrc",               // titre en minuscules
        `${artist.toLowerCase()} - ${title.toLowerCase()}.lrc`  // artiste - titre en minuscules
      ];
      
      console.log("Recherche parmi les noms de fichiers LRC possibles:", possibleLrcNames);
      
      let lyricsFound = false;
      let lrcFile: File | undefined;
      
      // Rechercher parmi tous les noms possibles
      for (const lrcName of possibleLrcNames) {
        if (lrcFilesRef.current.has(lrcName)) {
          console.log(`Fichier LRC correspondant trouvé: ${lrcName}`);
          lrcFile = lrcFilesRef.current.get(lrcName);
          break;
        }
      }
      
      // Si on a trouvé un fichier LRC, le traiter
      if (lrcFile) {
        lyricsFound = await processLrcFile(lrcFile, fileId, title, artist);
        
        if (lyricsFound) {
        }
      } else {
        console.log("Aucun fichier LRC correspondant trouvé parmi", lrcFilesRef.current.size, "fichiers LRC en cache");
        console.log("Noms de fichiers LRC en cache:", Array.from(lrcFilesRef.current.keys()));
      }
      
      // Si aucun fichier LRC n'a été trouvé, essayer de récupérer les paroles en ligne
      if (!lyricsFound && artist !== "Unknown Artist") {
        // Toast de chargement des paroles
        const lyricsToastId = toast.loading(`Récupération des paroles pour "${title}"...`);
        
        // Récupération des paroles en arrière-plan (passer la durée en secondes)
        fetchLyrics(title, artist, fileId, duration, undefined).then(lyrics => {
          if (lyrics) {
            toast.dismiss(lyricsToastId);
          } else {
            toast.error(`Impossible de trouver les paroles pour "${title}"`, {
              id: lyricsToastId
            });
          }
        });
      }

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
      console.error("Erreur lors du traitement du fichier:", error);
      toast.error("Erreur lors de l'upload du fichier");
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUploadingSong(null);
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
        // Stocker les fichiers LRC par nom complet et aussi par nom sans extension
        lrcFilesRef.current.set(file.name, file);
        console.log("Fichier LRC détecté et mis en cache:", file.name);
        
        // Afficher un toast pour informer l'utilisateur que des fichiers LRC ont été détectés
        toast.info(`Fichier de paroles détecté: ${file.name}`);
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
    
    // Afficher les noms des fichiers LRC pour le débogage
    if (lrcFilesRef.current.size > 0) {
      console.log("Fichiers LRC en cache:", Array.from(lrcFilesRef.current.keys()));
    }

    // Traiter les fichiers séquentiellement pour éviter les erreurs de rate limiting
    // sur Dropbox (max 2 fichiers en parallèle)
    const processedSongs: (Song | null)[] = [];
    const maxConcurrent = 2;
    
    for (let i = 0; i < audioFiles.length; i += maxConcurrent) {
      const batch = audioFiles.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(batch.map(processAudioFile));
      processedSongs.push(...batchResults);
    }

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
          if (file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.lrc')) {
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  return (
    <div 
      className={cn(
        "relative transition-all duration-300",
        isDragging && "bg-white/5 rounded-lg"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-spotify-neutral hover:text-white hover:bg-white/10 px-3 py-2"
          >
            <Upload className="w-5 h-5 mr-3" />
            <span className="text-sm font-medium">Importer</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-spotify-dark border-white/10">
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 cursor-pointer text-spotify-neutral hover:text-white"
          >
            <Music className="w-4 h-4" />
            <span>Fichier(s) audio</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-2 cursor-pointer text-spotify-neutral hover:text-white"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Dossier complet</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
        
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.lrc"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept="audio/*,.lrc"
        multiple
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={handleFileUpload}
      />

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
  );
};