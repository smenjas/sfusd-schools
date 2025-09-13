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
    'BURROWS ST': { '423': [72783, 40733] },
    'GIRARD ST': { '350': [72777, 40549] },
};

const jcts = {
    20638: { ll: [72737, 40459], streets:['BACON ST', 'GIRARD ST'], adj: [20652] },
    20652: { ll: [72857, 40509], streets: ['BURROWS ST', 'GIRARD ST'], adj: [20638, 20653] },
    20653: { ll: [72832, 40608], streets: ['BRUSSELS ST', 'BURROWS ST'], adj: [20652, 20889] },
    20889: { ll: [72806, 40706], streets: ['BURROWS ST', 'GOETTINGEN ST'], adj: [20653] },
};

const path = [20889, 20653, 20652, 20638];

const wpts = [
    { ll: ['37.72783', '-122.40733'], name: 1, description: '423 Burrows St', sym: 'Start' },
    { ll: ['37.72806', '-122.40706'], name: 2, description: 'Burrows St & Goettingen St', sym: 'Intersection' },
    { ll: ['37.72832', '-122.40608'], name: 3, description: 'Brussels St & Burrows St', sym: 'Intersection' },
    { ll: ['37.72857', '-122.40509'], name: 4, description: 'Burrows St & Girard St', sym: 'Intersection' },
    { ll: ['37.72737', '-122.40459'], name: 5, description: 'Bacon St & Girard St', sym: 'Intersection' },
    { ll: ['37.72777', '-122.40549'], name: 6, description: '350 Girard St', sym: 'End' }
];

const line = `  <Placemark>
    <name>423 Burrows St to King Middle</name>
    <LineString>
      <altitudeMode>clampToGround</altitudeMode>
      <extrude>1</extrude>
      <tessellate>1</tessellate>
      <coordinates>
        -122.40733,37.72783,0
        -122.40706,37.72806,0
        -122.40608,37.72832,0
        -122.40509,37.72857,0
        -122.40459,37.72737,0
        -122.40549,37.72777,0
      </coordinates>
    </LineString>
  </Placemark>\n`;

const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>423 Burrows St to King Middle</name>
  <open>0</open>
  <Placemark>
    <name>1</name>
    <description>423 Burrows St</description>
    <sym>Start</sym>
    <Point><coordinates>-122.40733,37.72783,0</coordinates></Point>
  </Placemark>
  <Placemark>
    <name>2</name>
    <description>Burrows St &amp; Goettingen St</description>
    <sym>Intersection</sym>
    <Point><coordinates>-122.40706,37.72806,0</coordinates></Point>
  </Placemark>
  <Placemark>
    <name>3</name>
    <description>Brussels St &amp; Burrows St</description>
    <sym>Intersection</sym>
    <Point><coordinates>-122.40608,37.72832,0</coordinates></Point>
  </Placemark>
  <Placemark>
    <name>4</name>
    <description>Burrows St &amp; Girard St</description>
    <sym>Intersection</sym>
    <Point><coordinates>-122.40509,37.72857,0</coordinates></Point>
  </Placemark>
  <Placemark>
    <name>5</name>
    <description>Bacon St &amp; Girard St</description>
    <sym>Intersection</sym>
    <Point><coordinates>-122.40459,37.72737,0</coordinates></Point>
  </Placemark>
  <Placemark>
    <name>6</name>
    <description>350 Girard St</description>
    <sym>End</sym>
    <Point><coordinates>-122.40549,37.72777,0</coordinates></Point>
  </Placemark>
${line}</Document>
</kml>`;

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
        let xml = `  <Placemark>
    <Point><coordinates>-122.5142,37.7783,0</coordinates></Point>
  </Placemark>\n`;
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
