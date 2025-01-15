import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";

const Index = () => {
  return (
    <div className="min-h-screen bg-spotify-dark flex">
      <Sidebar />
      <NowPlaying />
      <Player />
    </div>
  );
};

export default Index;