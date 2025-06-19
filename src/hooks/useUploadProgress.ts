
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
  const completedFilesRef = useRef<number>(0);

  const startUpload = useCallback((totalFiles: number) => {
    startTimeRef.current = Date.now();
    processedSizesRef.current = [];
    lastUpdateTimeRef.current = Date.now();
    completedFilesRef.current = 0;
    
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
    
    // Calcul de progression plus précis pour uploads parallèles
    const totalProgress = Math.min(
      ((completedFilesRef.current + (fileProgress / 100)) / stats.totalFiles) * 100,
      100
    );

    // Calcul vitesse d'upload amélioré
    let uploadSpeed = 0;
    if (fileSize && lastUpdateTimeRef.current > 0) {
      const timeDiff = (now - lastUpdateTimeRef.current) / 1000;
      if (timeDiff > 0) {
        uploadSpeed = fileSize / timeDiff;
        processedSizesRef.current.push(fileSize);
        
        // Moyenne mobile sur les 5 derniers uploads
        if (processedSizesRef.current.length > 5) {
          processedSizesRef.current = processedSizesRef.current.slice(-5);
        }
      }
    }

    // Estimation temps restant améliorée
    let estimatedTimeLeft = 0;
    if (totalProgress > 2) {
      const elapsedTime = (now - startTimeRef.current) / 1000;
      const avgTimePerPercent = elapsedTime / totalProgress;
      const remainingProgress = 100 - totalProgress;
      estimatedTimeLeft = avgTimePerPercent * remainingProgress;
    }

    // Mise à jour des fichiers complétés
    if (fileProgress >= 100 && filesProcessed > completedFilesRef.current) {
      completedFilesRef.current = filesProcessed;
    }

    lastUpdateTimeRef.current = now;

    setStats(prev => ({
      ...prev,
      progress: totalProgress,
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

    // Auto-hide après 3 secondes
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
    }, 3000);
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
