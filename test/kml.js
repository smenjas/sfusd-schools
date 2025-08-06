/**
 * Unit tests for KML functions
 * @module tests/kml
 */

import { getPathWaypoints,
         getWaypointCoords,
         kmlDoc,
         kmlLineString,
         kmlWaypoint,
         makeGeoDoc,
         makeKML } from '../public/kml.js';
import Test from '../scripts/test.js';

export default class KMLTest {
    static getPathWaypoints() {
        const tests = [
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
        ];
        return Test.run(kmlDoc, tests);
    }

    static kmlLineString() {
        const tests = [
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
        ];
        return Test.run(makeGeoDoc, tests);
    }

    static makeKML() {
        const tests = [
        ];
        return Test.run(makeKML, tests);
    }
}
