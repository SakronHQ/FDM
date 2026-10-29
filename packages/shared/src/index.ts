export type DownloadStatus = 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed';

export type DownloadCategory = 'all' | 'video' | 'audio' | 'document' | 'archive' | 'program' | 'other';

export type ConnectionPreset = 'balanced' | 'high_speed' | 'max_connections';

export interface DownloadItem {
  id: string;
  gid: string;
  url: string;
  filename: string;
  destination: string;
  totalLength: number;
  completedLength: number;
  downloadSpeed: number;
  uploadSpeed: number;
  status: DownloadStatus;
  category: DownloadCategory;
  connections: number;
  eta: number; // in seconds
  errorMessage?: string;
  isMediaMuxing?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DownloadOptions {
  url: string;
  filename?: string;
  destination?: string;
  preset?: ConnectionPreset;
  connections?: number;
  headers?: Record<string, string>;
  cookies?: string;
  category?: DownloadCategory;
  autoStart?: boolean;
}

export interface VideoFormat {
  formatId: string;
  formatNote?: string;
  resolution?: string;
  ext: string;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface VideoMetadata {
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  formats: VideoFormat[];
}

export interface FdmSettings {
  defaultDownloadDir: string;
  connectionPreset: ConnectionPreset;
  maxConcurrentDownloads: number;
  globalDownloadLimit: number; // 0 = unlimited
  globalUploadLimit: number;   // 0 = unlimited
  startWithWindows: boolean;
  minimizeToTray: boolean;
  theme: 'dark' | 'light' | 'system';
  rpcPort: number;
  rpcSecret: string;
}

export const PRESET_CONNECTIONS: Record<ConnectionPreset, number> = {
  balanced: 4,
  high_speed: 8,
  max_connections: 16
};

const CATEGORY_EXTENSIONS: Record<Exclude<DownloadCategory, 'all' | 'other'>, string[]> = {
  video: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv', 'ts', 'm4v', '3gp'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'alac'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'csv', 'epub'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'tgz'],
  program: ['exe', 'msi', 'bat', 'cmd', 'ps1', 'appx', 'msix', 'apk']
};

export function detectCategory(filenameOrUrl: string): DownloadCategory {
  try {
    const clean = filenameOrUrl.split('?')[0].split('#')[0];
    const ext = clean.substring(clean.lastIndexOf('.') + 1).toLowerCase();
    if (!ext || ext === clean) return 'other';

    for (const [category, extList] of Object.entries(CATEGORY_EXTENSIONS)) {
      if (extList.includes(ext)) {
        return category as DownloadCategory;
      }
    }
  } catch {
    // fallback
  }
  return 'other';
}

export function sanitizeFilename(name: string): string {
  // Strip Windows invalid characters: < > : " / \ | ? *
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'download';
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'ftp:';
  } catch {
    return false;
  }
}

export function isVideoSite(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const videoHosts = [
      'youtube.com',
      'youtu.be',
      'vimeo.com',
      'dailymotion.com',
      'tiktok.com',
      'facebook.com',
      'fb.watch',
      'instagram.com',
      'twitter.com',
      'x.com',
      'twitch.tv',
      'bilibili.com',
      'reddit.com',
      'rumble.com'
    ];
    return videoHosts.some(vh => host === vh || host.endsWith('.' + vh));
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const remainingSecs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${remainingSecs}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

