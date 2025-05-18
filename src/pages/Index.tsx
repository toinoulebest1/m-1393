
import React, { useEffect, useState } from 'react';
import { Player } from "@/components/Player";
import { MusicUploader } from "@/components/MusicUploader";
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Music2, Disc3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SongCard } from "@/components/SongCard";
import { usePlayer } from "@/contexts/PlayerContext";
import { extractDominantColor } from "@/utils/colorExtractor";
import { Song } from "@/types/player";

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentSong, favorites } = usePlayer();
  const [dominantColors, setDominantColors] = useState<Record<string, [number, number, number] | null>>({});
  
  // Récupérer les chansons récentes
  const { data: recentSongs, isLoading: loadingRecentSongs } = useQuery({
    queryKey: ['recent-songs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Erreur lors du chargement des chansons récentes:', error);
        return [];
      }
      return data;
    }
  });

  // Récupérer les playlists populaires
  const { data: playlists, isLoading: loadingPlaylists } = useQuery({
    queryKey: ['playlists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .limit(4);

      if (error) {
        console.error('Erreur lors du chargement des playlists:', error);
        return [];
      }
      return data;
    }
  });

  useEffect(() => {
    // Exécuter la fonction pour mettre à jour la structure de la table
    const updateSongsTable = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('update-songs-table');
        
        if (error) {
          console.error('Erreur lors de la mise à jour de la table songs:', error);
        } else {
          console.log('Résultat de la mise à jour de la table:', data);
        }
      } catch (err) {
        console.error('Erreur lors de l\'appel à la fonction de mise à jour:', err);
      }
    };
    
    updateSongsTable();
  }, []);

  // Extract dominant colors for song images
  useEffect(() => {
    if (recentSongs && recentSongs.length > 0) {
      recentSongs.forEach(async (song) => {
        if (song.image_url && !dominantColors[song.id]) {
          try {
            const color = await extractDominantColor(song.image_url);
            setDominantColors(prev => ({
              ...prev,
              [song.id]: color
            }));
          } catch (error) {
            console.error('Error extracting color:', error);
          }
        }
      });
    }
  }, [recentSongs, dominantColors]);

  // Convert database song to Player Song type
  const convertToPlayerSong = (dbSong: any): Song => {
    return {
      id: dbSong.id,
      title: dbSong.title,
      artist: dbSong.artist,
      duration: dbSong.duration || "0:00",
      url: dbSong.file_path,
      imageUrl: dbSong.image_url,
      bitrate: dbSong.bitrate || "320 kbps",
      genre: dbSong.genre
    };
  };

  // Check if song is favorite
  const isSongFavorite = (songId: string): boolean => {
    return favorites.some(fav => fav.id === songId);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto w-full pb-32">
        <div className="max-w-6xl mx-auto p-8">
          {/* Bannière de bienvenue */}
          <div className="relative w-full rounded-xl bg-gradient-to-r from-spotify-accent/80 to-purple-600 p-8 mb-8 overflow-hidden">
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{t('common.welcome')}</h1>
                <p className="text-white/80">{t('common.discoverMusic')}</p>
              </div>
              <div className="mt-4 md:mt-0">
                <Button 
                  onClick={() => navigate('/search')} 
                  size="lg" 
                  className="bg-white text-spotify-accent hover:bg-white/90"
                >
                  {t('common.exploreNow')}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Music Uploader */}
          <MusicUploader />
          
          {/* Chansons récentes */}
          <div className="mt-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{t('common.recentSongs')}</h2>
              <Button variant="ghost" onClick={() => navigate('/search')}>
                {t('common.viewAll')}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {loadingRecentSongs ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="bg-spotify-card rounded-md h-[220px] animate-pulse" />
                ))
              ) : recentSongs && recentSongs.length > 0 ? (
                recentSongs.map((song) => (
                  <SongCard 
                    key={song.id} 
                    song={convertToPlayerSong(song)}
                    isCurrentSong={currentSong?.id === song.id}
                    isFavorite={isSongFavorite(song.id)}
                    dominantColor={dominantColors[song.id] || null}
                  />
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center p-8 bg-spotify-card rounded-lg">
                  <Music2 className="w-12 h-12 text-spotify-neutral mb-4" />
                  <p className="text-lg font-medium text-white mb-2">{t('common.noSongsYet')}</p>
                  <p className="text-sm text-spotify-neutral mb-4">{t('common.uploadMusicPrompt')}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Playlists */}
          <div className="mt-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{t('common.playlists')}</h2>
              <Button variant="ghost" onClick={() => navigate('/playlists')}>
                {t('common.viewAll')}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {loadingPlaylists ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="bg-spotify-card rounded-md h-[220px] animate-pulse" />
                ))
              ) : playlists && playlists.length > 0 ? (
                playlists.map((playlist) => (
                  <div 
                    key={playlist.id} 
                    className="bg-spotify-card p-4 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => navigate(`/playlists/${playlist.id}`)}
                  >
                    <div className="aspect-square rounded-md bg-spotify-dark flex items-center justify-center mb-4 overflow-hidden">
                      {playlist.cover_image_url ? (
                        <img 
                          src={playlist.cover_image_url} 
                          alt={playlist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Disc3 className="w-16 h-16 text-spotify-neutral" />
                      )}
                    </div>
                    <h3 className="font-bold truncate">{playlist.name}</h3>
                    <p className="text-spotify-neutral text-sm truncate">{playlist.description || t('common.noDescription')}</p>
                  </div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center p-8 bg-spotify-card rounded-lg">
                  <Disc3 className="w-12 h-12 text-spotify-neutral mb-4" />
                  <p className="text-lg font-medium text-white mb-2">{t('common.noPlaylistsYet')}</p>
                  <p className="text-sm text-spotify-neutral mb-4">{t('common.createPlaylistPrompt')}</p>
                  <Button onClick={() => navigate('/playlists')}>{t('common.createPlaylist')}</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Player />
    </div>
  );
};

export default Index;
