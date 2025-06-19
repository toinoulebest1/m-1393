
export const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const formatBitrate = (size: number, duration: number) => {
  const bitsPerSecond = (size * 8) / duration;
  const kbps = Math.round(bitsPerSecond / 1000);
  return `${kbps} kbps`;
};

export const parseFileName = (fileName: string) => {
  // Supprimer l'extension de fichier
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  const match = nameWithoutExt.match(/^(.*?)\s*-\s*(.*)$/);
  
  if (match) {
    return {
      artist: match[1].trim(),
      title: match[2].trim()
    };
  }
  
  return {
    artist: "Unknown Artist",
    title: nameWithoutExt.trim()
  };
};

export const generateUUID = () => {
  return crypto.randomUUID();
};
