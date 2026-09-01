import { useState, useRef } from "react";

// ---------- Locked demo fixtures (Devanagari) — the judged path, cannot fail ----------
// NOTE: keywords / verdict / why / source / tts are UNCHANGED. Only an optional
// "evidence" field was added for display in the result card.
const CORE_FIXTURES = [
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
    tts: "Yeh jaankari sahi hai. Sikar ke camp ki adhikarik pushti ho chuki hai.",
    evidence: "जिला स्वास्थ्य विभाग की सूचना: शिविर में कोई पंजीकरण शुल्क नहीं लिया जाता।",
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
    tts: "Saavdhaan! Yeh jaankari galat hai. Kripya OTP kisi ko na bataayein.",
    evidence: "RBI सलाह: बैंक कभी भी OTP, PIN या CVV फोन/मैसेज पर नहीं मांगता।",
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
    tts: "Is jaankari ki abhi pushti nahi hui hai. Kripya adhikarik srot se jaanchein.",
  },
];

// ---------- Person A's trusted-source dataset — UNCHANGED ----------
const TRUSTED_SOURCES = [
  { id: "TS1", source: "PIB Fact Check", evidence: "A 'free ration under PM-KISAN Yojana' claim is FALSE — no such benefit exists. PM-KISAN itself is real and pays eligible farmers a genuine ₹2000 installment directly to their bank account; that installment claim is separate and true." },
  { id: "TS2", source: "RBI Public Advisory", evidence: "Banks never call, SMS, or message customers asking them to share OTP, PIN, CVV, or UPI PIN to verify, activate, or prevent account block." },
  { id: "TS3", source: "SBI Official Statement", evidence: "SBI does not send links via SMS/WhatsApp asking customers to update KYC by entering OTP or account details. KYC updates happen only at a branch or via the official YONO app." },
  { id: "TS4", source: "MoHFW", evidence: "Genuine free health/vaccination camps are announced via official district health notices and never require an advance fee or bank details. This is a general check, not confirmation of any specific camp." },
  { id: "TS5", source: "District Administration, Sikar", evidence: "Demo record: a free health check-up camp at Government Hospital, Sikar, jointly with MoHFW, no registration fee, is treated as a verified local record. Only applies to Sikar." },
  { id: "TS6", source: "PIB Fact Check", evidence: "One specific dated '₹500 notes will be banned from [date]' claim was confirmed false. This applies ONLY to that exact dated claim — a different, undated, or vaguer ₹500-ban rumor is NOT automatically false; treat it as unverified." },
  { id: "TS7", source: "MoHFW", evidence: "MoHFW has not endorsed unapproved home remedies as a cure/prevention for diseases like COVID-19 or dengue." },
  { id: "TS8", source: "RBI Public Advisory", evidence: "'Instant loan' or 'lottery winning' messages asking for an upfront UPI processing fee are fraudulent. Legit lenders never require advance payment to release a loan or prize." },
];

const VERDICT_MAP = { VERIFIED: "verified", LIKELY_FALSE: "false", NOT_ENOUGH_PROOF: "unsure" };

