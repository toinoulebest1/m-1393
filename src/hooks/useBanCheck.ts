
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useBanCheck = () => {
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkBanStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Désactiver d'abord les bans expirés
      await supabase.rpc('deactivate_expired_bans');

      // Vérifier si l'utilisateur est banni
      const { data: banData, error } = await supabase
        .from('user_bans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur lors de la vérification du ban:', error);
        setIsLoading(false);
        return;
      }

      if (banData) {
        // Vérifier si le ban temporaire n'est pas expiré
        if (banData.ban_type === 'temporary' && banData.expires_at) {
          const expiryDate = new Date(banData.expires_at);
          const now = new Date();
          
          if (expiryDate <= now) {
            // Le ban a expiré, le désactiver
            await supabase
              .from('user_bans')
              .update({ is_active: false })
              .eq('id', banData.id);
            
            setIsBanned(false);
            setBanInfo(null);
          } else {
            setIsBanned(true);
            setBanInfo(banData);
          }
        } else if (banData.ban_type === 'permanent') {
          setIsBanned(true);
          setBanInfo(banData);
        }
      } else {
        setIsBanned(false);
        setBanInfo(null);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du ban:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkBanStatus();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkBanStatus();
      } else if (event === 'SIGNED_OUT') {
        setIsBanned(false);
        setBanInfo(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fonction pour déconnecter l'utilisateur banni
  const handleBannedUser = async () => {
    if (isBanned) {
      const message = banInfo?.ban_type === 'permanent' 
        ? `Votre compte a été définitivement banni. Raison: ${banInfo.reason}`
        : `Votre compte a été temporairement banni jusqu'au ${new Date(banInfo.expires_at).toLocaleDateString('fr-FR')}. Raison: ${banInfo.reason}`;
      
      toast.error(message, {
        duration: 10000,
      });
      
      await supabase.auth.signOut();
    }
  };

  useEffect(() => {
    if (isBanned && !isLoading) {
      handleBannedUser();
    }
  }, [isBanned, isLoading]);

  return {
    isBanned,
    banInfo,
    isLoading,
    refetch: checkBanStatus
  };
};
