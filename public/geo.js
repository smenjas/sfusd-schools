/**
 * Geographic utility functions
 * @module ./geo
 */

/**
 * Calculate the distance between two sets of geographic coordinates.
 *
 * @param {Array<number>} a - Degrees latitude, longitude
 * @param {Array<number>} b - Degrees latitude, longitude
 * @returns {number} Distance in miles
 */
export function calculateDistance(a, b) {
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
 * Expand the decimal portion of geographic coordinates to include the whole
 * numbers for San Francisco, California: 37°N, 122°W.
 *
 * @param {Array<number>} coords - Decimal portion of ° latitude, longitude
 * @returns {Array<number>} Degrees latitude and longitude
 */
export function expandCoords(coords) {
    const [lat, lon] = coords;
    return [`37.${lat}`, `-122.${lon}`];
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
    const search = `${encodeURIComponent(fro)}/${encodeURIComponent(to)}`;
    return 'https://www.google.com/maps/dir/' + search.replaceAll(' ', '+');
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
    search = encodeURIComponent(search);
    return 'https://www.google.com/maps/search/' + search.replaceAll(' ', '+');
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
