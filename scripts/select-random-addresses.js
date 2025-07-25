import addressData from '../public/address-data.js';
import { argv } from 'node:process';
import { basename } from 'node:path';

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
}

function countAddresses(addresses) {
    let have = 0;
    for (const street in addresses) {
        have += Object.keys(addresses[street]).length;
    }
    return have;
}

// Randomly choose a whole number, inclusively.
function randInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Randomly choose an array index.
function randIndex(array) {
    return randInt(0, array.length - 1);
}

// Randomly choose an array element.
function randElement(array) {
    return array[randIndex(array)];
}

function addRandomAddresses(addressData, want, maxPerStreet) {
    console.log('// Using: addRandomAddresses()');
    const addresses = {};
    const streets = Object.keys(addressData);
    let have = 0;

    outer: while (have < want) {
        // Randomly choose a street.
        const st = randElement(streets);

        // Randomly choose how many street numbers to add.
        const nums = Object.keys(addressData[st]);
        const existing = (st in addresses) ? Object.keys(addresses[st]).length : 0;
        const unadded = nums.length - existing;
        if (unadded === 0) {
            continue;
        }
        const canAdd = want - have;
        const max = Math.min(unadded, maxPerStreet, canAdd);
        let add = randInt(1, max);

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
            const num = randElement(nums);
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

// Delete random properties from an object, keeping a given number.
function keepRandomProps(object, keep) {
    if (keep < 0) {
        keep = 0;
    }
    let keys = Object.keys(object);
    while (keys.length > keep) {
        const key = randElement(keys);
        delete object[key];
        keys = Object.keys(object);
    }
}

// Remove street numbers until no street has more than the max allowed.
function limitNumbersPerStreet(addressData, keep) {
    if (keep === Infinity) {
        return;
    }
    for (const st in addressData) {
        keepRandomProps(addressData[st], keep);
    }
}

function removeRandomAddresses(addressData, want, maxPerStreet) {
    console.log('// Using: removeRandomAddresses()');
    limitNumbersPerStreet(addressData, maxPerStreet);

    // How many addresses do we have?
    let have = countAddresses(addressData);
    if (have <= want) {
        if (have < want) {
            console.log('// Not enough addresses:', {have, want});
        }
        return addressData;
    }

    let streets = Object.keys(addressData);

    while (have > want) {
        // Randomly choose a street.
        const st = randElement(streets);

        // Randomly choose how many street numbers to keep.
        const nums = Object.keys(addressData[st]);
        const canRemove = have - want;
        const min = (canRemove < nums.length) ? nums.length - canRemove : 0;
        const keep = randInt(min, nums.length - 1);
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
