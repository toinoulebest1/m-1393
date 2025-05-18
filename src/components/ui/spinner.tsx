
import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-spotify-accent",
        className
      )}
    />
  );
}
