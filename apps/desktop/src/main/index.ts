import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BrowserWindow as BrowserWindowType, Tray as TrayType } from 'electron';
import { DownloadSupervisor } from '@fdm/download-engine';
import { MediaManager } from '@fdm/media-engine';
import { BrowserBridgeServer } from '@fdm/browser-bridge';
import { DownloadItem, DownloadOptions, FdmSettings, sanitizeFilename, isVideoSite } from '@fdm/shared';

const require = createRequire(import.meta.url);
const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage, Notification } = require('electron');

process.on('uncaughtException', (err) => {
  console.error('[Main] UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Main] UNHANDLED REJECTION:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindowType | null = null;
let tray: TrayType | null = null;
let supervisor: DownloadSupervisor | null = null;
let mediaManager: MediaManager | null = null;
let bridgeServer: BrowserBridgeServer | null = null;
let isQuitting = false;

async function handleVideoDownload(url: string, formatId: string = 'bestvideo+bestaudio/best', customTitle?: string): Promise<DownloadItem> {
  if (!supervisor || !mediaManager) throw new Error('Engine not initialized');

  const settings = supervisor.getSettings();
  const destination = settings.defaultDownloadDir;

  let videoTitle = customTitle;
  const id = `vid_${Date.now()}`;
  let title = sanitizeFilename(videoTitle || `video_${Date.now()}`);
  let finalFilename = `${title}.mp4`;
  let finalPath = path.join(destination, finalFilename);

  const item: DownloadItem = {
    id,
    gid: id,
    url,
    filename: finalFilename,
    destination,
    totalLength: 100,
    completedLength: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    status: 'active',
    category: 'video',
    connections: 4,
    eta: 0,
    isMediaMuxing: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  supervisor.getDatabase().saveDownload(item);
  mainWindow?.webContents.send('fdm:download-added', item);

  // Background download execution
  (async () => {
    try {
      if (!customTitle) {
        try {
          const meta = await mediaManager.getVideoInfo(url);
          if (meta.title) {
            title = sanitizeFilename(meta.title);
            finalFilename = `${title}.mp4`;
            finalPath = path.join(destination, finalFilename);
            item.filename = finalFilename;
            supervisor?.getDatabase().saveDownload(item);
            mainWindow?.webContents.send('fdm:download-updated', item);
          }
        } catch {
          // ignore
        }
      }

      await mediaManager.downloadAndMux(url, formatId, finalPath, (percent, speed, eta) => {
        item.completedLength = Math.round(percent);
        item.totalLength = 100;
        const speedMatch = speed.match(/([\d\.]+)\s*([KMGT]?i?B)/i);
        if (speedMatch) {
          const val = parseFloat(speedMatch[1]);
          const unit = speedMatch[2].toUpperCase();
          let mult = 1024;
          if (unit.startsWith('M')) mult = 1024 * 1024;
          else if (unit.startsWith('G')) mult = 1024 * 1024 * 1024;
          item.downloadSpeed = Math.round(val * mult);
        }
        supervisor?.getDatabase().saveDownload(item);
        mainWindow?.webContents.send('fdm:download-updated', item);
      });

      item.status = 'complete';
      item.completedLength = 100;
      item.totalLength = 100;
      item.downloadSpeed = 0;
      supervisor?.getDatabase().saveDownload(item);
      mainWindow?.webContents.send('fdm:download-completed', item);
      mainWindow?.webContents.send('fdm:download-updated', item);

      if (Notification.isSupported()) {
        new Notification({
          title: 'FDM — Video Ready',
          body: `${item.filename} has finished downloading.`,
          silent: false
        }).show();
      }
    } catch (err: any) {
      item.status = 'error';
      item.errorMessage = err.message || 'Video download failed';
      item.downloadSpeed = 0;
      supervisor?.getDatabase().saveDownload(item);
      mainWindow?.webContents.send('fdm:download-updated', item);
    }
  })();

  return item;
}

async function initEngines(): Promise<void> {
  try {
    supervisor = new DownloadSupervisor();
    await supervisor.start();

    mediaManager = new MediaManager();

    bridgeServer = new BrowserBridgeServer({
      port: 6803,
      authToken: 'fdm-secret-token',
      supervisor,
      onVideoDownload: async (url, title) => {
        return handleVideoDownload(url, 'bestvideo+bestaudio/best', title);
      }
    });
    await bridgeServer.start();
  } catch (e) {
    console.error('[Main] initEngines error:', e);
    throw e;
  }

  // Forward supervisor events to renderer
  supervisor.on('download-added', (item: DownloadItem) => {
    mainWindow?.webContents.send('fdm:download-added', item);
  });

  supervisor.on('download-updated', (item: DownloadItem) => {
    mainWindow?.webContents.send('fdm:download-updated', item);
  });

  supervisor.on('download-completed', (item: DownloadItem) => {
    mainWindow?.webContents.send('fdm:download-completed', item);

    // Show native Windows notification
    if (Notification.isSupported()) {
      new Notification({
        title: 'FDM — Download Complete',
        body: `${item.filename} has finished downloading.`,
        silent: false
      }).show();
    }
  });

  supervisor.on('stats-updated', (stats) => {
    mainWindow?.webContents.send('fdm:stats-updated', stats);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 840,
    minHeight: 560,
    frame: false, // Custom sleek titlebar
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (e) => {
    const settings = supervisor?.getSettings();
    if (settings?.minimizeToTray && !isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  try {
    const iconPath = path.resolve(__dirname, '../../resources/icons/icon.png');
    if (!fs.existsSync(iconPath)) {
      return;
    }
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      return;
    }

    tray = new Tray(icon);
    tray.setToolTip('FDM — Free Download Manager');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open FDM',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      { type: 'separator' },
      {
        label: 'Pause All Downloads',
        click: () => {
          const active = supervisor?.getDownloads().filter(d => d.status === 'active') || [];
          for (const dl of active) supervisor?.pauseDownload(dl.id);
        }
      },
      {
        label: 'Resume All Downloads',
        click: () => {
          const paused = supervisor?.getDownloads().filter(d => d.status === 'paused') || [];
          for (const dl of paused) supervisor?.resumeDownload(dl.id);
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
  } catch (err) {
    console.warn('[Main] System tray could not be initialized:', err);
  }
}

function setupIpc(): void {
  // Downloads
  ipcMain.handle('fdm:get-downloads', async () => {
    return supervisor ? supervisor.getDownloads() : [];
  });

  ipcMain.handle('fdm:add-download', async (_, options: DownloadOptions) => {
    if (!supervisor) throw new Error('Supervisor not initialized');
    if (isVideoSite(options.url)) {
      return handleVideoDownload(options.url, 'bestvideo+bestaudio/best', options.filename);
    }
    return supervisor.addDownload(options);
  });

  ipcMain.handle('fdm:pause-download', async (_, id: string) => {
    if (!supervisor) return;
    return supervisor.pauseDownload(id);
  });

  ipcMain.handle('fdm:resume-download', async (_, id: string) => {
    if (!supervisor) return;
    return supervisor.resumeDownload(id);
  });

  ipcMain.handle('fdm:cancel-download', async (_, id: string, deleteFiles: boolean = false) => {
    if (!supervisor) return;
    return supervisor.cancelDownload(id, deleteFiles);
  });

  ipcMain.handle('fdm:retry-download', async (_, id: string) => {
    if (!supervisor) return;
    return supervisor.retryDownload(id);
  });

  ipcMain.handle('fdm:open-file', async (_, id: string) => {
    if (!supervisor) return { success: false };
    const item = supervisor.getDownload(id);
    if (!item) return { success: false, error: 'Item not found' };

    const filePath = path.join(item.destination, item.filename);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist on disk' };
    }
    const err = await shell.openPath(filePath);
    return { success: !err, error: err || undefined };
  });

  ipcMain.handle('fdm:open-folder', async (_, id: string) => {
    if (!supervisor) return { success: false };
    const item = supervisor.getDownload(id);
    if (!item) return { success: false, error: 'Item not found' };

    const filePath = path.join(item.destination, item.filename);
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    } else if (fs.existsSync(item.destination)) {
      await shell.openPath(item.destination);
      return { success: true };
    }
    return { success: false, error: 'Directory not found' };
  });

  ipcMain.handle('fdm:select-folder', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });
    return res.canceled ? null : res.filePaths[0];
  });

  // Video Extraction
  ipcMain.handle('fdm:get-video-info', async (_, url: string) => {
    if (!mediaManager) throw new Error('MediaManager not initialized');
    return mediaManager.getVideoInfo(url);
  });

  ipcMain.handle('fdm:download-video', async (_, url: string, formatId: string, customTitle?: string) => {
    return handleVideoDownload(url, formatId, customTitle);
  });

  // Settings
  ipcMain.handle('fdm:get-settings', async () => {
    return supervisor ? supervisor.getSettings() : null;
  });

  ipcMain.handle('fdm:save-settings', async (_, settings: Partial<FdmSettings>) => {
    if (!supervisor) return;
    supervisor.saveSettings(settings);

    if (settings.globalDownloadLimit !== undefined || settings.globalUploadLimit !== undefined) {
      await supervisor.setGlobalSpeedLimits(
        settings.globalDownloadLimit ?? 0,
        settings.globalUploadLimit ?? 0
      );
    }
  });

  // Window Controls
  ipcMain.on('fdm:window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('fdm:window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('fdm:window-close', () => {
    const settings = supervisor?.getSettings();
    if (settings?.minimizeToTray) {
      mainWindow?.hide();
    } else {
      isQuitting = true;
      app.quit();
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  console.log('[Main] Electron app is ready. Setting up IPC...');
  try {
    setupIpc();
    console.log('[Main] Initializing download & media engines...');
    await initEngines();
    console.log('[Main] Creating main window...');
    createWindow();
    console.log('[Main] Setting up system tray...');
    createTray();
    console.log('[Main] FDM started successfully!');
  } catch (err) {
    console.error('[Main] app.whenReady failed:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  console.error('[Main] Fatal whenReady error:', err);
});

app.on('before-quit', async () => {
  isQuitting = true;
  if (bridgeServer) await bridgeServer.stop();
  if (supervisor) await supervisor.stop();
});

app.on('window-all-closed', () => {
  const settings = supervisor?.getSettings();
  if (!settings?.minimizeToTray || process.platform !== 'win32') {
    app.quit();
  }
});
