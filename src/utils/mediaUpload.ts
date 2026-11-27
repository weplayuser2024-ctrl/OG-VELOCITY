import { compressImageFile } from './imageCompress';

export interface UploadMediaOptions {
  authToken?: string | null;
  maxDim?: number;
  quality?: number;
  maxCompressedBytes?: number;
  maxRawBytes?: number;
  onProgress?: (percent: number, stage: 'reading' | 'optimizing' | 'uploading' | 'done') => void;
}

const DEFAULT_MAX_RAW_IMAGE_BYTES = 20 * 1024 * 1024; // Accept >= 3 MB (up to 20 MB source photo)
const DEFAULT_MAX_VIDEO_BYTES = 5 * 1024 * 1024; // 5 MB max video clip

export async function uploadImageAsset(
  file: File,
  options: UploadMediaOptions = {}
): Promise<string> {
  if (!file) throw new Error('No image selected.');
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid PNG, JPEG, WEBP, or GIF image.');
  }
  const maxRaw = options.maxRawBytes ?? DEFAULT_MAX_RAW_IMAGE_BYTES;
  if (file.size > maxRaw) {
    const maxMb = Math.round(maxRaw / (1024 * 1024));
    throw new Error(`Image is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max allowed is ${maxMb} MB.`);
  }

  const compressedDataUrl = await compressImageFile(file, {
    maxDim: options.maxDim ?? 1280,
    quality: options.quality ?? 0.84,
    maxBytes: options.maxCompressedBytes ?? 720_000,
    onProgress: (pct, stage) => options.onProgress?.(pct, stage),
  });

  options.onProgress?.(82, 'uploading');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  let resp: Response;
  try {
    resp = await fetch('/api/media/upload', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ dataUrl: compressedDataUrl }),
    });
  } catch {
    throw new Error('Network error while uploading image. Tap retry to upload again.');
  }

  if (resp.status === 401 && !options.authToken) {
    // Fallback only if no active session cookie/token exists
    options.onProgress?.(100, 'done');
    return compressedDataUrl;
  }

  const data = (await resp.json().catch(() => ({}))) as {
    ok?: boolean;
    url?: string;
    error?: string;
  };
  if (!resp.ok || !data.ok || !data.url) {
    throw new Error(data.error || `Upload failed (HTTP ${resp.status}). Tap retry.`);
  }

  options.onProgress?.(100, 'done');
  return data.url;
}

export async function uploadVideoAsset(
  file: File,
  options: {
    authToken?: string | null;
    maxBytes?: number;
    onProgress?: (percent: number, stage: 'reading' | 'uploading' | 'done') => void;
  } = {}
): Promise<string> {
  if (!file) throw new Error('No video selected.');
  if (!/^video\/(mp4|webm|quicktime)$/i.test(file.type)) {
    throw new Error('Please upload an MP4 or WEBM video clip.');
  }
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_VIDEO_BYTES;
  if (file.size > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
    throw new Error(`Video exceeds ${maxMb} MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB selected).`);
  }

  options.onProgress?.(20, 'reading');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read video file.'));
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:video/')) {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid video encoding.'));
      }
    };
    reader.readAsDataURL(file);
  });

  options.onProgress?.(70, 'uploading');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  let resp: Response;
  try {
    resp = await fetch('/api/media/upload', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ dataUrl }),
    });
  } catch {
    throw new Error('Network error while uploading video. Please retry.');
  }

  const data = (await resp.json().catch(() => ({}))) as {
    ok?: boolean;
    url?: string;
    error?: string;
  };
  if (!resp.ok || !data.ok || !data.url) {
    throw new Error(data.error || `Video upload failed (HTTP ${resp.status}).`);
  }

  options.onProgress?.(100, 'done');
  return data.url;
}
