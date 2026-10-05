/**
 * Shared SEO constants & helpers (safe for both server and client).
 */

export const SITE_URL = "https://htc-website-two.vercel.app";
export const SITE_NAME = "Hammer Trading Company";
export const SITE_SHORT_NAME = "HTC — Hammer Trading";
export const BRAND = "HTC";
export const CURRENCY = "PKR";

export const DEFAULT_TITLE =
  "Hammer Trading Company — Best Door Hardware, Screws, Tools & Interior Fittings in Pakistan";

export const DEFAULT_DESCRIPTION =
  "Hammer Trading Company (HTC) — Pakistan's #1 online hardware store 2026. Buy best door locks, handles, hinges, screws, tower bolts, wood fittings, cabinet hardware, epoxy resin & hand tools at best prices. Cash on delivery, nationwide shipping. Best sellers in door hardware & interior fittings.";

export const DEFAULT_KEYWORDS = [
  // Brand
  "Hammer Trading Company",
  "HTC hardware",
  "MTR Store",
  "Hammer Trading",
  // Core hardware (2026 top searches)
  "hardware store Pakistan",
  "buy hardware online Pakistan",
  "best hardware store 2026",
  "hardware tools Pakistan",
  "wholesale hardware Pakistan",
  // Screws & fasteners (high volume searches)
  "screws Pakistan",
  "wood screws",
  "self tapping screws",
  "drywall screws",
  "buy screws online",
  "best screws 2026",
  "screw set Pakistan",
  "machine screws",
  "stainless steel screws",
  // Door hardware (core business)
  "door locks Pakistan",
  "best door locks 2026",
  "door handles Pakistan",
  "best door handles",
  "door hinges",
  "concealed hinges",
  "tower bolts",
  "door stopper",
  "door latch",
  "mortise lock",
  "cylinder lock",
  "door knob",
  "buy door locks online Pakistan",
  "door hardware online",
  // Cabinet & furniture fittings
  "cabinet handles",
  "cabinet hinges",
  "drawer locks",
  "drawer slides",
  "soft close hinges",
  "furniture fittings",
  "best cabinet hardware 2026",
  "kitchen hardware Pakistan",
  // Wood & interior
  "wood fittings Pakistan",
  "interior fittings",
  "best interior hardware",
  "wood working tools",
  "furniture hardware Pakistan",
  "interior design hardware",
  // Tools (2026 trending)
  "hand tools Pakistan",
  "best hand tools 2026",
  "power tools Pakistan",
  "cordless drill Pakistan",
  "tool kit Pakistan",
  "carpenter tools",
  "best sellers tools 2026",
  // Epoxy & specialty
  "epoxy resin Pakistan",
  "best epoxy resin 2026",
  // Commercial intent
  "best door hardware Pakistan",
  "best fittings 2026",
  "best sellers hardware",
  "hardware store Lahore",
  "hardware store Karachi",
  "cash on delivery hardware",
  "cheap hardware online Pakistan",
  // Doors — comprehensive (every door-related search)
  "doors Pakistan",
  "door accessories",
  "door fittings",
  "door hardware set",
  "main door locks",
  "main door handles",
  "bedroom door locks",
  "bathroom door locks",
  "privacy door locks",
  "passage door locks",
  "deadbolt locks",
  "rim locks",
  "padlocks Pakistan",
  "door chains",
  "door viewers",
  "peephole door",
  "door closers",
  "hydraulic door closer",
  "door hinges heavy duty",
  "butt hinges",
  "piano hinges",
  "spring hinges",
  "door handles stainless steel",
  "brass door handles",
  "antique door handles",
  "modern door handles",
  "door knobs Pakistan",
  "door pull handles",
  "sliding door hardware",
  "sliding door locks",
  "folding door hardware",
  "door magnets",
  "magnetic door stopper",
  "door seals",
  "door weather stripping",
  "door kick plates",
  "door number plates",
  "letter box",
  "door bell",
  // Wood — comprehensive (every wood-related search)
  "wood Pakistan",
  "wooden door fittings",
  "wood screws Pakistan",
  "wood glue",
  "wood filler",
  "wood polish",
  "wood varnish",
  "wood stain",
  "teak wood fittings",
  "sheesham wood hardware",
  "plywood fittings",
  "MDF fittings",
  "wooden cabinet hardware",
  "wooden drawer handles",
  "wood working Pakistan",
  "carpentry tools Pakistan",
  "wood carving tools",
  "wood clamps",
  "G clamps",
  "wood chisels",
  "wood planer",
  "wooden furniture fittings",
  "furniture legs",
  "furniture brackets",
  "corner brackets",
  "L brackets",
  "wooden door frames",
  "door frame fittings",
  "wood joints",
  "dowel pins",
  "wood dowels",
  "cam locks furniture",
  "furniture connectors",
  "knockdown fittings",
  "modular furniture hardware",
  "wardrobe fittings",
  "wardrobe locks",
  "wardrobe handles",
  "wooden wardrobe hardware",
  "best wood fittings 2026",
  "door wood",
  "wooden doors Pakistan",
  "solid wood hardware",
];

/** Absolute URL for a (possibly relative) path or image src. */
export function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return SITE_URL;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}

/** Canonical URL for a site path (no trailing slash except the root). */
export function canonicalUrl(path: string): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  return absoluteUrl(path);
}

/**
 * Trim text to ~max chars for meta descriptions: collapse whitespace and
 * cut at the last word boundary, appending an ellipsis when trimmed.
 */
export function truncateDescription(text: string, max = 155): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