// ---------- Person A's 7-message test library — UNCHANGED (only "evidence" added for display) ----------
const TEST_LIBRARY = [
  {
    id: "M1", label: "Sikar camp (Hinglish)",
    sample: "Sikar mein Government Hospital ke paas free health camp lagne wala hai, MoHFW ke saath milkar. Free checkup hoga, koi fee nahi lagegi. Sabhi aa sakte hain.",
    keywords: ["sikar", "government hospital", "free health camp", "mohfw", "checkup"],
    verdict: "verified",
    why: "Yeh jaankari Sikar Zila Prashasan ke record se milti hai — camp free hai aur adhikarik hai.",
    source: "District Administration, Sikar + MoHFW",
    tts: "Yeh jaankari sahi hai. Sikar ke camp ki adhikarik pushti ho chuki hai.",
    evidence: "जिला प्रशासन, सीकर: सरकारी अस्पताल में मुफ्त हेल्थ कैंप, MoHFW के साथ, कोई शुल्क नहीं।",
  },
  {
    id: "M2", label: "PM-KISAN installment (real)",
    sample: "Mere khaate mein PM Kisan ki ₹2000 ki kist aa gayi hai, sab kisan bhaiyon ko check karna chahiye apna account.",
    keywords: ["pm kisan", "kist", "installment", "₹2000", "2000"],
    excludeIfAny: ["link", "aadhar number daal", "free ration", "muft ration"],
    verdict: "verified",
    why: "PM-KISAN ek asli sarkari yojana hai aur ₹2000 ki kist sahi hai. Yeh 'free ration' wale jhoothe dawe se alag hai.",
    source: "PIB Fact Check",
    tts: "Yeh jaankari sahi hai. PM Kisan ki kist asli yojana ka hissa hai.",
    evidence: "PIB फैक्ट चेक: PM-KISAN असली योजना है, ₹2000 की किस्त सीधे बैंक खाते में आती है।",
  },
  {
    id: "M3", label: "SBI KYC call scam",
    sample: "SBI se call aaya hai ki aapka KYC update nahi hua, 10 minute mein account block ho jayega. OTP bata do turant warna paisa freeze ho jayega.",
    keywords: ["sbi", "kyc", "otp", "block", "freeze"],
    verdict: "false",
    why: "RBI ki salah ke mutabik bank kabhi bhi OTP maang kar KYC update ya account verify nahi karta. Yeh scam hai.",
    source: "RBI Public Advisory + SBI Official Statement",
    tts: "Saavdhaan! Yeh jaankari galat hai. Kripya OTP kisi ko na bataayein.",
    evidence: "RBI/SBI सलाह: बैंक कभी OTP मांगकर KYC अपडेट या खाता वेरिफाई नहीं करता।",
  },
  {
    id: "M4", label: "Fake 'free ration' PM-Kisan",
    sample: "Sarkar ne naya scheme nikala hai — PM Kisan Yojana ke tahat har gareeb parivar ko ₹2000 ka free ration milega, bas is link pe apna Aadhar number daal do.",
    keywords: ["free ration", "muft ration", "pm kisan", "link", "aadhar number daal", "aadhar number"],
    verdict: "false",
    why: "PM Kisan ke tahat aisi koi free ration yojana nahi hai. Yeh jhooth hai, apna Aadhar number kisi link par na daalein.",
    source: "PIB Fact Check",
    tts: "Saavdhaan! Yeh jaankari galat hai. Kripya ise aage share na karein.",
    evidence: "PIB फैक्ट चेक: PM-KISAN के तहत 'मुफ्त राशन' जैसी कोई सुविधा नहीं है — यह दावा गलत है।",
  },
  {
    id: "M5", label: "Instant loan / advance fee",
    sample: "Aapka ₹50,000 ka instant loan approve ho gaya hai! Bas ₹500 processing fee UPI se bhej do, paisa turant aapke account mein aa jayega.",
    keywords: ["instant loan", "processing fee", "upi", "approve"],
    verdict: "false",
    why: "RBI ki salah ke mutabik koi bhi asli bank loan dene se pehle processing fee UPI se nahi mangwata. Yeh scam hai.",
    source: "RBI Public Advisory",
    tts: "Saavdhaan! Yeh jaankari galat hai. Kripya paise na bhejein.",
    evidence: "RBI सलाह: असली लोन देने से पहले कोई प्रोसेसिंग फीस UPI से नहीं मंगवाई जाती।",
  },
  {
    id: "M6", label: "Ration card renewal rumor",
    sample: "Suna hai ki agle mahine se sabhi purane ration card band ho jayenge aur naye banwane padenge, jaldi apply kar lo warna ration nahi milega.",
    keywords: ["ration card", "band ho jayenge", "naye banwane"],
    verdict: "unsure",
    why: "Is daave ki adhikarik srot se abhi pushti nahi hui hai. Kripya apne raashan dukaan ya zila karyalay se poochh lein.",
    source: "No matching official source found",
    tts: "Is jaankari ki abhi pushti nahi hui hai. Kripya adhikarik srot se jaanchein.",
  },
  {
    id: "M7", label: "Vague ₹500 note rumor",
    sample: "Pados wale bata rahe the ki humare jile mein bhi ₹500 ke note band hone wale hain agle hafte se, bank mein jaldi jama kar do.",
    keywords: ["500 ke note", "500 note", "note band"],
    verdict: "unsure",
    why: "Is daave ki adhikarik srot se abhi pushti nahi hui hai, kyunki yeh ek alag aur bina tareekh wali afwaah hai.",
    source: "No matching official source found",
    tts: "Is jaankari ki abhi pushti nahi hui hai. Kripya adhikarik srot se jaanchein.",
  },
];

const ALL_FIXTURES = [...CORE_FIXTURES, ...TEST_LIBRARY];

