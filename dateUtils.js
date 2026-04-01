// dateUtils.js — Date parsing and formatting helpers

/**
 * Creates an object that represents a week, from Sunday at midnight to Saturday at 23:59:59. Defaults to the current week.
 * @param {*} offset an optional parameter to get bounds for n weeks from now.
 * @returns an object with Start and End keys representing the bounds of the week as Day objects.
 */
function getWeekBounds(offset = 0) {
  const now = new Date();
  const start = new Date(now);

  start.setDate(now.getDate() - now.getDay() + offset * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Creates text representing a week's days. Example: Mar 29 - Apr 4
 * @param {*} offset an optional parameter to get a formatted label for a week n weeks from now.
 * @returns a string representing the desired week's date range.
 */
function formatWeekLabel(offset = 0) {
  const { start, end } = getWeekBounds(offset);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmt = d => `${months[d.getMonth()]} ${d.getDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Creates text representing an assignment's due date and time. Example: Wed Apr 1 at 11:59 PM
 * @param {*} isoString the ISO-formatted string to parse.
 * @returns a cleaner string representation of an assignment's due date and time.
 */
function formatDueDate(isoString) {
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');

  // 24-hour format to 12-hour format.
  // TODO: Maybe add an option to display in 24 hour format?
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `Due: ${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()} at ${hours}:${minutes} ${ampm}`;
}

/**
 * Translates a due date to local time.
 * @param {*} isoString the ISO-formatted string to parse.
 * @returns A string representing a due date and time in local time.
 */
function toDatetimeLocalValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Formats a notification date for display. Example: Apr 1, 2025
 * @param {*} isoString the ISO-formatted string to parse.
 * @returns A short date string or null if invalid.
 */
function formatNotifDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
