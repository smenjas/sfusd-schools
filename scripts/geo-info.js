/**
 * @file Analyze geographic data.
 */

import schoolData from '../public/school-data.js';
import addressData from '../public/address-data.js';
import { expandCoords,
         getMapURL,
         howFar,
         lonToMilesFactor } from '../public/geo.js';

/**
 * Generate a Google Maps URL.
 *
 * @param {Array.<number>} coords - Decimal portion of ° latitude, longitude
 * @returns {string} A URL
 */
function getCoordsURL(coords) {
    if (!coords) {
        return '';
    }
    return getMapURL(expandCoords(coords).join(','));
}

let minLon = Infinity;
let minLonLat = null;
let east = '';

let maxLon = -Infinity;
let maxLonLat = null;
let west = '';

let minLat = Infinity;
let minLatLon = null;
let south = '';

let maxLat = -Infinity;
let maxLatLon = null;
let north = '';

for (const st in addressData) {
    for (const n in addressData[st]) {
        const lat = addressData[st][n][0].toString().padEnd(4, '0');
        const lon = addressData[st][n][1].toString().padEnd(4, '0');
        if (lat < minLat) {
            minLat = lat;
            minLatLon = lon;
            south = `${n} ${st}`;
            //console.log(`New min lat for ${south}`, getCoordsURL([lat, lon]));
        }
        if (lat > maxLat) {
            maxLat = lat;
            maxLatLon = lon;
            north = `${n} ${st}`;
            //console.log(`New max lat for ${north}`, getCoordsURL([lat, lon]));
        }
        if (lon < minLon) {
            minLon = lon;
            minLonLat = lat;
            east = `${n} ${st}`;
            //console.log(`New min lon for ${east}`, getCoordsURL([lat, lon]));
        }
        if (lon > maxLon) {
            maxLon = lon;
            maxLonLat = lat;
            west = `${n} ${st}`;
            //console.log(`New max lon for ${west}`, getCoordsURL([lat, lon]));
        }
    }
}

// How many miles per degree of longitude are there at the northernmost addess?
const maxFactor = lonToMilesFactor(`37.${maxLat}`);
console.log({maxLat, maxFactor});

// How many miles per degree of longitude are there at the southernmost addess?
const minFactor = lonToMilesFactor(`37.${minLat}`);
console.log({minLat, minFactor});

// Which addresses are farthest north, south, east, and west in San Francisco?
console.log('Northernmost address:', getCoordsURL([maxLat, maxLatLon]), north);
console.log('Southernmost address:', getCoordsURL([minLat, minLatLon]), south);
console.log('Easternmost address: ', getCoordsURL([minLonLat, minLon]), east);
console.log('Westernmost address: ', getCoordsURL([maxLonLat, maxLon]), west);

// How many miles per degree of longitude are there at various latitudes?
for (let lat = 0; lat <= 90; lat += 10) {
    console.log(lat, Math.round(lonToMilesFactor(lat) * 10) / 10);
}

// How far away are each school's coordinates from those of its address?
let minFeet = Infinity;
let minName = '';
let maxFeet = -Infinity;
let maxName = '';
const discrepancies = [];

for (const school of schoolData) {
    const name = `${school.name} ${school.types[0]}`;
    const parts = school.address.split(' ');
    const num = parts.shift();
    const street = parts.join(' ').toUpperCase().replace(/[^A-Z0-9\s]/g, '');
    if (!(street in addressData)) {
        console.log('Street not found:', street, 'for', name);
        continue;
    }
    if (!(num in addressData[street])) {
        console.log(num, 'not found on', street, 'for', name);
        continue;
    }
    const coords = expandCoords(addressData[street][num]);
    const feet = Math.round(howFar(school.ll, coords) * 5280);
    discrepancies.push({
        name: name,
        address: school.address,
        feet: feet,
        school: school.ll,
        sfdata: [parseFloat(coords[0]), parseFloat(coords[1])],
    });
    if (feet < minFeet) {
        minFeet = feet;
        minName = name;
    }
    if (feet > maxFeet) {
        maxFeet = feet;
        maxName = name;
    }
    console.log(school.name, school.address, school.ll, coords, feet);
}

discrepancies.sort((a, b) => a.feet - b.feet);

for (const discrepancy of discrepancies) {
    console.log(discrepancy);
}

console.log({minName, minFeet, maxName, maxFeet});

// How long is the longest street address?
let maxLength = 0;
let maxStreet = '';
for (const st in addressData) {
    if (st.length > maxLength) {
        maxLength = st.length;
        maxStreet = st;
    }
}
const maxStreetNums = Object.keys(addressData[maxStreet]);
const maxStreetNum = maxStreetNums[maxStreetNums.length - 1];
const totalLength = `${maxStreetNum} ${maxStreet}`.length;
console.log('Longest address:', maxStreetNum, maxStreet, totalLength);

let count = 0;
for (const st in addressData) {
    for (const num in addressData[st]) {
        count++;
    }
}
console.log(count, 'SF addresses');
