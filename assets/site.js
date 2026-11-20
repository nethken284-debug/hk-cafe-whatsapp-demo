/* ==========================================================================
   site.js：按 config.js 產生網頁內容
   （首屏、關於我們、菜單、營業時間、地址及聯絡、頁尾）
   換店時一般不需要修改這個檔案。
   ========================================================================== */
(function () {
  "use strict";

  const C = window.ShopCore;
  const raw = window.SHOP_CONFIG;
  const root = document.documentElement;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  if (!C || !raw) {
    const box = $("#configError");
    if (box) {
      box.textContent =
        "設定檔（config.js）載入失敗：請檢查是否漏了逗號、引號或括號。在電腦瀏覽器按 F12 打開「Console」可看到出錯位置。";
      box.hidden = false;
    }
    root.classList.add("ready");
    return;
  }

  const M = C.normalize(raw);
  M.warnings.forEach((w) => console.warn("[設定檔] " + w));

  /* ---------- 小工具 ---------- */
  // 建立元素：h("p", { class: "x" }, "文字", 子元素…)。文字一律以純文字加入，不會被當成 HTML。
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : String(v));
      });
    }
    kids.flat(Infinity).forEach((c) => {
      if (c == null || c === false || c === "") return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  // 固定圖示（內容寫死在這裏，不含設定檔文字）
  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/>',
    phone:
      '<path d="M5.2 4h3.3l1.6 4.1-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4.1 1.6v3.3a1.2 1.2 0 0 1-1.3 1.2A16 16 0 0 1 4 5.3 1.2 1.2 0 0 1 5.2 4Z"/>',
    chat: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z"/>',
    ig: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.2 6.8h.01"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
    trash: '<path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 12.5h9L17.5 7M10 10.5v6M14 10.5v6"/>',
  };
  function icon(name) {
    const wrap = document.createElement("span");
    wrap.innerHTML =
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[name] + "</svg>";
    return wrap.firstChild;
  }
  const safeUrl = (u) => (/^(https?:|mailto:|tel:)/i.test(u) ? u : "");

  function mapUrl() {
    const own = safeUrl(M.contact.mapUrl);
    if (own) return own;
    const q = M.contact.mapQuery || M.contact.address || M.name;
    return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q);
  }

  /* ---------- 顏色 ---------- */
  function applyTheme() {
    ["brand", "accent", "ink", "paper"].forEach((k) => {
      const v = M.theme[k];
      if (!v) return;
      if (window.CSS && CSS.supports && !CSS.supports("color", v)) {
        console.warn(`[設定檔] theme.${k} 不是有效的顏色：${v}`);
        return;
      }
      root.style.setProperty("--" + k, v);
    });
    const meta = $('meta[name="theme-color"]');
    if (meta && M.theme.paper) meta.setAttribute("content", M.theme.paper);
  }

  // <title>、description、分享預覽、noindex 及網站小圖示由 build.js 按 config.js 產生

  /* ---------- 文字欄位 ---------- */
  function bindText() {
    const values = {
      name: M.name,
      nameEn: M.nameEn,
      kicker: M.kicker,
      tagline: M.tagline,
      notice: M.order.notice,
      initial: Array.from(M.name)[0] || "",
    };
    $$("[data-bind]").forEach((el) => {
      const v = values[el.dataset.bind];
      if (v) el.textContent = v;
      else el.hidden = true;
    });
  }

  function renderHero() {
    const map = $("#heroMap");
    map.href = mapUrl();
    map.target = "_blank";
    map.rel = "noopener";
    if (!M.order.enabled) $("#heroOrder").textContent = "查看菜單";
  }

  function renderAbout() {
    const text = $("#aboutText");
    const list = $("#aboutHighlights");
    M.about.paragraphs.forEach((p) => text.append(h("p", null, p)));
    M.about.highlights.forEach((t) => list.append(h("li", null, t)));
    if (!M.about.highlights.length) list.hidden = true;
    if (!M.about.paragraphs.length && !M.about.highlights.length) $("#about").hidden = true;
  }

  /* ---------- 菜單 ---------- */
  // 選項標籤，例如「熱／凍（凍 +$3）」、「可選：燕麥奶 +$6」
  function optionTag(g) {
    const [first, second] = g.choices;
    if (g.choices.length === 2 && first.hideInOrder && !first.price) {
      return "可選：" + second.label + (second.price ? " +" + C.money(second.price) : "");
    }
    const extras = g.choices.filter((c) => c.price);
    return (
      g.choices.map((c) => c.label).join("／") +
      (extras.length ? "（" + extras.map((c) => c.label + " +" + C.money(c.price)).join("、") + "）" : "")
    );
  }

  function renderItem(it) {
    const tags = it.options.map((k) => h("li", null, optionTag(M.groups[k])));
    return h(
      "li",
      { class: "item" + (it.soldOut ? " is-soldout" : ""), "data-id": it.id },
      it.image
        ? h("img", { class: "item-img", src: it.image, alt: it.name, width: 76, height: 76, loading: "lazy", decoding: "async" })
        : null,
      h(
        "div",
        { class: "item-main" },
        h(
          "div",
          { class: "item-head" },
          h("h4", { class: "item-name" }, it.name),
          it.badge ? h("span", { class: "badge" }, it.badge) : null,
          it.soldOut ? h("span", { class: "badge badge-out" }, "售罄") : null,
          h("span", { class: "item-leader", "aria-hidden": "true" }),
          h("span", { class: "item-price" }, C.money(it.price))
        ),
        it.desc ? h("p", { class: "item-desc" }, it.desc) : null,
        h(
          "div",
          { class: "item-foot" },
          tags.length ? h("ul", { class: "item-tags", "aria-label": "可選項目" }, tags) : null,
          h("div", { class: "item-action order-only", "data-action-for": it.id })
        )
      )
    );
  }

  function renderMenu() {
    const list = $("#menuList");
    const nav = $("#catNav");
    M.categories.forEach((cat) => {
      const id = "cat-" + cat.index;
      list.append(
        h(
          "section",
          { class: "menu-cat", id, "aria-labelledby": id + "-t" },
          h(
            "div",
            { class: "menu-cat-head" },
            h("h3", { class: "menu-cat-title", id: id + "-t" }, cat.name),
            cat.nameEn ? h("span", { class: "menu-cat-en", lang: "en" }, cat.nameEn) : null
          ),
          h("ul", { class: "menu-items" }, cat.items.map(renderItem))
        )
      );
      nav.append(h("a", { class: "cat-chip", href: "#" + id, "data-cat": id }, cat.name));
    });
    setupScrollSpy();
  }

  // 捲動時自動標示目前的菜單分類
  function setupScrollSpy() {
    const nav = $("#catNav");
    const chips = $$(".cat-chip", nav);
    if (!chips.length) return;
    let current = "";
    const setActive = (id) => {
      if (id === current) return;
      current = id;
      chips.forEach((c) => {
        if (c.dataset.cat === id) {
          c.setAttribute("aria-current", "true");
          const left = c.offsetLeft - (nav.clientWidth - c.offsetWidth) / 2;
          nav.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
        } else {
          c.removeAttribute("aria-current");
        }
      });
    };
    setActive(chips[0].dataset.cat);
    if (!("IntersectionObserver" in window)) return;
    const seen = {};
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          seen[e.target.id] = e.isIntersecting;
        });
        const first = chips.map((c) => c.dataset.cat).find((id) => seen[id]);
        if (first) setActive(first);
      },
      { rootMargin: "-80px 0px -55% 0px" }
    );
    $$(".menu-cat").forEach((s) => io.observe(s));
  }

  /* ---------- 營業時間 ---------- */
  function renderHours(now) {
    const dl = $("#hoursList");
    dl.textContent = "";
    const rows = [];
    M.hours.forEach((r) => {
      const prev = rows.find((x) => x.label === r.label && x.days.join() === r.days.join());
      if (prev) prev.times.push(r);
      else
        rows.push({
          label: r.label || r.days.map((d) => "星期" + C.WEEKDAYS[d]).join("、"),
          days: r.days,
          times: [r],
        });
    });
    const openDays = new Set(M.hours.flatMap((r) => r.days));
    const closed = [1, 2, 3, 4, 5, 6, 0].filter((d) => !openDays.has(d));
    if (closed.length && M.hours.length)
      rows.push({ label: closed.map((d) => "星期" + C.WEEKDAYS[d]).join("、"), days: closed, times: null });

    rows.forEach((r) => {
      const today = r.days.indexOf(now.dow) >= 0;
      dl.append(
        h(
          "div",
          { class: "hours-row" + (today ? " is-today" : "") },
          h("dt", null, r.label, today ? h("span", { class: "today-tag" }, "今日") : null),
          h("dd", null, r.times ? C.hoursText(r.times) : "休息")
        )
      );
    });
    const note = $("#hoursNote");
    note.textContent = M.hoursNote;
    note.hidden = !M.hoursNote;
  }

  function renderStatus(now) {
    if (!M.hours.length) return;
    const st = C.openStatus(M, now);
    ["#heroStatus", "#hoursStatus"].forEach((sel) => {
      const el = $(sel);
      el.hidden = false;
      el.classList.toggle("is-open", st.open);
      $(".status-text", el).textContent = st.text;
    });
  }

  /* ---------- 地址及聯絡 ---------- */
  function renderContact() {
    const c = M.contact;
    const list = $("#contactList");
    const row = (ic, label, value, sub) =>
      h(
        "li",
        { class: "contact-item" },
        icon(ic),
        h(
          "div",
          null,
          h("span", { class: "contact-label" }, label),
          h("div", { class: "contact-value" }, value),
          sub ? h("div", { class: "contact-sub" }, sub) : null
        )
      );
    if (c.address) list.append(row("pin", "地址", c.address, c.directions));
    if (c.phone) list.append(row("phone", "電話", h("a", { href: "tel:+" + c.phone }, C.phoneText(c.phone))));
    if (c.whatsapp)
      list.append(
        row(
          "chat",
          "WhatsApp",
          h("a", { href: C.waUrl(c.whatsapp), target: "_blank", rel: "noopener" }, C.phoneText(c.whatsapp)),
          M.order.enabled ? "查詢或落單" : "查詢"
        )
      );
    const ig = safeUrl(c.instagram);
    if (ig) {
      const handle = "@" + (ig.replace(/\/+$/, "").split("/").pop() || "instagram");
      list.append(row("ig", "Instagram", h("a", { href: ig, target: "_blank", rel: "noopener" }, handle)));
    }
    if (c.email) list.append(row("mail", "電郵", h("a", { href: "mailto:" + c.email }, c.email)));

    list.after(
      h(
        "div",
        { class: "contact-actions" },
        h("a", { class: "btn btn-primary", href: mapUrl(), target: "_blank", rel: "noopener" }, icon("pin"), "Google 地圖導航"),
        c.phone ? h("a", { class: "btn btn-outline", href: "tel:+" + c.phone }, icon("phone"), "致電") : null
      )
    );
  }

  function renderFooter() {
    $("#footerDemo").hidden = !M.demo;
    $("#footerCopy").textContent = "© " + new Date().getFullYear() + " " + M.name;
    if (M.footer.credit) {
      const el = $("#footerCredit");
      const url = safeUrl(M.footer.creditUrl);
      el.append(url ? h("a", { href: url, target: "_blank", rel: "noopener" }, M.footer.credit) : M.footer.credit);
      el.hidden = false;
    }
  }

  /* ---------- 網上字型 ----------
     標題用的 Noto Serif TC（中文）及 Fraunces（英文、數字）。
     只下載頁面用到的字（Google Fonts 的 text= 功能），檔案很小；載入失敗會自動改用裝置字型。 */
  function loadFonts() {
    if (!M.theme.webFont) return;
    let text = "0123456789$,.:–—-+×／・（）";
    $$(
      "h1, h2, h3, h4, .brand, .eyebrow, .item-price, .menu-cat-en, .footer-brand, .hours-row dd, .step-n"
    ).forEach((el) => {
      text += el.textContent;
    });
    M.about.paragraphs.forEach((p) => {
      text += Array.from(p)[0] || "";
    });
    const chars = Array.from(new Set(Array.from(text.replace(/\s+/g, ""))))
      .sort()
      .join("");
    const href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;1,500&family=Noto+Serif+TC:wght@700&display=swap&text=" +
      encodeURIComponent(chars);
    document.head.append(h("link", { rel: "stylesheet", href }));
  }

  /* ---------- 開始 ---------- */
  applyTheme();
  bindText();
  renderHero();
  renderAbout();
  renderMenu();
  renderContact();
  renderFooter();
  const tick = () => {
    const now = C.zonedNow(M.timeZone);
    renderStatus(now);
    renderHours(now);
  };
  tick();
  setInterval(tick, 60000);
  loadFonts();
  root.classList.add("ready");

  // 提供給 order.js 使用
  window.ShopSite = { model: M, h, icon, $, $$ };
})();
