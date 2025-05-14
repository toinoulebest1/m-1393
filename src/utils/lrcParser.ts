
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

    // Reset lastIndex pour assurer une nouvelle analyse à chaque ligne
    timeRegex.lastIndex = 0;

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

/**
 * Trouve la ligne de paroles correspondant à la position actuelle de lecture
 * @param lines Tableau de lignes de paroles
 * @param currentTime Temps actuel de lecture en secondes
 * @param offset Décalage en millisecondes (positif = retard, négatif = avance)
 * @returns Index de la ligne actuelle et les 3 prochaines lignes
 */
export const findCurrentLyricLine = (
  lines: LrcLine[],
  currentTime: number,
  offset: number = 0
): { current: number; next: LrcLine[] } => {
  // Correction: Convertir l'offset de millisecondes à secondes et l'appliquer correctement
  // Note: Dans le format LRC, un offset négatif signifie avancer les paroles (les afficher plus tôt)
  const adjustedTime = currentTime - (offset / 1000);

  console.log(`findCurrentLyricLine - Temps actuel: ${currentTime}s, Offset: ${offset}ms, Temps ajusté: ${adjustedTime}s`);
  
  // Si nous n'avons pas de lignes, retourner valeurs par défaut
  if (lines.length === 0) {
    console.log("Aucune ligne de paroles trouvée");
    return { current: -1, next: [] };
  }
  
  // Cas spécial: avant la première ligne
  if (adjustedTime < lines[0].time) {
    console.log(`Avant la première ligne (${lines[0].time}s), retourne index -1`);
    return { current: -1, next: lines.slice(0, Math.min(3, lines.length)) };
  }
  
  // Cas spécial: après la dernière ligne
  if (adjustedTime >= lines[lines.length - 1].time) {
    console.log(`Après la dernière ligne (${lines[lines.length - 1].time}s), retourne index ${lines.length - 1}`);
    return { current: lines.length - 1, next: [] };
  }
  
  // Recherche binaire pour trouver la ligne active plus efficacement
  let low = 0;
  let high = lines.length - 1;
  let currentIndex = -1;
  
  // Trouver la dernière ligne dont le temps est <= au temps actuel
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= adjustedTime) {
      currentIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  // Vérification supplémentaire: si nous sommes plus proches de la ligne suivante, utiliser celle-ci
  // Cela permet une meilleure synchronisation perçue en avançant légèrement l'affichage
  if (currentIndex < lines.length - 1) {
    const currentDiff = adjustedTime - lines[currentIndex].time;
    const nextDiff = lines[currentIndex + 1].time - adjustedTime;
    
    // Si nous sommes à moins de 200ms de la prochaine ligne, anticiper
    if (nextDiff < 0.2 && nextDiff < currentDiff) {
      currentIndex++;
    }
  }
  
  console.log(`Ligne active trouvée: ${currentIndex} (temps: ${currentIndex >= 0 ? lines[currentIndex].time : 'N/A'}s)`);
  
  // Récupérer les 3 prochaines lignes
  const nextLines: LrcLine[] = [];
  for (let i = currentIndex + 1; i < Math.min(currentIndex + 4, lines.length); i++) {
    nextLines.push(lines[i]);
  }
  
  console.log(`Prochaines lignes: ${nextLines.length} (temps: ${nextLines.map(l => l.time).join(', ')})`);
  
  return { current: currentIndex, next: nextLines };
};

/**
 * Parse les paroles brutes pour détecter si elles sont au format LRC
 * @param lyricsText Texte des paroles à analyser
 * @returns True si le texte semble être au format LRC
 */
export const isLrcFormat = (lyricsText: string): boolean => {
  if (!lyricsText) return false;
  
  // Expression régulière pour les timestamps LRC [mm:ss.xx]
  const timeRegex = /\[\d{2}:\d{2}\.\d{2}\]/;
  
  // Vérifier les 5 premières lignes non vides
  const lines = lyricsText.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
  
  // Si au moins 2 lignes contiennent un timestamp, considérer comme format LRC
  return lines.filter(line => timeRegex.test(line)).length >= 2;
};

/**
 * Convertit des paroles brutes en objet ParsedLrc si elles semblent être au format LRC
 * @param lyricsText Texte des paroles à analyser
 * @returns Objet ParsedLrc ou null si ce n'est pas au format LRC
 */
export const convertTextToLrc = (lyricsText: string): ParsedLrc | null => {
  if (!isLrcFormat(lyricsText)) return null;
  
  try {
    return parseLrc(lyricsText);
  } catch (error) {
    console.error("Erreur lors de la conversion du texte en LRC:", error);
    return null;
  }
};
