function vehicleMark(vehicle) {
  if (vehicle === "train") {
    return `<g fill="#f7f1e4"><rect width="86" height="30" rx="4"/><circle cx="18" cy="36" r="7" fill="#1c1915"/><circle cx="64" cy="36" r="7" fill="#1c1915"/></g>`;
  }
  if (vehicle === "boat") {
    return `<g fill="#f7f1e4"><path d="M0 24h92l-14 20H14z"/><path d="M46 24V2h4l24 22" fill="none" stroke="#f7f1e4" stroke-width="3"/></g>`;
  }
  if (vehicle === "balloon") {
    return `<g><ellipse cx="40" cy="36" rx="28" ry="34" fill="#e2b007"/><path d="M28 70h24l-6 16H34z" fill="#f7f1e4"/></g>`;
  }
  return `<path d="M8 34l40-10-18-22 8 24 22 4-26 8 18 22-8-24z" fill="#e2b007"/>`;
}

export function bookCoverSvg({ title, eyebrow, vehicle = "plane" }) {
  const lines = wrap(title, 22).slice(0, 4);
  const text = lines.map((line, i) => `<text x="48" y="${210 + i * 42}" fill="#f7f1e4" font-family="Georgia, serif" font-size="34">${escapeXml(line)}</text>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#1e4d5c"/>
  <rect x="18" y="18" width="564" height="764" fill="none" stroke="#e2b007" stroke-width="16"/>
  <text x="48" y="90" fill="#e2b007" font-family="Georgia, serif" font-size="18" letter-spacing="3">${escapeXml(eyebrow || "FLYING SAUCES")}</text>
  ${text}
  <g transform="translate(48, 600)">${vehicleMark(vehicle)}</g>
  <text x="48" y="720" fill="#f7f1e4" font-family="Georgia, serif" font-size="16">Field book · Not a ranking</text>
</svg>`;
}

export function boxSetCoverSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
  <rect width="800" height="520" fill="#1e4d5c"/>
  <rect x="16" y="16" width="768" height="488" fill="none" stroke="#e2b007" stroke-width="14"/>
  <rect x="90" y="150" width="170" height="240" fill="#163844" stroke="#e2b007" stroke-width="6"/>
  <rect x="230" y="120" width="170" height="270" fill="#8c2f1e" stroke="#e2b007" stroke-width="6"/>
  <rect x="370" y="90" width="190" height="300" fill="#f7f1e4" stroke="#e2b007" stroke-width="6"/>
  <text x="90" y="450" fill="#f7f1e4" font-family="Georgia, serif" font-size="28">Complete Collection</text>
  <text x="90" y="482" fill="#e2b007" font-family="Georgia, serif" font-size="16">Save 30% · Coming soon</text>
</svg>`;
}

export function routeMapSvg(points) {
  const width = 800;
  const height = 360;
  const pad = 64;
  const projected = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (projected.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 120"><rect width="800" height="120" fill="#f7f1e4"/><text x="24" y="68" font-family="Georgia, serif" font-size="18">The stops are listed in the contents.</text></svg>`;
  }
  const lngs = projected.map((p) => p.lng);
  const lats = projected.map((p) => p.lat);
  const spanLng = Math.max(12, Math.max(...lngs) - Math.min(...lngs));
  const spanLat = Math.max(8, Math.max(...lats) - Math.min(...lats));
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const xy = projected.map((p) => ({
    x: pad + ((p.lng - (midLng - spanLng / 2)) / spanLng) * (width - pad * 2),
    y: pad + (((midLat + spanLat / 2) - p.lat) / spanLat) * (height - pad * 2),
    label: p.label || ""
  }));
  const d = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const dots = xy.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="#8c2f1e"/>`).join("");
  const labels = xy.filter((_, i) => i === 0 || i === xy.length - 1 || i % Math.ceil(xy.length / 6) === 0)
    .map((p) => `<text x="${(p.x + 8).toFixed(1)}" y="${(p.y - 8).toFixed(1)}" font-family="Georgia, serif" font-size="12">${escapeXml(p.label)}</text>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f4efe4"/>
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#e2b007" stroke-width="6"/>
  <path d="${d}" fill="none" stroke="#1e4d5c" stroke-width="3" stroke-dasharray="7 6"/>
  ${dots}
  ${labels}
</svg>`;
}

function wrap(text, size) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > size && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
