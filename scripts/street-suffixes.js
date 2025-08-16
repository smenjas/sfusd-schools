import { getStreetSuffixes,
         replaceStreetSuffixes,
         splitStreetAddress } from '../public/address.js';
import addressData from '../public/address-data.js';

/**
 * Replace street suffix abbreviations.
 *
 * @param {string} address - A street address, capitalized
 * @returns {string} A standardized street address
 */
function replaceStreetSuffixAbbreviations(address) {
    const suffixes = getStreetSuffixes();
    const parts = address.split(' ');
    const before = Array.from(parts);
    let print = false;
    for (let i = 2; i < parts.length; i++) {
        let part = parts[i];
        if (i === parts.length - 1 &&
            part === 'NORTH' || part === 'EAST' ||
            part === 'SOUTH' || part === 'WEST') {
            print = true;
        }
        for (const abbr in suffixes) {
            const suffix = suffixes[abbr];
            const re = new RegExp(`^${abbr}$`);
            part = part.replace(re, suffix);
        }
        parts[i] = part;
    }
    if (print) {
        console.log(before);
        console.log(parts);
    }
    return parts.join(' ');
}

for (const street in addressData) {
    const num = Object.keys(addressData[street])[0];
    const address = `${num} ${street}`;
    const big = replaceStreetSuffixAbbreviations(address);
    const small = replaceStreetSuffixes(big);
    const [n, st] = splitStreetAddress(small);
    if (!(st in addressData)) {
        console.log('Cannot find street:', st);
        continue;
    }
    if (!(n in addressData[st])) {
        console.log('Cannot find:', n, 'on', st);
        continue;
    }
}
