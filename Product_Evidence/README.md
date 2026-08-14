# Product evidence

This folder contains the evidence available for the Fiakto hackathon submission.

- `fiakto-product-evidence.png` shows the application running.
- `fiakto-five-year-projection.csv` contains the transparent five-year planning model used in the submission.
- `docs/demo/devpost-narrative.md` is the written submission narrative.
- `demo/output/fiakto-devpost-demo.mp4` is the recorded demo, narrated over the live production app.

Fiakto is deployed on Firebase App Hosting with a real Gemini API call (`gemini-flash-latest`) wired into the live triage flow — this is not a local-only prototype. The end-to-end flow (request → Gemini triage → matching → private quotes → 8% commission → in-app chat with contact-info redaction → completion photo → rating/close) has been exercised on the deployed app, including a real bank transfer moving real money through the platform's fee logic.

What this repository does **not** claim: independent, third-party market traction. The transactions exercised so far were run by the founding team acting as both customer and professional to validate the pipeline end to end, not by unrelated paying customers. The five-year projection in this folder is a planning hypothesis, not a forecast backed by existing revenue or users — those are genuinely zero today.
