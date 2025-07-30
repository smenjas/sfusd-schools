import schoolData from '../public/school-data.js';
import { randIndex } from './rand.js';
import { argv } from 'node:process';
import { basename } from 'node:path';

// Default settings
let want = 10; // How many schools to output?

// Read command line arguments.
if (argv.length > 2) want = parseInt(argv[2]);

// Provide command line usage instructions.
if (isNaN(want)) {
    console.log('usage:', basename(argv[0]), '[numSchools]');
    process.exit(1);
}

function selectRandomSchools(schoolData, want) {
    const schools = [];
    const indexes = new Set();
    let have = 0;

    while (have < want) {
        const index = randIndex(schoolData);
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

function checkSchools(schools) {
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
if (want >= schoolData.length) {
    schools = schoolData;
}
else if (want > 1) {
    do {
        schools = selectRandomSchools(schoolData, want);
    }
    while (!checkSchools(schools));
}
else {
    schools = selectRandomSchools(schoolData, want);
}

console.log('export default [');
for (const school of schools) {
    console.log(school, ',');
}
console.log('];');
