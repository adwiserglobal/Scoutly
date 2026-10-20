/** Client-side image preparation: downscale and re-encode so uploads stay small and cloud-friendly. */

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler esta imagem.')); };
    image.src = url;
  });
}

interface Options {
  maxWidth: number;
  maxHeight: number;
  /** png keeps transparency (logos), jpeg is smaller (photos). */
  format: 'png' | 'jpeg';
  maxChars: number;
}

export async function prepareImage(file: File, options: Options): Promise<PreparedImage> {
  if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) throw new Error('Envie uma imagem PNG, JPG, WebP ou SVG.');
  if (file.size > 12 * 1024 * 1024) throw new Error('A imagem é muito grande (máximo 12 MB).');
  const image = await loadImage(file);
  const naturalWidth = image.naturalWidth || 600;
  const naturalHeight = image.naturalHeight || 300;

  let scale = Math.min(1, options.maxWidth / naturalWidth, options.maxHeight / naturalHeight);
  let quality = 0.84;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não conseguiu processar a imagem.');
    if (options.format === 'jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); }
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = options.format === 'png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= options.maxChars) return { dataUrl, width, height };
    scale *= 0.8;
    quality = Math.max(0.55, quality - 0.08);
  }
  throw new Error('Não foi possível reduzir a imagem o suficiente. Tente uma menor.');
}

export const prepareLogo = (file: File) => prepareImage(file, { maxWidth: 480, maxHeight: 200, format: 'png', maxChars: 240_000 });
export const preparePhoto = (file: File) => prepareImage(file, { maxWidth: 1600, maxHeight: 1200, format: 'jpeg', maxChars: 420_000 });
