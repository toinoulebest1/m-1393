import * as React from "react"
import { cn } from "@/lib/utils"
import { useSidebarState } from "@/hooks/use-sidebar-state"

const Sidebar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const sidebarState = useSidebarState();

    return (
      <div
        ref={ref}
        data-state={sidebarState.state}
        className={cn(
          "fixed top-0 left-0 h-screen w-64 border-r bg-background/80 backdrop-blur-xl transition-all duration-300 z-50",
          sidebarState.state === "closed" && "-translate-x-full",
          className
        )}
        {...props}
      />
    );
  }
);
Sidebar.displayName = "Sidebar";

export { Sidebar }
