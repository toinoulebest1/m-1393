import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export const MusicUploader = () => {
  const { t } = useTranslation();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      // Pour l'instant, on affiche juste un message de succès
      // Plus tard, on pourra gérer l'upload vers Supabase
      toast.success(`${files.length} fichier(s) sélectionné(s)`);
      console.log("Fichiers sélectionnés:", files);
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