/**
 * Geographic utility functions
 * @module public/geo
 */

/**
 * Decimal degrees latitude, decimal degrees longitude, and a segment fraction
 *
 * A segment fraction is number from 0 to 1 (inclusive) that represents how far
 * a point on a line is between two other points on the same line.
 *
 * For example, given 2 points A and B, and a line segment between them AB, let
 * point D be a point on that line segment. Let's call the segment fraction T.
 * - If D is A, then T is 0.
 * - If D is B, then T is 1.
 * - If D is halfway between A and B, then T is 0.5.
 * - If D is a quarter of the way from A to B, then T is 0.25.
 *
 * @typedef {Array.<number>} LatLonFrac
 */

import { getAddressCoords, getJunctionCoords } from './path.js';
import { encodeURLParam } from './string.js';

/**
 * Convert an azimuth to a cardinal direction.
 *
 * @param {?number} azimuth - An azimuth, in degrees
 * @returns {?string} A cardinal direction (N, NE, E, etc.)
 */
export function azimuthToDirection(azimuth) {
    if (isNaN(azimuth)) {
        return null;
    }
    azimuth %= 360;
    if (azimuth < 22.5) return 'N';
    if (azimuth < 67.5) return 'NE';
    if (azimuth < 112.5) return 'E';
    if (azimuth < 157.5) return 'SE';
    if (azimuth < 202.5) return 'S';
    if (azimuth < 247.5) return 'SW';
    if (azimuth < 292.5) return 'W';
    if (azimuth < 337.5) return 'NW';
    return 'N';
}

/**
 * Calculate the angle of a line from (0, 0) to the given coordinates, relative
 * to the x-axis. Please note: this assumes a cartesian coordinate system, not
 * geographic coordinates. For geographic coordinates, swap the arguments.
 *
 * @param {number} x - The x component
 * @param {number} y - The y component
 * @returns {number} The angle in radians
 */
function calcAngle(x, y) {
    return Math.atan2(y, x);
}

/**
 * Calculate the angle of coordinates, relative to (0, 0).
 *
 * @param {number} x - The x component
 * @param {number} y - The y component
 * @returns {number} The angle in degrees
 */
function calcAngleDegrees(x, y) {
    return radiansToDegrees(calcAngle(x, y));
}

/**
 * Convert degrees to radians.
 *
 * @param {number} degrees
 * @returns {number} Radians
 */
export function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Expand the decimal portion of geographic coordinates to include the whole
 * numbers for San Francisco, California: 37°N, 122°W.
 *
 * @param {?LatLonDecimals} coords - Decimal portion of ° latitude, longitude
 * @returns {?LatLon} Degrees latitude and longitude
 */
export function expandCoords(coords) {
    if (!coords) {
        return null;
    }
    if (!Array.isArray(coords) || coords.length < 2) {
        console.warn('Invalid geographic coordinates:', coords);
        return null;
    }
    const [lat, lon] = coords;
    return [`37.${lat}`, `-122.${lon}`];
}

/**
 * Find the projection point from an address to a street segment.
 *
 * @example
 * import addressData from './address-data.js';
 * import jcts from './junctions.js';
 * const result = findAddressProjection(addressData, jcts, 27187, 27188, '100 John F Kennedy Dr');
 * // Returns: [ 37.771520592913014, -122.46045492238001, 0.55192997231347 ]
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefix} cnnA - An intersection
 * @param {CNNPrefix} cnnB - An intersection
 * @param {string} address - A street address
 * @returns {?LatLonFrac} Degrees latitude and longitude
 */
export function findAddressProjection(addressData, jcts, cnnA, cnnB, address) {
    const a = getJunctionCoords(jcts, cnnA);
    const b = getJunctionCoords(jcts, cnnB);
    const c = getAddressCoords(addressData, address, true);

    return findProjectionPoint(a, b, c);
}

/**
 * Find the angle of the line between two sets of coordinates.
 *
 * @param {?LatLon} a - Decimal degrees latitude and longitude
 * @param {?LatLon} b - Decimal degrees latitude and longitude
 * @returns {?number} An azimuth, in degrees
 */
