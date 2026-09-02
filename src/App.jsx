import { useState, useRef, useEffect } from "react";

// ---------- Locked demo fixtures (Devanagari) — the judged path, cannot fail ----------
// keywords / verdict / why / source / tts are UNCHANGED from the original build.
const CORE_FIXTURES = [
  {
    id: "camp",
    label: "Camp",
    chip: "शिविर",
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
    chip: "OTP",
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
    chip: "राशन",
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

// ---------- Person A's 7-message test library — UNCHANGED (dev-only) ----------
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

// ---------- NEW: generic offline scam-pattern layer ----------
// Purpose: give a real answer for CUSTOM messages that don't match any known
// fixture, without any network call. This layer can ONLY ever return "false"
// (a recognized scam red flag) — it must never invent "verified", since we
// have no real source backing an arbitrary new claim. Anything that doesn't
// trip a red flag still falls through to the existing "unsure" fallback.
const SCAM_PATTERNS = [
  {
    id: "otp_pin_request",
    test: (t) =>
      ["otp", "ओटीपी", "pin", "पिन", "cvv", "सीवीवी"].some((k) => t.includes(k)),
    why: "बैंक या सरकार कभी भी OTP, पिन या CVV शेयर करने को नहीं कहता। यह एक जाना-पहचाना धोखा पैटर्न है।",
    source: "RBI सलाह — सामान्य धोखा पैटर्न",
  },
  {
    id: "kyc_link_urgency",
    test: (t) =>
      ["account block", "khata block", "खाता बंद", "account suspend", "kyc expire", "kyc update", "kyc band"].some((k) => t.includes(k)) &&
      ["link", "लिंक", "click here", "यहाँ क्लिक"].some((k) => t.includes(k)),
    why: "असली बैंक कभी लिंक भेजकर तुरंत KYC या खाता अपडेट करने को नहीं कहता।",
    source: "RBI / SBI सलाह — सामान्य धोखा पैटर्न",
  },
  {
    id: "advance_fee",
    test: (t) =>
      ["processing fee", "प्रोसेसिंग फीस", "registration fee", "पंजीकरण शुल्क", "advance fee"].some((k) => t.includes(k)) &&
      ["loan", "लोन", "lottery", "लॉटरी", "prize", "इनाम", "reward"].some((k) => t.includes(k)),
    why: "असली लोन, इनाम या लॉटरी देने से पहले कभी शुल्क नहीं माँगा जाता।",
    source: "RBI सलाह — सामान्य धोखा पैटर्न",
  },
  {
    id: "prize_claim",
    test: (t) =>
      ["you have won", "aap jeet gaye", "जीत गए है", "lucky winner", "लकी विनर", "congratulations you"].some((k) => t.includes(k)),
    why: "बिना किसी प्रतियोगिता में भाग लिए इनाम जीतने का दावा अक्सर धोखा होता है।",
    source: "सामान्य धोखा पैटर्न",
  },
  {
    id: "double_money",
    test: (t) =>
      ["double paisa", "पैसा डबल", "guaranteed return", "गारंटीड रिटर्न", "double your money", "paisa double"].some((k) => t.includes(k)),
    why: "कोई भी असली निवेश पैसा डबल करने की गारंटी नहीं देता। यह निवेश धोखा है।",
    source: "सामान्य धोखा पैटर्न",
  },
];

function detectGenericScam(text) {
  const t = normalize(text);
  return SCAM_PATTERNS.find((p) => p.test(t)) || null;
}

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
const SCAM_TTS = "Saavdhaan! Yeh jaankari galat hai. Kripya ise aage share na karein.";
const NO_SOURCE_LABEL = "आधिकारिक लिस्ट में यह दावा नहीं मिला";

function normalize(s) {
  return s.toLowerCase();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// matching logic — scoring/threshold UNCHANGED. Also returns which keywords were
// actually found, purely so the grey message bubble can highlight them.
function matchFixture(text) {
  const t = normalize(text);
  let best = null;
  let bestScore = 0;
  let bestMatchedKeywords = [];
  for (const fx of ALL_FIXTURES) {
    if (fx.excludeIfAny && fx.excludeIfAny.some((ex) => t.includes(normalize(ex)))) continue;
    let score = 0;
    const foundKeywords = [];
    for (const kw of fx.keywords) {
      if (t.includes(normalize(kw))) {
        score++;
        foundKeywords.push(kw);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = fx;
      bestMatchedKeywords = foundKeywords;
    }
  }
  if (bestScore < 1) return null;
  return { fixture: best, matchedKeywords: bestMatchedKeywords };
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

function highlightMatches(text, keywords) {
  if (!keywords || keywords.length === 0) return text;
  const sorted = [...keywords].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`(${sorted.join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const isMatch = keywords.some((kw) => normalize(part) === normalize(kw));
    return isMatch ? (
      <mark
        key={i}
        style={{ background: "#3A2C0C", color: "#F2C14E", padding: "1px 3px", borderRadius: 4, fontWeight: 700 }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

async function copyFamilySummary(result) {
  const lines = [
    `असली जाँच: ${VERDICTS[result.verdict].label}`,
    result.why,
    `स्रोत: ${result.source}`,
  ];
  const text = lines.join("\n");
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

export default function Asli() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [showDevLibrary, setShowDevLibrary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [autoPlayTick, setAutoPlayTick] = useState(0);
  const recognitionRef = useRef(null);
  const resultRef = useRef(null);

  const devMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("dev") === "1";

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // auto-scroll + auto-speak once, only for demo-chip taps
  useEffect(() => {
    if (result && autoPlayTick > 0) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      speak(result.tts || result.why);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayTick]);

  // judge path — no network call. Fixture match, generic scam-pattern match, or
  // safe "unsure" fallback. Never invents "verified". Cannot crash.
  function runCheck(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatus("checking");
    setResult(null);
    setCopied(false);

    if (looksLikeScreenshotOnly(trimmed)) {
      setResult({
        id: "screenshot",
        verdict: "unsure",
        why: SCREENSHOT_WHY,
        source: NO_SOURCE_LABEL,
        tts: GENERIC_TTS,
        evidence: null,
        matched: false,
        genericScam: false,
        originalText: trimmed,
        matchedKeywords: [],
      });
      setStatus("done");
      return;
    }

    const matchResult = matchFixture(trimmed);
    if (matchResult) {
      const { fixture, matchedKeywords } = matchResult;
      setResult({
        id: fixture.id,
        verdict: fixture.verdict,
        why: fixture.why,
        source: fixture.source,
        tts: fixture.tts,
        evidence: fixture.evidence || null,
        matched: true,
        genericScam: false,
        originalText: trimmed,
        matchedKeywords,
      });
      setStatus("done");
      return;
    }

    // no exact fixture — check generic offline scam red flags before giving up
    const scamHit = detectGenericScam(trimmed);
    if (scamHit) {
      setResult({
        id: `scam-${scamHit.id}`,
        verdict: "false",
        why: scamHit.why,
        source: scamHit.source,
        tts: SCAM_TTS,
        evidence: null,
        matched: false,
        genericScam: true,
        originalText: trimmed,
        matchedKeywords: [],
      });
      setStatus("done");
      return;
    }

    setResult({
      id: "unmatched",
      verdict: "unsure",
      why: NO_MATCH_WHY,
      source: NO_SOURCE_LABEL,
      tts: GENERIC_TTS,
      evidence: null,
      matched: false,
      genericScam: false,
      originalText: trimmed,
      matchedKeywords: [],
    });
    setStatus("done");
  }

  function tapChip(fx) {
    setInput(fx.sample);
    runCheck(fx.sample);
    setAutoPlayTick((t) => t + 1);
  }

  function loadDevFixture(fx) {
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

  async function handleCopy() {
    const ok = await copyFamilySummary(result);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  const voiceSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const verdictInfo = result ? VERDICTS[result.verdict] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050505",
        display: "flex",
        justifyContent: "center",
        padding: "28px 12px",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      <style>{`
        @keyframes asliFadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        textarea::placeholder { color: #6b6b6b; }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 390,
          background: "#000",
          color: "#fff",
          border: "1px solid #1e1e1e",
          borderRadius: 28,
          boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
          padding: "20px 16px 26px",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {devMode && (
          <button
            onClick={() => setShowDevLibrary((s) => !s)}
            style={{
              position: "absolute", top: 12, right: 14, background: "transparent",
              border: "none", color: "#3a3a3a", fontSize: 11, cursor: "pointer", padding: 4,
            }}
          >
            dev
          </button>
        )}

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            असली
          </h1>
          <div style={{ color: "#9a9a9a", fontSize: 14, marginTop: 4, lineHeight: 1.4 }}>
            फ़ॉरवर्ड आया। असली जाँचता है।
          </div>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
              color: isOnline ? "#7a7a7a" : "#7fd99a",
              background: isOnline ? "#121212" : "#0f2417",
              border: `1px solid ${isOnline ? "#262626" : "#1f4a2c"}`,
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: isOnline ? "#5a5a5a" : "#3ddc6f", display: "inline-block",
              }}
            />
            {isOnline ? "ऑनलाइन" : "ऑफ़लाइन मोड"}
          </div>
        </div>

        {/* Demo chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {CORE_FIXTURES.map((fx) => (
            <button
              key={fx.id}
              onClick={() => tapChip(fx)}
              style={{
                flex: 1, background: "#141414", border: "1px solid #2a2a2a", color: "#fff",
                borderRadius: 999, padding: "10px 8px", fontSize: 14.5, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {fx.chip}
            </button>
          ))}
        </div>

        {devMode && showDevLibrary && (
          <div
            style={{
              display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14,
              padding: 12, background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 10,
            }}
          >
            <div style={{ width: "100%", fontSize: 11, color: "#666", marginBottom: 2 }}>
              Dev test library ({TEST_LIBRARY.length})
            </div>
            {TEST_LIBRARY.map((fx) => {
              const v = VERDICTS[fx.verdict];
              return (
                <button
                  key={fx.id}
                  onClick={() => loadDevFixture(fx)}
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

        {!result && (
          <div style={{ fontSize: 13.5, color: "#777", textAlign: "center", margin: "6px 0 16px", lineHeight: 1.6 }}>
            तीन उदाहरण ऊपर हैं। या मैसेज पेस्ट करें।
          </div>
        )}

        {/* Compose box */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="व्हाट्सऐप वाला मैसेज यहाँ पेस्ट करें"
          rows={3}
          style={{
            width: "100%", background: "#141414", border: "1px solid #2a2a2a",
            borderRadius: 20, color: "#fff", fontSize: 16, padding: "14px 16px",
            boxSizing: "border-box", resize: "none", fontFamily: "inherit",
          }}
        />

        {voiceSupported && (
          <button
            onClick={startListening}
            disabled={isListening}
            style={{
              width: "100%", marginTop: 10,
              background: isListening ? "#1a1a0d" : "#141414",
              border: `1px solid ${isListening ? "#E0A62C" : "#2a2a2a"}`,
              color: isListening ? "#E0A62C" : "#fff", fontWeight: 600, fontSize: 15,
              borderRadius: 14, padding: "12px 16px",
              cursor: isListening ? "default" : "pointer",
            }}
          >
            {isListening ? "🎙️ सुन रहा हूँ..." : "🎤 बोलकर बताएँ"}
          </button>
        )}

        <button
          onClick={() => runCheck(input)}
          disabled={status === "checking" || !input.trim()}
          style={{
            width: "100%", marginTop: 10, background: "#FF3131", border: "none", color: "#fff",
            fontWeight: 700, fontSize: 17, borderRadius: 14, padding: "15px 20px",
            cursor: status === "checking" ? "default" : "pointer",
            opacity: status === "checking" || !input.trim() ? 0.6 : 1,
          }}
        >
          {status === "checking" ? "जाँच रहे हैं…" : "जाँचें"}
        </button>

        {(input || result) && (
          <button
            onClick={() => { setInput(""); setResult(null); setStatus("idle"); }}
            style={{
              width: "100%", marginTop: 8, background: "transparent", border: "none",
              color: "#666", fontSize: 13, cursor: "pointer", padding: "6px",
            }}
          >
            मिटाएँ
          </button>
        )}

        {/* Result — the hero */}
        {result && (
          <div
            ref={resultRef}
            style={{ marginTop: 22, animation: "asliFadeSlideIn 200ms ease-out" }}
          >
            <div
              style={{
                textAlign: "center", fontSize: 26, fontWeight: 800,
                color: verdictInfo.color, marginBottom: 14,
              }}
            >
              {verdictInfo.label}
            </div>

            {/* incoming message bubble */}
            <div
              style={{
                background: "#1f1f1f", color: "#eee", borderRadius: "16px 16px 16px 4px",
                padding: "12px 14px", fontSize: 15.5, lineHeight: 1.6, marginBottom: 10,
                maxWidth: "92%",
              }}
            >
              {highlightMatches(result.originalText, result.matchedKeywords)}
            </div>

            {/* Asli's reply bubble */}
            <div
              style={{
                background: "#0f2b22", color: "#e6f5ee", borderRadius: "16px 16px 4px 16px",
                padding: "14px 16px", fontSize: 15.5, lineHeight: 1.65,
                marginLeft: "8%", marginBottom: 12,
              }}
            >
              <div style={{ marginBottom: result.evidence ? 8 : 0 }}>
                <b>क्यों:</b> {result.why}
              </div>
              <div style={{ fontSize: 13, color: "#a9c9bd", marginBottom: result.evidence ? 6 : 0 }}>
                स्रोत: {result.source}
              </div>
              {result.evidence && (
                <div style={{ fontSize: 13, color: "#a9c9bd" }}>{result.evidence}</div>
              )}
            </div>

            {result.matched && (
              <div
                style={{
                  display: "inline-block", fontSize: 11.5, fontWeight: 600,
                  color: "#7fd99a", background: "#0f2417", border: "1px solid #1f4a2c",
                  borderRadius: 999, padding: "5px 12px", marginBottom: 14,
                }}
              >
                सेव की गई आधिकारिक लिस्ट से जाँचा
              </div>
            )}

            {result.genericScam && (
              <div
                style={{
                  display: "inline-block", fontSize: 11.5, fontWeight: 600,
                  color: "#f2a65a", background: "#2a1a0d", border: "1px solid #4a2f1f",
                  borderRadius: 999, padding: "5px 12px", marginBottom: 14,
                }}
              >
                सामान्य धोखा पैटर्न से मेल खाया
              </div>
            )}

            {result.verdict === "unsure" && (
              <div style={{ fontSize: 13, color: "#888", marginBottom: 14, fontStyle: "italic" }}>
                अनुमान नहीं लगा रहे।
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => speak(result.tts || result.why)}
                style={{
                  flex: 1, background: "#141414", border: "1px solid #2a2a2a", color: "#fff",
                  borderRadius: 12, padding: "12px 10px", fontSize: 14, cursor: "pointer",
                }}
              >
                🔊 सुनें
              </button>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1, background: "#141414", border: "1px solid #2a2a2a",
                  color: copied ? "#7fd99a" : "#fff",
                  borderRadius: 12, padding: "12px 10px", fontSize: 14, cursor: "pointer",
                }}
              >
                {copied ? "✓ कॉपी हो गया" : "परिवार को भेजें"}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 26, fontSize: 11, color: "#4d4d4d", lineHeight: 1.6 }}>
          असली सभी गलत जानकारी नहीं पकड़ सकता। यह एक छोटी आधिकारिक स्रोत सूची और सामान्य धोखा
          पैटर्न से जाँचता है, और अनिश्चित होने पर "पर्याप्त सबूत नहीं" कहता है। यह अभी
          फोटो/स्क्रीनशॉट में लिखा टेक्स्ट नहीं पढ़ सकता।
        </div>
      </div>
    </div>
  );
}
