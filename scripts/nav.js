/**
 * @file Navigate between places in San Francisco, California.
 */

import { logKML } from '../public/kml.js';
import { findSchoolDistances } from '../public/path.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';
import jcts from '../public/sf-junctions.js';

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
const school = findSchool(schoolData, 'Taylor', 'Elementary');
//const school = findSchool(schoolData, 'Hoover', 'Middle');
//const school = findSchool(schoolData, 'Burton', 'High');
//const school = findSchool(schoolData, 'Life Learning', 'High');

logKML(addressData, jcts, start, school); process.exit(0);
const distances = findSchoolDistances(addressData, schoolData, jcts, start);
