import junctions from './junctions.js';

// Map state
let canvas, ctx;
let bounds = null;
let zoom = 1;
let panX = 0, panY = 0;
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

// A* state
let openSet = new Set();
let closedSet = new Set();
let currentNode = null;
let finalPath = [];
let gScore = {};
let fScore = {};
let cameFrom = {};

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

function calculateBounds() {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    Object.values(junctions).forEach(junction => {
        const [y, x] = junction.ll;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    });

    // Add padding
    const paddingX = (maxX - minX) * 0.1;
    const paddingY = (maxY - minY) * 0.1;

    return {
        minX: minX - paddingX,
        maxX: maxX + paddingX,
        minY: minY - paddingY,
        maxY: maxY + paddingY
    };
}

function coordToScreen(lat, lng) {
    if (!bounds) return [0, 0];

    const baseX = ((lng - bounds.minX) / (bounds.maxX - bounds.minX)) * canvas.width;
    const baseY = ((bounds.maxY - lat) / (bounds.maxY - bounds.minY)) * canvas.height;

    // Apply zoom and pan
    const x = (baseX - panX) * zoom;
    const y = (baseY - panY) * zoom;

    return [x, y];
}

function screenToCoord(screenX, screenY) {
    if (!bounds) return [0, 0];

    // Reverse zoom and pan
    const baseX = (screenX / zoom) + panX;
    const baseY = (screenY / zoom) + panY;

    const lng = (baseX / canvas.width) * (bounds.maxX - bounds.minX) + bounds.minX;
    const lat = bounds.maxY - (baseY / canvas.height) * (bounds.maxY - bounds.minY);

    return [lat, lng];
}

function distance(id1, id2) {
    const [lat1, lng1] = junctions[id1].ll;
    const [lat2, lng2] = junctions[id2].ll;
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
}

function heuristic(id1, id2) {
    return distance(id1, id2);
}

