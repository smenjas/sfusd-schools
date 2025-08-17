/**
 * @file Describe the paths used to calculate distances.
 */

import { findAddress } from './address.js';
import { findSchool,
         getDefaultInputs,
         getStoredItem,
         splitSchoolDescription,
         storeItem } from './common.js';
import { renderLink, renderList } from './html.js';
import { makeKML } from './kml.js';
import { describePath, findPathToSchool, getStreetJunctions } from './path.js';
import { sortSchools } from './sort.js';
import { encode, encodeURLParam, removePunctuation } from './string.js';
import addressData from './address-data.js';
import schoolData from './school-data.js';
import jcts from './sf-junctions.js';

/**
 * Render an HTML form, for choosing the origin address.
 *
 * @param {string} address - A street address
 * @returns {string} An HTML form
 */
function renderSchoolsList(schools) {
    const list = [];
    sortSchools(schools, inputs.menus.sort);
    for (const school of schools) {
        const to = `${school.name} ${school.types[0]}`;
        const url = `?to=${encodeURLParam(to)}`;
        const link = `<a href="${url}">${encode(to)}</a>`;
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
 * @param {boolean} kml - Whether to generate a KML file
 */
function renderPage(addressData, schoolData, jcts, inputs, coords, to, kml) {
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

    if (kml) {
        const kml = makeKML(addressData, jcts, inputs.address, school);
        const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = removePunctuation(`${inputs.address} to ${to}`);
        a.download = `${filename}.kml`.replace(/\s+/g, '_');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.location.href = `?to=${encodeURLParam(to)}`;
        const html = '<p>Downloading KML file...</p>';
        document.getElementById('paths').innerHTML = html;
        return;
    }

    const stJcts = getStreetJunctions(jcts);
    const path = findPathToSchool(addressData, jcts, stJcts, {}, inputs.address, school);

    let html = `<h2>${encode(inputs.address)} to ${encode(to)}</h2>`;

    if (path.length) {
        html += '<p><strong>DO NOT</strong> follow these directions.';
        html += ' They are only for rough distance calculations.</p>';
        html += describePath(addressData, jcts, path, inputs.address, school.address);
    }

    const kmlLink = renderLink(`?to=${encodeURLParam(to)}&kml=1`, 'KML File');
    html += `<p>${kmlLink}</p>`;

    document.getElementById('paths').innerHTML = html;
}

// Retrieve saved form input, or populate default values.
const inputs = getStoredItem('inputs') || getDefaultInputs();

const params = new URLSearchParams(window.location.search);
const to = params.get('to');
const kml = !!params.get('kml');
const coords = findAddress(addressData, inputs.address);
renderPage(addressData, schoolData, jcts, inputs, coords, to, kml);
