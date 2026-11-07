import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SAUCES } from "../data/sauces/index.js";
import { BOOKS as USE_BOOKS } from "../data/books.js";
import { FLAGSHIP_BOOKS } from "../data/flagship-books.js";
import { SHOP } from "../data/shop.js";
import { SAUCE_101, GLOSSARY } from "../data/learn.js";
import { COUNTRY_NAMES } from "../data/country-names.js";
import {
  BASE_TYPES,
  DIET_IDS,
  DIETS,
  HEATS,
  REGIONS,
  REGION_NAMES,
  USES,
  continentOf,
  labelOf
} from "../data/vocabulary.js";
import { escapeHtml } from "../assets/js/lib/escape.js";
import { isoDuration, formatMinutes } from "../assets/js/lib/format.js";
import { slugify } from "../assets/js/lib/slug.js";
import { faviconSvg, heroSvg, writeIllustration } from "./art.mjs";
import { bookCoverSvg, boxSetCoverSvg, routeMapSvg } from "./covers.mjs";
import { boxSetQuote, notifyHref, priceLabel } from "../assets/js/lib/shop.js";
import { adSlot, page } from "./layout.mjs";

const BOOKS = [...FLAGSHIP_BOOKS, ...USE_BOOKS];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://jonldavis-coder.github.io/flying-sauces";
const TODAY = "2026-11-07";

function write(rel, contents) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function resetGenerated() {
  for (const dir of ["sauces", "explore", "books", "map", "learn", "about", "privacy", "terms", "affiliate", "guidelines", "assets/images/sauces"]) {
    fs.rmSync(path.join(root, dir), { recursive: true, force: true });
  }
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function validate(sauces) {
  const errors = [];
  const slugs = new Set();
  const names = new Set();
  const banned = /national geographic|natgeo|lorem ipsum|\bTODO\b|testimonial/i;
  for (const sauce of sauces) {
    const where = sauce.slug || sauce.name || "(missing slug)";
    const need = ["slug", "name", "country", "countryCode", "region", "culture", "baseType", "heat", "flavor", "history", "background", "method", "served", "yieldText"];
    for (const key of need) {
      if (!String(sauce[key] || "").trim()) errors.push(`${where}: missing ${key}`);
    }
    if (slugs.has(sauce.slug)) errors.push(`${where}: duplicate slug`);
    slugs.add(sauce.slug);
    const norm = normalizeName(sauce.name);
    if (names.has(norm)) errors.push(`${where}: duplicate or near-duplicate name`);
    names.add(norm);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sauce.slug || "")) errors.push(`${where}: bad slug`);
    if (!/^[A-Z]{2}$/.test(sauce.countryCode || "")) errors.push(`${where}: countryCode must be ISO alpha-2`);
    if (!REGION_NAMES.includes(sauce.region)) errors.push(`${where}: unknown region ${sauce.region}`);
    if (!BASE_TYPES.some(([id]) => id === sauce.baseType)) errors.push(`${where}: unknown base ${sauce.baseType}`);
    if (!HEATS.some(([id]) => id === sauce.heat)) errors.push(`${where}: unknown heat ${sauce.heat}`);
    if (!Array.isArray(sauce.uses) || sauce.uses.length < 1) errors.push(`${where}: uses`);
    for (const use of sauce.uses || []) if (!USES.some(([id]) => id === use)) errors.push(`${where}: bad use ${use}`);
    for (const diet of sauce.diets || []) if (!DIET_IDS.includes(diet)) errors.push(`${where}: bad diet ${diet}`);
    for (const code of sauce.alsoCountries || []) {
      if (!/^[A-Z]{2}$/.test(code)) errors.push(`${where}: bad alsoCountries ${code}`);
    }
    if (!Array.isArray(sauce.funFacts) || sauce.funFacts.length < 1 || sauce.funFacts.length > 3) {
      errors.push(`${where}: need 1 to 3 fun facts`);
    }
    for (const fact of sauce.funFacts || []) if (String(fact).trim().length < 20) errors.push(`${where}: thin fun fact`);
    if (String(sauce.history).length < 80) errors.push(`${where}: history too short`);
    if (String(sauce.background).length < 40) errors.push(`${where}: background too short`);
    if (String(sauce.whyItTastes || "").trim().length < 80) errors.push(`${where}: why it tastes this way`);
    if (String(sauce.authenticTouch || "").trim().length < 40) errors.push(`${where}: authentic touch`);
    if (!Array.isArray(sauce.ingredients) || sauce.ingredients.length < 3) errors.push(`${where}: ingredients`);
    if (!Array.isArray(sauce.steps) || sauce.steps.length < 3) errors.push(`${where}: steps`);
    if (!Number.isInteger(sauce.prepMinutes) || sauce.prepMinutes < 0) errors.push(`${where}: prep`);
    if (!Number.isInteger(sauce.cookMinutes) || sauce.cookMinutes < 0) errors.push(`${where}: cook`);
    if ((sauce.prepMinutes || 0) + (sauce.cookMinutes || 0) < 1) errors.push(`${where}: time`);
    if (!Number.isInteger(sauce.servings) || sauce.servings < 1) errors.push(`${where}: servings`);
    const blob = JSON.stringify(sauce);
    if (banned.test(blob)) errors.push(`${where}: banned phrasing`);
    const allergens = new Set(sauce.allergens || []);
    const diets = new Set(sauce.diets || []);
    if ((allergens.has("meat") || allergens.has("fish") || allergens.has("shellfish")) && (diets.has("vegetarian") || diets.has("vegan"))) {
      errors.push(`${where}: diet conflicts with meat or fish`);
    }
    if ((allergens.has("dairy") || allergens.has("egg") || allergens.has("honey")) && diets.has("vegan")) {
      errors.push(`${where}: vegan conflict`);
    }
    if (allergens.has("dairy") && diets.has("dairy-free")) errors.push(`${where}: dairy-free conflict`);
    if (allergens.has("wheat") && diets.has("gluten-free")) errors.push(`${where}: gluten-free conflict`);
    if ((allergens.has("peanut") || allergens.has("tree-nut")) && diets.has("nut-free")) errors.push(`${where}: nut-free conflict`);
    if (!COUNTRY_NAMES[sauce.countryCode]) errors.push(`${where}: add ${sauce.countryCode} to country-names.js`);
    for (const code of sauce.alsoCountries || []) {
      if (!COUNTRY_NAMES[code]) errors.push(`${where}: add ${code} to country-names.js`);
    }
  }
  const continents = new Set(sauces.map((sauce) => continentOf(sauce.region)));
  for (const name of ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"]) {
    if (!continents.has(name)) errors.push(`missing continent ${name}`);
  }
  if (sauces.length < 250) errors.push(`need at least 250 sauces, have ${sauces.length}`);
  if (errors.length) {
    console.error(errors.slice(0, 40).join("\n"));
    throw new Error(`Catalog failed validation (${errors.length} problems).`);
  }
}

