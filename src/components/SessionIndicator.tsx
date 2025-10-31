import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, LogOut, Crown, Trash2 } from 'lucide-react';
import { useListeningSession } from '@/contexts/ListeningSessionContext';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const SessionIndicator = () => {
  const { currentSession, isHost, leaveSession, endSession, participants } = useListeningSession();

  if (!currentSession) return null;

  return (
    <Card className="fixed bottom-24 right-4 p-3 shadow-lg z-50 min-w-[280px] bg-card/95 backdrop-blur">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">En session</span>
            {isHost && <Crown className="w-3 h-3 text-yellow-500" />}
          </div>
          <div className="flex gap-1">
            {isHost ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer la session ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action mettra fin à la session pour tous les participants. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={endSession} className="bg-destructive hover:bg-destructive/90">
                      Supprimer la session
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={leaveSession}
                className="h-7 px-2"
              >
                <LogOut className="w-3 h-3 mr-1" />
                Quitter
              </Button>
            )}
          </div>
        </div>
        
        <div>
          <p className="text-xs font-medium">{currentSession.name}</p>
          <p className="text-xs text-muted-foreground">
            Code: <span className="font-mono font-bold">{currentSession.join_code}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs h-5">
            {participants.length} {participants.length > 1 ? 'participants' : 'participant'}
          </Badge>
          <Badge 
            variant={currentSession.is_playing ? 'default' : 'secondary'} 
            className="text-xs h-5"
          >
            {currentSession.is_playing ? 'En cours' : 'En pause'}
          </Badge>
        </div>
      </div>
    </Card>
  );
};
