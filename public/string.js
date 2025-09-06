/**
 * String utility functions
 * @module public/string
 */

/**
 * Capitalize the first word in a string.
 *
 * @param {string} str - A string
 * @param {boolean} [lower=false] - Whether to make all other letters lowercase
 * @returns {string} A capitalized string
 */
export function capitalize(str, lower = false) {
    if (typeof str !== 'string') {
        return str;
    }
    if (lower) {
        str = str.toLowerCase();
    }
    return str.at(0).toUpperCase() + str.slice(1);
}

/**
 * Capitalize each word in a string.
 *
 * @param {string} str - A string
 * @param {boolean} [lower=false] - Whether to make all other letters lowercase
 * @returns {string} A capitalized string
 */
export function capitalizeWords(str, lower = false) {
    if (typeof str !== 'string') {
        return str;
    }
    const no = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor',
        'of', 'on', 'or', 'the', 'to', 'with']);
    const words = str.split(' ');
    words[0] = capitalize(words[0], lower);
    words[words.length - 1] = capitalize(words[words.length - 1], lower);
    for (let i = 1; i < words.length - 1; i++) {
        const low = words[i].toLowerCase();
        if (no.has(low)) {
            if (lower) {
                words[i] = low;
            }
            continue;
        }
        words[i] = capitalize(words[i], lower);
    }
    return words.join(' ');
}

/**
 * Compress whitespace in a string.
 *
 * @param {string} str - A string with redundant whitespace, possibly
 * @returns {string} A string without redundant whitespace
 */
export function compressWhitespace(str) {
    if (typeof str !== 'string') {
        return str;
    }
    return str.trim().replace(/\s+/g, ' ');
}

/**
 * Encode input for safe output to HTML or XML.
 *
 * @param {string} str - A string of characters
 * @returns {string} An encoded string of characters
 */
export function encode(str) {
    str = str.toString();
    str = str.replaceAll('&', '&amp;');
    str = str.replaceAll('>', '&gt;');
    str = str.replaceAll('<', '&lt;');
    str = str.replaceAll('"', '&quot;');
    return str;
}

/**
 * Encode input for safe output to a URL.
 *
 * @param {string} value - Unsafe input
 * @param {boolean} [allowCommas=false] - Whether to allow commas
 * @param {number} [maxLength=255] - The maximum parameter length
 * @returns {string} The input string with unsafe characters encoded
 */
export function encodeURLParam(value, allowCommas = false, maxLength = 255) {
    value = value.substring(0, maxLength);
    value = encodeURIComponent(value).replaceAll('%20', '+');
    if (allowCommas) {
        value = value.replaceAll('%2C', ',');
    }
    return value;
}

/**
 * Remove accents from characters in a string.
 *
 * @param {string} str - A string with accents, possibly
 * @returns {string} A string without accents
 */
export function removeAccents(str) {
    if (typeof str !== 'string') {
        return str;
    }
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Remove punctuation from a string.
 *
 * @param {string} str - A string with punctuation, possibly
 * @returns {string} A string without punctuation
 */
export function removePunctuation(str) {
    if (typeof str !== 'string') {
        return str;
    }
    return str.replace(/[^A-Za-z0-9\s]/g, '');
}