function countriesOf(sauce) {
  return [sauce.countryCode, ...(sauce.alsoCountries || [])];
}

function searchText(sauce) {
  return [
    sauce.name,
    sauce.country,
    sauce.region,
    sauce.locale,
    sauce.culture,
    sauce.flavor,
    sauce.background,
    labelOf(BASE_TYPES, sauce.baseType),
    labelOf(HEATS, sauce.heat),
    ...(sauce.uses || []),
    ...(sauce.pairings || []),
    ...(sauce.funFacts || [])
  ].join(" ").toLowerCase();
}

function og(title, description, url) {
  return `<meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:image" content="${ORIGIN}/assets/images/hero.svg">`;
}

function selectOptions(list, blank) {
  const head = `<option value="">${escapeHtml(blank)}</option>`;
  const rest = list.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
  return head + rest;
}

function filterForm(countryOptions) {
  return `<form id="filters" class="filters" role="search">
      <div class="filter-grid">
        <label>Search
          <input name="q" type="search" placeholder="Pesto, Senegal, tamarind…" autocomplete="off">
        </label>
        <label>Region
          <select name="region">${selectOptions(REGIONS.map(([name]) => [name, name]), "All regions")}</select>
        </label>
        <label>Base type
          <select name="type">${selectOptions(BASE_TYPES, "All types")}</select>
        </label>
        <label>Heat
          <select name="heat">${selectOptions(HEATS, "Any heat")}</select>
        </label>
        <label>Use
          <select name="use">${selectOptions(USES, "Any use")}</select>
        </label>
        <label>Diet
          <select name="diet">${selectOptions(DIETS, "Any diet")}</select>
        </label>
        <label>Country
          <select name="country">${countryOptions}</select>
        </label>
      </div>
    </form>`;
}

function card(sauce) {
  const countries = countriesOf(sauce).join(",");
  return `<article class="card" data-slug="${escapeHtml(sauce.slug)}" data-region="${escapeHtml(sauce.region)}" data-type="${escapeHtml(sauce.baseType)}" data-heat="${escapeHtml(sauce.heat)}" data-uses="${escapeHtml(sauce.uses.join(","))}" data-diets="${escapeHtml((sauce.diets || []).join(","))}" data-countries="${escapeHtml(countries)}" data-search="${escapeHtml(searchText(sauce))}">
        <a class="card-media" href="sauces/${sauce.slug}/">
          <img src="${sauce.photo}" alt="Illustration of ${escapeHtml(sauce.name)}" width="800" height="520">
          <span class="badge">${escapeHtml(sauce.country)}</span>
        </a>
        <div class="card-body">
          <p class="eyebrow">${escapeHtml(sauce.region)} · ${escapeHtml(labelOf(BASE_TYPES, sauce.baseType))}</p>
          <h2><a href="sauces/${sauce.slug}/">${escapeHtml(sauce.name)}</a></h2>
          <p>${escapeHtml(sauce.flavor)}</p>
          <p class="meta">${escapeHtml(labelOf(HEATS, sauce.heat))} · ${formatMinutes(sauce.prepMinutes + sauce.cookMinutes)} · ${escapeHtml(sauce.yieldText)}</p>
          <p class="meta rating">No ratings yet</p>
          <p class="meta hearts">No hearts yet</p>
        </div>
      </article>`;
}

function recipeBody(sauce, { book = false } = {}) {
  const facts = sauce.funFacts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("");
  const ingredients = sauce.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const steps = sauce.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const variations = (sauce.variations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const pairings = (sauce.pairings || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const uses = sauce.uses.map((item) => `<li>${escapeHtml(labelOf(USES, item))}</li>`).join("");
  const diets = (sauce.diets || []).map((item) => `<li>${escapeHtml(labelOf(DIETS, item))}</li>`).join("");
  const safety = sauce.safety ? `<p class="safety">${escapeHtml(sauce.safety)}</p>` : "";
  return `<p class="print-only print-brand">Flying Sauces of the World</p>
      <p class="eyebrow">${escapeHtml(sauce.country)} · ${escapeHtml(sauce.region)}</p>
      <h2 class="sauce-title">${book ? escapeHtml(sauce.name) : ""}</h2>
      ${book ? "" : ""}
      <p class="dek">${escapeHtml(sauce.flavor)}</p>
      <p class="meta recipe-meta">${formatMinutes(sauce.prepMinutes)} prep · ${formatMinutes(sauce.cookMinutes)} cook · Serves ${sauce.servings} · ${escapeHtml(sauce.yieldText)}</p>
      <div class="story-block">
        <h3>History</h3>
        <p>${escapeHtml(sauce.history)}</p>
        <h3>Cultural background</h3>
        <p>${escapeHtml(sauce.background)}</p>
        <h3>Why it tastes this way</h3>
        <p>${escapeHtml(sauce.whyItTastes)}</p>
        <h3>How it is made</h3>
        <p>${escapeHtml(sauce.method)}</p>
        <p class="authentic-touch"><strong>Authentic touch. </strong>${escapeHtml(sauce.authenticTouch)}</p>
        <h3>How it is used</h3>
        <p>${escapeHtml(sauce.served)}</p>
      </div>
      <aside class="fun-facts">
        <h3>Field notes</h3>
        <ul>${facts}</ul>
      </aside>
      <h3>Ingredients</h3>
      <ul class="ingredients">${ingredients}</ul>
      <h3 class="steps-heading">Steps</h3>
      <ol class="steps">${steps}</ol>
      ${safety}
      <p class="note">${escapeHtml(sauce.storage)} Home cooking, not a professional food-safety instruction.</p>
      <div class="variations">
        <h3>Variations</h3>
        ${variations ? `<ul>${variations}</ul>` : "<p>The classic version is the one written above.</p>"}
      </div>
      <div class="pairings">
        <h3>Pairings and uses</h3>
        <ul class="tag-row">${uses}</ul>
        ${pairings ? `<ul>${pairings}</ul>` : ""}
        ${diets ? `<ul class="tag-row">${diets}</ul>` : ""}
      </div>`;
}

function sauceJson(sauce) {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: sauce.name,
    description: `${sauce.flavor} ${sauce.history}`.slice(0, 480),
    image: `${ORIGIN}/${sauce.photo}`,
    recipeCategory: labelOf(BASE_TYPES, sauce.baseType),
    recipeCuisine: sauce.culture || sauce.country,
    recipeYield: sauce.yieldText,
    prepTime: isoDuration(sauce.prepMinutes),
    cookTime: isoDuration(sauce.cookMinutes),
    totalTime: isoDuration(sauce.prepMinutes + sauce.cookMinutes),
    recipeIngredient: sauce.ingredients,
    recipeInstructions: sauce.steps.map((text) => ({ "@type": "HowToStep", text })),
    keywords: [sauce.region, sauce.country, labelOf(HEATS, sauce.heat), ...sauce.uses].join(", "),
    author: { "@type": "Organization", name: "Flying Sauces of the World" },
    url: `${ORIGIN}/sauces/${sauce.slug}/`
  };
}

function breadcrumb(sauce) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Field guide", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: sauce.region, item: `${ORIGIN}/explore/region/${slugify(sauce.region)}/` },
      { "@type": "ListItem", position: 3, name: sauce.name, item: `${ORIGIN}/sauces/${sauce.slug}/` }
    ]
  };
}

