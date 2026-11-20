// 核心邏輯測試。執行：node --test tests/
// （只需安裝 Node.js 18 或以上，不需要其他套件）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const C = require("../assets/core.js");

function loadConfig() {
  const code = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
  const ctx = { window: {} };
  vm.runInNewContext(code, ctx);
  return ctx.window.SHOP_CONFIG;
}
const RAW = loadConfig();
const M = C.normalize(RAW);
// 2026-11-20 是星期五
const at = (hm, date = "2026-11-20") => C.zonedNow("Asia/Hong_Kong", `${date}T${hm}:00+08:00`);

test("設定檔沒有警告，菜單 12–16 項", () => {
  assert.deepEqual(M.warnings, []);
  const count = M.categories.reduce((s, c) => s + c.items.length, 0);
  assert.ok(count >= 12 && count <= 16, `共 ${count} 項`);
  assert.equal(M.contact.whatsapp, "85200000000");
});

test("示範訂單：訊息格式、金額及 wa.me 連結", () => {
  let lines = [];
  lines = C.addLine(M, lines, { id: "檸茶", opts: { temp: "凍", sweet: "少甜" }, qty: 2 });
  lines = C.addLine(M, lines, { id: "火腿芝士多士", opts: { egg: "不用" }, qty: 1 });
  const sum = C.summarize(M, lines);
  assert.equal(sum.total, 94);
  assert.equal(sum.qty, 3);
  const now = at("12:00");
  const form = { name: "陳先生", mode: "pickup", date: "2026-11-20", time: "12:30", note: "" };
  assert.ok(C.validateOrder(M, sum, form, now).ok);
  const msg = C.buildMessage(M, sum, form, now);
  assert.equal(
    msg,
    [
      "【新訂單】",
      "稱呼：陳先生",
      "取餐：自取 12:30",
      "---",
      "凍檸茶（少甜）×2　$56",
      "火腿芝士多士 ×1　$38",
      "---",
      "合共：$94",
    ].join("\n")
  );
  const url = C.waUrl(M.contact.whatsapp, msg);
  assert.ok(url.startsWith("https://wa.me/85200000000?text="));
  assert.equal(decodeURIComponent(url.split("?text=")[1]), msg);
  assert.ok(url.includes("%0A"), "換行要編碼為 %0A");
  assert.ok(!/[一-鿿\s]/.test(url), "連結內不應有未編碼的中文或空白");
});

test("相同選項合併、不同選項分開、數量上限、刪除", () => {
  let lines = [];
  lines = C.addLine(M, lines, { id: "鮮奶咖啡", opts: { temp: "熱", milk: "鮮奶" }, qty: 1 });
  lines = C.addLine(M, lines, { id: "鮮奶咖啡", opts: { milk: "鮮奶", temp: "熱" }, qty: 2 });
  lines = C.addLine(M, lines, { id: "鮮奶咖啡", opts: { temp: "凍", milk: "燕麥奶" }, qty: 1 });
  assert.equal(lines.length, 2);
  let sum = C.summarize(M, lines);
  assert.equal(sum.lines[0].qty, 3);
  assert.equal(sum.lines[0].label, "熱鮮奶咖啡");
  assert.equal(sum.lines[1].label, "凍鮮奶咖啡（燕麥奶）");
  assert.equal(sum.lines[1].unit, 36 + 3 + 6);
  assert.equal(sum.total, 36 * 3 + 45);
  const key = sum.lines[0].key;
  lines = C.setQty(M, lines, key, 999);
  assert.equal(C.summarize(M, lines).lines[0].qty, M.order.maxQty);
  lines = C.removeLine(M, lines, key);
  sum = C.summarize(M, lines);
  assert.equal(sum.lines.length, 1);
  assert.equal(sum.total, 45);
});

test("售罄、不存在或選項不正確的項目不能加入", () => {
  assert.equal(C.addLine(M, [], { id: "手沖單品", opts: {}, qty: 1 }).length, 0);
  assert.equal(C.addLine(M, [], { id: "不存在", opts: {}, qty: 1 }).length, 0);
  assert.equal(C.addLine(M, [], { id: "檸茶", opts: { temp: "暖", sweet: "正常" }, qty: 1 }).length, 0);
  assert.equal(C.addLine(M, [], { id: "檸茶", opts: { temp: "熱" }, qty: 1 }).length, 0);
  const s = C.summarize(M, [
    { id: "手沖單品", opts: {}, qty: 1 },
    { id: "美式咖啡", opts: { temp: "凍" }, qty: 2 },
  ]);
  assert.equal(s.dropped, 1);
  assert.equal(s.total, 66);
});

