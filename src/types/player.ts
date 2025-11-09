export interface Song {
  id: string;
  title: string;
  artist: string;
  duration?: string;
  url: string;
  imageUrl?: string;
  genre?: string;
  created_at?: string;
  user_id?: string;
  bitrate?: string;
  album_name?: string; // Add album name for LRCLIB API
  tidal_id?: string; // Tidal track ID
  isLocal?: boolean;
}

export interface FavoriteStat {
  id: string;
  songId: string;
  count: number;
  lastUpdated?: string;
}

export interface PlayerPreferences {
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
}

export interface MaskingState {
  title: boolean;
  artist: boolean;
  image: boolean;
}

export interface UsePlayerQueueProps {
  currentSong: Song | null;
  isChangingSong: boolean;
  setIsChangingSong: (value: boolean) => void;
  play: (song: Song) => Promise<void>;
  history: Song[];
  setHistory: (history: Song[] | ((prevHistory: Song[]) => Song[])) => void;
}

export interface PlayerContextType {
  currentSong: Song | null;
  displayedSong: Song | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  queue: Song[];
  shuffleMode: boolean;
  repeatMode: 'none' | 'all' | 'one';
  favorites: Song[];
  searchQuery: string;
  favoriteStats: any;
  playbackRate: number;
  history: Song[];
  isChangingSong: boolean;
  isAudioReady: boolean;
  maskingState: MaskingState | null; // État pour le masquage
  setMaskingState: (state: MaskingState | null) => void; // Fonction pour mettre à jour l'état
  stopCurrentSong: () => void;
  removeSong: (songId: string) => void;
  setQueue: (queue: Song[] | ((prevQueue: Song[]) => Song[])) => void;
  setHistory: (history: Song[] | ((prevHistory: Song[]) => Song[])) => void;
  play: (song?: Song) => void;
  pause: () => void;
  resume: () => void;
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
  getCurrentAudioElement: () => HTMLAudioElement;
}