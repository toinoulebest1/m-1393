
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlayer } from "@/contexts/PlayerContext";
import * as mm from 'music-metadata-browser';
import { storeAudioFile } from "@/utils/storage";

export const MusicUploader = () => {
  const { t } = useTranslation();
  const { addToQueue } = usePlayer();

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatBitrate = (bitrate?: number) => {
    if (!bitrate) return 'N/A';
    return `${Math.round(bitrate / 1000)} kbps`;
  };

  const generateUUID = () => {
    return crypto.randomUUID();
  };

  const processAudioFile = async (file: File) => {
    console.log("Traitement du fichier:", file.name);
    
    if (!file.type.startsWith('audio/')) {
      console.warn("Fichier non audio ignoré:", file.name);
      return null;
    }

    try {
      const id = generateUUID();
      await storeAudioFile(id, file);
      
      const audio = new Audio(URL.createObjectURL(file));
      
      const getDuration = new Promise<number>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => {
          console.log("Durée audio détectée:", audio.duration);
          resolve(audio.duration);
        });
        
        audio.addEventListener('error', (e) => {
          console.error("Erreur lors du chargement de l'audio:", e);
          reject(new Error("Erreur lors du chargement de l'audio"));
        });
      });

      const duration = await getDuration;
      const formattedDuration = formatDuration(duration);

      try {
        const metadata = await mm.parseBlob(file);
        console.log("Métadonnées extraites:", metadata);

        let imageUrl = "https://picsum.photos/240/240";
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          const blob = new Blob([picture.data], { type: picture.format });
          imageUrl = URL.createObjectURL(blob);
        }

        const bitrate = metadata.format.bitrate;
        console.log("Bitrate détecté:", bitrate);

        return {
          id,
          title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: metadata.common.artist || "Unknown Artist",
          duration: formattedDuration,
          url: id,
          imageUrl: imageUrl,
          bitrate: formatBitrate(bitrate)
        };

      } catch (metadataError) {
        console.warn("Erreur métadonnées, utilisation des valeurs par défaut:", metadataError);
        
        return {
          id,
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: "Unknown Artist",
          duration: formattedDuration,
          url: id,
          imageUrl: "https://picsum.photos/240/240",
          bitrate: 'N/A'
        };
      }

    } catch (error) {
      console.error("Erreur lors du traitement du fichier:", error);
      toast.error(`Erreur lors du traitement de ${file.name}`);
      return null;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log("Nombre de fichiers sélectionnés:", files.length);
    toast.info(`Traitement de ${files.length} fichier(s)...`);

    const processedSongs = await Promise.all(
      Array.from(files).map(processAudioFile)
    );

    const validSongs = processedSongs.filter((song): song is NonNullable<typeof song> => song !== null);
    console.log("Chansons valides traitées:", validSongs);

    if (validSongs.length > 0) {
      validSongs.forEach(song => addToQueue(song));
      toast.success(t('common.fileSelected', { count: validSongs.length }));
    }
  };

  return (
    <div className="p-4">
      <label className="flex items-center space-x-2 text-spotify-neutral hover:text-white cursor-pointer transition-colors">
        <Upload className="w-5 h-5" />
        <span>{t('common.upload')}</span>
        <input
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
      </label>
    </div>
  );
};
