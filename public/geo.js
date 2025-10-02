/**
 * Geographic utility functions
 * @module public/geo
 */

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
    if (!a || !b) {
        return Infinity;
    }
    const latDiff = Math.abs(a[0] - b[0]);
    const lonDiff = Math.abs(a[1] - b[1]);
    const latMean = (parseFloat(a[0]) + parseFloat(b[0])) / 2;
    const y = latToMiles(latDiff);
    const x = lonToMiles(lonDiff, latMean);
    return Math.sqrt((x * x) + (y * y));
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
