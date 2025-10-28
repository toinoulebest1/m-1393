
import ColorThief from 'colorthief';

export const extractDominantColor = async (
  imageUrl: string
): Promise<[number, number, number] | null> => {
  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    const colorThief = new ColorThief();
    // Get palette instead of single dominant color for better color selection
    const palette = colorThief.getPalette(img, 8);
    
    if (!palette || palette.length === 0) {
      return null;
    }
    
    // Calculate HSL values and filter out bad colors
    const getColorHSL = (color: number[]) => {
      const [r, g, b] = color;
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const lightness = (max + min) / 2;
      const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
      
      return { r, g, b, lightness, saturation };
    };
    
    // Filter and score colors
    const validColors = palette
      .map(color => getColorHSL(color))
      .filter(color => {
        // Reject colors that are too light (white, pale pink, etc.)
        if (color.lightness > 0.75) return false;
        
        // Reject colors that are too desaturated (gray, beige, etc.)
        if (color.saturation < 0.25) return false;
        
        // Reject colors that are too dark
        if (color.lightness < 0.15) return false;
        
        return true;
      })
      .map(color => ({
        ...color,
        // Score based on saturation and ideal lightness (0.3-0.6 range)
        score: color.saturation * (1 - Math.abs(color.lightness - 0.45))
      }))
      .sort((a, b) => b.score - a.score);
    
    // Return the best color, or null if no valid colors
    if (validColors.length === 0) {
      return null;
    }
    
    const bestColor = validColors[0];
    return [bestColor.r, bestColor.g, bestColor.b];
  } catch (error) {
    console.error('Error extracting dominant color:', error);
    return null;
  }
};

export const hexToRgb = (hex: string): [number, number, number] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

export const rgbToClass = (rgb: [number, number, number]): string => {
  return `from-[rgb(${rgb[0]},${rgb[1]},${rgb[2]})] via-[rgb(${rgb[0]*0.8},${rgb[1]*0.8},${rgb[2]*0.8})] to-[rgb(${rgb[0]*0.6},${rgb[1]*0.6},${rgb[2]*0.6})]`;
};
