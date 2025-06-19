
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useBanStatus = (userId?: string) => {
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<{
    reason: string;
    ban_type: string;
    expires_at: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkBanStatus = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: bans, error } = await supabase
          .from('user_bans')
          .select('reason, ban_type, expires_at')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Erreur lors de la vérification du bannissement:', error);
          setIsLoading(false);
          return;
        }

        if (bans && bans.length > 0) {
          const ban = bans[0];
          
          // Vérifier si le ban temporaire a expiré
          if (ban.ban_type === 'temporary' && ban.expires_at) {
            const expirationDate = new Date(ban.expires_at);
            const now = new Date();
            
            if (now > expirationDate) {
              // Le ban a expiré, le désactiver
              await supabase
                .from('user_bans')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('is_active', true);
              
              setIsBanned(false);
              setBanInfo(null);
            } else {
              setIsBanned(true);
              setBanInfo(ban);
            }
          } else {
            // Ban permanent
            setIsBanned(true);
            setBanInfo(ban);
          }
        } else {
          setIsBanned(false);
          setBanInfo(null);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du bannissement:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkBanStatus();
  }, [userId]);

  return { isBanned, banInfo, isLoading };
};
