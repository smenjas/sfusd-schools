/**
 * Navigate between places in San Francisco, California.
 * @module public/path
 */

import { normalizeAddress,
         prettifyAddress,
         splitStreetAddress } from './address.js';
import { expandCoords, getCoordsURL, howFar } from './geo.js';

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
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefix} cnn - An intersection
 * @returns {?LatLon} Decimal degrees latitude and longitude
 */
export function getJunctionCoords(jcts, cnn) {
    if (!(cnn in jcts)) {
        console.warn('getJunctionCoords():', cnn, 'not found');
        return null;
    }
    return expandCoords(jcts[cnn].ll);
}

/**
 * Generate a Google Maps URL, for latitude and longitude.
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefix} cnn - A Center-line Network Number
 * @returns {string} A URL
 */
function mapCNN(jcts, cnn) {
    return getCoordsURL(getJunctionCoords(jcts, cnn));
}

/**
 * Name an intersection, e.g. "CASTRO ST & 17TH ST"
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefix} cnn - An intersection
 * @returns {string} An intersection name
 */
export function nameCNN(jcts, cnn) {
    if (!(cnn in jcts)) {
        console.log('nameCNN():', cnn, 'not found');
        return;
    }
    const streets = jcts[cnn].streets;
    streets.sort();
    const name = streets.join(' & ');
    return prettifyAddress(name);
}

/**
 * Log an intersection name.
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefix} cnn - An intersection
 */
function logCNN(jcts, cnn) {
    if (!(cnn in jcts)) {
        console.log('logCNN():', cnn, 'not found');
        return;
    }
    const name = nameCNN(jcts, cnn);
    const url = mapCNN(jcts, cnn);
    console.log(cnn, name, url);
}

/**
 * Log intersection names and distances.
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefixes} cnns - Intersections
 */
function logCNNs(jcts, cnns) {
    for (const cnn of cnns) {
        logCNN(jcts, cnn);
    }
}

/**
 * Sort intersections by distance to the given coordinates.
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {Object.<CNNPrefix, number>} beelines - Distances in miles
 * @param {CNNPrefixes} cnns - Intersections
 * @param {LatLon} ll - Degrees latitude and longitude
 * @returns {CNNPrefixes} Intersections
 */
function sortCNNs(jcts, beelines, cnns, ll) {
    for (const cnn of cnns) {
        if (cnn in beelines) {
            continue;
        }
        if (!(cnn in jcts)) {
            console.log('sortCNNs():', cnn, 'not found');
            beelines[cnn] = Infinity;
            continue;
        }
        const coords = getJunctionCoords(jcts, cnn);
        beelines[cnn] = howFar(ll, coords);
    }
    return cnns.sort((a, b) => beelines[a] - beelines[b]);
}

/**
 * Sort intersections by distance to the given coordinates, on a given street.
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {StreetJunctions} stJcts - CNNs keyed by street name
 * @param {Object.<CNNPrefix, number>} beelines - Distances in miles
 * @param {string} street - A street name, e.g. "MARKET ST"
 * @param {LatLon} ll - Degrees latitude and longitude
 * @returns {CNNPrefixes} Intersections
 */
function sortStreetCNNs(jcts, stJcts, beelines, street, ll) {
    if (!(street in stJcts)) {
        console.log('sortStreetCNNs():', street, 'not found');
        return [];
    }
    return sortCNNs(jcts, beelines, stJcts[street], ll);
}

/**
 * Find the nearest intersection to the given geographic coordinates.
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {Object.<CNNPrefix, number>} beelines - Distances in miles
 * @param {LatLon} ll - Degrees latitude and longitude
 * @returns {CNNPrefix} The nearest intersection
 */
function findNearestJunction(jcts, beelines, ll) {
    let min = Infinity;
    let minCNN = null;
    for (const cnn in jcts) {
        let beeline;
        if (cnn in beelines) {
            beeline = beelines[cnn];
        }
        else {
            const coords = getJunctionCoords(jcts, cnn);
            beeline = howFar(ll, coords);
            beelines[cnn] = beeline;
        }
        if (beeline < min) {
            min = beeline;
            minCNN = cnn;
        }
    }
    //console.log('findNearestJunction():', minCNN, 'is', min, 'mi. away.');
    return minCNN;
}

/**
 * Find a path between two street addresses in San Francisco, California.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {StreetJunctions} stJcts - Look up CNNs by street name.
 * @param {Object} beelines - Distances to addresses, as the crow flies
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @param {string} [place=''] - The name of the destination (optional)
 * @returns {CNNPrefixes} Intersections
 */
