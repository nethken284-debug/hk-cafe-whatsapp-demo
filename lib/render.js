/* ==========================================================================
   lib/render.js：建置時把 config.js 的內容預先渲染成靜態 HTML
   （首屏、關於我們、菜單、營業時間、地址及聯絡、頁尾）
   由 build.js 使用；換店時不需要修改。
   ========================================================================== */
"use strict";
const C = require("../assets/core.js");

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const safeUrl = (u) => (/^(https?:|mailto:|tel:)/i.test(u) ? u : "");

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/>',
  phone:
    '<path d="M5.2 4h3.3l1.6 4.1-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4.1 1.6v3.3a1.2 1.2 0 0 1-1.3 1.2A16 16 0 0 1 4 5.3 1.2 1.2 0 0 1 5.2 4Z"/>',
  chat: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z"/>',
  ig: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.2 6.8h.01"/>',
  wa: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z"/><path d="M9 9.5c.3 2.3 2.2 4.3 4.6 4.8l1.2-1.2 1.7.8"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[n]}</svg>`;

function mapUrl(M) {
  const own = safeUrl(M.contact.mapUrl);
  if (own) return own;
  const q = M.contact.mapQuery || M.contact.address || M.name;
  return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q);
}

// 選項標籤，例如「熱／凍（凍 +$3）」、「可選：燕麥奶 +$6」
function optionTag(g) {
  const [first, second] = g.choices;
  if (g.choices.length === 2 && first.hideInOrder && !first.price)
    return "可選：" + second.label + (second.price ? " +" + C.money(second.price) : "");
  const extras = g.choices.filter((c) => c.price);
  return (
    g.choices.map((c) => c.label).join("／") +
    (extras.length ? "（" + extras.map((c) => c.label + " +" + C.money(c.price)).join("、") + "）" : "")
  );
}

function renderItem(M, it) {
  const tags = it.options.map((k) => `<li>${esc(optionTag(M.groups[k]))}</li>`).join("");
  const action = M.order.enabled
    ? `<div class="item-action" data-action-for="${esc(it.id)}">` +
      (it.soldOut
        ? `<span class="btn-add is-off">售罄</span>`
        : `<noscript><a class="btn-add" href="#order-help">${icon("plus")}加入</a></noscript>`) +
      `</div>`
    : "";
  return (
    `<li class="item${it.soldOut ? " is-soldout" : ""}" data-id="${esc(it.id)}">` +
    (it.image
      ? `<img class="item-img" src="${esc(it.image)}" alt="${esc(it.name)}" width="76" height="76" loading="lazy" decoding="async">`
      : "") +
    `<div class="item-main"><div class="item-head">` +
    `<h4 class="item-name">${esc(it.name)}</h4>` +
    (it.badge ? `<span class="badge">${esc(it.badge)}</span>` : "") +
    (it.soldOut ? `<span class="badge badge-out">售罄</span>` : "") +
    `<span class="item-leader" aria-hidden="true"></span>` +
    `<span class="item-price">${C.money(it.price)}</span></div>` +
    (it.desc ? `<p class="item-desc">${esc(it.desc)}</p>` : "") +
    `<div class="item-foot">` +
    (tags ? `<ul class="item-tags" aria-label="可選項目">${tags}</ul>` : "") +
    action +
    `</div></div></li>`
  );
}

function renderHours(M) {
  const rows = [];
  M.hours.forEach((r) => {
    const prev = rows.find((x) => x.label === r.label && x.days.join() === r.days.join());
    if (prev) prev.times.push(r);
    else rows.push({ label: r.label || r.days.map((d) => "星期" + C.WEEKDAYS[d]).join("、"), days: r.days, times: [r] });
  });
  const openDays = new Set(M.hours.flatMap((r) => r.days));
  const closed = [1, 2, 3, 4, 5, 6, 0].filter((d) => !openDays.has(d));
  if (closed.length && M.hours.length)
    rows.push({ label: closed.map((d) => "星期" + C.WEEKDAYS[d]).join("、"), days: closed, times: null });
  return rows
    .map(
      (r) =>
        `<div class="hours-row" data-days="${r.days.join(",")}"><dt>${esc(r.label)}</dt>` +
        `<dd>${r.times ? esc(C.hoursText(r.times)) : "休息"}</dd></div>`
    )
    .join("");
}

