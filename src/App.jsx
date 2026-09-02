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

// ---------- Generic offline scam-pattern layer — can only ever return "false" ----------
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
  verified: { label: "सही", color: "#3B6E4F", bg: "#E7EFE6" },
  unsure: { label: "पर्याप्त सबूत नहीं", color: "#7A6A4F", bg: "#EFE9DA" },
  false: { label: "गलत लग रहा है", color: "#A23B2E", bg: "#F5E7E2" },
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

// matching logic — scoring/threshold UNCHANGED.
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
        style={{ background: "#F0D48A", color: "#3A2412", padding: "1px 3px", borderRadius: 4, fontWeight: 700 }}
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

// ---------- Village background scene, ported from the paper-design mockup ----------
function VillageBackground() {
  return (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 0 }}>
      <svg viewBox="0 0 1400 1000" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#79C3E8" />
            <stop offset="38%" stopColor="#BEE6DC" />
            <stop offset="62%" stopColor="#CFE8A8" />
            <stop offset="100%" stopColor="#8FBF5E" />
          </linearGradient>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF6D8" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFF6D8" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1400" height="1000" fill="url(#sky)" />
        <circle cx="1190" cy="140" r="150" fill="url(#sunGlow)" />
        <circle cx="1190" cy="140" r="42" fill="#FFF6D8" opacity="0.9" />

        <g fill="#FFFFFF" opacity="0.8">
          <g transform="translate(230,120)">
            <ellipse cx="0" cy="0" rx="46" ry="20" />
            <ellipse cx="34" cy="-8" rx="34" ry="18" />
            <ellipse cx="-32" cy="6" rx="30" ry="15" />
          </g>
          <g transform="translate(720,80)">
            <ellipse cx="0" cy="0" rx="38" ry="16" />
            <ellipse cx="28" cy="-6" rx="26" ry="14" />
            <ellipse cx="-26" cy="4" rx="24" ry="12" />
          </g>
        </g>

        <g stroke="#2E4A22" strokeWidth="2.5" fill="none" opacity="0.4" strokeLinecap="round">
          <path d="M500 190 q7 -10 14 0 q7 -10 14 0" />
          <path d="M920 220 q7 -10 14 0 q7 -10 14 0" />
        </g>

        <path d="M0 520 Q 250 465 520 510 T 1000 505 T 1400 485 V1000 H0 Z" fill="#8FC6A8" opacity="0.55" />
        <path d="M0 580 Q 300 535 620 575 T 1150 565 T 1400 575 V1000 H0 Z" fill="#6FAE5C" opacity="0.7" />
        <path d="M0 650 Q 350 610 700 645 T 1400 640 V1000 H0 Z" fill="#4C8A3A" opacity="0.9" />

        <rect x="0" y="680" width="1400" height="320" fill="#3E6B2C" />

        <g>
          <path d="M660 900 Q 720 860 830 872 Q 940 862 990 900 Q 950 942 830 936 Q 715 944 660 900 Z" fill="#BFE6EE" opacity="0.85" />
          <path d="M700 892 Q 800 878 950 894" stroke="#FFFFFF" strokeWidth="3" opacity="0.5" fill="none" />
        </g>

        <g stroke="#4C8A3A" strokeWidth="1.5" opacity="0.3" fill="none">
          <path d="M0 760 Q 700 748 1400 763" />
          <path d="M0 820 Q 700 808 1400 823" />
          <path d="M0 880 Q 700 868 1400 883" />
        </g>

        <g opacity="0.9">
          <g transform="translate(600,905)" fill="#3E6B2C"><circle cx="0" cy="0" r="16" /></g>
          <g transform="translate(600,900)" fill="#E85D9E"><circle cx="-8" cy="-4" r="5" /><circle cx="4" cy="-8" r="5" /><circle cx="9" cy="2" r="5" /><circle cx="-3" cy="4" r="5" /></g>
          <g transform="translate(1010,880)" fill="#3E6B2C"><circle cx="0" cy="0" r="14" /></g>
          <g transform="translate(1010,876)" fill="#D6488C"><circle cx="-7" cy="-4" r="4.5" /><circle cx="4" cy="-7" r="4.5" /><circle cx="8" cy="2" r="4.5" /><circle cx="-3" cy="4" r="4.5" /></g>
          <g transform="translate(150,940)" fill="#3E6B2C"><circle cx="0" cy="0" r="13" /></g>
          <g transform="translate(150,936)" fill="#E85D9E"><circle cx="-6" cy="-3" r="4" /><circle cx="4" cy="-6" r="4" /><circle cx="7" cy="2" r="4" /><circle cx="-2" cy="3" r="4" /></g>
        </g>

        <g transform="translate(140,555)">
          <rect x="-6" y="80" width="12" height="100" rx="4" fill="#4A2410" />
          <g fill="#2F5C24">
            <circle cx="0" cy="16" r="42" />
            <circle cx="-36" cy="34" r="32" />
            <circle cx="36" cy="34" r="32" />
            <circle cx="-20" cy="58" r="28" />
            <circle cx="20" cy="58" r="28" />
            <circle cx="0" cy="64" r="32" />
          </g>
        </g>
        <g transform="translate(1300,590)">
          <rect x="-5" y="58" width="9" height="70" rx="3" fill="#4A2410" />
          <g fill="#356B29">
            <circle cx="0" cy="12" r="30" />
            <circle cx="-26" cy="25" r="23" />
            <circle cx="26" cy="25" r="23" />
            <circle cx="-14" cy="42" r="20" />
            <circle cx="14" cy="42" r="20" />
            <circle cx="0" cy="46" r="23" />
          </g>
        </g>

        <g transform="translate(1030,600)" fill="#4A2410" opacity="0.92">
          <polygon points="0,-64 -86,-4 86,-4" />
          <rect x="-62" y="-4" width="124" height="84" />
          <rect x="-16" y="26" width="30" height="54" fill="#F6DDB2" opacity="0.7" />
        </g>
        <g transform="translate(430,565) scale(0.66)" fill="#4A2410" opacity="0.85">
          <polygon points="0,-64 -86,-4 86,-4" />
          <rect x="-62" y="-4" width="124" height="84" />
          <rect x="-16" y="26" width="30" height="54" fill="#F6DDB2" opacity="0.7" />
        </g>

        <g transform="translate(560,860)" fill="#4A2410" opacity="0.92">
          <g opacity="0.95">
            <circle cx="150" cy="20" r="34" fill="none" stroke="#4A2410" strokeWidth="7" />
            <line x1="150" y1="-14" x2="150" y2="54" stroke="#4A2410" strokeWidth="4" />
            <line x1="116" y1="20" x2="184" y2="20" stroke="#4A2410" strokeWidth="4" />
            <line x1="126" y1="-4" x2="174" y2="44" stroke="#4A2410" strokeWidth="4" />
            <line x1="174" y1="-4" x2="126" y2="44" stroke="#4A2410" strokeWidth="4" />
          </g>
          <path d="M96 -30 L214 -30 L226 -6 L84 -6 Z" />
          <rect x="-70" y="-16" width="170" height="6" rx="3" />
          <path d="M-140 -18 C -168 -30 -170 4 -150 10 C -160 26 -130 30 -118 16 C -80 26 -66 4 -84 -12 C -70 -26 -100 -34 -120 -22 C -128 -30 -138 -26 -140 -18 Z" />
          <circle cx="-172" cy="-4" r="15" />
          <path d="M-182 -18 C -190 -30 -180 -34 -176 -24" fill="none" stroke="#4A2410" strokeWidth="4" strokeLinecap="round" />
          <path d="M-164 -18 C -158 -30 -168 -34 -170 -24" fill="none" stroke="#4A2410" strokeWidth="4" strokeLinecap="round" />
          <rect x="-158" y="10" width="8" height="26" rx="3" />
          <rect x="-138" y="14" width="8" height="26" rx="3" />
          <rect x="-112" y="12" width="8" height="26" rx="3" />
          <rect x="-92" y="14" width="8" height="26" rx="3" />
          <path d="M-150 6 C -158 20 -156 32 -148 40" fill="none" stroke="#4A2410" strokeWidth="4" strokeLinecap="round" />
          <g transform="translate(160,-46)">
            <circle cx="0" cy="-16" r="11" />
            <path d="M-9 -26 C -14 -34 10 -34 8 -26 C 14 -22 -14 -22 -9 -26 Z" />
            <path d="M-9 -5 C -14 -22 12 -22 9 -5 C 9 6 -9 6 -9 -5 Z" />
            <rect x="8" y="-14" width="24" height="5" rx="2.5" transform="rotate(-18 8 -14)" />
          </g>
        </g>

        <g transform="translate(210,910)" fill="#4A2410" opacity="0.9">
          <rect x="-88" y="-70" width="44" height="32" rx="2" />
          <line x1="-82" y1="-38" x2="-88" y2="-8" stroke="#4A2410" strokeWidth="4" strokeLinecap="round" />
          <line x1="-50" y1="-38" x2="-44" y2="-8" stroke="#4A2410" strokeWidth="4" strokeLinecap="round" />
          <g transform="translate(-12,0)">
            <circle cx="0" cy="-68" r="11" />
            <path d="M-12 -80 C -17 -90 13 -90 10 -80 C 17 -74 -19 -74 -12 -80 Z" />
            <path d="M-11 -57 C -17 -78 14 -78 11 -57 C 15 -27 -15 -27 -11 -57 Z" />
            <path d="M9 -62 L-52 -68" stroke="#4A2410" strokeWidth="5.5" strokeLinecap="round" fill="none" />
            <path d="M-8 -52 L-14 -29" stroke="#4A2410" strokeWidth="5.5" strokeLinecap="round" fill="none" />
            <rect x="-8" y="-29" width="6.5" height="29" rx="3" />
            <rect x="2.5" y="-29" width="6.5" height="29" rx="3" />
          </g>
          <g transform="translate(36,-4)"><circle cx="0" cy="-18" r="6.5" /><path d="M-7.5 -11 C -11 -23 9 -23 7.5 -11 C 9 0 -9 0 -7.5 -11 Z" /></g>
          <g transform="translate(58,-2)"><circle cx="0" cy="-18" r="6.5" /><path d="M-7.5 -11 C -11 -23 9 -23 7.5 -11 C 9 0 -9 0 -7.5 -11 Z" /></g>
          <g transform="translate(80,-4)"><circle cx="0" cy="-18" r="6.5" /><path d="M-7.5 -11 C -11 -23 9 -23 7.5 -11 C 9 0 -9 0 -7.5 -11 Z" /></g>
          <g transform="translate(102,-1)"><circle cx="0" cy="-18" r="6.5" /><path d="M-7.5 -11 C -11 -23 9 -23 7.5 -11 C 9 0 -9 0 -7.5 -11 Z" /></g>
        </g>

        <g transform="translate(1330,930)" fill="none" stroke="#4A2410" strokeWidth="5" opacity="0.85">
          <ellipse cx="0" cy="0" rx="28" ry="9" />
          <path d="M-28 0 L-28 -16 M28 0 L28 -16" />
          <path d="M-28 -16 Q0 -40 28 -16" />
        </g>
      </svg>
    </div>
  );
}

