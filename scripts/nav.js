/**
 * @file Navigate between places in San Francisco, California.
 */

import jcts from './sf-junctions.js';
import { kmlDoc } from './kml.js';
import { addressesHowFar,
         analyzePath,
         findPathToSchool,
         getAddressCoords,
         nameCNN,
         sumDistances } from './path.js';
import { mean, median } from './stat.js';
import { expandCoords } from '../public/geo.js';
import { capitalizeWords } from '../public/string.js';
import addressData from '../public/address-data.js';
import commuteData from './commute-data.js';
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
            ll: expandCoords(jcts[cnn].ll),
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
    const path = findPathToSchool(addressData, jcts, start, school);
    const end = school.address;
    const place = `${school.name} ${school.types[0]}`;
    console.log(makeGeoDoc(addressData, jcts, path, start, end, place));
}

/**
 * Compare distances.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Array.<Object>} commuteData
 * @param {Junctions} jcts - All SF intersections
 * @returns {CNNPrefixes} path - Intersections
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @param {string} name - The school name
 * @param {string} type - The school type
 * @param {Object} pcts - Distance discrepancies as percentages
 */
function compareDistance(addressData, commuteData, jcts, path, start, end, name, type, pcts) {
    const distance = sumDistances(addressData, jcts, path, start, end);
    const beeline = addressesHowFar(addressData, start, end);
    const distanceMi = parseFloat(distance.toFixed(1));
    const beelineMi = parseFloat(beeline.toFixed(1));

    name = name.replace('San Francisco', 'SF');
    const school = getSchoolCommuteData(commuteData, name, type);
    if (!school) return;
    const { distance: commute, drive, bike } = school;
    const pctDiff = Math.round(((commute - distance) / commute) * 100);
    pcts[`${name} ${type}`] = pctDiff;

    /*
    console.log('\t',
        beelineMi, '\t',
        distanceMi, '\t',
        parseFloat(commute), '\t',
        `${pctDiff}%\t`,
        //'drive:', drive, 'min.\t',
        //'bike:', bike, 'min.\t',
        name, type);
    */
}

/**
 * Compare distances.
 *
 * @param {Object} pcts - Distance discrepancies as percentages
 */
function compareDistances(pcts) {
    let minPct = Infinity;
    let minSch = '';
    let maxPct = -Infinity;
    let maxSch = '';
    let totalPcts = 0;

    for (const school in pcts) {
        const pct = pcts[school];
        if (pct < minPct) {
            minPct = pct;
            minSch = school;
        }
        if (pct > maxPct) {
            maxPct = pct;
            maxSch = school;
        }
        totalPcts += Math.abs(pct);
    }

    console.log('Minimum percent:   ', `${minPct.toFixed(0)}%`, minSch);
    console.log('Median discrepancy:', `${median(Object.values(pcts)).toFixed(0)}%`);
    console.log('Mean discrepancy:  ', `${mean(Object.values(pcts)).toFixed(0)}%`);
    console.log('Maximum percent:   ', `${maxPct.toFixed(0)}%`, maxSch);
    console.log('Percentages sum:   ', `${totalPcts.toFixed(0)}%`);
}

/**
 * Get school commute data.
 *
 * @param {Array.<Object>} commuteData - Distance and travel times to schools
 * @param {string} name - The school name
 * @param {string} type - The school type
 * @returns {?Object} School commute data
 */
function getSchoolCommuteData(commuteData, name, type) {
    for (const school of commuteData) {
        if (school.name === name && school.type === type) {
            return school;
        }
    }
    console.log('No match found for:', name, type);
    return null;
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

//logKML(addressData, jcts, start, school); process.exit(0);

const pcts = {};
for (const school of schoolData) {
    const path = findPathToSchool(addressData, jcts, start, school);
    const end = school.address;
    const place = `${school.name} ${school.types[0]}`;
    //analyzePath(addressData, jcts, path, start, end, null, null, '', place);
    compareDistance(addressData, commuteData, jcts, path, start, end, school.name, school.types[0], pcts);
}
compareDistances(pcts);
