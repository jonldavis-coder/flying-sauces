import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { SAUCES } from "../data/sauces/index.js";
import { continentOf } from "../data/vocabulary.js";
import { matchesSauce } from "../assets/js/lib/filter.js";
import { summarizeRatings } from "../assets/js/lib/ratings.js";
import { createDemoAdapter } from "../assets/js/demo-adapter.js";
import { isSupabaseConfigured } from "../assets/js/adapter.js";
import { boxSetQuote, priceLabel } from "../assets/js/lib/shop.js";
import { FLAGSHIP_BOOKS } from "../data/flagship-books.js";
import { SHOP } from "../data/shop.js";
import { PLACES } from "../data/places.js";
import { SETTLEMENTS } from "../data/settlement.js";
import { JOURNEYS } from "../data/journeys.js";

const root = path.resolve(import.meta.dirname, "..");

function memoryStorage() {
  let raw = null;
  return {
    load() {
      return raw ? JSON.parse(raw) : null;
    },
    save(next) {
      raw = JSON.stringify(next);
    }
  };
}

test("the field guide has at least 250 real sauces and taste notes", () => {
  assert.ok(SAUCES.length >= 250);
  const slugs = new Set();
  const continents = new Set();
  for (const sauce of SAUCES) {
    assert.equal(slugs.has(sauce.slug), false);
    slugs.add(sauce.slug);
    assert.ok(sauce.whyItTastes.length >= 80);
    assert.ok(sauce.authenticTouch.length >= 40);
    assert.ok(sauce.funFacts.length >= 1 && sauce.funFacts.length <= 3);
    assert.ok(sauce.ingredients.length >= 3);
    assert.ok(sauce.steps.length >= 3);
    continents.add(continentOf(sauce.region));
    const blob = `${sauce.history} ${sauce.background} ${sauce.whyItTastes}`;
    assert.equal(/national geographic|natgeo/i.test(blob), false);
  }
  for (const name of ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"]) {
    assert.equal(continents.has(name), true);
  }
});

test("filters match region, heat, use, and diet", () => {
  const item = {
    region: "Western Europe",
    baseType: "emulsion",
    heat: "none",
    uses: ["pasta"],
    diets: ["vegetarian"],
    countries: ["FR"],
    search: "bechamel france"
  };
  assert.equal(matchesSauce(item, { query: "france" }), true);
  assert.equal(matchesSauce(item, { region: "Western Europe", use: "pasta" }), true);
  assert.equal(matchesSauce(item, { diet: "vegan" }), false);
});

test("ratings average once", () => {
  assert.deepEqual(summarizeRatings([5, 4]), { ratingAvg: 4.5, ratingCount: 2 });
});

test("demo mode stores a heart, a rating, a comment, and a twist", async () => {
  const demo = createDemoAdapter({}, { storage: memoryStorage() });
  const human = { honeypot: "", openedAt: Date.now() - 5000 };
  await demo.signUp({ email: "cook@example.com", password: "longpassword", displayName: "Cook" }, human);
  const slug = "bechamel";
  const rated = await demo.setRating(slug, 5);
  assert.equal(rated.myRating, 5);
  const heart = await demo.setHeart(slug, true);
  assert.equal(heart.heartedByMe, true);
  await demo.addComment(slug, "The nutmeg should stay a pinch.", human);
  await demo.addTwist(slug, { title: "Bay leaf", body: "I steep a bay leaf in the milk." }, human);
  assert.equal((await demo.listComments(slug)).length, 1);
  assert.equal((await demo.listTwists(slug)).length, 1);
});

test("supabase stays off until both slots are filled", () => {
  assert.equal(isSupabaseConfigured({ SUPABASE_URL: "", SUPABASE_ANON_KEY: "" }), false);
  const config = fs.readFileSync(path.join(root, "config.js"), "utf8");
  assert.match(config, /SUPABASE_URL:\s*""/);
  assert.match(config, /SUPABASE_ANON_KEY:\s*""/);
  const ads = fs.readFileSync(path.join(root, "ads-config.js"), "utf8");
  assert.match(ads, /provider:\s*"none"/);
});

test("the box set is 30 percent off the sum of placeholder book prices", () => {
  assert.equal(SHOP.openingSoon, true);
  assert.equal(SHOP.pricesAreFinal, false);
  assert.equal(SHOP.boxSetDiscount, 0.3);
  const quote = boxSetQuote([10, 10], 0.3);
  assert.equal(quote.sum, 20);
  assert.equal(quote.savings, 6);
  assert.equal(quote.total, 14);
  assert.match(priceLabel("14", SHOP), /Placeholder price/);
  assert.match(priceLabel("14", SHOP), /not final/);
  const top = FLAGSHIP_BOOKS.find((book) => book.slug === "top-100-sauces");
  assert.equal(top.slugs.length, 100);
  assert.match(top.selectionNote, /not a ranking/i);
  const appalachia = FLAGSHIP_BOOKS.find((book) => book.slug === "appalachian-sauces");
  for (const slug of ["red-eye-gravy", "sausage-gravy", "chocolate-gravy", "chow-chow", "sorghum-glaze"]) {
    assert.equal(appalachia.slugs.includes(slug), true);
  }
});

