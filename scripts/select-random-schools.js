/**
 * @file Select a random subset of schools.
 */

import { argv } from 'node:process';
import { basename } from 'node:path';
import { randomIndex } from './random.js';
import schoolData from '../public/school-data.js';

// Default settings
let want = 10; // How many schools to output?

// Read command line arguments.
if (argv.length > 2) want = parseInt(argv[2]);

// Provide command line usage instructions.
if (isNaN(want)) {
    console.log('usage:', basename(argv[0]), '[numSchools]');
    process.exit(1);
}

/**
 * Select random schools.
 *
 * @param {Array.<School>} schoolData - Data about all schools
 * @param {number} want - How many schools to select
 * @returns {Array.<Object>} Data about some schools
 */
function selectRandomSchools(schoolData, want) {
    if (want >= schoolData.length) {
        return schoolData;
    }

    const schools = [];
    const indexes = new Set();
    let have = 0;

    while (have < want) {
        const index = randomIndex(schoolData);
        if (indexes.has(index)) {
            continue;
        }
        indexes.add(index);
        const school = schoolData[index];
        schools.push(school);
        have++;
    }

    return schools;
}

/**
 * Check that schools have all grade levels, when there are 2 or more.
 *
 * @param {Array.<School>} schools - Data about some schools
 * @returns {boolean} Whether the schools have all grade levels
 */
function checkSchools(schools) {
    if (schools.length < 2) {
        // No one school has all grade levels.
        return true;
    }
    const grades = {
        'pk': false,
        'tk': false,
        'k': false,
    };
    for (let n = 1; n <= 13; n++) {
        grades[n] = false;
    }
    for (const school of schools) {
        if (school.pk) grades.pk = true;
        if (school.tk) grades.tk = true;
        if (school.k) grades.k = true;
        if (school.min && school.max) {
            for (let g = school.min; g <= school.max; g++) {
                grades[g] = true;
            }
        }
        if (Object.values(grades).every(g => g)) {
            return true;
        }
    }
    return false;
}

let schools;
do {
    schools = selectRandomSchools(schoolData, want);
}
while (!checkSchools(schools));

console.log('export default [');
for (const school of schools) {
    console.log(school, ',');
}
console.log('];');
