/**
 * Geographic utility functions
 * @module public/geo
 */

import { normalizeAddress, splitStreetAddress } from './address.js';
import { encodeURLParam } from './string.js';

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
 * Get the geographic coordinates of a street address.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {string} address - A street address
 * @returns {?LatLon} Decimal degrees latitude and longitude
 */
export function getAddressCoords(addressData, address) {
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
 * @returns {?number} Distance in miles
 */
export function howFar(a, b) {
    if (!a || !b) {
        return null;
    }
    const latDiff = Math.abs(a[0] - b[0]);
    const lonDiff = Math.abs(a[1] - b[1]);
    const lat = (latDiff / 2) + Math.min(a[0], b[0]);
    const y = latToMiles(latDiff);
    const x = lonToMiles(lonDiff, lat);
    return Math.sqrt((x ** 2) + (y ** 2));
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
