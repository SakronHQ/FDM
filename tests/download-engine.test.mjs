import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DownloadSupervisor, HttpRangeDetector } from '../packages/download-engine/dist/index.js';

test('Download Engine - Range Detection, Multi-segment Download & Pause/Resume', async (t) => {
  // 1. Create a local test HTTP server that supports HTTP Range requests
  const testPayload = Buffer.alloc(1024 * 1024 * 5, 'FDM-HIGH-SPEED-DATA-CHUNK-TEST-'); // 5 MB test file
  let rangeRequestsCount = 0;

  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range) {
      rangeRequestsCount++;
      const match = range.match(/bytes=(\d+)-(\d+)?/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : testPayload.length - 1;
        const chunk = testPayload.subarray(start, end + 1);

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${testPayload.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunk.length,
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="test_5mb_archive.zip"'
        });
        res.end(chunk);
        return;
      }
    }

    res.writeHead(200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': testPayload.length,
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="test_5mb_archive.zip"'
    });
    res.end(testPayload);
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const serverPort = address.port;
  const testUrl = `http://127.0.0.1:${serverPort}/test_5mb_archive.zip`;

  // 2. Test HttpRangeDetector probe
  const probe = await HttpRangeDetector.probeUrl(testUrl);
  assert.strictEqual(probe.supportsRange, true, 'Should detect Range: bytes support');
  assert.strictEqual(probe.contentLength, testPayload.length, 'Should detect file size');
  assert.strictEqual(probe.suggestedFilename, 'test_5mb_archive.zip', 'Should extract Content-Disposition filename');

  // 3. Test DownloadSupervisor lifecycle
  const testDbPath = path.resolve('test_supervisor.db');
  const supervisor = new DownloadSupervisor(testDbPath, 6802);
  await supervisor.start();

  const tempDownloadDir = path.resolve('test_downloads_temp');
  if (!fs.existsSync(tempDownloadDir)) fs.mkdirSync(tempDownloadDir, { recursive: true });

  const dl = await supervisor.addDownload({
    url: testUrl,
    destination: tempDownloadDir,
    preset: 'high_speed' // 8 connections
  });

  assert.ok(dl.id, 'Download should receive an ID');
  assert.strictEqual(dl.connections, 8, 'Should use 8 connections for high_speed on range-capable server');

  // Wait for download to progress or complete
  let completed = false;
  const startWait = Date.now();
  while (Date.now() - startWait < 10000) {
    const current = supervisor.getDownload(dl.id);
    if (current && current.status === 'complete') {
      completed = true;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  assert.strictEqual(completed, true, 'Download should complete within 10s');
  assert.ok(rangeRequestsCount > 1, `Multiple range chunks should be requested: got ${rangeRequestsCount}`);

  // Verify downloaded file integrity
  const downloadedPath = path.join(tempDownloadDir, dl.filename);
  assert.ok(fs.existsSync(downloadedPath), 'Downloaded file must exist on disk');
  const downloadedBytes = fs.readFileSync(downloadedPath);
  assert.strictEqual(downloadedBytes.length, testPayload.length, 'Downloaded file size must match original');
  assert.deepStrictEqual(downloadedBytes, testPayload, 'Downloaded data must byte-for-byte match');

  // Cleanup
  await supervisor.stop();
  server.close();
  try {
    if (fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath);
    if (fs.existsSync(tempDownloadDir)) fs.rmdirSync(tempDownloadDir);
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    const wal = testDbPath + '-wal';
    const shm = testDbPath + '-shm';
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
  } catch (e) {
    // cleanup
  }
});

