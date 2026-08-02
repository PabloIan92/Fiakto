import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const narrationPath = join(root, 'demo', 'narration.json');
const transcriptPath = join(root, 'docs', 'demo', 'fiakto-demo-transcript.md');
const videoPath = join(root, 'demo', 'output', 'fiakto-devpost-demo.mp4');

function fail(message) {
  console.error(`Demo validation failed: ${message}`);
  process.exit(1);
}

function requireFile(path, label) {
  if (!existsSync(path)) fail(`missing ${label}: ${path}`);
}

requireFile(narrationPath, 'demo/narration.json');
const narration = JSON.parse(readFileSync(narrationPath, 'utf8'));
if (!Array.isArray(narration.scenes) || narration.scenes.length !== 8) {
  fail('narration.json must contain exactly eight scenes');
}

for (const [index, scene] of narration.scenes.entries()) {
  if (typeof scene.text !== 'string' || !scene.text.trim()) {
    fail(`scene ${index + 1} must contain non-empty English narration`);
  }
}

for (const scene of narration.scenes.slice(1, 7)) {
  if (!/^(PROTOTYPE FLOW|PLANNED WORKFLOW)$/.test(scene.disclosure ?? '')) {
    fail(`scene ${scene.id} must disclose PROTOTYPE FLOW or PLANNED WORKFLOW`);
  }
}

if (!narration.scenes[7].text.includes('Todo tiene solución.')) {
  fail('final scene must contain “Todo tiene solución.”');
}

requireFile(transcriptPath, 'demo transcript');
const transcript = readFileSync(transcriptPath, 'utf8');
for (const scene of narration.scenes) {
  if (!transcript.includes(scene.text)) fail(`transcript is missing scene ${scene.id}`);
}

requireFile(videoPath, 'final MP4');
const probe = spawnSync('ffprobe', [
  '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', videoPath,
], { encoding: 'utf8' });
if (probe.status !== 0) fail(`ffprobe failed: ${probe.stderr.trim()}`);

const media = JSON.parse(probe.stdout);
const video = media.streams.find((stream) => stream.codec_type === 'video');
const audio = media.streams.find((stream) => stream.codec_type === 'audio');
if (!video || video.codec_name !== 'h264' || video.width !== 1920 || video.height !== 1080) {
  fail('MP4 must contain 1920x1080 H.264 video');
}
if (!audio || audio.codec_name !== 'aac') fail('MP4 must contain AAC audio');
const duration = Number(media.format?.duration);
if (!Number.isFinite(duration) || duration < 75 || duration > 90) {
  fail(`MP4 duration must be 75–90 seconds (received ${duration})`);
}

console.log(`Demo validation passed: ${duration.toFixed(2)} seconds, 1920x1080 H.264/AAC.`);