export function findAzimuth(a, b) {
    const components = howFarComponents(a, b);
    if (!components) {
        return null;
    }
    const [x, y] = components;
    // Swap the arguments, since we want the angle relative to north.
    let degrees = calcAngleDegrees(y, x);
    while (degrees < 0) {
        degrees += 360;
    }
    return degrees;
}

/**
 * Find the cardinal direction from one location to another.
 *
 * @param {?LatLon} a - Decimal degrees latitude and longitude
 * @param {?LatLon} b - Decimal degrees latitude and longitude
 * @returns {?string} A cardinal direction (N, NE, E, etc.)
 */
export function findDirection(a, b) {
    const azimuth = findAzimuth(a, b);
    return azimuthToDirection(azimuth);
}

/**
 * Find the projection point from an address to a street segment.
 *
 * Given 3 points A, B, and C, find the point D where:
 * - having drawn a line passing through A and B (call it AB),
 * - draw another line perpendicular to AB that passes through C;
 * - point D is where the perpendicular line intersects AB.
 *
 * @example
 * const a = ['37.73247', '-122.40127']; // Junction 27187
 * const b = ['37.73407', '-122.40286']; // Junction 27188
 * const c = ['37.7332', '-122.4016']; // 100 John F Kennedy Dr
 * const result = findProjectionPoint(a, b, c);
 * // Returns: [ 37.771520592913014, -122.46045492238001, 0.55192997231347 ]
 *
 * @param {?LatLon} a - Degrees latitude and longitude, for a street junction
 * @param {?LatLon} b - Degrees latitude and longitude, for a street junction
 * @param {?LatLon} c - Degrees latitude and longitude, for a street address
 * @returns {?LatLonFrac} Degrees latitude and longitude, and a segment fraction
 */
export function findProjectionPoint(a, b, c) {
    if (!a || !b || !c) {
        return null;
    }

    const [latA, lonA] = [parseFloat(a[0]), parseFloat(a[1])];
    const [latB, lonB] = [parseFloat(b[0]), parseFloat(b[1])];
    const [latC, lonC] = [parseFloat(c[0]), parseFloat(c[1])];

    const meanLat = (latA + latB + latC) / 3;

    // Vector from A to B
    const yAB = latToMiles(latB - latA);
    const xAB = lonToMiles(lonB - lonA, meanLat);

    // Vector from A to C
    const yAC = latToMiles(latC - latA);
    const xAC = lonToMiles(lonC - lonA, meanLat);

    // Calculate the hypotenuse
    const abSquared = xAB * xAB + yAB * yAB;

    if (abSquared === 0) {
        // A and B are the same point
        return [latA, lonA, 0];
    }

    // Calculate parameter t (0 = at A, 1 = at B)
    const t = (xAC * xAB + yAC * yAB) / abSquared;

    // Clamp t to [0, 1] to stay within the line segment
    const clampedT = Math.max(0, Math.min(1, t));

    // Calculate the projection point
    const milesY = clampedT * yAB;
    const milesX = clampedT * xAB;

    const yt = milesY / latToMilesFactor();
    const xt = milesX / lonToMilesFactor(meanLat);

    const lonD = lonA + xt;
    const latD = latA + yt;

    return [latD, lonD, clampedT];
}

/**
 * Generate a Google Maps URL, for latitude and longitude.
 *
 * @param {?LatLon} coords - Decimal degrees latitude and longitude
 * @returns {string} A URL
 */
export function getCoordsURL(coords) {
    if (!coords) {
        return '';
    }
    return getMapURL(coords.join(','));
}

/**
 * Generate a Google Maps URL for directions.
 *
 * @param {string} fro - The search terms for the origin
 * @param {string} to - The search terms for the destination
 * @returns {string} A URL
 */
export function getDirectionsURL(fro, to) {
    if (fro === '' || to === '') {
        return '';
    }
    fro = encodeURLParam(fro, true);
    to = encodeURLParam(to, true);
    return `https://www.google.com/maps/dir/${fro}/${to}`;
}

/**
 * Generate a Google Maps URL.
 *
 * @param {string} search - The search terms for a place
 * @returns {string} A URL
 */
export function getMapURL(search) {
    if (search === '') {
        return '';
    }
    search = encodeURLParam(search, true);
    return `https://www.google.com/maps/search/${search}`;
}

