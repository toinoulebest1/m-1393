
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Theme = {
  name: string;
  classes: string;
};

const themes: Theme[] = [
  {
    name: "Défaut",
    classes: "from-spotify-dark via-[#1e2435] to-[#141824]"
  },
  {
    name: "Multicolore",
    classes: "from-[#8B5CF6] via-[#D946EF] to-[#0EA5E9]"
  },
  {
    name: "Violet",
    classes: "from-purple-900 via-violet-800 to-purple-900"
  },
  {
    name: "Ocean",
    classes: "from-blue-900 via-blue-800 to-indigo-900"
  },
  {
    name: "Forêt",
    classes: "from-green-900 via-emerald-800 to-green-900"
  },
  {
    name: "Sunset",
    classes: "from-orange-900 via-red-800 to-pink-900"
  }
];

export function ThemeToggle() {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]);

  useEffect(() => {
    const loadUserTheme = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          return;
        }

        if (!session) {
          console.log("No active session found");
          return;
        }

        console.log("Loading theme for user:", session.user.id);
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('theme')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error("Error loading theme:", profileError);
          return;
        }

        if (profile?.theme) {
          console.log("Theme loaded from database:", profile.theme);
          const themeData = profile.theme as Theme;
          const savedTheme = themes.find(theme => theme.name === themeData.name);
          if (savedTheme) {
            setCurrentTheme(savedTheme);
          }
        }
      } catch (error) {
        console.error("Error in loadUserTheme:", error);
      }
    };

    loadUserTheme();
  }, []);

  useEffect(() => {
    const app = document.getElementById('root');
    if (!app) {
      console.error("Root element not found");
      return;
    }
    
    console.log("Applying theme:", currentTheme.name);
    
    // Retirer toutes les classes de thème existantes
    app.className = app.className
      .split(' ')
      .filter(cls => !cls.startsWith('from-') && !cls.startsWith('via-') && !cls.startsWith('to-'))
      .join(' ');
    
    // Ajouter les nouvelles classes de thème
    app.className = `min-h-screen bg-gradient-to-br ${currentTheme.classes} ${app.className}`;
    
    console.log("Theme applied:", currentTheme.name);
  }, [currentTheme]);

  const handleThemeChange = async (theme: Theme) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        toast.error("Erreur lors du changement de thème");
        return;
      }

      if (!session) {
        console.log("No active session found");
        toast.error("Vous devez être connecté pour changer de thème");
        return;
      }

      console.log("Saving theme for user:", session.user.id);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ theme })
        .eq('id', session.user.id);

      if (updateError) {
        console.error("Error saving theme:", updateError);
        toast.error("Erreur lors de la sauvegarde du thème");
        return;
      }

      setCurrentTheme(theme);
      toast.success("Thème mis à jour");
      console.log("Theme saved successfully:", theme.name);
    } catch (error) {
      console.error("Error in handleThemeChange:", error);
      toast.error("Erreur lors du changement de thème");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start text-spotify-neutral hover:text-white hover:bg-white/5"
        >
          <Palette className="w-5 h-5 mr-2" />
          <span>Thèmes</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 bg-spotify-dark border-white/10">
        {themes.map((theme) => (
          <DropdownMenuItem 
            key={theme.name}
            onClick={() => handleThemeChange(theme)}
            className={`text-spotify-neutral hover:text-white cursor-pointer ${
              currentTheme.name === theme.name ? 'bg-white/10' : ''
            }`}
          >
            <div className={`w-3 h-3 rounded-full mr-2 bg-gradient-to-br ${theme.classes}`} />
            <span>{theme.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
