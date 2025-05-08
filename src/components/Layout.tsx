
import React, { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const isBlindTest = location.pathname === '/blind-test';
  
  // Update body class when the component mounts or pathname changes
  useEffect(() => {
    if (isBlindTest) {
      document.body.classList.add('blind-test');
    } else {
      document.body.classList.remove('blind-test');
    }
    
    // Cleanup function to remove the class when component unmounts
    return () => {
      document.body.classList.remove('blind-test');
    };
  }, [isBlindTest]);

  return (
    <div className="min-h-screen bg-spotify-base">
      <Sidebar />
      <div 
        className={`pt-6 pb-24 ${isMobile ? 'ml-0' : 'ml-64'}`}
      >
        {children}
      </div>
      
      {/* Add some global protection against inspecting elements in blind test mode */}
      {isBlindTest && (
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Disable right-click menu on the entire blind test page */
            body.blind-test {
              -webkit-touch-callout: none;
              -webkit-user-select: none;
              -khtml-user-select: none;
              -moz-user-select: none;
              -ms-user-select: none;
              user-select: none;
            }
          `
        }} />
      )}
    </div>
  );
};
