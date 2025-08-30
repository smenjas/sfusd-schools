/**
 * A* pathfinding implementation for San Francisco street network
 * Optimized for your junction data structure
 */

import { normalizeAddress, splitStreetAddress } from './address.js';
import { expandCoords, howFar } from './geo.js';
import { getAddressCoords, sortCNNs } from './path.js';

/**
 * Priority queue implementation using a binary heap
 */
class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    enqueue(item, priority) {
        this.heap.push({ item, priority });
        this.heapifyUp(this.heap.length - 1);
    }

    dequeue() {
        if (this.isEmpty()) return null;

        const min = this.heap[0];
        const end = this.heap.pop();

        if (!this.isEmpty()) {
            this.heap[0] = end;
            this.heapifyDown(0);
        }

        return min.item;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    heapifyUp(index) {
        const parentIndex = Math.floor((index - 1) / 2);

        if (parentIndex >= 0 && this.heap[parentIndex].priority > this.heap[index].priority) {
            [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
            this.heapifyUp(parentIndex);
        }
    }

    heapifyDown(index) {
        const leftChildIndex = 2 * index + 1;
        const rightChildIndex = 2 * index + 2;
        let smallest = index;

        if (leftChildIndex < this.heap.length &&
            this.heap[leftChildIndex].priority < this.heap[smallest].priority) {
            smallest = leftChildIndex;
        }

        if (rightChildIndex < this.heap.length &&
            this.heap[rightChildIndex].priority < this.heap[smallest].priority) {
            smallest = rightChildIndex;
        }

        if (smallest !== index) {
            [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
            this.heapifyDown(smallest);
        }
    }
}

/**
 * Get junction coordinates in standard lat/lon format
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {number} cnn - Junction CNN
 * @returns {?Array<string>} Full coordinates ['37.xxxx', '-122.xxxx']
 */
function getJunctionCoords(jcts, cnn) {
    const junction = jcts[cnn];
    if (!junction || !junction.ll) {
        return null;
    }
    return expandCoords(junction.ll);
}

/**
 * Calculate distance between two junctions
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {number} fromCNN - Start junction
 * @param {number} toCNN - End junction
 * @param {Map} distanceCache - Cache for memoization
 * @returns {number} Distance in miles
 */
function getJunctionDistance(jcts, fromCNN, toCNN, distanceCache) {
    const key = `${Math.min(fromCNN, toCNN)}-${Math.max(fromCNN, toCNN)}`;

    if (distanceCache.has(key)) {
        return distanceCache.get(key);
    }

    const fromCoords = getJunctionCoords(jcts, fromCNN);
    const toCoords = getJunctionCoords(jcts, toCNN);

    if (!fromCoords || !toCoords) {
        distanceCache.set(key, Infinity);
        return Infinity;
    }

    const distance = howFar(fromCoords, toCoords);
    distanceCache.set(key, distance);
    return distance;
}

/**
 * Find junction closest to given address coordinates
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {StreetJunctions} stJcts - CNNs keyed by street name
 * @param {string} address - Normalized address
 * @returns {?number} Nearest junction CNN
 */
function findNearestJunction(addressData, jcts, stJcts, address) {
    const [num, street] = splitStreetAddress(address, true);

    // First try to find junctions on the same street
    if (street in stJcts && stJcts[street].length > 0) {
        if (!(street in addressData) || !(num in addressData[street])) {
            // Address not found, use first junction on street
            console.log('Found', num, 'on', street);
            return stJcts[street][0];
        }

        const addressCoords = expandCoords(addressData[street][num]);
        if (!addressCoords) return stJcts[street][0];

        let minDistance = Infinity;
        let nearestCNN = null;

        // Check junctions on the same street first (much faster)
        for (const cnn of stJcts[street]) {
            const junctionCoords = getJunctionCoords(jcts, cnn);
            if (!junctionCoords) continue;

            const distance = howFar(addressCoords, junctionCoords);
            if (distance < minDistance) {
                minDistance = distance;
                nearestCNN = cnn;
            }
        }

        // FIXME: Remove when working.
        console.log(`Looking for junctions on street: ${street}`);
        console.log(`Found ${stJcts[street]?.length || 0} junctions on this street`);
        if (nearestCNN) {
            console.log(`Selected junction ${nearestCNN} at distance ${minDistance}`);
        }

        if (nearestCNN !== null) {
            return nearestCNN;
        }
    }

    // Fallback: search all junctions (slower)
    console.warn(`Street ${street} not found in junction data, searching all junctions`);

    if (!(street in addressData) || !(num in addressData[street])) {
        // Return first available junction
        return parseInt(Object.keys(jcts)[0]);
    }

    const addressCoords = expandCoords(addressData[street][num]);
    if (!addressCoords) return parseInt(Object.keys(jcts)[0]);

    let minDistance = Infinity;
    let nearestCNN = null;

    for (const cnnStr in jcts) {
        const cnn = parseInt(cnnStr);
        const junctionCoords = getJunctionCoords(jcts, cnn);
        if (!junctionCoords) continue;

        const distance = howFar(addressCoords, junctionCoords);
        if (distance < minDistance) {
            minDistance = distance;
            nearestCNN = cnn;
        }
    }

    return nearestCNN;
}

/**
 * Reconstruct path from A* search results
 *
 * @param {Map} cameFrom - Map of junction -> previous junction
 * @param {number} current - Goal junction CNN
 * @returns {Array<number>} Path as array of junction CNNs
 */
function reconstructPath(cameFrom, current) {
    const path = [];

    while (cameFrom.has(current)) {
        path.unshift(current);
        current = cameFrom.get(current);
    }

    // Remove the start junction (keep only intermediate junctions)
    if (path.length > 0) {
        path.shift();
    }

    return path;
}

/**
 * Breadth first search
 *
 * @param {Junctions} jcts - All SF intersections
 * @param {string} startCNN - Starting junction
 * @param {string} goalCNN - Ending junction
 * @param {Array} endLl - Latitude and logitude for the end address
 * @param {number} maxDepth - Limit on how many junctions to visit
 * @returns {Array<number>} A path as an array of junction CNNs
 */
function breadthFirstSearch(jcts, startCNN, goalCNN, endLl, maxDepth = 15000) {
    const queue = [startCNN];
    const visited = new Set([startCNN]);
    const cameFrom = new Map();
    const beelines = {};

    while (queue.length > 0 && visited.size < maxDepth) {
        const current = queue.shift();

        if (current === goalCNN) {
            return reconstructPath(cameFrom, current);
        }

        const junction = jcts[current];
        if (junction?.adj) {
            sortCNNs(jcts, beelines, junction.adj, endLl); // Sort neighbors by distance to end address
            for (const neighbor of junction.adj) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    cameFrom.set(neighbor, current);
                    queue.push(neighbor);
                }
            }
        }
    }

    console.log('Path is not connected');
    return [];
}

