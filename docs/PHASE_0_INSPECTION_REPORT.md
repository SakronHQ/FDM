# Phase 0 — Workspace & Reference Software Inspection Report

## Executive Summary
This report documents the initial inspection of the workspace, development environment, installed reverse engineering capabilities (REA), and the reference software (Internet Download Manager - IDM v6.43.8.2).

## 1. Workspace State
- Location: `D:\Project\FDM`
- Existing files: `IDMan.exe` (Version 6.43.8.2, 6,196,592 bytes)
- Node.js version: `v24.12.0`
- npm version: `11.6.2`
- OS: Windows 11 x64

## 2. Reference Software Inspection
- Reference Installation: `C:\Program Files (x86)\Internet Download Manager`
- Target Architecture:
  - Download Manager GUI: Win32 native application (`IDMan.exe`).
  - Browser Integration:
    - Chrome & Chromium extensions use Manifest V3.
    - Inter-process communication uses standard Windows Native Messaging Host (`IDMMsgHost.exe`), registered under registry key `Software\Google\Chrome\NativeMessagingHosts\com.tonec.idm`.
    - Local fallback communication via WebSocket server.
    - Interception logic injects into page contexts at `document_start` to sniff media tags (`<video>`, `<audio>`), network fetch/XHR, and context menu triggers.
    - Default exclusion lists (`defexclist.txt`) filter out internal chunk streams, background sound alerts (e.g. WhatsApp web alerts, Bing sound clips), and ad tracking to avoid accidental interception.
  - Video and Media Handling:
    - Media stream analysis and conversion (`idmvconv.dll`, `IDMVMPrs.dll`).
  - Concurrency & Multi-segmenting:
    - HTTP Range requests (`Range: bytes=X-Y`) split files into configurable parallel segments (typically 4, 8, 16, or 32 connections).
    - Dynamic temporary file segment storage with final stitching.

## 3. Reverse Engineering Findings (REA)
- In accordance with safety rules, cleanroom analysis was performed strictly examining publicly accessible metadata, manifest structures, and communication contracts.
- Extension Manifest: Chrome MV3 with service worker `background.js`, declarativeNetRequest, scripting, and nativeMessaging.
- Communication model: JSON/structured messages over stdio native messaging host or local WebSocket.

## 4. Installed Engine Binaries
The following engines were verified and deployed into local project resources (`D:\Project\FDM\resources\`):
1. **aria2c**: Version 1.37.0 (`resources/aria2/aria2c.exe`) - High-speed multi-connection segmented HTTP/HTTPS/FTP engine with localhost JSON-RPC API.
2. **yt-dlp**: Version 2026.10.26 (`resources/yt-dlp/yt-dlp.exe`) - Comprehensive media stream extractor supporting format selection, video/audio stream separation, HLS, and DASH.
3. **ffmpeg**: Version 9.0.1 (`resources/ffmpeg/ffmpeg.exe`) - High-performance audio/video remuxer, stream merger, and container processor.

## 5. Technology Stack Decisions
- **Desktop Framework**: Electron + TypeScript
- **Renderer Frontend**: React + Vite + Tailwind CSS + Lucide Icons
- **Database**: SQLite (Node native `node:sqlite` / high-speed persistent store)
- **Engine Control**: aria2 JSON-RPC over loopback with token authentication
- **Browser Extension**: Manifest V3 extension with Native Messaging host bridge

