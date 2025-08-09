/**
 * @file Navigate between places in San Francisco, California.
 */

import jcts from './sf-junctions.js';
import { analyzePath, findPathToSchool } from './path.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';

/**
 * Find a school.
 *
 * @param {string} name - A school name, e.g. "Lowell"
 * @param {string} type - A school type, e.g. "High"
 * @returns {School} Data about a school
 */
function findSchool(name, type) {
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

//const school = findSchool('El Dorado', 'Elementary');
//const school = findSchool('Guadalupe', 'Elementary');
//const school = findSchool('Rooftop', 'Elementary');
//const school = findSchool('Taylor', 'Elementary');
//const school = findSchool('Hoover', 'Middle');
//const school = findSchool('Burton', 'High');
//const school = findSchool('Life Learning', 'High');

for (const school of schoolData) {
    const path = findPathToSchool(addressData, jcts, start, school);
    const end = school.address;
    const place = `${school.name} ${school.types[0]}`;
    analyzePath(addressData, jcts, path, start, end, null, null, '', place);
}
