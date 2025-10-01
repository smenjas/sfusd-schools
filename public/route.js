import { howFarJunctions } from './geo.js';
import { describePathText } from './path.js';
import addressData from './address-data.js';
import jcts from './junctions.js';

export default class Path {
    static start;
    static end;
    static isPathfinding = false;

    // A* visualization state
    static openSet = new Set();
    static closedSet = new Set();
    static here = null;
    static path = [];

    static reset() {
        start = null;
        end = null;
        isPathfinding = false;
        openSet.clear();
        closedSet.clear();
        here = null;
        path = [];
    }

    static async find() {
        console.log('Path.find()');
        if (!Path.start || !Path.end || Path.isPathfinding) return;
        console.time('findPath()');

        Path.isPathfinding = true;
        document.getElementById('findPathBtn').disabled = true;

        // Initialize A*
        Path.openSet.clear();
        Path.closedSet.clear();
        Path.path = [];

        const gScore = {};
        const fScore = {};
        const cameFrom = {};

        Path.openSet.add(Path.start);
        gScore[Path.start] = 0;
        fScore[Path.start] = howFarJunctions(jcts, Path.start, Path.end);

        while (Path.openSet.size > 0) {
            // Find node with lowest fScore
            Path.here = Array.from(Path.openSet).reduce((lowest, node) =>
                fScore[node] < fScore[lowest] ? node : lowest
            );

            if (Path.here === Path.end) {
                Path.reconstruct(cameFrom);
                break;
            }

            Path.openSet.delete(Path.here);
            Path.closedSet.add(Path.here);

            Path.checkNeighbors(gScore, fScore, cameFrom);

            // Update display
            //dirty.pf = true;
            //requestRedraw();
            //info(`A* running... Current: ${here} | Open: ${openSet.size} | Closed: ${closedSet.size}`);

            // Brief pause for visualization
            const speed = parseInt(document.getElementById('animationSpeed').value);
            await new Promise(resolve => setTimeout(resolve, speed));
        }

        //info(path.length > 0 ?
        //    `Path found! ${path.length} junctions, ${gScore[end].toFixed(1)} mi.` :
        //    'No path found!');

        Path.here = null;
        Path.isPathfinding = false;
        document.getElementById('findPathBtn').disabled = false;
        console.timeEnd('findPath()');

        //dirty.pf = true;
        //requestRedraw();
    }

    static checkNeighbors(gScore, fScore, cameFrom) {
        const neighbors = jcts[Path.here].adj.filter(cnn => jcts[cnn]);
        for (const neighbor of neighbors) {
            if (Path.closedSet.has(neighbor)) continue;

            const distance = howFarJunctions(jcts, Path.here, neighbor);
            const tentativeGScore = gScore[Path.here] + distance;

            if (!Path.openSet.has(neighbor)) {
                // First time visiting this neighbor
                Path.openSet.add(neighbor);
                cameFrom[neighbor] = Path.here;
                gScore[neighbor] = tentativeGScore;
                fScore[neighbor] = gScore[neighbor] + howFarJunctions(jcts, neighbor, Path.end);
            } else if (tentativeGScore < (gScore[neighbor] || Infinity)) {
                // Found a better path to this neighbor
                cameFrom[neighbor] = Path.here;
                gScore[neighbor] = tentativeGScore;
                fScore[neighbor] = gScore[neighbor] + howFarJunctions(jcts, neighbor, Path.end);
            }
            // If tentativeGScore >= existing gScore, don't update anything
        }
    }

    static reconstruct(cameFrom) {
        let current = Path.end;
        const pathSet = new Set();
        const maxPathLength = Object.keys(jcts).length;

        while (current && Path.path.length < maxPathLength) {
            if (pathSet.has(current)) {
                // Cycle detected - use the path we have so far
                console.warn(`Circular reference detected at node ${current}. Using partial path.`);
                break;
            }

            pathSet.add(current);
            Path.path.unshift(current);
            current = cameFrom[current];
        }

        if (Path.path.length >= maxPathLength) {
            console.error("Path reconstruction hit length limit - using partial path");
        }

        // Validate the path we have
        if (!Path.path.length) {
            console.error("No valid path could be reconstructed");
        }

        console.log(`Path reconstructed: ${Path.path.join(' -> ')} (${Path.path.length} nodes)`);
        const description = describePathText(addressData, jcts, Path.path);
        console.log(description);

        // Optional: Check if we actually reached the start
        if (Path.path[0] !== Path.start) {
            console.warn(`Path doesn't reach start node. Got to ${Path.path[0]}, wanted ${Path.start}`);
        }
    }
}
