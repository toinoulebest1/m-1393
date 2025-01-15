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
      console.log("Type du fichier:", file.type);

      if (!file.type.startsWith('audio/')) {
        toast.error("Le fichier sélectionné n'est pas un fichier audio");
        return;
      }

      try {
        // Créer une URL pour le fichier audio avant l'extraction des métadonnées
        const audioUrl = URL.createObjectURL(file);
        console.log("URL audio créée:", audioUrl);

        // Extraire les métadonnées
        const metadata = await mm.parseBlob(file);
        console.log("Métadonnées extraites avec succès:", metadata);

        // Obtenir l'image de la pochette si elle existe
        let imageUrl = "https://picsum.photos/240/240"; // Image par défaut
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          const blob = new Blob([picture.data], { type: picture.format });
          imageUrl = URL.createObjectURL(blob);
          console.log("Image de pochette trouvée et convertie en URL");
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

        console.log("Objet chanson créé:", song);

        // Jouer la chanson
        play(song);
        
        toast.success(t('common.fileSelected', { count: 1 }));
      } catch (error) {
        console.error("Erreur détaillée lors de l'extraction des métadonnées:", error);
        
        // Essayer de créer un objet song minimal même si les métadonnées échouent
        try {
          const audioUrl = URL.createObjectURL(file);
          const song = {
            id: Date.now().toString(),
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "Unknown Artist",
            duration: "0:00",
            url: audioUrl,
            imageUrl: "https://picsum.photos/240/240"
          };

          console.log("Création d'un objet chanson minimal après erreur:", song);
          play(song);
          toast.success(t('common.fileSelected', { count: 1 }));
        } catch (fallbackError) {
          console.error("Erreur lors de la création de l'objet chanson minimal:", fallbackError);
          toast.error("Erreur lors de la lecture du fichier");
        }
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