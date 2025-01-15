import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlayer } from "@/contexts/PlayerContext";

export const NowPlaying = () => {
  const { t } = useTranslation();
  const { queue, currentSong, play } = usePlayer();

  return (
    <div className="flex-1 p-8">
      <div className="flex items-end space-x-6 mb-8">
        <img
          src={currentSong?.imageUrl || "https://picsum.photos/240/240"}
          alt="Album art"
          className="w-60 h-60 rounded-lg shadow-lg object-cover"
        />
        <div>
          <p className="text-spotify-neutral mb-2">{t('common.nowPlaying')}</p>
          <h1 className="text-4xl font-bold text-white mb-2">
            {currentSong?.title || 'Select a song'}
          </h1>
          <p className="text-spotify-neutral">
            {currentSong?.artist || 'No artist'} • {currentSong?.duration || '0:00'}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-white mb-4">{t('common.queue')}</h2>
        <div className="bg-white/5 rounded-lg">
          <div className="grid grid-cols-[1fr,1fr,auto] gap-4 p-4 text-spotify-neutral text-sm">
            <div>TITLE</div>
            <div>ARTIST</div>
            <div className="flex items-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          {queue.map((song) => (
            <div
              key={song.id}
              className="grid grid-cols-[1fr,1fr,auto] gap-4 p-4 hover:bg-white/10 transition-colors cursor-pointer text-spotify-neutral hover:text-white"
              onClick={() => play(song)}
            >
              <div>{song.title}</div>
              <div>{song.artist}</div>
              <div>{song.duration}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};