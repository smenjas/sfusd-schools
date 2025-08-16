/**
 * Unit tests for geographic utility functions
 * @module test/geo
 */

import { degreesToRadians,
         expandCoords,
         getCoordsURL,
         getDirectionsURL,
         getMapURL,
         howFar,
         isBikeable,
         isWalkable,
         latToMiles,
         latToMilesFactor,
         lonToMiles,
         lonToMilesFactor } from '../public/geo.js';
import Test from '../scripts/test.js';

export default class GeoTest {
    static degreesToRadians() {
        const tests = [
            [[], NaN],
            [[''], 0],
            [[0], 0],
            [[180], Math.PI],
        ];
        return Test.run(degreesToRadians, tests);
    }

    static expandCoords() {
        const tests = [
            [[[7783, 5142]], ['37.7783', '-122.5142']],
        ];
        return Test.run(expandCoords, tests);
    }

    static getCoordsURL() {
        const tests = [
            [[['37.7783', '-122.5142']], 'https://www.google.com/maps/search/37.7783,-122.5142'],
        ];
        return Test.run(getCoordsURL, tests);
    }

    static getDirectionsURL() {
        const prefix = 'https://www.google.com/maps/dir/';
        const tests = [
            [['3500 Great Hwy, 94132', '1220 Avenue M, 94132'], `${prefix}3500+Great+Hwy,+94132/1220+Avenue+M,+94132`],
        ];
        return Test.run(getDirectionsURL, tests);
    }

    static getMapURL() {
        const prefix = 'https://www.google.com/maps/search/';
        const tests = [
            [['443 Burnett Ave, 94131'], `${prefix}443+Burnett+Ave,+94131`],
        ];
        return Test.run(getMapURL, tests);
    }

    static howFar() {
        const tests = [
            [[[-1.5, -2.0], [1.5, 2.0]], 345],
        ];
        return Test.run(howFar, tests);
    }

    static isBikeable() {
        const tests = [
            [[2], true],
            [[3], false],
        ];
        return Test.run(isBikeable, tests);
    }

    static isWalkable() {
        const tests = [
            [[0.5], true],
            [[1.5], false],
        ];
        return Test.run(isWalkable, tests);
    }

    static latToMiles() {
        const tests = [
            [[1], 69],
        ];
        return Test.run(latToMiles, tests);
    }

    static latToMilesFactor() {
        const tests = [
            [[], 69],
        ];
        return Test.run(latToMilesFactor, tests);
    }

    static lonToMiles() {
        const tests = [
            [[1, 0], 69],
        ];
        return Test.run(lonToMiles, tests);
    }

    static lonToMilesFactor() {
        const tests = [
            [[0], 69],
        ];
        return Test.run(lonToMilesFactor, tests);
    }
}