/**
 * A* algorithm implementation
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {StreetJunctions} stJcts - CNNs keyed by street name
 * @param {Object} beelines - Distance cache (for compatibility)
 * @param {string} start - Starting address
 * @param {string} end - Ending address
 * @returns {Array<number>} Optimal path as array of junction CNNs
 */
export function findOptimalPath(addressData, jcts, stJcts, beelines, start, end) {
    console.time(`A* pathfinding: ${start} to ${end}`);

    const normalizedStart = normalizeAddress(start);
    const normalizedEnd = normalizeAddress(end);

    // FIXME: Check for street (remove debug statments once working)
    console.log('Streets in stJcts:', Object.keys(stJcts).filter(s => s.includes('SILVER')));
    console.log('SILVER AVE in stJcts:', 'SILVER AVE' in stJcts);

    // Find nearest junctions to start and end
    const startCNN = findNearestJunction(addressData, jcts, stJcts, normalizedStart);
    const goalCNN = findNearestJunction(addressData, jcts, stJcts, normalizedEnd);

    if (!startCNN || !goalCNN) {
        console.warn('Could not find junctions for addresses:', start, end);
        console.timeEnd(`A* pathfinding: ${start} to ${end}`);
        return [];
    }

    if (startCNN === goalCNN) {
        console.log('Start and goal are the same junction');
        console.timeEnd(`A* pathfinding: ${start} to ${end}`);
        return [];
    }

    console.log({normalizedStart, startCNN, normalizedEnd, goalCNN});

    // FIXME: Replace the A* logic with simple BFS (remove once A* is working)
    const endLl = getAddressCoords(addressData, end);
    return breadthFirstSearch(jcts, startCNN, goalCNN, endLl);

    // A* data structures
    const openSet = new PriorityQueue();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    const distanceCache = new Map();

    // Initialize
    gScore.set(startCNN, 0);
    const heuristic = getJunctionDistance(jcts, startCNN, goalCNN, distanceCache);
    fScore.set(startCNN, heuristic);
    openSet.enqueue(startCNN, heuristic);

    let nodesExplored = 0;
    const maxNodes = 15000; // Prevent runaway searches

    while (!openSet.isEmpty() && nodesExplored < maxNodes) {
        const current = openSet.dequeue();
        nodesExplored++;

        if (current === goalCNN) {
            const path = reconstructPath(cameFrom, current);
            console.log(`A* found path with ${path.length} junctions in ${nodesExplored} iterations`);
            console.timeEnd(`A* pathfinding: ${start} to ${end}`);
            return path;
        }

        closedSet.add(current);

        // Explore neighbors
        const junction = jcts[current];
        if (!junction || !junction.adj) continue;

        for (const neighbor of junction.adj) {
            if (closedSet.has(neighbor)) continue;

            const edgeDistance = getJunctionDistance(jcts, current, neighbor, distanceCache);
            const tentativeGScore = gScore.get(current) + edgeDistance;

            if (!gScore.has(neighbor) || tentativeGScore < gScore.get(neighbor)) {
                cameFrom.set(neighbor, current);
                gScore.set(neighbor, tentativeGScore);

                const heuristic = getJunctionDistance(jcts, neighbor, goalCNN, distanceCache);
                const fScoreValue = tentativeGScore + heuristic;
                fScore.set(neighbor, fScoreValue);

                openSet.enqueue(neighbor, fScoreValue);
            }
        }
    }

    console.warn(`A* failed to find path after ${nodesExplored} iterations`);
    console.timeEnd(`A* pathfinding: ${start} to ${end}`);
    return [];
}

