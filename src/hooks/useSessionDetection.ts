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
      
      console.log('[Session] 🔵 Initialisation de la session:', sessionIdRef.current);
      console.log('[Session] 🔵 User ID:', userId);

      try {
        // Vérifier combien de sessions existent déjà
        const { data: existingSessions, error: countError } = await supabase
          .from('active_sessions')
          .select('*')
          .eq('user_id', userId);

        console.log('[Session] 📊 Sessions existantes:', existingSessions?.length || 0);
        if (existingSessions && existingSessions.length > 0) {
          console.log('[Session] 📋 Liste des sessions:', existingSessions);
        }

        // Enregistrer la session dans la base de données
        const { data: insertedSession, error: insertError } = await supabase
          .from('active_sessions')
          .insert({
            user_id: userId,
            session_id: sessionIdRef.current,
            browser_info: getBrowserInfo(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('[Session] ❌ Erreur lors de l\'enregistrement:', insertError);
          return;
        }

        console.log('[Session] ✅ Session enregistrée avec succès:', insertedSession);

        // Configurer le ping régulier (toutes les 2 minutes)
        pingIntervalRef.current = setInterval(async () => {
          if (!sessionIdRef.current) return;

          const { error: updateError } = await supabase
            .from('active_sessions')
            .update({ last_ping: new Date().toISOString() })
            .eq('session_id', sessionIdRef.current);

          if (updateError) {
            console.error('[Session] ❌ Erreur lors du ping:', updateError);
          } else {
            console.log('[Session] 💓 Ping envoyé');
          }
        }, 120000); // 2 minutes

        // Nettoyer les sessions inactives
        await supabase.rpc('cleanup_inactive_sessions');

        // Écouter les nouvelles sessions via Realtime
        console.log('[Session] 👂 Configuration de l\'écoute Realtime...');
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
              console.log('[Session] 🔔 Nouvelle session détectée:', payload);
              console.log('[Session] 🔍 Ma session:', sessionIdRef.current);
              console.log('[Session] 🔍 Nouvelle session:', payload.new.session_id);
              
              // Si ce n'est pas notre session
              if (payload.new.session_id !== sessionIdRef.current) {
                console.log('[Session] ⚠️ ALERTE: Déconnexion imminente - une autre session a été ouverte');
                
                // Afficher un message
                toast.error('Une nouvelle session a été ouverte sur un autre navigateur. Vous allez être déconnecté.', {
                  duration: 5000,
                });

                // Attendre un peu avant de déconnecter
                setTimeout(async () => {
                  console.log('[Session] 🚪 Déconnexion en cours...');
                  
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
              } else {
                console.log('[Session] ℹ️ C\'est notre propre session, pas de déconnexion');
              }
            }
          )
          .subscribe((status) => {
            console.log('[Session] 📡 Statut du channel Realtime:', status);
          });

      } catch (error) {
        console.error('[Session] ❌ Erreur lors de l\'initialisation:', error);
      }
    };

    initSession();

    // Nettoyage
    return () => {
      console.log('[Session] 🧹 Nettoyage de la session');
      
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
          .then(() => console.log('[Session] 🗑️ Session supprimée'));
      }
    };
  }, [userId, navigate]);
};
