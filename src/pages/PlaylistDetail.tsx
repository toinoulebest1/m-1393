import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Clock, MoreHorizontal, Music2, Plus, Play, Image as ImageIcon, Trash2 } from "lucide-react";
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
import { generateImageFromSongs } from "@/utils/storage";
import { SongCard } from "@/components/SongCard";
import { cn } from "@/lib/utils";
import { PlaylistVisibilitySettings } from "@/components/PlaylistVisibilitySettings";
import { Layout } from "@/components/Layout";

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
  user_id: string;
  visibility?: string;
}

// Simplified function to generate playlist cover
const generatePlaylistCover = async (songs: PlaylistSong[]): Promise<string | null> => {
  console.log("=== STARTING PLAYLIST COVER GENERATION ===");
  console.log(`Total songs in playlist: ${songs.length}`);
  
  if (songs.length === 0) {
    console.log("No songs found, cannot generate cover");
    return null;
  }

  // Filter songs that have images
  const songsWithImages = songs.filter(song => song.songs.imageUrl);
  console.log(`Songs with images: ${songsWithImages.length}`);
  
  if (songsWithImages.length === 0) {
    console.log("No songs with images found");
    return null;
  }

  try {
    console.log("=== STARTING PLAYLIST COVER GENERATION ===");
    console.log(`Number of songs: ${songs.length}`);
    
    // Filter songs that have images
    const songsWithImages = songs.filter(song => song.songs.imageUrl);
    
    console.log(`Songs with images: ${songsWithImages.length}`);
    
    if (songsWithImages.length === 0) {
      console.error("No songs with images available");
      return null;
    }

    // Reduce size for faster processing (300x300 instead of 400x400)
    const size = 300;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error("Could not get canvas context");
      return null;
    }

    // Dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);

    console.log(`Processing ${Math.min(songsWithImages.length, 4)} images`);

    if (songsWithImages.length === 1) {
      console.log("Single image mode");
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      return new Promise((resolve) => {
        img.onload = () => {
          console.log("Single image loaded successfully");
          ctx.drawImage(img, 0, 0, size, size);
          // Reduced quality from 0.9 to 0.7 for faster processing
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          console.log("Single image canvas created");
          resolve(dataUrl);
        };
        img.onerror = (error) => {
          console.error("Error loading single image:", error);
          resolve(null);
        };
        img.src = songsWithImages[0].songs.imageUrl!;
      });
    }

    // Multiple images - create grid
    console.log("Multiple images mode - creating 2x2 grid");
    const imagesToLoad = songsWithImages.slice(0, 4);
    const imageSize = size / 2;
    
    // Load all images in parallel with reduced timeout
    const imagePromises = imagesToLoad.map((song, index) => {
      return new Promise<{img: HTMLImageElement, index: number} | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        // Reduced timeout from 10000ms to 2000ms for faster failure
        const timeout = setTimeout(() => {
          console.warn(`Image ${index + 1} loading timeout`);
          resolve(null);
        }, 2000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve({img, index});
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          resolve(null);
        };
        
        img.src = song.songs.imageUrl!;
      });
    });

    const loadedImages = await Promise.all(imagePromises);
    const validImages = loadedImages.filter(item => item !== null);
    
    console.log(`Successfully loaded ${validImages.length} images`);

    if (validImages.length === 0) {
      console.error("No images could be loaded");
      return null;
    }

    // Draw images in grid
    validImages.forEach((item) => {
      if (item) {
        const { img, index } = item;
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = col * imageSize;
        const y = row * imageSize;
        ctx.drawImage(img, x, y, imageSize, imageSize);
      }
    });

    // Add grid lines for better visual separation
    if (validImages.length > 1) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(imageSize, 0);
      ctx.lineTo(imageSize, size);
      ctx.stroke();
      
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, imageSize);
      ctx.lineTo(size, imageSize);
      ctx.stroke();
    }

    // Reduced quality from 0.9 to 0.7 for faster upload
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    console.log("=== PLAYLIST COVER GENERATION COMPLETED ===");
    return dataUrl;

  } catch (error) {
    console.error('Error in generatePlaylistCover:', error);
    return null;
  }
};

// Convert data URL to File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

