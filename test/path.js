/**
 * Unit tests for path finding functions
 * @module test/path
 */

import { describePath,
         findPathToSchool,
         findSchoolDistances,
         formatDistance,
         getStreetJunctions,
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
    'BACON ST': ['20638'],
    'GIRARD ST': ['20638', '20652'],
    'BURROWS ST': ['20652', '20653', '20889'],
    'BRUSSELS ST': ['20653'],
    'GOETTINGEN ST': ['20889']
}

const path = [20889, 20653, 20652, 20638];

const start = '423 Burrows St';
const end = '350 Girard St';
const school = { name: 'King', types: ['Middle'], address: end };
const schools = [school];
const distance = 0.28036880566031713;
const distances = { '350 GIRARD ST': distance };

const maps = '<a target="_blank" href="https://www.google.com/maps/';
let html = `<ol><li>Go <span title="71°">E</span> on ${maps}search/37.72806,-122.40706">Burrows St</a> 0.2 mi.</li>`;
html += `<li>Go <span title="162°">S</span> on ${maps}search/37.72857,-122.40509">Girard St</a> 305 ft.</li>`;
html += `<li>Arrive at ${maps}search/350+Girard+St">350 Girard St</a></li></ol>`;
html += `<p>Total: 0.3 mi. &#x1F6B6; Walkable</p>`;
html += `<p>${maps}dir/423+Burrows+St/350+Girard+St">Google Maps directions</a></p>`;

export default class PathTest {
    static describePath() {
        const tests = [
            [[addrs, jcts, path, start, end], html],
        ];
        return Test.run(describePath, tests);
    }

    static findPathToSchool() {
        // sortCNNs will sort the properties in place, which will make the
        // test(s) for getStreetJunctions() fail, so copy it.
        const streetJunctions = {};
        for (const st in stJcts) {
            streetJunctions[st] = Array.from(stJcts[st]);
        }
        const tests = [
            [[addrs, jcts, streetJunctions, {}, start, school], path],
        ];
        return Test.run(findPathToSchool, tests);
    }

    static findSchoolDistances() {
        const tests = [
            [[addrs, schools, jcts, start], distances],
        ];
        return Test.run(findSchoolDistances, tests);
    }

    static formatDistance() {
        const tests = [
            [[distances['350 GIRARD ST']], '0.3 mi.'],
            [[distances['350 GIRARD ST'], false], '0.3 mi.'],
            [[distances['350 GIRARD ST'], true], '0.3 mi. &#x1F6B6; Walkable'],
        ];
        return Test.run(formatDistance, tests);
    }

    static getStreetJunctions() {
        const tests = [
            [[jcts], stJcts],
        ];
        return Test.run(getStreetJunctions, tests);
    }

    static nameCNN() {
        const tests = [
            [[jcts, path[0]], 'Burrows St & Goettingen St'],
        ];
        return Test.run(nameCNN, tests);
    }

    static sumDistances() {
        const tests = [
            [[addrs, jcts, path, start, end], distance],
        ];
        return Test.run(sumDistances, tests);
    }
}
