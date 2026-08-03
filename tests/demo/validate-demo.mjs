import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const narrationPath = join(root, 'demo', 'narration.json');
const transcriptPath = join(root, 'docs', 'demo', 'fiakto-demo-transcript.md');
const videoPath = join(root, 'demo', 'output', 'fiakto-devpost-demo.mp4');
const rendererPath = join(root, 'demo', 'render-frames.mjs');
const composerPath = join(root, 'demo', 'render-demo.ps1');
const packagePath = join(root, 'package.json');
const exactLines = [
  'The idea behind Fiakto begins with a familiar scene. A pipe starts leaking late at night, and the customer does not know whether the problem is minor, urgent, or even safe to inspect. They search old messages, ask neighbors for recommendations, repeat the same explanation to several people, and receive estimates that are difficult to compare. Meanwhile, a skilled local professional may be available only a few blocks away, but has no clear way to discover that genuine request. At that point, time is not just inconvenient. It determines whether the customer feels safe, whether the repair can wait, and whether a professional has enough context to respond responsibly. The missing link is not more messages; it is a trusted path from an everyday problem to accountable local work.',
  'That gap suggested a better starting point. Instead of asking customers to diagnose a problem or learn technical vocabulary, Fiakto begins with what they already have: a photo, a short description, and an approximate location. Gemini can help turn that messy evidence into a structured request, while the platform protects sensitive information and keeps consequential decisions under human control. That simple handoff reduces repeated explanations, helps professionals judge whether their skills and coverage are relevant, and lets everyone begin with clearer expectations before more sensitive details are shared.',
  'Gemini analyzes the available evidence, structures the request, asks focused follow-up questions, and highlights possible safety risks without pretending to diagnose with certainty.',
  'The result becomes a clearer opportunity for verified local professionals with the relevant trade and coverage area.',
  'Professionals submit private quotes. They never see competitors’ prices, and the customer’s exact address stays protected until acceptance and payment.',
  'Fiakto keeps consequential actions auditable. Gemini helps organize information, but deterministic rules and people remain responsible for identity, authorization, and money.',
  'Our first pilot is designed for CABA and Greater Buenos Aires, with a nationwide architecture and a simple goal: turn real household problems into trusted, accountable work.',
  'Fiakto. Todo tiene solución.',
];

function fail(message) { console.error(`Demo validation failed: ${message}`); process.exit(1); }
function requireFile(path, label) { if (!existsSync(path)) fail(`missing ${label}: ${path}`); }

requireFile(narrationPath, 'demo/narration.json');
const narration = JSON.parse(readFileSync(narrationPath, 'utf8'));
if (!Array.isArray(narration.scenes) || narration.scenes.length !== 8) fail('narration.json must contain exactly eight scenes');
for (const [index, scene] of narration.scenes.entries()) {
  if (scene.text !== exactLines[index]) fail(`scene ${index + 1} must match the approved narration exactly`);
}
for (const scene of narration.scenes.slice(1, 7)) {
  if (!/^(PROTOTYPE FLOW|PLANNED WORKFLOW)$/.test(scene.disclosure ?? '')) fail(`scene ${scene.id} must disclose PROTOTYPE FLOW or PLANNED WORKFLOW`);
}
if (!narration.scenes[7].text.includes('Todo tiene solución.')) fail('final scene must contain “Todo tiene solución.”');

requireFile(transcriptPath, 'demo transcript');
const transcript = readFileSync(transcriptPath, 'utf8');
for (const line of exactLines) if (!transcript.includes(line)) fail('transcript is missing approved narration');

requireFile(rendererPath, 'frame renderer');
const renderer = readFileSync(rendererPath, 'utf8');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
if (!packageJson.devDependencies?.puppeteer || !renderer.includes("import puppeteer from 'puppeteer'")) fail('renderer must use the project Puppeteer devDependency');
if (/playwright|executablePath/i.test(renderer)) fail('renderer must not include a browser fallback or hard-coded executable');
requireFile(composerPath, 'render composer');
const composer = readFileSync(composerPath, 'utf8');
if (!composer.includes('subtitles=demo/output/subtitles.srt') || !composer.includes('-movflags +faststart')) fail('render composer must burn subtitles and enable fast start');

requireFile(videoPath, 'final MP4');
const probe = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', videoPath], { encoding: 'utf8' });
if (probe.status !== 0) fail(`ffprobe failed: ${probe.stderr.trim()}`);
const media = JSON.parse(probe.stdout);
const video = media.streams.find((stream) => stream.codec_type === 'video');
const audio = media.streams.find((stream) => stream.codec_type === 'audio');
if (!video || video.codec_name !== 'h264' || video.width !== 1920 || video.height !== 1080 || video.pix_fmt !== 'yuv420p') fail('MP4 must contain 1920x1080 H.264 yuv420p video');
if (!audio || audio.codec_name !== 'aac') fail('MP4 must contain AAC audio');
const duration = Number(media.format?.duration);
if (!Number.isFinite(duration) || duration < 75 || duration > 90) fail(`MP4 duration must be 75–90 seconds (received ${duration})`);
const atoms = readFileSync(videoPath);
if (atoms.indexOf('moov') === -1 || atoms.indexOf('mdat') === -1 || atoms.indexOf('moov') > atoms.indexOf('mdat')) fail('MP4 must be fast-start optimized (moov atom before mdat)');

console.log(`Demo validation passed: ${duration.toFixed(2)} seconds, 1920x1080 H.264/yuv420p/AAC fast-start with burned subtitle composition.`);
