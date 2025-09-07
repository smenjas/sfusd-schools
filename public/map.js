import addressData from './address-data.js';
import junctions from './junctions.js';

// Map state
let canvas, ctx;
let bounds = null;
let zoom = 1;
const minZoom = 1.0;
const maxZoom = 100;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;
let selectedStart = null;
let selectedEnd = null;
let isPathfinding = false;
let theme = 'light';
let addresses = {};

const colorThemes = {
    light: {
        background: '#ffffff', // White
        streets: '#666666', // Gray
        junctions: '#333333', // Dark gray
        start: '#28a745', // Green
        end: '#dc3545', // Red
        current: '#ff6b35', // Orange
        openSet: '#ffc107', // Yellow
        closedSet: '#6c757d', // Gray
        finalPath: '#0066cc', // Blue
        text: '#000000' // Black
    },
    dark: {
        background: '#1a1a1a',
        streets: '#888888', // Gray
        junctions: '#cccccc', // Light gray
        start: '#4ade80', // Green
        end: '#f87171', // Salmon
        current: '#fb923c', // Orange
        openSet: '#fbbf24', // Yellow
        closedSet: '#9ca3af', // Gray
        finalPath: '#60a5fa', // Blue
        text: '#ffffff' // White
    }
};

// A* visualization state
let openSet = new Set();
let closedSet = new Set();
let currentNode = null;
let finalPath = [];

function log(message) {
    document.getElementById('statsPanel').textContent = message;
}

function detectColorScheme() {
    // Check if the browser supports the media query
    if (!window.matchMedia) {
        return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');

    // Check if user prefers dark mode
    theme = (media.matches) ? 'dark' : 'light';

    // Listen for changes in color scheme preference
    media.addEventListener('change', (e) => {
        theme = e.matches ? 'dark' : 'light';
        drawMap(); // Redraw with new colors
    });
}

function getColor(colorName) {
    return colorThemes[theme][colorName];
}

function calculateBounds(junctionData = junctions) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    Object.values(junctionData).forEach(junction => {
        const [lat, lon] = junction.ll;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
    });

    // Add padding
    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;
    const padding = 0.05;

    return {
        minLat: minLat - latRange * padding,
        maxLat: maxLat + latRange * padding,
        minLon: minLon - lonRange * padding,
        maxLon: maxLon + lonRange * padding
    };
}

function coordsToScreen(lat, lon) {
    if (!bounds) return [0, 0];

    // Calculate normalized coordinates (0-1)
    const normalizedX = (bounds.maxLon - lon) / (bounds.maxLon - bounds.minLon);
    const normalizedY = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);

    // Don't apply aspect correction here - we'll handle it in the display calculations

    // Calculate the actual geographic aspect ratio of SF
    // At SF's latitude, 1° longitude ≈ 0.79 × 1° latitude in distance
    // So our map's natural width/height ratio should be: lon_range * 0.79 / lat_range
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const mapAspectRatio = (lonRange * 0.79) / latRange;

    // Calculate display dimensions to maintain geographic accuracy
    const canvasAspectRatio = canvas.width / canvas.height;

    let mapDisplayWidth, mapDisplayHeight, mapOffsetX, mapOffsetY;

    if (mapAspectRatio > canvasAspectRatio) {
        // Map is wider than canvas - fit to width
        mapDisplayWidth = canvas.width;
        mapDisplayHeight = canvas.width / mapAspectRatio;
        mapOffsetX = 0;
        mapOffsetY = (canvas.height - mapDisplayHeight) / 2;
    } else {
        // Map is taller than canvas - fit to height
        mapDisplayWidth = canvas.height * mapAspectRatio;
        mapDisplayHeight = canvas.height;
        mapOffsetX = (canvas.width - mapDisplayWidth) / 2;
        mapOffsetY = 0;
    }

    // Convert to screen coordinates within the map display area
    const baseX = normalizedX * mapDisplayWidth + mapOffsetX;
    const baseY = normalizedY * mapDisplayHeight + mapOffsetY;

    // Apply zoom and pan
    const screenX = (baseX + offsetX) * zoom;
    const screenY = (baseY + offsetY) * zoom;

    return [screenX, screenY];
}

