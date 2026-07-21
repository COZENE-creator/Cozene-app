// Cozene Phase 2 — LIFF in-app ordering.
// Flow: liff.init -> ensure login -> get userId -> build cart -> POST /api/order.
// The backend stamps userId onto the Square order (reference_id) so payments auto-link.

const cfg = window.COZENE_CONFIG || {};

// MVP menu. Amounts are in minor units (JPY has none -> whole yen). Swap for a
// Square Catalog sync later without touching this flow.
const MENU = (cfg.MENU && cfg.MENU.length ? cfg.MENU : [
  { name: "Coffee", amount: 400 },
  { name: "Latte", amount: 500 },
  { name: "Cheesecake", amount: 600 },
  { name: "Sandwich", amount: 750 },
]);

const cart = {}; // name -> quantity
let profile = null;

const els = {
  menu: document.getElementById("menu"),
  status: document.getElementById("status"),
  bar: document.getElementById("bar"),
  total: document.getElementById("total"),
  submit: document.getElementById("submit"),
};

function yen(n) { return "¥" + n.toLocaleString("ja-JP"); }

function total() {
  return MENU.reduce((sum, m) => sum + m.amount * (cart[m.name] || 0), 0);
}

function renderTotal() {
  els.total.textContent = yen(total());
  els.submit.disabled = total() === 0;
}

function renderMenu() {
  els.menu.innerHTML = "";
  MENU.forEach((m) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML =
      '<span class="name"></span><span class="price"></span>' +
      '<span class="qty"><button class="minus">−</button><span class="n">0</span><button class="plus">+</button></span>';
    row.querySelector(".name").textContent = m.name;
    row.querySelector(".price").textContent = yen(m.amount);
    const nEl = row.querySelector(".n");
    row.querySelector(".plus").addEventListener("click", () => {
      cart[m.name] = (cart[m.name] || 0) + 1;
      nEl.textContent = cart[m.name];
      renderTotal();
    });
    row.querySelector(".minus").addEventListener("click", () => {
      cart[m.name] = Math.max(0, (cart[m.name] || 0) - 1);
      nEl.textContent = cart[m.name];
      renderTotal();
    });
    els.menu.appendChild(row);
  });
}

function showStatus(text, cls) {
  els.menu.hidden = true;
  els.bar.hidden = true;
  els.status.hidden = false;
  els.status.innerHTML = '<div class="' + (cls || "") + '">' + text + "</div>";
}

async function submitOrder() {
  els.submit.disabled = true;
  const items = MENU
    .filter((m) => (cart[m.name] || 0) > 0)
    .map((m) => ({ name: m.name, quantity: cart[m.name], amount: m.amount }));

  try {
    const res = await fetch(cfg.ORDER_URL || (cfg.ENDPOINT_BASE || "") + "/api/order", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request, no preflight
      body: JSON.stringify({
        store_id: cfg.STORE_ID,
        user_ref: profile.userId,
        currency: "JPY",
        items,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || ("HTTP " + res.status));
    showStatus("Order placed! 🎉<br>Total " + yen(data.total), "ok");
  } catch (err) {
    showStatus("Order failed<br>" + (err && err.message ? err.message : err), "err");
  }
}

async function main() {
  if (!cfg.LIFF_ID || cfg.LIFF_ID === "YOUR_LIFF_ID") {
    return showStatus("Setup needed: set LIFF_ID in config.js", "err");
  }
  try {
    await liff.init({ liffId: cfg.LIFF_ID });
  } catch (err) {
    return showStatus("LIFF init failed: " + err, "err");
  }
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return;
  }
  profile = await liff.getProfile();
  renderMenu();
  renderTotal();
  els.bar.hidden = false;
}

els.submit.addEventListener("click", submitOrder);
main();
