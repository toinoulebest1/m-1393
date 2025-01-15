import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";

const Index = () => {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <NowPlaying />
      <Player />
    </div>
  );
};

export default Index;