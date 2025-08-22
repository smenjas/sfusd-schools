/**
 * @file Find the nearest address to each school.
 */

import { normalizeAddress,
         prettifyAddress,
         splitStreetAddress } from '../public/address.js';
import { expandCoords, getDirectionsURL, howFar } from '../public/geo.js';
import { formatDistance, getAddressCoords } from '../public/path.js';
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
    addr = normalizeAddress(addr);
    const ll = getAddressCoords(addressData, addr);
    if (!ll) {
        return null;
    }
    const [number, street] = splitStreetAddress(addr);
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
const min = { distance: Infinity };

for (const school of schoolData) {
    const desc = `${school.name} ${school.types[0]}`;
    const data = findNearestAddress(addressData, school.address);
    if (!data) {
        console.log('Cannot find any nearby addresses for:', desc);
        continue;
    }
    nearest.push({
        school: desc,
        address: data.address,
        distance: data.distance,
    });
    if (data.distance < min.distance) {
        min.distance = data.distance;
        min.address = data.address;
        min.school = desc;
    }
}

nearest.sort((a, b) => a.distance - b.distance);

let maxLength = -Infinity;
for (const data of nearest) {
    if (data.address.length > maxLength) {
        maxLength = data.address.length;
    }
}

for (const data of nearest) {
    const address = prettifyAddress(data.address);
    const city = 'San Francisco, CA';
    const desc = data.school.padEnd(42);
    const distance = formatDistance(data.distance).padStart(7);
    const url = getDirectionsURL(`${address}, ${city}`, `${data.school}, ${city}`);
    console.log(distance, desc, 'to', address.padEnd(maxLength), url);
}
