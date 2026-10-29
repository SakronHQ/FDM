# FDM (Free Download Manager) — Architecture Document

## Overview
FDM is a modern, high-performance Windows download manager designed to deliver an Internet Download Manager (IDM)-class experience with multi-connection segmented downloads, browser integration, video stream sniffing, queue scheduling, and media post-processing.

```
+-------------------------------------------------------------------------+
|                              FDM Desktop                                |
|                                                                         |
|  +---------------------------+       +-------------------------------+  |
|  |     React + Vite UI       | <---> | Electron Preload (Isolated)   |  |
|  |  (Tailwind, Queue, Stats) |  IPC  | contextBridge API             |  |
|  +---------------------------+       +---------------+---------------+  |
|                                                      |                  |
|  +---------------------------------------------------+---------------+  |
|  | Electron Main Process                                             |  |
|  |   - Download Supervisor & Queue Scheduler                         |  |
|  |   - Local Native Messaging Host / WebSocket Bridge                |  |
|  |   - System Tray & Notifications                                   |  |
|  |   - SQLite Database Store (Persistence)                           |  |
|  +---------+-------------------------+--------------------+----------+  |
+------------|-------------------------|--------------------|-------------+
             |                         |                    |
             v                         v                    v
     +---------------+         +---------------+    +---------------+
     | aria2c Daemon |         | yt-dlp Engine |    | FFmpeg Engine |
     | (JSON-RPC)    |         | (Video Sniff) |    | (Muxer/Merge) |
     +---------------+         +---------------+    +---------------+
             ^                         ^
             |                         |
+------------+-------------------------+----------------------------------+
|               Browser Integration (Chrome / Edge MV3)                    |
|  - Content Script Sniffer (<video>, <audio>, download links)            |
|  - Context Menu "Download with FDM"                                     |
|  - WebRequest / DeclarativeNetRequest Interception                      |
+-------------------------------------------------------------------------+
```

## Subsystems

### 1. Core Download Engine (`packages/download-engine`)
- **Process Management**: Spawns `resources/aria2/aria2c.exe` in RPC daemon mode (`--enable-rpc --rpc-listen-all=false --rpc-listen-port=6800 --rpc-secret=<TOKEN>`).
- **Connection Presets**:
  - *Balanced*: 4 connections per server (`split: 4`, `max-connection-per-server: 4`).
  - *High Speed*: 8 connections per server (`split: 8`, `max-connection-per-server: 8`).
  - *Maximum*: 16 connections per server (`split: 16`, `max-connection-per-server: 16`).
- **HTTP Range Detection**: Performs `HEAD` or small `Range: bytes=0-0` query to verify `Accept-Ranges: bytes` support before allocating multi-chunk transfers.
- **RPC Client**: Communicates via HTTP/JSON-RPC (or WebSocket) over loopback with token authorization.
- **Speed Limits**: Global bandwidth throttling and per-download download/upload caps via `aria2.changeGlobalOption` and `aria2.changeOption`.

### 2. Media Extraction Subsystem (`packages/media-engine`)
- **Metadata Extraction**: Runs `resources/yt-dlp/yt-dlp.exe -J <URL>` to retrieve title, thumbnail, duration, and format matrix (video codecs, resolutions, audio tracks).
- **Stream Merging**: When separate video and audio streams are selected, invokes `resources/ffmpeg/ffmpeg.exe -i video.mp4 -i audio.m4a -c copy output.mp4` with stream copying (zero loss, maximum speed, no re-encoding).

### 3. Database & State Store (`packages/database`)
- **Engine**: SQLite store (`fdm.db`).
- **Tables**:
  - `downloads`: `id`, `gid`, `url`, `filename`, `destination`, `total_length`, `completed_length`, `speed`, `status`, `category`, `connections`, `created_at`, `updated_at`.
  - `queues`: `id`, `name`, `max_active_downloads`, `created_at`.
  - `settings`: key-value store for bandwidth limits, default directory, presets, tray preferences.

### 4. Desktop Application (`apps/desktop`)
- **Electron Main**: Secure application bootstrap, window creation, lifecycle management, system tray, IPC handlers.
- **Preload**: Strictly isolated `contextBridge.exposeInMainWorld('fdm', ...)` preventing direct shell/node access from renderer.
- **Renderer**: React 18, Vite, Tailwind CSS, Lucide icons.
  - Categories: All, Downloading, Completed, Paused, Failed, Video, Audio, Documents, Archives, Programs.
  - Controls: Add Download modal, Start, Pause, Resume, Stop, Delete (with optional file removal), Open File, Open Directory, Speed presets switcher, Settings panel.

### 5. Browser Extension (`apps/browser-extension`)
- Chrome & Edge Manifest V3 extension.
- Communicates with FDM desktop app via Native Messaging / loopback bridge.
- Provides context menu "Download with FDM", intercepts download events, and displays an on-screen video download bar when video playback is detected on web pages.

