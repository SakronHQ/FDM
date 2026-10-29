import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import {
  DownloadItem,
  DownloadOptions,
  DownloadStatus,
  ConnectionPreset,
  PRESET_CONNECTIONS,
  detectCategory,
  sanitizeFilename,
  FdmSettings
} from '@fdm/shared';
import { FdmDatabase } from '@fdm/database';
import { Aria2Process } from './Aria2Process.js';
import { Aria2Client, Aria2Status } from './Aria2Client.js';
import { HttpRangeDetector } from './HttpRangeDetector.js';

export interface SupervisorEvents {
  'download-added': (item: DownloadItem) => void;
  'download-updated': (item: DownloadItem) => void;
  'download-completed': (item: DownloadItem) => void;
  'download-error': (item: DownloadItem, error: string) => void;
  'stats-updated': (stats: { activeCount: number; totalSpeed: number }) => void;
}

export class DownloadSupervisor extends EventEmitter {
  private db: FdmDatabase;
  private process: Aria2Process;
  private client: Aria2Client;
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private settings: FdmSettings;

  constructor(customDbPath?: string, aria2Port?: number) {
    super();
    this.db = new FdmDatabase(customDbPath);
    this.settings = this.db.getSettings();
    const port = aria2Port || this.settings.rpcPort || 6800;
    const secret = this.settings.rpcSecret || 'fdm-secret-token';

    this.process = new Aria2Process({ port, secret });
    this.client = new Aria2Client(port, secret);
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    // Start aria2 daemon
    await this.process.start();
    this.isRunning = true;

    // Apply global limits from settings
    if (this.settings.globalDownloadLimit > 0 || this.settings.globalUploadLimit > 0) {
      await this.setGlobalSpeedLimits(this.settings.globalDownloadLimit, this.settings.globalUploadLimit);
    }

    // Start periodic status sync
    this.startPolling(500);

    // Restore any previously active downloads that were interrupted
    await this.restoreInterruptedDownloads();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    await this.process.stop();
  }

