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
 * Prefix single-digit numbered street names with a zero.
 *
 * @param {string} address - A street address, capitalized
 * @returns {string} A standardized street address
 */
export function fixNumberedStreets(address) {
    const re = /\b(1ST|2ND|3RD|(4|5|6|7|8|9)TH)\b/
    return address.replace(re, '0$1');
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
    address = fixNumberedStreets(address);
    return address;
}

/**
 * Get street suffixes and their abbreviations.
 *
 * @returns {Object} Street suffixes, keyed by their abbreviations
 */
export function getStreetSuffixes() {
    return {
        AVE: 'AVENUE',
        BLVD: 'BOULEVARD',
        CIR: 'CIRCLE',
        DR: 'DRIVE',
        RD: 'ROAD',
        ST: 'STREET',
    };
}

/**
 * Replace street suffixes with standard abbreviations.
 *
 * @param {string} address - A street address, capitalized
 * @param {boolean} omitsNumber - Whether the street number is omitted
 * @returns {string} A standardized street address
 */
export function replaceStreetSuffixes(address, omitsNumber = false) {
    const suffixes = getStreetSuffixes();
    const parts = address.split(' ');
    const begin = omitsNumber ? 1 : 2;
    for (let i = begin; i < parts.length; i++) {
        let part = parts[i];
        for (const abbr in suffixes) {
            const suffix = suffixes[abbr];
            const re = new RegExp(`^${suffix}$`);
            part = part.replace(re, abbr);
        }
        parts[i] = part;
    }
    return parts.join(' ');
}

/**
 * Split a street address into a street number and a street name.
 *
 * @param {string} address - A street address, e.g. "2995 SLOAT BLVD"
 * @returns {Array.<string>} A street number and street name
 */
export function splitStreetAddress(address) {
    const [num, ...etc] = address.split(' ');
    return [num, etc.join(' ')];
}
