import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, MoreHorizontal, Music2, Play, Shuffle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { formatRelativeTime } from "@/utils/dateUtils";
interface Playlist {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  song_count?: number;
  updated_at: string;
  user_id: string;
  is_shared?: boolean;
}
const PlaylistCard = ({
  playlist,
  onDeleted,
  currentUserId
}: {
  playlist: Playlist;
  onDeleted: () => void;
  currentUserId: string;
}) => {
  const {
    t
  } = useTranslation();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isOwner = playlist.user_id === currentUserId;

  // Use useCallback to prevent recreating this function on every render
  const handleDelete = useCallback(async () => {
    if (isDeleting || !isOwner) return; // Prevent multiple clicks and only allow owner to delete

    setIsDeleting(true);
    try {
      // Delete all playlist songs first
      const {
        error: songsError
      } = await supabase.from('playlist_songs').delete().eq('playlist_id', playlist.id);
      if (songsError) throw songsError;

      // Then delete the playlist itself
      const {
        error
      } = await supabase.from('playlists').delete().eq('id', playlist.id);
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
  }, [isDeleting, playlist.id, toast, t, onDeleted, isOwner]);
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Only navigate if the click wasn't on the dropdown
    if (!(e.target as Element).closest('.playlist-actions')) {
      navigate(`/playlist/${playlist.id}`);
    }
  }, [navigate, playlist.id]);
  return <div className="bg-spotify-card p-6 rounded-xl hover:bg-spotify-card-hover transition-all duration-300 cursor-pointer group relative shadow-lg hover:shadow-xl transform hover:scale-105" onClick={handleCardClick}>
      {playlist.is_shared && <div className="absolute top-3 left-3 z-10">
          <div className="bg-spotify-accent/80 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
            <Users className="h-3 w-3" />
            Partagée
          </div>
        </div>}
      
      <div className="aspect-square bg-gradient-to-br from-spotify-accent/20 to-spotify-dark rounded-xl mb-6 flex items-center justify-center overflow-hidden shadow-md">
        {playlist.cover_image_url ? <img src={playlist.cover_image_url} alt={playlist.name} className="w-full h-full object-cover" /> : <Music2 className="w-1/2 h-1/2 text-spotify-accent/60" />}
      </div>
      
      <h3 className="font-bold text-white truncate text-lg mb-2">{playlist.name}</h3>
      
      {playlist.description && <p className="text-spotify-neutral text-sm line-clamp-2 mb-3">{playlist.description}</p>}
      
      <div className="space-y-1">
        <p className="text-xs text-spotify-neutral/80 font-medium">
          {playlist.song_count || 0} {playlist.song_count === 1 ? t('common.track') : t('common.tracks')}
        </p>
        <p className="text-xs text-spotify-neutral/60">
          Mise à jour {formatRelativeTime(playlist.updated_at)}
        </p>
      </div>
      
      {/* Only show dropdown for owned playlists */}
      {isOwner && <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 playlist-actions" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/70 hover:bg-black/90 backdrop-blur-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-spotify-dark border-spotify-border">
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                {t('playlists.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={showDeleteDialog} onOpenChange={open => {
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
                <AlertDialogCancel disabled={isDeleting} className="bg-transparent border-spotify-border text-white hover:bg-spotify-card">
                  {t('common.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction onClick={e => {
              e.preventDefault();
              handleDelete();
            }} disabled={isDeleting} className="bg-red-500 hover:bg-red-600">
                  {isDeleting ? t('common.loading') : t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>}
    </div>;
};
const CreatePlaylistDialog = ({
  onCreated
}: {
  onCreated: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    toast
  } = useToast();
  const {
    t
  } = useTranslation();

  // Create a placeholder cover image for the new playlist
  const createPlaceholderCover = async (playlistId: string) => {
    try {
      // Use a placeholder image from a service like Picsum Photos
      const placeholderUrl = `https://picsum.photos/id/${Math.floor(Math.random() * 1000)}/400/400`;
      const response = await fetch(placeholderUrl);
      if (!response.ok) throw new Error('Failed to fetch placeholder image');
      const blob = await response.blob();
      const file = new File([blob], `playlist-${playlistId}.jpg`, {
        type: 'image/jpeg'
      });
      const fileName = `playlist-covers/${playlistId}.jpg`;

      // Upload the placeholder to storage
      const {
        error: uploadError
      } = await supabase.storage.from('media').upload(fileName, file, {
        upsert: true,
        contentType: 'image/jpeg'
      });
      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('media').getPublicUrl(fileName);

      // Update playlist record
      await supabase.from('playlists').update({
        cover_image_url: publicUrl
      }).eq('id', playlistId);
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
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No authentication session found");
      }

      // Insert the new playlist
      const {
        data,
        error
      } = await supabase.from('playlists').insert({
        name,
        description: description || null,
        user_id: session.user.id
      }).select().single();
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
  return <Dialog open={open} onOpenChange={setOpen}>
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
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder={t('playlists.namePlaceholder')} className="bg-spotify-input border-spotify-border text-white" maxLength={100} required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t('playlists.description')}</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('playlists.descriptionPlaceholder')} className="bg-spotify-input border-spotify-border text-white resize-none" maxLength={500} />
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="bg-spotify-accent hover:bg-spotify-accent-hover">
              {isSubmitting ? t('common.loading') : t('playlists.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>;
};
const PlaylistsPage = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const {
    t
  } = useTranslation();
  const {
    toast
  } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fetchPlaylists = useCallback(async () => {
    try {
      setLoading(true);

      // Get current user
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // Fetch all playlists that the user can see (including shared ones)
      const {
        data: playlistsData,
        error: playlistsError
      } = await supabase.from('playlists').select('*').order('created_at', {
        ascending: false
      });
      if (playlistsError) throw playlistsError;

      // Get song counts for each playlist
      const playlistsWithCounts = await Promise.all(playlistsData.map(async playlist => {
        const {
          count,
          error: countError
        } = await supabase.from('playlist_songs').select('*', {
          count: 'exact',
          head: true
        }).eq('playlist_id', playlist.id);
        if (countError) {
          console.error("Error fetching song count:", countError);
          return {
            ...playlist,
            song_count: 0,
            is_shared: playlist.user_id !== user.id
          };
        }
        return {
          ...playlist,
          song_count: count,
          is_shared: playlist.user_id !== user.id
        };
      }));
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
    const channel = supabase.channel('playlist-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'playlists'
    }, () => fetchPlaylists()).subscribe();

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

  // Separate owned and shared playlists
  const ownedPlaylists = playlists.filter(p => p.user_id === currentUserId);
  const sharedPlaylists = playlists.filter(p => p.user_id !== currentUserId);
  return <Layout>
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8 pb-32">
            {/* Enhanced Header */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-spotify-accent bg-clip-text text-transparent">
                    {t('playlists.title')}
                  </h1>
                  <p className="text-spotify-neutral text-lg">
                    Organisez votre musique en collections personnalisées
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <CreatePlaylistDialog onCreated={fetchPlaylists} />
                  
                  {playlists.length > 0 && <Button variant="outline" className="border-spotify-border hover:bg-spotify-card text-slate-400">
                      <Shuffle className="w-4 h-4 mr-2" />
                      Lecture aléatoire
                    </Button>}
                </div>
              </div>
              
              {/* Stats Section */}
              {playlists.length > 0 && <div className="flex items-center gap-6 text-sm text-spotify-neutral bg-spotify-card/30 p-4 rounded-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Music2 className="w-4 h-4" />
                    <span>{ownedPlaylists.length} {ownedPlaylists.length > 1 ? 'playlists créées' : 'playlist créée'}</span>
                  </div>
                  {sharedPlaylists.length > 0 && <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{sharedPlaylists.length} {sharedPlaylists.length > 1 ? 'playlists partagées' : 'playlist partagée'}</span>
                    </div>}
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    <span>{playlists.reduce((total, playlist) => total + (playlist.song_count || 0), 0)} titres au total</span>
                  </div>
                </div>}
            </div>
            
            {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {[...Array(6)].map((_, i) => <div key={i} className="space-y-4 animate-pulse">
                    <Skeleton className="h-56 w-full rounded-xl" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>)}
              </div> : <div className="space-y-8">
                {/* Mes Playlists */}
                {ownedPlaylists.length > 0 && <div>
                    <h2 className="text-2xl font-bold text-white mb-6">Mes playlists</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {ownedPlaylists.map((playlist, index) => <div key={playlist.id} style={{
                  animation: `fadeIn 0.3s ease-out forwards ${index * 100}ms`,
                  opacity: 0
                }}>
                          <PlaylistCard playlist={playlist} onDeleted={handlePlaylistDeleted} currentUserId={currentUserId} />
                        </div>)}
                    </div>
                  </div>}

                {/* Playlists Partagées */}
                {sharedPlaylists.length > 0 && <div>
                    <h2 className="text-2xl font-bold text-white mb-6">Playlists partagées avec moi</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {sharedPlaylists.map((playlist, index) => <div key={playlist.id} style={{
                  animation: `fadeIn 0.3s ease-out forwards ${(ownedPlaylists.length + index) * 100}ms`,
                  opacity: 0
                }}>
                          <PlaylistCard playlist={playlist} onDeleted={handlePlaylistDeleted} currentUserId={currentUserId} />
                        </div>)}
                    </div>
                  </div>}

                {/* Empty State */}
                {ownedPlaylists.length === 0 && sharedPlaylists.length === 0 && <div className="text-center py-20">
                    <div className="space-y-6 animate-fade-in p-8 rounded-2xl bg-gradient-to-br from-spotify-card/30 to-transparent backdrop-blur-sm border border-spotify-border/20">
                      <div className="w-20 h-20 bg-gradient-to-br from-spotify-accent/20 to-spotify-accent/5 rounded-2xl flex items-center justify-center mx-auto">
                        <Music2 className="w-10 h-10 text-spotify-accent" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-white">{t('playlists.empty')}</h3>
                        <p className="text-spotify-neutral max-w-md mx-auto">
                          {t('playlists.createFirst')}
                        </p>
                      </div>
                      <CreatePlaylistDialog onCreated={fetchPlaylists} />
                    </div>
                  </div>}
              </div>}
          </div>
        </div>
      </div>
    </Layout>;
};
export default PlaylistsPage;