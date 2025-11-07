
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
import { isDropboxEnabled, getLyricsFromDropbox, uploadLyricsToDropbox } from '@/utils/dropboxStorage';

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
  const [useDropbox, setUseDropbox] = useState(false);

  // Vérifier si Dropbox est activé
  useEffect(() => {
    setUseDropbox(isDropboxEnabled());
  }, []);

  const { data: lyrics, isLoading, refetch } = useQuery({
    queryKey: ['lyrics', songId, useDropbox],
    queryFn: async () => {
      console.log('Fetching lyrics for song:', songId);
      
      // Si Dropbox est activé, essayer de récupérer les paroles depuis Dropbox
      if (useDropbox) {
        try {
          console.log('Attempting to fetch lyrics from Dropbox');
          const dropboxLyrics = await getLyricsFromDropbox(songId);
          
          if (dropboxLyrics) {
            console.log('Lyrics fetched from Dropbox successfully');
            return dropboxLyrics;
          }
          
          console.log('No lyrics found in Dropbox, falling back to database');
        } catch (error) {
          console.error('Error fetching lyrics from Dropbox:', error);
          // En cas d'erreur, continuer avec la base de données
        }
      }
      
      // Si Dropbox n'est pas activé ou si la récupération a échoué, utiliser la base de données
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
    enabled: isOpen && !!songId,
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
      
      // Récupérer les infos de la chanson pour avoir la durée et l'album
      const { data: songData } = await supabase
        .from('songs')
        .select('duration, album_name')
        .eq('id', songId)
        .single();
      
      // Convert duration from MM:SS format to seconds
      let durationInSeconds: number | undefined;
      if (songData?.duration) {
        const parts = songData.duration.split(':');
        if (parts.length === 2) {
          durationInSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
      
      const response = await supabase.functions.invoke('generate-lyrics', {
        body: { 
          songTitle, 
          artist,
          duration: durationInSeconds,
          albumName: songData?.album_name
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log('Generated lyrics response:', response.data);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      // Utiliser syncedLyrics si disponible, sinon utiliser plainLyrics
      const lyricsContent = response.data.syncedLyrics || response.data.lyrics;
      
      // Enregistrer les paroles dans la base de données
      const { error: insertError } = await supabase
        .from('lyrics')
        .upsert({
          song_id: songId,
          content: lyricsContent,
        });

      if (insertError) {
        throw insertError;
      }
      
      // Si Dropbox est activé, également enregistrer les paroles dans Dropbox
      if (useDropbox) {
        try {
          await uploadLyricsToDropbox(songId, lyricsContent);
          console.log('Lyrics uploaded to Dropbox successfully');
        } catch (dropboxError) {
          console.error('Failed to upload lyrics to Dropbox:', dropboxError);
          // Ne pas faire échouer l'opération si le téléchargement Dropbox échoue
        }
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

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <span className="break-words">{songTitle || "Titre inconnu"}</span>
            <div className="flex space-x-2">
              {lyrics && onEditRequest && (
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
              
              {!lyrics && !isLoading && (
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
          ) : lyrics ? (
            <div className="whitespace-pre-line text-spotify-neutral">
              {lyrics}
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
