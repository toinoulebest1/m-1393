
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  hideNavbar?: boolean;
}

export const Layout = ({ children, hideNavbar = false }: LayoutProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen overflow-hidden bg-spotify-dark text-white">
      {!hideNavbar && <Sidebar />}
      <div className={cn(
        "relative flex-1 flex flex-col overflow-hidden bg-spotify-dark text-white",
        hideNavbar ? "w-full" : "md:ml-60 w-full"
      )}>
        <main className="flex-1 overflow-y-auto pb-24 bg-spotify-dark text-white">
          {children}
        </main>
      </div>
    </div>
  );
};
