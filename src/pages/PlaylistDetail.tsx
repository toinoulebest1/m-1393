import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { usePlayerStore } from '@/stores/playerStore';
import { Song } from '@/types/player';
import { SongList } from '@/components/SongList';
import { Skeleton } from '@/components/ui/skeleton';
import { storePlaylistCover, generateImageFromSongs } from '@/utils/storage';
import { useDropzone } from 'react-dropzone';
import { Pencil, Save, X, Music, Image, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserStore } from '@/stores/userStore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export const PlaylistDetail = () => {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useUserStore();
  const { setQueue, setCurrentSong, play } = usePlayerStore();
  
  const [playlist, setPlaylist] = useState<any>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleCoverUpload(acceptedFiles[0]);
      }
    }
  });

  useEffect(() => {
    if (playlistId) {
      fetchPlaylist();
      fetchPlaylistSongs();
    }
  }, [playlistId]);

  const fetchPlaylist = async () => {
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('*, profiles(username, avatar_url)')
        .eq('id', playlistId)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setPlaylist(data);
        setEditedName(data.name);
        setEditedDescription(data.description || '');
        setIsPublic(data.is_public);
        
        // Check if current user is the owner
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          setIsOwner(session.user.id === data.user_id);
        }
        
        // Generate share URL
        const baseUrl = window.location.origin;
        setShareUrl(`${baseUrl}/playlist/${playlistId}`);
      }
    } catch (error) {
      console.error('Error fetching playlist:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger la playlist",
        variant: "destructive"
      });
    }
  };

  const fetchPlaylistSongs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('playlist_songs')
        .select('songs(*)')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });

      if (error) {
        throw error;
      }

      if (data) {
        const formattedSongs: Song[] = data.map((item: any) => ({
          id: item.songs.id,
          title: item.songs.title,
          artist: item.songs.artist,
          url: item.songs.file_path || item.songs.id,
          duration: item.songs.duration,
          imageUrl: item.songs.image_url || 'https://picsum.photos/240/240',
          genre: item.songs.genre || 'Unknown',
        }));
        setSongs(formattedSongs);
        
        // If playlist has no cover, generate one from songs
        if (playlist && (!playlist.cover_url || playlist.cover_url.includes('placehold.co'))) {
          generateCoverFromSongs(formattedSongs);
        }
      }
    } catch (error) {
      console.error('Error fetching playlist songs:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les chansons de la playlist",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCoverFromSongs = async (songsList: Song[]) => {
    if (songsList.length > 0 && isOwner) {
      try {
        const coverUrl = await generateImageFromSongs(songsList);
        if (coverUrl) {
          await updateCoverUrl(coverUrl);
        }
      } catch (error) {
        console.error('Error generating cover:', error);
      }
    }
  };

  const updateCoverUrl = async (coverUrl: string) => {
    try {
      const { error } = await supabase
        .from('playlists')
        .update({ cover_url: coverUrl })
        .eq('id', playlistId);

      if (error) {
        throw error;
      }

      setPlaylist(prev => ({ ...prev, cover_url: coverUrl }));
    } catch (error) {
      console.error('Error updating cover URL:', error);
    }
  };

  const handleCoverUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const coverUrl = await storePlaylistCover(playlistId!, file);
      if (coverUrl) {
        await updateCoverUrl(coverUrl);
      }
    } catch (error) {
      console.error("Erreur lors de l'upload de la couverture:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'uploader l'image de couverture",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      const { error } = await supabase
        .from('playlists')
        .update({
          name: editedName,
          description: editedDescription,
          is_public: isPublic
        })
        .eq('id', playlistId);

      if (error) {
        throw error;
      }

      setPlaylist(prev => ({
        ...prev,
        name: editedName,
        description: editedDescription,
        is_public: isPublic
      }));
      
      setIsEditing(false);
      toast({
        title: "Succès",
        description: "Playlist mise à jour"
      });
    } catch (error) {
      console.error('Error updating playlist:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la playlist",
        variant: "destructive"
      });
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistId) return;
    
    setIsDeleting(true);
    try {
      // First delete all playlist_songs entries
      const { error: songsError } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistId);
        
      if (songsError) {
        throw songsError;
      }
      
      // Then delete the playlist itself
      const { error: playlistError } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId);
        
      if (playlistError) {
        throw playlistError;
      }
      
      toast({
        title: "Succès",
        description: "Playlist supprimée"
      });
      
      // Navigate back to playlists page
      navigate('/playlists');
    } catch (error) {
      console.error('Error deleting playlist:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la playlist",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      setQueue(songs);
      setCurrentSong(songs[0]);
      play(songs[0]);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !playlist) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-32 w-32 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold">Playlist introuvable</h2>
          <p className="text-muted-foreground mt-2">Cette playlist n'existe pas ou a été supprimée.</p>
          <Button className="mt-4" onClick={() => navigate('/playlists')}>
            Retour aux playlists
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        {/* Playlist Info Section */}
        <div className="space-y-4">
          <div className="relative group">
            {isUploading ? (
              <div className="w-full aspect-square bg-muted rounded-md flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <img 
                  src={playlist.cover_url || 'https://placehold.co/400x400/1f1f1f/ffffff?text=Playlist'} 
                  alt={playlist.name} 
                  className="w-full aspect-square object-cover rounded-md shadow-md"
                />
                {isOwner && (
                  <div 
                    {...getRootProps()} 
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md cursor-pointer"
                  >
                    <input {...getInputProps()} />
                    <div className="text-white text-center">
                      <Image className="h-8 w-8 mx-auto mb-2" />
                      <p>Changer la couverture</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Nom de la playlist"
                className="font-bold text-lg"
              />
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Description (optionnelle)"
                className="min-h-[100px]"
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is-public"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="is-public" className="text-sm">Playlist publique</label>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleSaveChanges} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{playlist.name}</h1>
                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setIsEditing(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                        <Image className="h-4 w-4 mr-2" />
                        Partager
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              
              {playlist.description && (
                <p className="text-muted-foreground">{playlist.description}</p>
              )}
              
              <div className="flex items-center space-x-2">
                <Badge variant={isPublic ? "default" : "outline"}>
                  {isPublic ? "Publique" : "Privée"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {songs.length} {songs.length > 1 ? 'titres' : 'titre'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={playlist.profiles?.avatar_url} />
                  <AvatarFallback>{playlist.profiles?.username?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{playlist.profiles?.username || 'Utilisateur inconnu'}</span>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Créée {formatDistanceToNow(new Date(playlist.created_at), { addSuffix: true, locale: fr })}
              </p>
              
              <Button onClick={handlePlayAll} disabled={songs.length === 0} className="w-full">
                <Music className="h-4 w-4 mr-2" />
                Lire la playlist
              </Button>
            </div>
          )}
        </div>

        {/* Songs List Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Titres</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : songs.length > 0 ? (
            <SongList 
              songs={songs} 
              currentPlaylist={playlistId}
              isPlaylistOwner={isOwner}
              onSongsChange={fetchPlaylistSongs}
            />
          ) : (
            <div className="text-center py-8 border border-dashed rounded-md">
              <Music className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-2 font-medium">Aucun titre dans cette playlist</h3>
              <p className="text-muted-foreground mt-1">
                {isOwner 
                  ? "Ajoutez des titres depuis la bibliothèque musicale" 
                  : "Cette playlist est vide pour le moment"}
              </p>
              {isOwner && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate('/library')}
                >
                  Parcourir la bibliothèque
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cette playlist ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La playlist sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePlaylist}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partager la playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!isPublic && (
              <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-md text-sm">
                <p className="text-amber-800 dark:text-amber-300">
                  Cette playlist est privée. Rendez-la publique pour la partager.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={async () => {
                    try {
                      await supabase
                        .from('playlists')
                        .update({ is_public: true })
                        .eq('id', playlistId);
                      
                      setIsPublic(true);
                      setPlaylist(prev => ({ ...prev, is_public: true }));
                      
                      toast({
                        title: "Succès",
                        description: "La playlist est maintenant publique"
                      });
                    } catch (error) {
                      console.error('Error updating playlist visibility:', error);
                      toast({
                        title: "Erreur",
                        description: "Impossible de mettre à jour la visibilité",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  Rendre publique
                </Button>
              </div>
            )}
            
            <div className="flex space-x-2">
              <Input value={shareUrl} readOnly />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={copyShareLink}>
                      {copied ? 'Copié !' : 'Copier'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copier le lien de partage</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
