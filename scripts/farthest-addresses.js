/**
 * @file Find the farthest address from each school.
 */

import { normalizeAddress,
         prettifyAddress,
         splitStreetAddress } from '../public/address.js';
import { expandCoords,
         getAddressCoords,
         getDirectionsURL,
         howFar } from '../public/geo.js';
import { formatDistance } from '../public/path.js';
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
let maxLength = -Infinity;

for (const school of schoolData) {
    let desc = `${school.name.replace('San Francisco', 'SF')} ${school.types[0]}`;
    if (school.campus && school.name !== 'The Academy') {
        desc += ' - ' + school.campus + ' Campus';
    }
    maxLength = Math.max(desc.length, maxLength);
    const data = findFarthestAddress(addressData, school.address);
    if (!data) {
        console.log('Cannot find any distant addresses for:', desc);
        continue;
    }
    school.desc = desc;
    farthest.push({
        school: school,
        address: data.address,
        distance: data.distance,
    });
    if (!(data.address in farthestAddresses)) {
        farthestAddresses[data.address] = [];
    }
    farthestAddresses[data.address].push(desc);
}

farthest.sort((a, b) => b.distance - a.distance);

const city = 'San Francisco, CA';
const addresses = Object.keys(farthestAddresses);
addresses.sort((a, b) => farthestAddresses[b].length - farthestAddresses[a].length);
for (let address of addresses) {
    const prettyAddress = prettifyAddress(address);
    console.log(farthestAddresses[address].length, prettyAddress);

    for (const data of farthest) {
        if (data.address !== address) continue;
        const desc = data.school.desc;
        const distance = formatDistance(data.distance).padStart(7);
        const fro = `${prettyAddress}, ${city}`;
        const to = `${data.school.address}, ${data.school.zip}`;
        const url = getDirectionsURL(fro, to);
        console.log('\t', distance, desc.padEnd(maxLength), url);
    }
}
