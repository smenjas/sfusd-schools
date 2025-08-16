/**
 * Run automated tests.
 * @module scripts/test
 */

import AddressTest from '../test/address.js';
import GeoTest from '../test/geo.js';
import PathTest from '../test/path.js';
import SortTest from '../test/sort.js';
import StringTest from '../test/string.js';
import TestTest from '../test/test.js';

/**
 * Run automated tests.
 */
export default class Test {
    /**
     * Compare two values.
     * @todo Compare weak maps, weak sets, and typed arrays.
     *
     * @param {null|undefined|boolean|number|bigint|string|Array|Map|Object|Set} a - A value
     * @param {null|undefined|boolean|number|bigint|string|Array|Map|Object|Set} b - A value
     * @returns {boolean} True if the values are equal
     */
    static compare(a, b) {
        if (a === b) {
            return true;
        }
        if (Number.isNaN(a) && Number.isNaN(b)) {
            return true;
        }
        if (typeof a !== typeof b) {
            return false;
        }
        if (Array.isArray(a)) {
            return Test.compareArrays(a, b);
        }
        if (a instanceof Map) {
            return Test.compareMaps(a, b);
        }
        if (a instanceof Set) {
            return Test.compareSets(a, b);
        }
        if (Test.isObject(a)) {
            return Test.compareObjects(a, b);
        }
        return false;
    }

    /**
     * Compare two arrays.
     *
     * @param {Array} a - An array
     * @param {Array} b - An array
     * @returns {boolean} True if the arrays are equal
     */
    static compareArrays(a, b) {
        if (!Array.isArray(a)) {
            return false;
        }
        if (!Array.isArray(b)) {
            return false;
        }
        if (a.length !== b.length) {
            return false;
        }
        for (const key in a) {
            if (!Test.compare(a[key], b[key])) {
                return false;
            }
        }
        return true;
    }

    /**
     * Compare two maps, to see if they contain the same properties.
     *
     * @param {Map} a - A map
     * @param {Map} b - A map
     * @returns {boolean} True if the maps' contents are equal
     */
    static compareMaps(a, b) {
        if (!(a instanceof Map)) {
            return false;
        }
        if (!(b instanceof Map)) {
            return false;
        }
        if (a.size !== b.size) {
            return false;
        }
        for (const [key, value] of a) {
            if (!b.has(key)) {
                return false;
            }
            if (!Test.compare(a.get(key), b.get(key))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Compare two objects, to see if they contain the same properties.
     *
     * @param {Object} a - An object
     * @param {Object} b - An object
     * @returns {boolean} True if the objects' contents are equal
     */
    static compareObjects(a, b) {
        if (!Test.isObject(a)) {
            return false;
        }
        if (!Test.isObject(b)) {
            return false;
        }
        if (Object.keys(a).length !== Object.keys(b).length) {
            return false;
        }
        for (const key in a) {
            if (!(key in b)) {
                return false;
            }
            if (!Test.compare(a[key], b[key])) {
                return false;
            }
        }
        return true;
    }

    /**
     * Compare two sets, to see if they contain the same elements.
     *
     * @param {Set} a - A set
     * @param {Set} b - A set
     * @returns {boolean} True if the sets are equal
     */
    static compareSets(a, b) {
        if (!(a instanceof Set)) {
            return false;
        }
        if (!(b instanceof Set)) {
            return false;
        }
        if (a.size !== b.size) {
            return false;
        }
        for (const value of a) {
            if (!b.has(value)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Determine whether the input is an object.
     *
     * @param {null|undefined|boolean|number|bigint|string|Array|Map|Object|Set|Symbol|WeakMap|WeakSet} obj - Anything
     * @returns {boolean} Whether the input is an object
     */
    static isObject(obj) {
        // Handle undefined, booleans, numbers, NaN, bigints, strings, and symbols.
        if (typeof obj !== 'object') {
            return false;
        }
        // Handle null.
        if (!(obj instanceof Object)) {
            return false;
        }
        if (Array.isArray(obj)) {
            return false;
        }
        if (obj instanceof Map) {
            return false;
        }
        if (obj instanceof Set) {
            return false;
        }
        if (obj instanceof WeakMap) {
            return false;
        }
        if (obj instanceof WeakSet) {
            return false;
        }
        return true;
    }

    /**
     * Run automated tests.
     *
     * @returns {integer} How many tests failed
     */
    static runAll() {
        console.time('Test.runAll()');

        const methods = [
            AddressTest.abbrNumberedStreets,
            AddressTest.compareAddresses,
            AddressTest.fixNumberedStreets,
            AddressTest.normalizeAddress,
            AddressTest.prettifyAddress,
            AddressTest.replaceStreetSuffixes,
            AddressTest.splitStreetAddress,
            GeoTest.expandCoords,
            GeoTest.getCoordsURL,
            GeoTest.getDirectionsURL,
            GeoTest.getMapURL,
            GeoTest.howFar,
            GeoTest.isBikeable,
            GeoTest.isWalkable,
            GeoTest.latToMiles,
            GeoTest.latToMilesFactor,
            GeoTest.lonToMiles,
            GeoTest.lonToMilesFactor,
            PathTest.findPathToSchool,
            PathTest.findSchoolDistances,
            PathTest.getAddressCoords,
            PathTest.getJunctionCoords,
            PathTest.getStreetJunctions,
            PathTest.howFarAddresses,
            PathTest.nameCNN,
            PathTest.sumDistances,
            SortTest.sortSchools,
            StringTest.capitalize,
            StringTest.capitalizeWords,
            StringTest.compressWhitespace,
            StringTest.encodeURLParam,
            StringTest.removeAccents,
            StringTest.removePunctuation,
            TestTest.compare,
            TestTest.compareArrays,
            TestTest.compareMaps,
            TestTest.compareObjects,
            TestTest.compareSets,
            TestTest.isObject,
        ];

        let failures = 0;
        for (const method of methods) {
            failures += method();
        }

        console.timeEnd('Test.runAll()');
        return failures;
    }

    /**
     * Run automated tests for a given function or method.
     *
     * @param {Array} tests - Inputs and the expected output
     * @returns {integer} How many tests failed
     */
    static run(method, tests) {
        console.time(method.name);
        let failed = 0;
        for (const test of tests) {
            const [args, expected] = test;
            const actual = method(...args);
            const result = Test.compare(expected, actual);
            console.assert(result, `${method.name}(`, ...args, '):', {actual, expected});
            failed += !result;
        }
        console.timeEnd(method.name);
        return failed;
    }
}
