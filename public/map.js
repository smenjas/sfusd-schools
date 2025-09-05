import junctions from './junctions.js';

// Map state
let canvas, ctx;
let bounds = null;
let zoom = 1;
const minZoom = 1.0;
const maxZoom = 100;
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

// A* visualization state
let openSet = new Set();
let closedSet = new Set();
let currentNode = null;
let finalPath = [];
let gScore = {};
let fScore = {};
let cameFrom = {};

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

function coordsToScreen(lat, lon) {
    if (!bounds) return [0, 0];

    const baseX = ((lon - bounds.minX) / (bounds.maxX - bounds.minX)) * canvas.width;
    const baseY = ((bounds.maxY - lat) / (bounds.maxY - bounds.minY)) * canvas.height;

    // Apply zoom and pan
    const x = (baseX - panX) * zoom;
    const y = (baseY - panY) * zoom;

    return [x, y];
}

function screenToCoords(screenX, screenY) {
    if (!bounds) return [0, 0];

    // Reverse zoom and pan
    const baseX = (screenX / zoom) + panX;
    const baseY = (screenY / zoom) + panY;

    const lon = (baseX / canvas.width) * (bounds.maxX - bounds.minX) + bounds.minX;
    const lat = bounds.maxY - (baseY / canvas.height) * (bounds.maxY - bounds.minY);

    return [lat, lon];
}

function distance(id1, id2) {
    const [lat1, lon1] = junctions[id1].ll;
    const [lat2, lon2] = junctions[id2].ll;
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2));
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

    const minSize = Math.max(1 / zoom, 0.5);
    const junctionRadius = Math.max(2 / zoom, 1);

    // Draw streets
    ctx.strokeStyle = getColor('streets');
    ctx.lineWidth = Math.max(1 / zoom, 0.5);
    ctx.beginPath();

    const drawnConnections = new Set();
    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [lat1, lon1] = junction.ll;
        const [x1, y1] = coordsToScreen(lat1, lon1);

        // Viewport culling
        if (x1 < -50 || x1 > canvas.width + 50 || y1 < -50 || y1 > canvas.height + 50) {
            return;
        }

        junction.adj.forEach(adjCNN => {
            if (junctions[adjCNN]) {
                const connectionKey = [cnn, adjCNN].sort().join('-');
                if (!drawnConnections.has(connectionKey)) {
                    drawnConnections.add(connectionKey);

                    const [lat2, lon2] = junctions[adjCNN].ll;
                    const [x2, y2] = coordsToScreen(lat2, lon2);

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
    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [lat, lon] = junction.ll;
        const [x, y] = coordsToScreen(lat, lon);

        // Skip if not visible
        const margin = 20;
        if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
            return;
        }

        // Determine color and size
        let color = getColor('streets');
        let radius = junctionRadius;

        if (selectedStart && cnn === selectedStart) {
            color = getColor('start');
            radius = junctionRadius * 3;
        } else if (selectedEnd && cnn === selectedEnd) {
            color = getColor('end');
            radius = junctionRadius * 3;
        } else if (currentNode === cnn) {
            color = getColor('current');
            radius = junctionRadius * 2;
        } else if (openSet.has(cnn)) {
            color = getColor('openSet');
            radius = junctionRadius * 1.5;
        } else if (closedSet.has(cnn)) {
            color = getColor('closedSet');
            radius = junctionRadius * 1.2;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
    });

    const stats = [
        `Zoom: ${zoom.toFixed(2)}x | Junctions: ${Object.keys(junctions).length} | `,
        `Open: ${openSet.size} | Closed: ${closedSet.size}`
    ].join(' | ');

    log(stats);
}

function drawFinalPath() {
    if (finalPath.length < 2) return;

    ctx.strokeStyle = getColor('finalPath');
    ctx.lineWidth = Math.max(4 / zoom, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < finalPath.length - 1; i++) {
        const [lat1, lon1] = junctions[finalPath[i]].ll;
        const [lat2, lon2] = junctions[finalPath[i + 1]].ll;
        const [x1, y1] = coordsToScreen(lat1, lon1);
        const [x2, y2] = coordsToScreen(lat2, lon2);

        if (i === 0) {
            ctx.moveTo(x1, y1);
        }
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();
}

function loadMap() {
    canvas = document.getElementById('mapCanvas');
    ctx = canvas.getContext('2d');

    if (!canvas || !ctx) {
        log("Error: Could not initialize canvas");
        return;
    }

    bounds = calculateBounds();

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
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * zoomFactor));

    // Zoom toward mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    panX = mouseX / zoom - (mouseX / newZoom - panX);
    panY = mouseY / zoom - (mouseY / newZoom - panY);

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

        if (distance < 20 && distance < closestDistance) {
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
        selectedStart = cnn;
        document.getElementById('infoPanel').textContent =
            `Start point selected at junction ${cnn}. Click another junction for the end point.`;
    } else if (!selectedEnd && cnn !== selectedStart) {
        selectedEnd = cnn;
        document.getElementById('pathfindBtn').disabled = false;
        document.getElementById('infoPanel').textContent =
            `End point selected at junction ${cnn}. Ready for A* pathfinding!`;
    } else {
        // Reset selection
        selectedStart = cnn;
        selectedEnd = null;
        document.getElementById('pathfindBtn').disabled = true;
        document.getElementById('infoPanel').textContent =
            `Start point reset to junction ${cnn}. Click another junction for the end point.`;
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
    panX = 0;
    panY = 0;

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
    gScore = {};
    fScore = {};
    cameFrom = {};

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
    gScore = {};
    fScore = {};
    cameFrom = {};

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
        const neighbors = junctions[currentNode].adj.filter(cnn => junctions[cnn]);
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
        document.getElementById('infoPanel').textContent =
            `A* running... Current: ${currentNode} | Open: ${openSet.size} | Closed: ${closedSet.size}`;

        // Brief pause for visualization
        const speed = parseInt(document.getElementById('animationSpeed').value);
        await new Promise(resolve => setTimeout(resolve, speed));
    }

    document.getElementById('infoPanel').textContent =
        finalPath.length > 0 ?
        `Path found! ${finalPath.length} junctions, cost: ${gScore[selectedEnd].toFixed(2)}` :
        'No path found!';

    currentNode = null;
    isPathfinding = false;
    document.getElementById('pathfindBtn').disabled = false;
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
