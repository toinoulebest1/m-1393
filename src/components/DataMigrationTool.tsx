import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { migrateFilesFromSupabaseToDropbox, isDropboxEnabled } from '@/utils/dropboxStorage';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Upload, Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface Song {
  id: string;
  title: string;
  artist: string;
  file_path: string;
}

export const DataMigrationTool = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<{
    success: string[];
    failures: {id: string, error: string}[];
  } | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [dropboxReady, setDropboxReady] = useState(false);
  
  useEffect(() => {
    const checkDropbox = () => {
      setDropboxReady(isDropboxEnabled());
    };
    
    checkDropbox();
    window.addEventListener('focus', checkDropbox);
    
    return () => {
      window.removeEventListener('focus', checkDropbox);
    };
  }, []);
  
  useEffect(() => {
    const fetchSongs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('songs')
          .select('id, title, artist, file_path');
          
        if (error) {
          throw error;
        }
        
        setSongs(data || []);
      } catch (error) {
        console.error('Erreur lors de la récupération des chansons:', error);
        toast.error('Impossible de charger la liste des chansons');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSongs();
  }, []);
  
  const handleSelectAll = () => {
    if (selectedSongs.size === songs.length) {
      // If all are selected, unselect all
      setSelectedSongs(new Set());
    } else {
      // Otherwise, select all
      setSelectedSongs(new Set(songs.map(song => song.id)));
    }
  };
  
  const handleSelectSong = (songId: string) => {
    const newSelection = new Set(selectedSongs);
    if (newSelection.has(songId)) {
      newSelection.delete(songId);
    } else {
      newSelection.add(songId);
    }
    setSelectedSongs(newSelection);
  };
  
  const handleMigration = async () => {
    if (selectedSongs.size === 0) {
      toast.error('Veuillez sélectionner au moins une chanson à migrer');
      return;
    }
    
    if (!dropboxReady) {
      toast.error('Dropbox n\'est pas configuré. Veuillez configurer Dropbox dans les paramètres.');
      return;
    }
    
    setIsMigrating(true);
    setMigrationResults(null);
    
    try {
      const songIdsArray = Array.from(selectedSongs);
      let processed = 0;
      
      // Set up progress tracking
      const updateProgress = () => {
        processed++;
        const progressPercentage = (processed / songIdsArray.length) * 100;
        setCurrentProgress(progressPercentage);
      };
      
      // Add an event listener to update progress
      const originalMigrate = migrateFilesFromSupabaseToDropbox;
      const wrappedMigrate = async (songIds: string[]) => {
        const result = await originalMigrate(songIds);
        updateProgress();
        return result;
      };
      
      // Start migration with batches of 1 to show progress
      const results = {
        success: [] as string[],
        failures: [] as {id: string, error: string}[]
      };
      
      for (const songId of songIdsArray) {
        try {
          const batchResult = await wrappedMigrate([songId]);
          results.success.push(...batchResult.success);
          results.failures.push(...batchResult.failures);
        } catch (error) {
          results.failures.push({
            id: songId,
            error: error instanceof Error ? error.message : String(error)
          });
          updateProgress();
        }
      }
      
      setMigrationResults(results);
      
      // Final notification summary
      if (results.success.length > 0) {
        toast.success(`${results.success.length} fichier(s) migré(s) avec succès vers Dropbox`);
      }
      if (results.failures.length > 0) {
        toast.error(`${results.failures.length} fichier(s) n'ont pas pu être migré(s)`);
      }
    } catch (error) {
      console.error('Erreur lors de la migration:', error);
      toast.error(`Erreur lors de la migration: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsMigrating(false);
      setCurrentProgress(0);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Migration de Supabase vers Dropbox</CardTitle>
        <CardDescription>
          Transférez vos fichiers audio de Supabase Storage vers Dropbox tout en préservant les métadonnées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!dropboxReady && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-600 dark:text-yellow-400">
            <p className="text-sm">Dropbox n'est pas configuré. Veuillez configurer Dropbox dans les paramètres pour activer la migration.</p>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex items-center mb-4 justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="select-all" 
                  checked={selectedSongs.size === songs.length && songs.length > 0}
                  onCheckedChange={handleSelectAll}
                  disabled={isMigrating}
                />
                <label htmlFor="select-all" className="text-sm font-medium">
                  Tout sélectionner ({selectedSongs.size}/{songs.length})
                </label>
              </div>
              
              {selectedSongs.size > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedSongs(new Set())}
                  disabled={isMigrating}
                >
                  Effacer la sélection
                </Button>
              )}
            </div>
            
            {isMigrating && (
              <div className="mb-4">
                <Progress value={currentProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Migration en cours: {Math.round(currentProgress)}%
                </p>
              </div>
            )}
            
            <ScrollArea className="h-[300px] rounded-md border p-2">
              <div className="space-y-2">
                {songs.map(song => (
                  <div 
                    key={song.id} 
                    className={`flex items-center justify-between p-2 rounded-md ${
                      migrationResults?.success.includes(song.id) 
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : migrationResults?.failures.some(f => f.id === song.id)
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        id={`song-${song.id}`}
                        checked={selectedSongs.has(song.id)}
                        onCheckedChange={() => handleSelectSong(song.id)}
                        disabled={isMigrating}
                      />
                      <div>
                        <p className="font-medium">{song.title}</p>
                        <p className="text-sm text-muted-foreground">{song.artist || 'Artiste inconnu'}</p>
                      </div>
                    </div>
                    
                    {migrationResults && (
                      <div>
                        {migrationResults.success.includes(song.id) && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            <Check className="h-3 w-3 mr-1" /> Migré
                          </Badge>
                        )}
                        {migrationResults.failures.some(f => f.id === song.id) && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                            <X className="h-3 w-3 mr-1" /> Échec
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {songs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune chanson trouvée dans la base de données.
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {migrationResults && (
              <div className="mt-4 text-sm">
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <Badge variant="outline" className="mr-2 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                      <Check className="h-3 w-3 mr-1" />
                    </Badge>
                    {migrationResults.success.length} succès
                  </div>
                  <div className="flex items-center">
                    <Badge variant="outline" className="mr-2 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                      <X className="h-3 w-3 mr-1" />
                    </Badge>
                    {migrationResults.failures.length} échecs
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button
          onClick={handleMigration}
          disabled={selectedSongs.size === 0 || isMigrating || !dropboxReady}
          className="flex items-center"
        >
          {isMigrating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Migration en cours...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Migrer la sélection vers Dropbox
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
