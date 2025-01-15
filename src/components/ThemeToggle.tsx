import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

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
    const app = document.getElementById('root');
    if (!app) return;
    
    // Remove all existing theme classes
    app.className = app.className
      .split(' ')
      .filter(cls => !cls.startsWith('from-') && !cls.startsWith('via-') && !cls.startsWith('to-'))
      .join(' ');
    
    // Add new theme classes
    app.className = `min-h-screen bg-gradient-to-br ${currentTheme.classes} ${app.className}`;
    
    console.log("Theme changed to:", currentTheme.name);
  }, [currentTheme]);

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
            onClick={() => setCurrentTheme(theme)}
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