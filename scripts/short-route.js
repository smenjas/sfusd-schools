/**
 * @file Navigate between places in San Francisco, California.
 */

import { findSchool, splitSchoolDescription } from '../public/common.js';
import { findPathToSchool, getStreetJunctions } from '../public/path.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';
import jcts from '../public/junctions.js';

const start = '155 Appleton Ave';
const end = '625 Holly Park Cir';

const stJcts = getStreetJunctions(jcts);
const beelines = {};

/**
 * Find a path between schools in San Francisco, California.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {StreetJunctions} stJcts - Look up CNNs by street name.
 * @param {Object} beelines - Distances to addresses, as the crow flies
 * @param {string} start - A school's description, e.g. "Lowell High"
 * @param {string} end - A school's description, e.g. "Lowell High"
 * @returns {CNNPrefixes} Intersections
 */
function findPathBetweenSchools(addressData, jcts, stJcts, beelines, start, end) {
    const [startName, startType] = splitSchoolDescription(start);
    const [endName, endType] = splitSchoolDescription(end);
    const startSchool = findSchool(schoolData, startName, startType);
    if (!startSchool) {
        console.log('Cannot find school:', start);
    }
    const endSchool = findSchool(schoolData, endName, endType);
    if (!endSchool) {
        console.log('Cannot find school:', end);
    }
    const path = findPathToSchool(addressData, jcts, stJcts, beelines, startSchool.address, endSchool);
    console.log(start, startSchool.address, 'to', end, endSchool.address, path);
}

findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Stockton Early Education', 'Lee Elementary');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Lau Elementary', 'Lee Elementary');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Downtown High', 'San Francisco International High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Webster Elementary', 'San Francisco International High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'KIPP Bayview Elementary', 'Harte Elementary');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'El Dorado Elementary', 'Burton High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Serra Annex Early Education', 'Serra Elementary');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Brown Middle', 'Marshall High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Taylor Elementary', 'King Middle');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'San Francisco Community Elementary', 'Monroe Elementary');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'San Miguel Early Education', 'Balboa High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Denman Middle', 'Balboa High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'San Miguel Early Education', 'Denman Middle');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Sanchez Elementary', 'Everett Middle');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Mahler Early Education', 'Edison Elementary');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Wallenberg High', 'Gateway High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Weill Early Education', 'Parks Elementary');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'West Portal Elementary', 'Hoover Middle');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Feinstein Elementary', 'Lincoln High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Muir Elementary', 'Wells High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Cleveland Elementary', 'Jordan High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Presidio Middle', 'Washington High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Lakeshore Elementary', 'Lowell High');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Sunset Elementary', 'Giannini Middle');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Argonne Early Education', 'Argonne Elementary');
findPathBetweenSchools(addressData, jcts, stJcts, beelines, 'Tule Elk Park Early Education', 'Marina Middle');
