/**
 * Street address utility functions
 * @module public/address
 */

import { arrayToMap } from './common.js';
import { expandCoords } from './geo.js';
import { renderOptions } from './html.js';
import { capitalizeWords,
         compressWhitespace,
         removeAccents,
         removePunctuation } from './string.js';

/**
 * Abbreviate single-digit numbered street names: remove the leading zero.
 *
 * @param {string} address - A street address, capitalized
 * @returns {string} An abbreviated street address
 */
export function abbrNumberedStreets(address) {
    if (typeof address !== 'string') {
        return address;
    }
    const re = /\b0([1-9](ST|ND|RD|TH))\b/
    return address.replace(re, '$1');
}

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
 * Search for a street address in San Francisco, California.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {string} address - A street address, from form input
 * @returns {?LatLon} Degrees latitude and longitude
 */
export function findAddress(addressData, address) {
    let [num, nonstd] = splitStreetAddress(address);
    if (!nonstd) {
        suggestAddresses([]);
        return null;
    }
    if (isNaN(num)) {
        suggestAddresses([]);
        return null;
    }
    nonstd = removeAccents(nonstd);
    nonstd = compressWhitespace(nonstd);
    nonstd = nonstd.toUpperCase();
    const std = fixNumberedStreets(removePunctuation(replaceStreetSuffixes(nonstd, true)));
    if (!(std in addressData)) {
        const addresses = findAddressSuggestions(addressData, num, nonstd, std);
        if (addresses.length <= 10) {
            suggestAddresses(addresses);
        }
        return null;
    }
    if (!(num in addressData[std])) {
        return null;
    }
    return expandCoords(addressData[std][num]);
}

/**
 * Find addresses matching what the user has typed so far.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {string} num - A street number, e.g. 221
 * @param {string} nonstd - A non-standard street name, maybe with punctuation
 * @param {string} std - A fully standardized street name, without punctuation
 * @returns {Array.<string>} Suggested street addresses
 */
export function findAddressSuggestions(addressData, num, nonstd, std) {
    const addresses = [];
    for (const st in addressData) {
        if (!(num in addressData[st])) {
            continue;
        }
        // Gracefully handle single-digit numbered street names.
        if (st.startsWith('0')) {
            const street = st.substring(1);
            if (street.startsWith(nonstd)) {
                addresses.push(`${num} ${street}`);
                continue;
            }
        }
        if (st.startsWith(std)) {
            addresses.push(`${num} ${st}`);
        }
    }
    if (nonstd === std) {
        return addresses.sort();
    }
    // Gracefully handle street names with apostrophes.
    const puncts = {
        'DUNNE\'S ALY': 'DUNNES ALY',
        'O\'FARRELL ST': 'OFARRELL ST',
        'O\'REILLY AVE': 'OREILLY AVE',
        'O\'SHAUGHNESSY BLVD': 'OSHAUGHNESSY BLVD',
        'SAINT JOSEPH\'S AVE': 'SAINT JOSEPHS AVE',
        'SAINT MARY\'S AVE': 'SAINT MARYS AVE',
    };
    for (const p in puncts) {
        const st = puncts[p];
        if (p.startsWith(nonstd) && num in addressData[st]) {
            addresses.push(`${num} ${p}`);
        }
    }
    return addresses.sort();
}

/**
 * Prefix single-digit numbered street names with a zero.
 *
 * @param {string} address - A street address, capitalized
 * @returns {string} A standardized street address
 */
export function fixNumberedStreets(address) {
    if (typeof address !== 'string') {
        return address;
    }
    const re = /\b(1ST|2ND|3RD|(4|5|6|7|8|9)TH)\b/
    return address.replace(re, '0$1');
}

/**
 * Format street names.
 *
 * @param {string} street - A normalized street name
 * @returns {string} A presentable street name
 */
export function formatStreet(street) {
    if (typeof street !== 'string') {
        return street;
    }
    let name = prettifyAddress(street);
    if (street.endsWith(' RAMP')) {
        name = name.replace(' On ', ' on ');
        name = name.replace(' Off ', ' off ');
        name = name.replace(' Ramp', ' ramp');
    }
    return name.replace(' Ti St', ' St Treasure Island');
}

/**
 * Normalize a street address, for comparison.
 *
 * @param {string} address - A street address
 * @returns {string} A standardized street address
 */
export function normalizeAddress(address) {
    if (typeof address !== 'string') {
        return address;
    }
    address = removeAccents(address);
    address = removePunctuation(address);
    address = compressWhitespace(address);
    address = address.toUpperCase();
    address = replaceStreetSuffixes(address);
    address = fixNumberedStreets(address);
    return address;
}

/**
 * Prettify a street address, for display.
 *
 * @param {string} address - A normalized street address
 * @returns {string} A presentable street address
 */
export function prettifyAddress(address) {
    if (!address) {
        return address;
    }
    address = abbrNumberedStreets(address);
    address = capitalizeWords(address, true);
    return address;
}

/**
 * Get street suffixes and their abbreviations.
 *
 * @returns {Object} Street suffixes, keyed by their abbreviations
 */
export function getStreetSuffixes() {
    return {
        ALY: 'ALLEY',
        AVE: 'AVENUE',
        BLVD: 'BOULEVARD',
        CIR: 'CIRCLE',
        CT: 'COURT',
        DR: 'DRIVE',
        //HL: 'HILL',
        HWY: 'HIGHWAY',
        LN: 'LANE',
        PL: 'PLACE',
        PLZ: 'PLAZA',
        PSGE: 'PASSAGE',
        RD: 'ROAD',
        ST: 'STREET',
        STWY: 'STAIRWAY',
        TER: 'TERRACE',
        TUNL: 'TUNNEL',
        XING: 'CROSSING',
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
 * @param {boolean} [normalize=false] - Whether to normalize the address
 * @returns {Array.<string>} A street number and street name
 */
export function splitStreetAddress(address, normalize = false) {
    if (typeof address !== 'string') {
        return address;
    }
    if (normalize) {
        address = normalizeAddress(address);
    }
    const [num, ...etc] = address.split(' ');
    return [num, etc.join(' ')];
}

/**
 * Suggest addresses matching what the user has typed so far.
 *
 * @param {Array.<string>} addresses - Suggested street addresses
 */
export function suggestAddresses(addresses) {
    if (typeof document === 'undefined') {
        return;
    }
    const datalist = document.getElementById('addresses');
    if (!datalist) {
        return;
    }
    for (let i = 0; i < addresses.length; i++) {
        addresses[i] = capitalizeWords(addresses[i], true);
    }
    datalist.innerHTML = renderOptions(arrayToMap(addresses));
}
