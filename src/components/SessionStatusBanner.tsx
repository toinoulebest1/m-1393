import { useListeningSession } from '@/contexts/ListeningSessionContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlayerContext } from '@/contexts/PlayerContext';

export const SessionStatusBanner = () => {
  const { currentSession, isHost } = useListeningSession();
  const { getCurrentAudioElement } = usePlayerContext();

  if (!currentSession || isHost) return null;

  const tryResume = async () => {
    const audio = getCurrentAudioElement();
    if (!audio) return;
    try {
      await audio.play();
    } catch (e) {
      // ignore - user may need to interact again
    }
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-auto max-w-md">
      {!currentSession.is_playing && (
        <Alert className="bg-yellow-500/10 border-yellow-500/50 backdrop-blur-sm">
          <Pause className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-500 font-medium">
            L'hôte a mis le titre en pause
          </AlertDescription>
        </Alert>
      )}
      
      {currentSession.is_playing && (
        <Alert className="bg-green-500/10 border-green-500/50 backdrop-blur-sm flex items-center gap-3">
          <Play className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-500 font-medium flex items-center gap-3">
            Lecture en cours
            <Button size="sm" variant="secondary" onClick={tryResume}>
              Activer l'audio
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
