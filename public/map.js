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

function calculateMapBounds() {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    Object.values(junctions).forEach(junction => {
        const [lat, lng] = junction.ll;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    });

    // Add padding
    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    const padding = 0.05;

    return {
        minLat: minLat - latRange * padding,
        maxLat: maxLat + latRange * padding,
        minLng: minLng - lngRange * padding,
        maxLng: maxLng + lngRange * padding
    };
}

function latLngToScreen(lat, lng) {
    if (!bounds) return [0, 0];

    // Convert lat/lng to normalized 0-1 coordinates
    const normalizedX = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
    const normalizedY = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);

    // Convert to base screen coordinates (before zoom/pan)
    const baseX = normalizedX * canvas.width;
    const baseY = normalizedY * canvas.height;

    // Apply zoom and pan
    const screenX = (baseX + offsetX) * zoom;
    const screenY = (baseY + offsetY) * zoom;

    return [screenX, screenY];
}

function screenToLatLng(screenX, screenY) {
    if (!bounds) return [0, 0];

    // Reverse the transformation
    const normalizedX = (screenX / zoom - offsetX) / canvas.width;
    const normalizedY = (screenY / zoom - offsetY) / canvas.height;

    const lng = normalizedX * (bounds.maxLng - bounds.minLng) + bounds.minLng;
    const lat = bounds.maxLat - normalizedY * (bounds.maxLat - bounds.minLat);

    return [lat, lng];
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
    Object.entries(junctions).forEach(([junctionId, junction]) => {
        const [lat1, lng1] = junction.ll;
        const [x1, y1] = latLngToScreen(lat1, lng1);

        junction.adj.forEach(adjId => {
            if (junctions[adjId]) {
                const connectionKey = [junctionId, adjId].sort().join('-');
                if (!drawnConnections.has(connectionKey)) {
                    drawnConnections.add(connectionKey);

                    const [lat2, lng2] = junctions[adjId].ll;
                    const [x2, y2] = latLngToScreen(lat2, lng2);

                    // Only draw if at least one point is visible
                    const margin = 50;
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

        const [startLat, startLng] = junctions[finalPath[0]].ll;
        const [startX, startY] = latLngToScreen(startLat, startLng);
        ctx.moveTo(startX, startY);

        for (let i = 1; i < finalPath.length; i++) {
            const [lat, lng] = junctions[finalPath[i]].ll;
            const [x, y] = latLngToScreen(lat, lng);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Draw junctions
    const junctionRadius = Math.max(3, 2 / zoom);
    Object.entries(junctions).forEach(([junctionId, junction]) => {
        const [lat, lng] = junction.ll;
        const [x, y] = latLngToScreen(lat, lng);

        // Skip if not visible
        const margin = 20;
        if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
            return;
        }
        visibleJunctions++;

        // Determine color and size
        let color = getColor('streets');
        let radius = junctionRadius;

        if (selectedStart && junctionId === selectedStart) {
            color = getColor('start');
            radius = junctionRadius * 2;
        } else if (selectedEnd && junctionId === selectedEnd) {
            color = getColor('end');
            radius = junctionRadius * 2;
        } else if (currentNode === junctionId) {
            color = getColor('current');
            radius = junctionRadius * 1.5;
        } else if (openSet.has(junctionId)) {
            color = getColor('openSet');
            radius = junctionRadius * 1.2;
        } else if (closedSet.has(junctionId)) {
            color = getColor('closedSet');
            radius = junctionRadius * 1.1;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Draw junction ID when zoomed in
        if (zoom > 12) {
            ctx.lineJoin = 'round';
            ctx.lineWidth = 5;
            ctx.miterLimit = 3;
            ctx.fillStyle = getColor('text');
            ctx.strokeStyle = getColor('background');
            ctx.font = `${Math.max(12, zoom / 4)}px Arial`;
            ctx.textAlign = 'center';
            ctx.strokeText(junctionId, x, y - junctionRadius - 3);
            ctx.fillText(junctionId, x, y - junctionRadius - 3);
        }
    });

    const stats = [
        `Rendered ${visibleJunctions} junctions, ${visibleStreets} streets`,
        `Zoom: ${zoom.toFixed(2)}x`
    ].join(' | ');

    log(stats);
}

function padCoordinate(coord) {
    // Pad coordinates to 5 digits with trailing zeros
    return parseInt(coord.toString().padEnd(5, '0'));
}

function preprocessJunctions(rawJunctions) {
    const processed = {};

    Object.entries(rawJunctions).forEach(([id, junction]) => {
        const [lat, lng] = junction.ll;
        processed[id] = {
            ...junction,
            ll: [padCoordinate(lat), padCoordinate(lng)]
        };
    });

    return processed;
}

function loadMap() {
    canvas = document.getElementById('mapCanvas');
    ctx = canvas.getContext('2d');

    if (!canvas || !ctx) {
        log("Error: Could not initialize canvas");
        return;
    }

    // Preprocess coordinates to pad trailing zeros
    const processedJunctions = preprocessJunctions(junctions);

    // Replace global junctions with processed ones
    Object.keys(junctions).forEach(key => delete junctions[key]);
    Object.assign(junctions, processedJunctions);

    bounds = calculateMapBounds();
    log(`Map bounds: lat ${bounds.minLat.toFixed(0)}-${bounds.maxLat.toFixed(0)}, lng ${bounds.minLng.toFixed(0)}-${bounds.maxLng.toFixed(0)}`);

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
    let closestId = null;
    let closestDistance = Infinity;

    Object.entries(junctions).forEach(([id, junction]) => {
        const [lat, lng] = junction.ll;
        const [x, y] = latLngToScreen(lat, lng);
        const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));

        if (distance < 15 && distance < closestDistance) {
            closestDistance = distance;
            closestId = id;
        }
    });

    if (closestId) {
        selectJunction(closestId);
    }
}

function selectJunction(junctionId) {
    if (!selectedStart) {
        selectedStart = parseInt(junctionId);
        document.getElementById('infoPanel').textContent =
            `Start point: Junction ${junctionId}. Click another junction for the destination.`;
    } else if (!selectedEnd && junctionId !== selectedStart) {
        selectedEnd = parseInt(junctionId);
        document.getElementById('pathfindBtn').disabled = false;
        document.getElementById('infoPanel').textContent =
            `Route set: ${selectedStart} → ${junctionId}. Ready for A* pathfinding!`;
    } else {
        // Reset and start over
        selectedStart = junctionId;
        selectedEnd = null;
        document.getElementById('pathfindBtn').disabled = true;
        document.getElementById('infoPanel').textContent =
            `Start point: Junction ${junctionId}. Click another junction for the destination.`;
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
    fScore[selectedStart] = heuristic(selectedStart, selectedEnd);

    while (openSet.size > 0) {
        // Find node with lowest fScore
        currentNode = Array.from(openSet).reduce((lowest, node) =>
            fScore[node] < fScore[lowest] ? node : lowest
        );

        if (currentNode === selectedEnd) {
            // Reconstruct path
            let current = selectedEnd;
            while (current) {
                finalPath.unshift(current);
                current = cameFrom[current];
            }
            break;
        }

        openSet.delete(currentNode);
        closedSet.add(currentNode);

        // Check neighbors
        const neighbors = junctions[currentNode].adj.filter(id => junctions[id]);
        for (const neighbor of neighbors) {
            if (closedSet.has(neighbor)) continue;

            const tentativeGScore = gScore[currentNode] + distance(currentNode, neighbor);

            if (!openSet.has(neighbor)) {
                openSet.add(neighbor);
            } else if (tentativeGScore >= (gScore[neighbor] || Infinity)) {
                continue;
            }

            cameFrom[neighbor] = currentNode;
            gScore[neighbor] = tentativeGScore;
            fScore[neighbor] = gScore[neighbor] + heuristic(neighbor, selectedEnd);
        }

        // Update visualization
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

function distance(id1, id2) {
    const [lat1, lng1] = junctions[id1].ll;
    const [lat2, lng2] = junctions[id2].ll;
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
}

function heuristic(id1, id2) {
    return distance(id1, id2); // Euclidean distance
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
