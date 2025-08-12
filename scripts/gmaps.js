/**
 * Access the Google Maps API.
 * @module gmaps
 */

import { metersToMiles } from '../public/geo.js';

/**
 * Request route info from Google Maps.
 *
 * @param {string} apiKey - The Google Maps API key
 * @param {string} start - The starting address
 * @param {string} end - The ending address
 * @param {string} [travelMode=null] - The mode of transportation
 * @returns {Object} Information about a route
 */
export async function requestRoute(apiKey, start, end, travelMode = null) {
    const request = {
        origin: { address: start },
        destination: { address: end },
        travelMode,
    };
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            throw new Error(`HTTP error, status: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error('Error calling Routes API:', error);
        throw error;
    }
}

/**
 * Get distance and time info about a route from Google Maps.
 *
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @returns {Object} The distance in miles and time in seconds
 */
export async function getRouteData(start, end) {
    const apiKey = process.env.GMAPS_API_KEY;
    const addrSuffix = ', San Francisco, CA';
    start += addrSuffix;
    end += addrSuffix;
    const data = await requestRoute(apiKey, start, end);
    const { distanceMeters: meters, duration } = data.routes[0];
    return {
        miles: metersToMiles(meters),
        seconds: parseInt(duration),
    };
}
