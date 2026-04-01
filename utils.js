// utils.js — Miscellaneous utility functions

/**
 * Debounce function. Causes a function to not fire until no other debounced calls have been made for some time.
 * @param {Function} fn the function to debounce.
 * @param {number} ms the delay, in milliseconds, to wait.
 * @returns a function that is called on a delay.
 */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Parses the course ID from a Canvas URL.
 * @param {*} pathname the path to the Canvas page for a class.
 * @returns a Number representing the course's ID, or null if not found.
 */
function getCourseIdFromUrl(pathname) {
  const match = pathname.match(/\/courses\/(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Sanitizes a string for safe insertion into the DOM by escaping HTML characters.
 * @param {string} str the raw string to sanitize.
 * @returns a sanitized HTML string.
 */
function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Validates whether a URL is safe to use as a Canvas link (relative path or http/https).
 * Blocks javascript:, data:, and other potentially dangerous schemes.
 * @param {string} url the URL to check.
 * @returns true if the URL is safe, false otherwise.
 */
function isSafeCanvasUrl(url) {
  if (!url) return false;
  if (url.startsWith('/')) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Normalizes an external URL by ensuring it has a protocol prefix and is valid.
 * @param {string} rawUrl the raw URL string to normalize.
 * @returns the normalized URL string, an empty string if input is empty, or null if invalid.
 */
function normalizeExternalUrl(rawUrl) {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
