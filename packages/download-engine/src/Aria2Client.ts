export interface Aria2Status {
  gid: string;
  status: 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed';
  totalLength: string;
  completedLength: string;
  uploadLength: string;
  downloadSpeed: string;
  uploadSpeed: string;
  connections: string;
  errorCode?: string;
  errorMessage?: string;
  files: Array<{
    index: string;
    path: string;
    length: string;
    completedLength: string;
    selected: string;
    uris: Array<{ uri: string; status: string }>;
  }>;
  dir: string;
}

export interface Aria2GlobalStat {
  downloadSpeed: string;
  uploadSpeed: string;
  numActive: string;
  numWaiting: string;
  numStopped: string;
  numStoppedTotal: string;
}

export class Aria2Client {
  private endpoint: string;
  private secret: string;
  private reqId: number = 1;

  constructor(port: number, secret: string) {
    this.endpoint = `http://127.0.0.1:${port}/jsonrpc`;
    this.secret = secret;
  }

  public async call<T = any>(method: string, params: any[] = []): Promise<T> {
    const id = `fdm-${this.reqId++}`;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params: [`token:${this.secret}`, ...params]
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`aria2 RPC HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    if (data.error) {
      throw new Error(`aria2 RPC error [${data.error.code}]: ${data.error.message}`);
    }

    return data.result as T;
  }

  public async addUri(uris: string[], options: Record<string, any> = {}): Promise<string> {
    return this.call<string>('aria2.addUri', [uris, options]);
  }

  public async pause(gid: string): Promise<string> {
    return this.call<string>('aria2.pause', [gid]);
  }

  public async forcePause(gid: string): Promise<string> {
    return this.call<string>('aria2.forcePause', [gid]);
  }

  public async unpause(gid: string): Promise<string> {
    return this.call<string>('aria2.unpause', [gid]);
  }

  public async remove(gid: string): Promise<string> {
    return this.call<string>('aria2.remove', [gid]);
  }

  public async forceRemove(gid: string): Promise<string> {
    return this.call<string>('aria2.forceRemove', [gid]);
  }

  public async tellStatus(gid: string, keys?: string[]): Promise<Aria2Status> {
    return this.call<Aria2Status>('aria2.tellStatus', keys ? [gid, keys] : [gid]);
  }

  public async tellActive(keys?: string[]): Promise<Aria2Status[]> {
    return this.call<Aria2Status[]>('aria2.tellActive', keys ? [keys] : []);
  }

  public async tellWaiting(offset: number = 0, num: number = 100, keys?: string[]): Promise<Aria2Status[]> {
    return this.call<Aria2Status[]>('aria2.tellWaiting', keys ? [offset, num, keys] : [offset, num]);
  }

  public async tellStopped(offset: number = 0, num: number = 100, keys?: string[]): Promise<Aria2Status[]> {
    return this.call<Aria2Status[]>('aria2.tellStopped', keys ? [offset, num, keys] : [offset, num]);
  }

  public async changeGlobalOption(options: Record<string, string>): Promise<string> {
    return this.call<string>('aria2.changeGlobalOption', [options]);
  }

  public async changeOption(gid: string, options: Record<string, string>): Promise<string> {
    return this.call<string>('aria2.changeOption', [gid, options]);
  }

  public async getGlobalStat(): Promise<Aria2GlobalStat> {
    return this.call<Aria2GlobalStat>('aria2.getGlobalStat');
  }

  public async purgeDownloadResult(): Promise<string> {
    return this.call<string>('aria2.purgeDownloadResult');
  }
}

