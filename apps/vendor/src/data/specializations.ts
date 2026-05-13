// Curated list of subject specializations a vendor can declare.
// Drawn from the categories ISO 17100 §6.1.6 typically covers across
// professional translation work. Grouped for findability in the picker.
//
// Vendors can also enter a free-text custom value if their specialty
// isn't on the list (the picker exposes an "Add 'X' as custom" path).

export interface Specialization {
  /** Canonical label (what gets stored). */
  label: string;
  /** Search aliases — comma-separated terms the picker should match. */
  aliases?: string[];
  group: "Legal & Compliance" | "Medical & Life Sciences" | "Technical & IT" | "Business & Finance" | "Creative & Media" | "Public Sector & Academic" | "Hospitality & Lifestyle" | "Other";
}

export const SPECIALIZATIONS: Specialization[] = [
  // ── Legal & Compliance ────────────────────────────────────────────────
  { label: "Legal", group: "Legal & Compliance", aliases: ["law", "legal documents", "contracts"] },
  { label: "Patent & Intellectual Property", group: "Legal & Compliance", aliases: ["patent", "ip", "trademark", "copyright"] },
  { label: "Immigration & Civil Documents", group: "Legal & Compliance", aliases: ["immigration", "civil", "uscis", "ircc", "birth certificate", "marriage certificate"] },
  { label: "Compliance & Regulatory", group: "Legal & Compliance", aliases: ["compliance", "regulatory", "gdpr", "sox"] },

  // ── Medical & Life Sciences ───────────────────────────────────────────
  { label: "Medical", group: "Medical & Life Sciences", aliases: ["medicine", "clinical", "healthcare"] },
  { label: "Pharmaceutical", group: "Medical & Life Sciences", aliases: ["pharma", "drugs", "clinical trials"] },
  { label: "Life Sciences", group: "Medical & Life Sciences", aliases: ["biology", "biotech", "biotechnology"] },
  { label: "Medical Devices", group: "Medical & Life Sciences", aliases: ["devices", "ifu", "medtech"] },
  { label: "Veterinary", group: "Medical & Life Sciences", aliases: ["vet", "animal health"] },

  // ── Technical & IT ────────────────────────────────────────────────────
  { label: "Technical / Engineering", group: "Technical & IT", aliases: ["engineering", "technical manuals", "manufacturing"] },
  { label: "IT & Software Localization", group: "Technical & IT", aliases: ["software", "localization", "l10n", "it"] },
  { label: "Telecommunications", group: "Technical & IT", aliases: ["telecom", "5g", "networks"] },
  { label: "Automotive", group: "Technical & IT", aliases: ["auto", "cars", "vehicle"] },
  { label: "Aerospace & Defense", group: "Technical & IT", aliases: ["aerospace", "defense", "aviation"] },
  { label: "Energy & Oil & Gas", group: "Technical & IT", aliases: ["energy", "oil", "gas", "renewables"] },
  { label: "Construction & Architecture", group: "Technical & IT", aliases: ["construction", "architecture", "civil engineering"] },

  // ── Business & Finance ────────────────────────────────────────────────
  { label: "Financial", group: "Business & Finance", aliases: ["finance", "accounting", "audit"] },
  { label: "Banking", group: "Business & Finance", aliases: ["bank", "fintech"] },
  { label: "Insurance", group: "Business & Finance", aliases: ["insurance", "actuarial"] },
  { label: "Business & Corporate", group: "Business & Finance", aliases: ["business", "corporate", "annual report"] },
  { label: "Marketing & Transcreation", group: "Business & Finance", aliases: ["marketing", "transcreation", "advertising", "copywriting"] },
  { label: "E-commerce", group: "Business & Finance", aliases: ["ecommerce", "retail", "shopify"] },
  { label: "Human Resources", group: "Business & Finance", aliases: ["hr", "training materials", "handbook"] },

  // ── Creative & Media ──────────────────────────────────────────────────
  { label: "Literary & Publishing", group: "Creative & Media", aliases: ["literary", "books", "fiction", "publishing"] },
  { label: "Subtitling & AV", group: "Creative & Media", aliases: ["subtitling", "audiovisual", "av", "captions", "dubbing"] },
  { label: "Gaming & Video Games", group: "Creative & Media", aliases: ["gaming", "games", "video games"] },
  { label: "Journalism & News", group: "Creative & Media", aliases: ["journalism", "news", "press"] },
  { label: "Arts & Culture", group: "Creative & Media", aliases: ["arts", "culture", "museum"] },

  // ── Public Sector & Academic ──────────────────────────────────────────
  { label: "Government & Public Sector", group: "Public Sector & Academic", aliases: ["government", "public", "municipal"] },
  { label: "NGO & International Development", group: "Public Sector & Academic", aliases: ["ngo", "humanitarian", "un"] },
  { label: "Academic & Education", group: "Public Sector & Academic", aliases: ["academic", "education", "research papers", "thesis"] },
  { label: "Scientific Research", group: "Public Sector & Academic", aliases: ["science", "research", "journal articles"] },

  // ── Hospitality & Lifestyle ───────────────────────────────────────────
  { label: "Tourism & Hospitality", group: "Hospitality & Lifestyle", aliases: ["tourism", "hospitality", "hotel", "travel"] },
  { label: "Food & Beverage", group: "Hospitality & Lifestyle", aliases: ["food", "beverage", "menu", "culinary"] },
  { label: "Sports & Fitness", group: "Hospitality & Lifestyle", aliases: ["sports", "fitness", "athletics"] },
  { label: "Fashion & Beauty", group: "Hospitality & Lifestyle", aliases: ["fashion", "beauty", "cosmetics"] },
  { label: "Religion", group: "Hospitality & Lifestyle", aliases: ["religious", "faith"] },
];

/** Returns specializations matching the given query string, sorted by exactness. */
export function searchSpecializations(query: string): Specialization[] {
  const q = query.trim().toLowerCase();
  if (!q) return SPECIALIZATIONS;
  return SPECIALIZATIONS
    .map((s) => {
      const labelLower = s.label.toLowerCase();
      const aliasMatch = (s.aliases ?? []).some((a) => a.includes(q));
      // Score: starts-with > contains > alias > 0
      let score = 0;
      if (labelLower.startsWith(q)) score = 3;
      else if (labelLower.includes(q)) score = 2;
      else if (aliasMatch) score = 1;
      return { s, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ s }) => s);
}
