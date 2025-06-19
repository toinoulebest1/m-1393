
export const handleDrop = async (
  e: React.DragEvent,
  setDragCounter: (counter: number) => void,
  setIsDragging: (dragging: boolean) => void,
  processFiles: (files: FileList | File[]) => Promise<void>
) => {
  e.preventDefault();
  e.stopPropagation();
  setDragCounter(0);
  setIsDragging(false);

  // Vérifier si nous avons des fichiers
  if (e.dataTransfer.items) {
    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    const processEntry = async (entry: FileSystemEntry | null) => {
      if (!entry) return;
      
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => {
          (entry as FileSystemFileEntry).file(resolve);
        });
        if (file.type.startsWith('audio/')) {
          files.push(file);
        }
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        try {
          const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
            reader.readEntries((entries) => resolve(entries), reject);
          });
          await Promise.all(entries.map(processEntry));
        } catch (error) {
          console.error("Erreur lors de la lecture du dossier:", error);
        }
      }
    };

    try {
      await Promise.all(
        items
          .map(item => item.webkitGetAsEntry())
          .filter((entry): entry is FileSystemEntry => entry !== null)
          .map(processEntry)
      );

      if (files.length > 0) {
        await processFiles(files);
      } else {
        // Essayer de récupérer les fichiers directement si la méthode webkitGetAsEntry a échoué
        const directFiles = Array.from(e.dataTransfer.files);
        if (directFiles.length > 0) {
          await processFiles(directFiles);
        } else {
          const { toast } = await import('sonner');
          toast.error("Aucun fichier audio trouvé dans le dossier");
        }
      }
    } catch (error) {
      console.error("Erreur lors du traitement des fichiers:", error);
      const { toast } = await import('sonner');
      toast.error("Erreur lors du traitement des fichiers");
    }
  }
};

export const handleDragEnter = (
  e: React.DragEvent,
  setDragCounter: (counter: number) => void,
  setIsDragging: (dragging: boolean) => void
) => {
  e.preventDefault();
  e.stopPropagation();
  setDragCounter(prev => prev + 1);
  setIsDragging(true);
};

export const handleDragLeave = (
  e: React.DragEvent,
  dragCounter: number,
  setDragCounter: (counter: number) => void,
  setIsDragging: (dragging: boolean) => void
) => {
  e.preventDefault();
  e.stopPropagation();
  setDragCounter(prev => prev - 1);
  if (dragCounter - 1 === 0) {
    setIsDragging(false);
  }
};

export const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};
