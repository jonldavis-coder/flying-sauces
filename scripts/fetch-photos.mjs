// Downloads freely licensed Wikimedia Commons photos into the repo.
// A sauce photo is kept only when the file title contains that sauce's name.
// Otherwise the sauce uses a landscape of its country, labeled as a place.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SAUCES } from "../data/sauces/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "data/photos.json");
const ua = "FlyingSauces/1.0 (https://github.com/jonldavis-coder/flying-sauces; recipe field guide; local photo archive)";
const widths = [640, 960, 1280];
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice(8) || 0);

const BANNED = [
  "portrait", "people", "person", "child", "children", "boy", "girl", "woman", "women",
  "man ", " men", "soldier", "military", "protest", "flag", " map", "diagram", "icon",
  "logo", "coat of arms", "stamp", "coin", "poster", "billboard", "advertisement",
  "illustration", "drawing", "painting", "watercolor", "sketch", "cartoon", "menu",
  "restaurant", "storefront", "selfie", "wedding", "festival", "crowd",
  "fresco", "museum", "toyota", "hilux", "battlefield", "dog", "puppy", "breed"
];

function plain(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fold(value) {
  return plain(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function licenseInfo(meta) {
  const short = plain(meta?.LicenseShortName?.value || meta?.UsageTerms?.value || "");
  const low = short.toLowerCase();
  if (!short) return null;
  if (/(noncommercial|non-commercial|\bnc\b|noderiv|no deriv|\bnd\b)/.test(low)) return null;
  if (/gfdl|gnu free/.test(low) && !/cc by/.test(low)) return null;
  const ok = /public domain|cc0|cc-zero|cc zero|\bpdm\b|no known copyright/.test(low)
    || /^cc by-sa\b/.test(low)
    || /^cc by\b/.test(low)
    || /^cc-by-sa\b/.test(low)
    || /^cc-by\b/.test(low);
  if (!ok) return null;
  return { name: short, url: plain(meta?.LicenseUrl?.value || "") };
}

function banned(title) {
  const text = ` ${fold(title)} `;
  return BANNED.some((word) => text.includes(word));
}

function commonsUrl(title) {
  return `https://commons.wikimedia.org/wiki/${encodeURI(title.replace(/ /g, "_"))}`;
}

async function api(params) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": ua, "Api-User-Agent": ua } });
    if (response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw new Error(`Commons ${response.status}`);
    return response.json();
  }
  throw new Error("Commons failed");
}

async function searchFiles(query) {
  const data = await api({
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo|categories",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1600",
    cllimit: "30"
  });
  return Object.values(data.query?.pages || {}).filter((page) => page.imageinfo?.[0]);
}

function candidate(page) {
  const info = page.imageinfo[0];
  const license = licenseInfo(info.extmetadata);
  const mime = info.mime || "";
  if (!license) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return null;
  if (banned(page.title)) return null;
  const cats = (page.categories || []).map((category) => category.title.toLowerCase()).join(" ");
  if (/people|portrait|women|\bmen\b|child|children|person|face|selfie/.test(cats)) return null;
  const described = plain(info.extmetadata?.ImageDescription?.value || "").toLowerCase();
  if (/my lunch|selfie|i am about|me and my/.test(described)) return null;
  if ((info.width || 0) < 800) return null;
  return {
    title: page.title,
    thumb: info.thumburl,
    width: info.thumbwidth || info.width,
    height: info.thumbheight || info.height,
    license,
    author: plain(info.extmetadata?.Artist?.value || "").slice(0, 180) || "Wikimedia Commons contributor"
  };
}

const EXTRA_OK = new Set(`
  with and the a of de la le les el al di da du au aux in on con et style classic homemade
  traditional bowl plate dish food spoon jar bottle served serving recipe sauce salsa gravy
  dressing dip marinade chutney paste curry glaze jus cream butter oil fresh hot mild
  red green white yellow brown black orange purple golden pink
  chicken pork beef fish shrimp prawn pasta spaghetti rice bread biscuit biscuits potato
  potatoes fry fries egg eggs steak lamb vegetable vegetables salad noodle noodles tofu
  meat grill grilled roasted fried roast asparagus sandwich burger taco tacos wing wings
  seafood lobster crab dumpling dumplings pizza lasagna meatball meatballs toast
  yuca pork ribs rib sausage sausages ham bacon cheese
`.split(/\s+/).filter(Boolean));

function sauceMatch(sauce, page) {
  const item = candidate(page);
  if (!item) return null;
  const title = fold(page.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""));
  const name = fold(sauce.name);
  if (name.length < 4 || !title.includes(name)) return null;
  const nameWords = new Set(name.split(" "));
  const extra = title.split(" ").filter((word) => word && !nameWords.has(word) && !/^\d+$/.test(word));
  if (extra.some((word) => !EXTRA_OK.has(word))) return null;
  return { ...item, score: 120 - extra.length * 3 };
}

async function findSaucePhotos(sauce) {
  const queries = [...new Set([sauce.name, fold(sauce.name)])].map((name) => `intitle:"${name}" filetype:bitmap`);
  const found = [];
  for (const query of queries) {
    const pages = await searchFiles(query);
    for (const page of pages) {
      const match = sauceMatch(sauce, page);
      if (match && !found.some((item) => item.title === match.title)) found.push(match);
    }
    if (found.length) break;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  found.sort((a, b) => b.score - a.score || b.width - a.width);
  return found.slice(0, 3);
}

async function findPlacePhoto(country) {
  const categories = [`Landscapes of ${country}`, `Landscapes of the ${country}`];
  for (const category of categories) {
    const pages = await searchFiles(`incategory:"${category}" filetype:bitmap`);
    const ready = pages.map(candidate).filter(Boolean);
    if (ready.length) return ready.sort((a, b) => b.width - a.width)[0];
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  const pages = await searchFiles(`intitle:"${country}" landscape filetype:bitmap`);
  const ready = pages.map(candidate).filter((item) => item && fold(item.title).includes("landscape"));
  return ready[0] || null;
}

async function writeSizes(buffer, stem) {
  const files = {};
  let largest = null;
  const image = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  for (const width of widths) {
    if ((meta.width || 0) < width && width !== widths[0]) continue;
    const target = Math.min(width, meta.width || width);
    const out = `${stem}-${target}.webp`;
    const file = path.join(root, out);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const result = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: 68 })
      .toFile(file);
    files[String(result.width)] = out;
    largest = { width: result.width, height: result.height };
  }
  return { files, ...largest };
}

async function download(item, stem) {
  const response = await fetch(item.thumb, { headers: { "User-Agent": ua } });
  if (!response.ok) throw new Error(`download ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const sized = await writeSizes(buffer, stem);
  return {
    kind: item.kind,
    credit: item.author,
    license: item.license.name,
    licenseUrl: item.license.url,
    sourceUrl: commonsUrl(item.title),
    sourceTitle: item.title,
    files: sized.files,
    width: sized.width,
    height: sized.height
  };
}

function loadManifest() {
  if (!fs.existsSync(manifestPath)) return { sauces: {}, places: {} };
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function saveManifest(manifest) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

const manifest = loadManifest();
const sauces = limit ? SAUCES.slice(0, limit) : SAUCES;
let sauceHits = 0;
let placeHits = 0;

for (const sauce of sauces) {
  if (!manifest.sauces[sauce.slug]) {
    const options = await findSaucePhotos(sauce);
    let saved = null;
    for (const photo of options) {
      try {
        photo.kind = "sauce";
        saved = await download(photo, `assets/photos/sauces/${sauce.slug}`);
        console.log("sauce", sauce.slug, photo.title);
        break;
      } catch (error) {
        console.log("skip", sauce.slug, error.message);
      }
    }
    if (saved) {
      manifest.sauces[sauce.slug] = saved;
      sauceHits += 1;
    } else {
      manifest.sauces[sauce.slug] = { kind: "place", countryCode: sauce.countryCode };
      console.log("place-fallback", sauce.slug);
    }
    saveManifest(manifest);
    await new Promise((resolve) => setTimeout(resolve, 100));
  } else if (manifest.sauces[sauce.slug].kind === "sauce") sauceHits += 1;
}

const countries = new Map();
for (const sauce of SAUCES) countries.set(sauce.countryCode, sauce.country);
for (const [code, country] of countries) {
  if (manifest.places[code]?.files) {
    placeHits += 1;
    continue;
  }
  const needed = Object.values(manifest.sauces).some((item) => item.kind === "place" && item.countryCode === code);
  if (!needed) continue;
  const photo = await findPlacePhoto(country);
  if (!photo) {
    console.log("no-landscape", code, country);
    continue;
  }
  photo.kind = "place";
  manifest.places[code] = await download(photo, `assets/photos/places/${code.toLowerCase()}`);
  manifest.places[code].country = country;
  placeHits += 1;
  console.log("landscape", code, photo.title);
  saveManifest(manifest);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const saucePhotos = Object.values(manifest.sauces).filter((item) => item.kind === "sauce").length;
const fallbacks = Object.values(manifest.sauces).filter((item) => item.kind === "place").length;
console.log(JSON.stringify({ saucePhotos, fallbacks, landscapes: Object.keys(manifest.places).length, seenSauce: sauceHits, seenPlace: placeHits }));
