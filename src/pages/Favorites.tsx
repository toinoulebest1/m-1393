import { usePlayer } from "@/contexts/PlayerContext";
import { Clock, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";

const Favorites = () => {
  const { t } = useTranslation();
  const { favorites, play } = usePlayer();

  return (
    <div className="flex-1 p-8">
      <div className="flex items-end space-x-6 mb-8">
        <div className="w-60 h-60 bg-gradient-to-br from-spotify-accent to-spotify-accent/50 rounded-lg shadow-2xl flex items-center justify-center">
          <Heart className="w-24 h-24 text-white" />
        </div>
        <div>
          <p className="text-spotify-neutral mb-2 text-sm tracking-wider uppercase">Playlist</p>
          <h1 className="text-4xl font-bold text-white mb-2">{t('common.favorites')}</h1>
          <p className="text-spotify-neutral">
            {favorites.length} {favorites.length === 1 ? t('common.track') : t('common.tracks')}
          </p>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="w-16 h-16 text-spotify-neutral mx-auto mb-4" />
          <p className="text-spotify-neutral text-lg">{t('common.noFavorites')}</p>
          <p className="text-spotify-neutral text-sm mt-2">
            {t('common.clickHeartToAdd')}
          </p>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-xl">
          <div className="grid grid-cols-[1fr,1fr,auto] gap-4 p-4 text-spotify-neutral text-sm border-b border-white/10">
            <div className="font-medium">TITLE</div>
            <div className="font-medium">ARTIST</div>
            <div className="flex items-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          {favorites.map((song, index) => (
            <div
              key={song.id}
              className="grid grid-cols-[1fr,1fr,auto] gap-4 p-4 hover:bg-white/10 transition-all cursor-pointer text-spotify-neutral hover:text-white group"
              onClick={() => play(song)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xs opacity-50 group-hover:opacity-100 transition-opacity">
                  {index + 1}
                </span>
                <span>{song.title}</span>
              </div>
              <div>{song.artist}</div>
              <div>{song.duration}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;