/* ==========================================================================
   site.js：頁面上的小互動
   店舖內容已由 build.js 預先渲染成靜態 HTML，這裏只負責：
   ・按香港時間顯示「營業中／休息中」及標示今日
   ・捲動時自動標示目前的菜單分類
   ・準備資料給 order.js（落單功能）使用
   換店時不需要修改這個檔案。
   ========================================================================== */
(function () {
  "use strict";

  const C = window.ShopCore;
  const raw = window.SHOP_CONFIG;
  const root = document.documentElement;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  root.classList.add("ready");
  if (!C || !raw) return;

  const M = C.normalize(raw);
  M.warnings.forEach((w) => console.warn("[設定檔] " + w));

  // 建立元素：h("p", { class: "x" }, "文字", 子元素…)。文字一律以純文字加入，不會被當成 HTML。
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
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
    trash: '<path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 12.5h9L17.5 7M10 10.5v6M14 10.5v6"/>',
  };
  function icon(name) {
    const wrap = document.createElement("span");
    wrap.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[name] + "</svg>";
    return wrap.firstChild;
  }

  /* ---------- 營業狀態及今日 ---------- */
  function tick() {
    if (!M.hours.length) return;
    const now = C.zonedNow(M.timeZone);
    const st = C.openStatus(M, now);
    ["#heroStatus", "#hoursStatus"].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.hidden = false;
      el.classList.toggle("is-open", st.open);
      $(".status-text", el).textContent = st.text;
    });
    $$(".hours-row[data-days]").forEach((row) => {
      const today = row.dataset.days.split(",").indexOf(String(now.dow)) >= 0;
      row.classList.toggle("is-today", today);
      const tag = $(".today-tag", row);
      if (today && !tag) $("dt", row).append(h("span", { class: "today-tag" }, "今日"));
      if (!today && tag) tag.remove();
    });
  }

  /* ---------- 捲動時標示目前的菜單分類 ---------- */
  function setupScrollSpy() {
    const nav = $("#catNav");
    const chips = nav ? $$(".cat-chip", nav) : [];
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

  tick();
  setInterval(tick, 60000);
  setupScrollSpy();

  // 提供給 order.js 使用
  window.ShopSite = { model: M, h, icon, $, $$ };
})();
