import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { PlayerControls } from "@/components/PlayerControls";

const Index = () => {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <NowPlaying />
      <PlayerControls />
      <Player />
    </div>
  );
};

export default Index;