// Copy this file to config.js and fill in your real values.
// config.js is git-ignored so secrets/IDs stay out of version control.
window.COZENE_CONFIG = {
  // From LINE Developers > your LIFF app. Format: 1234567890-abcdEFGH
  LIFF_ID: "YOUR_LIFF_ID",

  // Base URL of the Mother System (Next.js app). Phase 2 replaces the old
  // Apps Script endpoint with the app's own API routes.
  ENDPOINT_BASE: "https://your-mother-system.example.com",

  // Check-in endpoint (Phase 1 flow, now served by the Mother System).
  // Defaults to ENDPOINT_BASE + "/api/checkin" if left blank.
  ENDPOINT_URL: "https://your-mother-system.example.com/api/checkin",

  // In-app ordering endpoint. Defaults to ENDPOINT_BASE + "/api/order".
  ORDER_URL: "https://your-mother-system.example.com/api/order",

  // Weekly-special rating screen (rate.html). Both default to ENDPOINT_BASE +
  // "/api/specials/current" and "/api/specials/rate" if left blank.
  // SPECIAL_CURRENT_URL: "https://your-mother-system.example.com/api/specials/current",
  // SPECIAL_RATE_URL: "https://your-mother-system.example.com/api/specials/rate",

  // LINE Mini App (web/miniapp/). One Mini App serves every store; the store and
  // table come from the QR URL (?store=<slug>&table=<no>). Falls back to LIFF_ID.
  MINIAPP_LIFF_ID: "YOUR_MINIAPP_LIFF_ID",

  // Local testing only: skip LINE login and act as this user. Requires the
  // Mother System to run with LINE_ID_TOKEN_DEV=1. Never set in production.
  // DEV_USER_ID: "Udev0001",

  // Identifies this store. Must match a `stores.slug` in the database.
  STORE_ID: "store_001",

  // Optional: override the ordering menu. Amounts are minor units (whole yen).
  // MENU: [{ name: "Coffee", amount: 400 }, { name: "Latte", amount: 500 }],
};