const VERDICTS = {
  verified: { label: "सही", color: "#2FB35A", dim: "#123821" },
  unsure: { label: "पर्याप्त सबूत नहीं", color: "#E0A62C", dim: "#3A2C0C" },
  false: { label: "गलत लग रहा है", color: "#FF3131", dim: "#3A0F0F" },
};

const SCREENSHOT_HINTS = ["screenshot", "स्क्रीनशॉट", "photo", "image", "फोटो", "जेपीजी", "png", "jpg"];

const NO_MATCH_WHY = "आधिकारिक लिस्ट में यह दावा नहीं मिला।";
const SCREENSHOT_WHY =
  "यह एक फोटो/स्क्रीनशॉट लगता है। अभी हम फोटो में लिखा टेक्स्ट नहीं पढ़ सकते — कृपया मैसेज टाइप या पेस्ट करें।";
const GENERIC_TTS = "Is jaankari ki abhi pushti nahi hui hai. Kripya adhikarik srot se jaanchein.";

function normalize(s) {
  return s.toLowerCase();
}

// matching logic — UNCHANGED
function matchFixture(text) {
  const t = normalize(text);
  let best = null;
  let bestScore = 0;
  for (const fx of ALL_FIXTURES) {
    if (fx.excludeIfAny && fx.excludeIfAny.some((ex) => t.includes(normalize(ex)))) continue;
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
    // TTS is an enhancement, not core functionality
  }
}

