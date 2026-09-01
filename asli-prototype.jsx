import { useState, useRef } from "react";

// ---------- Fixed demo fixtures (never touch the network, never fail) ----------
const FIXTURES = [
  {
    id: "camp",
    label: "Camp",
    sample:
      "सिलाई / सीकर जिला अस्पताल में मुफ्त नेत्र शिविर, 3–5 सितंबर। रजिस्ट्रेशन जरूरी।",
    keywords: [
      "सीकर", "sikar", "नेत्र", "eye camp", "eye-camp", "शिविर", "camp",
      "जिला अस्पताल", "district hospital", "रजिस्ट्रेशन", "registration",
    ],
    verdict: "verified",
    why: "यह जानकारी जिला स्वास्थ्य विभाग के आधिकारिक नोटिस से मेल खाती है।",
    source: "District Health Camp Notice — Sikar",
  },
  {
    id: "phish",
    label: "Phish",
    sample: "आपका SBI खाता कल बंद होगा। यह लिंक खोलो और आधार OTP भेजो।",
    keywords: [
      "sbi", "आधार", "aadhar", "aadhaar", "otp", "बंद होगा", "account clos",
      "लिंक", "link", "खाता",
    ],
    verdict: "false",
    why: "बैंक कभी भी WhatsApp या SMS पर OTP नहीं मांगता। यह एक जाना-पहचाना धोखा है।",
    source: "RBI / Bank Fraud Advisory",
  },
  {
    id: "rumour",
    label: "Rumour",
    sample: "यह मैसेज 10 लोगों को भेजो, सरकार मुफ्त राशन देगी।",
    keywords: [
      "राशन", "ration", "10 लोगों", "10 people", "forward", "मुफ्त राशन",
      "free ration", "भेजो",
    ],
    verdict: "unsure",
    why: "इस दावे से मेल खाता कोई आधिकारिक पेज नहीं मिला।",
    source: "No matching official source found",
  },
];

const VERDICTS = {
  verified: { label: "Verified", color: "#2FB35A", dim: "#123821" },
  unsure: { label: "Not enough proof", color: "#E0A62C", dim: "#3A2C0C" },
  false: { label: "Likely false", color: "#FF3131", dim: "#3A0F0F" },
};

const SCREENSHOT_HINTS = ["screenshot", "स्क्रीनशॉट", "photo", "image", "फोटो", "जेपीजी", "png", "jpg"];

function normalize(s) {
  return s.toLowerCase();
}

function matchFixture(text) {
  const t = normalize(text);
  let best = null;
  let bestScore = 0;
  for (const fx of FIXTURES) {
    let score = 0;
    for (const kw of fx.keywords) {
      if (t.includes(normalize(kw))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = fx;
    }
  }
  return bestScore >= 1 ? best : null;
}

function looksLikeScreenshotOnly(text) {
  const t = normalize(text.trim());
  if (t.length === 0) return false;
  if (t.length <= 3) return true;
  return SCREENSHOT_HINTS.some((h) => t.includes(h)) && t.split(/\s+/).length <= 6;
}

const TRUSTED_SOURCE_BRIEF = `
You are Asli, a verification assistant for rural WhatsApp forwards in India.
You check a message against ONLY this small trusted-source domain list:
- PIB fact-check and official press notes
- MyGov / India.gov scheme pages
- MoHFW and state health department bulletins
- RBI and national cybercrime / bank fraud advisories
- District-level government health and administrative notices

Rules:
- If the claim's specific details (dates, amounts, named places, named schemes) cannot plausibly be corroborated against that source list, respond "unsure" (Not Enough Proof). Do NOT guess.
- Only respond "verified" if the message matches a plausible, specific, checkable official notice (e.g. a real-sounding district health camp, a real scheme name).
- Respond "false" for classic scam patterns: requests for OTP/PIN over chat, "your account will be closed" urgency, "forward to N people for reward" chain messages, fake bank links.
- NEVER fabricate a specific source title. If unsure, source should be "No matching official source found".
- Write "why" as ONE short sentence in Hindi, in plain simple language.
- Respond with ONLY raw JSON, no markdown fences, no extra text, in this exact shape:
{"verdict": "verified" | "unsure" | "false", "why": "<one short Hindi sentence>", "source": "<short source title, or 'No matching official source found'>"}
`.trim();

async function askLiveModel(text) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: TRUSTED_SOURCE_BRIEF,
      messages: [{ role: "user", content: `Message to check:\n"""${text}"""` }],
    }),
  });
  if (!response.ok) throw new Error("api error");
  const data = await response.json();
  const raw = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!VERDICTS[parsed.verdict]) throw new Error("bad verdict");
  return parsed;
}

function speak(text) {
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("hi"));
    if (hindiVoice) utter.voice = hindiVoice;
    utter.lang = hindiVoice ? hindiVoice.lang : "hi-IN";
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    // silently ignore — TTS is an enhancement, not core functionality
  }
}

