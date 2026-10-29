import { DownloadSupervisor } from '@fdm/download-engine';
import { isValidUrl } from '@fdm/shared';

export class NativeMessagingHost {
  private supervisor: DownloadSupervisor;

  constructor(supervisor: DownloadSupervisor) {
    this.supervisor = supervisor;
  }

  public listen(): void {
    let buffer = Buffer.alloc(0);

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 4) {
          const msgLen = buffer.readUInt32LE(0);
          if (buffer.length < 4 + msgLen) {
            // Wait for more data
            break;
          }

          const msgBytes = buffer.subarray(4, 4 + msgLen);
          buffer = buffer.subarray(4 + msgLen);

          try {
            const message = JSON.parse(msgBytes.toString('utf8'));
            this.handleMessage(message);
          } catch (e: any) {
            this.sendReply({ success: false, error: e.message });
          }
        }
      }
    });
  }

  private async handleMessage(msg: any): Promise<void> {
    if (msg.action === 'ping') {
      this.sendReply({ status: 'ok', name: 'FDM Native Host' });
      return;
    }

    if (msg.action === 'download' && msg.url && isValidUrl(msg.url)) {
      try {
        const item = await this.supervisor.addDownload({
          url: msg.url,
          filename: msg.filename,
          headers: msg.headers,
          cookies: msg.cookies
        });
        this.sendReply({ success: true, id: item.id, filename: item.filename });
      } catch (e: any) {
        this.sendReply({ success: false, error: e.message });
      }
      return;
    }

    this.sendReply({ success: false, error: 'Unknown action or invalid parameters' });
  }

  private sendReply(reply: any): void {
    const jsonStr = JSON.stringify(reply);
    const msgBytes = Buffer.from(jsonStr, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(msgBytes.length, 0);

    process.stdout.write(header);
    process.stdout.write(msgBytes);
  }
}

