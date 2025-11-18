import { useEffect, useState } from 'react';
import { SongCard } from '@/components/SongCard';
import { Song } from '@/types/player';
import { Loader2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const SUPABASE_URL = 'https://pwknncursthenghqgevl.supabase.co';
const QOBUZ_CHARTS_URL = `${SUPABASE_URL}/functions/v1/qobuz-charts`;

// Helper pour formater la durée de secondes en MM:SS
const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const QobuzCharts = () => {
  const [charts, setCharts] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [playlistName, setPlaylistName] = useState('Top Titres');

  useEffect(() => {
    const fetchCharts = async () => {
      try {
        setLoading(true);
        const response = await fetch(QOBUZ_CHARTS_URL);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch charts: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.playlistName) {
          setPlaylistName(data.playlistName);
        }

        if (data.tracks && data.tracks.length > 0) {
          const songs: Song[] = data.tracks.map((item: any) => {
            const bitDepth = item.maximum_bit_depth || item.bit_depth;
            const samplingRate = item.maximum_sampling_rate || item.sampling_rate;
            const isHiRes = (bitDepth >= 24) || (samplingRate >= 88200);

            return {
              id: `qobuz-${item.id}`,
              title: item.title || 'Titre inconnu',
              artist: item.artist || 'Artiste inconnu',
              duration: formatDuration(item.duration),
              url: `qobuz:${item.id}`,
              imageUrl: item.albumCover || '/placeholder.svg',
              album_name: item.albumTitle || 'Album inconnu',
              genre: item.genre || undefined,
              audioQuality: bitDepth || samplingRate ? {
                bitDepth,
                samplingRate,
                isHiRes
              } : undefined,
            };
          });
          
          setCharts(songs);
        }
      } catch (error) {
        console.error('[QobuzCharts] Error fetching charts:', error);
        toast.error('Impossible de charger les meilleurs titres');
      } finally {
        setLoading(false);
      }
    };

    fetchCharts();
  }, []);

  if (loading) {
    return (
      <div className="w-full py-12 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Chargement des meilleurs titres...</p>
      </div>
    );
  }

  if (charts.length === 0) {
    return null;
  }

  return (
    <div className="w-full px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">{playlistName}</h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {charts.map((song) => (
            <SongCard
              key={song.id}
              song={song}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
