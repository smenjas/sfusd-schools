/**
 * Shared functions
 * @module public/html
 */

import { mapCNN, sortCNNs } from './path.js';
import { fixNumberedStreets,
         normalizeAddress,
         replaceStreetSuffixes,
         splitStreetAddress } from './address.js';
import { expandCoords,
         findAzimuth,
         findDirection,
         getDirectionsURL,
         getMapURL } from './geo.js';
import { capitalizeWords,
         compressWhitespace,
         removeAccents,
         removePunctuation } from './string.js';
import addressData from './address-data.js';
import schoolData from './school-data.js';
import jcts from './sf-junctions.js';

/**
 * Escape form input (except spaces) for safe output to HTML.
 *
 * @param {string} value - Unescaped user input
 * @returns {string} The input string with unsafe characters escaped
 */
export function escapeFormInput(value) {
    return encodeURIComponent(value).replaceAll('%20', ' ');
}

/**
 * Escape form input (except spaces) for safe output to HTML.
 *
 * @param {string} value - Unescaped user input
 * @returns {string} The input string with unsafe characters escaped
 */
export function escapeURLParam(value) {
    return encodeURIComponent(value).replaceAll('%20', '+');
}

/**
 * Render a hyperlink, perhaps opening in a new browser tab.
 *
 * @param {?string} url - An absolute or relative URL
 * @param {?string} text - The link text or content, as HTML
 * @param {boolean} [newTab=false] - Whether to open the link in a new tab
 * @returns {string} A hyperlink, or the 2nd arg if the 1st arg is empty
 */
export function renderLink(url, text, newTab = false) {
    if (text === null || text === '') {
        return '';
    }
    if (url === null || url === '') {
        return text;
    }
    let link = '<a';
    if (newTab === true) {
        link += ' target="_blank"';
    }
    link += ` href="${url}">${text}</a>`;
    return link;
}

/**
 * Generate a Google Maps hyperlink for directions, to open in a new tab.
 *
 * @param {string} fro - The search terms for the origin
 * @param {string} to - The search terms for the destination
 * @param {string} text - The link text or content, as HTML
 * @returns {string} A hyperlink, or the 3rd arg if the 1st or 2nd arg is empty
 */
export function renderDirectionsLink(fro, to, text) {
    const url = getDirectionsURL(fro, to);
    if (url === '') {
        return text;
    }
    return renderLink(url, text, true);
}

/**
 * Generate a Google Maps hyperlink, to open in a new tab.
 *
 * @param {string} search - The search terms for a place
 * @param {string} [text=''] - The link text or content, as HTML
 * @returns {string} A hyperlink, or the 2nd arg if the 1st arg is empty
 */
export function renderMapLink(search, text = '') {
    if (search === '') {
        return '';
    }
    const url = getMapURL(search);
    if (text === '') {
        text = search;
    }
    return renderLink(url, text, true);
}

/**
 * Generate HTML for a list.
 *
 * @param {Array} array - The list items
 * @param {boolean} ordered - Whether to make an ordered list
 * @returns {string} A list, as HTML
 */
export function renderList(array, ordered = false) {
    if (array.length === 0) {
        return '';
    }
    let html = ordered ? '<ol>' : '<ul>';
    for (const element of array) {
        html += `<li>${element}</li>`;
    }
    html += ordered ? '</ol>' : '</ul>';
    return html;
}

/**
 * Convert an array to a map.
 *
 * @param {Array} array - An array
 * @returns A map object
 */
export function arrayToMap(array) {
    if (!Array.isArray(array)) {
        return array;
    }
    const map = new Map();
    for (const value of array) {
        map.set(value, value);
    }
    return map;
}

/**
 * Render options for a select menu.
 *
 * @param {Map} options - Menu option values and names
 * @param {string} selected - The value selected.
 * @returns {string} HTML options for a select menu or datalist
 */
export function renderOptions(options, selected) {
    let html = '';
    for (const [key, value] of options.entries()) {
        const s = (key.toString() === selected) ? ' selected' : '';
        html += `<option value="${key}"${s}>${value}</option>`;
    }
    return html;
}

/**
 * Suggest addresses matching what the user has typed so far.
 *
 * @param {Array.<string>} addresses - Suggested street addresses
 */
export function suggestAddresses(addresses) {
    const datalist = document.getElementById('addresses');
    if (!datalist) {
        return;
    }
    for (let i = 0; i < addresses.length; i++) {
        addresses[i] = capitalizeWords(addresses[i], true);
    }
    datalist.innerHTML = renderOptions(arrayToMap(addresses));
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
        'O\'FARRELL ST': 'OFARRELL ST',
        'O\'REILLY AVE': 'OREILLY AVE',
        'O\'SHAUGHNESSY BLVD': 'OSHAUGHNESSY BLVD',
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
 * Find a school by name and type.
 *
 * @param {Schools} schoolData - All SF public schools
 * @param {string} name - A school name, e.g. "Lowell"
 * @param {string} type - A school type, e.g. "High"
 * @returns {School} Data about a school
 */
export function findSchool(schoolData, name, type) {
    for (const school of schoolData) {
        if (school.name === name && school.types.includes(type)) {
            return school;
        }
    }
}

/**
 * Render a street address form input, with autocomplete.
 *
 * @returns {string} A text input for a street address
 */
export function renderAddressInput() {
    let html = '<input name="address" id="address" list="addresses"';
    html += ' placeholder="Your Address" autocomplete="street-address">';
    html += '<datalist id="addresses"></datalist>';
    return html;
}

/**
 * Split a school's description into a name and a type.
 *
 * @param {string} desc - A school's description, e.g. "Lowell High"
 * @returns {Array.<string>} A school's name and type
 */
export function splitSchoolDescription(desc) {
    const parts = desc.split(' ');
    const type = parts.pop();
    const name = parts.join(' ');
    return [name, type];
}

/**
 * Get the default values for the form inputs.
 *
 * @returns {Object} Default form inputs
 */
export function getDefaultInputs() {
    return {
        address: '',
        menus: {
            sort: 'name',
            type: '',
            grade: '',
            neighborhood: '',
            start: '',
            language: '',
            target: '',
            within: '',
        },
    };
}

/**
 * Retrieve an item from localStorage.
 *
 * @param {string} name - The item's name
 * @returns {*} The item
 */
export function getStoredItem(name) {
    try {
        const json = localStorage.getItem(name);
        if (!json) {
            return;
        }
        return json ? JSON.parse(json) : json;
    }
    catch (error) {
        console.error('Cannot read from localStorage:', error);
    }
}

/**
 * Save an item in localStorage.
 *
 * @param {string} name - The item's name
 * @param {*} The item
 * @returns {boolean} Whether the operation proceeded without an exception
 */
export function storeItem(name, item) {
    try {
        localStorage.setItem(name, JSON.stringify(item));
        return true;
    }
    catch (error) {
        console.error('Cannot write to localStorage:', error);
        return false;
    }
}
