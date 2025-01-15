import { Clock } from "lucide-react";

const queue = [
  { title: "Song One", artist: "Artist One", duration: "3:45" },
  { title: "Song Two", artist: "Artist Two", duration: "4:20" },
  { title: "Song Three", artist: "Artist Three", duration: "3:15" },
];

export const NowPlaying = () => {
  return (
    <div className="flex-1 p-8">
      <div className="flex items-end space-x-6 mb-8">
        <img
          src="https://picsum.photos/240/240"
          alt="Album art"
          className="w-60 h-60 rounded-lg shadow-lg"
        />
        <div>
          <p className="text-spotify-neutral mb-2">Now Playing</p>
          <h1 className="text-4xl font-bold text-white mb-2">Album Name</h1>
          <p className="text-spotify-neutral">Artist Name • 2024</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-white mb-4">Queue</h2>
        <div className="bg-white/5 rounded-lg">
          <div className="grid grid-cols-[1fr,1fr,auto] gap-4 p-4 text-spotify-neutral text-sm">
            <div>TITLE</div>
            <div>ARTIST</div>
            <div className="flex items-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          {queue.map((song, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr,1fr,auto] gap-4 p-4 hover:bg-white/10 transition-colors cursor-pointer text-spotify-neutral hover:text-white"
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