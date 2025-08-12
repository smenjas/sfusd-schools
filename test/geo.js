/**
 * Unit tests for geographic utility functions
 * @module test/geo
 */

import { azimuthToDirection,
         expandCoords,
         findAzimuth,
         findDirection,
         getCoordsURL,
         getDirectionsURL,
         getMapURL,
         howFar,
         isBikeable,
         isWalkable,
         latToMiles,
         lonToMiles,
         lonToMilesFactor,
         metersToMiles } from '../public/geo.js';
import Test from '../scripts/test.js';

export default class GeoTest {
    static azimuthToDirection() {
        const tests = [
            [[0], 'N'],
            [[45], 'NE'],
            [[90], 'E'],
            [[135], 'SE'],
            [[180], 'S'],
            [[225], 'SW'],
            [[270], 'W'],
            [[315], 'NW'],
        ];
        return Test.run(azimuthToDirection, tests);
    }

    static expandCoords() {
        const tests = [
            [[[7783, 5142]], ['37.7783', '-122.5142']],
        ];
        return Test.run(expandCoords, tests);
    }

    static findAzimuth() {
        const tests = [
            [[[0, 0], [1, 0]], 0],
            [[[0, 0], [0, 1]], 90],
            [[[0, 0], [-1, 0]], 180],
            [[[0, 0], [0, -1]], 270],
        ];
        return Test.run(findAzimuth, tests);
    }

    static findDirection() {
        const tests = [
            [[[0, 0], [1, 0]], 'N'],
            [[[0, 0], [1, 1]], 'NE'],
            [[[0, 0], [0, 1]], 'E'],
            [[[0, 0], [-1, 1]], 'SE'],
            [[[0, 0], [-1, 0]], 'S'],
            [[[0, 0], [-1, -1]], 'SW'],
            [[[0, 0], [0, -1]], 'W'],
            [[[0, 0], [1, -1]], 'NW'],
        ];
        return Test.run(findDirection, tests);
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

    static metersToMiles() {
        const tests = [
            [[1609.3444978925634], 1],
        ];
        return Test.run(metersToMiles, tests);
    }
}