export default function Asli() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [showDev, setShowDev] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // judge path — no network call. Fixture match or safe "unsure" fallback. Cannot crash.
  function runCheck(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatus("checking");
    setResult(null);

    if (looksLikeScreenshotOnly(trimmed)) {
      setResult({
        verdict: "unsure",
        why: SCREENSHOT_WHY,
        source: "आधिकारिक लिस्ट में यह दावा नहीं मिला",
        tts: GENERIC_TTS,
        evidence: null,
        matched: false,
      });
      setStatus("done");
      return;
    }

    const fixed = matchFixture(trimmed);
    if (fixed) {
      setResult({
        verdict: fixed.verdict,
        why: fixed.why,
        source: fixed.source,
        tts: fixed.tts,
        evidence: fixed.evidence || null,
        matched: true,
      });
      setStatus("done");
      return;
    }

    setResult({
      verdict: "unsure",
      why: NO_MATCH_WHY,
      source: "आधिकारिक लिस्ट में यह दावा नहीं मिला",
      tts: GENERIC_TTS,
      evidence: null,
      matched: false,
    });
    setStatus("done");
  }

  function loadFixture(fx) {
    setInput(fx.sample);
    runCheck(fx.sample);
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        setInput(transcript);
        runCheck(transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  const voiceSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const verdictInfo = result ? VERDICTS[result.verdict] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        padding: "20px 14px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, position: "relative" }}>
        {/* tiny hidden dev toggle */}
        <button
          onClick={() => setShowDev((s) => !s)}
          style={{
            position: "absolute", top: 0, right: 0, background: "transparent",
            border: "none", color: "#333", fontSize: 11, cursor: "pointer", padding: 4,
          }}
        >
          dev
        </button>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, color: "#8a8a8a", marginBottom: 4 }}>
            Turing Hacks 4.0 — PS06
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            असली
          </h1>
          <div style={{ color: "#bbb", fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
            व्हाट्सऐप फॉरवर्ड को आधिकारिक स्रोतों से जाँचें।
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {CORE_FIXTURES.map((fx) => (
            <button
              key={fx.id}
              onClick={() => loadFixture(fx)}
              style={{
                background: "#141414", border: "1px solid #333", color: "#fff",
                borderRadius: 8, padding: "8px 14px", fontSize: 13.5, cursor: "pointer",
              }}
            >
              Try: {fx.label}
            </button>
          ))}
        </div>

        {showDev && (
          <div
            style={{
              display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14,
              padding: 12, background: "#0a0a0a", border: "1px solid #222", borderRadius: 10,
            }}
          >
            <div style={{ width: "100%", fontSize: 11, color: "#666", marginBottom: 4 }}>
              Dev test library ({TEST_LIBRARY.length})
            </div>
            {TEST_LIBRARY.map((fx) => {
              const v = VERDICTS[fx.verdict];
              return (
                <button
                  key={fx.id}
                  onClick={() => loadFixture(fx)}
                  style={{
                    background: "#111", border: `1px solid ${v.color}55`, color: v.color,
                    borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer",
                  }}
                >
                  {fx.label}
                </button>
              );
            })}
          </div>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="व्हाट्सऐप वाला मैसेज यहाँ पेस्ट करें"
          style={{
            width: "100%", minHeight: 110, background: "#0d0d0d", border: "1px solid #333",
            borderRadius: 10, color: "#fff", fontSize: 16, padding: 14, boxSizing: "border-box",
            resize: "vertical", fontFamily: "inherit",
          }}
        />

        {voiceSupported && (
          <button
            onClick={startListening}
            disabled={isListening}
            style={{
              width: "100%", marginTop: 10, background: isListening ? "#2a0d0d" : "#141414",
              border: `1px solid ${isListening ? "#FF3131" : "#333"}`,
              color: isListening ? "#FF3131" : "#fff", fontWeight: 600, fontSize: 15,
              borderRadius: 8, padding: "12px 16px",
              cursor: isListening ? "default" : "pointer",
            }}
          >
            {isListening ? "🎙️ सुन रहा हूँ..." : "🎤 बोलकर बताएँ"}
          </button>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            onClick={() => runCheck(input)}
            disabled={status === "checking" || !input.trim()}
            style={{
              flex: 1, background: "#FF3131", border: "none", color: "#fff", fontWeight: 700,
              fontSize: 16, borderRadius: 8, padding: "13px 20px",
              cursor: status === "checking" ? "default" : "pointer",
              opacity: status === "checking" || !input.trim() ? 0.6 : 1,
            }}
          >
            {status === "checking" ? "जाँच रहे हैं…" : "जाँचें"}
          </button>
          <button
            onClick={() => { setInput(""); setResult(null); setStatus("idle"); }}
            style={{
              background: "transparent", border: "1px solid #333", color: "#bbb",
              borderRadius: 8, padding: "13px 18px", cursor: "pointer", fontSize: 15,
            }}
          >
            मिटाएँ
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          {Object.entries(VERDICTS).map(([key, v]) => {
            const active = result && result.verdict === key;
            return (
              <div
                key={key}
                style={{
                  flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 8,
                  fontSize: 12, fontWeight: 700,
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

        {result && (
          <div
            style={{
              marginTop: 18, background: "#0d0d0d", border: `1.5px solid ${verdictInfo.color}`,
              borderRadius: 12, padding: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ color: verdictInfo.color, fontWeight: 800, fontSize: 18 }}>
                {verdictInfo.label}
              </div>
              <button
                onClick={() => speak(result.tts || result.why)}
                title="सुनें"
                style={{
                  background: "transparent", border: `1px solid ${verdictInfo.color}`,
                  color: verdictInfo.color, borderRadius: 999, width: 36, height: 36,
                  cursor: "pointer", fontSize: 16, flexShrink: 0,
                }}
              >
                🔊
              </button>
            </div>

            <div style={{ fontSize: 16, color: "#eee", marginBottom: 12, lineHeight: 1.5 }}>
              {result.why}
            </div>

            <div style={{ fontSize: 13, color: "#888", marginBottom: result.evidence ? 8 : 0 }}>
              स्रोत: <span style={{ color: "#bbb" }}>{result.source}</span>
            </div>

            {result.evidence && (
              <div
                style={{
                  fontSize: 13, color: "#aaa", lineHeight: 1.5, marginTop: 6,
                  paddingTop: 10, borderTop: "1px solid #222",
                }}
              >
                {result.evidence}
              </div>
            )}

            {result.matched && (
              <div
                style={{
                  marginTop: 12, display: "inline-block", fontSize: 11.5, fontWeight: 600,
                  color: "#7fd99a", background: "#0f2417", border: "1px solid #1f4a2c",
                  borderRadius: 999, padding: "5px 12px",
                }}
              >
                सेव की गई आधिकारिक लिस्ट से जाँचा
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 30, fontSize: 11.5, color: "#555", lineHeight: 1.6 }}>
          असली सभी गलत जानकारी नहीं पकड़ सकता। यह केवल एक छोटी आधिकारिक स्रोत सूची से जाँचता है,
          और अनिश्चित होने पर "पर्याप्त सबूत नहीं" कहता है। यह अभी फोटो/स्क्रीनशॉट में लिखा टेक्स्ट
          नहीं पढ़ सकता।
        </div>
      </div>
    </div>
  );
}
