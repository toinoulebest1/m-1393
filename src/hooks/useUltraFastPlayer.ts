import { Song } from '@/types/player';

interface UseUltraFastPlayerProps {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
}

export const useUltraFastPlayer = ({
  currentSong,
  queue,
  isPlaying
}: UseUltraFastPlayerProps) => {
  // Tout préchargement désactivé
  console.log("⚠️ useUltraFastPlayer: Préchargement totalement désactivé");

  return {
    getCacheStats: () => ({ size: 0, maxSize: 0, entries: [] })
  };
};