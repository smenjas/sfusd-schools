/**
 * Shared functions
 * @module public/common
 */

import { normalizeAddress } from './address.js';

/**
 * Convert an array to a map.
 *
 * @param {Array} array - An array
 * @returns A map object
 */
export function arrayToMap(array) {
    if (!Array.isArray(array)) {
        return array;
    }
    const map = new Map();
    for (const value of array) {
        map.set(value, value);
    }
    return map;
}

/**
 * Find a school by name and type.
 *
 * @param {Schools} schoolData - All SF public schools
 * @param {string} name - A school name, e.g. "Lowell"
 * @param {string} type - A school type, e.g. "High"
 * @returns {School} Data about a school
 */
export function findSchool(schoolData, name, type) {
    for (const school of schoolData) {
        if (school.name === name && school.types.includes(type)) {
            return school;
        }
    }
}

/**
 * Get the default values for the form inputs.
 *
 * @returns {Object} Default form inputs
 */
export function getDefaultInputs() {
    return {
        address: '',
        menus: {
            sort: 'name',
            type: '',
            grade: '',
            neighborhood: '',
            start: '',
            language: '',
            target: '',
            within: '',
        },
    };
}

/**
 * Retrieve an item from localStorage.
 *
 * @param {string} name - The item's name
 * @returns {*} The item
 */
export function getStoredItem(name) {
    try {
        const json = localStorage.getItem(name);
        if (!json) {
            return;
        }
        return json ? JSON.parse(json) : json;
    }
    catch (error) {
        console.error('Cannot read from localStorage:', error);
    }
}

/**
 * Populate school data with distances from the given address.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {string} address - A street address
 * @returns {boolean} Whether we have stored distances for the given address
 */
export function populateDistances(schoolData, address) {
    const distances = getStoredItem('distances') || {};
    address = normalizeAddress(address);
    if (!(address in distances)) {
        return false;
    }
    for (const school of schoolData) {
        const type = school.types[0];
        school.distance = distances[address][type][school.name];
    }
    return true;
}

/**
 * Split a school's description into a name and a type.
 *
 * @param {string} desc - A school's description, e.g. "Lowell High"
 * @returns {Array.<string>} A school's name and type
 */
export function splitSchoolDescription(desc) {
    const early = 'Early Education';
    if (desc.endsWith(early)) {
        const type = early;
        const name = desc.replace(early, '').trim();
        return [name, type];
    }
    const parts = desc.split(' ');
    const type = parts.pop();
    const name = parts.join(' ');
    return [name, type];
}

/**
 * Save an item in localStorage.
 *
 * @param {string} name - The item's name
 * @param {*} The item
 * @returns {boolean} Whether the operation proceeded without an exception
 */
export function storeItem(name, item) {
    try {
        localStorage.setItem(name, JSON.stringify(item));
        return true;
    }
    catch (error) {
        console.error('Cannot write to localStorage:', error);
        return false;
    }
}