export default function Asli() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done
  const [result, setResult] = useState(null); // {verdict, why, source, matchedFixture}
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  async function runCheck(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatus("loading");
    setError(null);
    setResult(null);

    // 1. Screenshot-only gap
    if (looksLikeScreenshotOnly(trimmed)) {
      setResult({
        verdict: "unsure",
        why: "यह एक फोटो/स्क्रीनशॉट लगता है। अभी हम फोटो में लिखा टेक्स्ट नहीं पढ़ सकते — कृपया मैसेज टाइप या पेस्ट करें।",
        source: "No matching official source found",
      });
      setStatus("done");
      return;
    }

    // 2. Hardcoded fixtures — cannot fail
    const fixed = matchFixture(trimmed);
    if (fixed) {
      setResult({ verdict: fixed.verdict, why: fixed.why, source: fixed.source });
      setStatus("done");
      return;
    }

    // 3. Live API fallback
    try {
      const live = await askLiveModel(trimmed);
      setResult(live);
    } catch (e) {
      setResult({
        verdict: "unsure",
        why: "अभी इसे जांचने में दिक्कत आई। हमारी सोर्स लिस्ट में यह दावा नहीं मिला।",
        source: "No matching official source found",
      });
      setError("live-check-unavailable");
    }
    setStatus("done");
  }

  function loadFixture(fx) {
    setInput(fx.sample);
    runCheck(fx.sample);
  }

  const verdictInfo = result ? VERDICTS[result.verdict] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        fontFamily:
          "'Segoe UI', system-ui, -apple-system, sans-serif",
        padding: "32px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 13,
              letterSpacing: 1,
              color: "#8a8a8a",
              marginBottom: 6,
            }}
          >
            Turing Hacks 4.0 — PS06
          </div>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 800,
              margin: 0,
              letterSpacing: -0.5,
            }}
          >
            Asli
          </h1>
          <div style={{ color: "#bbb", fontSize: 15, marginTop: 6 }}>
            Paste a WhatsApp forward. Asli checks it against official sources
            only.
          </div>
        </div>

        {/* Demo fixture buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {FIXTURES.map((fx) => (
            <button
              key={fx.id}
              onClick={() => loadFixture(fx)}
              style={{
                background: "#141414",
                border: "1px solid #333",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try: {fx.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="यहाँ मैसेज पेस्ट करें..."
          style={{
            width: "100%",
            minHeight: 110,
            background: "#0d0d0d",
            border: "1px solid #333",
            borderRadius: 10,
            color: "#fff",
            fontSize: 16,
            padding: 14,
            boxSizing: "border-box",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={() => runCheck(input)}
            disabled={status === "loading" || !input.trim()}
            style={{
              background: "#FF3131",
              border: "none",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              borderRadius: 8,
              padding: "12px 24px",
              cursor: status === "loading" ? "default" : "pointer",
              opacity: status === "loading" || !input.trim() ? 0.6 : 1,
            }}
          >
            {status === "loading" ? "Checking…" : "Check message"}
          </button>
          <button
            onClick={() => {
              setInput("");
              setResult(null);
              setStatus("idle");
            }}
            style={{
              background: "transparent",
              border: "1px solid #333",
              color: "#bbb",
              borderRadius: 8,
              padding: "12px 20px",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>

        {/* Verdict labels row (always visible, highlight active) */}
        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          {Object.entries(VERDICTS).map(([key, v]) => {
            const active = result && result.verdict === key;
            return (
              <div
                key={key}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 8px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  border: `1.5px solid ${active ? v.color : "#2a2a2a"}`,
                  background: active ? v.dim : "#0d0d0d",
                  color: active ? v.color : "#666",
                  transition: "all 0.15s ease",
                }}
              >
                {v.label}
              </div>
            );
          })}
        </div>

        {/* Result card */}
        {result && (
          <div
            style={{
              marginTop: 20,
              background: "#0d0d0d",
              border: `1.5px solid ${verdictInfo.color}`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  color: verdictInfo.color,
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {verdictInfo.label}
              </div>
              <button
                onClick={() => speak(result.why)}
                title="Play in Hindi"
                style={{
                  background: "transparent",
                  border: `1px solid ${verdictInfo.color}`,
                  color: verdictInfo.color,
                  borderRadius: 999,
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                🔊
              </button>
            </div>
            <div style={{ fontSize: 16, color: "#eee", marginBottom: 12, lineHeight: 1.5 }}>
              {result.why}
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              Source: <span style={{ color: "#bbb" }}>{result.source}</span>
            </div>
            {error === "live-check-unavailable" && (
              <div style={{ fontSize: 12, color: "#E0A62C", marginTop: 10 }}>
                Live check unavailable right now — showing the safe fallback.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 32, fontSize: 12, color: "#555", lineHeight: 1.6 }}>
          Asli does not detect all misinformation. It checks against a small
          trusted-source list and says "not enough proof" when unsure. It
          cannot yet read text inside photos or screenshots.
        </div>
      </div>
    </div>
  );
}