/**
 * Calculate total distance along a path
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Junctions} jcts - All SF intersections
 * @param {Array<number>} path - Array of junction CNNs
 * @param {string} start - Starting address
 * @param {string} end - Ending address
 * @returns {number} Total distance in miles
 */
export function sumDistances(addressData, jcts, path, start, end) {
    if (!Array.isArray(path) || path.length === 0) {
        // No intermediate junctions, calculate direct distance
        const startCoords = getAddressCoords(addressData, start);
        const endCoords = getAddressCoords(addressData, end);
        return startCoords && endCoords ? howFar(startCoords, endCoords) : 0;
    }

    const distanceCache = new Map();
    let totalDistance = 0;

    // Distance from start address to first junction
    const startCoords = getAddressCoords(addressData, start);
    const firstJunctionCoords = getJunctionCoords(jcts, path[0]);
    if (startCoords && firstJunctionCoords) {
        totalDistance += howFar(startCoords, firstJunctionCoords);
    }

    // Distance between consecutive junctions
    for (let i = 1; i < path.length; i++) {
        totalDistance += getJunctionDistance(jcts, path[i-1], path[i], distanceCache);
    }

    // Distance from last junction to end address
    const endCoords = getAddressCoords(addressData, end);
    const lastJunctionCoords = getJunctionCoords(jcts, path[path.length - 1]);
    if (endCoords && lastJunctionCoords) {
        totalDistance += howFar(endCoords, lastJunctionCoords);
    }

    return totalDistance;
}
