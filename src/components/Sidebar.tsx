
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Upload, 
  Library, 
  Settings, 
  ChevronLeft,
  Shield,
  Cloud
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const menuItems = [
    {
      title: "Accueil",
      icon: Home,
      href: "/",
    },
    {
      title: "Upload",
      icon: Upload,
      href: "/upload",
    },
    {
      title: "Bibliothèque",
      icon: Library,
      href: "/library",
    },
    {
      title: "Paramètres",
      icon: Settings,
      href: "/settings",
    },
    {
      title: "Admin",
      icon: Shield,
      href: "/admin",
    },
    {
      title: "Dropbox",
      icon: Cloud,
      href: "/dropbox",
    },
  ];

  return (
    <div className={cn(
      "relative flex flex-col h-full bg-card border-r transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center justify-between p-4">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold">Menu</h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "h-8 w-8",
            isCollapsed && "rotate-180"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-2 p-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link key={item.href} to={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isCollapsed && "px-2"
                )}
              >
                <Icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                {!isCollapsed && item.title}
              </Button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
