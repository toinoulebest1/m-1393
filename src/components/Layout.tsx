import { Sidebar } from "./Sidebar";
import { Player } from "./Player";
import { BottomNavBar } from "./BottomNavBar";
import { useIsMobile } from "@/hooks/use-mobile";

interface LayoutProps {
  children: React.ReactNode;
  hideNavbar?: boolean;
}

export const Layout = ({ children, hideNavbar = false }: LayoutProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="relative flex h-screen overflow-hidden bg-spotify-dark text-white">
      {!hideNavbar && !isMobile && <Sidebar />}
      <div className={cn(
        "relative z-10 flex-1 flex flex-col overflow-hidden",
        (hideNavbar || isMobile) ? "w-full" : "md:ml-64"
      )}>
        <main className={cn(
          "flex-1 overflow-y-auto pb-[152px] md:pb-[88px]",
          isMobile && !hideNavbar && "pt-14"
        )}>
          {children}
        </main>
      </div>
      {!hideNavbar && isMobile && <BottomNavBar />}
      {!hideNavbar && <Player />}
    </div>
  );
};

import { cn } from "@/lib/utils";