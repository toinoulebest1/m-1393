
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
    const color = colorThief.getColor(img);
    const saturatedColor: [number, number, number] = [
      Math.min(255, color[0] * 1.2),
      Math.min(255, color[1] * 1.2),
      Math.min(255, color[2] * 1.2)
    ];
    return saturatedColor;
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
