// Cozene — weekly special rating screen.
// Shown to the guest right after payment: photo of the week's dish + three
// buttons (Good / OK / Not good). The result drives follow-up LINE messages.
//
// Flow: liff.init -> ensure login -> GET the current special (and this guest's
// previous answer, if any) -> POST the chosen rating.

const cfg = window.COZENE_CONFIG || {};

const els = {
  state: document.getElementById("state"),
  main: document.getElementById("main"),
  photo: document.getElementById("photo"),
  photoFallback: document.getElementById("photoFallback"),
  title: document.getElementById("title"),
  desc: document.getElementById("desc"),
  thanks: document.getElementById("thanks"),
  choices: Array.from(document.querySelectorAll(".choice")),
};

const base = (cfg.ENDPOINT_BASE || "").replace(/\/$/, "");
const CURRENT_URL = cfg.SPECIAL_CURRENT_URL || base + "/api/specials/current";
const RATE_URL = cfg.SPECIAL_RATE_URL || base + "/api/specials/rate";

let profile = null;
let special = null;
let submitting = false;

function showState(text, cls) {
  els.main.hidden = true;
  els.state.hidden = false;
  els.state.textContent = text;
  els.state.className = "state" + (cls ? " " + cls : "");
}

function showMain() {
  els.state.hidden = true;
  els.main.hidden = false;
}

function renderSpecial(s, myRating) {
  els.title.textContent = s.title;
  if (s.description) {
    els.desc.textContent = s.description;
    els.desc.hidden = false;
  }
  if (s.image_url) {
    els.photo.src = s.image_url;
    els.photo.hidden = false;
    // A broken URL should not leave a blank slab at the top of the screen.
    els.photo.addEventListener("error", function () {
      els.photo.hidden = true;
      els.photoFallback.hidden = false;
    });
  } else {
    els.photoFallback.hidden = false;
  }
  if (myRating) markSelected(myRating, true);
  showMain();
}

function markSelected(rating, alreadySaved) {
  els.choices.forEach(function (btn) {
    btn.classList.toggle("on", btn.dataset.rating === rating);
  });
  els.thanks.textContent = alreadySaved
    ? "Thank you — your answer is saved."
    : "Thank you for your feedback!";
  els.thanks.hidden = false;
}

async function submitRating(rating) {
  if (submitting || !special) return;
  submitting = true;
  els.choices.forEach(function (b) { b.disabled = true; });

  // Optimistic: the tap should feel instant even on a slow venue connection.
  markSelected(rating, false);

  try {
    const res = await fetch(RATE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request, no preflight
      body: JSON.stringify({
        store_id: cfg.STORE_ID,
        user_ref: profile.userId,
        special_id: special.id,
        rating: rating,
        id_source: "liff",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "HTTP " + res.status);
    els.thanks.textContent = "Thank you — your answer is saved.";
  } catch (err) {
    els.thanks.textContent = "Could not save: " + (err && err.message ? err.message : err);
    els.thanks.style.color = "#e23744";
    els.choices.forEach(function (b) { b.classList.remove("on"); });
  } finally {
    submitting = false;
    els.choices.forEach(function (b) { b.disabled = false; });
  }
}

async function main() {
  if (!cfg.LIFF_ID || cfg.LIFF_ID === "YOUR_LIFF_ID") {
    return showState("Setup needed: set LIFF_ID in config.js", "err");
  }
  try {
    await liff.init({ liffId: cfg.LIFF_ID });
  } catch (err) {
    return showState("LIFF init failed: " + err, "err");
  }
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return;
  }

  try {
    profile = await liff.getProfile();
    const url =
      CURRENT_URL +
      "?store_id=" + encodeURIComponent(cfg.STORE_ID) +
      "&user_ref=" + encodeURIComponent(profile.userId);
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "HTTP " + res.status);
    if (!data.special) {
      return showState("No special is running this week. Thanks for visiting!");
    }
    special = data.special;
    renderSpecial(data.special, data.my_rating);
  } catch (err) {
    return showState("Could not load: " + (err && err.message ? err.message : err), "err");
  }
}

els.choices.forEach(function (btn) {
  btn.addEventListener("click", function () {
    submitRating(btn.dataset.rating);
  });
});

main();
