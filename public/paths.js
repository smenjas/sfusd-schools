/**
 * @file Describe the paths used to calculate distances.
 */

import { findAddress } from './address.js';
import { findSchool,
         getDefaultInputs,
         getStoredItem,
         splitSchoolDescription } from './common.js';
import { renderLink, renderList } from './html.js';
import { downloadKML, makeKML } from './kml.js';
import { populateDistances } from './obfuscate.js';
import { describePath, findPathToSchool, getStreetJunctions } from './path.js';
import { sortSchools } from './sort.js';
import { encode, encodeURLParam } from './string.js';
import addressData from './address-data.js';
import schoolData from './school-data.js';
import jcts from './junctions.js';

/**
 * Generate HTML for a list of schools.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {Object} inputs - Form input values
 * @returns {string} HTML
 */
function renderSchoolsList(schoolData, inputs) {
    const list = [];
    if (inputs.menus.sort === 'distance') {
        populateDistances(schoolData, inputs.address);
    }
    sortSchools(schoolData, inputs.menus.sort);
    for (const school of schoolData) {
        let to = `${school.name} ${school.types[0]}`;
        if (school.campus) {
            to += ` - ${school.campus}`;
        }
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
function renderContent(addressData, schoolData, jcts, inputs, coords, to, kml) {
    if (!coords) {
        setTimeout(() => { window.location.replace('/') }, 2500);
        return `<h2>No Starting Address</h2>`;
    }
    if (!to) {
        return renderSchoolsList(schoolData, inputs);
    }
    const [name, type, campus] = splitSchoolDescription(to);
    const school = findSchool(schoolData, name, type, campus);
    if (!school) {
        return renderSchoolsList(schoolData, inputs);
    }

    let html = `<h2>${encode(inputs.address)} to ${encode(to)}</h2>`;

    if (kml) {
        setTimeout(() => {
            const kml = makeKML(addressData, jcts, inputs.address, school);
            const filename = `${inputs.address} to ${to}`;
            downloadKML(kml, filename);
            window.location.replace(`?to=${encodeURLParam(to)}`);
        }, 250);
        return `${html}<p>Generating KML file...</p>`;
    }

    const stJcts = getStreetJunctions(jcts);
    const path = findPathToSchool(addressData, jcts, stJcts, {}, inputs.address, school);

    if (path.length) {
        html += '<p><strong>DO NOT</strong> follow these directions.';
        html += ' They are only for rough distance calculations.</p>';
        html += describePath(addressData, jcts, path, inputs.address, school.address);
    }

    const kmlLink = renderLink(`?to=${encodeURLParam(to)}&kml=1`, 'KML File');
    html += `<p>${kmlLink}</p>`;

    return html;
}

// Retrieve saved form input, or populate default values.
const inputs = getStoredItem('inputs') || getDefaultInputs();

const params = new URLSearchParams(window.location.search);
const to = params.get('to');
const kml = !!params.get('kml');
const coords = findAddress(addressData, inputs.address);
const html = renderContent(addressData, schoolData, jcts, inputs, coords, to, kml);
document.getElementById('paths').innerHTML = html;
