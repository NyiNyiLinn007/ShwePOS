/**
 * Client-side HTML5 <canvas> image compression utility.
 * Resizes uploaded product photos or shop logos into compact Data URLs
 * suitable for storing directly in PostgreSQL without external S3/blob storage.
 */
export interface CompressImageOptions {
  maxSize?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
  maxChars?: number;
}

export function resizeImageToDataUrl(
  file: File,
  options: number | CompressImageOptions = 320
): Promise<string> {
  const resolved: Required<CompressImageOptions> =
    typeof options === 'number'
      ? { maxSize: options, mimeType: 'image/jpeg', quality: 0.82, maxChars: 450_000 }
      : {
          maxSize: options.maxSize ?? 320,
          mimeType: options.mimeType ?? 'image/jpeg',
          quality: options.quality ?? 0.82,
          maxChars: options.maxChars ?? 450_000,
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
        if (resolved.mimeType === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);

        let result = canvas.toDataURL(resolved.mimeType, resolved.quality);
        // Guard against oversized PNG/base64 payloads exceeding the 500K API cap
        if (result.length > resolved.maxChars) {
          const fallbackFormats: Array<{ mime: 'image/webp' | 'image/jpeg'; quality: number }> = [
            { mime: 'image/webp', quality: 0.88 },
            { mime: 'image/webp', quality: 0.76 },
            { mime: 'image/jpeg', quality: 0.85 },
            { mime: 'image/jpeg', quality: 0.72 },
          ];
          for (const attempt of fallbackFormats) {
            if (attempt.mime === 'image/jpeg') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
            }
            const candidate = canvas.toDataURL(attempt.mime, attempt.quality);
            if (candidate.length < result.length) {
              result = candidate;
            }
            if (result.length <= resolved.maxChars) break;
          }
        }
        resolve(result);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