const PlaylistDetail = () => {
  const { id: playlistId } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { play, addToQueue, queue, setQueue, currentSong, favorites, isPlaying, pause, getCurrentAudioElement } = usePlayer();
  const [dominantColors, setDominantColors] = useState<Record<string, [number, number, number] | null>>({});
  
  // Suivre le nombre précédent de chansons pour éviter de régénérer la couverture inutilement
  const previousSongCountRef = useRef<number | null>(null);

  // Function to get the actual cover image URL with cache busting
  const getCoverImageUrl = async (playlistId: string): Promise<string | null> => {
    try {
      console.log("=== GETTING COVER IMAGE URL ===");
      console.log(`Playlist ID: ${playlistId}`);
      
      const fileName = `playlist-covers/${playlistId}.jpg`;
      
      // First check if file exists
      const { data: fileList, error: listError } = await supabase.storage
        .from('media')
        .list('playlist-covers', {
          search: `${playlistId}.jpg`
        });
      
      if (listError) {
        console.error("Error listing files:", listError);
        return null;
      }
      
      if (!fileList || fileList.length === 0) {
        console.log("No cover file found in storage");
        return null;
      }
      
      console.log("Cover file found in storage:", fileList[0]);
      
      // Get public URL with timestamp to avoid cache
      const timestamp = Date.now();
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(`${fileName}?t=${timestamp}`);
      
      console.log("Generated public URL:", publicUrl);
      return publicUrl;
      
    } catch (error) {
      console.error("Error getting cover image URL:", error);
      return null;
    }
  };

  // Create or update playlist cover based on song images
  const updatePlaylistCover = async (forceUpdate = false, songsToUse?: PlaylistSong[]) => {
    // Utiliser les chansons passées en paramètre ou l'état actuel
    const currentSongs = songsToUse || songs;
    
    console.log("=== STARTING PLAYLIST COVER UPDATE ===");
    console.log(`Playlist ID: ${playlistId}`);
    console.log(`Songs count: ${currentSongs.length}`);
    console.log(`Force update: ${forceUpdate}`);
    
    if (!playlistId) {
      console.log("Cannot update cover: missing playlistId");
      return;
    }
    
    if (currentSongs.length === 0) {
      console.log("Cannot update cover: no songs");
      return;
    }
    
    try {
      setUploading(true);
      
      const coverDataUrl = await generatePlaylistCover(currentSongs);
      
      if (!coverDataUrl) {
        console.log("No cover data URL generated");
        setUploading(false);
        return;
      }
      
      console.log("Cover generated, uploading to storage...");
      
      // Convert data URL to File for upload
      const coverFile = dataURLtoFile(coverDataUrl, `playlist-${playlistId}-cover.jpg`);
      
      // Upload using Supabase storage
      const fileName = `playlist-covers/${playlistId}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, coverFile, {
          upsert: true,
          contentType: 'image/jpeg'
        });
      
      if (uploadError) throw uploadError;
      
      console.log("Cover uploaded successfully");
      
      // Get the new public URL
      const newCoverUrl = await getCoverImageUrl(playlistId);
      
      if (newCoverUrl) {
        console.log("New cover URL:", newCoverUrl);
        
        // Update playlist record
        const { error: updateError } = await supabase
          .from('playlists')
          .update({ cover_image_url: newCoverUrl })
          .eq('id', playlistId);
        
        if (updateError) {
          console.error("Error updating playlist record:", updateError);
          throw updateError;
        }
        
        // Update local state
        setPlaylist(prev => prev ? { ...prev, cover_image_url: newCoverUrl } : null);
        setCoverImageUrl(newCoverUrl);
        
        console.log("Playlist cover updated successfully");
        toast({
          description: t('playlists.coverGenerated')
        });
      }
      
      console.log("=== PLAYLIST COVER UPDATE COMPLETED ===");
    } catch (error) {
      console.error("Error updating playlist cover:", error);
      toast({
        title: t('common.error'),
        description: t('playlists.errorUploadingCover'),
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const fetchPlaylistDetails = async () => {
    if (!playlistId) return;
    
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      setCurrentUserId(user.id);
      
      // Fetch playlist details with visibility
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
      
      // Get the actual cover image URL with cache busting
      const timestamp = Date.now();
      const actualCoverUrl = await getCoverImageUrl(playlistId);
      if (actualCoverUrl) {
        setCoverImageUrl(`${actualCoverUrl}?t=${timestamp}`);
        console.log("Cover image URL set with timestamp:", `${actualCoverUrl}?t=${timestamp}`);
      } else {
        setCoverImageUrl(playlistData.cover_image_url ? `${playlistData.cover_image_url}?t=${timestamp}` : null);
      }
      
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
      console.log(`Fetched ${formattedSongs.length} songs for playlist`);
      
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

  // Watch for changes in songs to trigger cover update ONLY when songs are added/removed
  useEffect(() => {
    // Ne rien faire si :
    // - Pas de chansons
    // - Pas de playlist
    // - L'utilisateur n'est pas propriétaire
    if (!songs.length || !playlist || currentUserId !== playlist.user_id) {
      return;
    }
    
    const currentCount = songs.length;
    const previousCount = previousSongCountRef.current;
    
    // Au premier chargement (previousCount est null), on met juste à jour la référence sans régénérer
    if (previousCount === null) {
      console.log("Premier chargement, pas de régénération de couverture");
      previousSongCountRef.current = currentCount;
      return;
    }
    
    // Ne régénérer que si le nombre de chansons a changé
    if (previousCount !== currentCount) {
      console.log(`Nombre de chansons changé (${previousCount} -> ${currentCount}), régénération de la couverture...`);
      // Génération immédiate sans délai
      updatePlaylistCover(true);
      previousSongCountRef.current = currentCount;
    }
  }, [songs.length, playlist?.id, currentUserId]);


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
      
      // Get the new public URL
      const newCoverUrl = await getCoverImageUrl(playlistId);
      
      if (newCoverUrl) {
        // Update playlist record
        const { error: updateError } = await supabase
          .from('playlists')
          .update({ cover_image_url: newCoverUrl })
          .eq('id', playlistId);
        
        if (updateError) throw updateError;
        
        setPlaylist(prev => prev ? { ...prev, cover_image_url: newCoverUrl } : null);
        setCoverImageUrl(newCoverUrl);
        
        toast({
          description: t('playlists.coverUpdated')
        });
      }
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
      const updatedSongs = songs.filter(song => song.id !== playlistSongId);
      setSongs(updatedSongs);
      
      // Recalculate positions for remaining songs
      const remainingSongs = updatedSongs.sort((a, b) => a.position - b.position);
      
      // Update positions in database
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
      
      // Trigger cover update after song removal with the updated songs list
      if (updatedSongs.length > 0) {
        // Génération immédiate sans délai
        updatePlaylistCover(true, updatedSongs);
      }
      
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
      
      console.log("Songs added successfully, refreshing playlist...");
      
      // Refresh playlist data
      await fetchPlaylistDetails();
      
      toast({
        description: `${selectedSongs.length} ${t('playlists.songsAdded')}`
      });
      
      // Trigger cover update after adding songs - immédiat
      updatePlaylistCover(true);
      
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
    
    toast({
      description: t('player.playingPlaylist')
    });
  };
  
  const playSong = (song: Song) => {
    // Just play the selected song and add it to queue, like in search page
    play(song);
    
    toast({
      description: `${t('player.playing')}: ${song.title}`
    });
  };

  const isCurrentSong = (song: Song) => {
    return currentSong && currentSong.id === song.id;
  };

  const isFavoriteSong = (song: Song) => {
    return favorites.some(fav => fav.id === song.id);
  };
  
  const handleLyricsClick = (song: Song) => {
    console.log("Show lyrics for:", song.title);
  };

  const handleReportClick = (song: Song) => {
    console.log("Report song:", song.title);
  };

  const songCardContextMenu = (song: PlaylistSong) => [
    {
      label: "Retirer de la playlist",
      icon: <Trash2 className="h-4 w-4" />,
      action: () => handleRemoveSong(song.id),
      show: true
    }
  ];

  const handleVisibilityChanged = async (newVisibility: string) => {
    if (!playlistId) return;
    try {
      const { error } = await supabase
        .from('playlists')
        .update({ visibility: newVisibility })
        .eq('id', playlistId);
      if (error) throw error;
      setPlaylist(prev => prev ? { ...prev, visibility: newVisibility } : prev);
    } catch (e) {
      console.error('Error updating playlist visibility:', e);
    }
  };

  // Déterminer si l'utilisateur est propriétaire de la playlist
  const isOwner = playlist?.user_id === currentUserId;

  useEffect(() => {
    fetchPlaylistDetails();
    
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
      <Layout>
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
      </Layout>
    );
  }

  if (!playlist) {
    return (
      <Layout>
        <div className="container p-6">
          <div className="text-center py-12">
            <Music2 className="mx-auto h-16 w-16 text-spotify-neutral mb-4" />
            <p className="text-spotify-neutral text-lg">{t('playlists.notFound')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container p-6 pb-32">
          <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
            <div className="relative group w-48 h-48 min-w-48 bg-spotify-card rounded-md overflow-hidden flex items-center justify-center">
              {coverImageUrl ? (
                <img 
                  src={coverImageUrl} 
                  alt={playlist?.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error("Error loading cover image:", e);
                    setCoverImageUrl(null);
                  }}
                />
              ) : (
                <Music2 className="w-1/3 h-1/3 text-spotify-neutral" />
              )}
              
              {/* Afficher les contrôles de couverture seulement si l'utilisateur est propriétaire */}
              {isOwner && (
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex gap-2">
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
                    
                    {songs.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log("Manual cover generation button clicked");
                          updatePlaylistCover(true);
                        }}
                        disabled={uploading}
                        className="bg-spotify-accent hover:bg-spotify-accent-hover p-2 rounded-full"
                        title="Générer couverture"
                      >
                        <Music2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {uploading && (
                <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="text-xs uppercase text-spotify-neutral font-semibold mb-2">
                {t('playlists.playlist')}
              </div>
              
              {/* Afficher l'édition du nom seulement si l'utilisateur est propriétaire */}
              {isEditingName && isOwner ? (
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
                      setEditedName(playlist?.name || '');
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              ) : (
                <h1 
                  className={`text-3xl font-bold text-white mb-2 ${isOwner ? 'cursor-pointer hover:underline' : ''}`}
                  onClick={() => isOwner && setIsEditingName(true)}
                >
                  {playlist?.name}
                </h1>
              )}
              
              {playlist?.description && (
                <p className="text-spotify-neutral mb-4">{playlist.description}</p>
              )}
              
              <p className="text-sm text-spotify-neutral">
                {songs.length} {songs.length === 1 ? t('common.track') : t('common.tracks')}
              </p>
              
              <div className="flex gap-2 mt-4">
                {songs.length > 0 && (
                  <>
                    <Button 
                      onClick={playPlaylist}
                      className="bg-spotify-accent hover:bg-spotify-accent-hover rounded-full"
                    >
                      <Play className="h-5 w-5 mr-2" />
                      {t('common.play')}
                    </Button>
                  </>
                )}
                
                {/* Afficher le bouton d'ajout de musiques seulement si l'utilisateur est propriétaire */}
                {isOwner && (
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
                )}

                <PlaylistVisibilitySettings
                  playlistId={playlistId!}
                  currentVisibility={playlist?.visibility || 'private'}
                  onVisibilityChanged={handleVisibilityChanged}
                  isOwner={isOwner}
                />
              </div>
            </div>
          </div>
          
          {songs.length > 0 ? (
            <div className="space-y-2">
              {songs.map((song) => (
                <div 
                  key={song.id} 
                  className="cursor-pointer"
                  onClick={() => playSong(song.songs)}
                >
                  <SongCard
                    song={song.songs}
                    isCurrentSong={isCurrentSong(song.songs)}
                    isFavorite={isFavoriteSong(song.songs)}
                    dominantColor={dominantColors[song.songs.id] || null}
                    onLyricsClick={() => handleLyricsClick(song.songs)}
                    onReportClick={() => handleReportClick(song.songs)}
                    contextMenuItems={isOwner ? songCardContextMenu(song) : []}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-spotify-card rounded-lg">
              <Music2 className="mx-auto h-16 w-16 text-spotify-neutral mb-4" />
              <p className="text-spotify-neutral text-lg mb-4">{t('playlists.noSongs')}</p>
              {/* Afficher le bouton d'ajout seulement si l'utilisateur est propriétaire */}
              {isOwner && (
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
              )}
            </div>
          )}
        </div>
    </Layout>
  );
};

export default PlaylistDetail;