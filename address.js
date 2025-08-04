/**
 * Street address utility functions
 * @module scripts/address
 */

/**
 * Check whether two street addresses match.
 *
 * @param {string} a - A street address
 * @param {string} b - A street address
 * @returns {string} Whether b includes a, after normalizing them
 */
export function compareAddresses(a, b) {
    a = normalizeAddress(a);
    b = normalizeAddress(b);
    return b.includes(a);
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
 * Normalize a street address, for comparison.
 *
 * @param {string} address - A street address
 * @returns {string} A standardized street address
 */
export function normalizeAddress(address) {
    address = removeAccents(address);
    address = removePunctuation(address);
    address = compressWhitespace(address);
    address = address.toUpperCase();
    address = replaceStreetSuffixes(address);
    return address;
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

/**
 * Replace street suffixes with standard abbreviations.
 *
 * @param {string} address - A street address, capitalized
 * @returns {string} A standardized street address
 */
export function replaceStreetSuffixes(address) {
    const suffixes = {
      AVE: 'AVENUE',
      BLVD: 'BOULEVARD',
      CIR: 'CIRCLE',
      DR: 'DRIVE',
      RD: 'ROAD',
      ST: 'STREET',
    };
    for (const abbr in suffixes) {
        const suffix = suffixes[abbr];
        const re = new RegExp(`\\b${suffix}\\b`);
        address = address.replace(re, abbr);
    }
    return address;
}
