import fs from "node:fs";
import path from "node:path";

const COLORS = {
  "mother-sauce": "#f2e2b6",
  emulsion: "#f6e7a1",
  salsa: "#d4532b",
  chutney: "#c46a1d",
  "curry-paste": "#e07a2f",
  "curry-sauce": "#d86a22",
  barbecue: "#8e2f1c",
  "hot-sauce": "#c81d11",
  pesto: "#3f7a45",
  dressing: "#e6d48a",
  "dipping-sauce": "#c9843a",
  gravy: "#6e4b32",
  "tomato-sauce": "#b43322",
  fermented: "#7a3e22",
  "nut-sauce": "#a9743a",
  "pan-sauce": "#8d5a34",
  marinade: "#b5522a",
  relish: "#c45a3a",
  "dessert-sauce": "#e7b8c8",
  "chili-paste": "#a32012",
  "soy-based": "#4a3428",
  "butter-sauce": "#f0d48a",
  "yogurt-sauce": "#f4f0e6",
  vinaigrette: "#d6c56a",
  mole: "#4a2c22",
  condiment: "#c4552a"
};

function hash(text) {
  let value = 0;
  for (const char of text) value = (value * 33 + char.charCodeAt(0)) % 10000;
  return value;
}

export function sauceIllustration(sauce) {
  const base = COLORS[sauce.baseType] || "#c4552a";
  const n = hash(sauce.slug);
  const dots = [0, 1, 2, 3, 4].map((i) => {
    const x = 250 + ((n + i * 47) % 180);
    const y = 210 + ((n * (i + 3)) % 70);
    const r = 3 + (i % 3);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#1c1915" opacity="0.18"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" role="img" aria-labelledby="title">
  <title id="title">Illustration of ${escapeXml(sauce.name)}</title>
  <rect width="800" height="520" fill="#f7f1e4"/>
  <rect x="18" y="18" width="764" height="484" fill="none" stroke="#e2b007" stroke-width="16"/>
  <rect x="42" y="42" width="716" height="436" fill="#1e4d5c"/>
  <path d="M80 430c80-40 140-20 200-60s120-30 180 10 140 20 220-20" fill="none" stroke="#e2b007" stroke-width="3" opacity="0.45"/>
  <ellipse cx="430" cy="300" rx="150" ry="46" fill="#142f38"/>
  <path d="M280 300c10-70 40-120 150-120s140 50 150 120" fill="#f7f1e4"/>
  <ellipse cx="430" cy="292" rx="128" ry="40" fill="${base}"/>
  ${dots}
  <path d="M150 150l46-8-28-36 8 40 34 6-40 8 28 36-8-40z" fill="#f7f1e4"/>
  <path d="M168 148h70" stroke="#f7f1e4" stroke-width="3"/>
  <circle cx="620" cy="120" r="36" fill="none" stroke="#e2b007" stroke-width="3"/>
  <path d="M620 92v18M620 148v-10M598 120h12M642 120h-10" stroke="#e2b007" stroke-width="2"/>
</svg>`;
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function writeIllustration(root, sauce) {
  const rel = `assets/images/sauces/${sauce.slug}.svg`;
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, sauceIllustration(sauce));
  return rel;
}

export function heroSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
  <rect width="800" height="520" fill="#1e4d5c"/>
  <rect x="16" y="16" width="768" height="488" fill="none" stroke="#e2b007" stroke-width="14"/>
  <circle cx="390" cy="250" r="120" fill="none" stroke="#f7f1e4" stroke-width="3" opacity="0.7"/>
  <ellipse cx="390" cy="250" rx="120" ry="46" fill="none" stroke="#f7f1e4" stroke-width="2" opacity="0.7"/>
  <path d="M270 250h240M390 130v240" stroke="#f7f1e4" stroke-width="2" opacity="0.45"/>
  <path d="M210 150l70-12-42-54 12 60 52 8-60 12 42 54-12-60z" fill="#e2b007"/>
  <path d="M236 146h110" stroke="#e2b007" stroke-width="4"/>
  <rect x="150" y="360" width="90" height="54" rx="6" fill="#f7f1e4"/>
  <rect x="250" y="372" width="70" height="42" rx="6" fill="#c2412d"/>
  <rect x="332" y="348" width="80" height="66" rx="6" fill="#e2b007"/>
</svg>`;
}

export function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="8" fill="#e2b007"/>
  <rect x="6" y="6" width="52" height="52" fill="#1e4d5c"/>
  <circle cx="32" cy="34" r="12" fill="none" stroke="#f7f1e4" stroke-width="2"/>
  <path d="M14 18l16-3-10-12 3 14 12 2-14 3 10 12-3-14z" fill="#f7f1e4"/>
</svg>`;
}
