# Fiakto Devpost Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an honest, polished English-language Fiakto demo video ready for YouTube and Devpost.

**Architecture:** A deterministic Node/Puppeteer renderer creates branded 1920x1080 scene frames from an HTML storyboard. A PowerShell speech script generates English narration scene by scene, and FFmpeg combines timed frames, narration, subtitles, restrained transitions, and a low-volume generated ambient bed into a web-ready MP4.

**Tech Stack:** HTML/CSS, Node.js, Puppeteer, Windows System.Speech, FFmpeg/FFprobe.

## Global Constraints

- 16:9, 1920x1080, H.264 MP4 with AAC audio and web-optimized fast start.
- Target duration: 75–90 seconds.
- English voice-over with burned-in English subtitles.
- Quiet instrumental background music, kept below the narration.
- Fiakto visual identity, ending with “Todo tiene solución.”
- Incomplete request, triage, matching, and quote stages must visibly say “Prototype flow” or “Planned workflow.”
- Do not simulate clicks or claim that an unfinished workflow is live.
- Gemini assists triage and organization; it does not diagnose with certainty or move money.

---

## File map

```text
demo/
  storyboard.html          Branded eight-scene visual source
  render-frames.mjs        Puppeteer frame renderer
  narration.json           Exact English narration and subtitle timing source
  synthesize-voice.ps1     System.Speech WAV generation
  render-demo.ps1          FFmpeg composition and validation entry point
  output/                   Generated frames, audio, subtitles, MP4 and thumbnail
docs/demo/
  fiakto-demo-transcript.md Human-readable narration transcript
tests/demo/
  validate-demo.mjs        Structural and media assertions
```

### Task 1: Storyboard, narration, and final render

**Files:**
- Create: `demo/storyboard.html`
- Create: `demo/render-frames.mjs`
- Create: `demo/narration.json`
- Create: `demo/synthesize-voice.ps1`
- Create: `demo/render-demo.ps1`
- Create: `docs/demo/fiakto-demo-transcript.md`
- Create: `tests/demo/validate-demo.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: approved video design and local Puppeteer/FFmpeg/System.Speech tools
- Produces: `demo/output/fiakto-devpost-demo.mp4`, `demo/output/fiakto-thumbnail.jpg`, and transcript

- [ ] **Step 1: Write the failing validator**

Create `tests/demo/validate-demo.mjs` to assert that `narration.json` contains exactly eight non-empty English scenes, scenes 2–7 carry a prototype/planned disclosure, the final scene contains `Todo tiene solución.`, the transcript contains every narration line, and FFprobe reports a 1920x1080 H.264 video with AAC audio lasting between 75 and 90 seconds.

- [ ] **Step 2: Verify the validator fails before assets exist**

Run: `node tests/demo/validate-demo.mjs`

Expected: non-zero exit identifying missing `demo/narration.json` or final MP4.

- [ ] **Step 3: Create the exact eight-scene narration**

Use these scene messages, with natural pauses added only between sentences:

1. “The idea behind Fiakto begins with a familiar scene. A pipe starts leaking late at night, and the customer does not know whether the problem is minor, urgent, or even safe to inspect. They search old messages, ask neighbors for recommendations, repeat the same explanation to several people, and receive estimates that are difficult to compare. Meanwhile, a skilled local professional may be available only a few blocks away, but has no clear way to discover that genuine request. At that point, time is not just inconvenient. It determines whether the customer feels safe, whether the repair can wait, and whether a professional has enough context to respond responsibly. The missing link is not more messages; it is a trusted path from an everyday problem to accountable local work.”
2. “That gap suggested a better starting point. Instead of asking customers to diagnose a problem or learn technical vocabulary, Fiakto begins with what they already have: a photo, a short description, and an approximate location. Gemini can help turn that messy evidence into a structured request, while the platform protects sensitive information and keeps consequential decisions under human control. That simple handoff reduces repeated explanations, helps professionals judge whether their skills and coverage are relevant, and lets everyone begin with clearer expectations before more sensitive details are shared.”
3. “Gemini analyzes the available evidence, structures the request, asks focused follow-up questions, and highlights possible safety risks without pretending to diagnose with certainty.”
4. “The result becomes a clearer opportunity for verified local professionals with the relevant trade and coverage area.”
5. “Professionals submit private quotes. They never see competitors’ prices, and the customer’s exact address stays protected until acceptance and payment.”
6. “Fiakto keeps consequential actions auditable. Gemini helps organize information, but deterministic rules and people remain responsible for identity, authorization, and money.”
7. “Our first pilot is designed for CABA and Greater Buenos Aires, with a nationwide architecture and a simple goal: turn real household problems into trusted, accountable work.”
8. “Fiakto. Todo tiene solución.”

- [ ] **Step 4: Build the branded storyboard and frame renderer**

Create eight 1920x1080 scenes using deep navy, warm off-white, safety amber, and teal accents; large editorial typography; a persistent Fiakto wordmark; concise diagrams for capture, Gemini triage, matching, private quotes, audit controls, pilot geography, and closing promise. Scenes 2–7 must show a visible capsule reading `PROTOTYPE FLOW` or `PLANNED WORKFLOW`. Render one PNG per scene with Puppeteer and inspect all eight for clipping.

- [ ] **Step 5: Generate English narration and subtitles**

Use `System.Speech.Synthesis.SpeechSynthesizer` with an installed English voice, rate `-1`, volume `100`, and one PCM WAV per scene. Derive subtitle cue boundaries from each WAV duration, write UTF-8 SRT, and generate `docs/demo/fiakto-demo-transcript.md` from the same narration source so spoken and written copy cannot diverge.

- [ ] **Step 6: Compose the video**

Use FFmpeg to create one segment per scene from its PNG and WAV, padding each scene by 0.6 seconds. Concatenate the segments, add 0.35-second restrained fades, generate a quiet sine-based ambient bed below narration, burn subtitles with a readable semi-transparent backing, encode H.264 `yuv420p` at CRF 20 with AAC 192 kbps, and enable `+faststart`. Extract the opening/closing composite as `demo/output/fiakto-thumbnail.jpg`.

- [ ] **Step 7: Validate and inspect**

Run:

```powershell
node tests/demo/validate-demo.mjs
ffmpeg -v error -i demo/output/fiakto-devpost-demo.mp4 -f null NUL
```

Expected: validator exits 0, duration is 75–90 seconds, required streams/codecs/resolution are present, and FFmpeg reports no decode errors. Inspect representative opening, Gemini, privacy, and closing frames at original resolution.

- [ ] **Step 8: Commit reproducible sources**

Ignore intermediate WAV/PNG files while retaining the final MP4, thumbnail, narration source, transcript, renderer, and validator.

```powershell
git add .gitignore demo docs/demo tests/demo
git commit -m "feat: produce Fiakto Devpost demo video"
```
