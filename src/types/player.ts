
export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
  bitrate?: string;
  genre?: string;
  deezerInfo?: {
    id?: number;
    preview?: string;
    albumCover?: string;
  };
}

export interface FavoriteStat {
  songId: string;
  count: number;
  lastUpdated: number;
  song: Song;
}

export interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  queue: Song[];
  shuffleMode: boolean;
  repeatMode: 'none' | 'one' | 'all';
  favorites: Song[];
  searchQuery: string;
  favoriteStats: FavoriteStat[];
  playbackRate: number;
  history: Song[];
  isChangingSong: boolean;
  stopCurrentSong: () => void;
  removeSong: (songId: string) => void;
  setQueue: (songs: Song[] | ((prevSongs: Song[]) => Song[])) => void;
  setHistory: (history: Song[]) => void;
  play: (song?: Song) => void;
  pause: () => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  nextSong: () => void;
  previousSong: () => void;
  addToQueue: (song: Song) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleFavorite: (song: Song) => void;
  removeFavorite: (songId: string) => void;
  setSearchQuery: (query: string) => void;
  setPlaybackRate: (rate: number) => void;
  refreshCurrentSong: () => void;
  getCurrentAudioElement: () => HTMLAudioElement | null;
}

export interface PlayerPreferences {
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
}
