
import { create } from 'zustand';
import { Song } from '@/types/player';

interface PlayerStore {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  setCurrentSong: (song: Song) => void;
  setQueue: (songs: Song[]) => void;
  play: (song?: Song) => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentSong: null,
  queue: [],
  isPlaying: false,
  
  setCurrentSong: (song) => set({ currentSong: song }),
  
  setQueue: (songs) => set({ queue: songs }),
  
  play: (song) => {
    if (song) {
      set({ currentSong: song, isPlaying: true });
    } else {
      set({ isPlaying: true });
    }
  },
  
  pause: () => set({ isPlaying: false }),
  
  next: () => {
    const { currentSong, queue } = get();
    if (!currentSong || queue.length === 0) return;
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    if (currentIndex === -1 || currentIndex === queue.length - 1) return;
    
    const nextSong = queue[currentIndex + 1];
    set({ currentSong: nextSong });
  },
  
  previous: () => {
    const { currentSong, queue } = get();
    if (!currentSong || queue.length === 0) return;
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    if (currentIndex <= 0) return;
    
    const prevSong = queue[currentIndex - 1];
    set({ currentSong: prevSong });
  },
}));
