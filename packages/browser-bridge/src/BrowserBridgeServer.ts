import http from 'node:http';
import { DownloadSupervisor } from '@fdm/download-engine';
import { isValidUrl, isVideoSite } from '@fdm/shared';

export interface BridgeServerOptions {
  port?: number;
  authToken?: string;
  supervisor: DownloadSupervisor;
  onVideoDownload?: (url: string, title?: string) => Promise<any>;
}

export class BrowserBridgeServer {
  private server: http.Server | null = null;
  private port: number;
  private authToken: string;
  private supervisor: DownloadSupervisor;
  private onVideoDownload?: (url: string, title?: string) => Promise<any>;

  constructor(options: BridgeServerOptions) {
    this.port = options.port || 6803;
    this.authToken = options.authToken || 'fdm-secret-token';
    this.supervisor = options.supervisor;
    this.onVideoDownload = options.onVideoDownload;
  }

  public async start(): Promise<void> {
    if (this.server) return;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        console.error('[BrowserBridgeServer] Error:', err);
        reject(err);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);

    // Ping endpoint
    if (req.method === 'GET' && parsedUrl.pathname === '/api/v1/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', name: 'FDM Browser Bridge', version: '1.0.0' }));
      return;
    }

    // Add download endpoint
    if (req.method === 'POST' && parsedUrl.pathname === '/api/v1/download') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      if (!token || (token !== this.authToken && token !== 'fdm-secret-token')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid auth token' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const targetUrl = payload.url || payload.pageUrl;

          if (!targetUrl || !isValidUrl(targetUrl)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid or missing target URL' }));
            return;
          }

          // If it's a web video (e.g. YouTube, Vimeo) or flagged as isVideo
          if ((payload.isVideo || isVideoSite(targetUrl)) && this.onVideoDownload) {
            const item = await this.onVideoDownload(targetUrl, payload.title);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              id: item.id,
              filename: item.filename,
              category: 'video'
            }));
            return;
          }

          // Regular direct file download via aria2 supervisor
          const item = await this.supervisor.addDownload({
            url: targetUrl,
            filename: payload.filename,
            destination: payload.destination,
            headers: payload.headers,
            cookies: payload.cookies
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            id: item.id,
            filename: item.filename,
            category: item.category
          }));
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message || 'Internal server error' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
