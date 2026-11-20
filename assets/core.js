/* ==========================================================================
   core.js：核心邏輯（不涉及畫面）
   ・讀取及檢查設定檔
   ・價錢計算（一律用整數，避免小數誤差）
   ・購物清單操作
   ・營業時間及取餐時間檢查
   ・產生 WhatsApp 訂單訊息
   換店時一般不需要修改這個檔案。可在瀏覽器（window.ShopCore）或 Node（測試）使用。
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShopCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const DAY_MS = 86400000;

  /* ---------- 小工具 ---------- */
  const str = (v) => (v == null ? "" : String(v).trim());
  const digits = (v) => str(v).replace(/\D+/g, "");
  const pad2 = (n) => (n < 10 ? "0" : "") + n;

  function toInt(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback === undefined ? 0 : fallback;
  }

  function money(n) {
    const v = toInt(n);
    return (v < 0 ? "-$" : "$") + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // 清理客人輸入：移除控制字元及換行、合併空白、限制長度
  function clean(v, max) {
    const s = str(v).replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
    return max ? Array.from(s).slice(0, max).join("") : s;
  }

  function phoneText(num) {
    const d = digits(num);
    if (/^852\d{8}$/.test(d)) return "+852 " + d.slice(3, 7) + " " + d.slice(7);
    return d ? "+" + d : "";
  }

  /* ---------- 讀取設定檔 ----------
     把 config.js 整理成程式易用的格式，並把有問題的地方記在 warnings。 */
  function normalize(raw) {
    const cfg = raw || {};
    const warnings = [];
    const warn = (m) => {
      warnings.push(m);
    };
    const arr = (v) => (Array.isArray(v) ? v : []);

    // 選項組
    const groups = {};
    const og = cfg.optionGroups || {};
    Object.keys(og).forEach((key) => {
      const g = og[key] || {};
      const choices = arr(g.choices)
        .map((c) => {
          c = c || {};
          if (c.price != null && !Number.isInteger(c.price))
            warn(`選項「${str(g.title) || key}／${str(c.label)}」的加價不是整數，已四捨五入。`);
          return { label: str(c.label), price: toInt(c.price), hideInOrder: !!c.hideInOrder };
        })
        .filter((c) => c.label);
      if (!choices.length) return warn(`選項組「${key}」沒有任何選項，已略過。`);
      groups[key] = {
        key,
        title: str(g.title) || key,
        placement: g.placement === "prefix" ? "prefix" : "suffix",
        choices,
      };
    });

    // 菜單
    const items = {};
    const categories = [];
    arr(cfg.menu).forEach((cat, ci) => {
      cat = cat || {};
      const list = [];
      arr(cat.items).forEach((it) => {
        it = it || {};
        const name = str(it.name);
        if (!name) return warn(`「${str(cat.category)}」有一項沒有名稱，已略過。`);
        const id = str(it.id) || name;
        if (items[id]) return warn(`菜單有重複名稱「${name}」，請為其中一項加上不同的 id。`);
        if (!Number.isInteger(it.price)) warn(`「${name}」的價錢不是整數，已四捨五入。`);
        const options = arr(it.options).filter((k) => {
          if (groups[k]) return true;
          warn(`「${name}」使用了不存在的選項組「${k}」，已略過。`);
          return false;
        });
        const item = {
          id,
          name,
          price: toInt(it.price),
          desc: str(it.desc),
          badge: str(it.badge),
          image: str(it.image),
          soldOut: !!it.soldOut,
          options,
          cat: ci,
        };
        items[id] = item;
        list.push(item);
      });
      if (list.length)
        categories.push({ index: ci, name: str(cat.category) || "其他", nameEn: str(cat.categoryEn), items: list });
    });
    if (!categories.length) warn("菜單沒有任何項目。");

    // 營業時間
    const hours = [];
    arr(cfg.hours).forEach((r) => {
      r = r || {};
      const open = parseHM(r.open);
      const close = parseHM(r.close);
      const days = arr(r.days)
        .map(Number)
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (open == null || close == null || close <= open || !days.length)
        return warn(
          `營業時間「${str(r.label)} ${str(r.open)}–${str(r.close)}」格式不正確：時間需為 HH:MM、關門要遲於開門，並要填寫 days。`
        );
      hours.push({ label: str(r.label), days, open, close });
    });

    // 聯絡
    const c = cfg.contact || {};
    let wa = digits(c.whatsapp);
    if (wa.length === 8) {
      wa = "852" + wa;
      warn("WhatsApp 號碼缺少 852 區號，已自動加上。");
    }
    let phone = digits(c.phone);
    if (phone.length === 8) phone = "852" + phone;
    const contact = {
      address: str(c.address),
      directions: str(c.directions),
      mapUrl: str(c.mapUrl),
      mapQuery: str(c.mapQuery),
      phone,
      whatsapp: wa,
      instagram: str(c.instagram),
      email: str(c.email),
    };

    // 落單
    const o = cfg.order || {};
    const order = {
      enabled: o.enabled !== false,
      pickup: o.pickup !== false,
      dineIn: o.dineIn !== false,
      leadMinutes: Math.max(0, toInt(o.leadMinutes, 15)),
      advanceDays: Math.min(7, Math.max(0, toInt(o.advanceDays, 0))),
      maxQty: Math.max(1, toInt(o.maxQty, 20)),
      notice: str(o.notice) || "訂單以店舖 WhatsApp 回覆確認為準，付款於取餐時進行。",
    };
    if (!order.pickup && !order.dineIn) {
      order.pickup = true;
      warn("自取及堂食不可同時關閉，已自動開啟自取。");
    }
    if (order.enabled && !wa) {
      order.enabled = false;
      warn("未設定 WhatsApp 號碼，落單功能已自動關閉。");
    }
    if (order.enabled && !hours.length) {
      order.enabled = false;
      warn("未設定營業時間，落單功能已自動關閉。");
    }

    const t = cfg.theme || {};
    const a = cfg.about || {};
    const cr = cfg.credit || {};
    return {
      id: str(cfg.id).toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "shop",
      demo: !!cfg.demo,
      name: str(cfg.name) || "店舖名稱",
      nameEn: str(cfg.nameEn),
      kicker: str(cfg.kicker),
      tagline: str(cfg.tagline),
      description: str(cfg.description) || str(cfg.tagline),
      about: {
        paragraphs: (Array.isArray(a.paragraphs) ? a.paragraphs : [a.paragraphs]).map(str).filter(Boolean),
        highlights: arr(a.highlights).map(str).filter(Boolean),
      },
      theme: {
        brand: str(t.brand),
        accent: str(t.accent),
        ink: str(t.ink),
        paper: str(t.paper),
        webFont: t.webFont !== false,
      },
      hours,
      hoursNote: str(cfg.hoursNote),
      timeZone: str(cfg.timeZone) || "Asia/Hong_Kong",
      contact,
      order,
      groups,
      items,
      categories,
      credit: { name: str(cr.name), url: /^https?:\/\//i.test(str(cr.url)) ? str(cr.url) : "" },
      warnings,
    };
  }

  /* ---------- 購物清單 ----------
     清單每行：{ id: 菜單項目, opts: { 選項組代號: 選項文字 }, qty: 數量 }
     清單不儲存價錢，每次都按設定檔重新計算。 */
  function defaultOpts(model, item) {
    const opts = {};
    item.options.forEach((k) => {
      opts[k] = model.groups[k].choices[0].label;
    });
    return opts;
  }

  function lineKey(line) {
    const o = (line && line.opts) || {};
    return [line && line.id]
      .concat(
        Object.keys(o)
          .sort()
          .map((k) => k + "=" + o[k])
      )
      .join("|");
  }

  function lineLabel(item, picked) {
    const shown = picked.filter((p) => !p.choice.hideInOrder);
    const pre = shown
      .filter((p) => p.group.placement === "prefix")
      .map((p) => p.choice.label)
      .join("");
    const suf = shown.filter((p) => p.group.placement !== "prefix").map((p) => p.choice.label);
    return pre + item.name + (suf.length ? "（" + suf.join("、") + "）" : "");
  }

  // 把一行清單配對到菜單；無效（已刪除、售罄、選項不存在、數量不正確）則回傳 null
  function resolveLine(model, line) {
    if (!line || typeof line !== "object") return null;
    const item = model.items[line.id];
    if (!item || item.soldOut) return null;
    const qty = toInt(line.qty);
    if (qty < 1) return null;
    const src = line.opts && typeof line.opts === "object" ? line.opts : {};
    if (Object.keys(src).some((k) => item.options.indexOf(k) < 0)) return null;
    const picked = [];
    for (const k of item.options) {
      const g = model.groups[k];
      const choice = g.choices.find((ch) => ch.label === src[k]);
      if (!choice) return null;
      picked.push({ group: g, choice });
    }
    const opts = {};
    picked.forEach((p) => {
      opts[p.group.key] = p.choice.label;
    });
    const unit = picked.reduce((s, p) => s + p.choice.price, item.price);
    const q = Math.min(qty, model.order.maxQty);
    return {
      key: lineKey({ id: item.id, opts }),
      id: item.id,
      opts,
      item,
      picked,
      label: lineLabel(item, picked),
      unit,
      qty: q,
      total: unit * q,
    };
  }

  // 整理清單：移除無效項目、合併相同項目，並計算件數及總額
  function summarize(model, lines) {
    const out = [];
    const byKey = {};
    let dropped = 0;
    (Array.isArray(lines) ? lines : []).forEach((l) => {
      const r = resolveLine(model, l);
      if (!r) {
        dropped++;
        return;
      }
      const prev = byKey[r.key];
      if (prev) {
        prev.qty = Math.min(prev.qty + r.qty, model.order.maxQty);
        prev.total = prev.unit * prev.qty;
      } else {
        byKey[r.key] = r;
        out.push(r);
      }
    });
    return {
      lines: out,
      qty: out.reduce((s, l) => s + l.qty, 0),
      total: out.reduce((s, l) => s + l.total, 0),
      dropped,
    };
  }

  // 以下三個操作都回傳新的清單，不會改動原本的陣列
  const plain = (sum) => sum.lines.map((l) => ({ id: l.id, opts: l.opts, qty: l.qty }));

  function addLine(model, lines, line) {
    const next = (lines || []).concat([{ id: line.id, opts: line.opts || {}, qty: toInt(line.qty, 1) }]);
    return plain(summarize(model, next));
  }

  function setQty(model, lines, key, qty) {
    const q = toInt(qty);
    const next = (lines || []).map((l) => (lineKey(l) === key ? { id: l.id, opts: l.opts, qty: q } : l));
    return plain(summarize(model, next));
  }

  const removeLine = (model, lines, key) => setQty(model, lines, key, 0);

  /* ---------- 時間 ----------
     日期一律用 "YYYY-MM-DD" 字串，時間用「當日第幾分鐘」（例如 12:30 ＝ 750）。 */
  function parseHM(v) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(str(v));
    if (!m) return null;
    const hh = +m[1];
    const mm = +m[2];
    if (mm > 59 || hh > 24 || (hh === 24 && mm > 0)) return null;
    return hh * 60 + mm;
  }
  const fmtHM = (min) => pad2(Math.floor(min / 60)) + ":" + pad2(min % 60);
  const utcOf = (key) => {
    const p = String(key).split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  };
  const weekdayOf = (key) => new Date(utcOf(key)).getUTCDay();
  const addDays = (key, n) => new Date(utcOf(key) + n * DAY_MS).toISOString().slice(0, 10);
  const dayDiff = (a, b) => Math.round((utcOf(b) - utcOf(a)) / DAY_MS);

  function dateText(key) {
    const p = String(key).split("-").map(Number);
    return p[1] + "月" + p[2] + "日（星期" + WEEKDAYS[weekdayOf(key)] + "）";
  }
  const dayWord = (offset, key) => (offset === 0 ? "今日" : offset === 1 ? "明日" : dateText(key));

  // 測試用：固定「現在」的時間，例如 ShopCore.setNow("2026-11-20T12:00:00+08:00")；setNow(null) 還原
  let fixedNow = null;
  function setNow(v) {
    fixedNow = v == null ? null : new Date(v);
  }

  // 取得店舖時區的「現在」：{ date: "YYYY-MM-DD", dow: 0–6, min: 當日第幾分鐘 }
  function zonedNow(tz, at) {
    const d = at != null ? new Date(at) : fixedNow ? new Date(fixedNow) : new Date();
    let y, mo, da, hh, mi;
    try {
      const p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz || "Asia/Hong_Kong",
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(d)
        .forEach((x) => {
          p[x.type] = x.value;
        });
      y = +p.year;
      mo = +p.month;
      da = +p.day;
      hh = +p.hour % 24;
      mi = +p.minute;
    } catch (e) {
      y = d.getFullYear();
      mo = d.getMonth() + 1;
      da = d.getDate();
      hh = d.getHours();
      mi = d.getMinutes();
    }
    const date = y + "-" + pad2(mo) + "-" + pad2(da);
    return { date, dow: weekdayOf(date), min: hh * 60 + mi };
  }

  function intervalsOn(model, dow) {
    return model.hours
      .filter((r) => r.days.indexOf(dow) >= 0)
      .map((r) => ({ open: r.open, close: r.close }))
      .sort((a, b) => a.open - b.open);
  }
  const hoursText = (ivs) => ivs.map((iv) => fmtHM(iv.open) + "–" + fmtHM(iv.close)).join("、");
  const isOpenAt = (model, dow, min) => intervalsOn(model, dow).some((iv) => min >= iv.open && min < iv.close);

  // 某日最早可取餐時間（分鐘，取整至 5 分鐘）；當日沒有可選時間則回傳 null
  function earliestOn(model, now, key) {
    const offset = dayDiff(now.date, key);
    if (!(offset >= 0)) return null;
    let from = Math.max(0, now.min + model.order.leadMinutes - offset * 1440);
    from = Math.ceil(from / 5) * 5;
    for (const iv of intervalsOn(model, weekdayOf(key))) {
      const t = Math.max(from, iv.open);
      if (t < iv.close) return t;
    }
    return null;
  }

  // 可選擇的取餐日子（今日起計 advanceDays 日內，有可選時間的日子）
  function pickupDays(model, now) {
    const out = [];
    for (let k = 0; k <= model.order.advanceDays; k++) {
      const key = addDays(now.date, k);
      const first = earliestOn(model, now, key);
      if (first == null) continue;
      const ivs = intervalsOn(model, weekdayOf(key));
      out.push({
        date: key,
        offset: k,
        first,
        last: ivs[ivs.length - 1].close,
        hours: hoursText(ivs),
        label: (k <= 1 ? dayWord(k) + " " : "") + dateText(key),
      });
    }
    return out;
  }

  // 檢查自取時間：必須在營業時間內，而且比現在最少晚 leadMinutes 分鐘
  function checkPickup(model, now, key, time) {
    const min = parseHM(time);
    if (!key || min == null) return { ok: false, code: "missing", msg: "請選擇自取時間。" };
    const offset = dayDiff(now.date, key);
    if (!(offset >= 0 && offset <= model.order.advanceDays))
      return { ok: false, code: "date", msg: "請重新選擇取餐日期。" };
    const ivs = intervalsOn(model, weekdayOf(key));
    const day = dayWord(offset, key);
    if (!ivs.length) return { ok: false, code: "closed", msg: day + "休息，請選擇其他日子。" };
    if (!ivs.some((iv) => min >= iv.open && min < iv.close))
      return {
        ok: false,
        code: "outside",
        msg: "所選時間不在營業時間內（" + day + "營業時間：" + hoursText(ivs) + "）。",
      };
    if (offset * 1440 + min < now.min + model.order.leadMinutes) {
      const e = earliestOn(model, now, key);
      return {
        ok: false,
        code: "soon",
        msg:
          "自取時間須比現在最少晚 " +
          model.order.leadMinutes +
          " 分鐘" +
          (e != null ? "，" + day + "最早可選 " + fmtHM(e) + "。" : "；" + day + "已沒有可選時間，請改選其他日子。"),
      };
    }
    return { ok: true, min };
  }

  // 現時營業狀態，例如「營業中・今日 18:00 關門」
  function openStatus(model, now) {
    const cur = intervalsOn(model, now.dow).find((iv) => now.min >= iv.open && now.min < iv.close);
    if (cur) return { open: true, text: "營業中・今日 " + fmtHM(cur.close) + " 關門" };
    for (let k = 0; k <= 7; k++) {
      const key = addDays(now.date, k);
      const iv = intervalsOn(model, weekdayOf(key)).find((x) => k > 0 || x.open > now.min);
      if (iv)
        return {
          open: false,
          text: "休息中・" + (k <= 1 ? dayWord(k) : "星期" + WEEKDAYS[weekdayOf(key)]) + " " + fmtHM(iv.open) + " 開門",
        };
    }
    return { open: false, text: "暫停營業" };
  }

  /* ---------- 訂單 ---------- */
  // form：{ name, mode: "pickup" | "dinein", date, time, table, note }
  function validateOrder(model, sum, form, now) {
    const errors = {};
    if (!sum.lines.length) errors.cart = "購物清單是空的，請先從菜單加入餐點。";
    if (!clean(form.name)) errors.name = "請填寫稱呼。";
    if (form.mode === "dinein" && model.order.dineIn) {
      if (!clean(form.table)) errors.table = "請填寫枱號。";
      if (!isOpenAt(model, now.dow, now.min))
        errors.mode = "現在並非營業時間，暫時未能接受堂食訂單（" + openStatus(model, now).text + "）。";
    } else if (form.mode === "pickup" && model.order.pickup) {
      const r = checkPickup(model, now, form.date, form.time);
      if (!r.ok) errors.time = r.msg;
    } else {
      errors.mode = "請選擇取餐方式。";
    }
    return { ok: Object.keys(errors).length === 0, errors };
  }

  function buildMessage(model, sum, form, now) {
    const out = ["【新訂單】", "稱呼：" + clean(form.name, 20)];
    if (form.mode === "dinein") {
      out.push("取餐：堂食（枱號 " + clean(form.table, 8) + "）");
    } else {
      const t = fmtHM(parseHM(form.time));
      out.push("取餐：自取 " + (dayDiff(now.date, form.date) === 0 ? t : dateText(form.date) + t));
    }
    out.push("---");
    sum.lines.forEach((l) => {
      out.push(l.label + (/）$/.test(l.label) ? "" : " ") + "×" + l.qty + "　" + money(l.total));
    });
    out.push("---", "合共：" + money(sum.total));
    const note = clean(form.note, 100);
    if (note) out.push("備註：" + note);
    return out.join("\n");
  }

  // wa.me 連結：手機會開啟 WhatsApp App，電腦會轉到 WhatsApp Web／桌面版
  const waUrl = (number, text) =>
    "https://wa.me/" + digits(number) + (text ? "?text=" + encodeURIComponent(text) : "");

  // 發送訂單：示範模式不開啟 WhatsApp，只顯示說明；正式模式回傳 wa.me 連結
  const sendTarget = (model, text) =>
    model.demo ? { demo: true, url: "" } : { demo: false, url: waUrl(model.contact.whatsapp, text) };

  return {
    WEEKDAYS,
    str,
    digits,
    toInt,
    money,
    clean,
    phoneText,
    normalize,
    defaultOpts,
    lineKey,
    lineLabel,
    resolveLine,
    summarize,
    addLine,
    setQty,
    removeLine,
    parseHM,
    fmtHM,
    weekdayOf,
    addDays,
    dayDiff,
    dateText,
    dayWord,
    setNow,
    zonedNow,
    intervalsOn,
    hoursText,
    isOpenAt,
    earliestOn,
    pickupDays,
    checkPickup,
    openStatus,
    validateOrder,
    buildMessage,
    waUrl,
    sendTarget,
  };
});
