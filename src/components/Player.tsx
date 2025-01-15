import { Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export const Player = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-spotify-dark/90 backdrop-blur-lg border-t border-white/10 p-4">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img
            src="https://picsum.photos/56/56"
            alt="Album art"
            className="w-14 h-14 rounded-md"
          />
          <div>
            <h3 className="text-white font-medium">Current Song</h3>
            <p className="text-spotify-neutral text-sm">Artist Name</p>
          </div>
        </div>

        <div className="flex flex-col items-center space-y-2 flex-1 max-w-xl">
          <div className="flex items-center space-x-6">
            <button className="text-spotify-neutral hover:text-white transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            <button className="bg-white rounded-full p-2 hover:scale-105 transition-transform">
              <Pause className="w-6 h-6 text-spotify-dark" />
            </button>
            <button className="text-spotify-neutral hover:text-white transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
          <div className="w-full flex items-center space-x-2">
            <span className="text-xs text-spotify-neutral">1:23</span>
            <Slider
              defaultValue={[33]}
              max={100}
              step={1}
              className="w-full"
            />
            <span className="text-xs text-spotify-neutral">3:45</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Volume2 className="text-spotify-neutral w-5 h-5" />
          <Slider
            defaultValue={[70]}
            max={100}
            step={1}
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
};