function screenToCoords(screenX, screenY) {
    if (!bounds) return [0, 0];

    // Reverse the transformation
    const normalizedX = (screenX / zoom - offsetX) / canvas.width;
    const normalizedY = (screenY / zoom - offsetY) / canvas.height;

    // Reverse the coordinate mapping
    const lon = bounds.maxLon - normalizedX * (bounds.maxLon - bounds.minLon);
    const lat = bounds.maxLat - normalizedY * (bounds.maxLat - bounds.minLat);

    return [lat, lon];
}

function drawAddresses() {
    // Only show addresses when zoomed in enough to be readable
    if (zoom < 40) return;

    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.miterLimit = 3;
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `${Math.max(10, zoom / 5)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let addressCount = 0;

    Object.entries(addresses).forEach(([streetName, streetAddresses]) => {
        Object.entries(streetAddresses).forEach(([number, coords]) => {
            const [lat, lon] = coords;
            const [x, y] = coordsToScreen(lat, lon);

            // Only draw if visible
            const margin = 30;
            if (x >= -margin && x <= canvas.width + margin && y >= -margin && y <= canvas.height + margin) {
                // Draw a small dot for the address location
                ctx.fillStyle = getColor('text');
                ctx.beginPath();
                ctx.arc(x, y, Math.max(1, 1.5/zoom), 0, 2 * Math.PI);
                ctx.fill();

                // Draw address number slightly offset so it doesn't overlap the dot
                ctx.fillStyle = getColor('text');
                ctx.strokeText(number, x, y - Math.max(8, 10/zoom));
                ctx.fillText(number, x, y - Math.max(8, 10/zoom));

                addressCount++;
            }
        });
    });

    if (addressCount > 0) {
        console.log(`Drew ${addressCount} addresses at zoom ${zoom.toFixed(2)}x`);
    }
}

function drawStreetNames() {
    if (zoom < 4) return;

    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `${Math.max(10, zoom / 2)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    const drawnStreets = new Set();
    const streetSegments = new Map(); // street name -> array of segments

    // Collect street segments
    for (const [cnn, junction] of Object.entries(junctions)) {
        const [lat1, lon1] = junction.ll;
        const [x1, y1] = coordsToScreen(lat1, lon1);

        for (const adjCNN of junction.adj) {
            if (!junctions[adjCNN]) {
                continue;
            }
            const connectionKey = [cnn, adjCNN].sort().join('-');
            if (drawnStreets.has(connectionKey)) {
                continue;
            }

            drawnStreets.add(connectionKey);

            // Find common street names between the two junctions
            const commonStreets = junction.streets.filter(street =>
                junctions[adjCNN].streets.includes(street)
            );

            if (!commonStreets.length) {
                continue;
            }

            const [lat2, lon2] = junctions[adjCNN].ll;
            const [x2, y2] = coordsToScreen(lat2, lon2);

            // Only process visible segments
            const margin = 100;
            if ((x1 >= -margin && x1 <= canvas.width + margin && y1 >= -margin && y1 <= canvas.height + margin) ||
                (x2 >= -margin && x2 <= canvas.width + margin && y2 >= -margin && y2 <= canvas.height + margin)) {

                const streetName = commonStreets[0]; // Use first common street
                if (!streetSegments.has(streetName)) {
                    streetSegments.set(streetName, []);
                }
                streetSegments.get(streetName).push({
                    x1, y1, x2, y2,
                    length: Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1))
                });
            }
        }
    }

    // Draw street names on longest segments
    streetSegments.forEach((segments, streetName) => {
        // Find the longest segment for this street
        const longestSegment = segments.reduce((longest, segment) =>
            segment.length > longest.length ? segment : longest
        );

        // Only draw if segment is long enough for text
        const textWidth = ctx.measureText(streetName).width;
        if (longestSegment.length > textWidth + 20) {
            drawStreetNameOnSegment(streetName, longestSegment);
        }
    });
}

