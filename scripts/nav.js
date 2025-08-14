/**
 * @file Navigate between places in San Francisco, California.
 */

import dotenv from 'dotenv';
import { getRouteData } from './gmaps.js';
import { findSchool } from '../public/common.js';
import { kmlDoc } from '../public/kml.js';
import { findSchoolDistances,
         findPathToSchool,
         getAddressCoords,
         getJunctionCoords,
         getStreetJunctions,
         nameCNN } from '../public/path.js';
import { normalizeAddress, prettifyAddress } from '../public/address.js';
import { metersToMiles } from '../public/geo.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';
import gmapsData from './gmaps-data.js';
import jcts from '../public/sf-junctions.js';

dotenv.config({ path: '../.env', quiet: true });

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
    const startPretty = prettifyAddress(start);
    const endPretty = prettifyAddress(end);
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
    const startPretty = prettifyAddress(start);
    const endPretty = (place !== '') ? place : prettifyAddress(end);
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
    const path = findPathToSchool(addressData, jcts, stJcts, {}, start, school);
    const end = school.address;
    const place = `${school.name} ${school.types[0]}`;
    console.log(makeGeoDoc(addressData, jcts, path, start, end, place));
}

/**
 * Get route info from Google Maps.
 *
 * @param {Schools} schoolData - All SF public schools
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @returns {Object}
 */
async function getSchoolRoute(start, end) {
    start = normalizeAddress(start);
    end = normalizeAddress(end);
    if (start in gmapsData && end in gmapsData[start]) {
        hits++;
        return gmapsData[start][end];
    }
    misses++;
    const { m, s } = await getRouteData(start, end);
    //const miles = metersToMiles(m);
    //const minutes = s / 60;
    //const mph = miles / (s / 3600);
    //console.log({ miles, s, minutes, mph });
    //console.log(miles.toFixed(1), school.name, school.types[0]);
    return { m, s };
}

/**
 * Get route info from Google Maps.
 *
 * @param {Schools} schoolData - All SF public schools
 * @param {string} start - The starting street address
 * @returns {Object}
 */
async function getSchoolRoutes(schoolData, start) {
    const data = {};
    for (const school of schoolData) {
        const std = normalizeAddress(school.address);
        data[std] = await getSchoolRoute(start, school.address);
    }
    return data;
}

const origins = [
    '443 Burnett Ave',          // Rooftop Elementary, geographic center of SF
    '100 John F Kennedy Dr',    // Conservatory of Flowers
    '1101 John F Kennedy Dr',   // East Meadow, Golden Gate Park
    '4550 John F Kennedy Dr',   // Beach Chalet Athletic Fields
    '501 Twin Peaks Blvd',      // FIXME: Twin Peaks
    '1 La Avanzada St',         // FIXME: Sutro Tower
    '429 Castro St',            // The Castro Theatre
    '199 Museum Way',           // Randall Museum
    '999 Marine Dr',            // Fort Point
    '1 Marina Green Dr',        // Marina Green
    '900 Beach St',             // Maritime Museum
    '600 Montgomery St',        // Transamerica Pyramid
    '1220 Avenue M',            // Treasure Island Wastewater Treatment Plant
    '701 Illinois St',          // FIXME: Crane Cove
    '55 Innes Ct',              // Hillpoint Park
    '520 Spear Ave',            // Hunters Point
    '625 Gilman Ave',           // Candlestick Point
    '1700 Silver Ave',          // Silver Terrace Athletic Fields
    '1000 Bernal Heights Blvd', // FIXME: Bernal Peak
    '100 John F Shelley Dr',    // FIXME: McLaren Park
    '125 Dalewood Way',         // Mt. Davidson
    '70 Elk St',                // Glen Canyon Park
    '100 Vale Ave',             // FIXME: Pine Lake Park / Stern Grove
    '1 Harding Rd',             // Lake Merced
    '2995 Sloat Blvd',          // SF Zoo
    '1096 Point Lobos Ave',     // Camera Obscura
    '100 34th Ave',             // Legion of Honor
];

//const school = findSchool(schoolData, 'El Dorado', 'Elementary');
//const school = findSchool(schoolData, 'Guadalupe', 'Elementary');
//const school = findSchool(schoolData, 'Rooftop', 'Elementary');
//const school = findSchool(schoolData, 'Taylor', 'Elementary');
//const school = findSchool(schoolData, 'Hoover', 'Middle');
//const school = findSchool(schoolData, 'Burton', 'High');
//const school = findSchool(schoolData, 'Life Learning', 'High');

//console.log(start);
//logKML(addressData, jcts, start, school);
//const distances = findSchoolDistances(addressData, schoolData, jcts, start);

let hits = 0;
let misses = 0;
const gmData = {};
for (const origin of origins) {
    const data = await getSchoolRoutes(schoolData, origin);
    gmData[normalizeAddress(origin)] = data;
}
console.log('//', {hits, misses});
console.log('export default', gmData);
