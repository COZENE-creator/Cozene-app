// Cozene LINE Mini App — one app for every partner store.
//
// Opened from https://miniapp.line.me/<LIFF_ID>?store=<slug>[&table=<no>]
//   * Home + Menu:  public, no login.
//   * Member card:  login → consent → visit count + benefits.
//   * 予約 tab:     login → consent → reservation request; staff confirm in
//                   Mother and the guest gets a LINE message.
//   * ?table=7:     login → consent → party size → check-in → free-glass pass
//                   on a first visit.
//   * Language:     Japanese by default, English via the switch in the tab bar
//                   (remembered on this phone). Store and menu text come from the
//                   server with an English version in each row's `translations`.
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

  // ngrok's free plan shows a "you are about to visit" page to browsers; this
  // header lets the app's own API calls through it.
  const HEADERS = { "ngrok-skip-browser-warning": "1" };

  const $ = (id) => document.getElementById(id);
  const state = {
    store: null, menu: [], picks: [], booking: null, reservations: null,
    slug: "", table: "", me: null, partySize: 0, pin: "",
  };

  // ─── language ─────────────────────────────────────────────────────────────

  const LANGS = ["ja", "en"]; // first = default
  const STRINGS = {
    ja: {
      tab_home: "ホーム", tab_menu: "メニュー", tab_reserve: "予約", tab_member: "会員証", lang_switch: "EN",
      today_picks: "本日のおすすめ",
      reserve_title: "ご予約",
      reserve_lead: "ご希望の日時をお送りください。お店から確定のご連絡をLINEでお送りします。",
      reserve_date: "日付", reserve_time: "時間", reserve_party: "人数", reserve_name: "お名前",
      reserve_phone: "電話番号", reserve_note: "ご要望",
      reserve_send: "予約をリクエスト",
      reserve_fine: "リクエストの時点では予約は確定していません。確定のお知らせを受け取るには、LINE公式アカウントを友だち追加してください。",
      reserve_closed: "現在ミニアプリでの予約は受け付けておりません。お電話でお問い合わせください。",
      reserve_gate: "ご予約にはデータ利用への同意が必要です。",
      reserve_sent: "予約リクエストを送信しました。確定のご連絡をお待ちください。",
      reserve_mine: "あなたのご予約",
      reserve_party_more: (n) => n + "名以上はお電話でお問い合わせください",
      reserve_no_times: "この日は選べる時間がありません",
      resv_requested: "確認中", resv_confirmed: "確定", resv_declined: "お受けできませんでした", resv_cancelled: "キャンセル済み",
      resv_cancel: "この予約をキャンセル",
      resv_cancel_confirm: "この予約をキャンセルしますか？",
      resv_cancelled_toast: "予約をキャンセルしました。",
      privacy_link: "プライバシーポリシー", privacy_read: "プライバシーポリシーを読む",
      err_reservations_closed: "現在ミニアプリでの予約は受け付けておりません。",
      err_invalid_date: "日付を選び直してください。",
      err_invalid_time: "時間を選び直してください。",
      err_invalid_party: "人数を選び直してください。",
      err_name_required: "お名前を入力してください。",
      err_too_many_requests: "確認中の予約が多いため、お店からの連絡をお待ちください。",
      err_not_cancellable: "この予約はキャンセルできません。",
      loading: "読み込み中…",
      hours: "営業時間", access: "アクセス", address: "住所", map: "地図", open_map: "地図を開く", phone: "電話",
      menu_empty: "本日の内容はスタッフにおたずねください。",
      menu_foot: "価格はすべて税込です。",
      member_label: "MEMBER",
      member_gate: "会員証を表示するには、データ利用への同意が必要です。",
      could_not_load: "読み込めませんでした: {0}",
      guest: "ゲスト",
      visits: (n) => "回のご来店",
      member_since: "会員登録日 {0}",
      first_visit_hint: "テーブルのQRコードを読み取ると、初回のご来店が記録されます。",
      checked_in_at: "{0} チェックイン", table_n: "テーブル {0}", party_n: (n) => n + "名",
      benefits: "特典", privacy: "プライバシー",
      rewards_title: "会員特典", join_member: "会員になる",
      add_friend: "LINE友だち追加",
      friend_lead: "友だち追加すると、予約の確定や特典のお知らせがLINEで届きます。",
      no_benefits: "現在ご利用いただける特典はありません。",
      b_available: "ご利用いただけます。スタッフにお見せください。",
      b_locked: "初回ご来店時にテーブルのQRコードを読み取ると利用できます。",
      b_redeemed: "{0} にご利用済み",
      b_expired: "この特典は初回ご来店時のみ有効でした。",
      show: "表示",
      partner_title: "提携店舗との共有",
      partner_body: "他のCozene提携レストランでもお客様を認識し、特典をお届けできるようになります。",
      partner_on: "提携店舗との共有をオンにしました。", partner_off: "提携店舗との共有をオフにしました。",
      could_not_save: "保存できませんでした: {0}",
      consent_title: "ご利用の前に",
      consent_lead: "{store}は、ご来店やご注文を記録するためにLINE IDを利用し、会員証の表示やお客様に合わせたメッセージのお届けに役立てます。",
      consent_point_store: "保存する情報: LINE IDと表示名、チェックイン時刻、テーブル番号、人数、ご注文内容。",
      consent_point_use: "利用目的: 会員証と特典の提供、お客様に合わせたLINEメッセージの配信。",
      consent_point_stop: "公式アカウントをブロックすると、いつでもメッセージを停止できます。",
      consent_store: "上記のとおり{store}が私のデータを利用することに同意します。",
      consent_partner: "Cozene提携店舗にも共有し、来店時の認識や特典のお届けに利用することに同意します。",
      required: "（必須）", optional: "（任意）",
      policy_version: "ポリシー版",
      consent_agree: "同意して続ける", not_now: "今はしない",
      checkin_title: "チェックイン — テーブル {0}",
      party_question: "何名様でご来店ですか？",
      check_in: "チェックイン", cancel: "キャンセル",
      checkin_cta: "テーブル {0} でチェックイン",
      checkin_needs_consent: "チェックインにはデータ利用への同意が必要です。",
      could_not_checkin: "チェックインできませんでした: {0}",
      checked_in: "チェックインしました。ご来店ありがとうございます！",
      checkin_updated: "チェックイン情報を更新しました。",
      welcome_gift: "ウェルカムギフト", enjoy: "どうぞお楽しみください！", confirmed_at: "{0} に確認しました",
      staff_pin: "スタッフPIN",
      pass_hint: "この画面をスタッフにお見せください。時計が動いていることが有効な画面の印です。",
      staff_confirm: "スタッフ確認", close: "閉じる",
      enter_pin: "4〜8桁のスタッフPINを入力してください。",
      err_wrong_pin: "PINが違います。",
      err_pin_locked: "PINの誤入力が続いたため、15分後にもう一度お試しください。",
      err_pin_not_set: "スタッフPINが未設定です。スタッフにお知らせください。",
      err_already_used: "この特典はすでにご利用済みです。",
      err_not_available: "この特典は今回のご来店ではご利用いただけません。",
      err_consent_required: "データ利用への同意が必要です。",
      setup_needed: "設定が必要です: config.js に MINIAPP_LIFF_ID を設定してください。",
      could_not_start: "起動できませんでした: {0}",
      no_store: "店舗が選択されていません。店内のQRコードを読み取ってください。",
      could_not_load_store: "店舗情報を読み込めませんでした: {0}",
    },
    en: {
      tab_home: "Home", tab_menu: "Menu", tab_reserve: "Book", tab_member: "Member", lang_switch: "日本語",
      today_picks: "Today's picks",
      reserve_title: "Reservation",
      reserve_lead: "Send us your preferred date and time. The restaurant will confirm on LINE.",
      reserve_date: "Date", reserve_time: "Time", reserve_party: "Party size", reserve_name: "Name",
      reserve_phone: "Phone", reserve_note: "Requests",
      reserve_send: "Request a table",
      reserve_fine: "A request isn't a confirmed booking yet. Add the official LINE account as a friend to receive the confirmation.",
      reserve_closed: "Online reservations are closed right now. Please call the restaurant.",
      reserve_gate: "Agree to the data-use terms to make a reservation.",
      reserve_sent: "Request sent. We'll confirm on LINE.",
      reserve_mine: "Your reservations",
      reserve_party_more: (n) => "For " + n + " or more, please call",
      reserve_no_times: "No times left on this day",
      resv_requested: "Waiting", resv_confirmed: "Confirmed", resv_declined: "Not available", resv_cancelled: "Cancelled",
      resv_cancel: "Cancel this reservation",
      resv_cancel_confirm: "Cancel this reservation?",
      resv_cancelled_toast: "Reservation cancelled.",
      privacy_link: "Privacy policy", privacy_read: "Read the privacy policy",
      err_reservations_closed: "Online reservations are closed right now.",
      err_invalid_date: "Please choose the date again.",
      err_invalid_time: "Please choose the time again.",
      err_invalid_party: "Please choose the party size again.",
      err_name_required: "Please enter your name.",
      err_too_many_requests: "You have several requests waiting — please wait for the restaurant's reply.",
      err_not_cancellable: "This reservation can't be cancelled.",
      loading: "Loading…",
      hours: "Hours", access: "Access", address: "Address", map: "Map", open_map: "Open map", phone: "Phone",
      menu_empty: "Ask our staff about today's selection.",
      menu_foot: "All prices include tax.",
      member_label: "MEMBER",
      member_gate: "Agree to the data-use terms to see your member card.",
      could_not_load: "Could not load: {0}",
      guest: "Guest",
      visits: (n) => (n === 1 ? "visit" : "visits"),
      member_since: "Member since {0}",
      first_visit_hint: "Scan the QR on your table to record your first visit.",
      checked_in_at: "Checked in at {0}", table_n: "Table {0}", party_n: (n) => n + (n === 1 ? " guest" : " guests"),
      benefits: "Benefits", privacy: "Privacy",
      rewards_title: "Member rewards", join_member: "Become a member",
      add_friend: "Add us on LINE",
      friend_lead: "Add us as a friend to get booking confirmations and reward news on LINE.",
      no_benefits: "No benefits right now.",
      b_available: "Ready — show it to staff now.",
      b_locked: "Scan the QR on your table on your first visit to unlock.",
      b_redeemed: "Used on {0}.",
      b_expired: "This welcome gift was for your first visit.",
      show: "Show",
      partner_title: "Share with partner stores",
      partner_body: "Let other Cozene partner restaurants recognise you and send offers.",
      partner_on: "Sharing with partner stores is on.", partner_off: "Sharing with partner stores is off.",
      could_not_save: "Could not save: {0}",
      consent_title: "Before you continue",
      consent_lead: "{store} uses your LINE ID to record your visits and orders, so it can show your member card and send you messages that suit you.",
      consent_point_store: "We store: your LINE ID and display name, check-in time, table, party size, and orders.",
      consent_point_use: "We use it to: run your member card and benefits, and send you personalised LINE messages.",
      consent_point_stop: "You can stop messages any time by blocking the official account.",
      consent_store: "I agree to {store} using my data as described.",
      consent_partner: "Also share it with Cozene partner stores so they can recognise me and send offers.",
      required: "(required)", optional: "(optional)",
      policy_version: "Policy version",
      consent_agree: "Agree and continue", not_now: "Not now",
      checkin_title: "Check in — Table {0}",
      party_question: "How many people are in your party?",
      check_in: "Check in", cancel: "Cancel",
      checkin_cta: "Check in to Table {0}",
      checkin_needs_consent: "Check-in needs your agreement to the data-use terms.",
      could_not_checkin: "Could not check in: {0}",
      checked_in: "Checked in. Welcome back!",
      checkin_updated: "Check-in updated.",
      welcome_gift: "Welcome gift", enjoy: "Enjoy your glass!", confirmed_at: "Confirmed at {0}",
      staff_pin: "Staff PIN",
      pass_hint: "Show this screen to staff. The clock proves it is live.",
      staff_confirm: "Staff: confirm", close: "Close",
      enter_pin: "Enter the 4–8 digit staff PIN.",
      err_wrong_pin: "Wrong PIN.",
      err_pin_locked: "Too many wrong PINs. Try again in 15 minutes.",
      err_pin_not_set: "The staff PIN isn't set yet. Please tell the staff.",
      err_already_used: "This gift has already been used.",
      err_not_available: "This gift isn't available for this visit.",
      err_consent_required: "Please agree to the data-use terms first.",
      setup_needed: "Setup needed: set MINIAPP_LIFF_ID in config.js",
      could_not_start: "Could not start: {0}",
      no_store: "No store selected. Scan the QR code at the restaurant.",
      could_not_load_store: "Could not load the store: {0}",
    },
  };

  let lang = LANGS[0];
  try {
    const saved = localStorage.getItem("cz_lang");
    if (LANGS.includes(saved)) lang = saved;
  } catch (e) { /* storage blocked */ }

  /** Interface text in the current language. "{0}" is replaced by `arg`, "{store}" by the store name. */
  function t(key, arg) {
    const v = STRINGS[lang][key] ?? STRINGS[LANGS[0]][key] ?? key;
    const text = typeof v === "function" ? v(arg) : v;
    return text.replace("{0}", arg == null ? "" : arg).replace("{store}", state.store ? state.store.name : "");
  }

  /** A row's field in the current language; falls back to the default-language column. */
  function loc(row, field) {
    const tr = row && row.translations && row.translations[lang];
    return (tr && tr[field]) || row[field];
  }

  /** Message for an API error: translated when the server sent a known code. */
  function errText(err) {
    const key = "err_" + err.code;
    return STRINGS[lang][key] ? t(key) : err.message;
  }

  function applyStaticText() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((n) => (n.textContent = t(n.dataset.i18n)));
    $("langBtn").textContent = t("lang_switch");
  }

  function setLanguage(next) {
    lang = next;
    try { localStorage.setItem("cz_lang", lang); } catch (e) { /* storage blocked */ }
    applyStaticText();
    if (state.store) {
      renderStore(state.store);
      renderMenu(state.menu);
    }
    if (state.table) $("tableCta").textContent = t("checkin_cta", state.table);
    $("ciTitle").textContent = t("checkin_title", state.table);
    if (passBenefit) $("passTitle").textContent = loc(passBenefit, "title");
    if (state.me && !$("memberBody").hidden) renderMember(state.me);
    if (!$("reserveBody").hidden) {
      buildReserveForm(true);
      renderReservations();
    }
  }

  $("langBtn").addEventListener("click", () => setLanguage(lang === LANGS[0] ? LANGS[1] : LANGS[0]));

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
      headers: Object.assign({ "Content-Type": "text/plain;charset=utf-8" }, HEADERS),
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

  const TABS = ["home", "menu", "reserve", "member"];

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
    if (tab === "reserve") openReserve();
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
    $("storeTagline").textContent = loc(s, "tagline") || "";
    $("storeConcept").textContent = loc(s, "concept") || "";
    if (s.hero_image_url) $("hero").style.backgroundImage = "url(" + JSON.stringify(s.hero_image_url) + ")";

    const info = $("storeInfo");
    info.innerHTML = "";
    const row = (label, value) => value && info.append(el("div", {}, [el("dt", { text: label }), el("dd", {}, [value])]));
    const hours = loc(s, "hours"), access = loc(s, "access"), address = loc(s, "address");
    row(t("hours"), hours && document.createTextNode(hours));
    row(t("access"), access && document.createTextNode(access));
    row(t("address"), address && (s.map_url
      ? el("a", { href: s.map_url, target: "_blank", rel: "noopener", text: address })
      : document.createTextNode(address)));
    if (!address && s.map_url) row(t("map"), el("a", { href: s.map_url, target: "_blank", rel: "noopener", text: t("open_map") }));
    row(t("phone"), s.phone && el("a", { href: "tel:" + s.phone.replace(/[^\d+]/g, ""), text: s.phone }));
    info.hidden = !info.children.length;

    const rewards = loc(s, "rewards_text") || "";
    document.querySelectorAll(".js-rewards-text").forEach((n) => (n.textContent = rewards));
    $("homeRewards").hidden = !rewards;
    $("memberRewards").hidden = !rewards;
    $("consentFriend").hidden = !s.line_friend_url;
    document.querySelectorAll("#view-home .js-friend").forEach((n) => (n.hidden = !s.line_friend_url));

    const photos = $("storePhotos");
    photos.innerHTML = "";
    (s.photos || []).forEach((src) => {
      const img = el("img", { src, alt: "", loading: "lazy" });
      img.addEventListener("error", () => img.remove());
      photos.append(img);
    });
  }

  function renderPicks() {
    const box = $("todayPicks");
    box.innerHTML = "";
    box.hidden = !state.picks.length;
    if (!state.picks.length) return;
    box.append(el("h2", { text: "★ " + t("today_picks") }));
    state.picks.forEach((r) => {
      box.append(el("div", { class: "pick" }, [
        el("div", { class: "name", text: loc(r, "title") }),
        el("div", { class: "price" }, [
          r.price != null ? yen(r.price) : "",
          loc(r, "price_note") ? el("span", { class: "note", text: loc(r, "price_note") }) : null,
        ]),
        loc(r, "description") ? el("div", { class: "desc", text: loc(r, "description") }) : null,
        r.image_url ? el("img", { src: r.image_url, alt: "", loading: "lazy" }) : null,
      ]));
    });
  }

  function renderMenu(menu) {
    renderPicks();
    const nav = $("menuNav");
    const list = $("menuList");
    nav.innerHTML = "";
    list.innerHTML = "";
    menu.forEach((cat) => {
      const anchor = "cat-" + cat.key;
      nav.append(el("a", {
        href: "#menu",
        text: loc(cat, "label"),
        onclick: (e) => {
          e.preventDefault();
          $(anchor).scrollIntoView({ behavior: "smooth" });
        },
      }));
      const items = cat.items.length
        ? cat.items.map((i) =>
            el("div", { class: "menu-item" }, [
              el("div", { class: "name", text: loc(i, "name") }),
              el("div", { class: "price" }, [
                i.price != null ? yen(i.price) : "—",
                loc(i, "price_note") ? el("span", { class: "note", text: loc(i, "price_note") }) : null,
              ]),
              loc(i, "description") ? el("div", { class: "desc", text: loc(i, "description") }) : null,
              i.image_url ? el("img", { src: i.image_url, alt: "", loading: "lazy" }) : null,
            ])
          )
        : [el("div", { class: "menu-empty", text: t("menu_empty") })];
      list.append(el("section", { class: "menu-cat", id: anchor }, [el("h2", { text: loc(cat, "label") })].concat(items)));
    });
  }

  // ─── add friend ───────────────────────────────────────────────────────────

  /** Open the Official Account's add-friend page (inside LINE when possible). */
  function addFriend() {
    const url = state.store && state.store.line_friend_url;
    if (!url) return;
    if (!DEV_USER && window.liff && liff.isInClient()) liff.openWindow({ url, external: false });
    else window.open(url, "_blank", "noopener");
  }
  document.querySelectorAll(".js-friend").forEach((b) => b.addEventListener("click", addFriend));
  $("homeJoin").addEventListener("click", () => (location.hash = "member"));

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
          toast(t("could_not_save", errText(err)));
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
    $("memberState").textContent = t("loading");
    try {
      const me = await memberSession();
      if (!me) {
        $("memberState").textContent = t("member_gate");
        return;
      }
      renderMember(me);
    } catch (err) {
      $("memberState").textContent = t("could_not_load", errText(err));
    }
  }

  function renderMember(me) {
    $("memberState").hidden = true;
    $("memberBody").hidden = false;
    $("mcStore").textContent = state.store.name;
    $("mcName").textContent = me.guest.display_name || t("guest");
    $("mcCount").textContent = me.member.visit_count;
    $("mcCountLabel").textContent = t("visits", me.member.visit_count);
    $("mcSince").textContent = me.member.first_visit_at
      ? t("member_since", date(me.member.first_visit_at))
      : t("first_visit_hint");

    const cv = me.member.current_visit;
    $("currentVisit").hidden = !cv;
    if (cv) {
      $("currentVisit").textContent = [
        t("checked_in_at", time(cv.checked_in_at)),
        cv.table_no ? t("table_n", cv.table_no) : null,
        cv.party_size ? t("party_n", cv.party_size) : null,
      ].filter(Boolean).join(" · ");
    }

    renderBenefits(me.benefits);
    $("memberFriend").hidden = !state.store.line_friend_url || me.guest.is_friend === true;
    $("partnerToggle").checked = !!me.consent.partner_sharing;
  }

  function renderBenefits(benefits) {
    const list = $("benefitList");
    list.innerHTML = "";
    if (!benefits.length) {
      list.append(el("div", { class: "notice", text: t("no_benefits") }));
      return;
    }
    benefits.forEach((b) => {
      const sub = b.status === "redeemed"
        ? t("b_redeemed", b.redeemed_at ? date(b.redeemed_at) : "")
        : t("b_" + b.status);
      list.append(el("div", { class: "benefit" + (b.status === "available" ? "" : " dim") }, [
        el("span", { class: "b-icon", text: b.status === "redeemed" ? "✓" : "🍷" }),
        el("div", { class: "b-text" }, [el("div", { class: "b-title", text: loc(b, "title") }), el("div", { class: "b-sub", text: sub })]),
        b.status === "available" ? el("button", { text: t("show"), onclick: () => openPass(b) }) : null,
      ]));
    });
  }

  $("partnerToggle").addEventListener("change", async (e) => {
    const on = e.target.checked;
    try {
      await api("/consent", { partner_sharing: on });
      toast(t(on ? "partner_on" : "partner_off"));
    } catch (err) {
      e.target.checked = !on;
      toast(t("could_not_save", errText(err)));
    }
  });

  // ─── reservations ─────────────────────────────────────────────────────────

  const japanToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
  const japanNow = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).format(new Date());

  function addDays(ymd, days) {
    const d = new Date(ymd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function reservationTime(iso) {
    const d = new Date(iso);
    const opts = { timeZone: "Asia/Tokyo", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
    return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ja-JP", opts).format(d);
  }

  /** Time choices for the picked date: today only shows times still ahead. */
  function fillTimes() {
    const b = state.booking;
    const sel = $("rTime");
    const keep = sel.value;
    const isToday = $("rDate").value === japanToday();
    const now = japanNow();
    const times = b.times.filter((x) => !isToday || x > now);
    sel.innerHTML = "";
    if (!times.length) sel.append(el("option", { value: "", text: t("reserve_no_times") }));
    times.forEach((x) => sel.append(el("option", { value: x, text: x })));
    if (times.includes(keep)) sel.value = keep;
  }

  /** Set up the form from the store's booking hours. `keepValues` keeps what the guest typed. */
  function buildReserveForm(keepValues) {
    const b = state.booking;
    const today = japanToday();
    $("rDate").min = today;
    $("rDate").max = addDays(today, b.days_ahead);
    if (!keepValues || !$("rDate").value) $("rDate").value = today;
    fillTimes();
    const party = $("rParty");
    const keep = party.value;
    party.innerHTML = "";
    for (let n = 1; n <= b.max_party; n++) party.append(el("option", { value: String(n), text: t("party_n", n) }));
    party.append(el("option", { value: "", disabled: "disabled", text: t("reserve_party_more", b.max_party + 1) }));
    party.value = keepValues && keep ? keep : String(Math.min(2, b.max_party));
    if (!keepValues && !$("rName").value && state.me) $("rName").value = state.me.guest.display_name || "";
  }

  function renderReservations() {
    const box = $("myReservations");
    box.innerHTML = "";
    const list = (state.reservations || []).filter((r) => r.status !== "cancelled");
    if (!list.length) return;
    box.append(el("h2", { class: "section-title first", text: t("reserve_mine") }));
    list.forEach((r) => {
      const canCancel = (r.status === "requested" || r.status === "confirmed") && new Date(r.reserved_for) > new Date();
      box.append(el("div", { class: "resv" }, [
        el("div", { class: "resv-top" }, [
          el("span", { class: "resv-when", text: reservationTime(r.reserved_for) }),
          el("span", { class: "resv-status " + r.status, text: t("resv_" + r.status) }),
        ]),
        el("div", { class: "resv-sub", text: [t("party_n", r.party_size), r.name].join(" · ") + (r.staff_message ? "\n" + r.staff_message : "") }),
        canCancel ? el("button", { class: "resv-cancel", type: "button", text: t("resv_cancel"), onclick: () => cancelReservation(r) }) : null,
      ]));
    });
  }

  async function openReserve() {
    $("reserveBody").hidden = true;
    $("reserveState").hidden = false;
    $("reserveState").textContent = t("loading");
    try {
      const me = await memberSession();
      if (!me) {
        $("reserveState").textContent = t("reserve_gate");
        return;
      }
      const res = await api("/reservations", { action: "list" });
      state.reservations = res.reservations;
      $("reserveState").hidden = true;
      $("reserveBody").hidden = false;
      const open = state.booking && state.booking.enabled;
      $("reserveForm").hidden = !open;
      $("reserveClosed").hidden = open;
      if (open) buildReserveForm(false);
      renderReservations();
    } catch (err) {
      $("reserveState").textContent = t("could_not_load", errText(err));
    }
  }

  async function cancelReservation(r) {
    if (!window.confirm(t("resv_cancel_confirm"))) return;
    try {
      const res = await api("/reservations", { action: "cancel", id: r.id });
      state.reservations = res.reservations;
      renderReservations();
      toast(t("resv_cancelled_toast"));
    } catch (err) {
      toast(errText(err));
    }
  }

  $("rDate").addEventListener("change", fillTimes);

  $("reserveForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const showErr = (msg) => {
      $("reserveErr").textContent = msg;
      $("reserveErr").hidden = false;
    };
    $("reserveErr").hidden = true;
    if (!$("rTime").value) return showErr(t("err_invalid_time"));
    if (!$("rName").value.trim()) return showErr(t("err_name_required"));
    $("reserveGo").disabled = true;
    try {
      const res = await api("/reservations", {
        action: "create",
        date: $("rDate").value,
        time: $("rTime").value,
        party_size: Number($("rParty").value),
        name: $("rName").value,
        phone: $("rPhone").value,
        note: $("rNote").value,
        lang,
      });
      state.reservations = res.reservations;
      $("rNote").value = "";
      renderReservations();
      toast(t("reserve_sent"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      showErr(errText(err));
    } finally {
      $("reserveGo").disabled = false;
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
      if (!me) return toast(t("checkin_needs_consent"));
    } catch (err) {
      return toast(t("could_not_checkin", errText(err)));
    }
    state.partySize = 0;
    buildPartyGrid();
    $("ciTitle").textContent = t("checkin_title", state.table);
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
      else toast(t(res.is_new ? "checked_in" : "checkin_updated"));
      if (currentTab() === "member") renderMember(state.me);
    } catch (err) {
      $("checkinErr").textContent = t("could_not_checkin", errText(err));
      $("checkinErr").hidden = false;
      $("checkinGo").disabled = false;
    }
  });

  // ─── benefit pass + staff PIN ─────────────────────────────────────────────

  let clockTimer;
  let passBenefit = null;

  function openPass(b) {
    passBenefit = b;
    $("passTitle").textContent = loc(b, "title");
    $("passGuest").textContent = (state.me && state.me.guest.display_name) || "";
    $("pinPad").hidden = true;
    $("passDone").hidden = true;
    $("passStaff").hidden = false;
    $("passHint").hidden = false;
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
    if (state.pin.length < 4) return ($("pinErr").textContent = t("enter_pin"));
    const pin = state.pin;
    state.pin = "";
    renderPin();
    try {
      const res = await api("/redeem", { benefit: passBenefit.key, pin });
      $("pinPad").hidden = true;
      $("passStaff").hidden = true;
      $("passHint").hidden = true;
      $("passDoneAt").textContent = t("confirmed_at", time(res.redeemed_at));
      $("passDone").hidden = false;
      if (state.me) {
        state.me.benefits = state.me.benefits.map((b) =>
          b.key === passBenefit.key ? Object.assign({}, b, { status: "redeemed", redeemed_at: res.redeemed_at }) : b
        );
      }
    } catch (err) {
      $("pinErr").textContent = errText(err);
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
    applyStaticText();
    if (!DEV_USER) {
      if (!LIFF_ID || LIFF_ID === "YOUR_LIFF_ID") return fatal(t("setup_needed"));
      try {
        // init restores the original query (?store, ?table) after LINE's redirect.
        await liff.init({ liffId: LIFF_ID });
      } catch (err) {
        return fatal(t("could_not_start", String(err)));
      }
    }

    const params = new URLSearchParams(location.search);
    state.slug = (params.get("store") || cfg.STORE_ID || "").trim();
    state.table = (params.get("table") || "").trim().slice(0, 16);
    if (!state.slug) return fatal(t("no_store"));

    try {
      const res = await fetch(API + "/store?store=" + encodeURIComponent(state.slug), { headers: HEADERS });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "HTTP " + res.status);
      state.store = data.store;
      state.menu = data.menu;
      state.picks = data.recommendations || [];
      state.booking = data.reservation || null;
      applyStaticText(); // fills {store} in the consent text
      renderStore(data.store);
      renderMenu(data.menu);
    } catch (err) {
      return fatal(t("could_not_load_store", err.message));
    }

    $("boot").hidden = true;
    $("app").hidden = false;
    $("tabs").hidden = false;

    if (state.table) {
      $("tableCta").textContent = t("checkin_cta", state.table);
      $("tableCta").hidden = false;
      $("tableCta").onclick = startCheckin;
    }

    try {
      const tab = sessionStorage.getItem("cz_tab");
      sessionStorage.removeItem("cz_tab");
      if (tab && TABS.includes(tab) && !location.hash) history.replaceState(null, "", "#" + tab);
    } catch (e) { /* storage blocked */ }

    window.addEventListener("hashchange", showTab);
    // The page has <base href="/miniapp/">, so a plain href="#menu" would load
    // /miniapp/#menu — a full reload that drops ?store and ?table. Switch tabs
    // by changing only the hash of the current URL.
    document.querySelectorAll(".tabs a").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentTab() !== a.dataset.tab) location.hash = a.dataset.tab;
      })
    );
    showTab();
    // Arriving from a table QR: go straight into check-in.
    if (state.table && currentTab() === "home") startCheckin();
  }

  main();
})();
