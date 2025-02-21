
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ReportReason = "offensive_content" | "corrupted_file" | "wrong_metadata" | "other";

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
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState<ReportReason>("offensive_content");
  const [otherReason, setOtherReason] = useState("");

  const handleSubmit = async () => {
    if (!song) return;
    
    try {
      setIsSubmitting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vous devez être connecté pour signaler une chanson");
        return;
      }

      const finalReason = reason === "other" ? otherReason : reason;

      const { error } = await supabase
        .from('song_reports')
        .insert({
          song_id: song.id,
          user_id: session.user.id,
          reporter_username: session.user.email,
          song_title: song.title,
          song_artist: song.artist,
          reason: finalReason,
          status: 'pending'
        });

      if (error) {
        console.error("Erreur lors du signalement:", error);
        toast.error("Erreur lors du signalement");
        return;
      }

      toast.success("Chanson signalée avec succès");
      setIsOpen(false);
      onClose();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du signalement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) onClose();
    }}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
        >
          <Flag className="h-4 w-4 mr-2" />
          Signaler
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Signaler une chanson</AlertDialogTitle>
          <AlertDialogDescription>
            Vous êtes sur le point de signaler la chanson "{song?.title}" par {song?.artist}.
            Veuillez sélectionner la raison du signalement.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-4">
          <Alert>
            <AlertDescription>
              Notre équipe examinera votre signalement dans les plus brefs délais.
            </AlertDescription>
          </Alert>

          <div className="grid gap-2">
            <Label htmlFor="reason">Raison du signalement</Label>
            <select
              id="reason"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
            >
              <option value="offensive_content">Contenu offensant</option>
              <option value="corrupted_file">Fichier corrompu</option>
              <option value="wrong_metadata">Métadonnées incorrectes</option>
              <option value="other">Autre</option>
            </select>
          </div>

          {reason === "other" && (
            <div className="grid gap-2">
              <Label htmlFor="otherReason">Précisez la raison</Label>
              <Input
                id="otherReason"
                placeholder="Décrivez la raison du signalement..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsOpen(false);
              onClose();
            }}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={isSubmitting || (reason === "other" && !otherReason.trim())}
            className="bg-red-500 hover:bg-red-600"
          >
            {isSubmitting ? "En cours..." : "Signaler"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
