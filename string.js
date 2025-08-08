/**
 * String utility functions
 * @module scripts/string
 */

/**
 * Capitalize the first word in a string.
 *
 * @param {string} str - A string
 * @param {boolean} [lower=false] - Whether to make all other letters lowercase
 * @returns {string} A capitalized string
 */
export function capitalize(str, lower = false) {
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
    const words = str.split(' ');
    for (let i = 0; i < words.length; i++) {
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