test("價錢不是整數時四捨五入並提示", () => {
  const raw = JSON.parse(JSON.stringify(RAW));
  raw.menu[0].items[0].price = 30.5;
  const m = C.normalize(raw);
  assert.equal(m.items["美式咖啡"].price, 31);
  assert.equal(m.warnings.length, 1);
  assert.equal(C.money(1234), "$1,234");
});

test("時區換算（以香港時間計算）", () => {
  const n = C.zonedNow("Asia/Hong_Kong", "2026-11-20T15:38:00Z");
  assert.deepEqual(n, { date: "2026-11-20", dow: 5, min: 23 * 60 + 38 });
});

test("自取時間：營業時間內、最少晚 20 分鐘", () => {
  const now = at("12:00");
  const chk = (time, date = "2026-11-20") => C.checkPickup(M, now, date, time);
  assert.equal(chk("12:30").ok, true);
  assert.equal(chk("12:20").ok, true);
  assert.equal(chk("12:10").code, "soon");
  assert.match(chk("12:10").msg, /最早可選 12:20/);
  assert.equal(chk("18:00").code, "outside");
  assert.equal(chk("17:59").ok, true);
  assert.equal(chk("07:30").code, "outside");
  assert.equal(chk("08:30", "2026-11-21").code, "outside");
  assert.equal(chk("09:00", "2026-11-21").ok, true);
  assert.equal(chk("10:00", "2026-11-22").code, "date");
  assert.equal(chk("", "2026-11-20").code, "missing");
});

test("夜晚：今日已無時間，只可選明日", () => {
  const now = at("23:38");
  const days = C.pickupDays(M, now);
  assert.equal(days.length, 1);
  assert.equal(days[0].date, "2026-11-21");
  assert.equal(C.fmtHM(days[0].first), "09:00");
  assert.equal(days[0].label, "明日 11月21日（星期六）");
  assert.equal(C.openStatus(M, now).text, "休息中・明日 09:00 開門");
  assert.equal(C.checkPickup(M, now, "2026-11-20", "17:00").code, "soon");
});

test("營業狀態及最早時間取整至 5 分鐘", () => {
  const now = at("12:03");
  assert.equal(C.openStatus(M, now).text, "營業中・今日 18:00 關門");
  assert.equal(C.fmtHM(C.earliestOn(M, now, "2026-11-20")), "12:25");
  const early = at("06:00");
  assert.equal(C.fmtHM(C.earliestOn(M, early, "2026-11-20")), "08:00");
  assert.equal(C.openStatus(M, early).text, "休息中・今日 08:00 開門");
});

test("堂食：需要枱號，非營業時間不接受", () => {
  const sum = C.summarize(M, C.addLine(M, [], { id: "蛋沙律牛角包", opts: {}, qty: 1 }));
  const form = { name: "李小姐", mode: "dinein", table: "", note: "" };
  assert.equal(C.validateOrder(M, sum, form, at("12:00")).errors.table, "請填寫枱號。");
  form.table = "5";
  assert.ok(C.validateOrder(M, sum, form, at("12:00")).ok);
  assert.ok(C.validateOrder(M, sum, form, at("20:00")).errors.mode);
  assert.match(C.buildMessage(M, sum, form, at("12:00")), /^取餐：堂食（枱號 5）$/m);
});

test("空清單及未填稱呼", () => {
  const form = { name: " ", mode: "pickup", date: "2026-11-20", time: "12:30" };
  const v = C.validateOrder(M, C.summarize(M, []), form, at("12:00"));
  assert.equal(v.ok, false);
  assert.ok(v.errors.cart);
  assert.ok(v.errors.name);
});

test("預訂明日：訊息附日期；輸入內容會清理", () => {
  const sum = C.summarize(M, C.addLine(M, [], { id: "檸檬撻", opts: {}, qty: 2 }));
  const form = { name: "  Amy\n", mode: "pickup", date: "2026-11-21", time: "9:05", note: "少冰\n多謝" };
  const now = at("23:00");
  assert.ok(C.validateOrder(M, sum, form, now).ok);
  const msg = C.buildMessage(M, sum, form, now);
  assert.match(msg, /^稱呼：Amy$/m);
  assert.match(msg, /^取餐：自取 11月21日（星期六）09:05$/m);
  assert.match(msg, /^檸檬撻 ×2　\$72$/m);
  assert.match(msg, /^備註：少冰 多謝$/m);
});
