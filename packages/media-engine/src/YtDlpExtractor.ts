import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { VideoMetadata, VideoFormat, sanitizeFilename } from '@fdm/shared';

export class YtDlpExtractor {
  private binaryPath: string;
  private ffmpegPath: string;

  constructor(customBinaryPath?: string, customFfmpegPath?: string) {
    this.binaryPath = customBinaryPath || this.findDefaultBinary();
    this.ffmpegPath = customFfmpegPath || this.findDefaultFfmpeg();
  }

  private findDefaultBinary(): string {
    const candidates = [
      path.resolve(process.cwd(), 'resources/yt-dlp/yt-dlp.exe'),
      path.resolve(process.cwd(), '../../resources/yt-dlp/yt-dlp.exe'),
      path.resolve(process.cwd(), '../resources/yt-dlp/yt-dlp.exe')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'yt-dlp';
  }

  private findDefaultFfmpeg(): string {
    const candidates = [
      path.resolve(process.cwd(), 'resources/ffmpeg/ffmpeg.exe'),
      path.resolve(process.cwd(), '../../resources/ffmpeg/ffmpeg.exe'),
      path.resolve(process.cwd(), '../resources/ffmpeg/ffmpeg.exe')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'ffmpeg';
  }

  public async getMetadata(url: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, [
        '-J',
        '--no-playlist',
        '--no-warnings',
        '--ffmpeg-location', this.ffmpegPath,
        url
      ], {
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', chunk => stdout += chunk);
      proc.stderr.on('data', chunk => stderr += chunk);

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`yt-dlp metadata extraction failed (code ${code}): ${stderr}`));
        }

        try {
          const data = JSON.parse(stdout);
          const rawFormats = data.formats || [];

          const formats: VideoFormat[] = rawFormats.map((f: any) => {
            const hasVideo = f.vcodec && f.vcodec !== 'none';
            const hasAudio = f.acodec && f.acodec !== 'none';
            return {
              formatId: String(f.format_id),
              formatNote: f.format_note || (f.height ? `${f.height}p` : undefined),
              resolution: f.resolution || (f.width && f.height ? `${f.width}x${f.height}` : undefined),
              ext: f.ext || 'mp4',
              filesize: f.filesize || f.filesize_approx || undefined,
              vcodec: f.vcodec,
              acodec: f.acodec,
              hasVideo: Boolean(hasVideo),
              hasAudio: Boolean(hasAudio)
            };
          });

          resolve({
            url,
            title: sanitizeFilename(data.title || 'video'),
            thumbnail: data.thumbnail,
            duration: data.duration,
            formats
          });
        } catch (e) {
          reject(new Error(`Failed to parse yt-dlp JSON output: ${e}`));
        }
      });
    });
  }

  public async downloadVideo(
    url: string,
    formatSelector: string,
    outputTemplate: string,
    onProgress?: (percent: number, speed: string, eta: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '--no-playlist',
        '-f', formatSelector,
        '-o', outputTemplate,
        '--ffmpeg-location', this.ffmpegPath,
        '--merge-output-format', 'mp4',
        '--newline',
        url
      ];

      const proc = spawn(this.binaryPath, args, { windowsHide: true });
      let stderr = '';

      proc.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        // Parse [download]  45.2% of 12.34MiB at 3.45MiB/s ETA 00:02
        if (onProgress) {
          const match = text.match(/\[download\]\s+([\d\.]+)%\s+of\s+[^\s]+\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/);
          if (match) {
            const percent = parseFloat(match[1]);
            const speed = match[2];
            const eta = match[3];
            onProgress(percent, speed, eta);
          }
        }
      });

      proc.stderr.on('data', chunk => stderr += chunk);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(outputTemplate);
        } else {
          reject(new Error(`yt-dlp download failed (code ${code}): ${stderr}`));
        }
      });
    });
  }
}

