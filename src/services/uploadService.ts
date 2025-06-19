
interface UploadTask {
  file: File;
  id: string;
  index: number;
}

interface UploadResult {
  success: boolean;
  song?: any;
  error?: string;
  file: File;
}

export class ParallelUploadService {
  private maxConcurrentUploads = 3; // Nombre d'uploads simultanés
  private activeUploads = 0;
  private uploadQueue: UploadTask[] = [];
  private results: UploadResult[] = [];
  private onProgress: (progress: any) => void;
  private onComplete: (results: UploadResult[]) => void;

  constructor(
    onProgress: (progress: any) => void,
    onComplete: (results: UploadResult[]) => void
  ) {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
  }

  async uploadFiles(files: File[], processFileFunction: (file: File, index: number, total: number) => Promise<any>) {
    this.uploadQueue = files.map((file, index) => ({
      file,
      id: crypto.randomUUID(),
      index
    }));
    
    this.results = [];
    this.activeUploads = 0;

    // Démarrer les uploads parallèles
    for (let i = 0; i < Math.min(this.maxConcurrentUploads, files.length); i++) {
      this.processNextUpload(processFileFunction);
    }
  }

  private async processNextUpload(processFileFunction: (file: File, index: number, total: number) => Promise<any>) {
    if (this.uploadQueue.length === 0) {
      if (this.activeUploads === 0) {
        this.onComplete(this.results);
      }
      return;
    }

    const task = this.uploadQueue.shift()!;
    this.activeUploads++;

    try {
      console.log(`🚀 Démarrage upload parallèle: ${task.file.name}`);
      
      const startTime = performance.now();
      const result = await processFileFunction(task.file, task.index + 1, this.results.length + this.uploadQueue.length + this.activeUploads);
      const endTime = performance.now();
      
      console.log(`✅ Upload terminé: ${task.file.name} en ${(endTime - startTime).toFixed(0)}ms`);
      
      this.results.push({
        success: true,
        song: result,
        file: task.file
      });

      this.onProgress({
        completed: this.results.length,
        total: this.results.length + this.uploadQueue.length + this.activeUploads - 1,
        currentFile: task.file.name,
        progress: (this.results.length / (this.results.length + this.uploadQueue.length + this.activeUploads - 1)) * 100
      });

    } catch (error) {
      console.error(`❌ Erreur upload: ${task.file.name}`, error);
      
      this.results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        file: task.file
      });
    } finally {
      this.activeUploads--;
      // Continuer avec le prochain fichier
      this.processNextUpload(processFileFunction);
    }
  }
}
