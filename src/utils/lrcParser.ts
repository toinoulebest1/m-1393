
/**
 * Utilitaire pour parser les fichiers LRC (Lyrics)
 * Format LRC: [MM:SS.xx]Paroles
 */

export interface LrcLine {
  time: number; // Temps en secondes
  text: string; // Texte des paroles
}

export interface ParsedLrc {
  lines: LrcLine[];
  artist?: string;
  title?: string;
  album?: string;
  by?: string;
  offset?: number;
}

/**
 * Parse un fichier LRC en objet structuré
 * @param lrcContent Contenu du fichier LRC
 * @returns Objet avec les paroles parsées et métadonnées
 */
export const parseLrc = (lrcContent: string): ParsedLrc => {
  const lines = lrcContent.split('\n');
  const result: ParsedLrc = {
    lines: []
  };

  // Expression régulière pour les tags de métadonnées et les lignes de paroles
  const metadataRegex = /^\[([a-zA-Z]+):(.+)\]$/;
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/g;

  lines.forEach(line => {
    // Ignorer les lignes vides
    if (!line.trim()) return;

    // Vérifier s'il s'agit d'une ligne de métadonnées
    const metadataMatch = line.match(metadataRegex);
    if (metadataMatch) {
      const tag = metadataMatch[1].toLowerCase();
      const value = metadataMatch[2].trim();
      
      switch (tag) {
        case 'ar':
          result.artist = value;
          break;
        case 'ti':
          result.title = value;
          break;
        case 'al':
          result.album = value;
          break;
        case 'by':
          result.by = value;
          break;
        case 'offset':
          result.offset = parseInt(value, 10);
          break;
      }
      return;
    }

    // Traiter les lignes de paroles avec timestamps
    let timeMatch;
    let lineText = line;
    const timings: number[] = [];

    // Extraire tous les timestamps de la ligne
    while ((timeMatch = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);
      const hundredths = parseInt(timeMatch[3], 10);
      
      // Convertir en secondes
      const timeInSeconds = minutes * 60 + seconds + hundredths / 100;
      timings.push(timeInSeconds);
      
      // Supprimer le timestamp du texte
      lineText = lineText.replace(timeMatch[0], '');
    }

    // Si des timestamps ont été trouvés, ajouter les entrées
    if (timings.length > 0) {
      const text = lineText.trim();
      timings.forEach(time => {
        result.lines.push({ time, text });
      });
    }
  });

  // Trier les lignes par ordre chronologique
  result.lines.sort((a, b) => a.time - b.time);
  
  return result;
};

/**
 * Convertit un objet LRC parsé en texte brut pour stockage dans la base de données
 * @param parsedLrc Objet LRC parsé
 * @returns Texte formaté des paroles
 */
export const lrcToPlainText = (parsedLrc: ParsedLrc): string => {
  let result = '';
  
  // Ajouter les métadonnées si disponibles
  if (parsedLrc.title) result += `Titre: ${parsedLrc.title}\n`;
  if (parsedLrc.artist) result += `Artiste: ${parsedLrc.artist}\n`;
  if (parsedLrc.album) result += `Album: ${parsedLrc.album}\n\n`;
  
  // Ajouter chaque ligne de paroles
  parsedLrc.lines.forEach(line => {
    // Convertir le timestamp en format MM:SS
    const minutes = Math.floor(line.time / 60);
    const seconds = Math.floor(line.time % 60);
    const timestamp = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
    
    result += `${timestamp} ${line.text}\n`;
  });
  
  return result;
};
