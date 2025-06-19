
import { LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BannedUserPageProps {
  banInfo: {
    reason: string;
    ban_type: string;
    expires_at: string | null;
  };
}

export const BannedUserPage = ({ banInfo }: BannedUserPageProps) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-spotify-base flex items-center justify-center p-4">
      <div className="bg-spotify-dark rounded-lg p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Compte suspendu
          </h1>
          <p className="text-spotify-neutral mb-4">
            Votre compte a été suspendu pour violation des conditions d'utilisation.
          </p>
        </div>

        <div className="bg-spotify-base rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-white mb-2">Détails du bannissement :</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-spotify-neutral">Raison : </span>
              <span className="text-white">{banInfo.reason}</span>
            </div>
            <div>
              <span className="text-spotify-neutral">Type : </span>
              <span className="text-white">
                {banInfo.ban_type === 'permanent' ? 'Définitif' : 'Temporaire'}
              </span>
            </div>
            {banInfo.ban_type === 'temporary' && banInfo.expires_at && (
              <div>
                <span className="text-spotify-neutral">Expire le : </span>
                <span className="text-white">
                  {format(new Date(banInfo.expires_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </span>
              </div>
            )}
          </div>
        </div>

        <Button 
          onClick={handleLogout}
          variant="outline"
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
};
