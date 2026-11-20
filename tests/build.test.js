// 建置測試：檢查 dist/index.html 已預先渲染全部店舖資料，以及 noindex 規則。
// 執行：node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync, spawnSync } = require("node:child_process");
const C = require("../assets/core.js");

const ROOT = path.join(__dirname, "..");
const FILES = ["index.html", "config.js", "build.js", "lib", "assets", ".nojekyll"];

// 在暫存資料夾建置，不影響專案的 dist/
function buildCopy(editConfig) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shop-build-"));
  FILES.forEach((f) => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
  if (editConfig) {
    const file = path.join(dir, "config.js");
    fs.writeFileSync(file, editConfig(fs.readFileSync(file, "utf8")));
  }
  const r = spawnSync(process.execPath, ["build.js"], { cwd: dir, encoding: "utf8" });
  const html = r.status === 0 ? fs.readFileSync(path.join(dir, "dist", "index.html"), "utf8") : "";
  fs.rmSync(dir, { recursive: true, force: true });
  return { status: r.status, out: r.stdout + r.stderr, html };
}

function loadModel() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "config.js"), "utf8"), ctx);
  return C.normalize(ctx.window.SHOP_CONFIG);
}
// 移除 <script>、<style> 後的純文字（即停用 JavaScript 時看到的內容）
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&");

test("示範模式：全部店舖資料已寫入靜態 HTML，並有 noindex", () => {
  const M = loadModel();
  const { status, html } = buildCopy();
  assert.equal(status, 0);
  assert.ok(!/\{\{/.test(html), "不應留下模板標記");
  const text = visibleText(html);
  const must = [M.name, M.nameEn, M.tagline, M.contact.address, M.contact.directions, M.hoursNote, "示範作品・店名及內容純屬虛構"];
  M.about.paragraphs.forEach((p) => must.push(p));
  M.categories.forEach((c) => {
    must.push(c.name);
    c.items.forEach((it) => must.push(it.name, it.desc, C.money(it.price)));
  });
  M.hours.forEach((r) => must.push(C.fmtHM(r.open) + "–" + C.fmtHM(r.close)));
  must.filter(Boolean).forEach((s) => assert.ok(text.includes(s), "缺少：" + s));
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+og-image\.jpg">/);
  assert.match(html, /id="order-help"/, "未啟用 JavaScript 時應有落單提示");
});

test("正式模式：沒有 noindex，有店舖資料；仍用假號碼則建置失敗", () => {
  const prod = (s) => s.replace("demo: true,", "demo: false,");
  const fake = buildCopy(prod);
  assert.notEqual(fake.status, 0);
  assert.match(fake.out, /假號碼/);
  const ok = buildCopy((s) => prod(s).replace('whatsapp: "85200000000"', 'whatsapp: "85261234567"'));
  assert.equal(ok.status, 0);
  assert.ok(!/noindex/i.test(ok.html));
  assert.ok(!ok.html.includes("示範作品"));
  assert.match(ok.html, /application\/ld\+json/);
});

test("關閉落單：沒有落單按鈕及提示", () => {
  const { status, html } = buildCopy((s) => s.replace("enabled: true, // false", "enabled: false, // false"));
  assert.equal(status, 0);
  assert.ok(!html.includes("data-action-for"));
  assert.ok(!html.includes('id="order-help"'));
  assert.match(html, /查看菜單/);
});
