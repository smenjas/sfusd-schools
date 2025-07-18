// Parse the HTML from: https://www.sfusd.edu/schools/directory/table

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import schoolData from '../public/school-data.js';

function parseHtmlFile(filePath) {
    try {
        const html = fs.readFileSync(filePath, 'utf8');
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        return doc;
    }
    catch (err) {
        console.error('Error parsing HTML file:', err.message);
        return null;
    }
}

function parseSchoolRow(row) {
    const data = [];
    const cells = row.querySelectorAll('td');
    cells.forEach(cell => {
        const divs = cell.querySelectorAll('div.office-hours__item');
        if (divs.length) {
            const hours = [];
            divs.forEach(div => {
                hours.push(div.textContent.trim());
            });
            data.push(hours.join(', '));
        }
        else {
            data.push(cell.textContent.trim());
        }
    });
    if (data.every(field => !field)) {
        // Skip the header row.
        return null;
    }
    return {
        name: data[0],
        type: data[1],
        hours: data[2],
        phone: data[3],
        address: data[4],
    };
}

function concatName(school) {
    const parts = [];
    const props = ['prefix', 'name', 'suffix', 'campus'];
    for (const prop of props) {
        if (school[prop] !== '') parts.push(school[prop]);
    }
    return parts.join(' ');
}

function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function removePunctuation(str) {
    return str.replace(/[^A-Za-z0-9\s]/g, '');
}

function compressWhitespace(str) {
    return str.trim().replace(/\s+/g, ' ');
}

function findPossibleSchools(b) {
    const name = removeAccents(b.name);
    let maybes = [];
    for (const a of schoolData) {
        if (a.charter) {
            continue;
        }
        const re = new RegExp(`\\b${RegExp.escape(a.name)}\\b`);
        if (!name.match(re)) {
            continue;
        }
        for (const type of a.types) {
            if (!b.type.includes(type)) {
                continue;
            }
            //console.log([a.name, a.types[0], a.campus].join(' ').trim(), '\tmatches\t', b.name);
            maybes.push(a);
            break;
        }
    }
    return maybes;
}

function findSchool(b) {
    const maybes = findPossibleSchools(b);
    switch (maybes.length) {
        case 0: return null;
        case 1: return maybes[0];
    }
    const grades = getSchoolGrades(b);
    const types = getSchoolTypes(b);
    for (const a of maybes) {
        if (a.campus && b.name.includes(a.campus)) {
            //console.log([a.name, a.types[0], a.campus].join(' ').trim(), 'matches', b.name);
            return a;
        }
        if (grades.min === a.min && grades.max === a.max) {
            //console.log(a.name, `${a.min}-${a.max}`, 'matches', b.name, `${grades.min}-${grades.max}`);
            return a;
        }
        if (compareArrays(a.types, types)) {
            //console.log(a.name, a.types, 'matches', b.name, types);
            return a;
        }
    }
    const subsets = [];
    for (const a of maybes) {
        const { name, campus, types, min, max } = a;
        subsets.push({
            name: name,
            campus: campus,
            types: types,
            min: min,
            max: max,
        });
    }
    console.log(b, subsets);
}

function replaceStreetSuffixes(address) {
    const suffixes = {
      AVE: 'AVENUE',
      BLVD: 'BOULEVARD',
      CIR: 'CIRCLE',
      DR: 'DRIVE',
      RD: 'ROAD',
      ST: 'STREET',
    };
    for (const abbr in suffixes) {
        const suffix = suffixes[abbr];
        const re = new RegExp(`\\b${suffix}\\b`);
        address = address.replace(re, abbr);
    }
    return address;
}

function normalizeAddress(address) {
    address = removeAccents(address);
    address = removePunctuation(address);
    address = compressWhitespace(address);
    address = address.toUpperCase();
    address = replaceStreetSuffixes(address);
    return address;
}

function checkSchoolAddress(a, b) {
    a = normalizeAddress(a);
    b = normalizeAddress(b);
    return b.includes(a);
}

function compareArrays(a, b) {
    return a.every(e => b.includes(e)) && b.every(e => a.includes(e));
}

