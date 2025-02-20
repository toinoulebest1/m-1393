
import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { MusicUploader } from "@/components/MusicUploader";

const Index = () => {
  return (
    <div className="flex min-h-screen relative">
      <Sidebar />
      <div className="flex-1">
        <div className="absolute top-4 right-4 z-50">
          <AccountSettingsDialog />
        </div>
        <NowPlaying />
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
        <div className="fixed top-4 left-[300px] z-50">
          <MusicUploader />
        </div>
        <Player />
      </div>
    </div>
  );
};

export default Index;
