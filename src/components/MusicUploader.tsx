
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlayer } from "@/contexts/PlayerContext";
import * as mm from 'music-metadata-browser';
import { storeAudioFile } from "@/utils/storage";
import { useState } from "react";

const processAudioFile = async (file: File) => {
  try {
    const metadata = await mm.parseBlob(file);
    const filePath = await storeAudioFile(file.name, file);
    
    const song = {
      id: file.name,
      title: metadata.common.title || file.name,
      artist: metadata.common.artist || "Unknown Artist",
      duration: metadata.format.duration ? String(metadata.format.duration) : "0",
      url: file.name,
      bitrate: metadata.format.bitrate ? `${Math.round(metadata.format.bitrate / 1000)} kbps` : "320 kbps",
    };
    
    return song;
  } catch (error) {
    console.error("Error processing audio file:", error);
    toast.error("Erreur lors du traitement du fichier audio");
    return null;
  }
};

export const MusicUploader = () => {
  const { t } = useTranslation();
  const { addToQueue } = usePlayer();
  const [uploadedSongs, setUploadedSongs] = useState<Array<{
    id: string;
    title: string;
    artist: string;
    duration: string;
    url: string;
    bitrate?: string;
  }>>([]);

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
      validSongs.forEach(song => {
        addToQueue(song);
      });
      setUploadedSongs(validSongs);
      toast.success(t('common.fileSelected', { count: validSongs.length }));
    }
  };

  return (
    <div className="p-4 space-y-4">
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
      
      {uploadedSongs.length > 0 && (
        <div className="space-y-2">
          {uploadedSongs.map(song => (
            <div key={song.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
              <div className="flex-1">
                <h3 className="text-sm font-medium">{song.title}</h3>
                {song.artist && <p className="text-xs text-gray-400">{song.artist}</p>}
              </div>
              <div className="text-xs text-gray-400">
                {song.bitrate || "320 kbps"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
