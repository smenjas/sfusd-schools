/**
 * Unit tests for geographic utility functions
 * @module test/geo
 */

import { azimuthToDirection,
         degreesToRadians,
         expandCoords,
         findAzimuth,
         findDirection,
         getAddressCoords,
         getCoordsURL,
         getDirectionsURL,
         getJunctionCoords,
         getMapURL,
         howFar,
         howFarComponents,
         howFarAddresses,
         isBikeable,
         isWalkable,
         latToMiles,
         latToMilesFactor,
         lonToMiles,
         lonToMilesFactor } from '../public/geo.js';
import Test from '../scripts/test.js';

const addrs = {
    'BURROWS ST': { '423': [7278, 4073] },
    'GIRARD ST': { '350': [7278, 4055] },
};

const jcts = {
    20889: { ll: [72806, 40706], streets: ['BURROWS ST', 'GOETTINGEN ST'], adj: [20653] },
};

const start = '423 Burrows St';
const end = '350 Girard St';

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

    static getAddressCoords() {
        const tests = [
            [[addrs], null],
            [[addrs, '123 Fake St'], null],
            [[addrs, start], ['37.7278', '-122.4073']],
            [[addrs, end], ['37.7278', '-122.4055']],
        ];
        return Test.run(getAddressCoords, tests);
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

    static getJunctionCoords() {
        const tests = [
            [[jcts, 0], null],
            [[jcts, 20889], ['37.72806', '-122.40706']],
        ];
        return Test.run(getJunctionCoords, tests);
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
            [[], Infinity],
            [[null, [0, 0]], Infinity],
            [[[0, 0], null], Infinity],
            [[[0, 0], [0, 0]], 0],
            [[[0, 0], [0, 1]], 69], // 1° of longitude at the equator
            [[[0, 0], [1, 0]], 69], // 1° of latitude, above the equator
            [[[-1.5, -2.0], [1.5, 2.0]], 345],
            [[[23.435944, 0], [23.435944, 1]], 63.307865554617976], // Tropic of Cancer
            [[[66.564056, 0], [66.564056, 1]], 27.442925480320344], // Arctic Circle
        ];
        return Test.run(howFar, tests);
    }

    static howFarComponents() {
        const tests = [
            [[], null],
            [[null, [0, 0]], null],
            [[[0, 0], null], null],
            [[[0, 0], [0, 0]], [0, 0]],
            [[[0, 0], [0, 1]], [69, 0]], // 1° of longitude at the equator
            [[[0, 0], [1, 0]], [0, 69]], // 1° of latitude, above the equator
            [[[-1.5, -2.0], [1.5, 2.0]], [276, 207]],
            [[[23.435944, 0], [23.435944, 1]], [63.307865554617976, 0]], // Tropic of Cancer
            [[[66.564056, 0], [66.564056, 1]], [27.442925480320344, 0]], // Arctic Circle
        ];
        return Test.run(howFarComponents, tests);
    }

    static howFarAddresses() {
        const tests = [
            [[addrs], Infinity],
            [[addrs, start], Infinity],
            [[addrs, start, end], 0.09823309936777064],
        ];
        return Test.run(howFarAddresses, tests);
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
