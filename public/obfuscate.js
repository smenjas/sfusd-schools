/**
 * Obfuscate normalized street addresses.
 *
 * Why? Privacy. Someone who knows about localStorage in browsers could
 * otherwise trivially see previously entered addresses. Obfuscating the
 * destinations prevents them from guessing the starting address based on the
 * distance.
 *
 * @module public/obfuscate
 */

import { normalizeAddress } from './address.js';
import { getStoredItem, storeItem } from './common.js';

// Character set: digits, uppercase letters, space
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ';

/**
 * Get a random rotation amount (1 to 36).
 *
 * @returns {number} Random rotation amount
 */
function getRandomRotation() {
    return Math.floor(Math.random() * (CHARSET.length - 1)) + 1;
}

/**
 * Rotate a character by the specified amount
 *
 * @param {string} char - Character to rotate
 * @param {number} rotation - Amount to rotate
 * @returns {string} Rotated character
 */
function rotateChar(char, rotation) {
    const index = CHARSET.indexOf(char);
    if (index === -1) {
        // Character not in charset, return as-is (shouldn't happen with normalized addresses)
        return char;
    }

    // Handle negative rotations properly - add CHARSET.length to ensure positive result
    const newIndex = (index + rotation + CHARSET.length) % CHARSET.length;
    return CHARSET[newIndex];
}

/**
 * Obfuscate an address using rotating cipher
 *
 * @param {string} address - A normalized street address
 * @returns {string} Obfuscated address with embedded key
 */
export function obfuscateAddress(address) {
    if (!address || typeof address !== 'string') {
        return '';
    }

    if (!/^[0-9A-Z ]*$/.test(address)) {
        console.warn('Address contains invalid characters:', address);
        return address;
    }

    const rotation = getRandomRotation();

    // Get the key character (rotation amount encoded in charset)
    const keyChar = CHARSET[rotation];

    // Encrypt each character
    const encrypted = address
        .split('')
        .map(char => rotateChar(char, rotation))
        .join('');

    // Return key + encrypted string
    return keyChar + encrypted;
}

/**
 * Deobfuscate an address using embedded key
 *
 * @param {string} obfuscated - Obfuscated address with embedded key
 * @returns {string} Original address
 */
export function deobfuscateAddress(obfuscated) {
    if (!obfuscated || typeof obfuscated !== 'string' || obfuscated.length < 1) {
        return '';
    }

    try {
        // Extract key from first character
        const keyChar = obfuscated[0];
        const rotation = CHARSET.indexOf(keyChar);

        if (rotation === -1) {
            console.warn('Invalid key character:', keyChar);
            return '';
        }

        // Extract encrypted portion (skip first character)
        const encrypted = obfuscated.slice(1);

        // Decrypt by rotating backwards
        const decrypted = encrypted
            .split('')
            .map(char => rotateChar(char, -rotation))
            .join('');

        return decrypted;
    } catch (error) {
        console.warn('Failed to deobfuscate:', error);
        return '';
    }
}

/**
 * Obfuscate the entire distance cache.
 *
 * @param {Object} distances - Cache with address keys
 * @returns {Object} Cache with obfuscated keys
 */
function obfuscateAddresses(distances) {
    const obfuscated = {};

    for (const [originAddr, destinations] of Object.entries(distances)) {
        const obfOrigin = obfuscateAddress(originAddr);
        obfuscated[obfOrigin] = {};

        for (const [destAddr, distance] of Object.entries(destinations)) {
            const obfDest = obfuscateAddress(destAddr);
            obfuscated[obfOrigin][obfDest] = distance;
        }
    }

    return obfuscated;
}

/**
 * Deobfuscate the entire distance cache.
 *
 * @param {?Object} cache - Cache with obfuscated keys
 * @returns {Object} Cache with original address keys
 */
function deobfuscateAddresses(cache) {
    if (!cache) {
        return {};
    }
    const distances = {};

    for (const [obfOrigin, destinations] of Object.entries(cache)) {
        const originAddr = deobfuscateAddress(obfOrigin);
        distances[originAddr] = {};

        for (const [obfDest, distance] of Object.entries(destinations)) {
            const destAddr = deobfuscateAddress(obfDest);
            distances[originAddr][destAddr] = distance;
        }
    }

    return distances;
}

/**
 * Retrieve distances from localStorage.
 *
 * @returns {Object.<string, Object>} Distances to schools
 */
function loadDistances() {
    return deobfuscateAddresses(getStoredItem('distances'));
}

/**
 * Populate school data with distances from the given address.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {string} address - A street address
 * @returns {boolean} Whether we have stored distances for the given address
 */
export function populateDistances(schoolData, address) {
    const distances = loadDistances();
    address = normalizeAddress(address);
    if (!(address in distances)) {
        return false;
    }
    for (const school of schoolData) {
        school.distance = distances[address][normalizeAddress(school.address)];
    }
    return true;
}

/**
 * Save distances in localStorage.
 *
 * @param {Object.<string, Object>} distances - Distances to schools
 * @returns {boolean} Whether the operation proceeded without an exception
 */
export function storeDistances(distances) {
    distances = obfuscateAddresses(distances);
    if (storeItem('distances', distances)) {
        return true;
    }
    // Delete least recently used origin addresses.
    const addresses = Object.keys(distances);
    addresses.sort((a, b) => distances[a].timestamp - distances[b].timestamp);
    for (const address of addresses) {
        delete distances[address];
        if (storeItem('distances', distances)) {
            return true;
        }
    }
    return false;
}
