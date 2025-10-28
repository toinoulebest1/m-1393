
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
    const palette = colorThief.getPalette(img, 5);
    
    if (!palette || palette.length === 0) {
      return null;
    }
    
    // Calculate saturation for each color and pick the most vibrant one
    const getMostVibrantColor = (colors: number[][]) => {
      return colors.reduce((mostVibrant, color) => {
        const [r, g, b] = color;
        // Convert to HSL to get saturation
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const lightness = (max + min) / 2;
        const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
        
        const [prevR, prevG, prevB] = mostVibrant;
        const prevMax = Math.max(prevR, prevG, prevB) / 255;
        const prevMin = Math.min(prevR, prevG, prevB) / 255;
        const prevLightness = (prevMax + prevMin) / 2;
        const prevSaturation = prevMax === prevMin ? 0 : (prevMax - prevMin) / (1 - Math.abs(2 * prevLightness - 1));
        
        // Prefer colors with higher saturation and moderate lightness (not too dark, not too light)
        const score = saturation * (1 - Math.abs(lightness - 0.5));
        const prevScore = prevSaturation * (1 - Math.abs(prevLightness - 0.5));
        
        return score > prevScore ? color : mostVibrant;
      });
    };
    
    const vibrantColor = getMostVibrantColor(palette);
    return [vibrantColor[0], vibrantColor[1], vibrantColor[2]];
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
