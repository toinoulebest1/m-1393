
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ReportReason = "audio_quality" | "wrong_metadata" | "corrupted_file" | "other";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  file_path: string;
  imageUrl?: string;
}

interface ReportSongDialogProps {
  song: Song | null;
  onClose: () => void;
}

export const ReportSongDialog = ({ song, onClose }: ReportSongDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState<ReportReason>("audio_quality");

  const handleSubmit = async () => {
    if (!song) return;
    
    try {
      setIsSubmitting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vous devez être connecté pour signaler une chanson");
        return;
      }

      const { error } = await supabase
        .from('song_reports')
        .insert({
          song_id: song.id,
          user_id: session.user.id,
          reporter_username: session.user.email,
          song_title: song.title,
          song_artist: song.artist,
          reason: reason,
          status: 'pending'
        });

      if (error) {
        console.error("Erreur lors du signalement:", error);
        toast.error("Erreur lors du signalement");
        return;
      }

      toast.success("Chanson signalée avec succès");
      onClose();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du signalement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={!!song} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-[400px] p-6 gap-0">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fermer</span>
        </button>

        <AlertDialogHeader className="mb-3">
          <AlertDialogTitle className="text-lg font-semibold">
            Signaler un problème
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-400 mt-1">
            {song?.title} - {song?.artist}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <RadioGroup
            value={reason}
            onValueChange={(value) => setReason(value as ReportReason)}
            className="gap-3"
          >
            <div className="flex items-center space-x-3 [&>span]:text-sm">
              <RadioGroupItem value="audio_quality" id="audio_quality" />
              <Label htmlFor="audio_quality" className="text-sm font-normal">
                Qualité audio médiocre
              </Label>
            </div>
            <div className="flex items-center space-x-3 [&>span]:text-sm">
              <RadioGroupItem value="wrong_metadata" id="wrong_metadata" />
              <Label htmlFor="wrong_metadata" className="text-sm font-normal">
                Métadonnées incorrectes
              </Label>
            </div>
            <div className="flex items-center space-x-3 [&>span]:text-sm">
              <RadioGroupItem value="corrupted_file" id="corrupted_file" />
              <Label htmlFor="corrupted_file" className="text-sm font-normal">
                Fichier corrompu
              </Label>
            </div>
            <div className="flex items-center space-x-3 [&>span]:text-sm">
              <RadioGroupItem value="other" id="other" />
              <Label htmlFor="other" className="text-sm font-normal">
                Autre problème
              </Label>
            </div>
          </RadioGroup>
        </div>

        <AlertDialogFooter className="mt-6">
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-normal h-9"
          >
            {isSubmitting ? "En cours..." : "Envoyer le signalement"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
