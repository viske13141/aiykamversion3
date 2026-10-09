// ─────────────────────────────────────────────────────────────────────────────
// Shakthi page — frame manifest and editorial data
// ─────────────────────────────────────────────────────────────────────────────

// FRAME MANIFEST — 135 frames in strict folder order
// Folder 1: Sri Chakra (new)              (frames 1–40)
// Folder 2: Goddess idol morphs in temple (frames 41–75)
// Folder 3: Devotional video sequence    (frames 76–135)

const F1 = "/shakthi/chakra/frames_Sri_Chakra_morphs_into_idol_20261009125518";
const F2 = "/shakthi/frames_Goddess_idol_morphs_in_temple_20261009125522";
const F3 = "/shakthi/frames_Create_devotional_video_sequence_20261009130950";

function pad(n: number) {
  return String(n).padStart(4, "0");
}

export const SHAKTHI_FRAMES: string[] = [
  // Folder 1 — 40 frames
  ...Array.from({ length: 40 }, (_, i) => `${F1}/frame_${pad(i + 1)}.jpg`),
  // Folder 2 — 35 frames
  ...Array.from({ length: 35 }, (_, i) => `${F2}/frame_${pad(i + 1)}.jpg`),
  // Folder 3 — 60 frames
  ...Array.from({ length: 60 }, (_, i) => `${F3}/frame_${pad(i + 1)}.jpg`),
];

// Total must be 135
export const TOTAL_FRAMES = SHAKTHI_FRAMES.length; // 135

// ─────────────────────────────────────────────────────────────────────────────
// Overlay sections — tied to frame ranges
// ─────────────────────────────────────────────────────────────────────────────
export interface OverlaySection {
  /** 0-based inclusive frame indices */
  startFrame: number;
  endFrame: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  position: "bottom-left" | "bottom-center" | "top-right";
}

export const OVERLAY_SECTIONS: OverlaySection[] = [
  {
    startFrame: 0,
    endFrame: 39,
    eyebrow: "01 / 03",
    title: "SHAKTI — THE DIVINE FEMININE",
    subtitle: "The Sacred Journey Through the 18 Maha Shakti Peethas",
    position: "bottom-left",
  },
  {
    startFrame: 40,
    endFrame: 74,
    eyebrow: "02 / 03",
    title: "THE REVELATION",
    subtitle: "From the Sacred Sri Chakra to the Divine Forms of Shakti",
    position: "bottom-left",
  },
  {
    startFrame: 75,
    endFrame: 134,
    eyebrow: "03 / 03",
    title: "THE ETERNAL SHAKTI",
    subtitle: "One Divine Energy, Many Sacred Manifestations",
    position: "bottom-left",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 18 Maha Shakti Peethas — editorial data
// IMPORTANT: This list follows one commonly cited Ashtadasha Shakti Peetha
// tradition. Traditions, spellings, and locations vary across sources.
// All entries are provisional and require editorial verification before
// publication. Do not imply these deities appear in the cinematic frames.
// ─────────────────────────────────────────────────────────────────────────────
export interface PeethaEntry {
  seq: number;
  name: string;
  location: string;
  note?: string; // editorial/verification flag
}

export const SHAKTI_PEETHAS: PeethaEntry[] = [
  { seq: 1, name: "Shankari", location: "Trincomalee, Sri Lanka" },
  { seq: 2, name: "Kamakshi", location: "Kanchipuram, Tamil Nadu" },
  {
    seq: 3,
    name: "Shrinkhala Devi",
    location: "Pradyumna",
    note: "Traditional location disputed across sources.",
  },
  { seq: 4, name: "Chamundeshwari", location: "Mysuru, Karnataka" },
  { seq: 5, name: "Jogulamba", location: "Alampur, Telangana" },
  { seq: 6, name: "Bhramaramba", location: "Srisailam, Andhra Pradesh" },
  { seq: 7, name: "Mahalakshmi", location: "Kolhapur, Maharashtra" },
  { seq: 8, name: "Ekaveerika", location: "Mahur, Maharashtra" },
  { seq: 9, name: "Mahakali", location: "Ujjain, Madhya Pradesh" },
  { seq: 10, name: "Puruhutika", location: "Pithapuram, Andhra Pradesh" },
  { seq: 11, name: "Girija (Biraja)", location: "Jajpur, Odisha" },
  { seq: 12, name: "Manikyamba", location: "Draksharamam, Andhra Pradesh" },
  { seq: 13, name: "Kamarupa (Kamakhya)", location: "Guwahati, Assam" },
  {
    seq: 14,
    name: "Madhaveswari",
    location: "Prayagraj, Uttar Pradesh",
    note: "Associated with the Alopi tradition.",
  },
  { seq: 15, name: "Jwalamukhi", location: "Kangra district, Himachal Pradesh" },
  { seq: 16, name: "Mangala Gauri", location: "Gaya, Bihar" },
  { seq: 17, name: "Vishalakshi", location: "Varanasi, Uttar Pradesh" },
  {
    seq: 18,
    name: "Saraswati (Sharada)",
    location: "Kashmir region",
    note: "Location and tradition disputed across sources.",
  },
];