function drawStreetNameOnSegment(streetName, segment) {
    const { x1, y1, x2, y2 } = segment;

    // Calculate midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Calculate angle for text rotation
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Ensure text is never upside down
    let displayAngle = angle;
    if (Math.abs(angle) > Math.PI / 2) {
        displayAngle = angle + Math.PI;
    }

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(displayAngle);

    // Draw text with outline for visibility
    ctx.strokeText(streetName, 0, 0);
    ctx.fillText(streetName, 0, 0);

    ctx.restore();
}

function drawMap() {
    if (!canvas || !ctx || !bounds) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background using theme color
    ctx.fillStyle = getColor('background');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let visibleJunctions = 0;
    let visibleStreets = 0;

    // Draw streets
    ctx.strokeStyle = getColor('streets');
    ctx.lineWidth = Math.max(2, 1 / zoom);
    ctx.beginPath();

    const drawnConnections = new Set();
    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [lat1, lon1] = junction.ll;
        const [x1, y1] = coordsToScreen(lat1, lon1);

        junction.adj.forEach(adjCNN => {
            if (junctions[adjCNN]) {
                const connectionKey = [cnn, adjCNN].sort().join('-');
                if (!drawnConnections.has(connectionKey)) {
                    drawnConnections.add(connectionKey);

                    const [lat2, lon2] = junctions[adjCNN].ll;
                    const [x2, y2] = coordsToScreen(lat2, lon2);

                    // Only draw if at least one point is visible
                    const margin = 100;
                    if ((x1 >= -margin && x1 <= canvas.width + margin && y1 >= -margin && y1 <= canvas.height + margin) ||
                        (x2 >= -margin && x2 <= canvas.width + margin && y2 >= -margin && y2 <= canvas.height + margin)) {
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        visibleStreets++;
                    }
                }
            }
        });
    });

    ctx.stroke();

    // Draw final path if it exists
    if (finalPath.length > 1) {
        ctx.strokeStyle = getColor('finalPath');
        ctx.lineWidth = Math.max(6, 3 / zoom);
        ctx.lineCap = 'round';
        ctx.beginPath();

        const [startLat, startLon] = junctions[finalPath[0]].ll;
        const [startX, startY] = coordsToScreen(startLat, startLon);
        ctx.moveTo(startX, startY);

        for (let i = 1; i < finalPath.length; i++) {
            const [lat, lon] = junctions[finalPath[i]].ll;
            const [x, y] = coordsToScreen(lat, lon);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    drawStreetNames();

    // Draw junctions in layers (gray first, then colored on top)
    const junctionRadius = Math.max(2, 1.5 / zoom);

    // First pass: Draw all gray/default junctions
    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [lat, lon] = junction.ll;
        const [x, y] = coordsToScreen(lat, lon);

        // Skip if not visible
        const margin = 50;
        if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
            return;
        }

        // Only draw if it's a default/gray junction
        if (!(selectedStart && cnn === selectedStart) &&
            !(selectedEnd && cnn === selectedEnd) &&
            currentNode !== cnn &&
            !openSet.has(cnn) &&
            !closedSet.has(cnn)) {

            ctx.fillStyle = getColor('junctions');
            ctx.beginPath();
            ctx.arc(x, y, junctionRadius, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Draw junction ID when zoomed in
        if (zoom > 20) {
            ctx.lineJoin = 'round';
            ctx.lineWidth = 5;
            ctx.miterLimit = 3;
            ctx.fillStyle = getColor('text');
            ctx.strokeStyle = getColor('background');
            ctx.font = `${Math.max(12, zoom / 4)}px Arial`;
            ctx.textAlign = 'center';
            ctx.strokeText(cnn, x, y - junctionRadius - 3);
            ctx.fillText(cnn, x, y - junctionRadius - 3);
        }
    });

    // Second pass: Draw closed set
    closedSet.forEach(cnn => {
        if (!junctions[cnn]) return;

        const [lat, lon] = junctions[cnn].ll;
        const [x, y] = coordsToScreen(lat, lon);

        const margin = 50;
        if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
            return;
        }

        ctx.fillStyle = getColor('closedSet');
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 1.3, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Third pass: Draw open set
    openSet.forEach(cnn => {
        if (!junctions[cnn]) return;

        const [lat, lon] = junctions[cnn].ll;
        const [x, y] = coordsToScreen(lat, lon);

        const margin = 50;
        if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
            return;
        }

        ctx.fillStyle = getColor('openSet');
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 1.8, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Fourth pass: Draw current node
    if (currentNode && junctions[currentNode]) {
        const [lat, lon] = junctions[currentNode].ll;
        const [x, y] = coordsToScreen(lat, lon);

        const margin = 50;
        if (x >= -margin && x <= canvas.width + margin && y >= -margin && y <= canvas.height + margin) {
            ctx.fillStyle = getColor('current');
            ctx.beginPath();
            ctx.arc(x, y, junctionRadius * 2.2, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    // Fifth pass: Draw start/end points
    if (selectedStart && junctions[selectedStart]) {
        const [lat, lon] = junctions[selectedStart].ll;
        const [x, y] = coordsToScreen(lat, lon);

        ctx.fillStyle = getColor('start');
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = getColor('text');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 3, 0, 2 * Math.PI);
        ctx.stroke();
    }

    if (selectedEnd && junctions[selectedEnd]) {
        const [lat, lon] = junctions[selectedEnd].ll;
        const [x, y] = coordsToScreen(lat, lon);

        ctx.fillStyle = getColor('end');
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = getColor('text');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 3, 0, 2 * Math.PI);
        ctx.stroke();
    }

    drawAddresses();

    // Count visible junctions for debugging
    visibleJunctions = Object.keys(junctions).filter(cnn => {
        const [lat, lon] = junctions[cnn].ll;
        const [x, y] = coordsToScreen(lat, lon);
        const margin = 50;
        return x >= -margin && x <= canvas.width + margin && y >= -margin && y <= canvas.height + margin;
    }).length;

    const stats = [
        `Canvas: ${canvas.width}x${canvas.height}`,
        `Rendered ${visibleJunctions} junctions, ${visibleStreets} streets`,
        `Zoom: ${zoom.toFixed(3)}x, Offset: [${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}]`,
    ].join(' | ');

    log(stats);
}

function padCoord(coord) {
    // Pad coordinates to 5 digits with trailing zeros
    return parseInt(coord.toString().padEnd(5, '0'));
}

function preprocessAddresses(rawAddresses) {
    const processed = {};

    Object.entries(rawAddresses).forEach(([streetName, addresses]) => {
        processed[streetName] = {};
        Object.entries(addresses).forEach(([number, coords]) => {
            const [lat, lon] = coords;
            processed[streetName][number] = [padCoord(lat), padCoord(lon)];
        });
    });

    return processed;
}

function preprocessJunctions(rawJunctions) {
    const processed = {};

    Object.entries(rawJunctions).forEach(([cnn, junction]) => {
        const [lat, lon] = junction.ll;
        processed[cnn] = {
            ...junction,
            ll: [padCoord(lat), padCoord(lon)]
        };
    });

    return processed;
}

function resizeCanvas() {
    const container = document.querySelector('.map-container');
    const rect = container.getBoundingClientRect();

    // Set canvas size to match container
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Redraw the map with new dimensions
    fitToView();
}

function loadMap() {
    canvas = document.getElementById('mapCanvas');
    ctx = canvas.getContext('2d');

    if (!canvas || !ctx) {
        log("Error: Could not initialize canvas");
        return;
    }

    // Resize canvas to fill container
    resizeCanvas();

    // Preprocess coordinates to pad trailing zeros
    const processedJunctions = preprocessJunctions(junctions);

    // Replace global junctions with processed ones
    Object.keys(junctions).forEach(key => delete junctions[key]);
    Object.assign(junctions, processedJunctions);

    addresses = preprocessAddresses(addressData);

    bounds = calculateBounds();
    log(`Map bounds: lat ${bounds.minLat.toFixed(0)}-${bounds.maxLat.toFixed(0)}, lon ${bounds.minLon.toFixed(0)}-${bounds.maxLon.toFixed(0)}`);

    setupEventListeners();
    fitToView();
    drawMap();

    document.getElementById('infoPanel').textContent =
        `Street network loaded! ${Object.keys(junctions).length} junctions shown. Click two junctions to set start/end points.`;
}

function setupEventListeners() {
    // Mouse events for pan/zoom
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('click', handleClick);
}

function handleMouseDown(e) {
    isDragging = true;
    lastMouseX = e.offsetX;
    lastMouseY = e.offsetY;
}

function handleMouseMove(e) {
    if (isDragging) {
        const deltaX = e.offsetX - lastMouseX;
        const deltaY = e.offsetY - lastMouseY;

        offsetX += deltaX / zoom;
        offsetY += deltaY / zoom;

        lastMouseX = e.offsetX;
        lastMouseY = e.offsetY;

        drawMap();
    }
}

function handleMouseUp(e) {
    isDragging = false;
}

function handleWheel(e) {
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * zoomFactor));

    // Zoom toward mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Reverse the coordinate transformation to find where the mouse points in
    // the "base" coordinate space (before zoom/pan).

    // First, reverse the zoom transformation
    const baseMouseX = mouseX / zoom - offsetX;
    const baseMouseY = mouseY / zoom - offsetY;

    // The new offset should make baseMouseX,baseMouseY appear at mouseX,mouseY after zoom
    offsetX = mouseX / newZoom - baseMouseX;
    offsetY = mouseY / newZoom - baseMouseY;

    zoom = newZoom;
    drawMap();
}

function handleClick(e) {
    if (isDragging || isPathfinding) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find closest junction
    let closestCNN = null;
    let closestDistance = Infinity;

    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [lat, lon] = junction.ll;
        const [x, y] = coordsToScreen(lat, lon);
        const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));

        if (distance < 15 && distance < closestDistance) {
            closestDistance = distance;
            closestCNN = cnn;
        }
    });

    if (closestCNN) {
        selectJunction(closestCNN);
    }
}

