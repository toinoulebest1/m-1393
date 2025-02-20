
import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";

const Index = () => {
  return (
    <div className="flex min-h-screen relative">
      <Sidebar />
      <div className="flex-1">
        <div className="absolute top-4 right-4 z-50">
          <AccountSettingsDialog />
        </div>
        <NowPlaying />
        <Player />
      </div>
    </div>
  );
};

export default Index;