function getSchoolTypes(school) {
    const types = school.type.split('(')[0].split(',');
    for (const index in types) {
        types[index] = types[index].trim().replace(' School', '');
    }
    return types;
}

function checkSchoolTypes(a, b) {
    const types = getSchoolTypes(b);
    if (!compareArrays(a.types, types)) {
        console.log('School type mismatch:');
        console.log('\t', b.name, types);
        console.log('\t', a.name, a.types);
        return false;
    }
    return true;
}

function getSchoolGrades(school) {
    const parts = school.type.split('(')[1].replace(')', '').split(/,\s{0,}/);
    let min = null;
    let max = null;
    for (const range of parts) {
        if (!range.includes('-')) {
            continue;
        }
        [min, max] = range.split('-');
        break;
    }
    return {
        pk: parts.includes('PreK'),
        tk: parts.includes('TK'),
        k: parts.includes('K'),
        min: (min === null) ? null : parseInt(min),
        max: (max === null) ? null : parseInt(max),
    };
}

function checkSchoolGrades(a, b) {
    let allMatch = true;
    const grades = getSchoolGrades(b);
    const name = [a.name, a.types[0], a.campus].join(' ').trim();
    if (a.pk !== grades.pk) {
        console.log(name, 'mismatch: PreK');
        allMatch = false;
    }
    if (a.tk !== grades.tk) {
        console.log(name, 'mismatch: TK');
        allMatch = false;
    }
    if (a.k !== grades.k) {
        console.log(name, 'mismatch: K');
        allMatch = false;
    }
    if (grades.min !== null && a.min !== grades.min) {
        console.log(name, 'min grade mismatch:', grades.min, '!=', a.min);
        allMatch = false;
    }
    if (grades.max !== null && a.max !== grades.max) {
        console.log(name, 'max grade mismatch:', grades.min, '!=', a.max);
        allMatch = false;
    }
    return allMatch;
}

function getStartTime(hours) {
    const parts = hours.split(',')[0].split(':');
    parts.shift();
    return parts.join(':').trim().split('-')[0].split(' ')[0];
}

function checkStartTime(a, b) {
    const start = getStartTime(b.hours);
    if (start !== a.start) {
        console.log('Start time mismatch:');
        console.log('\t', start, b.name);
        console.log('\t', a.start, a.name, a.types[0]);
        return false;
    }
    return true;
}

function checkSchool(b) {
    let problems = 0;
    const a = findSchool(b);
    if (!a) {
        if (!b.type.includes('County')) {
            console.log('No match found for:', b.name, b.type);
        }
        return false;
    }
    //console.log(concatName(a), a.types[0], 'matches:');
    //console.log(b.name, '|', b.type);
    if (!checkSchoolAddress(a.address, b.address)) {
        console.log('Address mismatch:');
        console.log('\t', b.name);
        console.log('\t\t', normalizeAddress(b.address), 'does not include');
        console.log('\t', a.name, a.types[0]);
        console.log('\t\t', normalizeAddress(a.address));
        problems++;
    }
    //problems += !checkStartTime(a, b); // Verified 2025-07-11: Our start times are for TK+, Lowell has an optional 0th period
    //problems += !checkSchoolTypes(a, b); // Verified 2025-07-12: SFUSD says anything with PreK/TK counts as Early Ed.
    //problems += !checkSchoolGrades(a, b); // Verified 2025-07-12: PreK, TK, K, min, and max
    //console.log();
    return !!problems;
}

const filePath = 'cache/sfusd/Directory of Schools _ SFUSD.html';

if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

const schools = [];

try {
    const doc = parseHtmlFile(filePath);
    const table = doc.querySelector('table.cols-5');
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const school = parseSchoolRow(row);
        //console.log(school);
        if (school) {
            schools.push(school);
        }
    });
}
catch (err) {
    console.error('Error parsing HTML:', err.message);
}

let problems = 0;
for (const school of schools) {
    problems += checkSchool(school);
}
console.log(problems, 'schools have potential problems.');
