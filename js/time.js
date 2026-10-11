// Clocks, worked out on the phone from IANA zone names, so summer time and
// any country's change of rules follow the phone's own software.

const formats = new Map();
function parts(tz, date) {
  let f = formats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formats.set(tz, f);
  }
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = +p.value;
  return o;
}

/** Minutes the zone is ahead of UTC at that moment. */
export function offsetMinutes(tz, date = new Date()) {
  const t = Math.floor(date.getTime() / 1000) * 1000;
  const p = parts(tz, new Date(t));
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t) / 60000);
}

/** The moment at which the zone's clocks read the given wall time. */
export function zonedToUtc(tz, y, mo, d, h, mi) {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let t = wall - offsetMinutes(tz, new Date(wall)) * 60000;
  t = wall - offsetMinutes(tz, new Date(t)) * 60000;
  return new Date(t);
}

export function formatOffset(min) {
  const sign = min < 0 ? '−' : '+';
  const a = Math.abs(min);
  const h = Math.floor(a / 60), m = a % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

export function formatSpan(min) {
  const a = Math.abs(min);
  const h = Math.floor(a / 60), m = a % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function clock(tz, date = new Date(), withDay = false) {
  const opts = { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  if (withDay) opts.weekday = 'short';
  return new Intl.DateTimeFormat('en-GB', opts).format(date);
}

export function longDate(tz, date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** A ship keeping zone time: the clock at a fixed offset from UTC. */
export function shipClock(offsetMin, date = new Date(), withDay = false) {
  const d = new Date(date.getTime() + offsetMin * 60000);
  const opts = { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  if (withDay) opts.weekday = 'short';
  return new Intl.DateTimeFormat('en-GB', opts).format(d);
}

/** The next time the zone's clocks change within `days`, if they do. */
export function nextClockChange(tz, from = new Date(), days = 60) {
  const start = offsetMinutes(tz, from);
  let lo = from.getTime();
  for (let i = 1; i <= days; i++) {
    let hi = from.getTime() + i * 86400000;
    if (offsetMinutes(tz, new Date(hi)) === start) { lo = hi; continue; }
    while (hi - lo > 60000) {
      const mid = Math.floor((lo + hi) / 2);
      if (offsetMinutes(tz, new Date(mid)) === start) lo = mid; else hi = mid;
    }
    // Clocks change on the minute; the search lands within one after it.
    const at = new Date(Math.floor(hi / 60000) * 60000);
    return { at, from: start, to: offsetMinutes(tz, at) };
  }
  return null;
}

/**
 * Sunrise and sunset for the day containing `date` at the place, by the
 * standard sunrise equation; good to a minute or two.
 * Returns { rise, set } as Dates, or { polar: 'day' | 'night' }.
 */
export function sun(lat, lon, date = new Date()) {
  const rad = Math.PI / 180;
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008 + lon / 360);
  const js = n - lon / 360;
  const M = ((357.5291 + 0.98560028 * js) % 360 + 360) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const sinD = Math.sin(L * rad) * Math.sin(23.4397 * rad);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinD) / (Math.cos(lat * rad) * cosD);
  if (cosW < -1) return { polar: 'day' };
  if (cosW > 1) return { polar: 'night' };
  const w = Math.acos(cosW) / rad;
  const toDate = (j) => new Date((j - 2440587.5) * 86400000);
  return { rise: toDate(transit - w / 360), set: toDate(transit + w / 360) };
}

/** 51°54.0′N 004°29.0′E — the way positions are written at sea. */
export function position(lat, lon) {
  const f = (v, w, pos, neg) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = (a - d) * 60;
    return `${String(d).padStart(w, '0')}°${m.toFixed(1).padStart(4, '0')}′${v < 0 ? neg : pos}`;
  };
  return `${f(lat, 2, 'N', 'S')} ${f(lon, 3, 'E', 'W')}`;
}
