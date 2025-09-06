/**
 * Given 3 points A, B, and C, find the point D where:
 * - having drawn a line passing through A and B (call it AB),
 * - draw another line perpendicular to AB that passes through C;
 * - point D is where the perpindicular line intersects AB.
 */

import { getAddressCoords, getJunctionCoords } from './path.js';

/**
 * Find the projection point from an address to a street segment.
 *
 * @param {Array.<number>} junctionA - Degrees latitude and longitude
 * @param {Array.<number>} junctionB - Degrees latitude and longitude
 * @param {Array.<number>} addressPoint - Degrees latitude and longitude
 * @returns {Array.<number>} Degrees latitude and longitude, and a segment fraction
 */
export function findProjectionPoint(junctionA, junctionB, addressPoint) {
    const [x1, y1] = junctionA;
    const [x2, y2] = junctionB;
    const [px, py] = addressPoint;

    // Vector from A to B
    const abx = x2 - x1;
    const aby = y2 - y1;

    // Vector from A to P
    const apx = px - x1;
    const apy = py - y1;

    // Calculate parameter t (0 = at A, 1 = at B)
    const abSquared = abx * abx + aby * aby;

    if (abSquared === 0) {
        // A and B are the same point
        return [x1, y1];
    }

    const t = (apx * abx + apy * aby) / abSquared;

    // Clamp t to [0, 1] to stay within the line segment
    const clampedT = Math.max(0, Math.min(1, t));

    // Calculate the projection point
    const projectionX = parseFloat(x1) + clampedT * abx;
    const projectionY = parseFloat(y1) + clampedT * aby;

    return [projectionX, projectionY, clampedT];
}

/**
 * Find the projection point from an address to a street segment.
 *
 * @param {number} cnnA - An intersection
 * @param {number} cnnB - An intersection
 * @param {string} address - A street address
 * @returns {Array.<number>} Degrees latitude and longitude
 */
export function findAddressProjection(addressData, jcts, cnnA, cnnB, address) {
    const a = getJunctionCoords(jcts, cnnA);
    const b = getJunctionCoords(jcts, cnnB);
    const c = getAddressCoords(addressData, address, true);

    const [x, y, t] = findProjectionPoint(a, b, c);

    return [x, y];
}
