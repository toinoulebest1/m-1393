import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlayer } from "@/contexts/PlayerContext";

export const MusicUploader = () => {
  const { t } = useTranslation();
  const { play } = usePlayer();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      console.log("Fichier sélectionné:", file);

      // Créer une URL pour le fichier audio
      const audioUrl = URL.createObjectURL(file);

      // Créer un objet song avec les informations du fichier
      const song = {
        id: Date.now().toString(), // Génère un ID unique
        title: file.name.replace(/\.[^/.]+$/, ""), // Nom du fichier sans extension
        artist: "Local File", // Artiste par défaut pour les fichiers locaux
        duration: "0:00", // La durée sera mise à jour lors de la lecture
        url: audioUrl
      };

      // Jouer la chanson
      play(song);
      
      toast.success(t('common.fileSelected', { count: files.length }));
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