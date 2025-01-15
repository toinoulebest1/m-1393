import { Home, Library, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const playlists = [
  "Chill Vibes",
  "Workout Mix",
  "Focus Flow",
  "Party Hits",
  "Road Trip",
];

export const Sidebar = () => {
  return (
    <div className="w-64 bg-spotify-dark h-screen p-6 flex flex-col">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white mb-8">Musicify</h1>
        
        <nav className="space-y-4">
          <a href="#" className="flex items-center space-x-3 text-white hover:text-spotify-light transition-colors">
            <Home className="w-6 h-6" />
            <span>Home</span>
          </a>
          <a href="#" className="flex items-center space-x-3 text-white hover:text-spotify-light transition-colors">
            <Search className="w-6 h-6" />
            <span>Search</span>
          </a>
          <a href="#" className="flex items-center space-x-3 text-white hover:text-spotify-light transition-colors">
            <Library className="w-6 h-6" />
            <span>Your Library</span>
          </a>
        </nav>

        <div className="mt-8">
          <h2 className="text-spotify-neutral uppercase text-sm font-bold mb-4">Playlists</h2>
          <div className="space-y-2">
            {playlists.map((playlist) => (
              <a
                key={playlist}
                href="#"
                className="block text-spotify-neutral hover:text-white transition-colors"
              >
                {playlist}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};