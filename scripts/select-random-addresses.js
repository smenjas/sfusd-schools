/**
 * @file Select a random subset of street addresses.
 */

import { argv } from 'node:process';
import { basename } from 'node:path';
import { randomInt, randomElement } from './random.js';
import addressData from '../public/address-data.js';

// Default settings
let want = 100; // How many addresses to output?
let maxPerStreet = Infinity; // Limit how many numbers per street?

// Read command line arguments.
if (argv.length > 2) want = parseInt(argv[2]);
if (argv.length > 3) maxPerStreet = parseInt(argv[3]);

// Provide command line usage instructions.
if (isNaN(want) || isNaN(maxPerStreet)) {
    console.log('usage:', basename(argv[0]), basename(argv[1]),
        '[numAddresses]', '[maxPerStreet]');
    process.exit(1);
}

/**
 * Count how many nested keys there are in an object of objects.
 *
 * @param {Object} obj - An object
 * @returns {number} How many nested keys there are
 */
function countNestedKeys(obj) {
    let count = 0;
    for (const key in obj) {
        count += Object.keys(obj[key]).length;
    }
    return count;
}

/**
 * Select random addresses, by adding them to a new object.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {number} want - How many addresses to select
 * @param {number} maxPerStreet - The maximum number of addresses per street
 * @returns {StreetAddresses} Some SF street addresses
 */
function addRandomAddresses(addressData, want, maxPerStreet) {
    console.log('// Using: addRandomAddresses()');
    const addresses = {};
    const streets = Object.keys(addressData);
    let have = 0;

    outer: while (have < want) {
        // Randomly choose a street.
        const st = randomElement(streets);

        // Randomly choose how many street numbers to add.
        const nums = Object.keys(addressData[st]);
        const existing = (st in addresses) ? Object.keys(addresses[st]).length : 0;
        const unadded = nums.length - existing;
        if (unadded === 0) {
            continue;
        }
        const canAdd = want - have;
        const max = Math.min(unadded, maxPerStreet, canAdd);
        let add = randomInt(1, max);

        if (unadded === add) {
            // Add the whole street if we're adding all of its numbers.
            addresses[st] = addressData[st];
            have += add;
            continue;
        }

        if (!(st in addresses)) {
            addresses[st] = {};
        }

        while (add > 0) {
            // Randomly choose a street number.
            const num = randomElement(nums);
            if (num in addresses[st]) {
                continue;
            }
            addresses[st][num] = addressData[st][num];
            have++;
            add--;
        }
    }

    return addresses;
}

/**
 * Delete random properties from an object, keeping a given number.
 *
 * @param {Object} obj - An object
 * @param {number} keep - How many properties to keep
 */
function keepRandomProps(obj, keep) {
    if (keep < 0) {
        keep = 0;
    }
    let keys = Object.keys(obj);
    while (keys.length > keep) {
        const key = randomElement(keys);
        delete obj[key];
        keys = Object.keys(obj);
    }
}

/**
 * Remove street numbers until no street has more than the max allowed.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {number} keep - How many addresses to keep, for each street
 */
function limitNumbersPerStreet(addressData, keep) {
    if (keep === Infinity) {
        return;
    }
    for (const st in addressData) {
        keepRandomProps(addressData[st], keep);
    }
}

/**
 * Select random addresses, by removing them from the existing object.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {number} want - How many addresses to select
 * @param {number} maxPerStreet - The maximum number of addresses per street
 * @returns {StreetAddresses} Some SF street addresses
 */
function removeRandomAddresses(addressData, want, maxPerStreet) {
    console.log('// Using: removeRandomAddresses()');
    limitNumbersPerStreet(addressData, maxPerStreet);

    // How many addresses do we have?
    let have = countNestedKeys(addressData);
    if (have <= want) {
        if (have < want) {
            console.log('// Not enough addresses:', {have, want});
        }
        return addressData;
    }

    let streets = Object.keys(addressData);

    while (have > want) {
        // Randomly choose a street.
        const st = randomElement(streets);

        // Randomly choose how many street numbers to keep.
        const nums = Object.keys(addressData[st]);
        const canRemove = have - want;
        const min = (canRemove < nums.length) ? nums.length - canRemove : 0;
        const keep = randomInt(min, nums.length - 1);
        have -= nums.length - keep;

        if (keep === 0) {
            // Remove the whole street if we're removing all of its numbers.
            delete addressData[st];
            streets = Object.keys(addressData);
            continue;
        }

        keepRandomProps(addressData[st], keep);
    }

    return addressData;
}

const threshold = 207000;
const func = (want < threshold) ? addRandomAddresses : removeRandomAddresses;
const addresses = func(addressData, want, maxPerStreet);
console.log('export default', addresses);
