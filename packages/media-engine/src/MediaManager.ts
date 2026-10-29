import { YtDlpExtractor } from './YtDlpExtractor.js';
import { FfmpegMuxer } from './FfmpegMuxer.js';
import { VideoMetadata } from '@fdm/shared';

export class MediaManager {
  private extractor: YtDlpExtractor;
  private muxer: FfmpegMuxer;

  constructor(customYtDlp?: string, customFfmpeg?: string) {
    this.extractor = new YtDlpExtractor(customYtDlp);
    this.muxer = new FfmpegMuxer(customFfmpeg);
  }

  public async getVideoInfo(url: string): Promise<VideoMetadata> {
    return this.extractor.getMetadata(url);
  }

  public async downloadAndMux(
    url: string,
    formatId: string,
    outputFilePath: string,
    onProgress?: (percent: number, speed: string, eta: string) => void
  ): Promise<string> {
    // If formatId is already single or has audio+video, or "bestvideo+bestaudio"
    return this.extractor.downloadVideo(url, formatId, outputFilePath, onProgress);
  }

  public getExtractor(): YtDlpExtractor {
    return this.extractor;
  }

  public getMuxer(): FfmpegMuxer {
    return this.muxer;
  }
}

