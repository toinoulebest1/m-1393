import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { migrateFilesFromSupabaseToDropbox, isDropboxEnabled } from '@/utils/dropboxStorage';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Upload, Check, X, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [bucketStatus, setBucketStatus] = useState<{exists: boolean, error?: string} | null>(null);
  
  // Check if Dropbox is configured
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
  
  // Check if the audio bucket exists
  useEffect(() => {
    const checkBucket = async () => {
      try {
        const { data: bucketsList, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          setBucketStatus({ exists: false, error: `Erreur lors de la vérification des buckets: ${bucketsError.message}` });
          return;
        }
        
        const audioBucket = bucketsList?.find(bucket => bucket.name === 'audio');
        setBucketStatus({ exists: !!audioBucket });
      } catch (error) {
        setBucketStatus({ exists: false, error: error instanceof Error ? error.message : String(error) });
      }
    };
    
    checkBucket();
  }, []);
  
  // Fetch songs from Supabase database
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
    
    if (!bucketStatus?.exists) {
      toast.error('Le bucket audio n\'existe pas dans Supabase Storage.');
      return;
    }
    
    setIsMigrating(true);
    setMigrationResults(null);
    
    try {
      const songIdsArray = Array.from(selectedSongs);
      
      // Start with progress at 0
      setCurrentProgress(0);
      
      // Get migration results
      const results = await migrateFilesFromSupabaseToDropbox(songIdsArray);
      
      // Set full progress when complete
      setCurrentProgress(100);
      setMigrationResults(results);
    } catch (error) {
      console.error('Erreur lors de la migration:', error);
      toast.error(`Erreur lors de la migration: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsMigrating(false);
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
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Dropbox n'est pas configuré. Veuillez configurer Dropbox dans les paramètres pour activer la migration.
            </AlertDescription>
          </Alert>
        )}
        
        {!bucketStatus?.exists && bucketStatus !== null && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {bucketStatus.error || "Le bucket 'audio' n'existe pas dans Supabase Storage. Veuillez créer le bucket avant de continuer."}
            </AlertDescription>
          </Alert>
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
                          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" title={
                            migrationResults.failures.find(f => f.id === song.id)?.error
                          }>
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
              <div className="mt-4 p-3 bg-slate-50 rounded-md dark:bg-slate-900">
                <h3 className="font-medium mb-2">Résultats de la migration</h3>
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
                
                {migrationResults.failures.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium mb-1">Détails des erreurs:</h4>
                    <ScrollArea className="h-[100px] w-full rounded-md border p-2 mt-1">
                      <ul className="space-y-1 text-sm">
                        {migrationResults.failures.map((failure, index) => (
                          <li key={index} className="text-red-600 dark:text-red-400">
                            <span className="font-medium">{failure.id}</span>: {failure.error}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button
          onClick={handleMigration}
          disabled={selectedSongs.size === 0 || isMigrating || !dropboxReady || !bucketStatus?.exists}
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