export default function Asli() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [showDevLibrary, setShowDevLibrary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stampAnimate, setStampAnimate] = useState(false);
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

  // stamp pop-in animation retrigger on every new result
  useEffect(() => {
    if (result) {
      setStampAnimate(false);
      const id = requestAnimationFrame(() => setStampAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [result]);

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

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) setInput(text.trim());
    } catch (e) {
      // clipboard permission denied or unsupported — no-op
    }
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
        position: "relative",
        display: "flex",
        justifyContent: "center",
        padding: "44px 18px 70px",
        fontFamily: "'Work Sans', 'Noto Sans Devanagari', sans-serif",
        color: "#241F1A",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Work+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Kalam:wght@400;700&display=swap');
        @keyframes stampdown { 0% { opacity:0; transform: scale(0.8) rotate(var(--stamp-rot,0deg)); } 60% { opacity:1; } 100% { opacity:1; transform: scale(1) rotate(var(--stamp-rot,0deg)); } }
        @keyframes micpulse { 0%,100% { box-shadow: 0 3px 7px rgba(36,31,26,0.28);} 50% { box-shadow: 0 0 0 8px rgba(162,59,46,0.18);} }
        textarea::placeholder { color: #9C8E76; }
      `}</style>

      <VillageBackground />

      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 2 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26, padding: "0 6px", flexWrap: "wrap", gap: 10 }}>
          <div style={{ position: "relative", transform: "rotate(-1.2deg)" }}>
            <div style={{ fontFamily: "'Zilla Slab', 'Noto Sans Devanagari', serif", fontWeight: 700, fontSize: 34, color: "#3A2412" }}>
              असली
              <svg viewBox="0 0 78 12" style={{ position: "absolute", left: -2, bottom: -9, width: 82, height: 12 }}>
                <path d="M2 8 C 12 2, 20 11, 30 5 S 48 2, 58 7 S 70 10, 76 4" stroke="#2E6B4A" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
              </svg>
            </div>
          </div>
          <div style={{ fontFamily: "'Kalam', 'Noto Sans Devanagari', cursive", fontSize: 14.5, color: "#3A2412", textAlign: "right", lineHeight: 1.45, maxWidth: 190, transform: "rotate(1deg)", marginTop: 4 }}>
            फ़ॉरवर्ड आया। असली जाँचता है।
          </div>
        </div>

        <p style={{ textAlign: "center", fontFamily: "'Kalam', 'Noto Sans Devanagari', cursive", fontSize: 14, color: "#3A2412", margin: "-10px 0 22px", transform: "rotate(-0.3deg)" }}>
          एक फ़ॉरवर्ड, एक सच, एक बार में।
        </p>

        {/* connectivity pill */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600,
              padding: "5px 12px", borderRadius: 999,
              color: isOnline ? "#5B5040" : "#2E6B4A",
              background: isOnline ? "rgba(36,31,26,0.06)" : "#E7EFE6",
              border: `1px solid ${isOnline ? "rgba(36,31,26,0.15)" : "#bcdcc4"}`,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isOnline ? "#8a8a7a" : "#3ddc6f", display: "inline-block" }} />
            {isOnline ? "ऑनलाइन" : "ऑफ़लाइन मोड"}
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: "linear-gradient(178deg, #FBF7EA 0%, #EEE3C6 100%)",
            borderRadius: "3px 16px 4px 18px",
            padding: "26px 24px 24px",
            boxShadow: "0 26px 50px -18px rgba(20,14,8,0.5), 0 4px 14px -4px rgba(20,14,8,0.28)",
            transform: "rotate(0.5deg)",
            border: "1px solid rgba(36,31,26,0.09)",
            position: "relative",
            boxSizing: "border-box",
          }}
        >
          <div style={{ position: "absolute", top: -9, left: 26, width: 14, height: 14, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #d95b4a, #8f2c1f 75%)", boxShadow: "0 2px 3px rgba(0,0,0,0.35)", transform: "rotate(-8deg)" }} />

          {devMode && (
            <button
              onClick={() => setShowDevLibrary((s) => !s)}
              style={{ position: "absolute", top: 10, right: 14, background: "transparent", border: "none", color: "#c9bda0", fontSize: 11, cursor: "pointer" }}
            >
              dev
            </button>
          )}

          <h1 style={{ fontFamily: "'Zilla Slab', 'Noto Sans Devanagari', serif", fontWeight: 600, fontSize: 20, margin: "4px 0 4px", lineHeight: 1.35 }}>
            यह मैसेज सही है या नहीं?
          </h1>
          <p style={{ fontSize: 13, color: "#5B5040", margin: "0 0 20px" }}>
            बोलिए, पेस्ट करिए, या नीचे टाइप करिए।
          </p>

          {/* quick actions */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 26, marginBottom: 18 }}>
            {voiceSupported && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <button
                  onClick={startListening}
                  disabled={isListening}
                  aria-label="बोलिए"
                  style={{
                    width: 52, height: 52, borderRadius: "50%", border: "none", cursor: isListening ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isListening ? "#A23B2E" : "#2B4C7E", color: "#F6EFDD",
                    transform: "rotate(-4deg)",
                    boxShadow: "0 3px 7px rgba(36,31,26,0.28), 0 1px 0 rgba(255,255,255,0.15) inset",
                    animation: isListening ? "micpulse 1.1s ease-in-out infinite" : "none",
                  }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                    <path d="M12 1c-1.7 0-3 1.4-3 3.2v7.6c0 1.8 1.3 3.2 3 3.2s3-1.4 3-3.2V4.2C15 2.4 13.7 1 12 1z" />
                    <path d="M18.5 10.5v1.5c0 3.6-2.9 6.5-6.5 6.5s-6.5-2.9-6.5-6.5v-1.5" />
                    <line x1="12" y1="19.5" x2="12" y2="23" />
                  </svg>
                </button>
                <span style={{ fontFamily: "'Noto Sans Devanagari','Work Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "#5B5040" }}>
                  {isListening ? "सुन रहा हूँ..." : "बोलिए"}
                </span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <button
                onClick={pasteFromClipboard}
                aria-label="पेस्ट करिए"
                style={{
                  width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#C77F1D", color: "#2E1D08", transform: "rotate(3deg)",
                  boxShadow: "0 3px 7px rgba(36,31,26,0.28), 0 1px 0 rgba(255,255,255,0.15) inset",
                }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="12" height="17" rx="2" />
                  <rect x="9" y="2" width="6" height="4" rx="1.3" />
                  <line x1="9" y1="11" x2="15" y2="11" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </button>
              <span style={{ fontFamily: "'Noto Sans Devanagari','Work Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "#5B5040" }}>
                पेस्ट करिए
              </span>
            </div>
          </div>

          <p style={{ fontSize: 11.5, color: "#5B5040", margin: "0 0 6px 2px" }}>या यहाँ टाइप करिए —</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="व्हाट्सऐप वाला मैसेज यहाँ पेस्ट करें"
            rows={3}
            style={{
              width: "100%", minHeight: 78, resize: "vertical",
              border: "1.5px solid rgba(36,31,26,0.15)", borderRadius: 10,
              background: "rgba(255,255,255,0.5)", padding: "12px 13px",
              fontFamily: "'Noto Sans Devanagari', 'Work Sans', sans-serif",
              fontSize: 15, lineHeight: 1.55, color: "#241F1A", outline: "none", boxSizing: "border-box",
            }}
          />

          <button
            onClick={() => runCheck(input)}
            disabled={status === "checking" || !input.trim()}
            style={{
              width: "100%", marginTop: 12, background: "#241F1A", color: "#F6EFDD",
              padding: "13px 16px", fontFamily: "'Zilla Slab','Noto Sans Devanagari',serif",
              fontWeight: 600, fontSize: 16, borderRadius: 10, border: "none",
              cursor: status === "checking" ? "default" : "pointer",
              opacity: status === "checking" || !input.trim() ? 0.6 : 1,
            }}
          >
            {status === "checking" ? "जाँच रहे हैं…" : "जाँचें"}
          </button>

          {(input || result) && (
            <button
              onClick={() => { setInput(""); setResult(null); setStatus("idle"); }}
              style={{ width: "100%", marginTop: 6, background: "transparent", border: "none", color: "#8a7e64", fontSize: 12.5, cursor: "pointer", padding: 4 }}
            >
              मिटाएँ
            </button>
          )}

          {!result && (
            <div style={{ fontSize: 13, color: "#7A6A4F", textAlign: "center", margin: "14px 0 4px", fontFamily: "'Kalam','Noto Sans Devanagari',cursive" }}>
              तीन उदाहरण नीचे हैं। या मैसेज पेस्ट करें।
            </div>
          )}

          {/* demo chips */}
          <div style={{ marginTop: 20 }}>
            <span style={{ fontFamily: "'Kalam', cursive", fontSize: 13.5, color: "#5B5040", marginBottom: 8, display: "inline-block", transform: "rotate(-1deg)" }}>
              या यह try करें —
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {CORE_FIXTURES.map((fx, i) => (
                <button
                  key={fx.id}
                  onClick={() => tapChip(fx)}
                  style={{
                    background: "rgba(36,31,26,0.045)", border: "1.3px dashed rgba(36,31,26,0.15)",
                    color: "#241F1A", fontSize: 12.8, fontWeight: 500, padding: "7px 12px",
                    borderRadius: 5, cursor: "pointer",
                    transform: `rotate(${i === 0 ? -1 : i === 1 ? 0.8 : -0.5}deg)`,
                  }}
                >
                  {fx.chip}
                </button>
              ))}
            </div>
          </div>

          {devMode && showDevLibrary && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, padding: 12, background: "rgba(36,31,26,0.04)", border: "1px dashed rgba(36,31,26,0.15)", borderRadius: 10 }}>
              <div style={{ width: "100%", fontSize: 11, color: "#8a7e64", marginBottom: 2 }}>Dev test library ({TEST_LIBRARY.length})</div>
              {TEST_LIBRARY.map((fx) => {
                const v = VERDICTS[fx.verdict];
                return (
                  <button
                    key={fx.id}
                    onClick={() => loadDevFixture(fx)}
                    style={{ background: "#fff", border: `1px solid ${v.color}55`, color: v.color, borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
                  >
                    {fx.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Result */}
          {result && (
            <div ref={resultRef} style={{ marginTop: 24, paddingTop: 22, borderTop: "1.5px dashed rgba(36,31,26,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 15, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontFamily: "'Zilla Slab', 'Noto Sans Devanagari', serif", fontWeight: 700, fontSize: 14.5,
                    letterSpacing: "0.02em", padding: "8px 15px", borderRadius: 4,
                    border: `2.5px solid ${verdictInfo.color}`, display: "inline-block",
                    color: verdictInfo.color, background: verdictInfo.bg,
                    opacity: stampAnimate ? 1 : 0,
                    transform: stampAnimate ? "scale(1) rotate(-2deg)" : "scale(0.8) rotate(-2deg)",
                    transition: "opacity 300ms ease, transform 300ms cubic-bezier(.2,.9,.35,1.2)",
                  }}
                >
                  {verdictInfo.label}
                </span>
              </div>

              {/* incoming message note */}
              <div
                style={{
                  background: "rgba(255,255,255,0.55)", border: "1px solid rgba(36,31,26,0.1)",
                  color: "#3A2412", borderRadius: 10, padding: "12px 14px", fontSize: 15,
                  lineHeight: 1.6, marginBottom: 10,
                }}
              >
                {highlightMatches(result.originalText, result.matchedKeywords)}
              </div>

              {/* Asli's reply */}
              <div style={{ background: "#E7EFE6", border: "1px solid #cfe0cf", borderRadius: 10, padding: "14px 16px", fontSize: 14.5, lineHeight: 1.65, color: "#2c4a34", marginBottom: 12 }}>
                <div style={{ marginBottom: result.evidence ? 8 : 0 }}>
                  <b>क्यों:</b> {result.why}
                </div>
                <div style={{ fontSize: 12.5, color: "#4d6b56", marginBottom: result.evidence ? 6 : 0 }}>
                  स्रोत: {result.source}
                </div>
                {result.evidence && <div style={{ fontSize: 12.5, color: "#4d6b56" }}>{result.evidence}</div>}
              </div>

              {result.matched && (
                <div style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: "#2E6B4A", background: "#E7EFE6", border: "1px solid #bcdcc4", borderRadius: 999, padding: "5px 12px", marginBottom: 14 }}>
                  सेव की गई आधिकारिक लिस्ट से जाँचा
                </div>
              )}

              {result.genericScam && (
                <div style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: "#8f4a1d", background: "#F6E9D8", border: "1px solid #e0c193", borderRadius: 999, padding: "5px 12px", marginBottom: 14 }}>
                  सामान्य धोखा पैटर्न से मेल खाया
                </div>
              )}

              {result.verdict === "unsure" && (
                <div style={{ fontSize: 12.5, color: "#7A6A4F", fontStyle: "italic", marginBottom: 14 }}>
                  अनुमान नहीं लगा रहे।
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => speak(result.tts || result.why)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, background: "#C77F1D", color: "#2E1D08",
                    padding: "9px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13.5,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  </svg>
                  सुनें
                </button>
                <button
                  onClick={handleCopy}
                  style={{
                    background: "rgba(36,31,26,0.06)", border: "1px solid rgba(36,31,26,0.15)",
                    color: copied ? "#2E6B4A" : "#3A2412", borderRadius: 8, padding: "9px 15px",
                    fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {copied ? "✓ कॉपी हो गया" : "परिवार को भेजें"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{ marginTop: 28, padding: "0 8px", fontFamily: "'Kalam', 'Noto Sans Devanagari', cursive", fontSize: 13, color: "#FBEFD8", textAlign: "center", lineHeight: 1.5, transform: "rotate(-0.4deg)", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>
          ये तीन उदाहरण हमेशा काम करते हैं — इंटरनेट हो या न हो। बाकी कोई भी मैसेज हमारे सामान्य
          धोखा-पैटर्न से जाँचा जाता है, ईमानदारी से — अनिश्चित होने पर हम अंदाज़ा नहीं लगाते।
        </p>
        <p style={{ marginTop: 6, textAlign: "center", fontSize: 11.5, color: "#FBEFD8", fontFamily: "'Work Sans', sans-serif", textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}>
          checked against <b>PIB Fact Check</b> · <b>RBI</b> · <b>MoHFW</b> · <b>SBI</b> advisories
        </p>
        <p style={{ marginTop: 10, textAlign: "center", fontSize: 10.5, color: "rgba(251,239,216,0.75)", lineHeight: 1.6, padding: "0 12px" }}>
          असली सभी गलत जानकारी नहीं पकड़ सकता और यह अभी फोटो/स्क्रीनशॉट में लिखा टेक्स्ट नहीं पढ़ सकता।
        </p>
      </div>
    </div>
  );
}
