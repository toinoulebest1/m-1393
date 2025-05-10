
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
    
    // Setup for mobile native app
    document.body.classList.add('capacitor-app');
    
    // Cleanup function to remove the class when component unmounts
    return () => {
      document.body.classList.remove('blind-test');
      document.body.classList.remove('capacitor-app');
    };
  }, [isBlindTest]);

  return (
    <div className="flex h-screen w-full bg-spotify-base overflow-hidden">
      <Sidebar />
      <div 
        className={`flex-1 overflow-y-auto w-full ${isMobile ? '' : 'ml-64'}`}
        style={{ 
          paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)'
        }}
      >
        <div className="w-full px-6 pb-24">
          {children}
        </div>
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
      
      {/* Add mobile styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          /* Mobile app specific styles */
          body.capacitor-app {
            overscroll-behavior: none;
            -webkit-user-select: none;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }
          
          /* Handle notch and safe areas */
          @supports (padding-top: env(safe-area-inset-top)) {
            body.capacitor-app {
              padding-top: env(safe-area-inset-top);
              padding-left: env(safe-area-inset-left);
              padding-right: env(safe-area-inset-right);
              padding-bottom: env(safe-area-inset-bottom);
            }
          }
        `
      }} />
    </div>
  );
};
