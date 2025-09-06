/**
 * Given 3 points A, B, and C, find the point D where:
 * - having drawn a line passing through A and B (call it AB),
 * - draw another line perpendicular to AB that passes through C;
 * - point D is where the perpendicular line intersects AB.
 */

import { latToMiles,
         latToMilesFactor,
         lonToMiles,
         lonToMilesFactor } from './geo.js';
import { getAddressCoords, getJunctionCoords } from './path.js';

/**
 * Decimal degrees latitude, decimal degrees longitude, and a segment fraction.
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

/**
 * Find the projection point from an address to a street segment.
 *
 * @example
 * import addressData from './address-data.js';
 * import jcts from './junctions.js';
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

    console.log({a, b, c});

    return findProjectionPoint(a, b, c);
}
