
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAudioFile } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const AudioTest = () => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchAndPlayAudio = async (songId: string) => {
    setIsLoading(true);
    try {
      console.log(`Fetching audio for song ID: ${songId}`);
      
      // Get song info from database
      const { data: song, error: songError } = await supabase
        .from('songs')
        .select('file_path')
        .eq('id', songId)
        .single();
      
      if (songError) {
        throw new Error(`Failed to fetch song: ${songError.message}`);
      }
      
      if (!song || !song.file_path) {
        throw new Error('Song or file path not found');
      }
      
      console.log(`Song file path: ${song.file_path}`);
      
      // Get playable URL
      const url = await getAudioFile(song.file_path);
      console.log(`Generated audio URL: ${url}`);
      
      setAudioUrl(url);
      
      // Play audio after a short delay to ensure it's loaded
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play()
            .then(() => {
              setIsPlaying(true);
              toast.success('Audio playing from Supabase');
            })
            .catch(playError => {
              console.error('Error playing audio:', playError);
              toast.error(`Failed to play: ${playError.message}`);
            });
        }
      }, 500);
    } catch (error) {
      console.error('Error in audio test:', error);
      toast.error(`Test failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(error => {
            console.error('Error playing audio:', error);
            toast.error(`Failed to play: ${error.message}`);
          });
      }
    }
  };

  // Get first song ID from the database
  const fetchFirstSong = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        return data[0].id;
      } else {
        toast.error('No songs found in database');
        return null;
      }
    } catch (error) {
      console.error('Error fetching song:', error);
      toast.error(`Failed to fetch song: ${error.message}`);
      return null;
    }
  };

  const runTest = async () => {
    const songId = await fetchFirstSong();
    if (songId) {
      fetchAndPlayAudio(songId);
    }
  };

  return (
    <div className="p-6 border rounded-lg shadow-sm bg-card">
      <h2 className="text-xl font-bold mb-4">Test de lecture audio Supabase</h2>
      
      <div className="flex flex-col gap-4">
        <Button 
          onClick={runTest} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Chargement...' : 'Tester Supabase Audio'}
        </Button>

        {audioUrl && (
          <div className="mt-4">
            <div className="flex items-center gap-4">
              <Button 
                onClick={togglePlayPause} 
                variant="outline"
                size="sm"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {audioUrl.substring(0, 60)}...
              </span>
            </div>
            
            <audio 
              ref={audioRef}
              src={audioUrl} 
              className="mt-4 w-full" 
              controls
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
