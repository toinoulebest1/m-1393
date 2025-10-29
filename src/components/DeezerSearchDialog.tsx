
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Music } from "lucide-react";

interface DeezerSearchDialogProps {
  open: boolean;
  onClose: () => void;
  song: any;
  onUpdateSuccess: () => void;
}

const DeezerSearchDialog = ({ open, onClose, song, onUpdateSuccess }: DeezerSearchDialogProps) => {
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (open && song) {
      const initialQuery = song.artist && song.artist !== "Unknown Artist" 
        ? `${song.artist} ${song.title}` 
        : song.title;
      
      setQuery(initialQuery);
      setResults([]);
    }
  }, [open, song]);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Veuillez saisir un terme de recherche");
      return;
    }

    try {
      setLoading(true);
      setResults([]);

      const { data, error } = await supabase.functions.invoke("deezer-search", {
        body: { query }
      });

      if (error) {
        console.error("Erreur de recherche Deezer:", error);
        toast.error("Erreur lors de la recherche");
        return;
      }

      if (data && data.data) {
        setResults(data.data);
        if (data.data.length === 0) {
          toast.info("Aucun résultat trouvé");
        }
      }
    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMetadata = async (track: any) => {
    try {
      setLoading(true);
      
      const updates: any = {};
      
      if (track.album?.cover_xl) {
        updates.image_url = track.album.cover_xl;
      }
      
      if (track.artist?.name) {
        updates.artist = track.artist.name;
      }
      
      if (track.album?.genre_id) {
        updates.genre = String(track.album.genre_id);
      }
      
      if (track.duration) {
        const minutes = Math.floor(track.duration / 60);
        const seconds = track.duration % 60;
        updates.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      if (track.title) {
        updates.title = track.title;
      }
      
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('songs')
          .update(updates)
          .eq('id', song.id);
        
        if (updateError) {
          console.error(`Erreur lors de la mise à jour de la chanson ${song.id}:`, updateError);
          toast.error("Erreur lors de la mise à jour");
          return;
        }
        
        toast.success("Métadonnées mises à jour avec succès");
        onUpdateSuccess();
      } else {
        toast.info("Aucune modification nécessaire");
      }
      
      onClose();
    } catch (error) {
      console.error("Erreur lors de l'application des métadonnées:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl bg-spotify-dark text-white border-white/20">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Recherche Deezer
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Recherchez et appliquez les métadonnées depuis Deezer
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un titre, artiste..."
              className="flex-1 bg-spotify-dark/50 border-white/20 text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              autoFocus
            />
            <Button 
              onClick={handleSearch}
              disabled={loading}
              className="bg-spotify-accent hover:bg-spotify-accent/80"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Rechercher
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
          
          {!loading && results.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <h4 className="text-sm font-medium text-gray-400">
                Résultats de recherche
              </h4>
              <div className="grid gap-2">
                {results.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-white/10 border border-white/20 cursor-pointer transition-colors"
                    onClick={() => handleApplyMetadata(track)}
                  >
                    {track.album?.cover_small ? (
                      <img 
                        src={track.album.cover_small} 
                        alt={track.title} 
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center">
                        <Music className="w-6 h-6 text-white/60" />
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium truncate text-white">{track.title}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {track.artist?.name || "Artiste inconnu"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {track.album?.title && `${track.album.title} • `}
                        {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="shrink-0 border-white/20 text-white hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyMetadata(track);
                      }}
                    >
                      Appliquer
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!loading && results.length === 0 && query !== "" && (
            <div className="text-center py-8 text-gray-400">
              Aucun résultat trouvé
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeezerSearchDialog;
