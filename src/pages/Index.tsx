import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex">
      <Sidebar />
      <NowPlaying />
      <Player />
    </div>
  );
};

export default Index;