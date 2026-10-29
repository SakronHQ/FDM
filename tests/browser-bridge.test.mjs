import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { DownloadSupervisor } from '../packages/download-engine/dist/index.js';
import { BrowserBridgeServer } from '../packages/browser-bridge/dist/index.js';

test('Browser Bridge - HTTP server ping & authenticated download trigger', async (t) => {
  const testDb = path.resolve('test_bridge.db');
  const supervisor = new DownloadSupervisor(testDb, 6805);
  // We do not even need full aria2 daemon for ping & auth test, but let's test bridge server logic
  const bridge = new BrowserBridgeServer({
    port: 6809,
    authToken: 'test-secret-bridge-token',
    supervisor
  });

  await bridge.start();

  // 1. Test ping
  const pingRes = await fetch('http://127.0.0.1:6809/api/v1/ping');
  assert.strictEqual(pingRes.status, 200, 'Ping should return 200');
  const pingData = await pingRes.json();
  assert.strictEqual(pingData.status, 'ok');

  // 2. Test unauthorized download
  const unauthRes = await fetch('http://127.0.0.1:6809/api/v1/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/file.zip' })
  });
  assert.strictEqual(unauthRes.status, 401, 'Should reject without bearer token');

  // 3. Test invalid URL
  const badUrlRes = await fetch('http://127.0.0.1:6809/api/v1/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-secret-bridge-token'
    },
    body: JSON.stringify({ url: 'not-a-valid-url' })
  });
  assert.strictEqual(badUrlRes.status, 400, 'Should reject invalid URL');

  await bridge.stop();
  supervisor.getDatabase().close();
  try {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  } catch {}
});

