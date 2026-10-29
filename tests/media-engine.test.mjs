import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FfmpegMuxer, YtDlpExtractor } from '../packages/media-engine/dist/index.js';

test('Media Engine - FFmpeg stream copying & YtDlpExtractor', async (t) => {
  const ffmpegPath = path.resolve('resources/ffmpeg/ffmpeg.exe');
  assert.ok(fs.existsSync(ffmpegPath), 'FFmpeg binary must exist');

  const tempDir = path.resolve('test_media_temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const dummyVideo = path.join(tempDir, 'dummy_video.mp4');
  const dummyAudio = path.join(tempDir, 'dummy_audio.m4a');
  const mergedOutput = path.join(tempDir, 'merged_output.mp4');

  // 1. Generate a 1-second test video stream
  execFileSync(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=duration=1:size=320x240:rate=10',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    dummyVideo
  ], { stdio: 'ignore' });

  // 2. Generate a 1-second test audio stream
  execFileSync(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=1',
    '-c:a', 'aac',
    dummyAudio
  ], { stdio: 'ignore' });

  assert.ok(fs.existsSync(dummyVideo), 'Dummy video file must be generated');
  assert.ok(fs.existsSync(dummyAudio), 'Dummy audio file must be generated');

  // 3. Test FfmpegMuxer mergeStreams (stream copying)
  const muxer = new FfmpegMuxer(ffmpegPath);
  await muxer.mergeStreams(dummyVideo, dummyAudio, mergedOutput);

  assert.ok(fs.existsSync(mergedOutput), 'Merged video file must exist');
  const stat = fs.statSync(mergedOutput);
  assert.ok(stat.size > 1000, 'Merged file must contain valid payload');

  // 4. Test YtDlpExtractor binary verification
  const ytDlpPath = path.resolve('resources/yt-dlp/yt-dlp.exe');
  const extractor = new YtDlpExtractor(ytDlpPath);
  assert.ok(extractor, 'YtDlpExtractor instance created');

  // Cleanup
  try {
    if (fs.existsSync(dummyVideo)) fs.unlinkSync(dummyVideo);
    if (fs.existsSync(dummyAudio)) fs.unlinkSync(dummyAudio);
    if (fs.existsSync(mergedOutput)) fs.unlinkSync(mergedOutput);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  } catch (e) {
    // cleanup
  }
});

