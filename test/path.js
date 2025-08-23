/**
 * Unit tests for path finding functions
 * @module test/path
 */

import { describePath,
         findPathToSchool,
         findSchoolDistances,
         formatDistance,
         getAddressCoords,
         getJunctionCoords,
         getStreetJunctions,
         howFarAddresses,
         nameCNN,
         sumDistances } from '../public/path.js';
import Test from '../scripts/test.js';

const addrs = {
    'BURROWS ST': { '423': [7278, 4073] },
    'GIRARD ST': { '350': [7278, 4055] },
};

const jcts = {
    20638: { ll: [72737, 40459], streets:['BACON ST', 'GIRARD ST'], adj: [20652] },
    20652: { ll: [72857, 40509], streets: ['BURROWS ST', 'GIRARD ST'], adj: [20638, 20653] },
    20653: { ll: [72832, 40608], streets: ['BRUSSELS ST', 'BURROWS ST'], adj: [20652, 20889] },
    20889: { ll: [72806, 40706], streets: ['BURROWS ST', 'GOETTINGEN ST'], adj: [20653] },
};

const stJcts = {
    'BURROWS ST': ['20650', '20652'],
    'GIRARD ST': ['20546', '20652'],
};

const path = [20889, 20653, 20652];

const start = '423 Burrows St';
const end = '350 Girard St';
const place = 'King Middle';
const name = `${start} to ${place}`;
const school = { name: 'King', types: ['Middle'], address: '350 Girard St' };

const maps = '<a target="_blank" href="https://www.google.com/maps/';
let html = `<ol><li>Go <span title="71°">E</span> on ${maps}search/37.72806,-122.40706">Burrows St</a> 715 ft.</li>`;
html += `<li>Go <span title="162°">S</span> on ${maps}search/37.72857,-122.40509">Girard St</a> 304 ft.</li>`;
html += `<li>Arrive at ${maps}search/350+Girard+St">350 Girard St</a></li></ol>`;
html += `<p>Total: 0.2 mi. &#x1F6B6; Walkable</p>`;
html += `<p>${maps}dir/423+BURROWS+ST/350+GIRARD+ST">Google Maps directions</a></p>`;

export default class PathTest {
    static describePath() {
        const tests = [
            [[addrs, jcts, path, start, end], html],
        ];
        return Test.run(describePath, tests);
    }

    static findPathToSchool() {
        const tests = [
            [[addrs, jcts, stJcts, {}, start, school], path],
        ];
        return Test.run(findPathToSchool, tests);
    }

    static findSchoolDistances() {
        const tests = [
        ];
        return Test.run(findSchoolDistances, tests);
    }

    static formatDistance() {
        const tests = [
        ];
        return Test.run(formatDistance, tests);
    }

    static getAddressCoords() {
        const tests = [
        ];
        return Test.run(getAddressCoords, tests);
    }

    static getJunctionCoords() {
        const tests = [
        ];
        return Test.run(getJunctionCoords, tests);
    }

    static getStreetJunctions() {
        const tests = [
        ];
        return Test.run(getStreetJunctions, tests);
    }

    static howFarAddresses() {
        const tests = [
        ];
        return Test.run(howFarAddresses, tests);
    }

    static nameCNN() {
        const tests = [
        ];
        return Test.run(nameCNN, tests);
    }

    static sumDistances() {
        const tests = [
        ];
        return Test.run(sumDistances, tests);
    }

}
