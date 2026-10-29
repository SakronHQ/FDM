import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DownloadItem, DownloadStatus, FdmSettings } from '@fdm/shared';

interface DatabaseSchema {
  downloads: Record<string, DownloadItem>;
  settings: Record<string, string>;
  schedules: Record<string, any>;
}

export class FdmDatabase {
  private filePath: string;
  private data: DatabaseSchema;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath.endsWith('.json') ? customPath : `${customPath}.json`;
    } else {
      const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
      const dir = path.join(appData, 'fdm-app');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.filePath = path.join(dir, 'fdm_store.json');
    }

    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          downloads: parsed.downloads || {},
          settings: parsed.settings || {},
          schedules: parsed.schedules || {}
        };
      }
    } catch (e) {
      console.warn(`[FdmDatabase] Warning loading store from ${this.filePath}:`, e);
    }

    return {
      downloads: {},
      settings: {},
      schedules: {}
    };
  }

  private persist(): void {
    try {
      const tempPath = `${this.filePath}.tmp`;
      const serialized = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tempPath, serialized, 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (e) {
      console.error(`[FdmDatabase] Failed to persist data to ${this.filePath}:`, e);
    }
  }

  public getAllDownloads(): DownloadItem[] {
    return Object.values(this.data.downloads).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getDownload(id: string): DownloadItem | null {
    return this.data.downloads[id] || null;
  }

  public getDownloadByGid(gid: string): DownloadItem | null {
    if (!gid) return null;
    return Object.values(this.data.downloads).find(d => d.gid === gid) || null;
  }

  public saveDownload(item: DownloadItem): void {
    this.data.downloads[item.id] = {
      ...item,
      updatedAt: Date.now()
    };
    this.persist();
  }

  public updateDownloadProgress(gid: string, completedLength: number, totalLength: number, downloadSpeed: number, eta: number): void {
    const item = this.getDownloadByGid(gid);
    if (!item) return;

    item.completedLength = completedLength;
    if (totalLength > 0) item.totalLength = totalLength;
    item.downloadSpeed = downloadSpeed;
    item.eta = eta;
    item.updatedAt = Date.now();
    // In-memory update, throttled/persisted on status change or final
  }

  public updateStatus(id: string, status: DownloadStatus, errorMessage?: string): void {
    const item = this.data.downloads[id];
    if (!item) return;

    item.status = status;
    if (errorMessage !== undefined) item.errorMessage = errorMessage;
    item.updatedAt = Date.now();
    this.persist();
  }

  public deleteDownload(id: string): void {
    delete this.data.downloads[id];
    this.persist();
  }

  public getSetting(key: string, defaultValue: string = ''): string {
    return this.data.settings[key] ?? defaultValue;
  }

  public setSetting(key: string, value: string): void {
    this.data.settings[key] = value;
    this.persist();
  }

  public getSettings(): FdmSettings {
    const defaultDir = path.join(os.homedir(), 'Downloads');
    return {
      defaultDownloadDir: this.getSetting('defaultDownloadDir', defaultDir),
      connectionPreset: (this.getSetting('connectionPreset', 'high_speed') as any),
      maxConcurrentDownloads: parseInt(this.getSetting('maxConcurrentDownloads', '3'), 10),
      globalDownloadLimit: parseInt(this.getSetting('globalDownloadLimit', '0'), 10),
      globalUploadLimit: parseInt(this.getSetting('globalUploadLimit', '0'), 10),
      startWithWindows: this.getSetting('startWithWindows', 'false') === 'true',
      minimizeToTray: this.getSetting('minimizeToTray', 'true') === 'true',
      theme: (this.getSetting('theme', 'dark') as any),
      rpcPort: parseInt(this.getSetting('rpcPort', '6800'), 10),
      rpcSecret: this.getSetting('rpcSecret', 'fdm-secret-token')
    };
  }

  public saveSettings(settings: Partial<FdmSettings>): void {
    for (const [key, val] of Object.entries(settings)) {
      if (val !== undefined) {
        this.data.settings[key] = String(val);
      }
    }
    this.persist();
  }

  public close(): void {
    this.persist();
  }
}
