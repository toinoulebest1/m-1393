
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
    const kbps = Math.round(bitrate / 1000);
    return `${kbps} kbps`;
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

    const fileId = generateUUID(); // Générer l'ID en dehors du bloc try

    try {
      await storeAudioFile(fileId, file);
      
      const metadata = await mm.parseBlob(file);
      console.log("Métadonnées extraites:", metadata);

      const duration = metadata.format.duration || 0;
      const formattedDuration = formatDuration(duration);

      let imageUrl = "https://picsum.photos/240/240";
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0];
        const blob = new Blob([picture.data], { type: picture.format });
        imageUrl = URL.createObjectURL(blob);
      }

      const bitrate = metadata.format.bitrate;
      const formattedBitrate = formatBitrate(bitrate);
      console.log("Bitrate détecté:", formattedBitrate);

      return {
        id: fileId,
        title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""),
        artist: metadata.common.artist || "Unknown Artist",
        duration: formattedDuration,
        url: fileId,
        imageUrl: imageUrl,
        bitrate: formattedBitrate
      };

    } catch (error) {
      console.error("Erreur lors du traitement du fichier:", error);
      
      // Fallback à la méthode audio pour obtenir au moins la durée
      try {
        const audio = new Audio(URL.createObjectURL(file));
        const duration = await new Promise<number>((resolve, reject) => {
          audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
          });
          audio.addEventListener('error', reject);
        });

        return {
          id: fileId,
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: "Unknown Artist",
          duration: formatDuration(duration),
          url: fileId,
          imageUrl: "https://picsum.photos/240/240",
          bitrate: formatBitrate(0)
        };
      } catch (audioError) {
        console.error("Erreur lors du traitement audio:", audioError);
        toast.error(`Erreur lors du traitement de ${file.name}`);
        return null;
      }
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
