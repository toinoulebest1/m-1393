import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ListeningSession } from '@/types/listeningSession';
import { useListeningSession } from '@/contexts/ListeningSessionContext';
import { CreateSessionDialog } from '@/components/ListeningSession/CreateSessionDialog';
import { JoinSessionDialog } from '@/components/ListeningSession/JoinSessionDialog';
import { Users } from 'lucide-react';

export default function ListeningSessions() {
  const [publicSessions, setPublicSessions] = useState<ListeningSession[]>([]);
  const { joinSession } = useListeningSession();

  useEffect(() => {
    loadPublicSessions();

    // Subscribe to changes
    const channel = supabase
      .channel('public-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listening_sessions',
          filter: 'visibility=eq.public'
        },
        () => {
          loadPublicSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPublicSessions = async () => {
    const { data } = await supabase
      .from('listening_sessions')
      .select('*')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) {
      setPublicSessions(data);
    }
  };

  const handleJoinSession = async (joinCode: string) => {
    await joinSession(joinCode);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Sessions d'écoute</h1>
            <p className="text-muted-foreground">
              Créez ou rejoignez une session pour écouter de la musique avec d'autres utilisateurs
            </p>
          </div>
          <div className="flex gap-2">
            <CreateSessionDialog />
            <JoinSessionDialog />
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold mb-4">Sessions publiques</h2>
        </div>

        {publicSessions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              Aucune session publique disponible pour le moment.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicSessions.map((session) => (
              <Card key={session.id} className="p-4 space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {session.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Code: <span className="font-mono font-bold">{session.join_code}</span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <Badge variant="outline">{session.control_mode}</Badge>
                  <Badge variant={session.is_playing ? 'default' : 'secondary'}>
                    {session.is_playing ? 'En cours' : 'En pause'}
                  </Badge>
                </div>

                <Button 
                  onClick={() => handleJoinSession(session.join_code)}
                  className="w-full"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Rejoindre
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
