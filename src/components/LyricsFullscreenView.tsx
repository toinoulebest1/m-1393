
import React, { useState, useEffect } from "react";
import { X, Music, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

// Define the Song interface since we can't import it from PlayerContext
interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
  bitrate?: string;
  genre?: string;
}

interface LyricsFullscreenViewProps {
  song: Song | null;
  onClose: () => void;
}

export const LyricsFullscreenView: React.FC<LyricsFullscreenViewProps> = ({
  song,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query to fetch lyrics from the database
  const { data: lyrics, isLoading, refetch } = useQuery({
    queryKey: ["lyrics", song?.id],
    queryFn: async () => {
      if (!song?.id) return null;
      
      const { data, error } = await supabase
        .from("lyrics")
        .select("content")
        .eq("song_id", song.id)
        .maybeSingle();

      if (error) throw error;
      return data?.content || null;
    },
    enabled: !!song?.id,
  });

  // Function to generate lyrics
  const generateLyrics = async () => {
    if (!song?.title || !song?.artist) {
      setError("Impossible de récupérer les paroles sans le titre et l'artiste.");
      toast.error("Impossible de récupérer les paroles sans le titre et l'artiste.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await supabase.functions.invoke("generate-lyrics", {
        body: { songTitle: song.title, artist: song.artist },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const { error: insertError } = await supabase
        .from("lyrics")
        .upsert({
          song_id: song.id,
          content: response.data.lyrics,
        });

      if (insertError) {
        throw insertError;
      }

      await refetch();
      toast.success("Les paroles ont été récupérées avec succès");
    } catch (error) {
      console.error("Error generating lyrics:", error);
      setError(error.message || "Impossible de récupérer les paroles");
      toast.error(error.message || "Impossible de récupérer les paroles");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black bg-opacity-95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center space-x-4">
          {song?.imageUrl && (
            <img
              src={song.imageUrl || "https://picsum.photos/56/56"}
              alt="Album art"
              className="w-12 h-12 rounded-md"
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{song?.title || "Titre inconnu"}</h1>
            <p className="text-spotify-neutral">{song?.artist || "Artiste inconnu"}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Lyrics content */}
      <div className="flex-grow p-6 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-spotify-accent mr-2" />
            <span>Chargement des paroles...</span>
          </div>
        ) : lyrics ? (
          <div className="max-w-3xl mx-auto whitespace-pre-line text-spotify-neutral text-lg leading-relaxed">
            {lyrics}
          </div>
        ) : error ? (
          <div className="max-w-3xl mx-auto">
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-spotify-neutral mb-6">Aucune parole disponible pour cette chanson.</p>
            {song && (
              <Button
                onClick={generateLyrics}
                disabled={isGenerating || !song.artist}
                className="mx-auto"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Music className="h-4 w-4 mr-2" />
                )}
                Récupérer les paroles
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Optional: Add a footer here if needed */}
    </div>
  );
};
