/**
 * Geographic utility functions
 * @module public/geo
 */

import { encodeURLParam } from './string.js';

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
    return 69 * latDiff;
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
    const radians = lat * (Math.PI / 180);
    return 69 * Math.cos(radians);
}
