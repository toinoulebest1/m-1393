
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Song } from '@/types/song';
import { Loader2 } from 'lucide-react';
import { getLyricsFromDropbox, isDropboxEnabled, uploadLyricsToDropbox } from '@/utils/dropboxStorage';

interface LyricsModalProps {
  song?: Song | null;
  songId?: string;
  songTitle?: string;
  artist?: string;
  isOpen: boolean;
  onClose: () => void;
  onEditRequest?: () => void;
}

export const LyricsModal = ({ song, songId, songTitle, artist, isOpen, onClose, onEditRequest }: LyricsModalProps) => {
  const [lyrics, setLyrics] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Récupérer l'ID de la chanson, soit directement, soit à partir de l'objet song
  const effectiveSongId = song?.id || songId;
  const effectiveTitle = song?.title || songTitle;

  useEffect(() => {
    const fetchLyrics = async () => {
      if (!effectiveSongId) return;
      
      setIsLoading(true);
      
      try {
        // Vérifier d'abord dans Dropbox si activé
        if (await isDropboxEnabled()) {
          const dropboxLyrics = await getLyricsFromDropbox(effectiveSongId);
          if (dropboxLyrics) {
            setLyrics(dropboxLyrics);
            setIsLoading(false);
            return;
          }
        }
        
        // Sinon récupérer depuis Supabase
        const { data, error } = await supabase
          .from('lyrics')
          .select('content')
          .eq('song_id', effectiveSongId)
          .maybeSingle();
          
        if (error) {
          console.error('Erreur lors de la récupération des paroles:', error);
        } else if (data) {
          setLyrics(data.content);
        } else {
          setLyrics('');
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des paroles:', error);
        toast.error('Erreur lors de la récupération des paroles');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && effectiveSongId) {
      fetchLyrics();
    } else {
      setLyrics('');
    }
  }, [isOpen, effectiveSongId]);

  const handleSave = async () => {
    if (!effectiveSongId) return;
    
    setIsSaving(true);
    
    try {
      // Sauvegarder dans Dropbox si activé
      if (await isDropboxEnabled()) {
        try {
          await uploadLyricsToDropbox(effectiveSongId, lyrics);
        } catch (error) {
          console.error('Erreur lors de l\'upload des paroles vers Dropbox:', error);
          // Continuer avec Supabase en cas d'erreur Dropbox
        }
      }
      
      // Sauvegarder dans Supabase (de toute façon)
      const { error } = await supabase
        .from('lyrics')
        .upsert({
          song_id: effectiveSongId,
          content: lyrics
        }, {
          onConflict: 'song_id'
        });
        
      if (error) {
        console.error('Erreur lors de la sauvegarde des paroles:', error);
        toast.error('Erreur lors de la sauvegarde des paroles');
      } else {
        toast.success('Paroles sauvegardées avec succès');
        if (onEditRequest) {
          onEditRequest();
        }
        onClose();
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paroles:', error);
      toast.error('Erreur lors de la sauvegarde des paroles');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paroles - {effectiveTitle}</DialogTitle>
          <DialogDescription>
            Ajoutez ou modifiez les paroles de cette chanson.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Entrez les paroles ici..."
            className="min-h-[300px] font-mono text-sm"
          />
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
