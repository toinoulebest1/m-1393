import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, LogOut, Crown } from 'lucide-react';
import { useListeningSession } from '@/contexts/ListeningSessionContext';
import { Badge } from '@/components/ui/badge';

export const SessionIndicator = () => {
  const { currentSession, isHost, leaveSession, participants } = useListeningSession();

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
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={leaveSession}
            className="h-7 px-2"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Quitter
          </Button>
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