function saucePage(sauce, count) {
  const description = `${sauce.name}: ${sauce.flavor} A ${sauce.country} recipe with origin, method, and field notes.`;
  const shared = (sauce.alsoCountries || []).map((code) => COUNTRY_NAMES[code]).filter(Boolean);
  const originExtra = shared.length ? `<p>Also cooked as a staple in ${escapeHtml(shared.join(", "))}.</p>` : "";
  return page({
    title: `${sauce.name} · Flying Sauces`,
    description,
    current: "home",
    pageName: "sauce",
    sauceCount: count,
    canonical: `${ORIGIN}/sauces/${sauce.slug}/`,
    jsonLd: [sauceJson(sauce), breadcrumb(sauce)],
    extraHead: og(sauce.name, description, `${ORIGIN}/sauces/${sauce.slug}/`),
    main: `<article id="sauce-root" class="wrap sauce-layout" data-slug="${escapeHtml(sauce.slug)}">
      <div>
        <p class="print-only print-brand">Flying Sauces of the World</p>
        <p class="eyebrow">${escapeHtml(sauce.country)} · ${escapeHtml(sauce.region)}</p>
        <h1 class="sauce-title">${escapeHtml(sauce.name)}</h1>
        ${sauce.pronunciation ? `<p class="meta">Pronounced ${escapeHtml(sauce.pronunciation)}</p>` : ""}
        <p class="dek">${escapeHtml(sauce.flavor)}</p>
        <p class="meta recipe-meta">${formatMinutes(sauce.prepMinutes)} prep · ${formatMinutes(sauce.cookMinutes)} cook · Serves ${sauce.servings} · ${escapeHtml(sauce.yieldText)}</p>
        <p class="meta" id="rating-summary">No ratings yet</p>
        <p class="meta" id="heart-summary">No hearts yet</p>
        <ul class="tag-row">
          <li>${escapeHtml(labelOf(BASE_TYPES, sauce.baseType))}</li>
          <li>${escapeHtml(labelOf(HEATS, sauce.heat))}</li>
          ${(sauce.diets || []).map((diet) => `<li>${escapeHtml(labelOf(DIETS, diet))}</li>`).join("")}
        </ul>
        <div class="story-block">
          <h2>History</h2>
          <p>${escapeHtml(sauce.history)}</p>
          <h2>Cultural background</h2>
          <p>${escapeHtml(sauce.background)}</p>
          <h2>Why it tastes this way</h2>
          <p>${escapeHtml(sauce.whyItTastes)}</p>
          <h2>How it is made</h2>
          <p>${escapeHtml(sauce.method)}</p>
          <aside class="authentic-touch">
            <h2>Authentic touch</h2>
            <p>${escapeHtml(sauce.authenticTouch)}</p>
          </aside>
          <h2>How it is used</h2>
          <p>${escapeHtml(sauce.served)}</p>
        </div>
        <aside class="fun-facts">
          <h2>Field notes</h2>
          <ul>${sauce.funFacts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>
        </aside>
        ${adSlot("sauce_rail")}
        <h2>Ingredients</h2>
        <ul class="ingredients">${sauce.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2 class="steps-heading">Steps</h2>
        <ol class="steps">${sauce.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        ${sauce.safety ? `<p class="safety">${escapeHtml(sauce.safety)}</p>` : ""}
        <p class="note">${escapeHtml(sauce.storage)} This is a home recipe, not professional food-safety advice.</p>
        <div class="variations section-rule">
          <h2>Variations</h2>
          ${(sauce.variations || []).length ? `<ul>${sauce.variations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p>The classic version is the one written above.</p>"}
        </div>
        <div class="pairings">
          <h2>Pairings</h2>
          <ul>${(sauce.pairings || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div id="print-actions" class="no-print button-row"></div>
        <div id="community-actions" class="no-print section-rule"></div>
        <section id="twists" class="no-print section-rule"></section>
        <section id="comments" class="no-print section-rule" aria-label="Comments"></section>
      </div>
      <aside class="rail">
        <figure class="sauce-photo">
          <img src="${sauce.photo}" alt="Illustration of a bowl of ${escapeHtml(sauce.name)}" width="800" height="520">
          <figcaption>${escapeHtml(sauce.photoCredit)}</figcaption>
        </figure>
        <div class="origin-card">
          <h2>Origin</h2>
          <dl>
            <dt>Country</dt><dd>${escapeHtml(sauce.country)}</dd>
            <dt>Region</dt><dd><a href="explore/region/${slugify(sauce.region)}/">${escapeHtml(sauce.region)}</a></dd>
            <dt>Locale</dt><dd>${escapeHtml(sauce.locale || sauce.country)}</dd>
            <dt>Culture</dt><dd>${escapeHtml(sauce.culture)}</dd>
            <dt>Base</dt><dd><a href="explore/type/${sauce.baseType}/">${escapeHtml(labelOf(BASE_TYPES, sauce.baseType))}</a></dd>
            <dt>Heat</dt><dd>${escapeHtml(labelOf(HEATS, sauce.heat))}</dd>
          </dl>
          ${originExtra}
          <p><a href="map/?country=${escapeHtml(sauce.countryCode)}">See this country on the map</a></p>
        </div>
      </aside>
    </article>`
  });
}

function feature(region, copy, sauces) {
  const examples = sauces.filter((sauce) => sauce.region === region).slice(0, 3).map((sauce) => sauce.name).join(" · ");
  const count = sauces.filter((sauce) => sauce.region === region).length;
  return `<a class="feature" href="explore/region/${slugify(region)}/">
        <span class="count">${count} sauces</span>
        <p class="eyebrow">${escapeHtml(region)}</p>
        <h2>${escapeHtml(copy.title)}</h2>
        <p>${escapeHtml(copy.text)} ${escapeHtml(examples)}.</p>
      </a>`;
}

function explorePage({ title, description, current, crumbs, sauces, count }) {
  return page({
    title: `${title} · Flying Sauces`,
    description,
    current,
    pageName: "explore",
    sauceCount: count,
    canonical: crumbs,
    extraHead: og(title, description, crumbs),
    main: `<div class="wrap">
      ${adSlot("explore_top")}
      <p class="eyebrow">Explore</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(description)}</p>
      <p class="results-count">${sauces.length} ${sauces.length === 1 ? "sauce" : "sauces"}</p>
      <div class="grid">${sauces.map(card).join("\n") || "<p>None yet.</p>"}</div>
    </div>`
  });
}

function bookSauces(book, sauces) {
  if (book.slugs) {
    return book.slugs.map((slug) => sauces.find((sauce) => sauce.slug === slug)).filter(Boolean);
  }
  return sauces.filter(book.match);
}

function checkboxGroup(name, list) {
  return `<div class="checks">${list.map(([value, label]) => `<label><input type="checkbox" name="${name}" value="${escapeHtml(value)}"> ${escapeHtml(label)}</label>`).join("")}</div>`;
}

resetGenerated();
validate(SAUCES);
const sauces = SAUCES.map((sauce) => ({
  ...sauce,
  photo: writeIllustration(root, sauce),
  photoCredit: "Original illustration for Flying Sauces of the World."
}));
sauces.sort((a, b) => a.name.localeCompare(b.name));
const count = sauces.length;

write("assets/images/hero.svg", heroSvg());
write("favicon.svg", faviconSvg());

const countryName = new Map(Object.entries(COUNTRY_NAMES));
for (const sauce of sauces) countryName.set(sauce.countryCode, sauce.country);
const countryOptions = `<option value="">All countries</option>` + [...countryName.entries()]
  .filter(([code]) => sauces.some((sauce) => countriesOf(sauce).includes(code)))
  .sort((a, b) => a[1].localeCompare(b[1]))
  .map(([code, name]) => `<option value="${code}">${escapeHtml(name)}</option>`)
  .join("");

const catalog = sauces.map((sauce) => ({
  slug: sauce.slug,
  name: sauce.name,
  country: sauce.country,
  countryCode: sauce.countryCode,
  alsoCountries: sauce.alsoCountries || [],
  region: sauce.region,
  baseType: sauce.baseType,
  heat: sauce.heat,
  diets: sauce.diets || [],
  uses: sauce.uses,
  flavor: sauce.flavor,
  search: searchText(sauce)
}));
write("assets/js/catalog.js", `// Generated by scripts/build-site.mjs. Do not edit by hand.\nexport const SAUCE_COUNT = ${count};\nexport const COUNTRY_NAMES = ${JSON.stringify(Object.fromEntries(countryName))};\nexport const CATALOG = ${JSON.stringify(catalog)};\n`);
write("data/index.json", JSON.stringify({ count, growingTo: 1000, sauces: catalog }, null, 2));

const homeDesc = `An editorial field guide to the world's sauces: ${count} recipes so far, with origins, methods, and maps. Growing to 1,000 sauces.`;
const features = [
  ["Southeast Asia", { title: "Markets, pastes, and dipping bowls", text: "Fish sauce, sambal, curries, and the sauces that travel with rice and grilled meat." }],
  ["Mexico & Central America", { title: "Salsa, mole, and recado", text: "Raw salsas, cooked moles, and the pastes that define a region." }],
  ["West Africa", { title: "Pepper, palm, and groundnut", text: "Sauces built to go over starch: chili, fermented fish, peanut, and palm fruit." }],
  ["Western Europe", { title: "The mother sauces and the table", text: "Roux, butter, vinegar, and the named sauces of the French repertoire, plus neighbors." }]
].map(([region, copy]) => feature(region, copy, sauces)).join("\n");

write("index.html", page({
  title: "Flying Sauces of the World",
  description: homeDesc,
  current: "home",
  pageName: "home",
  sauceCount: count,
  canonical: `${ORIGIN}/`,
  extraHead: og("Flying Sauces of the World", homeDesc, `${ORIGIN}/`) + `
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Flying Sauces of the World",
    url: `${ORIGIN}/`,
    description: homeDesc,
    potentialAction: {
      "@type": "SearchAction",
      target: `${ORIGIN}/?q={query}`,
      "query-input": "required name=query"
    }
  })}</script>`,
  main: `<div class="wrap">
      <section class="hero">
        <div>
          <p class="eyebrow">A field guide · Issue 01</p>
          <h1>Sauces, mapped.</h1>
          <p class="lede">Every entry is a real sauce with a full recipe, an origin, and field notes. This issue holds ${count} sauces. The shelf is growing to 1,000.</p>
          <p class="button-row"><a class="button" href="map/">Open the map</a> <a class="button button-quiet" href="books/">Recipe books</a></p>
        </div>
        <div class="hero-media">
          <img src="assets/images/hero.svg" alt="Illustration of a paper plane crossing a globe above jars of sauce" width="800" height="520">
        </div>
      </section>
      ${adSlot("home_after_hero")}
      <section class="feature-band" aria-label="Regional features">
        ${features}
      </section>
      ${adSlot("home_mid")}
      <h2>Browse the shelf</h2>
      ${filterForm(countryOptions)}
      <p id="results-count" class="results-count" aria-live="polite">${count} sauces</p>
      <p id="empty-results" hidden>No sauces match. Clear a filter and try a country, a heat level, or a single ingredient.</p>
      <div id="sauce-list" class="grid">
        ${sauces.map(card).join("\n")}
      </div>
    </div>`
}));

write("map/index.html", page({
  title: "Map · Flying Sauces",
  description: "An interactive world map of sauce origins. Choose a country to list its sauces, and filter by region, type, heat, use, and diet.",
  current: "map",
  pageName: "map",
  sauceCount: count,
  canonical: `${ORIGIN}/map/`,
  extraHead: `<link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css">` + og("Sauce map", "World map of sauce origins.", `${ORIGIN}/map/`),
  extraFoot: `<script src="assets/vendor/leaflet/leaflet.js"></script>`,
  main: `<div class="wrap">
      ${adSlot("map_top")}
      <p class="eyebrow">Atlas</p>
      <h1>Where the sauces come from</h1>
      <p class="lede">Countries are shaded by how many field-guide sauces name them. A sauce that is a shared staple is counted in each country listed on its page. Pins mark places too small to see on this map. The list under the map works without JavaScript.</p>
      ${filterForm(countryOptions)}
      <p id="map-status" class="results-count" role="status">${count} sauces for all countries.</p>
      <div id="world-map" role="application" aria-label="World map of sauce origins"></div>
      <div id="country-results" class="section-rule"></div>
    </div>`
}));

const exploreLinks = (items, hrefFor, labelFor) => items.map((item) => {
  const key = Array.isArray(item) ? item[0] : item;
  const label = labelFor(item);
  const n = sauces.filter((sauce) => hrefFor.count(sauce, key)).length;
  return `<a class="explore-card" href="${hrefFor.href(key)}"><p class="eyebrow">${n} sauces</p><h2>${escapeHtml(label)}</h2></a>`;
}).join("\n");

write("explore/index.html", page({
  title: "Explore · Flying Sauces",
  description: "Browse sauces by region, base type, and use.",
  current: "explore",
  pageName: "explore",
  sauceCount: count,
  canonical: `${ORIGIN}/explore/`,
  main: `<div class="wrap">
      <p class="eyebrow">Explore</p>
      <h1>Three ways through the shelf</h1>
      <h2>By region</h2>
      <div class="explore-grid">${exploreLinks(REGIONS, {
        href: (key) => `explore/region/${slugify(key)}/`,
        count: (sauce, key) => sauce.region === key
      }, ([name]) => name)}</div>
      <h2>By type</h2>
      <div class="explore-grid">${exploreLinks(BASE_TYPES, {
        href: (key) => `explore/type/${key}/`,
        count: (sauce, key) => sauce.baseType === key
      }, ([, label]) => label)}</div>
      <h2>By use</h2>
      <div class="explore-grid">${exploreLinks(USES, {
        href: (key) => `explore/use/${key}/`,
        count: (sauce, key) => sauce.uses.includes(key)
      }, ([, label]) => label)}</div>
    </div>`
}));

for (const [name] of REGIONS) {
  const group = sauces.filter((sauce) => sauce.region === name);
  if (!group.length) continue;
  const url = `${ORIGIN}/explore/region/${slugify(name)}/`;
  write(`explore/region/${slugify(name)}/index.html`, explorePage({
    title: name,
    description: `${group.length} sauces from ${name}.`,
    current: "explore",
    crumbs: url,
    sauces: group,
    count
  }));
}
for (const [id, label] of BASE_TYPES) {
  const group = sauces.filter((sauce) => sauce.baseType === id);
  if (!group.length) continue;
  write(`explore/type/${id}/index.html`, explorePage({
    title: label,
    description: `${group.length} sauces with the base type ${label}.`,
    current: "explore",
    crumbs: `${ORIGIN}/explore/type/${id}/`,
    sauces: group,
    count
  }));
}
for (const [id, label] of USES) {
  const group = sauces.filter((sauce) => sauce.uses.includes(id));
  if (!group.length) continue;
  write(`explore/use/${id}/index.html`, explorePage({
    title: label,
    description: `Sauces used for ${label.toLowerCase()}.`,
    current: "explore",
    crumbs: `${ORIGIN}/explore/use/${id}/`,
    sauces: group,
    count
  }));
}

for (const sauce of sauces) write(`sauces/${sauce.slug}/index.html`, saucePage(sauce, count));

const centroids = loadCentroids();
const builtBooks = BOOKS.map((book) => {
  const members = bookSauces(book, sauces);
  const missing = (book.slugs || []).filter((slug) => !sauces.some((sauce) => sauce.slug === slug));
  if (missing.length) throw new Error(`Book ${book.slug} is missing ${missing.join(", ")}`);
  if (members.length < 3) throw new Error(`Book ${book.slug} has only ${members.length} sauces`);
  const price = SHOP.prices[book.slug] || SHOP.defaultPrice;
  return { ...book, members, price };
});
if (builtBooks.some((book) => book.slug === "top-100-sauces" && book.members.length !== 100)) {
  const found = builtBooks.find((book) => book.slug === "top-100-sauces");
  throw new Error(`Top 100 book has ${found?.members.length || 0} sauces`);
}

const quote = boxSetQuote(builtBooks.map((book) => book.price), SHOP.boxSetDiscount);
write("assets/images/books/complete-collection.svg", boxSetCoverSvg());
write("assets/js/shop-config.js", `// Generated from data/shop.js. Placeholder prices, not final.\nwindow.FLYING_SAUCES_SHOP = ${JSON.stringify({
  openingSoon: SHOP.openingSoon,
  pricesAreFinal: SHOP.pricesAreFinal,
  notifyEmail: SHOP.notifyEmail,
  boxSetDiscount: SHOP.boxSetDiscount,
  products: builtBooks.map((book) => ({
    id: book.slug,
    name: book.title,
    pricePlaceholder: book.price,
    page: `books/${book.slug}/`
  })),
  boxSet: {
    id: "complete-collection",
    name: "Complete Collection",
    page: "shop/complete-collection/",
    discount: SHOP.boxSetDiscount
  }
}, null, 2)};\n`);

function buyBox(title, price) {
  return `<aside class="buy-box no-print">
      <p class="status-pill">Coming soon</p>
      <p class="price">${escapeHtml(priceLabel(price, SHOP))}</p>
      <p><a class="button" href="${escapeHtml(notifyHref(SHOP, title))}">Coming soon</a></p>
    </aside>`;
}

function bookRoute(book) {
  if (book.route?.length) {
    return book.route.map((pair, index) => ({
      lat: pair[0],
      lng: pair[1],
      label: book.members[index]?.country || ""
    }));
  }
  const seen = new Set();
  const points = [];
  for (const sauce of book.members) {
    if (seen.has(sauce.countryCode)) continue;
    seen.add(sauce.countryCode);
    const center = centroids[sauce.countryCode];
    if (!center) continue;
    points.push({ lat: center[0], lng: center[1], label: sauce.country });
  }
  return points;
}

const boxCard = `<a class="book-card box-card" href="shop/complete-collection/">
        <img src="assets/images/books/complete-collection.svg" alt="Cover design for the Complete Collection box set" width="800" height="520">
        <p class="eyebrow">Box set · Save 30%</p>
        <h2>Complete Collection</h2>
        <p>Every field book in this issue. The set price is 30% off the sum of the individual placeholder prices.</p>
        <p class="price">${escapeHtml(priceLabel(quote.total, SHOP))}</p>
      </a>`;

write("books/index.html", page({
  title: "Recipe books · Flying Sauces",
  description: "Flagship recipe books and field booklets, printable now. Buying the books is coming soon. Prices are placeholders.",
  current: "books",
  pageName: "books",
  sauceCount: count,
  canonical: `${ORIGIN}/books/`,
  main: `<div class="wrap">
      <p class="eyebrow">Field books</p>
      <h1>Recipe books</h1>
      <p class="lede">Curated books for a later print or download edition, plus the use-based booklets. You can read and print them now. The buy buttons say coming soon, and every price is a placeholder, not an offer.</p>
      <div class="book-list">
        ${boxCard}
        ${builtBooks.map((book) => `<a class="book-card" href="books/${book.slug}/">
          <img src="assets/images/books/${book.slug}.svg" alt="Cover design for ${escapeHtml(book.title)}" width="600" height="800">
          <p class="eyebrow">${book.members.length} sauces · ${escapeHtml(priceLabel(book.price, SHOP))}</p>
          <h2>${escapeHtml(book.title)}</h2>
          <p>${escapeHtml(book.dek)}</p>
        </a>`).join("\n")}
      </div>
    </div>`
}));

write("shop/index.html", page({
  title: "Shop · Flying Sauces",
  description: "Coming soon: printable recipe books. Prices are placeholders, not final.",
  current: "shop",
  pageName: "shop",
  sauceCount: count,
  canonical: `${ORIGIN}/shop/`,
  main: `<div class="wrap">
      <p class="status-pill">Coming soon</p>
      <h1>Shop</h1>
      <p class="lede">The books can be read and printed now. Selling them comes later. Prices below are placeholders, not an offer and not final. Nothing is for sale while this sign is up.</p>
      <div class="book-list">
        ${boxCard}
        ${builtBooks.map((book) => `<a class="book-card" href="books/${book.slug}/"><p class="eyebrow">${escapeHtml(priceLabel(book.price, SHOP))}</p><h2>${escapeHtml(book.title)}</h2><p>${escapeHtml(book.dek)}</p></a>`).join("\n")}
      </div>
    </div>`
}));

write("shop/complete-collection/index.html", page({
  title: "Complete Collection · Flying Sauces",
  description: "The box set of every Flying Sauces recipe book. The price is 30% off the sum of the individual placeholder prices.",
  current: "shop",
  pageName: "shop",
  sauceCount: count,
  canonical: `${ORIGIN}/shop/complete-collection/`,
  main: `<article class="wrap book-hero">
      <img class="cover" src="assets/images/books/complete-collection.svg" alt="Original cover design for the Complete Collection box set" width="800" height="520">
      <div>
        <p class="status-pill">Coming soon</p>
        <h1>Complete Collection</h1>
        <p class="dek">Every recipe book in this issue, in one set. The discount is 30% off the sum of the individual placeholder prices. It is computed from those prices, not typed in as a separate amount.</p>
        <p class="save-flag">Save 30%</p>
        <ul class="price-lines">
          <li>Individual books, added up: ${escapeHtml(priceLabel(quote.sum, SHOP))}</li>
          <li>You save: ${escapeHtml(priceLabel(quote.savings, SHOP))}</li>
          <li>Set price: ${escapeHtml(priceLabel(quote.total, SHOP))}</li>
        </ul>
        ${buyBox("Complete Collection", quote.total)}
        <p class="note">Placeholder prices, not final. No checkout is turned on.</p>
      </div>
      <h2>Books in the set</h2>
      <ol class="contents">
        ${builtBooks.map((book) => `<li><a href="books/${book.slug}/">${escapeHtml(book.title)}</a> · ${escapeHtml(priceLabel(book.price, SHOP))}</li>`).join("")}
      </ol>
    </article>`
}));

for (const book of builtBooks) {
  const url = `${ORIGIN}/books/${book.slug}/`;
  const coverPath = `assets/images/books/${book.slug}.svg`;
  write(coverPath, bookCoverSvg({ title: book.title, eyebrow: "Flying Sauces", vehicle: book.vehicle || "plane" }));
  const route = bookRoute(book);
  const routePath = `assets/images/books/${book.slug}-route.svg`;
  write(routePath, routeMapSvg(route));
  const continents = [];
  for (const sauce of book.members) {
    const name = continentOf(sauce.region);
    if (name && !continents.includes(name)) continents.push(name);
  }
  const continentLine = book.slug === "top-100-sauces"
    ? `<p>This reading route crosses ${continents.length} continents: ${escapeHtml(continents.join(", "))}.</p>`
    : "";
  write(`books/${book.slug}/index.html`, page({
    title: `${book.title} · Flying Sauces`,
    description: book.dek,
    current: "books",
    pageName: "book",
    sauceCount: count,
    canonical: url,
    extraHead: og(book.title, book.dek, url),
    main: `<article class="wrap book">
        <div class="book-hero">
          <img class="cover" src="${coverPath}" alt="Original cover design for ${escapeHtml(book.title)}" width="600" height="800">
          <header class="book-cover">
            <p class="eyebrow">Recipe book${book.vehicle ? ` · ${escapeHtml(book.vehicle)}` : ""}</p>
            <h1>${escapeHtml(book.title)}</h1>
            <p class="dek">${escapeHtml(book.dek)}</p>
            ${book.intro.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
            ${continentLine}
            ${book.selectionNote ? `<aside class="authentic-touch"><h2>How this list was chosen</h2><p>${escapeHtml(book.selectionNote)}</p></aside>` : ""}
            ${buyBox(book.title, book.price)}
            <p class="no-print"><button id="print-book" type="button">Print this book</button></p>
            ${adSlot("book_after_intro")}
          </header>
        </div>
        <h2>Route</h2>
        <figure class="route-map">
          <img src="${routePath}" alt="Schematic route for ${escapeHtml(book.title)}" width="800" height="360">
          <figcaption>A schematic of the route, not a navigation chart.</figcaption>
        </figure>
        <h2>Contents</h2>
        <ol class="contents">
          ${book.members.map((sauce, index) => `<li><a href="sauces/${sauce.slug}/">${escapeHtml(sauce.name)}</a> · ${escapeHtml(sauce.country)} · <a href="#sauce-${sauce.slug}">recipe ${index + 1}</a></li>`).join("")}
        </ol>
        ${book.members.map((sauce) => `<article class="book-recipe" id="sauce-${sauce.slug}">
          <p class="meta">${escapeHtml(sauce.country)} · ${escapeHtml(labelOf(HEATS, sauce.heat))} · ${escapeHtml(sauce.yieldText)}</p>
          ${recipeBody(sauce, { book: true }).replace("<h2 class=\"sauce-title\"></h2>", `<h2 class="sauce-title">${escapeHtml(sauce.name)}</h2>`)}
          <p class="no-print"><a href="sauces/${sauce.slug}/">Open the field-guide page</a></p>
        </article>`).join("\n")}
      </article>`
  }));
}

function loadCentroids() {
  const data = JSON.parse(fs.readFileSync(path.join(root, "assets/maps/countries.geojson"), "utf8"));
  const map = {};
  for (const feature of data.features) {
    const iso = feature.properties.iso;
    let minX = 180;
    let maxX = -180;
    let minY = 90;
    let maxY = -90;
    const walk = (node) => {
      if (typeof node?.[0] === "number") {
        minX = Math.min(minX, node[0]);
        maxX = Math.max(maxX, node[0]);
        minY = Math.min(minY, node[1]);
        maxY = Math.max(maxY, node[1]);
        return;
      }
      if (Array.isArray(node)) node.forEach(walk);
    };
    walk(feature.geometry?.coordinates);
    if (minX <= maxX) map[iso] = [(minY + maxY) / 2, (minX + maxX) / 2];
  }
  return map;
}

write("learn/sauce-101/index.html", page({
  title: "Sauce 101 · Flying Sauces",
  description: "The five French mother sauces, emulsions, reductions, and thickeners, explained for the home kitchen.",
  current: "learn",
  pageName: "static",
  sauceCount: count,
  canonical: `${ORIGIN}/learn/sauce-101/`,
  main: `<article class="wrap prose">
      <p class="eyebrow">School</p>
      <h1>Sauce 101</h1>
      <p class="lede">A short course in the techniques behind the recipes: mother sauces, emulsions, reductions, and thickeners.</p>
      ${SAUCE_101.map((section) => `<section><h2>${escapeHtml(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("\n")}
      <p><a href="learn/glossary/">Read the glossary</a></p>
    </article>`
}));

write("learn/glossary/index.html", page({
  title: "Glossary · Flying Sauces",
  description: "A glossary of sauce terms, from roux and nappé to sambal, mole, and tare.",
  current: "learn",
  pageName: "static",
  sauceCount: count,
  canonical: `${ORIGIN}/learn/glossary/`,
  main: `<article class="wrap prose">
      <p class="eyebrow">School</p>
      <h1>Glossary</h1>
      <dl class="glossary">
        ${GLOSSARY.map(([term, definition]) => `<dt id="${slugify(term)}">${escapeHtml(term)}</dt><dd>${escapeHtml(definition)}</dd>`).join("\n")}
      </dl>
    </article>`
}));

function prosePage({ file, canonical, title, description, current, paragraphs, robots = "" }) {
  write(file, page({
    title: `${title} · Flying Sauces`,
    description,
    current,
    pageName: "static",
    sauceCount: count,
    robots,
    canonical: `${ORIGIN}/${canonical}`,
    main: `<article class="wrap prose"><h1>${escapeHtml(title)}</h1>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}</article>`
  }));
}

prosePage({
  file: "about/index.html",
  canonical: "about/",
  title: "About",
  description: "What Flying Sauces of the World is, and how the recipes and histories were chosen.",
  current: "about",
  paragraphs: [
    `Flying Sauces of the World is an editorial field guide to sauces. This issue has ${count} sauces. The public goal is 1,000. The count on the site is the number of edited entries, and it will change when new entries are added.`,
    "Each entry has a home recipe, a country and region, a cultural note, a short history, a flavor line, a heat level, a base type, uses, pairings, variations, and one to three field notes. If a popular origin story is disputed, the page says so or leaves it out.",
    "Illustrations are drawn for this site. They are not photographs of people. The map uses Natural Earth country shapes and Leaflet, with no paid map key.",
    "The community tools follow the same pattern as the related project <a href=\"https://jonldavis-coder.github.io/granny-recipes/\">Granny Recipes</a>: comments, hearts, star ratings, and reader submissions. Twists are extra here. Until Supabase is connected, a banner says that those notes stay in the browser.",
    "The site is published by jonldavis-coder and hosted on GitHub Pages from the main branch."
  ]
});

prosePage({
  file: "guidelines/index.html",
  canonical: "guidelines/",
  title: "Community guidelines",
  description: "Rules for comments, twists, and submitted sauces.",
  current: "about",
  paragraphs: [
    "Be specific and decent. Comment on the sauce, not on a person.",
    "A twist is your change to a published recipe. Say what you changed. Do not present a twist as the classic.",
    "Do not submit a copied paywalled recipe, a fabricated history, or instructions for making someone sick.",
    "Do not post garlic-in-oil storage tricks, home canning times, or raw bitter-cassava processing. Refrigerator sauces and commercial cassareep or tucupi are as far as this site goes.",
    "The owner can hide comments, twists, and submitted sauces. Reports are for spam, harassment, dangerous instructions, and recipes that are simply wrong."
  ]
});

prosePage({
  file: "affiliate/index.html",
  canonical: "affiliate/",
  title: "Affiliate disclosure",
  description: "How affiliate links and ads would be labeled if they are added.",
  current: "about",
  paragraphs: [
    "This draft explains the policy. It is not a legal contract.",
    "Flying Sauces does not currently run advertisements. The ads configuration is set to provider “none”, and the empty slots are hidden. They are omitted from print views even if a provider is turned on later.",
    "There are no affiliate links in this issue. If a link later earns a commission, the page that carries it will say so near the link. A commission would not change the recipe or the history.",
    "Product names appear only to identify a well-known commercial example of a style, such as a bottled sauce from a known maker. Naming a product is not an endorsement and not an offer to sell it."
  ]
});

prosePage({
  file: "privacy/index.html",
  canonical: "privacy/",
  title: "Privacy",
  description: "Draft privacy notes for Flying Sauces.",
  current: "about",
  paragraphs: [
    "This is a draft, not a lawyer’s privacy policy.",
    "The field guide itself is static files on GitHub Pages. In demo mode, accounts, comments, hearts, ratings, twists, and submitted sauces are stored in your browser’s localStorage. They are not sent to a server. Anyone with access to that browser profile can read them.",
    "If Supabase is connected later, account email, display name, comments, ratings, hearts, twists, reports, and submitted sauces are stored in that project. The anon key is public. Row level security is what limits access. The service-role key is never placed in this repository.",
    "The ads provider is none, and this repository does not include an analytics tracker. Type on the pages may be requested from Google Fonts, which is a third-party request. The map file and Leaflet are served from this site.",
    "Do not submit another person’s private information in a comment or a sauce."
  ]
});

prosePage({
  file: "terms/index.html",
  canonical: "terms/",
  title: "Terms",
  description: "Draft terms for using Flying Sauces.",
  current: "about",
  paragraphs: [
    "This is a draft for readers, not legal advice and not a complete contract.",
    "Recipes are home cooking notes. You are responsible for allergens, doneness, and storage. The diet tags match the written recipe and are not a medical diet.",
    "You keep your own words when you comment, add a twist, or submit a sauce. You give the site permission to display them on the field guide. Do not post what you do not have the right to post.",
    "The owner may remove community posts. The edited field guide can be corrected when a history or a recipe is wrong.",
    "The site is offered as-is. Counts, maps, and pages can change as the guide grows toward 1,000 sauces."
  ]
});

write("404.html", page({
  title: "Page not found · Flying Sauces",
  description: "That page is not in the field guide.",
  current: "",
  pageName: "static",
  robots: "noindex",
  sauceCount: count,
  main: `<div class="wrap prose"><h1>That page is not on the map</h1><p>The link may be mistyped, or the sauce may not be in this issue yet.</p><p><a class="button" href="index.html">Back to the field guide</a></p></div>`
}));

write("login.html", page({
  title: "Sign in · Flying Sauces",
  description: "Sign in to rate, comment, heart, and submit a sauce.",
  current: "",
  pageName: "auth",
  robots: "noindex",
  sauceCount: count,
  main: `<div class="wrap prose">
      <h1>Sign in</h1>
      <p id="auth-status" role="status"></p>
      <form id="signin-form" class="form-card" data-auth>
        <h2>Have an account</h2>
        <label for="signin-email">Email</label>
        <input id="signin-email" name="email" type="email" autocomplete="username" required>
        <label for="signin-password">Password</label>
        <input id="signin-password" name="password" type="password" autocomplete="current-password" required>
        <p class="visually-hidden"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></p>
        <p class="form-error" role="alert"></p>
        <button type="submit">Sign in</button>
      </form>
      <form id="signup-form" class="form-card" data-auth>
        <h2>Create an account</h2>
        <label for="display-name">Display name</label>
        <input id="display-name" name="displayName" maxlength="40" required>
        <label for="signup-email">Email</label>
        <input id="signup-email" name="email" type="email" autocomplete="username" required>
        <label for="signup-password">Password</label>
        <input id="signup-password" name="password" type="password" autocomplete="new-password" required>
        <p class="visually-hidden"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></p>
        <p class="form-error" role="alert"></p>
        <button type="submit">Create account</button>
      </form>
      <form id="magic-form" class="form-card" data-auth>
        <h2>Email a one-time link</h2>
        <label for="magic-email">Email</label>
        <input id="magic-email" name="email" type="email" autocomplete="username" required>
        <p class="visually-hidden"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></p>
        <p class="form-error" role="alert"></p>
        <button type="submit">Send a link</button>
      </form>
    </div>`
}));

write("moderate.html", page({
  title: "Moderate · Flying Sauces",
  description: "Owner tools for hiding community posts.",
  current: "",
  pageName: "moderate",
  robots: "noindex",
  sauceCount: count,
  main: `<div class="wrap prose"><h1>Moderation desk</h1><div id="moderate-root"></div></div>`
}));

write("submit.html", page({
  title: "Submit a sauce · Flying Sauces",
  description: "Submit a sauce that is not already in the field guide.",
  current: "submit",
  pageName: "submit",
  sauceCount: count,
  canonical: `${ORIGIN}/submit.html`,
  main: `<div class="wrap">
      <h1>Submit a sauce</h1>
      <p class="lede">Use this for a real sauce that is missing from the guide. For a change to a published recipe, add a twist on that sauce’s page.</p>
      <p id="submit-auth-note" class="note" hidden></p>
      <form id="submit-form" class="form-card">
        <label for="name">Name</label>
        <input id="name" name="name" required maxlength="120">
        <label for="country">Country</label>
        <input id="country" name="country" required maxlength="60">
        <label for="region">Region</label>
        <select id="region" name="region" required>${selectOptions(REGIONS.map(([name]) => [name, name]), "Choose a region")}</select>
        <label for="baseType">Base type</label>
        <select id="baseType" name="baseType" required>${selectOptions(BASE_TYPES, "Choose a type")}</select>
        <label for="heat">Heat</label>
        <select id="heat" name="heat" required>${selectOptions(HEATS, "Choose a heat")}</select>
        <label for="flavor">Flavor, in one line</label>
        <input id="flavor" name="flavor" required maxlength="400">
        <label for="story">Origin note</label>
        <textarea id="story" name="story" required maxlength="2000" rows="5"></textarea>
        <label for="funFact">One field note</label>
        <input id="funFact" name="funFact" required maxlength="400">
        <label for="yieldText">Yield</label>
        <input id="yieldText" name="yieldText" required maxlength="80" placeholder="about 1 cup">
        <label for="servings">Servings</label>
        <input id="servings" name="servings" type="number" min="1" max="100" required>
        <label for="prepMinutes">Prep minutes</label>
        <input id="prepMinutes" name="prepMinutes" type="number" min="0" max="1440" required>
        <label for="cookMinutes">Cook minutes</label>
        <input id="cookMinutes" name="cookMinutes" type="number" min="0" max="1440" required>
        <fieldset><legend>Uses</legend>${checkboxGroup("uses", USES)}</fieldset>
        <fieldset><legend>Diet, if the recipe matches</legend>${checkboxGroup("diets", DIETS)}</fieldset>
        <label for="ingredients">Ingredients, one per line</label>
        <textarea id="ingredients" name="ingredients" required rows="8"></textarea>
        <label for="steps">Steps, one per line</label>
        <textarea id="steps" name="steps" required rows="8"></textarea>
        <label for="photo">Optional picture, illustration or food only</label>
        <input id="photo" name="photo" type="file" accept="image/*">
        <p class="visually-hidden"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></p>
        <p class="form-error" role="alert"></p>
        <button type="submit">Submit sauce</button>
      </form>
    </div>`
}));

write("sauce.html", page({
  title: "Community sauce · Flying Sauces",
  description: "A sauce submitted by a reader.",
  current: "home",
  pageName: "dynamic",
  robots: "noindex",
  sauceCount: count,
  main: `<div class="wrap"><article id="sauce-root"></article><noscript><p>This page needs JavaScript to show a sauce saved in the browser.</p></noscript></div>`
}));

const urls = [];
function collect(rel) {
  if (!rel.endsWith(".html")) return;
  if (["404.html", "login.html", "moderate.html", "sauce.html"].includes(rel)) return;
  if (rel === "index.html") urls.push(`${ORIGIN}/`);
  else if (rel.endsWith("/index.html")) urls.push(`${ORIGIN}/${rel.slice(0, -"index.html".length)}`);
  else urls.push(`${ORIGIN}/${rel}`);
}
function walk(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (["node_modules", "scripts", "test", "supabase", "data", "assets"].includes(entry.name) && prefix === "") continue;
      walk(path.join(dir, entry.name), rel);
    } else if (entry.name.endsWith(".html")) collect(rel);
  }
}
walk(root);
const uniqueUrls = [...new Set(urls)].sort();
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueUrls.map((loc) => `  <url><loc>${loc}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
write(".nojekyll", "");

console.log(`Built ${count} sauces, ${builtBooks.length} books, ${uniqueUrls.length} sitemap URLs.`);
