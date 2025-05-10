
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Clock, MoreHorizontal, Music2, Plus, Play, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SongPicker } from "@/components/SongPicker";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
  genre?: string;
}

interface PlaylistSong {
  id: string;
  position: number;
  added_at: string;
  songs: Song;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

const PlaylistDetail = () => {
  const { playlistId } = useParams<{ playlistId: string }>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const { toast } = useToast();
  const { t } = useTranslation();
  const { play, addToQueue, queue, setQueue } = usePlayer();

  const fetchPlaylistDetails = async () => {
    if (!playlistId) return;
    
    try {
      setLoading(true);
      
      // Fetch playlist details
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .single();
      
      if (playlistError) throw playlistError;
      if (!playlistData) {
        toast({
          title: t('common.error'),
          description: t('playlists.notFound'),
          variant: "destructive"
        });
        return;
      }
      
      setPlaylist(playlistData);
      setEditedName(playlistData.name);
      
      // Fetch songs in the playlist
      const { data: songsData, error: songsError } = await supabase
        .from('playlist_songs')
        .select(`
          id,
          position,
          added_at,
          songs:song_id (
            id,
            title,
            artist,
            duration,
            file_path,
            image_url,
            genre
          )
        `)
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });
      
      if (songsError) throw songsError;
      
      // Map the data to our Song interface
      const formattedSongs = songsData.map((item) => ({
        id: item.id,
        position: item.position,
        added_at: item.added_at,
        songs: {
          id: item.songs.id,
          title: item.songs.title,
          artist: item.songs.artist || '',
          duration: item.songs.duration || '0:00',
          url: item.songs.file_path,
          imageUrl: item.songs.image_url,
          genre: item.songs.genre
        }
      }));
      
      setSongs(formattedSongs);
    } catch (error) {
      console.error("Error fetching playlist details:", error);
      toast({
        title: t('common.error'),
        description: t('playlists.errorFetching'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!playlistId || !editedName.trim() || editedName === playlist?.name) {
      setIsEditingName(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('playlists')
        .update({ name: editedName })
        .eq('id', playlistId);

      if (error) throw error;
      
      setIsEditingName(false);
      setPlaylist(prev => prev ? { ...prev, name: editedName } : null);
      
      toast({
        description: t('playlists.nameUpdated')
      });
    } catch (error) {
      console.error("Error updating playlist name:", error);
      toast({
        title: t('common.error'),
        description: t('playlists.errorUpdating'),
        variant: "destructive"
      });
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !playlistId) return;
    
    const file = e.target.files[0];
    const fileExtension = file.name.split('.').pop();
    const fileName = `playlist-covers/${playlistId}.${fileExtension}`;
    
    setUploading(true);
    
    try {
      // Upload image to Storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('media')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);
      
      // Update playlist record
      const { error: updateError } = await supabase
        .from('playlists')
        .update({ cover_image_url: publicUrl })
        .eq('id', playlistId);
      
      if (updateError) throw updateError;
      
      setPlaylist(prev => prev ? { ...prev, cover_image_url: publicUrl } : null);
      
      toast({
        description: t('playlists.coverUpdated')
      });
    } catch (error) {
      console.error("Error uploading playlist cover:", error);
      toast({
        title: t('common.error'),
        description: t('playlists.errorUploadingCover'),
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveSong = async (playlistSongId: string) => {
    if (!playlistId) return;
    
    try {
      const { error } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('id', playlistSongId);
      
      if (error) throw error;
      
      // Remove from local state
      setSongs(songs.filter(song => song.id !== playlistSongId));
      
      // Recalculate positions for remaining songs
      const remainingSongs = songs
        .filter(song => song.id !== playlistSongId)
        .sort((a, b) => a.position - b.position);
      
      // Update positions in database - FIX: Include all required fields for upsert
      const updates = remainingSongs.map((song, index) => ({
        id: song.id,
        playlist_id: playlistId,
        song_id: song.songs.id,
        position: index + 1
      }));
      
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('playlist_songs')
          .upsert(updates);
        
        if (updateError) {
          console.error("Error updating positions:", updateError);
        }
      }
      
      toast({
        description: t('playlists.songRemoved')
      });
    } catch (error) {
      console.error("Error removing song:", error);
      toast({
        title: t('common.error'),
        description: t('playlists.errorRemovingSong'),
        variant: "destructive"
      });
    }
  };

  const handleAddSongs = async (selectedSongs: Song[]) => {
    if (!playlistId || selectedSongs.length === 0) return;
    
    try {
      const nextPosition = songs.length > 0 
        ? Math.max(...songs.map(s => s.position)) + 1 
        : 1;
      
      // Prepare song data to insert
      const songsToAdd = selectedSongs.map((song, index) => ({
        playlist_id: playlistId,
        song_id: song.id,
        position: nextPosition + index
      }));
      
      const { error } = await supabase
        .from('playlist_songs')
        .insert(songsToAdd);
      
      if (error) throw error;
      
      // Refresh playlist songs
      fetchPlaylistDetails();
      
      toast({
        description: `${selectedSongs.length} ${t('playlists.songsAdded')}`
      });
    } catch (error) {
      console.error("Error adding songs to playlist:", error);
      toast({
        title: t('common.error'),
        description: t('playlists.errorAddingSongs'),
        variant: "destructive"
      });
    }
  };

  const playPlaylist = () => {
    if (songs.length === 0) return;
    
    const playlistSongs = songs.map(item => ({
      id: item.songs.id,
      title: item.songs.title,
      artist: item.songs.artist,
      duration: item.songs.duration,
      url: item.songs.url,
      imageUrl: item.songs.imageUrl,
      genre: item.songs.genre
    }));
    
    setQueue(playlistSongs);
    play(playlistSongs[0]);
  };

  useEffect(() => {
    fetchPlaylistDetails();
    
    // Set up realtime subscriptions
    if (!playlistId) return;
    
    const playlistChannel = supabase
      .channel('playlist-detail-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'playlists',
          filter: `id=eq.${playlistId}`
        },
        (payload) => {
          setPlaylist(payload.new as Playlist);
        }
      )
      .subscribe();
    
    const songsChannel = supabase
      .channel('playlist-songs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlist_songs',
          filter: `playlist_id=eq.${playlistId}`
        },
        () => fetchPlaylistDetails()
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(playlistChannel);
      supabase.removeChannel(songsChannel);
    };
  }, [playlistId]);

  if (loading) {
    return (
      <div className="container p-6">
        <div className="flex items-start gap-6 mb-8">
          <Skeleton className="w-48 h-48" />
          <div className="flex-1">
            <Skeleton className="h-10 w-3/4 mb-4" />
            <Skeleton className="h-6 w-1/2 mb-6" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="container p-6">
        <div className="text-center py-12">
          <Music2 className="mx-auto h-16 w-16 text-spotify-neutral mb-4" />
          <p className="text-spotify-neutral text-lg">{t('playlists.notFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container p-6">
      <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
        <div className="relative group w-48 h-48 min-w-48 bg-spotify-card rounded-md overflow-hidden flex items-center justify-center">
          {playlist.cover_image_url ? (
            <img 
              src={playlist.cover_image_url} 
              alt={playlist.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <Music2 className="w-1/3 h-1/3 text-spotify-neutral" />
          )}
          
          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <label htmlFor="cover-upload" className="cursor-pointer">
              <div className="bg-spotify-accent hover:bg-spotify-accent-hover p-2 rounded-full">
                <ImageIcon className="h-5 w-5" />
              </div>
              <input 
                id="cover-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleUploadCover}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="text-xs uppercase text-spotify-neutral font-semibold mb-2">
            {t('playlists.playlist')}
          </div>
          
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-4">
              <Input 
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-3xl font-bold h-auto py-2 bg-spotify-input"
                autoFocus
              />
              <Button 
                onClick={handleUpdateName}
                className="bg-spotify-accent hover:bg-spotify-accent-hover"
              >
                {t('common.save')}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsEditingName(false);
                  setEditedName(playlist.name);
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          ) : (
            <h1 
              className="text-3xl font-bold text-white mb-2 cursor-pointer hover:underline"
              onClick={() => setIsEditingName(true)}
            >
              {playlist.name}
            </h1>
          )}
          
          {playlist.description && (
            <p className="text-spotify-neutral mb-4">{playlist.description}</p>
          )}
          
          <p className="text-sm text-spotify-neutral">
            {songs.length} {songs.length === 1 ? t('common.track') : t('common.tracks')}
          </p>
          
          <div className="flex gap-2 mt-4">
            {songs.length > 0 && (
              <Button 
                onClick={playPlaylist}
                className="bg-spotify-accent hover:bg-spotify-accent-hover rounded-full"
              >
                <Play className="h-5 w-5 mr-2" />
                {t('common.play')}
              </Button>
            )}
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" className="border border-spotify-neutral">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('playlists.addSongs')}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-spotify-dark text-white border-spotify-card max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{t('playlists.addSongs')}</DialogTitle>
                </DialogHeader>
                <SongPicker onSelectionConfirmed={handleAddSongs} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
      
      {songs.length > 0 ? (
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-spotify-card hover:bg-transparent">
              <TableHead className="text-spotify-neutral w-12 text-center">#</TableHead>
              <TableHead className="text-spotify-neutral">{t('common.title')}</TableHead>
              <TableHead className="text-spotify-neutral hidden md:table-cell">{t('common.artist')}</TableHead>
              <TableHead className="text-spotify-neutral hidden lg:table-cell">{t('common.duration')}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {songs.map((song, index) => (
              <TableRow 
                key={song.id} 
                className="border-b border-spotify-card hover:bg-spotify-card/20 group cursor-pointer"
                onClick={() => play(song.songs)}
              >
                <TableCell className="text-spotify-neutral text-center">{song.position}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {song.songs.imageUrl ? (
                      <img 
                        src={song.songs.imageUrl} 
                        alt={song.songs.title} 
                        className="w-10 h-10 rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-spotify-card flex items-center justify-center">
                        <Music2 className="w-5 h-5 text-spotify-neutral" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{song.songs.title}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-spotify-neutral hidden md:table-cell">
                  {song.songs.artist || t('common.noArtist')}
                </TableCell>
                <TableCell className="text-spotify-neutral hidden lg:table-cell">
                  {song.songs.duration}
                </TableCell>
                <TableCell className="opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => play(song.songs)}>
                        {t('playlists.play')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addToQueue(song.songs)}>
                        {t('playlists.addToQueue')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleRemoveSong(song.id)} className="text-red-500">
                        {t('playlists.remove')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-12 border border-dashed border-spotify-card rounded-lg">
          <Music2 className="mx-auto h-16 w-16 text-spotify-neutral mb-4" />
          <p className="text-spotify-neutral text-lg mb-4">{t('playlists.noSongs')}</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-spotify-accent hover:bg-spotify-accent-hover">
                <Plus className="h-4 w-4 mr-2" />
                {t('playlists.addSongs')}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-spotify-dark text-white border-spotify-card max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('playlists.addSongs')}</DialogTitle>
              </DialogHeader>
              <SongPicker onSelectionConfirmed={handleAddSongs} />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};

export default PlaylistDetail;
