/**
 * Street address utility functions
 * @module scripts/address
 */

import { compressWhitespace,
         removeAccents,
         removePunctuation } from './string.js';

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
