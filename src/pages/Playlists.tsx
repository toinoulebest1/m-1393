import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, MoreHorizontal, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { Player } from "@/components/Player";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  song_count?: number;
}

const PlaylistCard = ({ playlist, onDeleted }: { playlist: Playlist; onDeleted: () => void }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Use useCallback to prevent recreating this function on every render
  const handleDelete = useCallback(async () => {
    if (isDeleting) return; // Prevent multiple clicks
    
    setIsDeleting(true);
    
    try {
      // Delete all playlist songs first
      const { error: songsError } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlist.id);
      
      if (songsError) throw songsError;
      
      // Then delete the playlist itself
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlist.id);
      
      if (error) throw error;
      
      // Success toast
      toast({
        title: t('playlists.deleted'),
        description: t('playlists.playlistDeleted')
      });
      
      // Close dialog first
      setShowDeleteDialog(false);
      
      // Then notify parent after a short delay
      setTimeout(() => {
        if (onDeleted) onDeleted();
      }, 300); // Increased delay to give UI time to update
      
    } catch (error) {
      console.error("Error deleting playlist:", error);
      toast({
        title: t('common.error'),
        description: t('playlists.errorDeleting'),
        variant: "destructive"
      });
      // Always make sure to close dialog and reset deletion state in case of error
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, playlist.id, toast, t, onDeleted]);
  
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Only navigate if the click wasn't on the dropdown
    if (!(e.target as Element).closest('.playlist-actions')) {
      navigate(`/playlist/${playlist.id}`);
    }
  }, [navigate, playlist.id]);
  
  return (
    <div 
      className="bg-spotify-card p-4 rounded-lg hover:bg-spotify-card-hover transition-colors cursor-pointer group relative"
      onClick={handleCardClick}
    >
      <div className="aspect-square bg-spotify-dark rounded-md mb-4 flex items-center justify-center overflow-hidden">
        {playlist.cover_image_url ? (
          <img 
            src={playlist.cover_image_url} 
            alt={playlist.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <Music2 className="w-1/3 h-1/3 text-spotify-neutral" />
        )}
      </div>
      
      <h3 className="font-bold text-white truncate">{playlist.name}</h3>
      
      {playlist.description && (
        <p className="text-spotify-neutral text-sm line-clamp-2">{playlist.description}</p>
      )}
      
      <p className="text-xs text-spotify-neutral mt-2">
        {playlist.song_count || 0} {playlist.song_count === 1 ? t('common.track') : t('common.tracks')}
      </p>
      
      <div 
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 playlist-actions" 
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/60">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-500">
              {t('playlists.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
          if (!isDeleting) {
            setShowDeleteDialog(open);
          }
        }}>
          <AlertDialogContent className="bg-spotify-dark text-white border-spotify-card">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common.delete')} {playlist.name}?</AlertDialogTitle>
              <AlertDialogDescription className="text-spotify-neutral">
                {t('common.confirmDeleteMessage')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                disabled={isDeleting}
                className="bg-transparent border-spotify-border text-white hover:bg-spotify-card"
              >
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }} 
                disabled={isDeleting}
                className="bg-red-500 hover:bg-red-600"
              >
                {isDeleting ? t('common.loading') : t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const CreatePlaylistDialog = ({ onCreated }: { onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Create a placeholder cover image for the new playlist
  const createPlaceholderCover = async (playlistId: string) => {
    try {
      // Use a placeholder image from a service like Picsum Photos
      const placeholderUrl = `https://picsum.photos/id/${Math.floor(Math.random() * 1000)}/400/400`;
      const response = await fetch(placeholderUrl);
      if (!response.ok) throw new Error('Failed to fetch placeholder image');
      
      const blob = await response.blob();
      const file = new File([blob], `playlist-${playlistId}.jpg`, { type: 'image/jpeg' });
      
      const fileName = `playlist-covers/${playlistId}.jpg`;
      
      // Upload the placeholder to storage
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, {
          upsert: true,
          contentType: 'image/jpeg'
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);
      
      // Update playlist record
      await supabase
        .from('playlists')
        .update({ cover_image_url: publicUrl })
        .eq('id', playlistId);
      
      return publicUrl;
    } catch (error) {
      console.error('Error creating placeholder cover:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: t('common.error'),
        description: t('playlists.nameRequired'),
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Get the current user's ID
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No authentication session found");
      }
      
      // Insert the new playlist
      const { data, error } = await supabase
        .from('playlists')
        .insert({ 
          name, 
          description: description || null,
          user_id: session.user.id 
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Create a placeholder cover image for the new playlist
      await createPlaceholderCover(data.id);
      
      toast({
        title: t('playlists.created'),
        description: t('playlists.playlistCreated')
      });
      
      setName("");
      setDescription("");
      setOpen(false);
      onCreated();
    } catch (error) {
      console.error("Error creating playlist:", error);
      toast({
        title: t('common.error'),
        description: t('playlists.errorCreating'),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 bg-spotify-accent hover:bg-spotify-accent-hover">
          <PlusCircle className="h-4 w-4" />
          {t('playlists.create')}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-spotify-dark text-white border-spotify-card">
        <DialogHeader>
          <DialogTitle>{t('playlists.create')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('playlists.name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('playlists.namePlaceholder')}
              className="bg-spotify-input border-spotify-border text-white"
              maxLength={100}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t('playlists.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('playlists.descriptionPlaceholder')}
              className="bg-spotify-input border-spotify-border text-white resize-none"
              maxLength={500}
            />
          </div>
          
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-spotify-accent hover:bg-spotify-accent-hover"
            >
              {isSubmitting ? t('common.loading') : t('playlists.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const PlaylistsPage = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      
      // First get all playlists
      const { data: playlistsData, error: playlistsError } = await supabase
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (playlistsError) throw playlistsError;
      
      // Get song counts for each playlist
      const playlistsWithCounts = await Promise.all(
        playlistsData.map(async (playlist) => {
          const { count, error: countError } = await supabase
            .from('playlist_songs')
            .select('*', { count: 'exact', head: true })
            .eq('playlist_id', playlist.id);
            
          if (countError) {
            console.error("Error fetching song count:", countError);
            return { ...playlist, song_count: 0 };
          }
          
          return { ...playlist, song_count: count };
        })
      );
      
      setPlaylists(playlistsWithCounts);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      toast({
        title: t('common.error'),
        description: t('playlists.errorFetching'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  // Create a separate function to set up the subscription
  const setupRealtimeSubscription = useCallback(() => {
    // Clean up any existing subscription first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    
    // Create a new subscription
    const channel = supabase
      .channel('playlist-changes')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'playlists',
        },
        () => fetchPlaylists()
      )
      .subscribe();
    
    // Store the channel reference for cleanup
    channelRef.current = channel;
  }, [fetchPlaylists]);

  useEffect(() => {
    // Fetch playlists when component mounts
    fetchPlaylists();
    
    // Set up realtime subscription
    setupRealtimeSubscription();
    
    // Clean up subscription when component unmounts
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchPlaylists, setupRealtimeSubscription]);

  const handlePlaylistDeleted = useCallback(() => {
    // Use setTimeout to ensure this doesn't conflict with any ongoing state updates
    setTimeout(() => {
      fetchPlaylists();
    }, 500);
  }, [fetchPlaylists]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="container p-6 pb-32">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">{t('playlists.title')}</h1>
            <CreatePlaylistDialog onCreated={fetchPlaylists} />
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : playlists.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {playlists.map((playlist) => (
                <PlaylistCard 
                  key={playlist.id} 
                  playlist={playlist} 
                  onDeleted={handlePlaylistDeleted} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music2 className="mx-auto h-16 w-16 text-spotify-neutral mb-4" />
              <p className="text-spotify-neutral text-lg mb-4">{t('playlists.empty')}</p>
              <p className="text-spotify-neutral">{t('playlists.createFirst')}</p>
            </div>
          )}
        </div>
      </div>
      <Player />
    </div>
  );
};

export default PlaylistsPage;
