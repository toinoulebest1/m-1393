
import { Progress } from "@/components/ui/progress";
import { Clock, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlobalUploadProgressProps {
  isVisible: boolean;
  progress: number;
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
  estimatedTimeLeft: number;
  uploadSpeed: number;
}

export const GlobalUploadProgress = ({
  isVisible,
  progress,
  currentFile,
  filesProcessed,
  totalFiles,
  estimatedTimeLeft,
  uploadSpeed
}: GlobalUploadProgressProps) => {
  if (!isVisible) return null;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 mx-4 animate-fade-in">
      <div className="bg-spotify-dark/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-spotify-accent animate-pulse" />
              <span className="text-white font-medium">
                Upload en cours ({filesProcessed}/{totalFiles})
              </span>
            </div>
            <div className="text-sm text-spotify-neutral">
              {currentFile}
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-spotify-neutral">
            {uploadSpeed > 0 && (
              <span>{formatSpeed(uploadSpeed)}</span>
            )}
            {estimatedTimeLeft > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formatTime(estimatedTimeLeft)}</span>
              </div>
            )}
          </div>
        </div>

        <Progress 
          value={progress} 
          className="h-3 bg-white/10"
          indicatorClassName="bg-gradient-to-r from-spotify-accent to-purple-500 transition-all duration-300"
        />
        
        <div className="flex justify-between mt-2 text-sm text-spotify-neutral">
          <span>{Math.round(progress)}% terminé</span>
          <span>
            {filesProcessed > 0 && totalFiles > filesProcessed && (
              `${totalFiles - filesProcessed} fichiers restants`
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
