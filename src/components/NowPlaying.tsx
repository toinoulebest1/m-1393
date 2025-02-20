
import { Clock, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlayer } from "@/contexts/PlayerContext";
import { Input } from "@/components/ui/input";

export const NowPlaying = () => {
  const { t } = useTranslation();
  const { queue, currentSong, play, searchQuery, setSearchQuery } = usePlayer();

  const filteredQueue = queue.filter(song => 
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 overflow-hidden">
      <div className="flex items-end space-x-6 mb-8 animate-fade-in">
        <img
          src={currentSong?.imageUrl || "https://picsum.photos/240/240"}
          alt="Album art"
          className="w-60 h-60 rounded-lg shadow-2xl object-cover transition-transform duration-300 hover:scale-105"
        />
        <div>
          <p className="text-spotify-neutral mb-2 text-sm tracking-wider uppercase">{t('common.nowPlaying')}</p>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-spotify-light bg-clip-text text-transparent mb-2">
            {currentSong?.title || 'Select a song'}
          </h1>
          <p className="text-spotify-neutral">
            {currentSong?.artist || 'No artist'} • {currentSong?.duration || '0:00'}
            {currentSong?.bitrate && ` • ${currentSong.bitrate}`}
          </p>
        </div>
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            {t('common.queue')}
            <div className="h-px flex-1 bg-gradient-to-r from-spotify-accent/50 to-transparent ml-4" />
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-spotify-neutral" />
            <Input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-spotify-neutral focus-visible:ring-spotify-accent"
            />
          </div>
        </div>
        
        <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl">
          <div className="grid grid-cols-[1fr,1fr,auto] gap-4 p-4 text-spotify-neutral text-sm border-b border-white/10">
            <div className="font-medium">TITLE</div>
            <div className="font-medium">ARTIST</div>
            <div className="flex items-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          {filteredQueue.map((song, index) => (
            <div
              key={song.id}
              className="grid grid-cols-[1fr,1fr,auto] gap-4 p-4 hover:bg-white/10 transition-all text-spotify-neutral hover:text-white group"
            >
              <div 
                className="flex items-center space-x-3 cursor-pointer"
                onClick={() => play(song)}
              >
                <span className="text-xs opacity-50 group-hover:opacity-100 transition-opacity">{index + 1}</span>
                <span>{song.title}</span>
              </div>
              <div>{song.artist}</div>
              <div>{song.duration}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
