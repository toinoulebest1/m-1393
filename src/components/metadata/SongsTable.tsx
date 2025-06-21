
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Music, Search } from "lucide-react";

interface SongsTableProps {
  songs: any[];
  loading: boolean;
  selectedSongs: string[];
  onToggleSelect: (songId: string) => void;
  onOpenSearchDialog: (song: any) => void;
}

export const SongsTable = ({
  songs,
  loading,
  selectedSongs,
  onToggleSelect,
  onOpenSearchDialog
}: SongsTableProps) => {
  if (loading) {
    return (
      <Card className="bg-spotify-dark/50 border-white/10">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      </Card>
    );
  }

  if (songs.length === 0) {
    return (
      <Card className="bg-spotify-dark/50 border-white/10">
        <div className="text-center py-8 text-gray-400">
          Aucune chanson trouvée
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-spotify-dark/50 border-white/10 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-white/5">
            <TableHead className="w-12 text-white">
              <input
                type="checkbox"
                checked={selectedSongs.length === songs.length && songs.length > 0}
                onChange={() => {}}
                className="rounded border-gray-500 text-spotify-accent"
              />
            </TableHead>
            <TableHead className="w-16 text-white"></TableHead>
            <TableHead className="text-white">Titre</TableHead>
            <TableHead className="text-white">Artiste</TableHead>
            <TableHead className="text-white">Genre</TableHead>
            <TableHead className="text-white">Durée</TableHead>
            <TableHead className="w-24 text-white">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {songs.map((song) => (
            <TableRow 
              key={song.id} 
              className={`border-white/10 hover:bg-white/5 ${
                selectedSongs.includes(song.id) ? 'bg-spotify-accent/20' : ''
              }`}
            >
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedSongs.includes(song.id)}
                  onChange={() => onToggleSelect(song.id)}
                  className="rounded border-gray-500 text-spotify-accent"
                />
              </TableCell>
              <TableCell>
                {song.image_url && !song.image_url.includes('picsum') ? (
                  <img 
                    src={song.image_url} 
                    alt={song.title} 
                    className="w-10 h-10 rounded-sm object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-sm bg-white/10 flex items-center justify-center">
                    <Music className="w-6 h-6 text-white/60" />
                  </div>
                )}
              </TableCell>
              <TableCell className="font-medium text-white">{song.title}</TableCell>
              <TableCell className={`text-white ${
                song.artist === "Unknown Artist" || !song.artist ? "text-yellow-400" : ""
              }`}>
                {song.artist || "Artiste inconnu"}
              </TableCell>
              <TableCell className="text-white">{song.genre || "—"}</TableCell>
              <TableCell className="text-white">{song.duration || "—"}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenSearchDialog(song)}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  title="Rechercher manuellement"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
