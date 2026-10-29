import http from 'node:http';
import https from 'node:https';
import { sanitizeFilename } from '@fdm/shared';

export interface UrlProbeResult {
  url: string;
  finalUrl: string;
  supportsRange: boolean;
  contentLength: number;
  suggestedFilename?: string;
  contentType?: string;
}

export class HttpRangeDetector {
  public static async probeUrl(targetUrl: string, headers: Record<string, string> = {}): Promise<UrlProbeResult> {
    try {
      const parsed = new URL(targetUrl);
      const reqHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FDM/1.0',
        'Range': 'bytes=0-0',
        ...headers
      };

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: reqHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      });

      const finalUrl = res.url || targetUrl;
      const status = res.status;
      const acceptRanges = res.headers.get('accept-ranges');
      const contentRange = res.headers.get('content-range');
      const contentDisposition = res.headers.get('content-disposition');
      const contentType = res.headers.get('content-type') || undefined;

      // Check range support
      const supportsRange = status === 206 || (acceptRanges && acceptRanges.toLowerCase().includes('bytes')) || Boolean(contentRange);

      // Extract length
      let contentLength = 0;
      if (contentRange) {
        // e.g. bytes 0-0/123456
        const parts = contentRange.split('/');
        if (parts[1] && parts[1] !== '*') {
          contentLength = parseInt(parts[1], 10) || 0;
        }
      } else {
        const cl = res.headers.get('content-length');
        if (cl) contentLength = parseInt(cl, 10) || 0;
      }

      // Extract filename from Content-Disposition if present
      let suggestedFilename: string | undefined;
      if (contentDisposition) {
        suggestedFilename = this.parseContentDisposition(contentDisposition);
      }

      // If no header filename, derive from final URL path
      if (!suggestedFilename) {
        try {
          const urlObj = new URL(finalUrl);
          const pathname = urlObj.pathname;
          const base = pathname.substring(pathname.lastIndexOf('/') + 1);
          if (base && base.includes('.')) {
            suggestedFilename = sanitizeFilename(decodeURIComponent(base));
          }
        } catch {
          // ignore
        }
      }

      return {
        url: targetUrl,
        finalUrl,
        supportsRange,
        contentLength,
        suggestedFilename,
        contentType
      };
    } catch {
      // If probe fails (e.g. range unsupported or server rejects GET with range), fallback to safe defaults
      return {
        url: targetUrl,
        finalUrl: targetUrl,
        supportsRange: false,
        contentLength: 0
      };
    }
  }

  private static parseContentDisposition(header: string): string | undefined {
    // filename*=UTF-8''name.ext
    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      return sanitizeFilename(decodeURIComponent(utf8Match[1]));
    }
    // filename="name.ext" or filename=name.ext
    const regularMatch = header.match(/filename=["']?([^"';]+)["']?/i);
    if (regularMatch && regularMatch[1]) {
      return sanitizeFilename(regularMatch[1]);
    }
    return undefined;
  }
}