function findPath(addressData, jcts, stJcts, beelines, start, end, place = '') {
    // Get the starting coordinates.
    start = normalizeAddress(start);
    const [startNum, startSt] = splitStreetAddress(start);
    if (!(startSt in addressData)) {
        console.log('Cannot find street:', startSt);
        return [];
    }
    if (!(startNum in addressData[startSt])) {
        console.log('Cannot find number:', startNum, 'on', startSt);
        return [];
    }
    const startLl = expandCoords(addressData[startSt][startNum]);

    // Which intersection is nearest to the start?
    if (!(start in beelines)) {
        beelines[start] = {};
    }
    const startCNNs = sortStreetCNNs(jcts, stJcts, beelines[start], startSt, startLl);
    let here = startCNNs.length ? startCNNs[0] :
        findNearestJunction(jcts, beelines[start], startLl);

    // Get the ending coordinates.
    end = normalizeAddress(end);
    const [endNum, endSt] = splitStreetAddress(end);
    if (!(endSt in addressData)) {
        console.log('Cannot find street:', endSt);
        return [];
    }
    if (!(endNum in addressData[endSt])) {
        console.log('Cannot find number:', endNum, 'on', endSt);
        return [];
    }
    const endLl = expandCoords(addressData[endSt][endNum]);

    // Which intersection is nearest to the end?
    if (!(end in beelines)) {
        beelines[end] = {};
    }
    const endCNNs = sortStreetCNNs(jcts, stJcts, beelines[end], endSt, endLl);
    const there = parseInt(endCNNs.length ? endCNNs[0] :
        findNearestJunction(jcts, beelines[end], endLl));

    /**
     * A deeply nested record of paths to a destination.
     *
     * @typedef {Object.<CNNPrefix, Paths>} Paths
     * @property {boolean} found - Whether this path leads to the destination
     * @property {CNNPrefixes} path - Intersections
     * @property {number} distance - How long this path is, in miles
     */

    /**
     * Find paths to the destination.
     *
     * @param {Paths} paths - A deeply nested record of attempts
     * @param {CNNPrefix} here - An intersection
     * @returns {boolean} Whether this path leads to the destination
     */
    function go(paths, here) {
        if (!(here in jcts)) {
            console.log('go():', here, 'not found');
            return false;
        }

        // Don't visit the same intersection twice on one path.
        here = parseInt(here);
        if (paths.path.includes(here)) {
            return false;
        }

        // Remember this intersection, so we don't visit it again on this path.
        paths.path.push(here);

        // Have we reached the destination?
        if (here === there) {
            paths.found = true;
            return true;
        }

        // Limit the total number of intersections to visit, period.
        if (++jctCount >= maxJcts) {
            return false;
        }

        // Prioritize adjacent intersections by distance to the destination.
        const jct = jcts[here];
        sortCNNs(jcts, beelines[end], jct.adj, endLl);

        // Visit adjacent intersections to this one.
        for (const cnn of jct.adj) {
            // How far is the adjacent intersection along the journey?
            const distance = howFarJunctions(jcts, here, cnn);
            // Record details of the path to the adjacent intersection.
            paths[cnn] = {
                distance: distance + paths.distance,
                found: false,
                path: Array.from(paths.path)
            };
            // Visit the adjacent intersection.
            go(paths[cnn], cnn);
            // Does the adjacent intersection lead to the destination?
            if (paths[cnn].found) {
                paths.found = true;
                //return true; // Stop at the first solution.
            }
            else {
                // Don't keep details about unsuccessful attempts.
                delete paths[cnn]; // Free up memory.
            }
        }

        // Does this intersection lead to the destination?
        return paths.found;
    } // end go()

    // Limit execution.
    const maxJcts = 1e3;
    let jctCount = 0;

    /** @type Paths */
    const paths = { found: false, path: [], distance: beelines[start][here] };

    // Find paths to the destination.
    go(paths, here);

    let path = [];
    let shortest = Infinity;
    let shortestCount = 0;
    let count = 0;

    /**
     * Find the shortest path.
     *
     * @param {Paths} paths - A variety of paths
     * @param {CNNPrefix} here - An intersection
     * @param {CNNPrefix} there - An intersection
     */
    function findShortestPath(paths, here, there) {
        if (parseInt(here) === there) {
            count++;
            if (paths.distance < shortest) {
                shortest = paths.distance;
                shortestCount = count;
                path = paths.path;
            }
            return;
        }
        for (const key in paths) {
            if (key === 'distance' || key === 'found' || key === 'path') {
                continue;
            }
            findShortestPath(paths[key], key, there);
        }
    }

    findShortestPath(paths, here, there);

    /*
    const distance = shortest + beelines[end][there];
    const prefix = `${shortestCount}/${count}`;
    analyzePath(addressData, jcts, path, start, end, distance, null, prefix, place);
    */

    return path;
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
 * @param {Junctions} jcts - All SF intersections
 * @param {string} address - A street address
 * @param {CNNPrefix} cnn - An intersection
 * @returns {number} Distance in miles
 */
function howFarAddressToJunction(addressData, jcts, address, cnn) {
    const addrLl = getAddressCoords(addressData, address);
    const jctLl = getJunctionCoords(jcts, cnn);
    return howFar(addrLl, jctLl);
}

/**
 * Calculate the distance between two intersections, as the crow flies.
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefix} start - An intersection
 * @param {CNNPrefix} end - An intersection
 * @returns {number} Distance in miles
 */
function howFarJunctions(jcts, start, end) {
    const startLl = getJunctionCoords(jcts, start);
    const endLl = getJunctionCoords(jcts, end);
    return howFar(startLl, endLl);
}

/**
 * Add up the distances between two addresses, along a route.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefixes} path - Intersections
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @returns {number} Distance in miles
 */
export function sumDistances(addressData, jcts, path, start, end) {
    if (!Array.isArray(path) || path.length < 1) {
        return 0;
    }

    let distance = howFarAddressToJunction(addressData, jcts, start, path[0]);

    for (let i = 1; i < path.length; i++) {
        distance += howFarJunctions(jcts, path[i - 1], path[i]);
    }

    const lastCNN = path[path.length - 1];
    distance += howFarAddressToJunction(addressData, jcts, end, lastCNN);

    return distance;
}

/**
 * Find a path to a school in San Francisco, California.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {StreetJunctions} stJcts - Look up CNNs by street name.
 * @param {Object} beelines - Distances to addresses, as the crow flies
 * @param {string} start - The starting street address
 * @param {School} school - Data about a school
 * @returns {CNNPrefixes} Intersections
 */
export function findPathToSchool(addressData, jcts, stJcts, beelines, start, school) {
    if (!school || !('address' in school)) {
        console.warn('school data missing');
        return [];
    }
    const end = school.address;
    const place = `${school.name} ${school.types[0]}`;
    return findBestPath(addressData, jcts, stJcts, beelines, start, end, place);
}

/**
 * Find a path between two street addresses in San Francisco, California.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {StreetJunctions} stJcts - Look up CNNs by street name.
 * @param {Object} beelines - Distances to addresses, as the crow flies
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @param {string} [place=''] - The name of the destination (optional)
 * @returns {CNNPrefixes} Intersections
 */
function findBestPath(addressData, jcts, stJcts, beelines, start, end, place = '') {
    const to = findPath(addressData, jcts, stJcts, beelines, start, end, place);
    const fro = findPath(addressData, jcts, stJcts, beelines, end, start, place);
    if (!to.length) return fro.reverse();
    if (!fro.length) return to;
    const toDistance = sumDistances(addressData, jcts, to, start, end);
    const froDistance = sumDistances(addressData, jcts, fro, end, start);
    return (toDistance < froDistance) ? to : fro.reverse();
}

/**
 * Log information about a path, to analyze it.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {CNNPrefixes} path - Intersections
 * @param {string} start - The starting street address
 * @param {string} end - The ending street address
 * @param {number} [distance=null] - A distance in miles, along a path
 * @param {number} [beeline=null] - A distance in miles, as the crow flies
 * @param {string} [prefix=''] - A prefix to the log message
 * @param {string} [suffix=''] - A suffix to the log message
 */
function analyzePath(addressData, jcts, path, start, end, distance = null, beeline = null, prefix = '', suffix = '') {
    if (distance === null) {
        distance = sumDistances(addressData, jcts, path, start, end);
    }
    if (beeline === null) {
        beeline = howFarAddresses(addressData, start, end);
    }
    if (prefix !== '') {
        prefix += ':';
    }
    const distanceMi = parseFloat(distance.toFixed(2));
    const beelineMi = parseFloat(beeline.toFixed(2));
    const pctDiff = Math.round(((distance - beeline) / beeline) * 100);

    console.log(`${prefix}`,
        beelineMi, 'mi. vs',
        distanceMi, `mi. ${pctDiff}% ${suffix}`);
}

/**
 * Look up intersections by street name.
 *
 * @typedef {Object.<Street, CNNPrefixes>} StreetJunctions
 */

/**
 * Look up intersections by street name.
 *
 * @param {Junctions} jcts - All SF intersections
 * @returns {StreetJunctions} Intersections on each street
 */
export function getStreetJunctions(jcts) {
    const stJcts = {};
    for (const cnn in jcts) {
        const jct = jcts[cnn];
        for (const st of jct.streets) {
            if (!(st in stJcts)) stJcts[st] = [];
            stJcts[st].push(cnn);
        }
    }
    return stJcts;
}

/**
 * Find the distances to every public school from a given address.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Schools} schoolData - All SF public schools
 * @param {Junctions} jcts - All SF intersections
 * @param {string} start - The starting street address
 * @returns {Object} The distance to each public school
 */
export function findSchoolDistances(addressData, schoolData, jcts, start) {
    console.time('findSchoolDistances()');
    const stJcts = getStreetJunctions(jcts);
    const beelines = {};
    const distances = {};
    for (const school of schoolData) {
        const path = findPathToSchool(addressData, jcts, stJcts, beelines, start, school);
        const end = normalizeAddress(school.address);
        const distance = sumDistances(addressData, jcts, path, start, end);
        //const beeline = howFarAddresses(addressData, start, end);
        //const place = `${school.name} ${school.types[0]}`;
        //analyzePath(addressData, jcts, path, start, end, distance, beeline, '', place);
        distances[end] = distance;
    }
    console.timeEnd('findSchoolDistances()');
    return distances;
}
