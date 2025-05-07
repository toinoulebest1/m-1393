
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LoaderIcon, Search, Music } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DeezerSearchDialogProps {
  open: boolean;
  onClose: () => void;
  song: any;
  onUpdateSuccess: () => void;
}

const DeezerSearchDialog = ({ open, onClose, song, onUpdateSuccess }: DeezerSearchDialogProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState<string>(
    song.artist && song.artist !== "Unknown Artist" 
      ? `${song.artist} ${song.title}` 
      : song.title
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error(t("common.searchQueryRequired"));
      return;
    }

    try {
      setLoading(true);
      setResults([]);

      const { data, error } = await supabase.functions.invoke("deezer-search", {
        body: { query }
      });

      if (error) {
        console.error("Deezer search error:", error);
        toast.error(t("common.searchError"));
        return;
      }

      if (data && data.data) {
        setResults(data.data);
        if (data.data.length === 0) {
          toast.info(t("common.noResultsFound"));
        }
      }
    } catch (error) {
      console.error("Error during search:", error);
      toast.error(t("common.searchError"));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMetadata = async (track: any) => {
    try {
      setLoading(true);
      
      const updates: any = {};
      
      // Check what needs to be updated
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
          console.error(`Error updating song ${song.id}:`, updateError);
          toast.error(t("common.updateError"));
          return;
        }
        
        toast.success(t("common.metadataUpdated"));
        onUpdateSuccess();
      } else {
        toast.info(t("common.noChangesNeeded"));
      }
      
      onClose();
    } catch (error) {
      console.error("Error applying metadata:", error);
      toast.error(t("common.updateError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md md:max-w-xl bg-spotify-dark text-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {t("common.searchDeezer")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("common.searchDeezerDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.searchPlaceholder")}
              className="flex-1 bg-spotify-dark/50 border-border"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              autoFocus
            />
            <Button 
              type="button"
              onClick={handleSearch}
              disabled={loading}
              variant="default"
              className="gap-2"
            >
              {loading ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t("common.search")}
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center p-8">
              <LoaderIcon className="h-8 w-8 animate-spin" />
            </div>
          )}
          
          {!loading && results.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t("common.searchResults")}
              </h4>
              <div className="grid gap-2">
                {results.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-spotify-accent/10 border border-border cursor-pointer"
                    onClick={() => handleApplyMetadata(track)}
                  >
                    {track.album?.cover_small ? (
                      <img 
                        src={track.album.cover_small} 
                        alt={track.title} 
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-spotify-accent/20 flex items-center justify-center">
                        <Music className="w-6 h-6 text-spotify-accent/60" />
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium truncate">{track.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {track.artist?.name || t("common.noArtist")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {track.album?.title && `${track.album.title} • `}
                        {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleApplyMetadata(track)}
                      className="shrink-0"
                    >
                      {t("common.apply")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!loading && results.length === 0 && query !== "" && (
            <div className="text-center py-8 text-muted-foreground">
              {t("common.noResultsFound")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeezerSearchDialog;
