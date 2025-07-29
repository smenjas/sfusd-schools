//import addressData from '../public/address-data.js';
import addressData from './address-data.js';
import { expandCoords } from '../public/geo.js';

function logCount(count, singular, plural = null) {
    if (plural === null) {
        plural = singular + 's';
    }
    console.log(count, (count === 1) ? singular : plural);
}

// Which street has the most addresses, and how many?
let maxNums = 0;
let maxSt = null;
function countAddresses(addresses) {
    let count = 0;
    for (const street in addresses) {
        const len = Object.keys(addresses[street]).length;
        count += len;
        if (len > maxNums) {
            maxNums = len;
            maxSt = street;
        }
    }
    return count;
}

const streets = Object.keys(addressData);
const streetCount = streets.length;
logCount(streetCount, 'street');

if (streetCount < 1) {
    process.exit();
}

const addressCount = countAddresses(addressData);
logCount(addressCount, 'address', 'addresses');

console.log(maxSt, 'has', maxNums, 'addresses, the most of any street.');

const street = streets[0];
const number = Object.keys(addressData[street])[0];
const coords = addressData[street][number];
console.log('1st address:', number, street, expandCoords(coords).join(','));
