
export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
  bitrate?: string;
  genre?: string;
}

export interface FavoriteStat {
  songId: string;
  count: number;
  lastUpdated: number;
  song: Song;
}

export interface EqualizerSettings {
  bands: Array<{
    frequency: number;
    gain: number;
    type: BiquadFilterType;
    Q?: number;
  }>;
  enabled: boolean;
  preAmp: number;
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
  // Fonctions existantes
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
  // Nouvelles fonctions d'égaliseur
  equalizerSettings: EqualizerSettings;
  equalizerPresets: Array<{name: string; settings: EqualizerSettings}>;
  currentEqualizerPreset: string | null;
  isEqualizerEnabled: boolean;
  isEqualizerInitialized: boolean;
  updateEqualizerBand: (index: number, gain: number) => void;
  applyEqualizerPreset: (presetName: string) => void;
  toggleEqualizer: () => void;
  resetEqualizer: () => void;
  setEqualizerPreAmp: (gain: number) => void;
  initializeEqualizer: () => void;
}

export interface PlayerPreferences {
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
}
