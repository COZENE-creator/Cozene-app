/**
 * Cozene Phase 1 — Google Apps Script Web App.
 * Receives a visit log from the LIFF client and appends one row to visit_logs.
 *
 * Deploy: Extensions > Apps Script (bound to the target Sheet), then
 *   Deploy > New deployment > Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 * Copy the /exec URL into web/config.js as ENDPOINT_URL.
 *
 * Run setup() once to create the sheet + header row.
 */

const SHEET_NAME = "visit_logs";
const HEADERS = ["visit_id", "store_id", "user_ref", "id_source", "checked_in_at", "raw_payload"];

/** POST endpoint — one visit -> one appended row. */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ ok: false, error: "Empty request body" });
    }
    const body = JSON.parse(e.postData.contents);

    const sheet = getSheet_();
    const visitId = Utilities.getUuid();
    const checkedInAt = body.checked_in_at || new Date().toISOString();

    sheet.appendRow([
      visitId,
      String(body.store_id || ""),
      String(body.user_ref || ""),
      body.id_source === "miniapp" ? "miniapp" : "liff",
      checkedInAt,
      JSON.stringify(body.raw_payload || {}),
    ]);

    return jsonResponse_({ ok: true, visit_id: visitId, checked_in_at: checkedInAt });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/** GET endpoint — simple health check (open the /exec URL in a browser). */
function doGet() {
  return jsonResponse_({ ok: true, service: "cozene-visit-log", sheet: SHEET_NAME });
}

/** Returns the visit_logs sheet, creating it (with headers) if missing. */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Wraps a JS object as a JSON HTTP response. */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to initialize the sheet and verify access. */
function setup() {
  const sheet = getSheet_();
  Logger.log("visit_logs ready. Rows: " + sheet.getLastRow());
}
