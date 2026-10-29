import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export class FfmpegMuxer {
  private binaryPath: string;

  constructor(customBinaryPath?: string) {
    this.binaryPath = customBinaryPath || this.findDefaultBinary();
  }

  private findDefaultBinary(): string {
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

  public async mergeStreams(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // ffmpeg -y -i video -i audio -c copy -map 0:v:0 -map 1:a:0 output
      const args = [
        '-y',
        '-i', videoPath,
        '-i', audioPath,
        '-c', 'copy',
        '-map', '0:v:0',
        '-map', '1:a:0',
        outputPath
      ];

      const proc = spawn(this.binaryPath, args, { windowsHide: true });
      let stderr = '';

      proc.stderr.on('data', chunk => stderr += chunk);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg stream muxing failed (code ${code}): ${stderr}`));
        }
      });
    });
  }

  public async remuxContainer(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i', inputPath,
        '-c', 'copy',
        outputPath
      ];

      const proc = spawn(this.binaryPath, args, { windowsHide: true });
      let stderr = '';

      proc.stderr.on('data', chunk => stderr += chunk);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg remux failed (code ${code}): ${stderr}`));
        }
      });
    });
  }

  public async extractAudio(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'copy',
        outputPath
      ];

      const proc = spawn(this.binaryPath, args, { windowsHide: true });
      let stderr = '';

      proc.stderr.on('data', chunk => stderr += chunk);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg audio extraction failed (code ${code}): ${stderr}`));
        }
      });
    });
  }
}

