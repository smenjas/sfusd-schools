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
            [[], ''],
            [[null], ''],
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
            [[], null],
            [[null, [0, 0]], null],
            [[[0, 0], null], null],
            [[[0, 0], [0, 0]], 0],
            [[[0, 0], [0, 1]], 69], // 1° of longitude at the equator
            [[[0, 0], [1, 0]], 69], // 1° of latitude, just north of the equator
            [[[-1.5, -2.0], [1.5, 2.0]], 345],
            [[[23.43594, 0], [23.43594, 1]], 63.307867470495445], // Tropic of Cancer
            [[[66.564056, 0], [66.564056, 1]], 27.442925480320344], // Arctic Circle
        ];
        return Test.run(howFar, tests);
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
