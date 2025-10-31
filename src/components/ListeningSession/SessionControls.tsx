import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useListeningSession } from '@/contexts/ListeningSessionContext';
import { LogOut, Users, Crown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const SessionControls = () => {
  const { 
    currentSession, 
    participants, 
    isHost, 
    leaveSession 
  } = useListeningSession();

  if (!currentSession) return null;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            {currentSession.name}
            {isHost && <Crown className="w-4 h-4 text-yellow-500" />}
          </h3>
          <p className="text-sm text-muted-foreground">
            Code: <span className="font-mono font-bold">{currentSession.join_code}</span>
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={leaveSession}>
          <LogOut className="w-4 h-4 mr-2" />
          Quitter
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">
            Participants ({participants.length})
          </span>
        </div>
        <ScrollArea className="h-32">
          <div className="space-y-1">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.username || 'Utilisateur'}</span>
                {p.user_id === currentSession.host_id && (
                  <Badge variant="secondary">Hôte</Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex gap-2 text-xs">
        <Badge variant="outline">{currentSession.control_mode}</Badge>
        <Badge variant="outline">{currentSession.visibility}</Badge>
      </div>
    </Card>
  );
};
