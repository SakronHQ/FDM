# FDM — Free Download Manager for Windows

A high-performance, modern, IDM-class download manager for Windows 11 / 10 x64. Built with React, TypeScript, Electron, aria2, yt-dlp, and FFmpeg.

---

## ⚡ Features

- **Segmented Multi-Connection Engine**: Powered by `aria2c` with dynamic connection presets:
  - *Balanced*: 4 connections per download.
  - *High Speed*: 8 connections per download.
  - *Maximum*: 16 connections per download.
- **Smart HTTP Range Detection**: Automatically probes target servers with `Range: bytes=0-0` before scheduling. Fallback to single connection if range requests are unsupported.
- **Video & Media Stream Grabber**: Powered by `yt-dlp` and `FFmpeg`. Paste any video URL (YouTube, Vimeo, Twitch, HLS, DASH), inspect formats/resolutions, and download with zero-loss stream muxing.
- **Chrome & Microsoft Edge Extension**: Manifest V3 extension providing:
  - Context menu integration: "Download with FDM".
  - Floating video download overlay on media players.
  - Browser download interception with loopback bridge (`127.0.0.1:6803`).
- **Persistent State & Resumability**: Embedded zero-latency SQLite store (`fdm.db`) tracking download history, speed, queues, and interrupted tasks.
- **Modern Windows Desktop UI**: Tailwind CSS dark-mode dashboard with real-time speed monitoring, category filtering, pause/resume/cancel controls, and system tray integration.

---

## 📂 Project Architecture

```
FDM/
├── apps/
│   ├── desktop/             # Electron Main + Preload + React Vite Renderer
│   └── browser-extension/   # Manifest V3 Extension for Chrome & Edge
├── packages/
│   ├── download-engine/     # aria2 JSON-RPC daemon supervisor & HTTP range detector
│   ├── media-engine/        # yt-dlp metadata extractor & FFmpeg stream muxer
│   ├── browser-bridge/      # Authenticated loopback bridge server & native messaging host
│   ├── database/            # SQLite persistent store (node:sqlite)
│   └── shared/              # Types, presets, formatters, and sanitizers
├── resources/               # Embedded self-contained binaries
│   ├── aria2/ (aria2c.exe)
│   ├── yt-dlp/ (yt-dlp.exe)
│   ├── ffmpeg/ (ffmpeg.exe)
│   └── icons/
├── tests/                   # Automated integration and e2e test suite
├── THIRD_PARTY_LICENSES.md
└── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Windows 10 / 11 (x64)**
- **Node.js**: v22+ or v24+
- `aria2c`, `yt-dlp`, and `ffmpeg` are already embedded in the `resources/` folder.

### 2. Install & Build
```bash
# Install dependencies across all packages
npm install

# Build all monorepo packages and desktop bundles
npm run build
```

### 3. Run Automated Tests
```bash
npm test
```
Runs 4 comprehensive test suites:
- `tests/download-engine.test.mjs` (Range detection, multi-connection segmenting, byte-for-byte integrity check)
- `tests/media-engine.test.mjs` (FFmpeg stream copying and yt-dlp binary verification)
- `tests/browser-bridge.test.mjs` (Loopback ping, token authentication, and download forwarding)
- `tests/e2e-workflow.test.mjs` (Range fallback, settings persistence, category classification)

### 4. Start Desktop Application
```bash
npm start
```

---

## 🌐 Installing the Browser Extension (Chrome / Edge)

1. Open your browser:
   - Chrome: Navigate to `chrome://extensions/`
   - Edge: Navigate to `edge://extensions/`
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked** and select the folder:
   `D:\Project\FDM\apps\browser-extension`
4. The extension will automatically connect to FDM's authenticated bridge on `127.0.0.1:6803`.

---

## 📜 Third-Party Licenses
For complete licensing details of aria2 (GPLv2), yt-dlp (The Unlicense), and FFmpeg (LGPL/GPL), see [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md).

