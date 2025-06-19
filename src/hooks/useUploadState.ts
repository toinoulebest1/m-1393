
import { useState, useRef } from 'react';

export const useUploadState = () => {
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToastId, setUploadToastId] = useState<string | number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [storageProvider, setStorageProvider] = useState<string>("Supabase");
  const [currentUploadingSong, setCurrentUploadingSong] = useState<string | null>(null);
  const lrcFilesRef = useRef<Map<string, File>>(new Map());

  return {
    uploadProgress,
    setUploadProgress,
    isUploading,
    setIsUploading,
    uploadToastId,
    setUploadToastId,
    isDragging,
    setIsDragging,
    dragCounter,
    setDragCounter,
    storageProvider,
    setStorageProvider,
    currentUploadingSong,
    setCurrentUploadingSong,
    lrcFilesRef
  };
};
