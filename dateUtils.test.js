// Test cases for dateUtils.

const { formatWeekLabel, getWeekBounds, formatDueDate, toDatetimeLocalValue, formatNotifDate } = require('./dateUtils');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives what formatDueDate / toDatetimeLocalValue / formatNotifDate should
 * produce for a given ISO string by interpreting it in the *local* timezone of
 * whatever environment is running the tests — the same way the source functions
 * do.  This makes every assertion timezone-agnostic.
 */
function localPartsOf(isoString) {
  const d = new Date(isoString);
  const days   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName   = days[d.getDay()];
  const monthName = months[d.getMonth()];
  const date      = d.getDate();
  const year      = d.getFullYear();

  let hours   = d.getHours();
  const mins  = d.getMinutes().toString().padStart(2, '0');
  const ampm  = hours >= 12 ? 'PM' : 'AM';
  hours       = hours % 12 || 12;

  const pad = n => String(n).padStart(2, '0');
  const localISO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(date)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return { dayName, monthName, date, year, hours, mins, ampm, localISO };
}

// ---------------------------------------------------------------------------
// getWeekBounds
// ---------------------------------------------------------------------------

describe('getWeekBounds', () => {
  // Pin "now" to a known Tuesday so the week boundaries are deterministic.
  // 2026-04-07T12:00:00Z is a Tuesday in every timezone.
  // Pass the numeric epoch value — this version of Jest requires a number, not a Date.
  const FIXED_NOW_MS = new Date('2026-04-07T12:00:00.000Z').getTime();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW_MS);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('start is midnight (00:00:00) on Sunday', () => {
    const { start } = getWeekBounds();
    expect(start.getDay()).toBe(0);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  test('end is 23:59:59.999 on Saturday', () => {
    const { end } = getWeekBounds();
    expect(end.getDay()).toBe(6);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  test('end is exactly 6 days after start', () => {
    const { start, end } = getWeekBounds();
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    // 6 days + 23h 59m 59.999s ≈ 6.999... days
    expect(diffDays).toBeCloseTo(6.9999999, 4);
  });

  test('offset +1 shifts both bounds forward by 7 days', () => {
    const { start: s0, end: e0 } = getWeekBounds(0);
    const { start: s1, end: e1 } = getWeekBounds(1);
    expect(s1 - s0).toBe(7 * 24 * 60 * 60 * 1000);
    expect(e1 - e0).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('offset -1 shifts both bounds back by 7 days', () => {
    const { start: s0, end: e0 } = getWeekBounds(0);
    const { start: sm1, end: em1 } = getWeekBounds(-1);
    expect(s0 - sm1).toBe(7 * 24 * 60 * 60 * 1000);
    expect(e0 - em1).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// formatWeekLabel
// ---------------------------------------------------------------------------

describe('formatWeekLabel', () => {
  // Pin to 2026-04-07 (Tuesday).  The week containing that day runs
  // Sun Apr 5 – Sat Apr 11 in every timezone, because noon UTC is always
  // the same local calendar day (UTC-12 … UTC+14 all agree on "Apr 7").
  const FIXED_NOW_MS = new Date('2026-04-07T12:00:00.000Z').getTime();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW_MS);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns the label for the current week (offset 0)', () => {
    // Compute the expected label the same way the source does so the
    // assertion stays correct in any timezone.
    const { start, end } = getWeekBounds(0);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmt = d => `${months[d.getMonth()]} ${d.getDate()}`;
    const expected = `${fmt(start)} – ${fmt(end)}`;
    expect(formatWeekLabel()).toBe(expected);
  });

  test('returns the correct label for offset +1', () => {
    const { start, end } = getWeekBounds(1);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmt = d => `${months[d.getMonth()]} ${d.getDate()}`;
    expect(formatWeekLabel(1)).toBe(`${fmt(start)} – ${fmt(end)}`);
  });

  test('returns the correct label for offset -1', () => {
    const { start, end } = getWeekBounds(-1);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmt = d => `${months[d.getMonth()]} ${d.getDate()}`;
    expect(formatWeekLabel(-1)).toBe(`${fmt(start)} – ${fmt(end)}`);
  });
});

// ---------------------------------------------------------------------------
// formatDueDate
// ---------------------------------------------------------------------------

describe('formatDueDate', () => {
  // Use UTC noon so the local calendar date is identical in every UTC offset
  // from UTC-11 through UTC+11 — covering all real CI runner timezones.
  const ISO_NOON   = '2026-04-02T12:00:00.000Z'; // Thu Apr 2, noon UTC
  const ISO_NOON_2 = '2026-04-15T12:00:00.000Z'; // Wed Apr 15, noon UTC

  test('formats a PM time correctly', () => {
    const { dayName, monthName, date, hours, mins, ampm } = localPartsOf(ISO_NOON);
    const expected = `Due: ${dayName} ${monthName} ${date} at ${hours}:${mins} ${ampm}`;
    expect(formatDueDate(ISO_NOON)).toBe(expected);
  });

  test('formats a different date correctly', () => {
    const { dayName, monthName, date, hours, mins, ampm } = localPartsOf(ISO_NOON_2);
    const expected = `Due: ${dayName} ${monthName} ${date} at ${hours}:${mins} ${ampm}`;
    expect(formatDueDate(ISO_NOON_2)).toBe(expected);
  });

  test('uses 12 instead of 0 for 12-hour display', () => {
    // UTC midnight is local midnight only in UTC, but the hours value will
    // always be either 12 (AM) or some local equivalent — just verify the
    // result never contains "0:00 AM" (which would mean the modulo is wrong).
    const result = formatDueDate('2026-04-02T00:00:00.000Z');
    expect(result).not.toMatch(/\b0:/);
  });

  test('output always starts with "Due: "', () => {
    expect(formatDueDate(ISO_NOON)).toMatch(/^Due: /);
  });

  test('output always contains AM or PM', () => {
    expect(formatDueDate(ISO_NOON)).toMatch(/AM|PM/);
  });
});

// ---------------------------------------------------------------------------
// toDatetimeLocalValue
// ---------------------------------------------------------------------------

describe('toDatetimeLocalValue', () => {
  const ISO_NOON = '2026-04-02T12:00:00.000Z';

  test('returns empty string for null', () => {
    expect(toDatetimeLocalValue(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(toDatetimeLocalValue(undefined)).toBe('');
  });

  test('returns empty string for an invalid date string', () => {
    expect(toDatetimeLocalValue('THIS IS A VERY BAD STRING')).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(toDatetimeLocalValue('')).toBe('');
  });

  test('returns a valid datetime-local string (YYYY-MM-DDTHH:MM) for a valid ISO input', () => {
    const result = toDatetimeLocalValue(ISO_NOON);
    // Must match the datetime-local input format exactly
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test('local date and time components match new Date() parsed in local time', () => {
    const { localISO } = localPartsOf(ISO_NOON);
    expect(toDatetimeLocalValue(ISO_NOON)).toBe(localISO);
  });
});

// ---------------------------------------------------------------------------
// formatNotifDate
// ---------------------------------------------------------------------------

describe('formatNotifDate', () => {
  const ISO_NOON = '2026-04-02T12:00:00.000Z'; // Thu Apr 2

  test('returns null for null input', () => {
    expect(formatNotifDate(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(formatNotifDate(undefined)).toBeNull();
  });

  test('returns null for an invalid date string', () => {
    expect(formatNotifDate('THIS SHOULD NOT WORK')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(formatNotifDate('')).toBeNull();
  });

  test('formats a valid ISO string as "Mon D, YYYY"', () => {
    const { monthName, date, year } = localPartsOf(ISO_NOON);
    expect(formatNotifDate(ISO_NOON)).toBe(`${monthName} ${date}, ${year}`);
  });

  test('output matches the Mon D, YYYY pattern', () => {
    const result = formatNotifDate(ISO_NOON);
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  });
});