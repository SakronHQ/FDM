import { contextBridge, ipcRenderer } from 'electron';
import { DownloadItem, DownloadOptions, FdmSettings, VideoMetadata } from '@fdm/shared';

export interface FdmApi {
  // Downloads
  getDownloads: () => Promise<DownloadItem[]>;
  addDownload: (options: DownloadOptions) => Promise<DownloadItem>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string, deleteFiles?: boolean) => Promise<void>;
  retryDownload: (id: string) => Promise<void>;
  openFile: (id: string) => Promise<{ success: boolean; error?: string }>;
  openFolder: (id: string) => Promise<{ success: boolean; error?: string }>;
  selectFolder: () => Promise<string | null>;

  // Video Extraction
  getVideoInfo: (url: string) => Promise<VideoMetadata>;
  downloadVideo: (url: string, formatId: string, customTitle?: string) => Promise<DownloadItem>;

  // Settings
  getSettings: () => Promise<FdmSettings>;
  saveSettings: (settings: Partial<FdmSettings>) => Promise<void>;

  // Window Controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;

  // Real-time Event Subscriptions
  onDownloadAdded: (callback: (item: DownloadItem) => void) => () => void;
  onDownloadUpdated: (callback: (item: DownloadItem) => void) => () => void;
  onDownloadCompleted: (callback: (item: DownloadItem) => void) => () => void;
  onStatsUpdated: (callback: (stats: { activeCount: number; totalSpeed: number }) => void) => () => void;
}

const api: FdmApi = {
  getDownloads: () => ipcRenderer.invoke('fdm:get-downloads'),
  addDownload: (options) => ipcRenderer.invoke('fdm:add-download', options),
  pauseDownload: (id) => ipcRenderer.invoke('fdm:pause-download', id),
  resumeDownload: (id) => ipcRenderer.invoke('fdm:resume-download', id),
  cancelDownload: (id, deleteFiles) => ipcRenderer.invoke('fdm:cancel-download', id, deleteFiles),
  retryDownload: (id) => ipcRenderer.invoke('fdm:retry-download', id),
  openFile: (id) => ipcRenderer.invoke('fdm:open-file', id),
  openFolder: (id) => ipcRenderer.invoke('fdm:open-folder', id),
  selectFolder: () => ipcRenderer.invoke('fdm:select-folder'),

  getVideoInfo: (url) => ipcRenderer.invoke('fdm:get-video-info', url),
  downloadVideo: (url, formatId, customTitle) => ipcRenderer.invoke('fdm:download-video', url, formatId, customTitle),

  getSettings: () => ipcRenderer.invoke('fdm:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('fdm:save-settings', settings),

  minimizeWindow: () => ipcRenderer.send('fdm:window-minimize'),
  maximizeWindow: () => ipcRenderer.send('fdm:window-maximize'),
  closeWindow: () => ipcRenderer.send('fdm:window-close'),

  onDownloadAdded: (cb) => {
    const handler = (_: any, item: DownloadItem) => cb(item);
    ipcRenderer.on('fdm:download-added', handler);
    return () => ipcRenderer.removeListener('fdm:download-added', handler);
  },
  onDownloadUpdated: (cb) => {
    const handler = (_: any, item: DownloadItem) => cb(item);
    ipcRenderer.on('fdm:download-updated', handler);
    return () => ipcRenderer.removeListener('fdm:download-updated', handler);
  },
  onDownloadCompleted: (cb) => {
    const handler = (_: any, item: DownloadItem) => cb(item);
    ipcRenderer.on('fdm:download-completed', handler);
    return () => ipcRenderer.removeListener('fdm:download-completed', handler);
  },
  onStatsUpdated: (cb) => {
    const handler = (_: any, stats: any) => cb(stats);
    ipcRenderer.on('fdm:stats-updated', handler);
    return () => ipcRenderer.removeListener('fdm:stats-updated', handler);
  }
};

contextBridge.exposeInMainWorld('fdm', api);
