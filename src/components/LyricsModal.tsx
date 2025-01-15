import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
  songTitle: string;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({
  isOpen,
  onClose,
  songId,
  songTitle,
}) => {
  const { data: lyrics, isLoading } = useQuery({
    queryKey: ['lyrics', songId],
    queryFn: async () => {
      console.log('Fetching lyrics for song:', songId);
      const { data, error } = await supabase
        .from('lyrics')
        .select('content')
        .eq('song_id', songId)
        .single();

      if (error) {
        console.error('Error fetching lyrics:', error);
        throw error;
      }

      return data?.content;
    },
    enabled: isOpen && !!songId,
  });

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Paroles - {songTitle}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-spotify-accent" />
            </div>
          ) : lyrics ? (
            <div className="whitespace-pre-line text-spotify-neutral">
              {lyrics}
            </div>
          ) : (
            <div className="text-center text-spotify-neutral">
              Aucune parole disponible pour cette chanson.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};