  private startPolling(intervalMs: number): void {
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.pollStatus();
      } catch (e) {
        // console.error('[Supervisor] Poll error:', e);
      }
    }, intervalMs);
  }

  private async pollStatus(): Promise<void> {
    const activeList = await this.client.tellActive();
    let totalSpeed = 0;

    for (const active of activeList) {
      const gid = active.gid;
      const downloadSpeed = parseInt(active.downloadSpeed, 10) || 0;
      const uploadSpeed = parseInt(active.uploadSpeed, 10) || 0;
      const completedLength = parseInt(active.completedLength, 10) || 0;
      const totalLength = parseInt(active.totalLength, 10) || 0;
      totalSpeed += downloadSpeed;

      let eta = 0;
      if (downloadSpeed > 0 && totalLength > completedLength) {
        eta = Math.round((totalLength - completedLength) / downloadSpeed);
      }

      this.db.updateDownloadProgress(gid, completedLength, totalLength, downloadSpeed, eta);

      const item = this.db.getDownloadByGid(gid);
      if (item) {
        item.downloadSpeed = downloadSpeed;
        item.uploadSpeed = uploadSpeed;
        item.completedLength = completedLength;
        item.totalLength = totalLength;
        item.eta = eta;
        this.emit('download-updated', item);
      }
    }

    // Check stopped / completed / error downloads
    const stoppedList = await this.client.tellStopped(0, 50);
    for (const stopped of stoppedList) {
      const gid = stopped.gid;
      const item = this.db.getDownloadByGid(gid);
      if (!item) continue;

      if (stopped.status === 'complete' && item.status !== 'complete') {
        const completedLength = parseInt(stopped.totalLength, 10) || item.totalLength;
        this.db.saveDownload({
          ...item,
          status: 'complete',
          completedLength,
          totalLength: completedLength,
          downloadSpeed: 0,
          eta: 0,
          updatedAt: Date.now()
        });
        const updated = this.db.getDownload(item.id)!;
        this.emit('download-completed', updated);
        this.emit('download-updated', updated);
      } else if (stopped.status === 'error' && item.status !== 'error') {
        const errorMsg = stopped.errorMessage || `Download error code: ${stopped.errorCode || 'unknown'}`;
        this.db.updateStatus(item.id, 'error', errorMsg);
        const updated = this.db.getDownload(item.id)!;
        this.emit('download-error', updated, errorMsg);
        this.emit('download-updated', updated);
      }
    }

    this.emit('stats-updated', { activeCount: activeList.length, totalSpeed });
  }

  public async addDownload(options: DownloadOptions): Promise<DownloadItem> {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const destination = options.destination || this.settings.defaultDownloadDir;
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    // Pre-probe URL to check Range support & filename
    const probe = await HttpRangeDetector.probeUrl(options.url, options.headers);
    let filename = options.filename;
    if (!filename) {
      filename = probe.suggestedFilename || `download_${Date.now()}`;
    }
    filename = sanitizeFilename(filename);

    // Determine connection count based on range support & preset
    const preset = options.preset || this.settings.connectionPreset || 'high_speed';
    let connections = options.connections || PRESET_CONNECTIONS[preset];

    // If server does not support HTTP Range, fall back to 1 connection
    if (!probe.supportsRange) {
      connections = 1;
    }

    const aria2Options: Record<string, string> = {
      dir: destination,
      out: filename,
      split: String(connections),
      'max-connection-per-server': String(connections),
      'min-split-size': '1M'
    };

    if (options.headers) {
      const headerList = Object.entries(options.headers).map(([k, v]) => `${k}: ${v}`);
      if (headerList.length > 0) {
        (aria2Options as any).header = headerList;
      }
    }

    if (options.cookies) {
      aria2Options['header'] = `Cookie: ${options.cookies}`;
    }

    if (options.autoStart === false) {
      aria2Options['pause'] = 'true';
    }

    const gid = await this.client.addUri([options.url], aria2Options);
    const category = options.category || detectCategory(filename);

    const item: DownloadItem = {
      id,
      gid,
      url: options.url,
      filename,
      destination,
      totalLength: probe.contentLength || 0,
      completedLength: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      status: options.autoStart === false ? 'paused' : 'active',
      category,
      connections,
      eta: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.db.saveDownload(item);
    this.emit('download-added', item);
    return item;
  }

  public async pauseDownload(id: string): Promise<void> {
    const item = this.db.getDownload(id);
    if (!item) throw new Error(`Download ${id} not found`);

    if (item.gid) {
      try {
        await this.client.pause(item.gid);
      } catch {
        try {
          await this.client.forcePause(item.gid);
        } catch {
          // Ignore if already paused
        }
      }
    }

    this.db.updateStatus(id, 'paused');
    const updated = this.db.getDownload(id)!;
    this.emit('download-updated', updated);
  }

  public async resumeDownload(id: string): Promise<void> {
    const item = this.db.getDownload(id);
    if (!item) throw new Error(`Download ${id} not found`);

    try {
      if (item.gid) {
        await this.client.unpause(item.gid);
      } else {
        throw new Error('No GID');
      }
    } catch {
      // If GID is stopped or expired in aria2, re-add to resume from existing file!
      const aria2Options: Record<string, string> = {
        dir: item.destination,
        out: item.filename,
        split: String(item.connections || 4),
        'max-connection-per-server': String(item.connections || 4),
        'continue': 'true'
      };
      const newGid = await this.client.addUri([item.url], aria2Options);
      item.gid = newGid;
    }

    this.db.saveDownload({
      ...item,
      status: 'active',
      updatedAt: Date.now()
    });

    const updated = this.db.getDownload(id)!;
    this.emit('download-updated', updated);
  }

  public async cancelDownload(id: string, deleteFiles: boolean = false): Promise<void> {
    const item = this.db.getDownload(id);
    if (!item) return;

    if (item.gid) {
      try {
        await this.client.remove(item.gid);
      } catch {
        try {
          await this.client.forceRemove(item.gid);
        } catch {
          // Ignore
        }
      }
    }

    if (deleteFiles) {
      const filePath = path.join(item.destination, item.filename);
      const aria2ControlFile = filePath + '.aria2';
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(aria2ControlFile)) fs.unlinkSync(aria2ControlFile);
      } catch (e) {
        console.warn(`Failed to delete files for ${item.filename}:`, e);
      }
    }

    this.db.deleteDownload(id);
    this.emit('download-updated', { ...item, status: 'removed' });
  }

  public async retryDownload(id: string): Promise<void> {
    const item = this.db.getDownload(id);
    if (!item) return;

    const aria2Options: Record<string, string> = {
      dir: item.destination,
      out: item.filename,
      split: String(item.connections || 4),
      'max-connection-per-server': String(item.connections || 4),
      'continue': 'true'
    };

    const newGid = await this.client.addUri([item.url], aria2Options);
    this.db.saveDownload({
      ...item,
      gid: newGid,
      status: 'active',
      errorMessage: undefined,
      updatedAt: Date.now()
    });

    const updated = this.db.getDownload(id)!;
    this.emit('download-updated', updated);
  }

  public async setGlobalSpeedLimits(downloadLimitBytes: number, uploadLimitBytes: number): Promise<void> {
    await this.client.changeGlobalOption({
      'max-overall-download-limit': String(downloadLimitBytes || 0),
      'max-overall-upload-limit': String(uploadLimitBytes || 0)
    });
    this.db.saveSettings({
      globalDownloadLimit: downloadLimitBytes,
      globalUploadLimit: uploadLimitBytes
    });
  }

  public getDownloads(): DownloadItem[] {
    return this.db.getAllDownloads();
  }

  public getDownload(id: string): DownloadItem | null {
    return this.db.getDownload(id);
  }

  public getSettings(): FdmSettings {
    return this.db.getSettings();
  }

  public saveSettings(settings: Partial<FdmSettings>): void {
    this.db.saveSettings(settings);
    this.settings = this.db.getSettings();
  }

  private async restoreInterruptedDownloads(): Promise<void> {
    const all = this.db.getAllDownloads();
    for (const dl of all) {
      if (dl.status === 'active') {
        // Mark as paused on restart so user can resume cleanly
        this.db.updateStatus(dl.id, 'paused');
      }
    }
  }

  public getAria2Client(): Aria2Client {
    return this.client;
  }

  public getDatabase(): FdmDatabase {
    return this.db;
  }
}

