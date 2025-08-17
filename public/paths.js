/**
 * @file Describe the paths used to calculate distances.
 */

import { findAddress } from './address.js';
import { encodeInput,
         findSchool,
         getDefaultInputs,
         getStoredItem,
         splitSchoolDescription,
         storeItem } from './common.js';
import { renderAddressInput, renderList } from './html.js';
import { describePath, findPathToSchool, getStreetJunctions } from './path.js';
import addressData from './address-data.js';
import schoolData from './school-data.js';
import jcts from './sf-junctions.js';

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
function renderSchoolsList(schools) {
    const list = [];
    for (const school of schools) {
        const to = `${school.name} ${school.types[0]}`;
        const url = `?to=${encodeInput(to, true)}`;
        const link = `<a href="${url}">${encodeInput(to)}</a>`;
        list.push(link);
    }
    return renderList(list);
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
        document.getElementById('paths').innerHTML = renderSchoolsList(schoolData);
        return;
    }
    const [name, type] = splitSchoolDescription(to);
    const school = findSchool(schoolData, name, type);
    if (!school) {
        document.getElementById('paths').innerHTML = renderSchoolsList(schoolData);
        return;
    }
    const ll = findAddress(addressData, school.address);
    if (!ll) {
        document.getElementById('paths').innerHTML = renderSchoolsList(schoolData);
        return;
    }

    const origin = encodeInput(inputs.address);
    to = encodeInput(to);

    let html = `<p>From: ${origin}</p>`;
    html += `<p>To: ${to}, ${school.address}</p>`;

    const stJcts = getStreetJunctions(jcts);
    const path = findPathToSchool(addressData, jcts, stJcts, {}, origin, school);

    if (path.length) {
        html += describePath(addressData, jcts, path, origin, school.address);
    }

    document.getElementById('paths').innerHTML = html;
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
    document.getElementById('address').value = encodeInput(inputs.address);
    renderMain(addressData, schoolData, jcts, inputs, coords, to);
}

// Retrieve saved form input, or populate default values.
const inputs = getStoredItem('inputs') || getDefaultInputs();

const params = new URLSearchParams(window.location.search);
const to = params.get('to');
const coords = findAddress(addressData, inputs.address);
renderPage(addressData, schoolData, jcts, inputs, coords, to);
document.getElementById('address').disabled = true;
