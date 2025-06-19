
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

interface AnnouncementDialogProps {
  userId: string;
}

export const AnnouncementDialog = ({ userId }: AnnouncementDialogProps) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      checkForActiveAnnouncements();
    }
  }, [userId]);

  const checkForActiveAnnouncements = async () => {
    try {
      // Récupérer toutes les annonces actives
      const { data: activeAnnouncements, error: announcementsError } = await supabase
        .from('site_announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (announcementsError) throw announcementsError;

      if (activeAnnouncements && activeAnnouncements.length > 0) {
        setAnnouncements(activeAnnouncements);
        setCurrentIndex(0);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des annonces:', error);
    }
  };

  const handleNext = () => {
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Dernière annonce, fermer le dialog
      setIsOpen(false);
      setCurrentIndex(0);
      setAnnouncements([]);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setCurrentIndex(0);
    setAnnouncements([]);
  };

  if (announcements.length === 0) return null;

  const currentAnnouncement = announcements[currentIndex];
  const isLastAnnouncement = currentIndex === announcements.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg bg-spotify-dark border-spotify-neutral">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-spotify-accent" />
              <DialogTitle className="text-white">
                {currentAnnouncement.title}
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {announcements.length > 1 && (
            <DialogDescription className="text-spotify-neutral">
              Nouveauté {currentIndex + 1} sur {announcements.length}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          <div className="bg-gradient-to-r from-spotify-accent/10 to-purple-500/10 border border-spotify-accent/20 rounded-lg p-4">
            <p className="text-white leading-relaxed whitespace-pre-wrap">
              {currentAnnouncement.content}
            </p>
          </div>
          
          <div className="text-xs text-spotify-neutral mt-2">
            Publié le {new Date(currentAnnouncement.created_at).toLocaleDateString('fr-FR')}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-spotify-neutral/20">
          <div className="flex gap-2">
            {announcements.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentIndex ? 'bg-spotify-accent' : 'bg-spotify-neutral/30'
                }`}
              />
            ))}
          </div>
          
          <div className="flex gap-2">
            {!isLastAnnouncement ? (
              <>
                <Button variant="outline" onClick={handleClose} size="sm">
                  Fermer
                </Button>
                <Button onClick={handleNext} size="sm">
                  Suivant
                </Button>
              </>
            ) : (
              <Button onClick={handleNext} size="sm">
                Terminé
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
