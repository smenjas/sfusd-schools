/**
 * Geographic utility functions
 * @module public/geo
 */

import { normalizeAddress, splitStreetAddress } from './address.js';
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
 * Get the geographic coordinates of a street address.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {string} address - A street address
 * @returns {?LatLon} Decimal degrees latitude and longitude
 */
export function getAddressCoords(addressData, address) {
    if (typeof address !== 'string') {
        return null;
    }
    address = normalizeAddress(address);
    const [num, street] = splitStreetAddress(address);
    if (!(street in addressData)) {
        console.log('Cannot find street:', street);
        return null;
    }
    if (!(num in addressData[street])) {
        console.log('Cannot find number:', num, 'on', street);
        return null;
    }
    return expandCoords(addressData[street][num]);
}

/**
 * Get the geographic coordinates for an intersection.
 *
 * @param {Junctions} junctions - All SF intersections
 * @param {CNNPrefix} cnn - An intersection
 * @returns {?LatLon} Decimal degrees latitude and longitude
 */
export function getJunctionCoords(junctions, cnn) {
    if (!(cnn in junctions)) {
        console.warn('getJunctionCoords():', cnn, 'not found');
        return null;
    }
    return expandCoords(junctions[cnn].ll);
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
 * @returns {number} Distance in miles
 */
export function howFar(a, b) {
    const components = howFarComponents(a, b);
    if (!components) {
        return Infinity;
    }
    const x = Math.abs(components[0]);
    const y = Math.abs(components[1]);
    return Math.sqrt((x * x) + (y * y));
}

/**
 * Calculate the distance between two locations, in separate horizontal and
 * vertical components.
 *
 * @param {?LatLon} a - Decimal degrees latitude and longitude
 * @param {?LatLon} b - Decimal degrees latitude and longitude
 * @returns {?Array.<number>} Distances in miles
 */
export function howFarComponents(a, b) {
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
 * Calculate the distance between two street addresses, as the crow flies.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @returns {number} Distance in miles
 */
export function howFarAddresses(addressData, start, end) {
    const startLl = getAddressCoords(addressData, start);
    const endLl = getAddressCoords(addressData, end);
    return howFar(startLl, endLl);
}

/**
 * Calculate the distance between a street address and an intersection,
 * as the crow flies.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} junctions - All SF intersections
 * @param {string} address - A street address
 * @param {CNNPrefix} cnn - An intersection
 * @returns {number} Distance in miles
 */
export function howFarAddressToJunction(addressData, junctions, address, cnn) {
    const addrLl = getAddressCoords(addressData, address);
    const jctLl = getJunctionCoords(junctions, cnn);
    return howFar(addrLl, jctLl);
}

/**
 * Calculate the distance between two intersections, as the crow flies.
 *
 * @param {Junctions} junctions - All SF intersections
 * @param {CNNPrefix} start - An intersection
 * @param {CNNPrefix} end - An intersection
 * @returns {number} Distance in miles
 */
export function howFarJunctions(junctions, start, end) {
    const startLl = getJunctionCoords(junctions, start);
    const endLl = getJunctionCoords(junctions, end);
    return howFar(startLl, endLl);
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
 * Convert radians to degrees.
 *
 * @param {number} radians
 * @returns {number} Degrees
 */
function radiansToDegrees(radians) {
    return (radians * 180) / Math.PI;
}
