/**
 * Client-side HTML5 <canvas> image compression utility.
 * Resizes uploaded product photos or shop logos into compact Data URLs
 * suitable for storing directly in PostgreSQL without external S3/blob storage.
 */
export interface CompressImageOptions {
  maxSize?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
}

export function resizeImageToDataUrl(
  file: File,
  options: number | CompressImageOptions = 320
): Promise<string> {
  const resolved: Required<CompressImageOptions> =
    typeof options === 'number'
      ? { maxSize: options, mimeType: 'image/jpeg', quality: 0.82 }
      : {
          maxSize: options.maxSize ?? 320,
          mimeType: options.mimeType ?? 'image/jpeg',
          quality: options.quality ?? 0.82,
        };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = Math.min(1, resolved.maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(resolved.mimeType, resolved.quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
