import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import { getOfflineAudio } from "@/utils/offlineStorage";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";

interface DownloadedSong {
  id: string;
  title: string;
  artist: string;
  duration: string;
  downloaded_at: string;
  last_played_at: string | null;
}

const Downloads = () => {
  const { t } = useTranslation();
  const [downloads, setDownloads] = useState<DownloadedSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToQueue } = usePlayer();

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        const { data: offlineSongs, error } = await supabase
          .from('offline_songs')
          .select(`
            song_id,
            downloaded_at,
            last_played_at,
            songs (
              id,
              title,
              artist,
              duration
            )
          `)
          .order('downloaded_at', { ascending: false });

        if (error) {
          console.error("Error fetching downloads:", error);
          toast.error(t('common.errorFetchingDownloads'));
          return;
        }

        const formattedDownloads = offlineSongs.map(item => ({
          id: item.songs.id,
          title: item.songs.title,
          artist: item.songs.artist || t('common.unknownArtist'),
          duration: item.songs.duration || '0:00',
          downloaded_at: new Date(item.downloaded_at).toLocaleDateString(),
          last_played_at: item.last_played_at ? new Date(item.last_played_at).toLocaleDateString() : null
        }));

        setDownloads(formattedDownloads);
      } catch (error) {
        console.error("Error in fetchDownloads:", error);
        toast.error(t('common.errorFetchingDownloads'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchDownloads();
  }, [t]);

  const handlePlay = async (song: DownloadedSong) => {
    try {
      const audioBlob = await getOfflineAudio(song.id);
      if (!audioBlob) {
        toast.error(t('common.audioFileNotFound'));
        return;
      }

      const songToPlay = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        url: song.id,
      };

      addToQueue(songToPlay);
      
      // Update last_played_at
      await supabase
        .from('offline_songs')
        .update({ last_played_at: new Date().toISOString() })
        .eq('song_id', song.id);

    } catch (error) {
      console.error("Error playing downloaded song:", error);
      toast.error(t('common.errorPlayingDownload'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/5 rounded w-1/4"></div>
            <div className="h-64 bg-white/5 rounded"></div>
          </div>
        </div>
        <Player />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-spotify-light bg-clip-text text-transparent">
          {t('common.downloads')}
        </h1>

        {downloads.length === 0 ? (
          <div className="text-center text-spotify-neutral py-12">
            <p>{t('common.noDownloads')}</p>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl">
            <div className="grid grid-cols-[1fr,1fr,auto,auto,auto] gap-4 p-4 text-spotify-neutral text-sm border-b border-white/10">
              <div className="font-medium">{t('common.title')}</div>
              <div className="font-medium">{t('common.artist')}</div>
              <div className="font-medium">{t('common.duration')}</div>
              <div className="font-medium">{t('common.downloadedAt')}</div>
              <div className="font-medium">{t('common.lastPlayed')}</div>
            </div>
            {downloads.map((song) => (
              <div
                key={song.id}
                onClick={() => handlePlay(song)}
                className="grid grid-cols-[1fr,1fr,auto,auto,auto] gap-4 p-4 hover:bg-white/10 transition-all text-spotify-neutral hover:text-white cursor-pointer"
              >
                <div>{song.title}</div>
                <div>{song.artist}</div>
                <div>{song.duration}</div>
                <div>{song.downloaded_at}</div>
                <div>{song.last_played_at || '-'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Player />
    </div>
  );
};

export default Downloads;