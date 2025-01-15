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
        const audioUrl = URL.createObjectURL(file);
        console.log("URL audio créée:", audioUrl);

        // Créer un élément audio pour obtenir la durée
        const audio = new Audio(audioUrl);
        
        // Utiliser une Promise pour s'assurer d'avoir la durée avant de continuer
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

        // Attendre que la durée soit disponible
        const duration = await getDuration;
        console.log("Durée obtenue:", duration);
        const formattedDuration = formatDuration(duration);
        console.log("Durée formatée:", formattedDuration);

        try {
          // Essayer d'extraire les métadonnées
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

          const song = {
            id: Date.now().toString(),
            title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""),
            artist: metadata.common.artist || "Unknown Artist",
            duration: formattedDuration,
            url: audioUrl,
            imageUrl: imageUrl
          };

          console.log("Objet chanson créé avec métadonnées:", song);
          play(song);
          toast.success(t('common.fileSelected', { count: 1 }));

        } catch (metadataError) {
          console.error("Erreur lors de l'extraction des métadonnées:", metadataError);
          
          // Créer un objet song minimal avec la durée correcte
          const song = {
            id: Date.now().toString(),
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "Unknown Artist",
            duration: formattedDuration,
            url: audioUrl,
            imageUrl: "https://picsum.photos/240/240"
          };

          console.log("Création d'un objet chanson minimal avec durée:", song);
          play(song);
          toast.success(t('common.fileSelected', { count: 1 }));
        }

      } catch (error) {
        console.error("Erreur lors de la création de l'objet chanson:", error);
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