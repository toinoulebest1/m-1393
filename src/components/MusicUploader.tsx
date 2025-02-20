
import { Upload, Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlayer } from "@/contexts/PlayerContext";
import { storeAudioFile } from "@/utils/storage";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";

interface ReportDialogProps {
  songTitle: string;
  songArtist: string;
  songId: string;
}

const ReportDialog = ({ songTitle, songArtist, songId }: ReportDialogProps) => {
  const [reason, setReason] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  const handleReport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vous devez être connecté pour signaler un problème");
        return;
      }

      const { data: existingReports } = await supabase
        .from('song_reports')
        .select('id')
        .eq('song_id', songId)
        .eq('user_id', session.user.id)
        .eq('status', 'pending');

      if (existingReports && existingReports.length > 0) {
        toast.error("Vous avez déjà signalé cette chanson");
        return;
      }

      const { error } = await supabase
        .from('song_reports')
        .insert({
          song_id: songId,
          user_id: session.user.id,
          reason: reason,
          status: 'pending'
        });

      if (error) {
        console.error("Erreur lors du signalement:", error);
        toast.error("Une erreur est survenue lors du signalement");
        return;
      }

      toast.success("Merci pour votre signalement");
      setIsOpen(false);
    } catch (error) {
      console.error("Erreur lors du signalement:", error);
      toast.error("Une erreur est survenue lors du signalement");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-spotify-neutral hover:text-white">
          <Flag className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler un problème</DialogTitle>
          <DialogDescription>
            {songTitle} - {songArtist}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup onValueChange={setReason}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="poor_quality" id="poor_quality" />
              <Label htmlFor="poor_quality">Qualité audio médiocre</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="wrong_metadata" id="wrong_metadata" />
              <Label htmlFor="wrong_metadata">Métadonnées incorrectes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="corrupted_file" id="corrupted_file" />
              <Label htmlFor="corrupted_file">Fichier corrompu</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="other" id="other" />
              <Label htmlFor="other">Autre problème</Label>
            </div>
          </RadioGroup>
          <Button onClick={handleReport}>Envoyer le signalement</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const processAudioFile = async (file: File) => {
  try {
    // On utilise l'API Audio native au lieu de music-metadata-browser
    const audioElement = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    
    return new Promise((resolve, reject) => {
      audioElement.onloadedmetadata = async () => {
        URL.revokeObjectURL(objectUrl);

        // Stockage du fichier
        const filePath = await storeAudioFile(file.name, file);
        
        const song = {
          id: file.name,
          title: file.name.replace(/\.[^/.]+$/, ""), // Retire l'extension
          artist: "Unknown Artist",
          duration: String(audioElement.duration),
          url: file.name,
          bitrate: "320 kbps", // Valeur par défaut
        };
        
        resolve(song);
      };

      audioElement.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Erreur lors du chargement du fichier audio"));
      };

      audioElement.src = objectUrl;
    });
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

    try {
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
    } catch (error) {
      console.error("Erreur lors du traitement des fichiers:", error);
      toast.error("Erreur lors du traitement des fichiers");
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
            <div key={song.id} className="flex items-center justify-between p-2 bg-gray-800 rounded hover:bg-gray-700/50 transition-colors">
              <div className="flex-1">
                <h3 className="text-sm font-medium">{song.title}</h3>
                <p className="text-xs text-gray-400">{song.artist}</p>
                <p className="text-xs text-gray-500">{song.bitrate || "320 kbps"}</p>
              </div>
              <div className="flex items-center space-x-2">
                <ReportDialog
                  songTitle={song.title}
                  songArtist={song.artist}
                  songId={song.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