function drawMap() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background using theme color
    ctx.fillStyle = getColor('background');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const minSize = Math.max(1, 0.5 / zoom);
    const junctionRadius = Math.max(2, 1 / zoom);

    // Draw streets
    ctx.strokeStyle = getColor('streets');
    ctx.lineWidth = Math.max(1, 0.5 / zoom);
    ctx.beginPath();

    const drawnConnections = new Set();
    Object.entries(junctions).forEach(([junctionId, junction]) => {
        const [lat1, lng1] = junction.ll;
        const [x1, y1] = coordToScreen(lat1, lng1);

        // Viewport culling
        if (x1 < -50 || x1 > canvas.width + 50 || y1 < -50 || y1 > canvas.height + 50) {
            return;
        }

        junction.adj.forEach(adjId => {
            if (junctions[adjId]) {
                const connectionKey = [junctionId, adjId].sort().join('-');
                if (!drawnConnections.has(connectionKey)) {
                    drawnConnections.add(connectionKey);

                    const [lat2, lng2] = junctions[adjId].ll;
                    const [x2, y2] = coordToScreen(lat2, lng2);

                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                }
            }
        });
    });
    ctx.stroke();

    // Draw A* visualization layers
    drawFinalPath();

    // Draw junctions
    Object.entries(junctions).forEach(([junctionId, junction]) => {
        const [lat, lng] = junction.ll;
        const [x, y] = coordToScreen(lat, lng);

        // Skip if not visible
        const margin = 20;
        if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
            return;
        }

        // Determine color and size
        let color = getColor('streets');
        let radius = junctionRadius;

        if (selectedStart && junctionId === selectedStart) {
            color = getColor('start');
            radius = junctionRadius * 3;
        } else if (selectedEnd && junctionId === selectedEnd) {
            color = getColor('end');
            radius = junctionRadius * 3;
        } else if (currentNode === junctionId) {
            color = getColor('current');
            radius = junctionRadius * 2;
        } else if (openSet.has(junctionId)) {
            color = getColor('openSet');
            radius = junctionRadius * 1.5;
        } else if (closedSet.has(junctionId)) {
            color = getColor('closedSet');
            radius = junctionRadius * 1.2;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function drawFinalPath() {
    if (finalPath.length < 2) return;

    ctx.strokeStyle = getColor('finalPath');
    ctx.lineWidth = Math.max(4 / zoom, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < finalPath.length - 1; i++) {
        const [lat1, lng1] = junctions[finalPath[i]].ll;
        const [lat2, lng2] = junctions[finalPath[i + 1]].ll;
        const [x1, y1] = coordToScreen(lat1, lng1);
        const [x2, y2] = coordToScreen(lat2, lng2);

        if (i === 0) {
            ctx.moveTo(x1, y1);
        }
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();
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

    bounds = calculateBounds();

    setupEventListeners();
    fitToView();
    drawMap();

    document.getElementById('infoPanel').textContent =
        `Street network loaded! ${Object.keys(junctions).length} junctions shown. Click two junctions to set start/end points.`;
    updateStats();
}

function setupEventListeners() {
    // Mouse events for pan/zoom
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('click', handleClick);

    // Prevent context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());
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

        panX -= deltaX / zoom;
        panY -= deltaY / zoom;

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
    const newZoom = Math.max(1.0, Math.min(20, zoom * zoomFactor));

    // Zoom toward mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    panX = mouseX / zoom - (mouseX / newZoom - panX);
    panY = mouseY / zoom - (mouseY / newZoom - panY);

    zoom = newZoom;
    drawMap();
    updateStats();
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
        const [x, y] = coordToScreen(lat, lng);
        const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));

        if (distance < 20 && distance < closestDistance) {
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
        selectedStart = junctionId;
        document.getElementById('infoPanel').textContent =
            `Start point selected at junction ${junctionId}. Click another junction for the end point.`;
    } else if (!selectedEnd && junctionId !== selectedStart) {
        selectedEnd = junctionId;
        document.getElementById('pathfindBtn').disabled = false;
        document.getElementById('infoPanel').textContent =
            `End point selected at junction ${junctionId}. Ready for A* pathfinding!`;
    } else {
        // Reset selection
        selectedStart = junctionId;
        selectedEnd = null;
        document.getElementById('pathfindBtn').disabled = true;
        document.getElementById('infoPanel').textContent =
            `Start point reset to junction ${junctionId}. Click another junction for the end point.`;
    }

    drawMap();
}

function zoomIn() {
    zoom = Math.min(20, zoom * 1.5);
    drawMap();
    updateStats();
}

function zoomOut() {
    zoom = Math.max(1.0, zoom / 1.5);
    drawMap();
    updateStats();
}

function fitToView() {
    if (!bounds) return;

    // Set a reasonable zoom level
    zoom = 1.0;

    // Center the map
    panX = 0;
    panY = 0;

    drawMap();
    updateStats();
}

function resetSelection() {
    selectedStart = null;
    selectedEnd = null;
    isPathfinding = false;
    openSet.clear();
    closedSet.clear();
    currentNode = null;
    finalPath = [];
    gScore = {};
    fScore = {};
    cameFrom = {};

    document.getElementById('pathfindBtn').disabled = true;
    document.getElementById('infoPanel').textContent =
        'Selection reset. Click two junctions to set new start/end points.';

    drawMap();
    updateStats();
}

function updateSpeed() {
    animationSpeed = parseInt(document.getElementById('speedControl').value);
}

function updateStats() {
    const stats = document.getElementById('statsPanel');
    stats.textContent = `Zoom: ${zoom.toFixed(2)}x | Junctions: ${Object.keys(junctions).length} | ` +
                       `Open: ${openSet.size} | Closed: ${closedSet.size}`;
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
    gScore = {};
    fScore = {};
    cameFrom = {};

    openSet.add(selectedStart);
    gScore[selectedStart] = 0;
    fScore[selectedStart] = heuristic(selectedStart, selectedEnd);

    while (openSet.size > 0) {
        // Find node in openSet with lowest fScore
        currentNode = Array.from(openSet).reduce((lowest, node) =>
            fScore[node] < fScore[lowest] ? node : lowest
        );

        if (currentNode === selectedEnd) {
            // Path found - reconstruct
            reconstructPath(selectedEnd);
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

        // Update display
        drawMap();
        updateStats();
        document.getElementById('infoPanel').textContent =
            `A* running... Current: ${currentNode} | Open: ${openSet.size} | Closed: ${closedSet.size}`;

        // Yield control to prevent blocking
        await new Promise(resolve => setTimeout(resolve, animationSpeed));
    }

    document.getElementById('infoPanel').textContent =
        finalPath.length > 0 ?
        `Path found! ${finalPath.length} junctions, cost: ${gScore[selectedEnd].toFixed(2)}` :
        'No path found!';

    isPathfinding = false;
    document.getElementById('pathfindBtn').disabled = false;
}

function reconstructPath(endId) {
    finalPath = [];
    let current = endId;

    while (current !== undefined) {
        finalPath.unshift(current);
        current = cameFrom[current];
    }

    drawMap();
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
