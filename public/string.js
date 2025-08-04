/**
 * String utility functions
 * @module scripts/string
 */

/**
 * Compress whitespace in a string.
 *
 * @param {string} str - A string with redundant whitespace, possibly
 * @returns {string} A string without redundant whitespace
 */
export function compressWhitespace(str) {
    return str.trim().replace(/\s+/g, ' ');
}

/**
 * Remove accents from characters in a string.
 *
 * @param {string} str - A string with accents, possibly
 * @returns {string} A string without accents
 */
export function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Remove punctuation from a string.
 *
 * @param {string} str - A string with punctuation, possibly
 * @returns {string} A string without punctuation
 */
export function removePunctuation(str) {
    return str.replace(/[^A-Za-z0-9\s]/g, '');
}
