
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

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
  },
  // Nouveaux thèmes ajoutés
  {
    name: "Aurore",
    classes: "from-pink-600 via-purple-700 to-indigo-800"
  },
  {
    name: "Néon",
    classes: "from-[#ff00cc] via-[#333399] to-[#0033ff]"
  },
  {
    name: "Rétro",
    classes: "from-amber-600 via-yellow-500 to-orange-500"
  },
  {
    name: "Minuit",
    classes: "from-slate-900 via-[#0f172a] to-black"
  },
  {
    name: "Pastel",
    classes: "from-pink-300 via-purple-300 to-indigo-300"
  },
  {
    name: "Cyber",
    classes: "from-cyan-500 via-[#06b6d4] to-blue-600"
  },
  {
    name: "Automne",
    classes: "from-amber-700 via-orange-600 to-red-800"
  },
  {
    name: "Glacé",
    classes: "from-cyan-200 via-blue-200 to-indigo-200"
  }
];

export function ThemeToggle() {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]);
  const [animatedTheme, setAnimatedTheme] = useState(false);

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
          .select('theme, theme_animation')
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
        
        // Charger la préférence d'animation
        if (profile?.theme_animation !== undefined) {
          setAnimatedTheme(profile.theme_animation);
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
    
    console.log("Applying theme:", currentTheme.name, "with animation:", animatedTheme);
    
    // Retirer toutes les classes de thème existantes et d'animation
    app.className = app.className
      .split(' ')
      .filter(cls => 
        !cls.startsWith('from-') && 
        !cls.startsWith('via-') && 
        !cls.startsWith('to-') && 
        !cls.includes('animate-')
      )
      .join(' ');
    
    // Ajouter les nouvelles classes de thème
    let classesToAdd = `min-h-screen bg-gradient-to-br ${currentTheme.classes}`;
    
    // Ajouter la classe d'animation si activée
    if (animatedTheme) {
      classesToAdd += ' animate-theme-transition';
    }
    
    app.className = `${classesToAdd} ${app.className}`;
    
    console.log("Theme applied:", currentTheme.name, "with animation:", animatedTheme);
  }, [currentTheme, animatedTheme]);

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
  
  const toggleAnimation = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error("Vous devez être connecté pour modifier les paramètres");
        return;
      }
      
      const newAnimationState = !animatedTheme;
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ theme_animation: newAnimationState })
        .eq('id', session.user.id);
        
      if (updateError) {
        console.error("Error updating animation setting:", updateError);
        toast.error("Erreur lors de la mise à jour des paramètres");
        return;
      }
      
      setAnimatedTheme(newAnimationState);
      toast.success(newAnimationState ? "Animation activée" : "Animation désactivée");
      console.log("Theme animation toggled:", newAnimationState);
    } catch (error) {
      console.error("Error toggling theme animation:", error);
      toast.error("Erreur lors de la modification des paramètres");
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
      <DropdownMenuContent align="end" className="w-60 bg-spotify-dark border-white/10">
        <DropdownMenuLabel className="text-sm text-spotify-neutral">Sélection du thème</DropdownMenuLabel>
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
        
        <DropdownMenuSeparator className="bg-white/10" />
        
        <DropdownMenuItem 
          className="flex items-center justify-between cursor-pointer"
          onClick={toggleAnimation}
        >
          <span className="text-spotify-neutral">Animation</span>
          <Switch 
            checked={animatedTheme}
            className="ml-2 data-[state=checked]:bg-spotify-accent"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
