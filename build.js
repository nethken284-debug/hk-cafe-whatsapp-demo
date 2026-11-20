#!/usr/bin/env node
/* ==========================================================================
   建置腳本：node build.js
   讀取 config.js，產生 dist/ 資料夾（部署時發布 dist/）：
   ・自動寫入 <title>、description、分享預覽（og:）標籤及網站小圖示
   ・demo: true  → 加入 noindex（示範網站不讓搜尋引擎收錄）
   ・demo: false → 一定沒有 noindex，並加入搜尋引擎用的店舖資料（JSON-LD）
   只需要 Node.js 18 或以上，不需要安裝任何套件。
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const C = require("./assets/core.js");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
// 這些檔案或資料夾不會發布
const SKIP = new Set([
  "dist", "node_modules", "tests", "tools", "screenshots", "build.js", "deploy-github-pages.sh",
  "README.md", "package.json",
]);

const fail = (msg) => {
  console.error("✗ " + msg);
  process.exit(1);
};
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- 1. 讀取設定檔 ---------- */
function loadConfig() {
  const file = path.join(ROOT, "config.js");
  const ctx = { window: {} };
  try {
    vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx, { filename: "config.js" });
  } catch (e) {
    const where = (String(e.stack).match(/config\.js:\d+/) || [""])[0];
    fail("config.js 有錯誤" + (where ? "（" + where + "）" : "") + "：" + e.message + "\n  多數是漏了逗號、引號或括號。");
  }
  if (!ctx.window.SHOP_CONFIG) fail("config.js 裏找不到 window.SHOP_CONFIG");
  return ctx.window.SHOP_CONFIG;
}

const raw = loadConfig();
const M = C.normalize(raw);
M.warnings.forEach((w) => console.warn("! " + w));

/* ---------- 2. 分享預覽資料 ---------- */
const share = raw.share || {};
let siteUrl = C.str(share.siteUrl);
if (siteUrl && !/^https?:\/\//.test(siteUrl)) fail("share.siteUrl 要以 https:// 開頭：" + siteUrl);
if (siteUrl && !siteUrl.endsWith("/")) siteUrl += "/";
if (!siteUrl) console.warn("! 未設定 share.siteUrl：分享預覽圖需要完整網址，部分 App 可能不顯示預覽圖。");

const image = C.str(share.image).replace(/^\.?\//, "");
if (!image) fail("請在 config.js 的 share.image 指定分享預覽圖（建議 1200×630）。");
const imagePath = path.join(ROOT, image);
if (!fs.existsSync(imagePath)) fail("找不到分享預覽圖：" + image);

const abs = (p) => (siteUrl ? new URL(p, siteUrl).href : p);
const title = C.str(share.title) || M.name + (M.nameEn ? " " + M.nameEn : "") + (M.kicker ? "｜" + M.kicker : "");
const desc = C.str(share.description) || M.description || M.tagline;
const isColor = (v) => /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|hsl)a?\([^"<>]*\)$/i.test(v);
const brand = isColor(M.theme.brand) ? M.theme.brand : "#b23a1e";
const paper = isColor(M.theme.paper) ? M.theme.paper : "#f5eee4";

function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  for (let i = 2; i + 9 < b.length; ) {
    // JPEG：找 SOF 區段
    if (b[i] !== 0xff) break;
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
const size = imageSize(imagePath);
if (size && (size.w < 600 || size.h < 315)) console.warn("! 分享預覽圖太細（" + size.w + "×" + size.h + "），建議 1200×630。");

/* ---------- 3. 產生 <head> 標籤 ---------- */
const meta = (attr, key, value) => (value ? `<meta ${attr}="${key}" content="${esc(value)}">` : "");
const head = [
  `<title>${esc(title)}</title>`,
  meta("name", "description", desc),
  M.demo ? meta("name", "robots", "noindex") : "",
  !M.demo && siteUrl ? `<link rel="canonical" href="${esc(siteUrl)}">` : "",
  meta("name", "theme-color", paper),
  meta("property", "og:type", "website"),
  meta("property", "og:locale", "zh_HK"),
  meta("property", "og:site_name", M.name),
  meta("property", "og:title", title),
  meta("property", "og:description", desc),
  siteUrl ? meta("property", "og:url", siteUrl) : "",
  meta("property", "og:image", abs(image)),
  size ? meta("property", "og:image:width", String(size.w)) : "",
  size ? meta("property", "og:image:height", String(size.h)) : "",
  meta("property", "og:image:alt", M.name),
  meta("name", "twitter:card", "summary_large_image"),
  meta("name", "twitter:title", title),
  meta("name", "twitter:description", desc),
  meta("name", "twitter:image", abs(image)),
  `<link rel="icon" href="favicon.svg" type="image/svg+xml">`,
];

if (!M.demo) {
  // 搜尋引擎用的店舖資料
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ld = {
    "@context": "https://schema.org",
    "@type": C.str(raw.schemaType) || "CafeOrCoffeeShop",
    name: M.name,
    alternateName: M.nameEn || undefined,
    description: desc || undefined,
    url: siteUrl || undefined,
    image: siteUrl ? abs(image) : undefined,
    hasMenu: siteUrl ? siteUrl + "#menu" : undefined,
    telephone: M.contact.phone ? "+" + M.contact.phone : undefined,
    address: M.contact.address
      ? { "@type": "PostalAddress", streetAddress: M.contact.address, addressCountry: "HK" }
      : undefined,
    openingHoursSpecification: M.hours.map((r) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: r.days.map((d) => DAYS[d]),
      opens: C.fmtHM(r.open),
      closes: C.fmtHM(r.close),
    })),
  };
  head.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
}

/* ---------- 4. 輸出 dist/ ---------- */
const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const MARK = /<!-- build:head[\s\S]*?<!-- \/build:head -->/;
if (!MARK.test(src)) fail("index.html 缺少 <!-- build:head --> … <!-- /build:head --> 標記");
const html = src.replace(MARK, head.filter(Boolean).join("\n  "));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name) || (name.startsWith(".") && name !== ".nojekyll")) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}
fs.writeFileSync(path.join(OUT, "index.html"), html);

// 網站小圖示：主色圓形配店名第一個字
const initial = esc(Array.from(M.name)[0] || "");
fs.writeFileSync(
  path.join(OUT, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${esc(brand)}"/>` +
    `<text x="32" y="43" font-size="32" font-weight="700" text-anchor="middle" fill="#fff" ` +
    `font-family="'Songti TC','Noto Serif TC',serif">${initial}</text></svg>`
);

/* ---------- 5. 上線前檢查 ---------- */
const hasNoindex = /noindex/i.test(html);
if (!M.demo && hasNoindex) fail("demo: false 但網頁仍有 noindex，請檢查 index.html。");
if (!M.demo && /^852(0{8}|1234567\d)$/.test(M.contact.whatsapp))
  fail("demo: false 但 WhatsApp 號碼仍是示範用的假號碼：" + M.contact.whatsapp);

console.log("✓ 已產生 dist/");
console.log("  店舖：" + M.name + (M.demo ? "（示範模式：noindex）" : "（正式模式：可被搜尋引擎收錄）"));
console.log("  標題：" + title);
console.log("  分享預覽圖：" + abs(image) + (size ? "（" + size.w + "×" + size.h + "）" : ""));
console.log("  WhatsApp 落單：" + (M.order.enabled ? "開啟（" + C.phoneText(M.contact.whatsapp) + "）" : "關閉"));
