/**
 * @file Analyze geographic data.
 */

import { splitStreetAddress } from '../public/address.js';
import { expandCoords,
         getAddressCoords,
         getCoordsURL,
         howFar,
         lonToMilesFactor,
         milesToFeet } from '../public/geo.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';

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
        const coords = expandCoords(addressData[st][n]);
        const [lat, lon] = coords;
        if (lat < minLat) {
            minLat = lat;
            minLatLon = lon;
            south = `${n} ${st}`;
            //console.log(`New min lat for ${south}`, getCoordsURL(coords));
        }
        if (lat > maxLat) {
            maxLat = lat;
            maxLatLon = lon;
            north = `${n} ${st}`;
            //console.log(`New max lat for ${north}`, getCoordsURL(coords));
        }
        if (lon < minLon) {
            minLon = lon;
            minLonLat = lat;
            east = `${n} ${st}`;
            //console.log(`New min lon for ${east}`, getCoordsURL(coords));
        }
        if (lon > maxLon) {
            maxLon = lon;
            maxLonLat = lat;
            west = `${n} ${st}`;
            //console.log(`New max lon for ${west}`, getCoordsURL(coords));
        }
    }
}

// How many miles per degree of longitude are there at the northernmost addess?
const maxFactor = lonToMilesFactor(maxLat);
console.log({maxLat, maxFactor});

// How many miles per degree of longitude are there at the southernmost addess?
const minFactor = lonToMilesFactor(minLat);
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
    const coords = getAddressCoords(addressData, school.address);
    const miles = howFar(school.ll, coords);
    const feet = Math.round(milesToFeet(miles));
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
    //console.log(school.name, school.address, school.ll, coords, feet);
}

const threshold = 328; // 100 meters in feet
discrepancies.sort((a, b) => a.feet - b.feet);
for (const discrepancy of discrepancies) {
    if (discrepancy.feet < threshold) continue;
    console.log(discrepancy);
}

//console.log({minName, minFeet, maxName, maxFeet});

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
