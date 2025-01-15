import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlayer } from "@/contexts/PlayerContext";
import * as mm from 'music-metadata-browser';

export const MusicUploader = () => {
  const { t } = useTranslation();
  const { play } = usePlayer();

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      console.log("Fichier sélectionné:", file);

      try {
        // Extraire les métadonnées
        const metadata = await mm.parseBlob(file);
        console.log("Métadonnées:", metadata);

        // Créer une URL pour le fichier audio
        const audioUrl = URL.createObjectURL(file);

        // Obtenir l'image de la pochette si elle existe
        let imageUrl = "https://picsum.photos/240/240"; // Image par défaut
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          const blob = new Blob([picture.data], { type: picture.format });
          imageUrl = URL.createObjectURL(blob);
        }

        // Créer un objet song avec les informations du fichier
        const song = {
          id: Date.now().toString(),
          title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: metadata.common.artist || "Unknown Artist",
          duration: formatDuration(metadata.format.duration || 0),
          url: audioUrl,
          imageUrl: imageUrl
        };

        // Jouer la chanson
        play(song);
        
        toast.success(t('common.fileSelected', { count: 1 }));
      } catch (error) {
        console.error("Erreur lors de l'extraction des métadonnées:", error);
        toast.error("Erreur lors de la lecture du fichier");
      }
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
          className="hidden"
          onChange={handleFileUpload}
        />
      </label>
    </div>
  );
};