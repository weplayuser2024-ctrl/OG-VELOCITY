/**
 * Compresses large user-uploaded images (>= 3 MB up to 20 MB+) in the browser
 * into a sharp, compact WebP/JPEG/PNG data URL while preserving transparency when needed
 * and reporting progress stages cleanly.
 */
export interface CompressImageOptions {
  maxDim?: number;
  quality?: number;
  maxBytes?: number;
  onProgress?: (percent: number, stage: 'reading' | 'optimizing') => void;
}

function supportsWebpEncoding(): boolean {
  try {
    const test = document.createElement('canvas');
    test.width = 2;
    test.height = 2;
    return test.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

export function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const initialMaxDim = options.maxDim ?? 1080;
  const initialQuality = options.quality ?? 0.84;
  const maxBytes = options.maxBytes ?? 680_000;
  const onProgress = options.onProgress;

  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file (PNG, JPEG, WEBP, or GIF).'));
      return;
    }

    onProgress?.(10, 'reading');
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file. Please try another file.'));
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl) {
        reject(new Error('Selected image file was empty.'));
        return;
      }

      onProgress?.(35, 'optimizing');

      // Preserve animated GIFs or compact SVGs/PNG cutouts without altering animation frames
      if (
        (file.type === 'image/gif' && file.size <= 3_500_000) ||
        (file.type === 'image/svg+xml' && file.size <= 250_000) ||
        (file.type === 'image/png' && file.size <= 220_000)
      ) {
        onProgress?.(70, 'optimizing');
        resolve(rawUrl);
        return;
      }

      const img = new Image();
      img.onerror = () => {
        if (rawUrl.length <= 2_500_000) {
          resolve(rawUrl);
        } else {
          reject(new Error('Could not decode this image format. Please try PNG, JPEG, or WEBP.'));
        }
      };
      img.onload = () => {
        try {
          const w = img.naturalWidth || initialMaxDim;
          const h = img.naturalHeight || initialMaxDim;
          const canWebp = supportsWebpEncoding();
          // Preserve PNG transparency cleanly using WebP when supported
          const outputType =
            file.type === 'image/png' || file.type === 'image/webp'
              ? canWebp
                ? 'image/webp'
                : 'image/jpeg'
              : 'image/jpeg';

          let dim = initialMaxDim;
          let quality = initialQuality;
          let encoded = rawUrl;

          for (let attempt = 0; attempt < 5; attempt++) {
            const scale = Math.min(1, dim / Math.max(w, h));
            const targetW = Math.max(1, Math.round(w * scale));
            const targetH = Math.max(1, Math.round(h * scale));
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) break;
            if (outputType === 'image/jpeg') {
              ctx.fillStyle = '#0B1020';
              ctx.fillRect(0, 0, targetW, targetH);
            }
            ctx.drawImage(img, 0, 0, targetW, targetH);
            encoded = canvas.toDataURL(outputType, quality);
            if (encoded.length <= maxBytes) {
              break;
            }
            quality = Math.max(0.56, quality - 0.1);
            dim = Math.max(480, Math.round(dim * 0.82));
          }

          onProgress?.(70, 'optimizing');
          resolve(encoded);
        } catch {
          reject(new Error('Image optimization failed on this device.'));
        }
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}
