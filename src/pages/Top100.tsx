import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { Award } from "lucide-react";

const Top100 = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex">
      <Sidebar />
      <div className="flex-1 p-6">
        <div className="flex items-center gap-4 mb-8">
          <Award className="w-8 h-8 text-spotify-accent" />
          <h1 className="text-2xl font-bold">Top 100 Communautaire</h1>
        </div>
        <div className="text-spotify-neutral">
          Cette fonctionnalité sera bientôt disponible...
        </div>
      </div>
      <NowPlaying />
      <Player />
    </div>
  );
};

export default Top100;