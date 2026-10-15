// Cozene LINE Mini App — one app for every partner store.
//
// Opened from https://miniapp.line.me/<LIFF_ID>?store=<slug>[&table=<no>]
//   * Home + Menu:  public, no login.
//   * Member card:  login → consent → visit count + benefits.
//   * ?table=7:     login → consent → party size → check-in → free-glass pass
//                   on a first visit.
//
// Identity: the server never trusts a userId from here. Every member call
// sends liff.getIDToken() and the Mother System verifies it with LINE.

(function () {
  "use strict";

  const cfg = window.COZENE_CONFIG || {};
  const LIFF_ID = cfg.MINIAPP_LIFF_ID || cfg.LIFF_ID;
  const API = (cfg.ENDPOINT_BASE || "").replace(/\/$/, "") + "/api/app";
  // Local testing without LINE: set DEV_USER_ID in config.js and run the
  // Mother System with LINE_ID_TOKEN_DEV=1.
  const DEV_USER = cfg.DEV_USER_ID || "";

  const $ = (id) => document.getElementById(id);
  const state = { store: null, slug: "", table: "", me: null, partySize: 0, pin: "" };

  // ─── helpers ──────────────────────────────────────────────────────────────

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    (children || []).forEach((c) => c && node.append(c));
    return node;
  }

  const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP");
  const date = (iso) => {
    const d = new Date(iso);
    return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
  };
  const time = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  let toastTimer;
  function toast(msg) {
    $("toast").textContent = msg;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 3200);
  }

  function fatal(msg) {
    $("boot").hidden = true;
    $("fatal").textContent = msg;
    $("fatal").hidden = false;
  }

  /** Darken a #rrggbb colour for gradients / pressed states. */
  function shade(hex, f) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  // ─── LINE login + API ─────────────────────────────────────────────────────

  function idToken() {
    if (DEV_USER) return "dev:" + DEV_USER;
    return liff.getIDToken();
  }

  function isLoggedIn() {
    return DEV_USER ? true : liff.isLoggedIn();
  }

  /** Redirects away to LINE login when needed; returns false in that case. */
  function ensureLogin() {
    if (isLoggedIn()) return true;
    // The #tab can be lost in LINE's login redirect; restore it on return.
    try { sessionStorage.setItem("cz_tab", currentTab()); } catch (e) { /* storage blocked */ }
    liff.login({ redirectUri: location.href });
    return false;
  }

  async function api(path, body) {
    const res = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request, no preflight
      body: JSON.stringify(Object.assign({ store: state.slug, id_token: idToken() }, body || {})),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "HTTP " + res.status }));
    if (res.status === 401 && data.error === "id_token_invalid" && !DEV_USER) {
      // Expired token: log in again once (guard against a redirect loop).
      if (!sessionStorage.getItem("cz_relogin")) {
        sessionStorage.setItem("cz_relogin", "1");
        liff.logout();
        liff.login({ redirectUri: location.href });
        return new Promise(() => {}); // page is navigating away
      }
    }
    sessionStorage.removeItem("cz_relogin");
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || "HTTP " + res.status);
      err.code = data.error;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ─── routing (hash tabs) ──────────────────────────────────────────────────

  const TABS = ["home", "menu", "member"];

  function currentTab() {
    const t = location.hash.replace("#", "");
    return TABS.includes(t) ? t : "home";
  }

  function showTab() {
    const tab = currentTab();
    TABS.forEach((t) => ($("view-" + t).hidden = t !== tab));
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
    window.scrollTo(0, 0);
    if (tab === "member") openMember();
  }

  // ─── public: store + menu ─────────────────────────────────────────────────

  function renderStore(s) {
    document.title = s.name;
    document.querySelectorAll(".js-store-name").forEach((n) => (n.textContent = s.name));
    if (s.theme_color) {
      document.documentElement.style.setProperty("--accent", s.theme_color);
      const ink = shade(s.theme_color, 0.72);
      if (ink) document.documentElement.style.setProperty("--accent-ink", ink);
    }
    $("storeName").textContent = s.name;
    $("storeTagline").textContent = s.tagline || "";
    $("storeConcept").textContent = s.concept || "";
    if (s.hero_image_url) $("hero").style.backgroundImage = "url(" + JSON.stringify(s.hero_image_url) + ")";

    const info = $("storeInfo");
    info.innerHTML = "";
    const row = (label, value) => value && info.append(el("div", {}, [el("dt", { text: label }), el("dd", {}, [value])]));
    row("Hours", s.hours && document.createTextNode(s.hours));
    row("Access", s.access && document.createTextNode(s.access));
    row("Address", s.address && (s.map_url
      ? el("a", { href: s.map_url, target: "_blank", rel: "noopener", text: s.address })
      : document.createTextNode(s.address)));
    if (!s.address && s.map_url) row("Map", el("a", { href: s.map_url, target: "_blank", rel: "noopener", text: "Open map" }));
    row("Phone", s.phone && el("a", { href: "tel:" + s.phone.replace(/[^\d+]/g, ""), text: s.phone }));
    info.hidden = !info.children.length;

    const photos = $("storePhotos");
    photos.innerHTML = "";
    (s.photos || []).forEach((src) => {
      const img = el("img", { src, alt: "", loading: "lazy" });
      img.addEventListener("error", () => img.remove());
      photos.append(img);
    });
  }

  function renderMenu(menu) {
    const nav = $("menuNav");
    const list = $("menuList");
    nav.innerHTML = "";
    list.innerHTML = "";
    menu.forEach((cat) => {
      const anchor = "cat-" + cat.key;
      nav.append(el("a", {
        href: "#menu",
        text: cat.label,
        onclick: (e) => {
          e.preventDefault();
          $(anchor).scrollIntoView({ behavior: "smooth" });
        },
      }));
      const items = cat.items.length
        ? cat.items.map((i) =>
            el("div", { class: "menu-item" }, [
              el("div", { class: "name", text: i.name }),
              el("div", { class: "price" }, [
                i.price != null ? yen(i.price) : "—",
                i.price_note ? el("span", { class: "note", text: i.price_note }) : null,
              ]),
              i.description ? el("div", { class: "desc", text: i.description }) : null,
              i.image_url ? el("img", { src: i.image_url, alt: "", loading: "lazy" }) : null,
            ])
          )
        : [el("div", { class: "menu-empty", text: "Ask our staff about today's selection." })];
      list.append(el("section", { class: "menu-cat", id: anchor }, [el("h2", { text: cat.label })].concat(items)));
    });
  }

  // ─── consent ──────────────────────────────────────────────────────────────

  /** Resolves true once store_use consent is granted, false if the guest declines. */
  function askConsent(me) {
    return new Promise((resolve) => {
      $("policyVersion").textContent = me.policy_version;
      $("consentStore").checked = false;
      $("consentPartner").checked = !!me.consent.partner_sharing;
      $("consentAgree").disabled = true;
      $("consentSheet").hidden = false;

      $("consentStore").onchange = () => ($("consentAgree").disabled = !$("consentStore").checked);
      $("consentCancel").onclick = () => {
        $("consentSheet").hidden = true;
        resolve(false);
      };
      $("consentAgree").onclick = async () => {
        $("consentAgree").disabled = true;
        try {
          await api("/consent", { store_use: true, partner_sharing: $("consentPartner").checked });
          $("consentSheet").hidden = true;
          resolve(true);
        } catch (err) {
          toast("Could not save: " + err.message);
          $("consentAgree").disabled = false;
        }
      };
    });
  }

  /** Login + consent, then the fresh /me payload. Null if the guest stopped. */
  async function memberSession() {
    if (!ensureLogin()) return null;
    let me = await api("/me");
    if (me.consent.needs_consent) {
      if (!(await askConsent(me))) return null;
      me = await api("/me");
    }
    state.me = me;
    return me;
  }

  // ─── member card ──────────────────────────────────────────────────────────

  async function openMember() {
    $("memberBody").hidden = true;
    $("memberState").hidden = false;
    $("memberState").textContent = "Loading…";
    try {
      const me = await memberSession();
      if (!me) {
        $("memberState").textContent = "Agree to the data-use terms to see your member card.";
        return;
      }
      renderMember(me);
    } catch (err) {
      $("memberState").textContent = "Could not load: " + err.message;
    }
  }

  function renderMember(me) {
    $("memberState").hidden = true;
    $("memberBody").hidden = false;
    $("mcStore").textContent = state.store.name;
    $("mcName").textContent = me.guest.display_name || "Guest";
    $("mcCount").textContent = me.member.visit_count;
    $("mcCountLabel").textContent = me.member.visit_count === 1 ? "visit" : "visits";
    $("mcSince").textContent = me.member.first_visit_at
      ? "Member since " + date(me.member.first_visit_at)
      : "Scan the QR on your table to record your first visit.";

    const cv = me.member.current_visit;
    $("currentVisit").hidden = !cv;
    if (cv) {
      $("currentVisit").textContent =
        "Checked in at " + time(cv.checked_in_at) +
        (cv.table_no ? " · Table " + cv.table_no : "") +
        (cv.party_size ? " · " + cv.party_size + (cv.party_size === 1 ? " guest" : " guests") : "");
    }

    renderBenefits(me.benefits);
    $("partnerToggle").checked = !!me.consent.partner_sharing;
  }

  function renderBenefits(benefits) {
    const list = $("benefitList");
    list.innerHTML = "";
    if (!benefits.length) {
      list.append(el("div", { class: "notice", text: "No benefits right now." }));
      return;
    }
    benefits.forEach((b) => {
      const sub = {
        available: "Ready — show it to staff now.",
        locked: "Scan the QR on your table on your first visit to unlock.",
        redeemed: "Used on " + (b.redeemed_at ? date(b.redeemed_at) : "") + ".",
        expired: "This welcome gift was for your first visit.",
      }[b.status];
      list.append(el("div", { class: "benefit" + (b.status === "available" ? "" : " dim") }, [
        el("span", { class: "b-icon", text: b.status === "redeemed" ? "✓" : "🍷" }),
        el("div", { class: "b-text" }, [el("div", { class: "b-title", text: b.title }), el("div", { class: "b-sub", text: sub })]),
        b.status === "available" ? el("button", { text: "Show", onclick: () => openPass(b) }) : null,
      ]));
    });
  }

  $("partnerToggle").addEventListener("change", async (e) => {
    const on = e.target.checked;
    try {
      await api("/consent", { partner_sharing: on });
      toast(on ? "Sharing with partner stores is on." : "Sharing with partner stores is off.");
    } catch (err) {
      e.target.checked = !on;
      toast("Could not save: " + err.message);
    }
  });

  // ─── table check-in ───────────────────────────────────────────────────────

  function buildPartyGrid() {
    const grid = $("partyGrid");
    grid.innerHTML = "";
    for (let n = 1; n <= 8; n++) {
      grid.append(el("button", {
        text: n === 8 ? "8+" : String(n),
        onclick: (e) => {
          state.partySize = n;
          grid.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
          e.currentTarget.classList.add("on");
          $("checkinGo").disabled = false;
        },
      }));
    }
  }

  async function startCheckin() {
    try {
      const me = await memberSession();
      if (!me) return toast("Check-in needs your agreement to the data-use terms.");
    } catch (err) {
      return toast("Could not check in: " + err.message);
    }
    state.partySize = 0;
    buildPartyGrid();
    $("ciTable").textContent = state.table;
    $("checkinGo").disabled = true;
    $("checkinErr").hidden = true;
    $("checkinSheet").hidden = false;
  }

  $("checkinCancel").addEventListener("click", () => ($("checkinSheet").hidden = true));

  $("checkinGo").addEventListener("click", async () => {
    $("checkinGo").disabled = true;
    try {
      const res = await api("/checkin", {
        table: state.table,
        party_size: state.partySize,
        raw: DEV_USER ? { dev: true } : { os: liff.getOS(), inClient: liff.isInClient(), liffId: LIFF_ID },
      });
      $("checkinSheet").hidden = true;
      // The visit is recorded: drop ?table so a reload doesn't reopen the sheet.
      const url = new URL(location.href);
      url.searchParams.delete("table");
      history.replaceState(null, "", url);
      state.table = "";
      $("tableCta").hidden = true;

      state.me = Object.assign({}, state.me, { member: res.member, benefits: res.benefits });
      const welcome = res.benefits.find((b) => b.status === "available");
      if (welcome) openPass(welcome);
      else toast(res.is_new ? "Checked in. Welcome back!" : "Check-in updated.");
      if (currentTab() === "member") renderMember(state.me);
    } catch (err) {
      $("checkinErr").textContent = "Could not check in: " + err.message;
      $("checkinErr").hidden = false;
      $("checkinGo").disabled = false;
    }
  });

  // ─── benefit pass + staff PIN ─────────────────────────────────────────────

  let clockTimer;
  let passBenefit = null;

  function openPass(b) {
    passBenefit = b;
    $("passTitle").textContent = b.title;
    $("passGuest").textContent = (state.me && state.me.guest.display_name) || "";
    $("pinPad").hidden = true;
    $("passDone").hidden = true;
    $("passStaff").hidden = false;
    $("pass").hidden = false;
    const tick = () => ($("passClock").textContent = new Date().toLocaleTimeString("ja-JP", { hour12: false }));
    tick();
    clearInterval(clockTimer);
    clockTimer = setInterval(tick, 1000);
  }

  function closePass() {
    $("pass").hidden = true;
    clearInterval(clockTimer);
    if (currentTab() === "member" && state.me) renderMember(state.me);
  }

  function renderPin() {
    const dots = $("pinDots");
    dots.innerHTML = "";
    for (let i = 0; i < Math.max(4, state.pin.length); i++) {
      dots.append(el("span", { class: i < state.pin.length ? "on" : "" }));
    }
  }

  function buildPinKeys() {
    const keys = $("pinKeys");
    keys.innerHTML = "";
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].forEach((k) => {
      keys.append(el("button", {
        text: k,
        class: k === "OK" || k === "⌫" ? "wide" : "",
        onclick: () => {
          if (k === "⌫") state.pin = state.pin.slice(0, -1);
          else if (k === "OK") return submitPin();
          else if (state.pin.length < 8) state.pin += k;
          $("pinErr").textContent = "";
          renderPin();
        },
      }));
    });
  }

  async function submitPin() {
    if (state.pin.length < 4) return ($("pinErr").textContent = "Enter the 4–8 digit staff PIN.");
    const pin = state.pin;
    state.pin = "";
    renderPin();
    try {
      const res = await api("/redeem", { benefit: passBenefit.key, pin });
      $("pinPad").hidden = true;
      $("passStaff").hidden = true;
      $("passDoneAt").textContent = "Confirmed at " + time(res.redeemed_at);
      $("passDone").hidden = false;
      if (state.me) {
        state.me.benefits = state.me.benefits.map((b) =>
          b.key === passBenefit.key ? Object.assign({}, b, { status: "redeemed", redeemed_at: res.redeemed_at }) : b
        );
      }
    } catch (err) {
      $("pinErr").textContent = err.code === "wrong_pin" ? "Wrong PIN." : err.message;
    }
  }

  $("passStaff").addEventListener("click", () => {
    state.pin = "";
    buildPinKeys();
    renderPin();
    $("pinErr").textContent = "";
    $("pinPad").hidden = false;
    $("passStaff").hidden = true;
  });
  $("passClose").addEventListener("click", closePass);

  // ─── boot ─────────────────────────────────────────────────────────────────

  async function main() {
    if (!DEV_USER) {
      if (!LIFF_ID || LIFF_ID === "YOUR_LIFF_ID") return fatal("Setup needed: set MINIAPP_LIFF_ID in config.js");
      try {
        // init restores the original query (?store, ?table) after LINE's redirect.
        await liff.init({ liffId: LIFF_ID });
      } catch (err) {
        return fatal("Could not start: " + err);
      }
    }

    const params = new URLSearchParams(location.search);
    state.slug = (params.get("store") || cfg.STORE_ID || "").trim();
    state.table = (params.get("table") || "").trim().slice(0, 16);
    if (!state.slug) return fatal("No store selected. Scan the QR code at the restaurant.");

    try {
      const res = await fetch(API + "/store?store=" + encodeURIComponent(state.slug));
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "HTTP " + res.status);
      state.store = data.store;
      renderStore(data.store);
      renderMenu(data.menu);
    } catch (err) {
      return fatal("Could not load the store: " + err.message);
    }

    $("boot").hidden = true;
    $("app").hidden = false;
    $("tabs").hidden = false;

    if (state.table) {
      $("tableCta").textContent = "Check in to Table " + state.table;
      $("tableCta").hidden = false;
      $("tableCta").onclick = startCheckin;
    }

    try {
      const tab = sessionStorage.getItem("cz_tab");
      sessionStorage.removeItem("cz_tab");
      if (tab && TABS.includes(tab) && !location.hash) history.replaceState(null, "", "#" + tab);
    } catch (e) { /* storage blocked */ }

    window.addEventListener("hashchange", showTab);
    showTab();
    // Arriving from a table QR: go straight into check-in.
    if (state.table && currentTab() === "home") startCheckin();
  }

  main();
})();