function selectJunction(cnn) {
    if (!selectedStart) {
        selectedStart = parseInt(cnn);
        document.getElementById('infoPanel').textContent =
            `Start point: Junction ${cnn}. Click another junction for the destination.`;
    } else if (!selectedEnd && cnn !== selectedStart) {
        selectedEnd = parseInt(cnn);
        document.getElementById('pathfindBtn').disabled = false;
        document.getElementById('infoPanel').textContent =
            `Route set: ${selectedStart} → ${cnn}. Ready for A* pathfinding!`;
    } else {
        // Reset and start over
        selectedStart = cnn;
        selectedEnd = null;
        document.getElementById('pathfindBtn').disabled = true;
        document.getElementById('infoPanel').textContent =
            `Start point: Junction ${cnn}. Click another junction for the destination.`;
    }

    drawMap();
}

function zoomIn() {
    zoom = Math.min(maxZoom, zoom * 1.5);
    drawMap();
}

function zoomOut() {
    zoom = Math.max(minZoom, zoom / 1.5);
    drawMap();
}

function fitToView() {
    if (!bounds) return;

    // Set a reasonable zoom level
    zoom = 1.0;

    // Center the map
    offsetX = 0;
    offsetY = 0;

    drawMap();
}

function resetSelection() {
    selectedStart = null;
    selectedEnd = null;
    isPathfinding = false;
    openSet.clear();
    closedSet.clear();
    currentNode = null;
    finalPath = [];

    document.getElementById('pathfindBtn').disabled = true;
    document.getElementById('infoPanel').textContent =
        'Selection reset. Click two junctions to set new start/end points.';

    drawMap();
}

