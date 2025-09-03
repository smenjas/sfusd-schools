import { getAddressCoords,
         howFarAddressToJunction } from '../public/geo.js';
import { findAddressJunction,
         findNearestJunction,
         getStreetJunctions,
         mapCNN,
         nameCNN,
         sortCNNs } from '../public/path.js';
import addressData from '../public/address-data.js';
import jcts from '../public/junctions.js';

/**
 * Find the nearest intersection to every address in San Francisco.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @returns {Object.<CNNPrefix, Array>}
 */
function findNearestJunctions(addressData, jcts) {
    const stJcts = getStreetJunctions(jcts);
    const cnns = {};
    const counts = {};

    for (const st in addressData) {
        if (!(st in stJcts)) {
            console.log(st, 'not found');
        }
        for (const num in addressData[st]) {
            const addr = `${num} ${st}`;
            const ll = getAddressCoords(addressData, addr);
            let cnn;
            if (st in stJcts) {
                const cnns = sortCNNs(jcts, {}, stJcts[st], ll);
                cnn = cnns[0];
            }
            else {
                cnn = findNearestJunction(jcts, {}, ll);
            }
            if (!(cnn in cnns)) cnns[cnn] = [];
            cnns[cnn].push(addr);
            if (!(cnn in counts)) counts[cnn] = 0;
            counts[cnn]++;
        }
    }

    let max = -Infinity;
    let maxCNN = null;
    for (const cnn in counts) {
        const count = counts[cnn];
        if (count > max) {
            max = count;
            maxCNN = cnn;
        }
    }

    console.log({maxCNN, max}, nameCNN(jcts, maxCNN), mapCNN(jcts, maxCNN));
    console.log(cnns[maxCNN]);

    return cnns;
}

const cnns = findNearestJunctions(addressData, jcts);
const histo = {};
const threshold = 100;
let maxDistance = -Infinity;
let maxJunction = null;
let maxAddress = null;

for (const cnn in cnns) {
    const addresses = cnns[cnn];
    const num = addresses.length;
    if (!(num in histo)) histo[num] = 0;
    histo[num]++;
    if (num >= threshold) {
        console.log(cnn, 'has', num, 'addresses', nameCNN(jcts, cnn), mapCNN(jcts, cnn));
    }
    for (const address of addresses) {
        const distance = howFarAddressToJunction(addressData, jcts, address, cnn);
        if (distance > maxDistance) {
            maxDistance = distance;
            maxJunction = cnn;
            maxAddress = address;
        }
    }
}

console.log({maxJunction, maxAddress, maxDistance}, nameCNN(jcts, maxJunction), mapCNN(jcts, maxJunction));
