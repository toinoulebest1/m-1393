
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlayer } from "@/contexts/PlayerContext";
import * as mm from 'music-metadata-browser';
import { storeAudioFile } from "@/utils/storage";
import LastFM from 'lastfm-node-client';
import { supabase } from "@/integrations/supabase/client";

export const MusicUploader = () => {
  const { t } = useTranslation();
  const { addToQueue } = usePlayer();

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

  const fetchAlbumArt = async (artist: string, title: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('secrets')
        .select('value')
        .eq('name', 'LASTFM_API_KEY')
        .single();

      if (error || !data?.value) {
        console.warn("Impossible de récupérer la clé API Last.fm:", error);
        return null;
      }

      const lastfm = new LastFM(data.value);
      
      const response = await lastfm.track.getInfo({
        artist,
        track: title
      });

      if (response?.track?.album?.image) {
        const images = response.track.album.image;
        const largestImage = images[images.length - 1];
        return largestImage['#text'] || null;
      }
      return null;
    } catch (error) {
      console.warn("Impossible de récupérer la pochette depuis Last.fm:", error);
      return null;
    }
  };

  const processAudioFile = async (file: File) => {
    console.log("Traitement du fichier:", file.name);
    
    if (!file.type.startsWith('audio/')) {
      console.warn("Fichier non audio ignoré:", file.name);
      return null;
    }

    const fileId = generateUUID();

    try {
      await storeAudioFile(fileId, file);

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
      console.log("Taille du fichier:", file.size, "bytes");
      console.log("Durée:", duration, "secondes");
      console.log("Bitrate calculé:", bitrate);

      URL.revokeObjectURL(audioUrl);

      let imageUrl = "https://picsum.photos/240/240";
      let { artist, title } = parseFileName(file.name);

      try {
        const metadata = await mm.parseBlob(file);
        if (metadata.common.artist) {
          artist = metadata.common.artist;
        }
        if (metadata.common.title) {
          title = metadata.common.title;
        }
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          const blob = new Blob([picture.data], { type: picture.format });
          imageUrl = URL.createObjectURL(blob);
        } else {
          const lastfmArt = await fetchAlbumArt(artist, title);
          if (lastfmArt) {
            imageUrl = lastfmArt;
          }
        }
      } catch (metadataError) {
        console.warn("Impossible de lire les métadonnées:", metadataError);
        const lastfmArt = await fetchAlbumArt(artist, title);
        if (lastfmArt) {
          imageUrl = lastfmArt;
        }
      }

      return {
        id: fileId,
        title,
        artist,
        duration: formatDuration(duration),
        url: fileId,
        imageUrl: imageUrl,
        bitrate: bitrate
      };

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
