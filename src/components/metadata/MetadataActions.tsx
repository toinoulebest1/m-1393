
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface MetadataActionsProps {
  updating: boolean;
  selectedSongsCount: number;
  onUpdateMetadata: () => void;
  onSelectAll: () => void;
  onSelectWithoutImages: () => void;
  allSelected: boolean;
}

export const MetadataActions = ({
  updating,
  selectedSongsCount,
  onUpdateMetadata,
  onSelectAll,
  onSelectWithoutImages,
  allSelected
}: MetadataActionsProps) => {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        onClick={onSelectWithoutImages}
        className="bg-spotify-dark/50 border-white/20 text-white hover:bg-white/10"
      >
        Sélectionner sans image
      </Button>
      
      <Button
        variant="outline"
        onClick={onSelectAll}
        className="bg-spotify-dark/50 border-white/20 text-white hover:bg-white/10"
      >
        {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
      </Button>
      
      <Button
        onClick={onUpdateMetadata}
        disabled={updating || selectedSongsCount === 0}
        className="bg-spotify-accent hover:bg-spotify-accent/80 text-white"
      >
        {updating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {updating ? "Mise à jour..." : `Mettre à jour (${selectedSongsCount})`}
      </Button>
    </div>
  );
};
