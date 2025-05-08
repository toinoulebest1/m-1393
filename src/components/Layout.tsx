
import React from "react";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-spotify-base">
      <Sidebar />
      <div 
        className={`pt-6 pb-24 ${isMobile ? 'ml-0' : 'ml-64'}`}
      >
        {children}
      </div>
    </div>
  );
};

