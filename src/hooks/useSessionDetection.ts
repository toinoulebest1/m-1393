import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const generateSessionId = () => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

const getBrowserInfo = () => {
  return `${navigator.userAgent.substring(0, 100)}`;
};

export const useSessionDetection = (userId: string | undefined) => {
  const navigate = useNavigate();
  const sessionIdRef = useRef<string | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;

    const initSession = async () => {
      // Générer un ID de session unique
      sessionIdRef.current = generateSessionId();
      
      console.log('[Session] Initialisation de la session:', sessionIdRef.current);

      try {
        // Enregistrer la session dans la base de données
        const { error: insertError } = await supabase
          .from('active_sessions')
          .insert({
            user_id: userId,
            session_id: sessionIdRef.current,
            browser_info: getBrowserInfo(),
          });

        if (insertError) {
          console.error('[Session] Erreur lors de l\'enregistrement:', insertError);
          return;
        }

        console.log('[Session] Session enregistrée avec succès');

        // Configurer le ping régulier (toutes les 2 minutes)
        pingIntervalRef.current = setInterval(async () => {
          if (!sessionIdRef.current) return;

          const { error: updateError } = await supabase
            .from('active_sessions')
            .update({ last_ping: new Date().toISOString() })
            .eq('session_id', sessionIdRef.current);

          if (updateError) {
            console.error('[Session] Erreur lors du ping:', updateError);
          } else {
            console.log('[Session] Ping envoyé');
          }
        }, 120000); // 2 minutes

        // Nettoyer les sessions inactives
        await supabase.rpc('cleanup_inactive_sessions');

        // Écouter les nouvelles sessions via Realtime
        channelRef.current = supabase
          .channel('session-changes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'active_sessions',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              console.log('[Session] Nouvelle session détectée:', payload);
              
              // Si ce n'est pas notre session
              if (payload.new.session_id !== sessionIdRef.current) {
                console.log('[Session] Déconnexion: une autre session a été ouverte');
                
                // Afficher un message
                toast.error('Une nouvelle session a été ouverte sur un autre navigateur. Vous allez être déconnecté.', {
                  duration: 5000,
                });

                // Attendre un peu avant de déconnecter
                setTimeout(async () => {
                  // Supprimer notre session
                  if (sessionIdRef.current) {
                    await supabase
                      .from('active_sessions')
                      .delete()
                      .eq('session_id', sessionIdRef.current);
                  }

                  // Déconnecter
                  await supabase.auth.signOut();
                  navigate('/auth');
                }, 3000);
              }
            }
          )
          .subscribe();

      } catch (error) {
        console.error('[Session] Erreur lors de l\'initialisation:', error);
      }
    };

    initSession();

    // Nettoyage
    return () => {
      console.log('[Session] Nettoyage de la session');
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      if (sessionIdRef.current) {
        // Supprimer la session de la base de données
        supabase
          .from('active_sessions')
          .delete()
          .eq('session_id', sessionIdRef.current)
          .then(() => console.log('[Session] Session supprimée'));
      }
    };
  }, [userId, navigate]);
};