function renderContact(M) {
  const c = M.contact;
  const row = (ic, label, value, sub) =>
    `<li class="contact-item">${icon(ic)}<div><span class="contact-label">${label}</span>` +
    `<div class="contact-value">${value}</div>${sub ? `<div class="contact-sub">${esc(sub)}</div>` : ""}</div></li>`;
  const out = [];
  if (c.address) out.push(row("pin", "地址", esc(c.address), c.directions));
  if (c.phone) out.push(row("phone", "電話", `<a href="tel:+${c.phone}">${esc(C.phoneText(c.phone))}</a>`));
  if (c.whatsapp)
    out.push(
      row(
        "chat",
        "WhatsApp",
        `<a href="${esc(C.waUrl(c.whatsapp))}" target="_blank" rel="noopener">${esc(C.phoneText(c.whatsapp))}</a>`,
        M.order.enabled ? "查詢或落單" : "查詢"
      )
    );
  const ig = safeUrl(c.instagram);
  if (ig) {
    const handle = "@" + (ig.replace(/\/+$/, "").split("/").pop() || "instagram");
    out.push(row("ig", "Instagram", `<a href="${esc(ig)}" target="_blank" rel="noopener">${esc(handle)}</a>`));
  }
  if (c.email) out.push(row("mail", "電郵", `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`));
  return out.join("");
}

