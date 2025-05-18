import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { searchArtist, getArtistById, DeezerTrack, DeezerAlbum, DeezerArtist } from '@/services/deezerApi';
import { usePlayer } from '@/contexts/PlayerContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Song } from '@/types/player';
import { useLocalSongs } from '@/hooks/useLocalSongs';
import AvailableSongBadge from '@/components/AvailableSongBadge';

interface ArtistProfileProps {
  artistProfile: {
    artist: DeezerArtist;
    topTracks: DeezerTrack[];
    albums: DeezerAlbum[];
  } | null;
  currentPreview: {
    id: number | null;
  };
  handlePlayPreview: (previewUrl: string, title: string, artist: string, imageUrl: string) => void;
  play: (song: Song) => void;
}

const ArtistBanner = ({ artist }: { artist: DeezerArtist }) => (
  <div className="relative w-full h-64 md:h-96 overflow-hidden rounded-b-2xl">
    <img
      src={artist.picture_xl}
      alt={artist.name}
      className="absolute inset-0 w-full h-full object-cover animate-fade-in"
      style={{ filter: 'brightness(0.6)' }}
    />
    <div className="absolute inset-0 bg-black/50" />
    <div className="absolute bottom-4 left-4 md:left-6 text-white">
      <h1 className="text-2xl md:text-4xl font-bold">{artist.name}</h1>
      <p className="text-sm md:text-base mt-1">
        {artist.nb_fan.toLocaleString()} fans
      </p>
    </div>
  </div>
);

const TopTracks = ({
  topTracks,
  currentPreview,
  handlePlayTrack,
  isTrackAvailable,
  getMatchingSong,
}: {
  topTracks: DeezerTrack[];
  currentPreview: { id: number | null };
  handlePlayTrack: (track: DeezerTrack) => void;
  isTrackAvailable: (trackId: number) => boolean;
  getMatchingSong: (trackId: number) => Song | null;
}) => (
  <section className="p-6">
    <h2 className="text-2xl font-bold mb-4">Top Titres</h2>
    <div className="space-y-2">
      {topTracks.map((track, index) => (
        <div
          key={track.id}
          className={cn(
            "grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto] gap-3 md:gap-4 p-2 rounded-lg relative group hover:bg-white/5 transition-all",
            currentPreview?.id === track.id && "bg-white/5"
          )}
          onClick={() => handlePlayTrack(track)}
        >
          <div className="flex items-center">
            <span className="w-6 text-center text-xs text-white/60">
              {index + 1}
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-white font-medium truncate">
              {track.title}
            </span>
            <span className="text-sm text-white/60 truncate">
              {track.artist.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isTrackAvailable(track.id) && (
              <AvailableSongBadge
                song={getMatchingSong(track.id)}
                title={track.title}
                artist={track.artist.name}
              />
            )}
            <span className="text-xs text-white/40 hidden md:block">
              {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {currentPreview?.id === track.id && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent pointer-events-none" />
          )}
        </div>
      ))}
    </div>
  </section>
);

const AlbumsSection = ({
  albums,
  handlePlayPreview,
}: {
  albums: DeezerAlbum[];
  handlePlayPreview: (previewUrl: string, title: string, artist: string, imageUrl: string) => void;
}) => (
  <section className="p-6">
    <h2 className="text-2xl font-bold mb-4">Albums</h2>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {albums.map((album) => (
        <div
          key={album.id}
          className="relative rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
          onClick={() => handlePlayPreview('', album.title, '', album.cover_medium)}
        >
          <img
            src={album.cover_medium}
            alt={album.title}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-black/40 hover:bg-black/60 transition-colors duration-300">
            <div className="absolute bottom-0 left-0 p-4 text-white">
              <h3 className="font-semibold">{album.title}</h3>
              <p className="text-sm">Album</p>
            </div>
            <div className="absolute top-2 right-2">
              <button className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors duration-300">
                <Play className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const ArtistProfileComponent = ({
  artistProfile,
  currentPreview,
  handlePlayPreview,
  play,
}: ArtistProfileProps) => {
  const { allSongs, findSongsByArtistName, findSongByTitleAndArtist } = useLocalSongs();
  const [availableSongs, setAvailableSongs] = useState<Map<number, Song>>(new Map());

  useEffect(() => {
    if (artistProfile?.artist && allSongs.length > 0) {
      const artistSongs = findSongsByArtistName(artistProfile.artist.name);

      const songMap = new Map<number, Song>();

      artistProfile.topTracks.forEach(track => {
        const matchingSong = findSongByTitleAndArtist(track.title, track.artist.name);

        if (matchingSong) {
          songMap.set(track.id, matchingSong);
        }
      });

      setAvailableSongs(songMap);
    }
  }, [artistProfile, allSongs]);

  const isTrackAvailable = (trackId: number): boolean => {
    return availableSongs.has(trackId);
  };

  const getMatchingSong = (trackId: number): Song | null => {
    return availableSongs.get(trackId) || null;
  };

  const handlePlayTrack = (track: DeezerTrack) => {
    const matchingSong = getMatchingSong(track.id);

    if (matchingSong) {
      play(matchingSong);
      toast.success(`Lecture de ${matchingSong.title}`);
    } else {
      handlePlayPreview(track.preview, track.title, track.artist.name, track.album.cover_medium);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {artistProfile && (
        <>
          <ArtistBanner artist={artistProfile.artist} />
          <TopTracks
            topTracks={artistProfile.topTracks}
            currentPreview={currentPreview}
            handlePlayTrack={handlePlayTrack}
            isTrackAvailable={isTrackAvailable}
            getMatchingSong={getMatchingSong}
          />
          <AlbumsSection
            albums={artistProfile.albums}
            handlePlayPreview={handlePlayPreview}
          />
        </>
      )}
    </div>
  );
};

const ArtistProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [artistProfile, setArtistProfile] = useState<{
    artist: DeezerArtist;
    topTracks: DeezerTrack[];
    albums: DeezerAlbum[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const { play } = usePlayer();
  const [currentPreview, setCurrentPreview] = useState<{ id: number | null }>({ id: null });

  useEffect(() => {
    const fetchArtistProfile = async () => {
      if (!id) {
        setError("Invalid artist ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const artistId = parseInt(id, 10);
        const profile = !isNaN(artistId) ? await getArtistById(artistId) : await searchArtist(id);

        if (profile) {
          setArtistProfile(profile);
        } else {
          setError(t('artistNotFound'));
        }
      } catch (err) {
        console.error("Error fetching artist profile:", err);
        setError(t('fetchArtistError'));
      } finally {
        setLoading(false);
      }
    };

    fetchArtistProfile();
  }, [id, t]);

  const handlePlayPreview = (previewUrl: string, title: string, artist: string, imageUrl: string) => {
    if (!previewUrl) {
      toast.error("No preview available for this track.");
      return;
    }

    const audio = new Audio(previewUrl);
    audio.play()
      .then(() => {
        toast.success(`Lecture de ${title} par ${artist}`);
        setCurrentPreview({ id: -1 });
      })
      .catch(error => {
        console.error("Error playing preview:", error);
        toast.error("Failed to play preview.");
        setCurrentPreview({ id: null });
      });
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><p>{t('loading')}</p></div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center"><p>{error}</p></div>;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <ArtistProfileComponent
        artistProfile={artistProfile}
        currentPreview={currentPreview}
        handlePlayPreview={handlePlayPreview}
        play={play}
      />
    </div>
  );
};

export default ArtistProfile;
