
/**
 * Utilitaire pour parser les fichiers LRC (Lyrics)
 * Format LRC: [MM:SS.xx]Paroles ou [MM.SS.xx]Paroles
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
  
  // Expression régulière améliorée pour supporter à la fois [MM:SS.xx] et [MM.SS.xx]
  // Cette regex capture les minutes, les secondes (avec . ou :) et les centièmes optionnels
  const timeRegex = /\[(\d{2})[:.]{1}(\d{2})(?:[:.]{1}(\d{2}))?\]/g;

  console.log("Début du parsing LRC avec support des formats [MM:SS.xx] et [MM.SS.xx]");

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
      const hundredths = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      
      // Convertir en secondes avec plus de précision
      const timeInSeconds = minutes * 60 + seconds + hundredths / 100;
      
      console.log(`Timestamp trouvé: [${timeMatch[0]}] => ${timeInSeconds}s`);
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
  const adjustedTime = currentTime - offset / 1000;
  console.log(`Recherche de ligne pour le temps: ${currentTime}s, ajusté: ${adjustedTime}s`);

  if (lines.length === 0) {
    return { current: -1, next: [] };
  }

  // Cas spécial: avant la première ligne
  if (adjustedTime < lines[0].time) {
    console.log("Avant la première ligne");
    return { current: -1, next: lines.slice(0, Math.min(3, lines.length)) };
  }

  // Cas spécial: après la dernière ligne
  if (adjustedTime >= lines[lines.length - 1].time) {
    console.log(`Après la dernière ligne (${lines.length - 1})`);
    return { current: lines.length - 1, next: [] };
  }

  // Recherche binaire pour trouver la ligne correspondante
  let left = 0;
  let right = lines.length - 1;
  let currentIndex = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    
    if (mid + 1 < lines.length && adjustedTime >= lines[mid].time && adjustedTime < lines[mid + 1].time) {
      currentIndex = mid;
      break;
    } else if (adjustedTime < lines[mid].time) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // Si pas trouvé par la recherche binaire, utiliser la méthode linéaire avec anticipation
  if (currentIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (adjustedTime >= lines[i].time) {
        // Regarder si nous sommes plus proches de la ligne suivante
        if (i < lines.length - 1) {
          const nextTime = lines[i + 1].time;
          const currentDiff = adjustedTime - lines[i].time;
          const nextDiff = nextTime - adjustedTime;

          // Si nous sommes très proches de la ligne suivante, l'utiliser
          if (nextDiff < 0.1 && nextDiff < currentDiff) {
            currentIndex = i + 1;
            continue;
          }
        }
        currentIndex = i;
      } else {
        break;
      }
    }
  }

  console.log(`Ligne trouvée: ${currentIndex}, texte: "${currentIndex >= 0 ? lines[currentIndex].text : 'aucune'}"`);

  // Récupérer les 3 prochaines lignes
  const nextLines: LrcLine[] = [];
  for (let i = currentIndex + 1; i < Math.min(currentIndex + 4, lines.length); i++) {
    nextLines.push(lines[i]);
  }

  return { current: currentIndex, next: nextLines };
};

/**
 * Parse les paroles brutes pour détecter si elles sont au format LRC
 * Supporte à la fois les formats [MM:SS.xx] et [MM.SS.xx]
 * @param lyricsText Texte des paroles à analyser
 * @returns True si le texte semble être au format LRC
 */
export const isLrcFormat = (lyricsText: string): boolean => {
  if (!lyricsText) return false;
  
  // Expression régulière pour les timestamps LRC, supporte à la fois [MM:SS.xx] et [MM.SS.xx]
  const timeRegex = /\[\d{2}[:.]\d{2}(?:[:.]\d{2})?\]/;
  
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
