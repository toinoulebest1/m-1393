
import React from 'react';
import { Song } from '@/types/player';
import { Button } from '@/components/ui/button';
import { Music, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SongListProps {
  songs: Song[];
  currentPlaylist?: string;
  isPlaylistOwner?: boolean;
  onSongsChange?: () => void;
}

export const SongList: React.FC<SongListProps> = ({ 
  songs, 
  currentPlaylist,
  isPlaylistOwner = false,
  onSongsChange 
}) => {
  const handleRemoveSong = async (songId: string) => {
    if (!currentPlaylist) return;
    
    try {
      const { error } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', currentPlaylist)
        .eq('song_id', songId);
        
      if (error) throw error;
      
      toast({
        title: "Succès",
        description: "Titre supprimé de la playlist"
      });
      
      if (onSongsChange) onSongsChange();
    } catch (error) {
      console.error("Erreur lors de la suppression du titre:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le titre de la playlist",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="space-y-2">
      {songs.map((song) => (
        <div
          key={song.id}
          className="flex items-center justify-between p-3 rounded-md bg-secondary/10 hover:bg-secondary/20 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 bg-cover bg-center rounded-md flex-shrink-0" 
              style={{ backgroundImage: `url(${song.imageUrl})` }}
            />
            <div>
              <h3 className="font-medium">{song.title}</h3>
              <p className="text-sm text-muted-foreground">{song.artist}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button size="icon" variant="ghost">
              <Music className="h-4 w-4" />
              <span className="sr-only">Lire</span>
            </Button>
            {isPlaylistOwner && (
              <Button 
                size="icon" 
                variant="ghost" 
                className="text-destructive hover:text-destructive"
                onClick={() => handleRemoveSong(song.id)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Supprimer</span>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
