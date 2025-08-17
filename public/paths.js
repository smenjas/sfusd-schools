/**
 * @file Navigate between places in San Francisco, California.
 */

import { findSchoolDistances,
         findPathToSchool,
         getAddressCoords,
         getJunctionCoords,
         getStreetJunctions,
         howFarAddresses,
         nameCNN,
         sumDistances } from './path.js';
import { fixNumberedStreets,
         normalizeAddress,
         replaceStreetSuffixes,
         splitStreetAddress } from './address.js';
import { expandCoords, findDirection } from './geo.js';
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
function escapeFormInput(value) {
    return encodeURIComponent(value).replaceAll('%20', ' ');
}

/**
 * Escape form input (except spaces) for safe output to HTML.
 *
 * @param {string} value - Unescaped user input
 * @returns {string} The input string with unsafe characters escaped
 */
function escapeURLParam(value) {
    return encodeURIComponent(value).replaceAll('%20', '+');
}

/**
 * Convert an array to a map.
 *
 * @param {Array} array - An array
 * @returns A map object
 */
function arrayToMap(array) {
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
function renderOptions(options, selected) {
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
function suggestAddresses(addresses) {
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
function findAddressSuggestions(addressData, num, nonstd, std) {
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
function findAddress(addressData, address) {
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
 * Find a school.
 *
 * @param {Schools} schoolData - All SF public schools
 * @param {string} name - A school name, e.g. "Lowell"
 * @param {string} type - A school type, e.g. "High"
 * @returns {School} Data about a school
 */
function findSchool(schoolData, name, type) {
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
function renderAddressInput() {
    let html = '<input name="address" id="address" list="addresses"';
    html += ' placeholder="Your Address" autocomplete="street-address">';
    html += '<datalist id="addresses"></datalist>';
    return html;
}

/**
 * Render an HTML form, for choosing the origin address.
 *
 * @param {Object.<string, string>} inputs - Form input values
 * @returns {string} An HTML form
 */
function renderForm(inputs) {
    let html = '<form id="schoolForm">';
    html += '<div class="form-group">';
    html += renderAddressInput();
    html += '</div>';
    html += '</form>';
    return html;
}

/**
 * Render an HTML form, for choosing the origin address.
 *
 * @param {string} address - A street address
 * @returns {string} An HTML form
 */
function renderList(schools) {
    let html = '<ul>';
    for (const school of schools) {
        const to = `${school.name} ${school.types[0]}`;
        const url = `?to=${escapeURLParam(to)}`;
        const link = `<a href="${url}">${escapeFormInput(to)}</a>`;
        html += `<li>${link}</li>`;
    }
    html += '</ul>';
    return html;
}

function splitSchoolDescription(desc) {
    const parts = desc.split(' ');
    const type = parts.pop();
    const name = parts.join(' ');
    return [name, type];
}

function getOtherStreets(streets, street) {
    const others = [];
    for (const st of streets) {
        if (st === street) {
            continue;
        }
        others.push(st);
    }
    return others;
}

/**
 * Identify where the turns are along a path.
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefixes} path - Intersections
 * @returns {Object.<CNNPrefix, Object} Street & direction, by intersection
 */
function findTurns(jcts, path) {
    let lastStreet, street;
    const turns = {};
    for (let i = 1; i < path.length - 1; i++) {
        const here = path[i];
        const next = path[i + 1];
        const jct = jcts[here];
        for (const st of jct.streets) {
            if (!jcts[next].streets.includes(st)) {
                continue;
            }
            lastStreet = street;
            street = st;
            if (lastStreet !== street) {
                turns[here] = {
                    street,
                    direction: findDirection(expandCoords(jct.ll),
                        expandCoords(jcts[next].ll))
                };
            }
            break;
        }
    }
    return turns;
}

/**
 * Describe a path.
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefixes} path - Intersections
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @returns {string} HTML
 */
function describePath(jcts, path, start, end) {
    const turns = findTurns(jcts, path);

    let html = '<ol>';
    html += `<li>Start from: ${capitalizeWords(start)}</li>`;
    for (const cnn of path) {
        if (!(cnn in turns)) {
            continue;
        }
        const { street, direction } = turns[cnn];
        const others = getOtherStreets(jcts[cnn].streets, street);
        html += `<li>Turn onto ${capitalizeWords(street, true)}`;
        html += ` at ${capitalizeWords(others.join(' & '), true)}`;
        if (direction !== null) {
            html += `, heading ${direction}</li>`;
        }
    }
    html += `<li>Arrive at: ${capitalizeWords(end)}</li>`;
    html += '</ol>';
    return html;
}

/**
 * Render a web page, showing a form and a list of destinations.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Schools} schoolData - Data about all schools
 * @param {Junctions} jcts - All SF intersections
 * @param {string} address - A street address
 * @param {?LatLon} coords - Degrees latitude and longitude
 * @param {string} to - A street address
 */
function renderMain(addressData, schoolData, jcts, inputs, coords, to) {
    if (!to) {
        document.getElementById('paths').innerHTML = renderList(schoolData);
    }
    const [name, type] = splitSchoolDescription(to);
    const school = findSchool(schoolData, name, type);
    if (!school) {
        document.getElementById('paths').innerHTML = renderList(schoolData);
    }
    const ll = findAddress(addressData, school.address);
    if (!ll) {
        document.getElementById('paths').innerHTML = renderList(schoolData);
    }

    const origin = escapeFormInput(inputs.address);
    to = escapeFormInput(to);

    const stJcts = getStreetJunctions(jcts);
    const path = findPathToSchool(addressData, jcts, stJcts, {}, origin, school);

    let html = `<p>From: ${origin}</p>`;
    html += `<p>To: ${to}, ${school.address}</p>`;
    html += describePath(jcts, path, origin, school.address);

    document.getElementById('paths').innerHTML = html;
}

/**
 * Add event listeners to process form inputs, and update the page.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Schools} schoolData - Data about all schools
 * @param {Junctions} jcts - All SF intersections
 * @param {Object.<string, string>} inputs - Form input values
 * @param {?LatLon} coords - Degrees latitude and longitude
 */
function addEventListeners(addressData, schoolData, jcts, inputs, coords) {
    // Remove existing event listeners.
    const oldAddress = document.querySelector('input[name=address]');
    oldAddress.replaceWith(oldAddress.cloneNode(true));

    // Listen for address input.
    const addressInput = document.getElementById('address');
    addressInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            // Don't submit the form and reload the page.
            event.preventDefault();
        }
    });
    addressInput.addEventListener('input', event => {
        inputs.address = event.target.value;
        storeItem('inputs', inputs);
        coords = findAddress(addressData, inputs.address);
    });
}

/**
 * Render a web page, showing a form and a list of destinations.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Schools} schoolData - Data about all schools
 * @param {Junctions} jcts - All SF intersections
 * @param {string} address - A street address
 * @param {?LatLon} coords - Degrees latitude and longitude
 * @param {string} to - A street address
 */
function renderPage(addressData, schoolData, jcts, inputs, coords, to) {
    document.getElementById('input').innerHTML = renderForm(inputs);
    addEventListeners(addressData, schoolData, jcts, inputs, coords);
    document.getElementById('address').value = escapeFormInput(inputs.address);
    renderMain(addressData, schoolData, jcts, inputs, coords, to);
}

/**
 * Retrieve an item from localStorage.
 *
 * @param {string} name - The item's name
 * @returns {*} The item
 */
function getStoredItem(name) {
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
function storeItem(name, item) {
    try {
        localStorage.setItem(name, JSON.stringify(item));
        return true;
    }
    catch (error) {
        console.error('Cannot write to localStorage:', error);
        return false;
    }
}

// Retrieve saved form input, or populate default values.
const inputs = getStoredItem('inputs') || {
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

const params = new URLSearchParams(window.location.search);
const to = params.get('to');
const coords = findAddress(addressData, inputs.address);
renderPage(addressData, schoolData, jcts, inputs, coords, to);
