/* ==========================================================================
   order.js：WhatsApp 落單功能
   ・菜單「加入」按鈕、數量加減、選項視窗
   ・底部購物清單列、清單明細（修改數量、刪除）
   ・取餐資料、檢查、訂單預覽、開啟 WhatsApp
   在 config.js 把 order.enabled 設為 false，整個功能便會關閉。
   ========================================================================== */
(function () {
  "use strict";

  const S = window.ShopSite;
  const C = window.ShopCore;
  if (!S || !C || !S.model.order.enabled) return;

  const M = S.model;
  const { h, icon, $, $$ } = S;
  const root = document.documentElement;
  root.classList.add("has-order");

  /* ---------- 暫存購物清單（localStorage） ----------
     讀寫都包在 try/catch：私密瀏覽或停用儲存時照常運作，只是重新整理後不會保留。 */
  const KEY = "wa-order:" + M.id;
  const MAX_AGE = 24 * 60 * 60 * 1000; // 清單最多保留 24 小時

  function loadLines() {
    try {
      const data = JSON.parse(window.localStorage.getItem(KEY) || "null");
      if (!data || data.v !== 1 || !Array.isArray(data.lines)) return [];
      if (!(Date.now() - data.t < MAX_AGE)) return [];
      return data.lines;
    } catch (e) {
      return [];
    }
  }
  function saveLines() {
    try {
      if (lines.length) window.localStorage.setItem(KEY, JSON.stringify({ v: 1, t: Date.now(), lines }));
      else window.localStorage.removeItem(KEY);
    } catch (e) {
      /* 無法儲存時略過 */
    }
  }
  const plainLines = (sum) => sum.lines.map((l) => ({ id: l.id, opts: l.opts, qty: l.qty }));

  const initial = C.summarize(M, loadLines());
  let lines = plainLines(initial);
  if (initial.dropped) saveLines();

  function commit(next, bump) {
    lines = next;
    saveLines();
    refresh(bump);
  }
  function refresh(bump) {
    const sum = C.summarize(M, lines);
    updateBar(sum, bump);
    $$(".item-action[data-action-for]").forEach(renderAction);
    if (cartDialog.open) renderCart(sum);
  }

  /* ---------- 提示訊息 ---------- */
  const toastEl = $("#toast");
  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2200);
  }

  /* ---------- 彈出視窗共用 ---------- */
  const dialogs = $$("dialog");
  function openDialog(d) {
    if (!d.open) d.showModal();
    d.dataset.openedAt = String(Date.now());
    root.classList.add("modal-open");
  }
  function closeDialog(d) {
    if (d.open) d.close();
  }
  dialogs.forEach((d) => {
    d.addEventListener("close", () => {
      if (!dialogs.some((x) => x.open)) root.classList.remove("modal-open");
    });
    d.addEventListener("click", (e) => {
      // 點背景或關閉按鈕關閉；視窗剛打開（滑入動畫期間）時誤觸背景不會關閉
      if (e.target === d && Date.now() - Number(d.dataset.openedAt || 0) < 400) return;
      if (e.target === d || e.target.closest("[data-close]")) d.close();
    });
  });

  /* ---------- 數量加減 ---------- */
  function stepper(label, qty, key) {
    return h(
      "div",
      { class: "stepper", role: "group", "aria-label": label + " 數量" },
      h("button", { type: "button", class: "step-btn", "data-step": "-1", "data-key": key, "aria-label": "減少 " + label }, "−"),
      h("output", { class: "step-qty", "aria-live": "polite" }, String(qty)),
      h(
        "button",
        {
          type: "button",
          class: "step-btn",
          "data-step": "1",
          "data-key": key,
          "aria-label": "增加 " + label,
          disabled: qty >= M.order.maxQty,
        },
        "+"
      )
    );
  }

  function changeQty(key, delta) {
    const line = lines.find((l) => C.lineKey(l) === key);
    if (!line) return;
    if (delta > 0 && line.qty >= M.order.maxQty) return toast("每項最多 " + M.order.maxQty + " 件");
    commit(C.setQty(M, lines, key, line.qty + delta), delta > 0);
  }

  // 重新繪製按鈕後，把焦點放回相應按鈕（方便用鍵盤操作）
  function restoreFocus(box, step) {
    const prefer = box.querySelector(step === "-1" ? '[data-step="-1"]' : '[data-step="1"]');
    const target =
      (prefer && !prefer.disabled && prefer) || box.querySelector("button:not(:disabled)") || null;
    if (target) target.focus({ preventScroll: true });
  }

  /* ---------- 菜單按鈕 ---------- */
  const menuList = $("#menuList");
  const qtyOfItem = (id) => lines.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);

  function renderAction(box) {
    const item = M.items[box.dataset.actionFor];
    if (!item) return;
    const active = document.activeElement;
    const hadFocus = box.contains(active);
    const step = hadFocus ? active.dataset.step || "1" : "";
    box.textContent = "";
    if (item.soldOut) {
      box.append(h("button", { type: "button", class: "btn-add", disabled: true }, "售罄"));
    } else if (item.options.length) {
      const n = qtyOfItem(item.id);
      if (n) box.append(h("span", { class: "in-cart" }, "已加入 " + n));
      const titles = item.options.map((k) => M.groups[k].title).join("、");
      box.append(
        h(
          "button",
          { type: "button", class: "btn-add", "data-open": item.id, "aria-haspopup": "dialog", "aria-label": "加入 " + item.name + "（可選" + titles + "）" },
          icon("plus"),
          "加入"
        )
      );
    } else {
      const line = lines.find((l) => l.id === item.id);
      box.append(
        line
          ? stepper(item.name, line.qty, C.lineKey(line))
          : h("button", { type: "button", class: "btn-add", "data-add": item.id, "aria-label": "加入 " + item.name }, icon("plus"), "加入")
      );
    }
    if (hadFocus) restoreFocus(box, step);
  }

  menuList.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    if (btn.dataset.add) {
      const item = M.items[btn.dataset.add];
      commit(C.addLine(M, lines, { id: item.id, opts: {}, qty: 1 }), true);
      toast("已加入：" + item.name);
    } else if (btn.dataset.open) {
      openOptions(M.items[btn.dataset.open]);
    } else if (btn.dataset.step) {
      changeQty(btn.dataset.key, Number(btn.dataset.step));
    }
  });

  /* ---------- 選項視窗 ---------- */
  const optDialog = $("#optDialog");
  let opt = null; // { item, opts, qty }

  function openOptions(item) {
    opt = { item, opts: C.defaultOpts(M, item), qty: 1 };
    $("#optTitle").textContent = item.name;
    $("#optDesc").textContent = item.desc;
    $("#optDesc").hidden = !item.desc;
    const box = $("#optGroups");
    box.textContent = "";
    item.options.forEach((k) => {
      const g = M.groups[k];
      box.append(
        h(
          "fieldset",
          { class: "opt-group" },
          h("legend", null, g.title),
          h(
            "div",
            { class: "pills" },
            g.choices.map((c, i) =>
              h(
                "label",
                { class: "pill" },
                h("input", { type: "radio", name: "opt-" + k, value: c.label, checked: i === 0, "data-group": k }),
                h("span", { class: "pill-face" }, c.label, c.price ? h("span", { class: "pill-extra" }, "+" + C.money(c.price)) : null)
              )
            )
          )
        )
      );
    });
    updateOpt();
    openDialog(optDialog);
  }

  function updateOpt() {
    const r = C.resolveLine(M, { id: opt.item.id, opts: opt.opts, qty: opt.qty });
    $("#optQty").textContent = opt.qty;
    $("#optDec").disabled = opt.qty <= 1;
    $("#optInc").disabled = opt.qty >= M.order.maxQty;
    $("#optAdd").textContent = "加入清單・" + C.money(r ? r.total : 0);
  }

  $("#optGroups").addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.group) {
      opt.opts[t.dataset.group] = t.value;
      updateOpt();
    }
  });
  $("#optDec").addEventListener("click", () => {
    opt.qty = Math.max(1, opt.qty - 1);
    updateOpt();
  });
  $("#optInc").addEventListener("click", () => {
    opt.qty = Math.min(M.order.maxQty, opt.qty + 1);
    updateOpt();
  });
  $("#optForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = C.resolveLine(M, { id: opt.item.id, opts: opt.opts, qty: opt.qty });
    if (!r) return;
    const before = (C.summarize(M, lines).lines.find((l) => l.key === r.key) || { qty: 0 }).qty;
    commit(C.addLine(M, lines, { id: r.id, opts: r.opts, qty: r.qty }), true);
    closeDialog(optDialog);
    const btn = menuList.querySelector('[data-open="' + CSS.escape(r.id) + '"]');
    if (btn) btn.focus({ preventScroll: true });
    toast(before + r.qty > M.order.maxQty ? "每項最多 " + M.order.maxQty + " 件" : "已加入：" + r.label + " ×" + r.qty);
  });

  /* ---------- 底部購物清單列 ---------- */
  const bar = $("#cartBar");
  function updateBar(sum, bump) {
    $("#cartCount").textContent = sum.qty;
    $("#cartBarTotal").textContent = C.money(sum.total);
    bar.classList.toggle("is-empty", !sum.qty);
    // 用按鈕上可見的文字作為讀屏名稱（購物清單、件數、總額、查看）
    $("#cartSub").textContent = sum.qty ? sum.qty + " 件・按此查看及落單" : "未有餐點";
    if (bump) {
      bar.classList.remove("bump");
      void bar.offsetWidth; // 重新觸發動畫
      bar.classList.add("bump");
    }
  }

  /* ---------- 購物清單明細 ---------- */
  const cartDialog = $("#cartDialog");
  const cartList = $("#cartLines");

  function renderCart(sum) {
    const active = document.activeElement;
    const focusKey = cartList.contains(active) ? active.dataset.key : null;
    const focusStep = focusKey != null ? active.dataset.step || "del" : "";
    cartList.textContent = "";
    sum.lines.forEach((l) => {
      cartList.append(
        h(
          "li",
          { class: "cart-line" },
          h("div", { class: "cart-line-info" }, h("p", { class: "cart-line-name" }, l.label), h("p", { class: "cart-line-unit" }, "每件 " + C.money(l.unit))),
          stepper(l.label, l.qty, l.key),
          h("p", { class: "cart-line-total" }, C.money(l.total)),
          h("button", { type: "button", class: "icon-btn btn-del", "data-del": l.key, "data-key": l.key, "aria-label": "刪除 " + l.label }, icon("trash"))
        )
      );
    });
    $("#cartEmpty").hidden = sum.lines.length > 0;
    $("#cartSum").hidden = !sum.lines.length;
    $("#cartQty").textContent = sum.qty;
    $("#cartTotal").textContent = C.money(sum.total);
    if (sum.lines.length && $("#formError").textContent === EMPTY_MSG) $("#formError").textContent = "";

    if (focusKey != null) {
      const k = CSS.escape(focusKey);
      const sel = focusStep === "del" ? '[data-del="' + k + '"]' : '[data-key="' + k + '"][data-step="' + focusStep + '"]';
      let target = cartList.querySelector(sel);
      if (!target || target.disabled) target = cartList.querySelector('[data-key="' + k + '"]:not(:disabled)');
      if (!target) target = cartList.querySelector("button:not(:disabled)") || cartDialog.querySelector("[data-close]");
      target.focus({ preventScroll: true });
    }
  }

  cartList.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    if (btn.dataset.del) commit(C.removeLine(M, lines, btn.dataset.del));
    else if (btn.dataset.step) changeQty(btn.dataset.key, Number(btn.dataset.step));
  });

  $("#cartOpen").addEventListener("click", () => {
    clearErrors();
    renderCart(C.summarize(M, lines));
    refreshPickup();
    openDialog(cartDialog);
  });
  $("#cartBrowse").addEventListener("click", () => {
    closeDialog(cartDialog);
    $("#menu").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- 取餐資料 ---------- */
  const form = $("#checkoutForm");
  const EMPTY_MSG = "購物清單是空的，請先從菜單加入餐點。";
  const modes = [];
  if (M.order.pickup) modes.push({ value: "pickup", label: "自取", sub: "預約時間" });
  if (M.order.dineIn) modes.push({ value: "dinein", label: "堂食", sub: "填寫枱號" });
  const modeBox = $("#modePills");
  modes.forEach((m, i) =>
    modeBox.append(
      h(
        "label",
        { class: "pill" },
        h("input", { type: "radio", name: "mode", value: m.value, checked: i === 0 }),
        h("span", { class: "pill-face" }, m.label, h("span", { class: "pill-extra" }, m.sub))
      )
    )
  );
  $("#modeField").hidden = modes.length < 2;

  const checked = (name) => (form.querySelector('input[name="' + name + '"]:checked') || {}).value || "";
  const getMode = () => checked("mode") || modes[0].value;

  function syncMode() {
    const mode = getMode();
    $("#pickupFields").hidden = mode !== "pickup";
    $("#dineFields").hidden = mode !== "dinein";
  }
  modeBox.addEventListener("change", () => {
    syncMode();
    setError("mode", "");
  });

  // 取餐日期（今日／明日…）及最早可取時間
  let days = [];
  function refreshPickup() {
    if (!M.order.pickup) return;
    const now = C.zonedNow(M.timeZone);
    const prev = checked("date");
    days = C.pickupDays(M, now);
    const box = $("#datePills");
    box.textContent = "";
    $("#dateField").hidden = !days.length;
    $("#fTimeFill").hidden = !days.length;
    if (!days.length) {
      $("#fTimeHint").textContent = "暫時沒有可選的自取時間（" + C.openStatus(M, now).text + "）。";
      return;
    }
    const sel = days.some((d) => d.date === prev) ? prev : days[0].date;
    days.forEach((d) => {
      const p = d.date.split("-").map(Number);
      const main = d.offset === 0 ? "今日" : d.offset === 1 ? "明日" : "星期" + C.WEEKDAYS[C.weekdayOf(d.date)];
      box.append(
        h(
          "label",
          { class: "pill" },
          h("input", { type: "radio", name: "date", value: d.date, checked: d.date === sel }),
          h("span", { class: "pill-face" }, main, h("span", { class: "pill-extra" }, p[1] + "月" + p[2] + "日（" + C.WEEKDAYS[C.weekdayOf(d.date)] + "）"))
        )
      );
    });
    updateTimeHint();
  }
  function updateTimeHint() {
    const d = days.find((x) => x.date === checked("date"));
    if (!d) return;
    const input = $("#fTime");
    input.min = C.fmtHM(d.first);
    input.max = C.fmtHM(d.last - 1);
    $("#fTimeHint").textContent = "營業時間 " + d.hours + "，最早可取 " + C.fmtHM(d.first) + "。";
  }
  $("#datePills").addEventListener("change", () => {
    updateTimeHint();
    if ($("#fTime").value) validateField("time");
  });
  $("#fTimeFill").addEventListener("click", () => {
    const d = days.find((x) => x.date === checked("date"));
    if (!d) return;
    $("#fTime").value = C.fmtHM(d.first);
    setError("time", "");
  });

  /* ---------- 檢查及錯誤訊息 ---------- */
  const FIELDS = {
    name: ["#fName", "#fNameErr"],
    mode: [null, "#fModeErr"],
    time: ["#fTime", "#fTimeErr"],
    table: ["#fTable", "#fTableErr"],
  };
  function setError(field, msg) {
    const [inputSel, errSel] = FIELDS[field];
    $(errSel).textContent = msg || "";
    if (!inputSel) return;
    if (msg) $(inputSel).setAttribute("aria-invalid", "true");
    else $(inputSel).removeAttribute("aria-invalid");
  }
  function clearErrors() {
    Object.keys(FIELDS).forEach((f) => setError(f, ""));
    $("#formError").textContent = "";
  }
  function readForm() {
    return {
      name: $("#fName").value,
      mode: getMode(),
      date: checked("date"),
      time: $("#fTime").value,
      table: $("#fTable").value,
      note: $("#fNote").value,
    };
  }
  function check() {
    const now = C.zonedNow(M.timeZone);
    const sum = C.summarize(M, lines);
    const data = readForm();
    return { now, sum, data, result: C.validateOrder(M, sum, data, now) };
  }
  function validateField(field) {
    setError(field, check().result.errors[field] || "");
  }
  $("#fTime").addEventListener("change", () => validateField("time"));
  $("#fName").addEventListener("input", () => {
    if ($("#fNameErr").textContent) validateField("name");
  });
  $("#fTable").addEventListener("input", () => {
    if ($("#fTableErr").textContent) validateField("table");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const { now, sum, data, result } = check();
    clearErrors();
    if (!result.ok) {
      const errs = result.errors;
      ["name", "mode", "time", "table"].forEach((f) => errs[f] && setError(f, errs[f]));
      $("#formError").textContent = errs.cart || "請修正以上標示的資料。";
      const first = ["name", "mode", "time", "table"].find((f) => errs[f]);
      const el = first ? (first === "mode" ? modeBox.querySelector("input") : $(FIELDS[first][0])) : null;
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } else if (errs.cart) {
        cartDialog.querySelector(".sheet-body").scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    showPreview(C.buildMessage(M, sum, data, now));
  });

  /* ---------- 訂單預覽及發送 ---------- */
  const preview = $("#previewDialog");
  const waLink = $("#waSend");

  function showPreview(msg) {
    $("#previewText").textContent = msg;
    $("#previewNumber").textContent = C.phoneText(M.contact.whatsapp);
    waLink.href = C.waUrl(M.contact.whatsapp, msg);
    $("#demoNote").hidden = !M.demo;
    $("#sentPanel").hidden = true;
    $("#sentActions").hidden = true;
    $("#previewActions").hidden = false;
    openDialog(preview);
  }

  waLink.addEventListener("click", (e) => {
    // 預覽期間時間可能已過，發送前再檢查一次；有變動則返回清單重新檢查
    const { now, sum, data, result } = check();
    if (!result.ok || C.buildMessage(M, sum, data, now) !== $("#previewText").textContent) {
      e.preventDefault();
      closeDialog(preview);
      form.requestSubmit();
      return;
    }
    setTimeout(() => {
      $("#sentPanel").hidden = false;
      $("#previewActions").hidden = true;
      $("#sentActions").hidden = false;
    }, 300);
  });

  $("#clearCart").addEventListener("click", () => {
    commit([]);
    $("#fNote").value = "";
    closeDialog(preview);
    closeDialog(cartDialog);
    toast("已清空購物清單");
  });

  // 其他分頁修改了清單時同步
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    lines = plainLines(C.summarize(M, loadLines()));
    refresh();
  });

  /* ---------- 開始 ---------- */
  syncMode();
  refresh();
  if (initial.dropped) toast("部分餐點已售罄或菜單已更新，已從清單移除。");
})();
