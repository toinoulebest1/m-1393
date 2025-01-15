import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MusicUploader } from "./MusicUploader";
import { ThemeToggle } from "./ThemeToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PlayerControls = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
      toast.success("Déconnexion réussie");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      toast.error("Erreur lors de la déconnexion");
    }
  };

  return (
    <div className="fixed bottom-24 left-0 right-0 bg-gradient-to-t from-black/90 to-black/70 backdrop-blur-xl border-t border-white/5 p-4">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <MusicUploader />
          
          <Select onValueChange={handleLanguageChange} defaultValue={i18n.language}>
            <SelectTrigger className="w-32 bg-transparent border-0 text-spotify-neutral hover:text-white focus:ring-0">
              <SelectValue placeholder="Langue" />
            </SelectTrigger>
            <SelectContent className="bg-spotify-dark border-white/10">
              <SelectItem value="fr" className="text-spotify-neutral hover:text-white cursor-pointer">
                Français
              </SelectItem>
              <SelectItem value="en" className="text-spotify-neutral hover:text-white cursor-pointer">
                English
              </SelectItem>
            </SelectContent>
          </Select>

          <ThemeToggle />
        </div>

        <Button
          variant="ghost"
          className="text-spotify-neutral hover:text-white hover:bg-white/5"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-2" />
          <span>{t('common.logout')}</span>
        </Button>
      </div>
    </div>
  );
};