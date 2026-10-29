import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DownloadSupervisor, HttpRangeDetector } from '../packages/download-engine/dist/index.js';
import { BrowserBridgeServer } from '../packages/browser-bridge/dist/index.js';
import { detectCategory, sanitizeFilename, formatBytes, formatSpeed, formatEta } from '../packages/shared/dist/index.js';

test('FDM E2E Workflow - Presets, Interception, Range Fallback, and Persistence', async (t) => {
  // 1. Shared helpers test
  assert.strictEqual(detectCategory('movie.mkv'), 'video');
  assert.strictEqual(detectCategory('audio.mp3'), 'audio');
  assert.strictEqual(detectCategory('archive.7z'), 'archive');
  assert.strictEqual(detectCategory('installer.msi'), 'program');
  assert.strictEqual(detectCategory('document.pdf'), 'document');
  assert.strictEqual(sanitizeFilename('bad:name/test?.zip'), 'bad_name_test_.zip');
  assert.strictEqual(formatBytes(1048576), '1 MB');
  assert.strictEqual(formatSpeed(2097152), '2 MB/s');
  assert.strictEqual(formatEta(65), '1m 5s');

  // 2. Setup mock server that does NOT support range
  const noRangeServer = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Length': 1000,
      'Content-Type': 'application/octet-stream'
    });
    res.end(Buffer.alloc(1000, 'X'));
  });
  await new Promise(r => noRangeServer.listen(0, '127.0.0.1', r));
  const noRangePort = noRangeServer.address().port;
  const noRangeUrl = `http://127.0.0.1:${noRangePort}/file_no_range.bin`;

  // Verify range probe falls back to supportsRange: false
  const probeNoRange = await HttpRangeDetector.probeUrl(noRangeUrl);
  assert.strictEqual(probeNoRange.supportsRange, false, 'Server without Accept-Ranges should probe as false');

  // 3. Test Full Download Supervisor with Browser Bridge
  const testDb = path.resolve('test_e2e.db');
  const tempDir = path.resolve('test_e2e_downloads');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const supervisor = new DownloadSupervisor(testDb, 6810);
  await supervisor.start();

  const bridge = new BrowserBridgeServer({
    port: 6811,
    authToken: 'fdm-secret-token',
    supervisor
  });
  await bridge.start();

  // 4. Trigger download via browser bridge HTTP API
  const bridgeRes = await fetch('http://127.0.0.1:6811/api/v1/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer fdm-secret-token'
    },
    body: JSON.stringify({
      url: noRangeUrl,
      destination: tempDir,
      filename: 'no_range_test.bin'
    })
  });
  assert.strictEqual(bridgeRes.status, 200, 'Bridge should accept authenticated download');
  const bridgeData = await bridgeRes.json();
  assert.strictEqual(bridgeData.success, true);

  // Download item in DB should be forced to 1 connection because server doesn't support Range
  const item = supervisor.getDownload(bridgeData.id);
  assert.ok(item, 'Item must be saved in database');
  assert.strictEqual(item.connections, 1, 'Non-range server must use 1 connection');

  // Wait for completion
  let finished = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    const cur = supervisor.getDownload(bridgeData.id);
    if (cur && cur.status === 'complete') {
      finished = true;
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  assert.strictEqual(finished, true, 'Download should complete');

  // 5. Cleanup
  await bridge.stop();
  await supervisor.stop();
  noRangeServer.close();

  try {
    const downloaded = path.join(tempDir, 'no_range_test.bin');
    if (fs.existsSync(downloaded)) fs.unlinkSync(downloaded);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    const wal = testDb + '-wal';
    const shm = testDb + '-shm';
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
  } catch {}
});

