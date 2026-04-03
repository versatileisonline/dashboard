/**
 * @jest-environment jsdom
 */

// Test cases for utils.js

const { debounce, getCourseIdFromUrl, sanitize, isSafeCanvasUrl, normalizeExternalUrl } = require('./utils');

// ---------------------------------------------------------------------------
// debounce
// ---------------------------------------------------------------------------

describe('debounce', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('does not call the function before the delay elapses', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 300);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(299);
        expect(fn).not.toHaveBeenCalled();
    });

    test('calls the function after the delay elapses', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 300);

        debounced();
        jest.advanceTimersByTime(300);

        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('resets the timer on successive calls, firing only once', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 300);

        debounced();
        jest.advanceTimersByTime(200);
        debounced();
        jest.advanceTimersByTime(200);
        debounced();
        jest.advanceTimersByTime(300);

        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('passes all arguments through to the wrapped function', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced('a', 42, { key: 'value' });
        jest.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledWith('a', 42, { key: 'value' });
    });

    test('fires again after the delay following a completed call', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced();
        jest.advanceTimersByTime(100);

        debounced();
        jest.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledTimes(2);
    });
});

// ---------------------------------------------------------------------------
// getCourseIdFromUrl
// ---------------------------------------------------------------------------

describe('getCourseIdFromUrl', () => {
    test('extracts a numeric course ID from a standard Canvas path', () => {
        expect(getCourseIdFromUrl('/courses/12345')).toBe(12345);
    });

    test('extracts the course ID when there are additional path segments', () => {
        expect(getCourseIdFromUrl('/courses/9876/assignments/1')).toBe(9876);
    });

    test('returns null when the pathname contains no course segment', () => {
        expect(getCourseIdFromUrl('/dashboard')).toBeNull();
    });

    test('returns null for an empty string', () => {
        expect(getCourseIdFromUrl('')).toBeNull();
    });

    test('returns null when "courses" appears without a numeric ID', () => {
        expect(getCourseIdFromUrl('/courses/')).toBeNull();
    });

    test('returns the first course ID when "courses" appears multiple times', () => {
        expect(getCourseIdFromUrl('/courses/111/courses/222')).toBe(111);
    });
});

// ---------------------------------------------------------------------------
// sanitize
// ---------------------------------------------------------------------------

// sanitize() uses document.createElement, so we need a DOM environment.
// Jest with jsdom (the default test environment) provides this.

describe('sanitize', () => {
    test('escapes < and > characters', () => {
        expect(sanitize('<script>')).toBe('&lt;script&gt;');
    });

    test('escapes ampersands', () => {
        expect(sanitize('a & b')).toBe('a &amp; b');
    });

    test('leaves double quotes unencoded (textContent does not encode them)', () => {
        // sanitize() sets textContent, which escapes <, >, and & but NOT quotes.
        // Quotes only need encoding inside HTML attribute values, which this
        // function is not responsible for.
        expect(sanitize('"hello"')).toBe('"hello"');
    });

    test('leaves plain text unchanged', () => {
        expect(sanitize('Hello, world!')).toBe('Hello, world!');
    });

    test('handles an empty string', () => {
        expect(sanitize('')).toBe('');
    });

    test('escapes a full XSS payload', () => {
        const payload = '<img src=x onerror="alert(1)">';
        const result = sanitize(payload);
        expect(result).not.toContain('<img');
        expect(result).toContain('&lt;img');
    });
});

// ---------------------------------------------------------------------------
// isSafeCanvasUrl
// ---------------------------------------------------------------------------

describe('isSafeCanvasUrl', () => {
    test('accepts relative paths starting with /', () => {
        expect(isSafeCanvasUrl('/courses/123')).toBe(true);
    });

    test('accepts http URLs', () => {
        expect(isSafeCanvasUrl('http://example.com')).toBe(true);
    });

    test('accepts https URLs', () => {
        expect(isSafeCanvasUrl('https://example.com/page')).toBe(true);
    });

    test('rejects javascript: URLs', () => {
        expect(isSafeCanvasUrl('javascript:alert(1)')).toBe(false);
    });

    test('rejects data: URLs', () => {
        expect(isSafeCanvasUrl('data:text/html,<h1>hi</h1>')).toBe(false);
    });

    test('rejects an empty string', () => {
        expect(isSafeCanvasUrl('')).toBe(false);
    });

    test('rejects null / falsy input', () => {
        expect(isSafeCanvasUrl(null)).toBe(false);
        expect(isSafeCanvasUrl(undefined)).toBe(false);
    });

    test('rejects a plain word that is not a valid URL or relative path', () => {
        expect(isSafeCanvasUrl('notaurl')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// normalizeExternalUrl
// ---------------------------------------------------------------------------

describe('normalizeExternalUrl', () => {
    test('returns an empty string for null input', () => {
        expect(normalizeExternalUrl(null)).toBe('');
    });

    test('returns an empty string for undefined input', () => {
        expect(normalizeExternalUrl(undefined)).toBe('');
    });

    test('returns an empty string for an empty string', () => {
        expect(normalizeExternalUrl('')).toBe('');
    });

    test('returns an empty string for a whitespace-only string', () => {
        expect(normalizeExternalUrl('   ')).toBe('');
    });

    test('leaves an already-valid https URL unchanged', () => {
        expect(normalizeExternalUrl('https://example.com')).toBe('https://example.com/');
    });

    test('leaves an already-valid http URL unchanged', () => {
        expect(normalizeExternalUrl('http://example.com/path')).toBe('http://example.com/path');
    });

    test('prepends https:// to a bare domain', () => {
        expect(normalizeExternalUrl('example.com')).toBe('https://example.com/');
    });

    test('trims leading/trailing whitespace before normalizing', () => {
        expect(normalizeExternalUrl('  example.com  ')).toBe('https://example.com/');
    });

    test('returns null for a totally invalid URL even after prepending protocol', () => {
        expect(normalizeExternalUrl('not a url!!')).toBeNull();
    });

    test('returns null for a javascript: URL disguised without a protocol', () => {
        // After prepending https://, "javascript:..." becomes an invalid host,
        // so the URL constructor throws and normalizeExternalUrl returns null.
        expect(normalizeExternalUrl('javascript:alert(1)')).toBeNull();
    });
});