/* 回傳 index.html 模板內各個 {{…}} 的內容 */
function render(M, opts = {}) {
  const order = M.order.enabled;
  const initial = Array.from(M.name)[0] || "";
  const map = mapUrl(M);

  const heroCopy =
    (M.kicker ? `<p class="kicker">${esc(M.kicker)}</p>` : "") +
    `<h1 class="hero-title"><span class="hero-name">${esc(M.name)}</span>` +
    (M.nameEn ? `<span class="hero-en" lang="en">${esc(M.nameEn)}</span>` : "") +
    `</h1>` +
    (M.tagline ? `<p class="hero-tagline">${esc(M.tagline)}</p>` : "") +
    `<div class="hero-actions"><a class="btn btn-primary" href="#menu" id="heroOrder">${order ? "立即落單" : "查看菜單"}</a>` +
    `<a class="btn btn-outline" href="${esc(map)}" id="heroMap" target="_blank" rel="noopener">${icon("pin")}Google 地圖導航</a></div>` +
    `<p class="status" id="heroStatus" hidden><span class="status-dot" aria-hidden="true"></span><span class="status-text"></span></p>`;

  const catNav = M.categories
    .map((c) => `<a class="cat-chip" href="#cat-${c.index}" data-cat="cat-${c.index}">${esc(c.name)}</a>`)
    .join("");
  const menuList = M.categories
    .map(
      (cat) =>
        `<section class="menu-cat" id="cat-${cat.index}" aria-labelledby="cat-${cat.index}-t">` +
        `<div class="menu-cat-head"><h3 class="menu-cat-title" id="cat-${cat.index}-t">${esc(cat.name)}</h3>` +
        (cat.nameEn ? `<span class="menu-cat-en" lang="en">${esc(cat.nameEn)}</span>` : "") +
        `</div><ul class="menu-items">${cat.items.map((it) => renderItem(M, it)).join("")}</ul></section>`
    )
    .join("");

  const orderHelp = order
    ? `<noscript><div class="nojs-note" id="order-help"><strong>網上落單需要啟用 JavaScript。</strong>` +
      `你仍可瀏覽菜單，或直接以 WhatsApp <a href="${esc(C.waUrl(M.contact.whatsapp))}" target="_blank" rel="noopener">${esc(
        C.phoneText(M.contact.whatsapp)
      )}</a> 落單。</div></noscript>`
    : "";

  // 製作者署名：「網站由 {name} 製作・查詢」
  const cr = M.credit;
  const crLink = (text, label) =>
    `<a href="${esc(cr.url)}" target="_blank" rel="noopener"${label ? ` aria-label="${esc(label)}"` : ""}>${text}</a>`;
  const credit = cr.name
    ? `<p class="footer-credit">網站由 ${cr.url ? crLink(esc(cr.name)) : esc(cr.name)} 製作` +
      (cr.url ? `・${crLink("查詢", "查詢網站製作（" + cr.name + "）")}` : "") +
      `</p>`
    : "";
  const footer =
    `<p class="footer-brand">${esc(M.name)}${M.nameEn ? ` <span lang="en">${esc(M.nameEn)}</span>` : ""}</p>` +
    (M.demo ? `<p class="footer-demo">示範作品・店名及內容純屬虛構</p>` : "") +
    `<p class="footer-copy">© ${opts.year || new Date().getFullYear()} ${esc(M.name)}</p>` +
    credit;

  // 「用 WhatsApp 發送」：正式模式是開啟 wa.me 的連結；示範模式是按鈕，只顯示說明視窗
  const sendLabel = `${icon("wa")}用 WhatsApp 發送`;
  const sendButton = M.demo
    ? `<button type="button" class="btn btn-wa" id="waSend" aria-haspopup="dialog">${sendLabel}</button>`
    : `<a class="btn btn-wa" id="waSend" href="#" target="_blank" rel="noopener">${sendLabel}</a>`;
  const demoDialog =
    M.demo && order
      ? `<dialog class="modal" id="demoDialog" aria-labelledby="demoTitle"><div class="sheet-inner">` +
        `<div class="sheet-head"><h3 class="sheet-title" id="demoTitle">示範網站</h3>` +
        `<button type="button" class="icon-btn" data-close aria-label="關閉"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>` +
        `<div class="sheet-body"><p class="modal-lead">這是示範網站。正式網站按下此按鈕後，會打開 WhatsApp 並自動填好以下訂單訊息，直接發送給店舖。</p>` +
        `<div class="chat"><pre class="bubble" id="demoText"></pre></div></div>` +
        `<div class="sheet-foot modal-actions"><button type="button" class="btn btn-outline" data-close>返回</button>` +
        (cr.url ? `<a class="btn btn-primary" id="demoCta" href="${esc(cr.url)}" target="_blank" rel="noopener">我也想要這樣的網站</a>` : "") +
        `</div></div></dialog>`
      : "";

  const hasAbout = M.about.paragraphs.length || M.about.highlights.length;

  return {
    brand: `<span class="brand-mark" aria-hidden="true">${esc(initial)}</span><span class="brand-name">${esc(M.name)}</span>`,
    heroCopy,
    aboutAttr: hasAbout ? "" : " hidden",
    aboutText: M.about.paragraphs.map((p) => `<p>${esc(p)}</p>`).join(""),
    aboutHighlights: M.about.highlights.length
      ? `<ul class="highlights">${M.about.highlights.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
      : "",
    notice: esc(M.order.notice),
    orderHelp,
    catNav,
    menuList,
    hoursList: renderHours(M),
    hoursNote: M.hoursNote ? `<p class="fine" id="hoursNote">${esc(M.hoursNote)}</p>` : "",
    contactList: renderContact(M),
    contactActions:
      `<div class="contact-actions"><a class="btn btn-primary" href="${esc(map)}" target="_blank" rel="noopener">${icon("pin")}Google 地圖導航</a>` +
      (M.contact.phone ? `<a class="btn btn-outline" href="tel:+${M.contact.phone}">${icon("phone")}致電</a>` : "") +
      `</div>`,
    footer,
    sendButton,
    demoDialog,
    name: esc(M.name),
  };
}

// 標題字型（Noto Serif TC、Fraunces）只需下載頁面用到的字
function fontChars(M) {
  let text =
    "0123456789$,.:–—-+×／・（）關於我們菜單營業時間地址及聯絡購物清單訂單預覽取餐資料Our story Menu Opening hours Find us";
  text += M.name + M.nameEn;
  M.categories.forEach((c) => {
    text += c.name + c.nameEn;
    c.items.forEach((it) => (text += it.name));
  });
  M.about.paragraphs.forEach((p) => (text += Array.from(p)[0] || ""));
  return Array.from(new Set(Array.from(text.replace(/\s+/g, ""))))
    .sort()
    .join("");
}

module.exports = { render, fontChars, esc };