// Simple A* implementation for demonstration
async function startPathfinding() {
    if (!selectedStart || !selectedEnd || isPathfinding) return;

    isPathfinding = true;
    document.getElementById('pathfindBtn').disabled = true;

    // Initialize A*
    openSet.clear();
    closedSet.clear();
    finalPath = [];

    const gScore = {};
    const fScore = {};
    const cameFrom = {};

    openSet.add(selectedStart);
    gScore[selectedStart] = 0;
    fScore[selectedStart] = distance(selectedStart, selectedEnd);

    while (openSet.size > 0) {
        // Find node with lowest fScore
        currentNode = Array.from(openSet).reduce((lowest, node) =>
            fScore[node] < fScore[lowest] ? node : lowest
        );

        if (currentNode === selectedEnd) {
            // Reconstruct path with cycle recovery
            let current = selectedEnd;
            const pathSet = new Set();
            const maxPathLength = Object.keys(junctions).length;

            while (current && finalPath.length < maxPathLength) {
                if (pathSet.has(current)) {
                    // Cycle detected - use the path we have so far
                    console.warn(`Circular reference detected at node ${current}. Using partial path.`);
                    break;
                }

                pathSet.add(current);
                finalPath.unshift(current);
                current = cameFrom[current];
            }

            if (finalPath.length >= maxPathLength) {
                console.error("Path reconstruction hit length limit - using partial path");
            }

            // Validate the path we have
            if (finalPath.length > 0) {
                console.log(`Path reconstructed: ${finalPath.join(' -> ')} (${finalPath.length} nodes)`);

                // Optional: Check if we actually reached the start
                if (finalPath[0] !== selectedStart) {
                    console.warn(`Path doesn't reach start node. Got to ${finalPath[0]}, wanted ${selectedStart}`);
                }
            } else {
                console.error("No valid path could be reconstructed");
            }

            break;
        }

        openSet.delete(currentNode);
        closedSet.add(currentNode);

        // Check neighbors
        const neighbors = junctions[currentNode].adj.filter(cnn => junctions[cnn]);
        for (const neighbor of neighbors) {
            if (closedSet.has(neighbor)) continue;

            const tentativeGScore = gScore[currentNode] + distance(currentNode, neighbor);

            if (!openSet.has(neighbor)) {
                // First time visiting this neighbor
                openSet.add(neighbor);
                cameFrom[neighbor] = currentNode;
                gScore[neighbor] = tentativeGScore;
                fScore[neighbor] = gScore[neighbor] + distance(neighbor, selectedEnd);
            } else if (tentativeGScore < (gScore[neighbor] || Infinity)) {
                // Found a better path to this neighbor
                if (cameFrom[neighbor] && cameFrom[neighbor] !== currentNode) {
                    console.log(`Updating parent of ${neighbor} from ${cameFrom[neighbor]} to ${currentNode} (score: ${tentativeGScore} vs ${gScore[neighbor]})`);
                }
                cameFrom[neighbor] = currentNode;
                gScore[neighbor] = tentativeGScore;
                fScore[neighbor] = gScore[neighbor] + distance(neighbor, selectedEnd);
            }
            // If tentativeGScore >= existing gScore, don't update anything
        }

        // Update display
        drawMap();
        document.getElementById('infoPanel').textContent =
            `A* running... Current: ${currentNode} | Open: ${openSet.size} | Closed: ${closedSet.size}`;

        // Brief pause for visualization
        const speed = parseInt(document.getElementById('animationSpeed').value);
        await new Promise(resolve => setTimeout(resolve, speed));
    }

    document.getElementById('infoPanel').textContent =
        finalPath.length > 0 ?
        `Path found! ${finalPath.length} junctions, cost: ${gScore[selectedEnd].toFixed(1)}` :
        'No path found!';

    currentNode = null;
    isPathfinding = false;
    document.getElementById('pathfindBtn').disabled = false;
    drawMap();
}

function distance(cnn1, cnn2) {
    const [lat1, lon1] = junctions[cnn1].ll;
    const [lat2, lon2] = junctions[cnn2].ll;
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2));
}

// Initialize
window.addEventListener('load', () => {
    document.getElementById('infoPanel').textContent =
        'Ready! Click two places to navigate between.';
});

window.addEventListener('load', () => {
    detectColorScheme();
    document.getElementById('pathfindBtn').addEventListener('click', startPathfinding);
    document.getElementById('resetBtn').addEventListener('click', resetSelection);
    document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
    document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
    document.getElementById('fitViewBtn').addEventListener('click', fitToView);
    loadMap();
});

window.addEventListener('resize', () => {
    if (canvas) {
        resizeCanvas();
    }
});
