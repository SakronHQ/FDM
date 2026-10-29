import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export interface Aria2ProcessOptions {
  binaryPath?: string;
  port?: number;
  secret: string;
  sessionFile?: string;
}

export class Aria2Process {
  private proc: ChildProcess | null = null;
  private port: number;
  private secret: string;
  private binaryPath: string;
  private isStopping: boolean = false;

  constructor(options: Aria2ProcessOptions) {
    this.port = options.port || 6800;
    this.secret = options.secret;
    this.binaryPath = options.binaryPath || this.findDefaultBinary();
  }

  private findDefaultBinary(): string {
    // 1. Check relative project resources
    const candidates = [
      path.resolve(process.cwd(), 'resources/aria2/aria2c.exe'),
      path.resolve(process.cwd(), '../../resources/aria2/aria2c.exe'),
      path.resolve(process.cwd(), '../resources/aria2/aria2c.exe')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    // 2. Fallback to system command
    return 'aria2c';
  }

  public async start(): Promise<void> {
    if (this.proc && !this.proc.killed) {
      return;
    }

    const args = [
      '--enable-rpc=true',
      '--rpc-listen-all=false',
      '--rpc-listen-port=' + this.port,
      '--rpc-secret=' + this.secret,
      '--rpc-max-request-size=10M',
      '--daemon=false',
      '--quiet=true',
      '--auto-file-renaming=true',
      '--allow-overwrite=false',
      '--check-certificate=false',
      '--conditional-get=true',
      '--continue=true',
      '--max-tries=5',
      '--retry-wait=2',
      '--timeout=30',
      '--connect-timeout=15'
    ];

    this.isStopping = false;
    this.proc = spawn(this.binaryPath, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true
    });

    this.proc.stderr?.on('data', (data) => {
      const msg = data.toString();
      if (!this.isStopping) {
        console.warn(`[aria2c stderr]: ${msg}`);
      }
    });

    this.proc.on('exit', (code, signal) => {
      if (!this.isStopping) {
        console.warn(`[aria2c] Process exited unexpectedly with code ${code}, signal ${signal}`);
      }
      this.proc = null;
    });

    // Wait for the daemon to start accepting connections
    await this.waitForReady(4000);
  }

  private async waitForReady(maxWaitMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'ping',
            method: 'aria2.getVersion',
            params: [`token:${this.secret}`]
          })
        });
        if (res.ok) {
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise(r => setTimeout(r, 150));
    }
    throw new Error(`aria2c daemon failed to start on port ${this.port} within ${maxWaitMs}ms`);
  }

  public async stop(): Promise<void> {
    this.isStopping = true;
    if (!this.proc) return;

    try {
      await fetch(`http://127.0.0.1:${this.port}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'shutdown',
          method: 'aria2.shutdown',
          params: [`token:${this.secret}`]
        })
      });
    } catch {
      // Ignored
    }

    if (this.proc && !this.proc.killed) {
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
  }

  public getPort(): number {
    return this.port;
  }

  public getSecret(): string {
    return this.secret;
  }

  public isRunning(): boolean {
    return this.proc !== null && !this.proc.killed;
  }
}

