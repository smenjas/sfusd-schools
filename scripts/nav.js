/**
 * @file Navigate between places in San Francisco, California.
 */

import dotenv from 'dotenv';
import { getRouteData } from './gmaps.js';
import jcts from './sf-junctions.js';
import { kmlDoc } from './kml.js';
import { findSchoolDistances,
         findPathToSchool,
         getAddressCoords,
         getJunctionCoords,
         getStreetJunctions,
         nameCNN } from './path.js';
import { capitalizeWords } from '../public/string.js';
import addressData from '../public/address-data.js';
import commuteData from './commute-data.js';
import schoolData from '../public/school-data.js';

dotenv.config({ path: '../.env', quiet: true });

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
 * Generate waypoints.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @returns {Array.<Object>} Waypoints
 */
function getPathWaypoints(addressData, jcts, path, start, end) {
    const startLl = getAddressCoords(addressData, start);
    const endLl = getAddressCoords(addressData, end);

    let n = 1;
    const startPretty = capitalizeWords(start, true);
    const endPretty = capitalizeWords(end, true);
    const wpts = [{ ll: startLl, name: n++, description: startPretty, sym: 'Start' }];
    for (const cnn of path) {
        wpts.push({
            ll: getJunctionCoords(jcts, cnn),
            name: n++,
            description: nameCNN(jcts, cnn),
            sym: 'Intersection',
        });
    }
    wpts.push({ ll: endLl, name: n, description: endPretty, sym: 'End' });
    return wpts;
}

/**
 * Generate a file that describes a journey.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @param {string} [place=''] - The name of the destination (optional)
 * @returns {string} XML
 */
function makeGeoDoc(addressData, jcts, path, start, end, place = '') {
    const startPretty = capitalizeWords(start, true);
    const endPretty = (place !== '') ? place : capitalizeWords(end, true);
    const name = `${startPretty} to ${endPretty}`;
    const wpts = getPathWaypoints(addressData, jcts, path, start, end);
    return kmlDoc(wpts, name);
}

/**
 * Output a KML (Keyhole Markup Language) file.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {string} start - The starting street address
 * @param {School} school - Data about a school
 */
function logKML(addressData, jcts, start, school) {
    const stJcts = getStreetJunctions(jcts);
    const path = findPathToSchool(addressData, jcts, stJcts, start, school);
    const end = school.address;
    const place = `${school.name} ${school.types[0]}`;
    console.log(makeGeoDoc(addressData, jcts, path, start, end, place));
}

//const start = '443 Burnett Ave'; // Rooftop Elementary, geographic center of SF
//const start = '999 Marine Dr'; // Fort Point
//const start = '1 Marina Green Dr'; // Marina Green
//const start = '900 Beach St'; // Maritime Museum
//const start = '1220 Avenue M'; // Treasure Island Wastewater Treatment Plant
//const start = '55 Innes Ct'; // Hillpoint Park
//const start = '520 Spear Ave'; // Hunters Point
//const start = '625 Gilman Ave'; // Candlestick Point
const start = '1700 Silver Ave'; // Silver Terrace Athletic Fields
//const start = '2995 Sloat Blvd'; // SF Zoo
//const start = '1096 Point Lobos Ave'; // Camera Obscura

//const school = findSchool(schoolData, 'El Dorado', 'Elementary');
//const school = findSchool(schoolData, 'Guadalupe', 'Elementary');
//const school = findSchool(schoolData, 'Rooftop', 'Elementary');
//const school = findSchool(schoolData, 'Taylor', 'Elementary');
//const school = findSchool(schoolData, 'Hoover', 'Middle');
//const school = findSchool(schoolData, 'Burton', 'High');
//const school = findSchool(schoolData, 'Life Learning', 'High');

console.log(start);
//logKML(addressData, jcts, start, school);
//const distances = findSchoolDistances(addressData, schoolData, jcts, start);
//process.exit(0);

for (const school of schoolData) {
    const { miles, seconds } = await getRouteData(start, school.address);
    //const minutes = seconds / 60;
    //const mph = miles / (seconds / 3600);
    //console.log({ miles, seconds, minutes, mph });
    console.log(miles.toFixed(1), school.name, school.types[0]);
}
