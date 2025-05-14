/**
 * Utilitaire pour parser les fichiers LRC (Lyrics)
 * Format LRC: Support multiple formats including:
 * [MM:SS.xx]Paroles
 * [MM.SS.xx]Paroles
 * [MM:SS:xx]Paroles
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

  // Expression régulière pour les tags de métadonnées
  const metadataRegex = /^\[([a-zA-Z]+):(.+)\]$/;
  
  // Expression régulière universelle qui capture tous les formats de timestamp possibles
  // [00:00.00], [00.00.00], [00:00:00], etc.
  const timeRegex = /\[(\d{1,2})[\.\:](\d{2})(?:[\.:](\d{2}))?\]/g;

  console.log("Début du parsing LRC avec support universel des formats");

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
    let lineText = line;
    const timings: number[] = [];

    // Extraire tous les timestamps de la ligne avec une approche manuelle plus robuste
    const matches = line.match(timeRegex);
    if (matches) {
      matches.forEach(match => {
        // Supprimer les crochets
        const timeStr = match.substring(1, match.length - 1);
        
        // Déterminer si le format utilise des points ou des deux-points
        let minutes = 0, seconds = 0, hundredths = 0;
        
        if (timeStr.includes(':')) {
          const parts = timeStr.split(':');
          minutes = parseInt(parts[0], 10);
          
          if (parts[1].includes('.')) {
            // Format [MM:SS.xx]
            const secParts = parts[1].split('.');
            seconds = parseInt(secParts[0], 10);
            hundredths = parseInt(secParts[1], 10);
          } else {
            // Format [MM:SS:xx]
            seconds = parseInt(parts[1], 10);
            if (parts.length > 2) {
              hundredths = parseInt(parts[2], 10);
            }
          }
        } else if (timeStr.includes('.')) {
          // Format [MM.SS.xx]
          const parts = timeStr.split('.');
          minutes = parseInt(parts[0], 10);
          seconds = parseInt(parts[1], 10);
          if (parts.length > 2) {
            hundredths = parseInt(parts[2], 10);
          }
        }
        
        // Convertir en secondes
        const timeInSeconds = minutes * 60 + seconds + hundredths / 100;
        timings.push(timeInSeconds);
        
        console.log(`Timestamp analysé: [${match}] => ${timeInSeconds}s (format détecté: ${timeStr})`);
        
        // Supprimer ce timestamp du texte
        lineText = lineText.replace(match, '');
      });
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
  
  console.log(`Parsing LRC terminé: ${result.lines.length} lignes trouvées`);
  
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
 * Utilise une recherche binaire pour des performances optimales
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
  if (!lines || lines.length === 0) {
    console.log("Aucune ligne de paroles trouvée");
    return { current: -1, next: [] };
  }

  // Appliquer l'offset (positif = retard, négatif = avance)
  const adjustedTime = currentTime - offset / 1000;
  
  // Logs de diagnostic plus fréquents pour détecter les problèmes de synchronisation
  if (Math.floor(currentTime * 4) % 4 === 0) {
    console.log(`Recherche de ligne pour le temps: ${currentTime.toFixed(2)}s, ajusté: ${adjustedTime.toFixed(2)}s`);
  }

  // Cas spécial: avant la première ligne
  if (adjustedTime < lines[0].time) {
    return { current: -1, next: lines.slice(0, Math.min(3, lines.length)) };
  }

  // Cas spécial: après la dernière ligne
  if (adjustedTime >= lines[lines.length - 1].time) {
    return { current: lines.length - 1, next: [] };
  }

  // Algorithme de recherche binaire optimisé pour trouver la ligne correspondante
  let start = 0;
  let end = lines.length - 1;
  
  while (start <= end) {
    const mid = Math.floor((start + end) / 2);
    
    // Si nous sommes exactement à la bonne position
    if (mid < lines.length - 1 && 
        adjustedTime >= lines[mid].time && 
        adjustedTime < lines[mid + 1].time) {
      // Récupérer les 3 prochaines lignes
      const nextLines = lines.slice(mid + 1, mid + 4);
      return { current: mid, next: nextLines };
    }
    
    // Ajuster la recherche
    if (mid < lines.length - 1 && adjustedTime >= lines[mid + 1].time) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  // Si nous arrivons ici, utiliser une approche linéaire comme fallback
  for (let i = 0; i < lines.length - 1; i++) {
    if (adjustedTime >= lines[i].time && adjustedTime < lines[i + 1].time) {
      // Log détaillé pour debug
      console.log(`Ligne trouvée (linéaire): ${i}, temps: ${lines[i].time.toFixed(2)}s <= ${adjustedTime.toFixed(2)}s < ${lines[i + 1].time.toFixed(2)}s`);
      return { 
        current: i,
        next: lines.slice(i + 1, i + 4)
      };
    }
  }

  // Fallback: trouver la ligne la plus proche
  let closestIndex = 0;
  let minDiff = Number.MAX_VALUE;
  
  for (let i = 0; i < lines.length; i++) {
    const diff = Math.abs(adjustedTime - lines[i].time);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  console.log(`Fallback: ligne la plus proche ${closestIndex}, diff: ${minDiff.toFixed(2)}s`);
  
  return { 
    current: closestIndex, 
    next: lines.slice(closestIndex + 1, closestIndex + 4).filter(l => l.time > adjustedTime)
  };
};

/**
 * Parse les paroles brutes pour détecter si elles sont au format LRC
 * @param lyricsText Texte des paroles à analyser
 * @returns True si le texte semble être au format LRC
 */
export const isLrcFormat = (lyricsText: string): boolean => {
  if (!lyricsText) return false;
  
  // Expression régulière plus robuste pour détecter les timestamps LRC
  const timeRegex = /\[\d{1,2}[\.\:]\d{2}(?:[\.\:]\d{2})?\]/;
  
  // Vérifier les 5 premières lignes non vides
  const lines = lyricsText.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
  
  // Si au moins 2 lignes contiennent un timestamp, considérer comme format LRC
  const matchCount = lines.filter(line => timeRegex.test(line)).length;
  console.log(`Détection LRC: ${matchCount} lignes sur ${lines.length} contiennent des timestamps`);
  
  return matchCount >= 2;
};

/**
 * Convertit des paroles brutes en objet ParsedLrc si elles semblent être au format LRC
 * @param lyricsText Texte des paroles à analyser
 * @returns Objet ParsedLrc ou null si ce n'est pas au format LRC
 */
export const convertTextToLrc = (lyricsText: string): ParsedLrc | null => {
  const isLrc = isLrcFormat(lyricsText);
  console.log(`Format LRC détecté: ${isLrc}`);
  
  if (!isLrc) return null;
  
  try {
    return parseLrc(lyricsText);
  } catch (error) {
    console.error("Erreur lors de la conversion du texte en LRC:", error);
    return null;
  }
};
