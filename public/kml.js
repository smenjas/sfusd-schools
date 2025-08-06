/**
 * Generate KML (Keyhole Markup Language) files.
 * @module public/kml
 */

import { prettifyAddress } from './address.js';
import { getAddressCoords,
         getJunctionCoords } from './geo.js';
import { findPathToSchool,
         getStreetJunctions,
         nameCNN } from './path.js';
import { encode, removeAccents, removePunctuation } from './string.js';

/**
 * Download a KML file.
 *
 * @param {string} kml - The file contents, KML format
 * @param {string} filename - The filename: unsanitized, no extension
 */
export function downloadKML(kml, filename) {
    if (typeof document === 'undefined') {
        return;
    }
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    filename = removeAccents(filename);
    filename = removePunctuation(filename);
    a.download = `${filename}.kml`.replace(/\s+/g, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Generate waypoints.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @returns {Array.<Object>} Waypoints
 */
export function getPathWaypoints(addressData, jcts, path, start, end) {
    const startLl = getAddressCoords(addressData, start);
    const endLl = getAddressCoords(addressData, end);

    let n = 1;
    const startPretty = prettifyAddress(start);
    const endPretty = prettifyAddress(end);
    const wpts = [{ ll: startLl, name: n++, description: startPretty, sym: 'Start' }];
    for (const cnn of path) {
        wpts.push({
            ll: getJunctionCoords(jcts, cnn),
            name: n++,
            description: nameCNN(jcts, cnn),
            sym: 'Intersection',
        });
    }
    wpts.push({ ll: endLl, name: n, description: endPretty, sym: 'End' });
    return wpts;
}

/**
 * Generate a KML (Keyhole Markup Language) waypoint.
 *
 * @param {Object.<string, string>} wpt - A waypoint
 * @returns {Object.<string, number>} Coordinates
 */
export function getWaypointCoords(wpt) {
    if (!wpt) {
        return null;
    }
    let lat, lon;
    if ('ll' in wpt && Array.isArray(wpt.ll)) {
        lat = wpt.ll[0];
        lon = wpt.ll[1];
    }
    else if ('lat' in wpt && 'lon' in wpt)  {
        lat = wpt.lat;
        lon = wpt.lon;
    }
    else {
        console.warn('Waypoint lacks latitude and longitude!');
        return null;
    }
    if (isNaN(lat)) {
        console.warn('Waypoint latitude is not a number:', lat);
        return null;
    }
    if (isNaN(lon)) {
        console.warn('Waypoint longitude is not a number:', lon);
        return null;
    }
    const ele = ('ele' in wpt) ? wpt.ele : 0;
    if (isNaN(ele)) {
        console.warn('Waypoint elevation is not a number:', ele);
        return null;
    }
    return { lat, lon, ele };
}

/**
 * Generate a KML (Keyhole Markup Language) waypoint.
 *
 * @param {Object.<string, string>} wpt - A waypoint
 * @returns {string} KML
 */
export function kmlWaypoint(wpt) {
    if (!wpt) {
        return null;
    }
    const { lat, lon, ele } = getWaypointCoords(wpt);
    const safeLat = encode(lat);
    const safeLon = encode(lon);
    const safeEle = encode(ele);
    let xml = '  <Placemark>\n';
    Object.getOwnPropertyNames(wpt).forEach(key => {
        if (key === 'll' || key === 'lat' || key === 'lon' || key === 'ele') {
            return;
        }
        const safeKey = encode(key);
        const safeValue = encode(wpt[key]);
        xml += `    <${safeKey}>${safeValue}</${safeKey}>\n`;
    });
    xml += `    <Point><coordinates>${safeLon},${safeLat},${safeEle}</coordinates></Point>\n`;
    xml += '  </Placemark>\n';
    return xml;
}

/**
 * Generate a KML (Keyhole Markup Language) path.
 *
 * @param {Array.<Object>} wpts - Waypoints
 * @param {string} [name=''] - The path name (optional)
 * @returns {string} KML
 */
export function kmlLineString(wpts, name = '') {
    if (!wpts) {
        return null;
    }
    let xml = '  <Placemark>\n';
    if (name !== '') {
        xml += `    <name>${encode(name)}</name>\n`;
    }
    xml += '    <LineString>\n';
    xml += '      <altitudeMode>clampToGround</altitudeMode>\n';
    xml += '      <extrude>1</extrude>\n';
    xml += '      <tessellate>1</tessellate>\n';
    xml += '      <coordinates>\n';
    for (const wpt of wpts) {
        const { lat, lon, ele } = getWaypointCoords(wpt);
        const safeLat = encode(lat);
        const safeLon = encode(lon);
        const safeEle = encode(ele);
        xml += `        ${safeLon},${safeLat},${safeEle}\n`;
    }
    xml += '      </coordinates>\n';
    xml += '    </LineString>\n';
    xml += '  </Placemark>\n';
    return xml;
}

/**
 * Generate a KML (Keyhole Markup Language) file.
 *
 * @param {Array.<Object>} wpts - Waypoints
 * @param {string} [name=''] - The document name (optional)
 * @returns {string} KML
 */
export function kmlDoc(wpts, name = '') {
    if (!wpts) {
        return null;
    }
    const ns = 'http://www.opengis.net/kml/2.2';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<kml xmlns="${ns}">\n`;
    xml += '<Document>\n';
    if (name !== '') {
        xml += `  <name>${encode(name)}</name>\n`;
    }
    xml += '  <open>0</open>\n';
    for (const wpt of wpts) {
        xml += kmlWaypoint(wpt);
    }
    xml += kmlLineString(wpts, name);
    xml += '</Document>\n';
    xml += '</kml>';
    return xml;
}

/**
 * Output a KML (Keyhole Markup Language) file.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {string} start - The starting street address
 * @param {School} school - Data about a school
 */
export function logKML(addressData, jcts, start, school) {
    console.log(makeKML(addressData, jcts, start, school));
}

/**
 * Generate a KML (Keyhole Markup Language) file.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {string} start - The starting street address
 * @param {School} school - Data about a school
 * @returns {string} XML
 */
export function makeKML(addressData, jcts, start, school) {
    const stJcts = getStreetJunctions(jcts);
    const path = findPathToSchool(addressData, jcts, stJcts, {}, start, school);
    const end = school.address;
    const place = `${school.name} ${school.types[0]}`;
    return makeGeoDoc(addressData, jcts, path, start, end, place);
}

/**
 * Generate a file that describes a journey.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @param {string} [place=''] - The name of the destination (optional)
 * @returns {string} XML
 */
export function makeGeoDoc(addressData, jcts, path, start, end, place = '') {
    const startPretty = prettifyAddress(start);
    const endPretty = (place !== '') ? place : prettifyAddress(end);
    const name = `${startPretty} to ${endPretty}`;
    const wpts = getPathWaypoints(addressData, jcts, path, start, end);
    return kmlDoc(wpts, name);
}
