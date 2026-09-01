# Asli — Turing Hacks 4.0 (PS06)

Rural WhatsApp-forward verification prototype. Checks a message against a small trusted-source
list and returns Verified / Not Enough Proof / Likely False, with a Hindi voice readout.

## Run locally

```bash
npm i
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## Deploy on Vercel

Import `atreyamitra/asli` directly — see exact click steps below.

## Notes on the live API call

`src/App.jsx` calls `https://api.anthropic.com/v1/messages` directly from the browser as a
best-effort enhancement for messages that don't match a fixture. No API key is stored in this
frontend, and none is required for the app's judged demo path — the 3 core fixtures and the
7-message test library are fully hardcoded and never touch the network.

In a plain browser deployment (no backend, no key), that live call will typically fail (no
credentials, no CORS allowance) — and by design, on any failure the app falls back to
"Not enough proof — source list didn't cover this," and never fabricates "Verified." This is
intentional: the app never crashes, and it never overclaims when it can't reach the model.

If you later want the live-fallback path to actually succeed in production, that requires a
small backend/proxy to hold the API key server-side — out of scope for this prototype by design
("No backend" / "No API keys in the frontend").