/**
 * Calculate the distance between two sets of geographic coordinates.
 *
 * @param {?LatLon} a - Decimal degrees latitude and longitude
 * @param {?LatLon} b - Decimal degrees latitude and longitude
 * @returns {?number} Distance in miles
 */
export function howFar(a, b) {
    const components = howFarComponents(a, b);
    if (!components) {
        return null;
    }
    const x = Math.abs(components[0]);
    const y = Math.abs(components[1]);
    return Math.sqrt((x ** 2) + (y ** 2));
}

/**
 * Calculate the distance between two locations, in separate horizontal and
 * vertical components.
 *
 * @param {?LatLon} a - Decimal degrees latitude and longitude
 * @param {?LatLon} b - Decimal degrees latitude and longitude
 * @returns {?Array.<number>} Distances in miles
 */
function howFarComponents(a, b) {
    if (!a || !b) {
        return null;
    }
    const latDiff = b[0] - a[0];
    const lonDiff = b[1] - a[1];
    const latMean = (parseFloat(a[0]) + parseFloat(b[0])) / 2;
    const y = latToMiles(latDiff);
    const x = lonToMiles(lonDiff, latMean);
    return [x, y];
}

/**
 * Determine whether a destination is within biking distance.
 *
 * @param {number} miles - A distance in miles
 * @returns {boolean} Whether the distance is bikeable
 */
export function isBikeable(miles) {
    // Most people bike 5-10 MPH. You can ride 2.25 miles within 15 minutes at
    // 9 MPH, and within 20 minutes at 6.75 MPH.
    return miles <= 2.25;
}

/**
 * Determine whether a destination is within walking distance.
 *
 * @param {number} miles - A distance in miles
 * @returns {boolean} Whether the distance is walkable
 */
export function isWalkable(miles) {
    // Most people walk 2-4 MPH. At 3 MPH, you can walk 0.75 miles in 15
    // minutes, and 1 mile within 20 minutes.
    return miles <= 1.0;
}

/**
 * Convert degrees of latitude to miles.
 *
 * This is roughly consistent everywhere on Earth's surface.
 *
 * @param {number} latDiff - The difference between two latitudes
 * @returns {number} Distance in miles
 */
export function latToMiles(latDiff) {
    return latToMilesFactor() * latDiff;
}

/**
 * Return how many miles there are per degree of latitude.
 *
 * @returns {number} Distance in miles
 */
export function latToMilesFactor() {
    return 69;
}

/**
 * Convert degrees of longitude to miles.
 *
 * This varies by distance from the equator.
 *
 * @param {number} lonDiff - The difference between two longitudes
 * @param {number} lat - Degrees latitude
 * @returns {number} Distance in miles
 */
export function lonToMiles(lonDiff, lat) {
    return lonToMilesFactor(lat) * lonDiff;
}

/**
 * Calculate how many miles there are per degree of longitude, given a certain
 * latitude. This varies by distance from the equator, as shown below.
 *
 * - 0°  69.0 Jakarta, Indonesia
 * - 10° 68.0 San Jose, Costa Rica
 * - 20° 64.8 Manila, Philippines
 * - 30° 59.8 Cairo, Egypt
 * - 40° 52.9 New York City, USA
 * - 50° 44.4 Brussels, Belgium
 * - 60° 34.5 St. Petersburg, Russia
 * - 70° 23.6 Tromsø, Norway
 * - 80° 12.0 Eureka, Canada
 * - 90°  0.0 North Pole
 *
 * In San Francisco, California this is:
 * 54.6 miles at 37.7080° (the southernmost address next to Daly City), and
 * 54.5 miles at 37.8318° (the northernmost address on Treasure Island), a
 * 0.2% difference.
 *
 * @param {number} lat - Degrees latitude
 * @returns {number} Distance in miles
 */
export function lonToMilesFactor(lat) {
    const radians = degreesToRadians(lat);
    return latToMilesFactor() * Math.cos(radians);
}

/**
 * Convert meters to miles.
 *
 * @param {number} meters - A distance in meters
 * @returns {number} A distance in miles
 */
export function metersToMiles(meters) {
    return meters * 0.000621371;
}

/**
 * Convert radians to degrees.
 *
 * @param {number} radians
 * @returns {number} Degrees
 */
function radiansToDegrees(radians) {
    return (radians * 180) / Math.PI;
}
