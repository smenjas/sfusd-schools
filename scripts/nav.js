/**
 * @file Navigate between places in San Francisco, California.
 */

import dotenv from 'dotenv';
import { getRouteData } from './gmaps.js';
import { normalizeAddress } from '../public/address.js';
import { metersToMiles } from '../public/geo.js';
import { findSchoolDistances } from '../public/path.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';
import gmapsData from './gmaps-data.js';
import jcts from '../public/junctions.js';

dotenv.config({ path: '../.env', quiet: true });

/**
 * Get route info from Google Maps.
 *
 * @param {Schools} schoolData - All SF public schools
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @returns {Object} Distance and travel time for a given route
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
 * @returns {Object} Distances and travel times
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

//console.log(start);
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
