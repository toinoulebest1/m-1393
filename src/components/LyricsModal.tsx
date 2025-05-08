
import React, { useState } from 'react';
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
import { Loader2, Wand2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
  songTitle: string;
  artist?: string;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({
  isOpen,
  onClose,
  songId,
  songTitle,
  artist,
}) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: lyrics, isLoading, refetch } = useQuery({
    queryKey: ['lyrics', songId],
    queryFn: async () => {
      console.log('Fetching lyrics for song:', songId);
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

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <span>Paroles - {songTitle}</span>
            {!lyrics && !isLoading && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateLyrics}
                disabled={isGenerating}
                className="ml-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Récupérer les paroles via Genius
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {artist && `Par ${artist}`}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
          {isLoading || isGenerating ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-spotify-accent" />
              <span className="ml-2">Chargement des paroles...</span>
            </div>
          ) : lyrics ? (
            <div className="whitespace-pre-line text-spotify-neutral">
              {lyrics}
            </div>
          ) : error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>
                {error.includes("API key") ? (
                  <div>
                    <p>{error}</p>
                    <p className="mt-2">Veuillez contacter l'administrateur pour mettre à jour la clé API Genius.</p>
                  </div>
                ) : (
                  <p>{error}</p>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="text-center text-spotify-neutral">
              <p>Aucune parole disponible pour cette chanson.</p>
              <p className="text-sm mt-2">Cliquez sur "Récupérer les paroles via Genius" pour essayer de les trouver.</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