test("pages, map, books, and taste sections were generated", () => {
  assert.equal(fs.existsSync(path.join(root, ".nojekyll")), true);
  assert.equal(fs.existsSync(path.join(root, "sitemap.xml")), true);
  assert.equal(fs.existsSync(path.join(root, "robots.txt")), true);
  assert.equal(fs.existsSync(path.join(root, "supabase/schema.sql")), true);
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /Growing to 1,000/);
  assert.match(home, new RegExp(`${SAUCES.length} sauces`));
  const sauce = fs.readFileSync(path.join(root, "sauces/bechamel/index.html"), "utf8");
  assert.match(sauce, /Why it tastes this way/);
  assert.match(sauce, /Authentic touch/);
  assert.match(sauce, /application\/ld\+json/);
  const book = fs.readFileSync(path.join(root, "books/mother-sauces-and-classics/index.html"), "utf8");
  assert.match(book, /Why it tastes this way/);
  assert.match(book, /Béchamel/);
  const box = fs.readFileSync(path.join(root, "shop/complete-collection/index.html"), "utf8");
  assert.match(box, /Save 30%/);
  assert.match(box, /Coming soon/);
  assert.match(box, /Appalachian Sauces/);
  const topPage = fs.readFileSync(path.join(root, "books/top-100-sauces/index.html"), "utf8");
  assert.match(topPage, /not a ranking/i);
  assert.match(topPage, /continents/);
  const css = fs.readFileSync(path.join(root, "assets/css/styles.css"), "utf8");
  assert.match(css, /@media print/);
  assert.match(css, /\.ad-slot/);
  assert.match(home, /The sauces are the stops/);
  assert.match(home, /assets\/photos\//);
  assert.match(home, /Wikimedia Commons/);
  assert.equal(home.includes("upload.wikimedia.org"), false);
  const credits = fs.readFileSync(path.join(root, "credits/index.html"), "utf8");
  assert.match(credits, /CC BY/);
  assert.match(credits, /Photo by/);
  const pesto = fs.readFileSync(path.join(root, "sauces/pesto-alla-genovese/index.html"), "utf8");
  assert.match(pesto, /\.webp/);
  assert.match(pesto, /loading="eager"/);
  assert.match(pesto, /srcset=/);
  assert.match(pesto, /photograph of the sauce/);
  const plain = fs.readFileSync(path.join(root, "sauces/bechamel/index.html"), "utf8");
  assert.match(plain, /not the sauce/);
  assert.match(home, /Who settled the flavor/);
  const mojo = fs.readFileSync(path.join(root, "sauces/cuban-mojo/index.html"), "utf8");
  assert.match(mojo, /Arriving in Cuba/);
  assert.match(mojo, /Next stop/);
  assert.match(mojo, /Mojo Criollo/);
  assert.match(mojo, /Why it tastes this way/);
  assert.match(mojo, /Authentic touch/);
  const map = fs.readFileSync(path.join(root, "map/index.html"), "utf8");
  assert.match(map, /The route map/);
  assert.match(map, /balloon, plane, train, or boat/i);
  const journey = fs.readFileSync(path.join(root, "journeys/silk-road-by-train/index.html"), "utf8");
  assert.match(journey, /Train/);
  const louisiana = fs.readFileSync(path.join(root, "places/settlement/louisiana/index.html"), "utf8");
  assert.match(louisiana, /enslaved/i);
  const mountains = fs.readFileSync(path.join(root, "places/settlement/appalachia/index.html"), "utf8");
  assert.match(mountains, /does not assign/);
  const ireland = fs.readFileSync(path.join(root, "places/ireland/index.html"), "utf8");
  assert.match(ireland, /Parsley Sauce/);
  const known = new Set(SAUCES.map((sauce) => sauce.slug));
  for (const journey of JOURNEYS) {
    for (const slug of journey.stops) assert.equal(known.has(slug), true, slug);
  }
  for (const chapter of SETTLEMENTS) {
    for (const slug of chapter.sauces) assert.equal(known.has(slug), true, slug);
  }
  for (const place of PLACES) {
    assert.ok(SAUCES.filter((sauce) => place.match(sauce)).length >= 3, place.slug);
  }
  let missingTaste = 0;
  for (const sauce of SAUCES) {
    const html = fs.readFileSync(path.join(root, "sauces", sauce.slug, "index.html"), "utf8");
    if (!html.includes("Arriving in") || !html.includes("Why it tastes this way") || !html.includes("Authentic touch") || !html.includes("Next stop")) {
      missingTaste += 1;
    }
  }
  assert.equal(missingTaste, 0);
});
