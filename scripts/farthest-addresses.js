/**
 * @file Find the farthest address to each school.
 */

import { normalizeAddress,
         prettifyAddress,
         splitStreetAddress } from '../public/address.js';
import { expandCoords, getDirectionsURL, howFar } from '../public/geo.js';
import { formatDistance, getAddressCoords } from '../public/path.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';

/**
 * Find the farthest intersection to the given geographic coordinates.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {string} addr - A street address
 * @returns {?string} The farthest street address
 */
function findFarthestAddress(addressData, addr) {
    addr = normalizeAddress(addr);
    const ll = getAddressCoords(addressData, addr);
    if (!ll) {
        return null;
    }
    const [number, street] = splitStreetAddress(addr);
    let distance = -Infinity;
    let address = null;
    for (const st in addressData) {
        for (const num in addressData[st]) {
            if (num === number && st === street) {
                continue;
            }
            const coords = expandCoords(addressData[st][num]);
            const beeline = howFar(ll, coords);
            if (beeline > distance) {
                distance = beeline;
                address = `${num} ${st}`;
            }
        }
    }
    return { address, distance };
}

const farthest = [];
const farthestAddresses = {};
const max = { distance: Infinity };

for (const school of schoolData) {
    const desc = `${school.name} ${school.types[0]}`;
    const data = findFarthestAddress(addressData, school.address);
    if (!data) {
        console.log('Cannot find any distant addresses for:', desc);
        continue;
    }
    farthest.push({
        school: desc,
        address: data.address,
        distance: data.distance,
    });
    if (!(data.address in farthestAddresses)) {
        farthestAddresses[data.address] = [];
    }
    farthestAddresses[data.address].push(desc);
    if (data.distance > max.distance) {
        max.distance = data.distance;
        max.address = data.address;
        max.school = desc;
    }
}

farthest.sort((a, b) => b.distance - a.distance);

let maxLength = -Infinity;
for (const data of farthest) {
    const address = prettifyAddress(data.address);
    if (address.length > maxLength) {
        maxLength = data.school.length;
    }
}

for (const data of farthest) {
    const address = prettifyAddress(data.address);
    const city = 'San Francisco, CA';
    const desc = data.school.padEnd(42);
    const distance = formatDistance(data.distance).padStart(7);
    const url = getDirectionsURL(`${address}, ${city}`, `${data.school}, ${city}`);
    console.log(distance, desc, 'to', address.padEnd(maxLength), url);
}

const addresses = Object.keys(farthestAddresses);
addresses.sort((a, b) => farthestAddresses[b].length - farthestAddresses[a].length);
for (const address of addresses) {
    console.log(farthestAddresses[address].length, address);
}
