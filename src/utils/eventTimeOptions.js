/** Shared 12-hour time dropdown options (same as Add Event). */

export function formatTime12FromTotalMinutes(totalMinutes) {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export const AM_SESSION_TIME_OPTIONS = (() => {
  const options = [];
  for (let m = 6 * 60; m <= 11 * 60 + 45; m += 15) {
    options.push(formatTime12FromTotalMinutes(m));
  }
  return options;
})();

export const PM_SESSION_TIME_OPTIONS = (() => {
  const options = [];
  for (let m = 12 * 60; m <= 18 * 60; m += 15) {
    options.push(formatTime12FromTotalMinutes(m));
  }
  return options;
})();

/**
 * Native `<select>`: symmetric padding often looks off-center; use tight left inset +
 * `text-align-last` so the chosen time reads flush left (Chrome/Safari/Firefox).
 */
export const EVENT_TIME_SELECT_CLASS =
  "block w-full min-w-0 cursor-pointer rounded-lg border border-gray-300 bg-white py-2 pl-2 pr-10 text-left text-sm text-[#07713c] [direction:ltr] [text-align-last:left] focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55";

function parseSqlToMinutes(sql) {
  if (sql == null || String(sql).trim() === "") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(sql).trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Backend SQL time → dropdown value (snaps to 15 min within AM/PM session window).
 */
export function sqlTimeToSessionSelectValue(sql, session) {
  const minM = session === "am" ? 6 * 60 : 12 * 60;
  const maxM = session === "am" ? 11 * 60 + 45 : 18 * 60;
  const mins = parseSqlToMinutes(sql);
  if (mins == null) return "";
  let clamped = Math.max(minM, Math.min(maxM, mins));
  clamped = Math.round(clamped / 15) * 15;
  clamped = Math.max(minM, Math.min(maxM, clamped));
  return formatTime12FromTotalMinutes(clamped);
}

/** "8:00 AM" → `HH:MM:SS` for API / mapper */
export function twelveHourLabelToSqlTime(label) {
  if (label == null || String(label).trim() === "") return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(label).trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === "AM") {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}
