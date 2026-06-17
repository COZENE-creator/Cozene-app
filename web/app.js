// Cozene Phase 1 — LIFF check-in client.
// Flow: open via QR -> liff.init -> ensure login -> get userId -> POST visit log.

const cfg = window.COZENE_CONFIG || {};

const els = {
  spinner: document.getElementById("spinner"),
  status: document.getElementById("status"),
  detail: document.getElementById("detail"),
  retry: document.getElementById("retry"),
};

function setStatus(text, cls) {
  els.status.textContent = text;
  els.status.className = "status" + (cls ? " " + cls : "");
}

function showSpinner(on) {
  els.spinner.style.display = on ? "block" : "none";
}

function fail(message, detail) {
  showSpinner(false);
  setStatus(message, "err");
  if (detail) els.detail.textContent = detail;
  els.retry.hidden = false;
}

async function sendVisitLog(profile) {
  // Schema mirrors visit_logs (visit_id is assigned server-side).
  const payload = {
    store_id: cfg.STORE_ID,
    user_ref: profile.userId,
    id_source: "liff",
    checked_in_at: new Date().toISOString(),
    raw_payload: {
      displayName: profile.displayName,
      os: liff.getOS(),
      inClient: liff.isInClient(),
      liffId: cfg.LIFF_ID,
    },
  };

  // text/plain keeps it a "simple" request -> no CORS preflight against Apps Script.
  const res = await fetch(cfg.ENDPOINT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || ("HTTP " + res.status));
  }
  return data;
}

async function main() {
  if (!cfg.LIFF_ID || cfg.LIFF_ID === "YOUR_LIFF_ID") {
    return fail("Setup needed", "Copy config.example.js to config.js and set LIFF_ID / ENDPOINT_URL.");
  }

  try {
    await liff.init({ liffId: cfg.LIFF_ID });
  } catch (err) {
    return fail("LIFF init failed", String(err));
  }

  // liff.login() redirects away and comes back, so the rest runs after redirect.
  if (!liff.isLoggedIn()) {
    setStatus("Redirecting to LINE login…");
    liff.login({ redirectUri: window.location.href });
    return;
  }

  try {
    const profile = await liff.getProfile();
    setStatus("Recording your visit…");
    const result = await sendVisitLog(profile);
    showSpinner(false);
    setStatus("Checked in! 🎉", "ok");
    els.detail.textContent = "visit_id: " + result.visit_id;
  } catch (err) {
    fail("Check-in failed", String(err && err.message ? err.message : err));
  }
}

els.retry.addEventListener("click", () => {
  els.retry.hidden = true;
  els.detail.textContent = "";
  showSpinner(true);
  setStatus("Retrying…");
  main();
});

main();
