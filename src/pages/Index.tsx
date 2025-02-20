
import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { MusicUploader } from "@/components/MusicUploader";

const Index = () => {
  return (
    <div className="flex min-h-screen">
      <Sidebar>
        <MusicUploader />
      </Sidebar>
      <NowPlaying />
      <Player />
    </div>
  );
};

export default Index;
