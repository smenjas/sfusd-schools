/**
 * @file Find the nearest address to each school.
 */

import { prettifyAddress, splitStreetAddress } from '../public/address.js';
import { expandCoords,
         getAddressCoords,
         getDirectionsURL,
         howFar } from '../public/geo.js';
import { formatDistance } from '../public/path.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';

/**
 * Find the nearest intersection to the given geographic coordinates.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {string} addr - A street address
 * @returns {?string} The nearest street address
 */
function findNearestAddress(addressData, addr) {
    const ll = getAddressCoords(addressData, addr);
    if (!ll) {
        return null;
    }
    const [number, street] = splitStreetAddress(addr, true);
    let distance = Infinity;
    let address = null;
    for (const st in addressData) {
        for (const num in addressData[st]) {
            if (num === number && st === street) {
                continue;
            }
            const coords = expandCoords(addressData[st][num]);
            const beeline = howFar(ll, coords);
            if (beeline < distance) {
                distance = beeline;
                address = `${num} ${st}`;
            }
        }
    }
    return { address, distance };
}

const nearest = [];
const nearestAddresses = {};
let maxLength = -Infinity;

for (const school of schoolData) {
    let desc = `${school.name.replace('San Francisco', 'SF')} ${school.types[0]}`;
    if (school.campus && school.name !== 'The Academy') {
        desc += ' - ' + school.campus + ' Campus';
    }
    maxLength = Math.max(desc.length, maxLength);
    const data = findNearestAddress(addressData, school.address);
    if (!data) {
        console.log('Cannot find any nearby addresses for:', desc);
        continue;
    }
    school.desc = desc;
    nearest.push({
        school: school,
        address: data.address,
        distance: data.distance,
    });
    if (!(data.address in nearestAddresses)) {
        nearestAddresses[data.address] = [];
    }
    nearestAddresses[data.address].push(desc);
}

nearest.sort((a, b) => a.distance - b.distance);

let max = -Infinity;
for (const data of nearest) {
    data.address = prettifyAddress(data.address);
    max = Math.max(data.address.length, max);
}

const city = 'San Francisco, CA';
for (const data of nearest) {
    const desc = data.school.desc.padEnd(maxLength);
    const distance = formatDistance(data.distance).padStart(7);
    const fro = `${data.address}, ${city}`;
    const to = `${data.school.address}, ${data.school.zip}`;
    const url = getDirectionsURL(fro, to);
    console.log(distance, data.address.padEnd(max), 'to', desc, url);
}

for (const address in nearestAddresses) {
    if (nearestAddresses[address].length < 2) continue;
    console.log(nearestAddresses[address].length, address, nearestAddresses[address]);
}
