
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Music, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { getLrcFile } from '@/utils/dropboxStorage';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
  songTitle: string;
  artist?: string;
  onEditRequest?: () => void;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({
  isOpen,
  onClose,
  songId,
  songTitle,
  artist,
  onEditRequest
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lrcContent, setLrcContent] = useState<string | null>(null);

  // Rechercher le fichier LRC lorsque la modal s'ouvre
  useEffect(() => {
    if (isOpen && songId) {
      const checkForLrcFile = async () => {
        try {
          // Vérifier d'abord dans le dossier songs/songId
          let content = await getLrcFile(songId);
          
          if (content) {
            console.log("Fichier LRC trouvé dans Dropbox");
            setLrcContent(content);
          } else {
            console.log("Aucun fichier LRC trouvé pour cette chanson");
            setLrcContent(null);
          }
        } catch (error) {
          console.error("Erreur lors de la recherche du fichier LRC:", error);
          setLrcContent(null);
        }
      };
      
      checkForLrcFile();
    }
  }, [isOpen, songId]);

  const { data: lyrics, isLoading, refetch } = useQuery({
    queryKey: ['lyrics', songId],
    queryFn: async () => {
      console.log('Fetching lyrics for song:', songId);
      
      // Si nous avons déjà le contenu LRC, l'utiliser
      if (lrcContent) {
        return lrcContent;
      }
      
      const { data, error } = await supabase
        .from('lyrics')
        .select('content')
        .eq('song_id', songId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching lyrics:', error);
        throw error;
      }

      return data?.content || null;
    },
    enabled: isOpen && !!songId && lrcContent === null,
  });

  const generateLyrics = async () => {
    if (!artist) {
      setError("Impossible de récupérer les paroles sans le nom de l'artiste.");
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de récupérer les paroles sans le nom de l'artiste.",
      });
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    try {
      console.log('Generating lyrics for:', songTitle, 'by', artist);
      const response = await supabase.functions.invoke('generate-lyrics', {
        body: { songTitle, artist },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log('Generated lyrics response:', response.data);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const { error: insertError } = await supabase
        .from('lyrics')
        .upsert({
          song_id: songId,
          content: response.data.lyrics,
        });

      if (insertError) {
        throw insertError;
      }

      await refetch();
      toast({
        title: "Succès",
        description: "Les paroles ont été récupérées avec succès",
      });
    } catch (error) {
      console.error('Error generating lyrics:', error);
      setError(error.message || "Impossible de récupérer les paroles");
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de récupérer les paroles",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Déterminer le contenu à afficher
  const displayContent = lrcContent || lyrics;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <span className="break-words">{songTitle || "Titre inconnu"}</span>
            <div className="flex space-x-2">
              {displayContent && onEditRequest && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEditRequest}
                  className="ml-2 shrink-0"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t("common.edit")}
                </Button>
              )}
              
              {!displayContent && !isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateLyrics}
                  disabled={isGenerating || !artist}
                  className="ml-2 shrink-0"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Music className="h-4 w-4 mr-2" />
                  )}
                  {t("common.fetchLyrics")}
                </Button>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="break-words">
            {artist ? `Par ${artist}` : "Artiste inconnu"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
          {isLoading || isGenerating ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-spotify-accent" />
              <span className="ml-2">{t("common.loadingLyrics")}</span>
            </div>
          ) : displayContent ? (
            <div className="whitespace-pre-line text-spotify-neutral">
              {displayContent}
            </div>
          ) : error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>{t("common.error")}</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="text-center text-spotify-neutral">
              <p>{t("common.noLyricsAvailable")}</p>
              <p className="text-sm mt-2">
                {artist 
                  ? t("common.clickFetchLyrics")
                  : t("common.cannotFetchWithoutArtist")}
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
