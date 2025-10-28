
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
  stopCurrentSong: () => void;
  removeSong: (songId: string) => void;
  setQueue: (queue: Song[]) => void;
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
  getCurrentAudioElement: () => HTMLAudioElement;
  
  // Equalizer properties - Fix type mismatches
  equalizerSettings: number[];
  equalizerPresets: Record<string, number[]>;
  currentEqualizerPreset: string | null;
  isEqualizerEnabled: boolean;
  isEqualizerInitialized: boolean;
  updateEqualizerBand: (index: number, value: number) => void;
  applyEqualizerPreset: (presetName: string) => void;
  toggleEqualizer: () => void;
  resetEqualizer: () => void;
  setEqualizerPreAmp: (value: number) => void;
  initializeEqualizer: () => void;
}
