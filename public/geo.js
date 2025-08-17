/**
 * Geographic utility functions
 * @module public/geo
 */

/**
 * Convert degrees to radians.
 *
 * @param {number} degrees
 * @returns {number} Radians
 */
function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
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

/**
 * Convert a compass bearing to a cardinal direction.
 *
 * @param {number} bearing - A compass bearing, in degrees
 * @returns {?string} A cardinal direction
 */
function bearingToDirection(bearing) {
    if (isNaN(bearing)) {
        return null;
    }
    bearing %= 360;
    if (bearing < 22.5) return 'N';
    if (bearing < 67.5) return 'NE';
    if (bearing < 112.5) return 'E';
    if (bearing < 157.5) return 'SE';
    if (bearing < 202.5) return 'S';
    if (bearing < 247.5) return 'SW';
    if (bearing < 292.5) return 'W';
    if (bearing < 337.5) return 'NW';
    return 'N';
}

/**
 * Calculate the angle of coordinates, relative to (0, 0).
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
 * Expand the decimal portion of geographic coordinates to include the whole
 * numbers for San Francisco, California: 37°N, 122°W.
 *
 * @param {?LatLonDecimals} coords - Decimal portion of ° latitude, longitude
 * @returns {?LatLon} Degrees latitude and longitude
 */
export function expandCoords(coords) {
    if (!coords) {
        return null
    }
    const [lat, lon] = coords;
    return [`37.${lat}`, `-122.${lon}`];
}

/**
 * Find the angle between two sets of coordinates.
 *
 * @param {?LatLon} a - Decimal degrees latitude and longitude
 * @param {?LatLon} b - Decimal degrees latitude and longitude
 * @returns {?number} A compass bearing, in degrees
 */
export function findBearing(a, b) {
    const components = howFarComponents(a, b);
    if (!components) {
        return null;
    }
    const [x, y] = components;
    let degrees = calcAngleDegrees(x, y);
    while (degrees < 0) {
        degrees += 360;
    }
    return degrees;
}

/**
 * Find the direction from one location to another.
 *
 * @param {?LatLon} a - Decimal degrees latitude and longitude
 * @param {?LatLon} b - Decimal degrees latitude and longitude
 * @returns {?number} A cardinal direction
 */
export function findDirection(a, b) {
    const bearing = findBearing(a, b);
    return bearingToDirection(bearing);
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
    const latDiff = a[0] - b[0];
    const lonDiff = a[1] - b[1];
    const latMean = (latDiff / 2) + Math.min(a[0], b[0]);
    const y = latToMiles(latDiff);
    const x = lonToMiles(lonDiff, latMean);
    return [x, y];
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
    const radians = degreesToRadians(lat);
    return 69 * Math.cos(radians);
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
