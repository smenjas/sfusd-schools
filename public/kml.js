/**
 * Generate KML (Keyhole Markup Language) files.
 * @module public/kml
 */

import { encode } from './string.js';

/**
 * Generate a KML (Keyhole Markup Language) waypoint.
 *
 * @param {Object.<string, string>} wpt - A waypoint
 * @returns {Object.<string, number>} Coordinates
 */
export function getWaypointCoords(wpt) {
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
        return '';
    }
    if (isNaN(lat)) {
        console.warn('Waypoint latitude is not a number:', lat);
        return '';
    }
    if (isNaN(lon)) {
        console.warn('Waypoint longitude is not a number:', lon);
        return '';
    }
    const ele = ('ele' in wpt) ? wpt.ele : 0;
    if (isNaN(ele)) {
        console.warn('Waypoint elevation is not a number:', ele);
        return '';
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
    const { lat, lon, ele } = getWaypointCoords(wpt);
    const safeLat = encode(lat);
    const safeLon = encode(lon);
    const safeEle = encode(ele);
    let xml = '\t<Placemark>\n';
    Object.getOwnPropertyNames(wpt).forEach(key => {
        if (key === 'll' || key === 'lat' || key === 'lon' || key === 'ele') {
            return;
        }
        const safeKey = encode(key);
        const safeValue = encode(wpt[key]);
        xml += `\t\t<${safeKey}>${safeValue}</${safeKey}>\n`;
    });
    xml += `\t\t<Point><coordinates>${safeLon},${safeLat},${safeEle}</coordinates></Point>\n`;
    xml += '\t</Placemark>\n';
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
    let xml = '\t<Placemark>\n';
    if (name !== '') {
        xml += `\t\t<name>${encode(name)}</name>\n`;
    }
    xml += '\t\t<LineString>\n';
    xml += '\t\t\t<altitudeMode>clampToGround</altitudeMode>\n';
    xml += '\t\t\t<extrude>1</extrude>\n';
    xml += '\t\t\t<tessellate>1</tessellate>\n';
    xml += '\t\t\t<coordinates>\n';
    for (const wpt of wpts) {
        const { lat, lon, ele } = getWaypointCoords(wpt);
        const safeLat = encode(lat);
        const safeLon = encode(lon);
        const safeEle = encode(ele);
        xml += `\t\t\t\t${safeLon},${safeLat},${safeEle}\n`;
    }
    xml += '\t\t\t</coordinates>\n';
    xml += '\t\t</LineString>\n';
    xml += '\t</Placemark>\n';
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
    const ns = 'http://www.opengis.net/kml/2.2';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<kml xmlns="${ns}">\n`;
    xml += '<Document>\n';
    if (name !== '') {
        xml += `\t<name>${encode(name)}</name>\n`;
    }
    xml += `\t<open>0</open>\n`;
    for (const wpt of wpts) {
        xml += kmlWaypoint(wpt);
    }
    xml += kmlLineString(wpts, name);
    xml += '</Document>\n';
    xml += '</kml>';
    return xml;
}
