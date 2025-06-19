
import { useState, useCallback, useRef } from 'react';

interface UploadStats {
  isUploading: boolean;
  progress: number;
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
  estimatedTimeLeft: number;
  uploadSpeed: number;
}

export const useUploadProgress = () => {
  const [stats, setStats] = useState<UploadStats>({
    isUploading: false,
    progress: 0,
    currentFile: '',
    filesProcessed: 0,
    totalFiles: 0,
    estimatedTimeLeft: 0,
    uploadSpeed: 0
  });

  const startTimeRef = useRef<number>(0);
  const processedSizesRef = useRef<number[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);

  const startUpload = useCallback((totalFiles: number) => {
    startTimeRef.current = Date.now();
    processedSizesRef.current = [];
    lastUpdateTimeRef.current = Date.now();
    
    setStats({
      isUploading: true,
      progress: 0,
      currentFile: '',
      filesProcessed: 0,
      totalFiles,
      estimatedTimeLeft: 0,
      uploadSpeed: 0
    });
  }, []);

  const updateProgress = useCallback((
    currentFile: string,
    filesProcessed: number,
    fileProgress: number = 100,
    fileSize?: number
  ) => {
    const now = Date.now();
    const totalProgress = filesProcessed > 0 
      ? ((filesProcessed - 1) / stats.totalFiles) * 100 + (fileProgress / stats.totalFiles)
      : (fileProgress / stats.totalFiles);

    // Calculer la vitesse d'upload
    let uploadSpeed = 0;
    if (fileSize && lastUpdateTimeRef.current > 0) {
      const timeDiff = (now - lastUpdateTimeRef.current) / 1000; // en secondes
      if (timeDiff > 0) {
        uploadSpeed = fileSize / timeDiff;
        processedSizesRef.current.push(fileSize);
      }
    }

    // Calculer le temps estimé
    let estimatedTimeLeft = 0;
    if (totalProgress > 5) { // Attendre au moins 5% pour avoir une estimation
      const elapsedTime = (now - startTimeRef.current) / 1000;
      const remainingProgress = 100 - totalProgress;
      estimatedTimeLeft = (elapsedTime / totalProgress) * remainingProgress;
    }

    lastUpdateTimeRef.current = now;

    setStats(prev => ({
      ...prev,
      progress: Math.min(totalProgress, 100),
      currentFile,
      filesProcessed,
      estimatedTimeLeft,
      uploadSpeed: uploadSpeed || prev.uploadSpeed
    }));
  }, [stats.totalFiles]);

  const completeUpload = useCallback(() => {
    setStats(prev => ({
      ...prev,
      isUploading: false,
      progress: 100
    }));

    // Masquer la barre après 2 secondes
    setTimeout(() => {
      setStats({
        isUploading: false,
        progress: 0,
        currentFile: '',
        filesProcessed: 0,
        totalFiles: 0,
        estimatedTimeLeft: 0,
        uploadSpeed: 0
      });
    }, 2000);
  }, []);

  const cancelUpload = useCallback(() => {
    setStats({
      isUploading: false,
      progress: 0,
      currentFile: '',
      filesProcessed: 0,
      totalFiles: 0,
      estimatedTimeLeft: 0,
      uploadSpeed: 0
    });
  }, []);

  return {
    stats,
    startUpload,
    updateProgress,
    completeUpload,
    cancelUpload
  };
};
