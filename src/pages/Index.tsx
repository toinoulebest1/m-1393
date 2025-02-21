
import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { ReportSongDialog } from "@/components/ReportSongDialog";
import { usePlayer } from "@/contexts/PlayerContext";
import { useState } from "react";

const Index = () => {
  const [songToReport, setSongToReport] = useState<any>(null);
  const { queue, currentSong } = usePlayer();

  return (
    <div className="flex min-h-screen relative">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="absolute top-4 right-4 z-50">
          <AccountSettingsDialog />
        </div>
        <NowPlaying onReport={(song) => setSongToReport(song)} />
        
        {/* Liste de lecture */}
        <div className="p-4">
          <h2 className="text-white text-xl font-semibold mb-4">File d'attente</h2>
          <div className="space-y-2">
            {queue
              .filter(song => song.id !== currentSong?.id)
              .map((song, index) => (
                <div
                  key={song.id}
                  className="flex items-center space-x-4 p-3 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <img
                      src={song.imageUrl || `https://picsum.photos/seed/${song.id}/200/200`}
                      alt={`Pochette de ${song.title}`}
                      className="w-12 h-12 rounded-md shadow-md"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{song.title}</p>
                    <p className="text-gray-400 text-sm truncate">{song.artist}</p>
                  </div>
                  <div className="text-gray-400 text-sm">
                    {song.duration}
                  </div>
                </div>
              ))}
            {queue.length <= 1 && (
              <div className="text-gray-400 text-center py-8">
                Aucune chanson dans la file d'attente
              </div>
            )}
          </div>
        </div>

        <div id="next-song-alert" className="fixed bottom-28 right-4 z-50 transition-all duration-300 opacity-0 translate-y-2">
          <div className="bg-black/90 border border-white/10 rounded-lg p-4 shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-spotify-accent rounded-full animate-pulse" />
              <div>
                <p className="font-medium text-white">Prochaine chanson :</p>
                <p className="text-sm text-white" id="next-song-title"></p>
                <p className="text-xs text-white/75" id="next-song-artist"></p>
              </div>
            </div>
          </div>
        </div>
        <Player />
        
        <ReportSongDialog
          song={songToReport}
          onClose={() => setSongToReport(null)}
        />
      </div>
    </div>
  );
};

export default Index;
