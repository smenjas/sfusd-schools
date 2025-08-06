/**
 * Unit tests for KML functions
 * @module test/kml
 */

import { getPathWaypoints,
         getWaypointCoords,
         kmlDoc,
         kmlLineString,
         kmlWaypoint,
         makeGeoDoc,
         makeKML } from '../public/kml.js';
import Test from '../scripts/test.js';

const addrs = {
    'BURROWS ST': { '423': [7278, 4073] },
    'GIRARD ST': { '350': [7278, 4055] },
};

const jcts = {
    20652: { ll: [72857, 40509], streets: ['BURROWS ST', 'GIRARD ST'], adj: [20653] },
    20653: { ll: [72832, 40608], streets: ['BRUSSELS ST', 'BURROWS ST'], adj: [20652, 20889] },
    20889: { ll: [72806, 40706], streets: ['BURROWS ST', 'GOETTINGEN ST'], adj: [20653] },
};

const path = [20889, 20653, 20652];

const wpts = [
    { ll: ['37.7278', '-122.4073'], name: 1, description: '423 Burrows St', sym: 'Start' },
    { ll: ['37.72806', '-122.40706'], name: 2, description: 'Burrows St & Goettingen St', sym: 'Intersection' },
    { ll: ['37.72832', '-122.40608'], name: 3, description: 'Brussels St & Burrows St', sym: 'Intersection' },
    { ll: ['37.72857', '-122.40509'], name: 4, description: 'Burrows St & Girard St', sym: 'Intersection' },
    { ll: ['37.7278', '-122.4055'], name: 5, description: '350 Girard St', sym: 'End' }
];

let line = '\t<Placemark>\n';
line += '\t\t<name>423 Burrows St to King Middle</name>\n';
line += '\t\t<LineString>\n';
line += '\t\t\t<altitudeMode>clampToGround</altitudeMode>\n';
line += '\t\t\t<extrude>1</extrude>\n';
line += '\t\t\t<tessellate>1</tessellate>\n';
line += '\t\t\t<coordinates>\n';
line += '\t\t\t\t-122.4073,37.7278,0\n';
line += '\t\t\t\t-122.40706,37.72806,0\n';
line += '\t\t\t\t-122.40608,37.72832,0\n';
line += '\t\t\t\t-122.40509,37.72857,0\n';
line += '\t\t\t\t-122.4055,37.7278,0\n';
line += '\t\t\t</coordinates>\n';
line += '\t\t</LineString>\n';
line += '\t</Placemark>\n';

let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
kml += '<Document>\n';
kml += '\t<name>423 Burrows St to King Middle</name>\n';
kml += '\t<open>0</open>\n';
kml += '\t<Placemark>\n';
kml += '\t\t<name>1</name>\n';
kml += '\t\t<description>423 Burrows St</description>\n';
kml += '\t\t<sym>Start</sym>\n';
kml += '\t\t<Point><coordinates>-122.4073,37.7278,0</coordinates></Point>\n';
kml += '\t</Placemark>\n';
kml += '\t<Placemark>\n';
kml += '\t\t<name>2</name>\n';
kml += '\t\t<description>Burrows St &amp; Goettingen St</description>\n';
kml += '\t\t<sym>Intersection</sym>\n';
kml += '\t\t<Point><coordinates>-122.40706,37.72806,0</coordinates></Point>\n';
kml += '\t</Placemark>\n';
kml += '\t<Placemark>\n';
kml += '\t\t<name>3</name>\n';
kml += '\t\t<description>Brussels St &amp; Burrows St</description>\n';
kml += '\t\t<sym>Intersection</sym>\n';
kml += '\t\t<Point><coordinates>-122.40608,37.72832,0</coordinates></Point>\n';
kml += '\t</Placemark>\n';
kml += '\t<Placemark>\n';
kml += '\t\t<name>4</name>\n';
kml += '\t\t<description>Burrows St &amp; Girard St</description>\n';
kml += '\t\t<sym>Intersection</sym>\n';
kml += '\t\t<Point><coordinates>-122.40509,37.72857,0</coordinates></Point>\n';
kml += '\t</Placemark>\n';
kml += '\t<Placemark>\n';
kml += '\t\t<name>5</name>\n';
kml += '\t\t<description>350 Girard St</description>\n';
kml += '\t\t<sym>End</sym>\n';
kml += '\t\t<Point><coordinates>-122.4055,37.7278,0</coordinates></Point>\n';
kml += '\t</Placemark>\n';
kml += line;
kml += '</Document>\n';
kml += '</kml>';

const start = '423 Burrows St';
const end = '350 Girard St';
const place = 'King Middle';
const name = `${start} to ${place}`;

export default class KMLTest {
    static getPathWaypoints() {
        const tests = [
            [[addrs, jcts, path, start, end], wpts],
        ];
        return Test.run(getPathWaypoints, tests);
    }

    static getWaypointCoords() {
        const tests = [
            [[], null],
            [[{}], null],
            [[{ll: ['37.7783', '-122.5142']}], {lat: '37.7783', lon: '-122.5142', ele: 0}],
            [[{ll: [37.7783, -122.5142]}], {lat: 37.7783, lon: -122.5142, ele: 0}],
            [[{lat: '37.7783', lon: '-122.5142'}], {lat: '37.7783', lon: '-122.5142', ele: 0}],
            [[{lat: 37.7783, lon: -122.5142}], {lat: 37.7783, lon: -122.5142, ele: 0}],
        ];
        return Test.run(getWaypointCoords, tests);
    }

    static kmlDoc() {
        const tests = [
            [[wpts, name], kml],
        ];
        return Test.run(kmlDoc, tests);
    }

    static kmlLineString() {
        const tests = [
            [[wpts, name], line],
        ];
        return Test.run(kmlLineString, tests);
    }

    static kmlWaypoint() {
        let xml = '\t<Placemark>\n';
        xml += '\t\t<Point><coordinates>-122.5142,37.7783,0</coordinates></Point>\n';
        xml += '\t</Placemark>\n';
        const tests = [
            [[{lat: '37.7783', lon: '-122.5142', ele: 0}], xml],
        ];
        return Test.run(kmlWaypoint, tests);
    }

    static makeGeoDoc() {
        const tests = [
            [[addrs, jcts, path, start, end, place], kml],
        ];
        return Test.run(makeGeoDoc, tests);
    }

    static makeKML() {
        const school = {
            name: 'King',
            types: ['Middle'],
            address: '350 Girard St',
        };
        const tests = [
            [[addrs, jcts, start, school], kml],
        ];
        return Test.run(makeKML, tests);
    }
}
