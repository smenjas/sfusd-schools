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

const colors = {
    light: {
        background: '#fff', // White
        streets: '#bbb', // Light Gray
        junctions: '#ccc', // Light Gray
        start: '#28a745', // Green
        end: '#dc3545', // Red
        current: '#ff6b35', // Orange
        openSet: '#ffc107', // Yellow
        closedSet: '#db1', // Gold
        finalPath: '#0066cc', // Blue
        text: '#000' // Black
    },
    dark: {
        background: '#000', // Black
        streets: '#444', // Dark Gray
        junctions: '#333', // Dark Gray
        start: '#4ade80', // Green
        end: '#f87171', // Salmon
        current: '#fb923c', // Orange
        openSet: '#da3', // Ochre
        closedSet: '#860', // Gold
        finalPath: '#60a5fa', // Blue
        text: '#fff' // White
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

function setLegendColors() {
    for (const key in colors[theme]) {
        const color = colors[theme][key];
        const legend = document.getElementById(`${key}-color`);
        if (!legend) continue;
        legend.style.background = color;
    }
}

function detectColorScheme() {
    // Check if the browser supports the media query
    if (!window.matchMedia) {
        return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');

    // Check if user prefers dark mode
    theme = (media.matches) ? 'dark' : 'light';
    setLegendColors();

    // Listen for changes in color scheme preference
    media.addEventListener('change', (e) => {
        theme = e.matches ? 'dark' : 'light';
        setLegendColors();
        drawMap(); // Redraw with new colors
    });
}

function getColor(colorName) {
    return colors[theme][colorName];
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
    const padding = 0.005;
    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;
    const latPadding = latRange * padding;
    const lonPadding = lonRange * padding;

    return {
        minLat: minLat - latPadding,
        maxLat: maxLat + latPadding,
        minLon: minLon - lonPadding,
        maxLon: maxLon + lonPadding
    };
}

function coordsToScreen(lat, lon) {
    if (!bounds) return [0, 0];

    // Calculate normalized coordinates (0-1)
    const normalizedX = (bounds.maxLon - lon) / (bounds.maxLon - bounds.minLon);
    const normalizedY = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);

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
    const screenX = (baseX - panX) * zoom;
    const screenY = (baseY - panY) * zoom;

    return [screenX, screenY];
}

function screenToCoords(screenX, screenY) {
    if (!bounds) return [0, 0];

    // Reverse zoom and pan
    const baseX = screenX / zoom + panX;
    const baseY = screenY / zoom + panY;

    const normalizedX = baseX / canvas.width;
    const normalizedY = baseY / canvas.height;

    // Reverse the coordinate mapping
    const lon = bounds.maxLon - normalizedX * (bounds.maxLon - bounds.minLon);
    const lat = bounds.maxLat - normalizedY * (bounds.maxLat - bounds.minLat);

    return [lat, lon];
}

function coordsDistance(coords1, coords2) {
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;
    const latDiff = lat2 - lat1;
    const lonDiff = lon2 - lon1;
    return Math.sqrt(Math.pow(latDiff, 2) + Math.pow(lonDiff, 2));
}

function junctionDistance(cnn1, cnn2) {
    const coords1 = junctions[cnn1].ll;
    const coords2 = junctions[cnn2].ll;
    return coordsDistance(coords1, coords2);
}

function invisible(x, y, margin) {
    return x < -margin || x > canvas.width + margin
        || y < -margin || y > canvas.height + margin;
}

function visible(x, y, margin) {
    return !invisible(x, y, margin);
}

function lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Check if two line segments intersect using the cross product method
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return false; // Lines are parallel

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function lineIntersectsRect(x1, y1, x2, y2, rectLeft, rectTop, rectRight, rectBottom) {
    // Check if either endpoint is inside the rectangle
    if ((x1 >= rectLeft && x1 <= rectRight && y1 >= rectTop && y1 <= rectBottom) ||
        (x2 >= rectLeft && x2 <= rectRight && y2 >= rectTop && y2 <= rectBottom)) {
        return true;
    }

    // Check if line segment intersects any of the four rectangle edges
    return (
        lineIntersectsLine(x1, y1, x2, y2, rectLeft, rectTop, rectRight, rectTop) ||    // Top edge
        lineIntersectsLine(x1, y1, x2, y2, rectRight, rectTop, rectRight, rectBottom) || // Right edge
        lineIntersectsLine(x1, y1, x2, y2, rectRight, rectBottom, rectLeft, rectBottom) || // Bottom edge
        lineIntersectsLine(x1, y1, x2, y2, rectLeft, rectBottom, rectLeft, rectTop)     // Left edge
    );
}

function segmentIsVisible(x1, y1, x2, y2, margin = 100) {
    // Check if line segment intersects with viewport (including margin)
    const rectLeft = -margin;
    const rectTop = -margin;
    const rectRight = canvas.width + margin;
    const rectBottom = canvas.height + margin;

    return lineIntersectsRect(x1, y1, x2, y2, rectLeft, rectTop, rectRight, rectBottom);
}

function drawStreets() {
    let visibleStreets = 0;
    ctx.strokeStyle = getColor('streets');
    ctx.lineWidth = Math.max(1.5, zoom / 3);
    ctx.beginPath();

    const drawnConnections = new Set();
    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [lat1, lon1] = junction.ll;
        const [x1, y1] = coordsToScreen(lat1, lon1);

        for (const adjCNN of junction.adj) {
            if (!junctions[adjCNN]) continue;

            const connectionKey = [cnn, adjCNN].sort().join('-');
            if (drawnConnections.has(connectionKey)) continue;

            drawnConnections.add(connectionKey);

            const [lat2, lon2] = junctions[adjCNN].ll;
            const [x2, y2] = coordsToScreen(lat2, lon2);

            if (!segmentIsVisible(x1, y1, x2, y2, 100)) {
                continue;
            }

            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            visibleStreets++;
        }
    });

    ctx.stroke();
    return visibleStreets;
}

function drawJunctions() {
    let visibleJunctions = 0;
    const radius = Math.max(0.5, zoom / 2.5);
    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [lat, lon] = junction.ll;
        const [x, y] = coordsToScreen(lat, lon);

        // Skip if not visible
        if (invisible(x, y, 50)) return;
        visibleJunctions++;

        // Determine color and size
        let color = getColor('junctions');
        let junctionRadius = radius;

        if (selectedStart && cnn === selectedStart) {
            color = getColor('start');
            junctionRadius = radius * 3;
        } else if (selectedEnd && cnn === selectedEnd) {
            color = getColor('end');
            junctionRadius = radius * 3;
        } else if (currentNode === cnn) {
            color = getColor('current');
            junctionRadius = radius * 7;
        } else if (openSet.has(cnn)) {
            color = getColor('openSet');
            junctionRadius = radius * 2.5
        } else if (closedSet.has(cnn)) {
            color = getColor('closedSet');
            junctionRadius = radius * 2;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius, 0, 2 * Math.PI);
        ctx.fill();
    });

    return visibleJunctions;
}

function drawJunctionLabels() {
    if (zoom < 20) return;

    const radius = Math.max(2, 1 / zoom);
    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [lat, lon] = junction.ll;
        const [x, y] = coordsToScreen(lat, lon);

        // Skip if not visible
        if (invisible(x, y, 50)) return;

        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.miterLimit = 3;
        ctx.fillStyle = getColor('text');
        ctx.strokeStyle = getColor('background');
        ctx.font = `${Math.max(12, zoom / 4)}px Arial`;
        ctx.textAlign = 'center';
        ctx.strokeText(cnn, x, y - radius - 3);
        ctx.fillText(cnn, x, y - radius - 3);
    });
}

function drawMap() {
    if (!canvas || !ctx || !bounds) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background using theme color
    ctx.fillStyle = getColor('background');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const visibleStreets = drawStreets();
    const visibleJunctions = drawJunctions();
    drawFinalPath();
    drawJunctionLabels();

    const stats = [
        `Canvas: ${canvas.width}x${canvas.height}`,
        `Rendered ${visibleJunctions} junctions, ${visibleStreets} streets`,
        `Zoom: ${zoom.toFixed(3)}x, Pan: [${panX.toFixed(1)}, ${panY.toFixed(1)}]`,
    ].join(' | ');

    log(stats);
}

function drawFinalPath() {
    if (finalPath.length < 2) return;

    ctx.strokeStyle = getColor('finalPath');
    ctx.lineWidth = Math.max(3, zoom / 1.25);
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

function padCoord(coord) {
    // Pad coordinates to 5 digits with trailing zeros
    return parseInt(coord.toString().padEnd(5, '0'));
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

    bounds = calculateBounds();
    console.log(`Map bounds: lat 37.${bounds.minLat.toFixed(0)} - 37.${bounds.maxLat.toFixed(0)}, lon -122.${bounds.minLon.toFixed(0)} - -122.${bounds.maxLon.toFixed(0)}`);

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
    if (!isDragging) return;

    const deltaX = e.offsetX - lastMouseX;
    const deltaY = e.offsetY - lastMouseY;

    panX -= deltaX / zoom;
    panY -= deltaY / zoom;

    lastMouseX = e.offsetX;
    lastMouseY = e.offsetY;

    drawMap();
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
    const baseMouseX = mouseX / newZoom - panX;
    const baseMouseY = mouseY / newZoom - panY;

    // Pan baseMouseX,baseMouseY to mouseX,mouseY after zoom
    panX = mouseX / zoom - baseMouseX;
    panY = mouseY / zoom - baseMouseY;

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
        const distance = coordsDistance([y, x], [mouseY, mouseX]);

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
        document.getElementById('findPathBtn').disabled = false;
        document.getElementById('infoPanel').textContent =
            `Route set: ${selectedStart} → ${cnn}. Ready for A* pathfinding!`;
    } else {
        // Reset selection
        selectedStart = parseInt(cnn);
        selectedEnd = null;
        document.getElementById('findPathBtn').disabled = true;
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

    document.getElementById('findPathBtn').disabled = true;
    document.getElementById('infoPanel').textContent =
        'Selection reset. Click two junctions to set new start/end points.';

    drawMap();
}

function checkNeighbors(gScore, fScore, cameFrom) {
    const neighbors = junctions[currentNode].adj.filter(cnn => junctions[cnn]);
    for (const neighbor of neighbors) {
        if (closedSet.has(neighbor)) continue;

        const tentativeGScore = gScore[currentNode] + junctionDistance(currentNode, neighbor);

        if (!openSet.has(neighbor)) {
            // First time visiting this neighbor
            openSet.add(neighbor);
            cameFrom[neighbor] = currentNode;
            gScore[neighbor] = tentativeGScore;
            fScore[neighbor] = gScore[neighbor] + junctionDistance(neighbor, selectedEnd);
        } else if (tentativeGScore < (gScore[neighbor] || Infinity)) {
            // Found a better path to this neighbor
            cameFrom[neighbor] = currentNode;
            gScore[neighbor] = tentativeGScore;
            fScore[neighbor] = gScore[neighbor] + junctionDistance(neighbor, selectedEnd);
        }
        // If tentativeGScore >= existing gScore, don't update anything
    }
}

function reconstructPath(cameFrom) {
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
    if (!finalPath.length) {
        console.error("No valid path could be reconstructed");
    }

    console.log(`Path reconstructed: ${finalPath.join(' -> ')} (${finalPath.length} nodes)`);

    // Optional: Check if we actually reached the start
    if (finalPath[0] !== selectedStart) {
        console.warn(`Path doesn't reach start node. Got to ${finalPath[0]}, wanted ${selectedStart}`);
    }
}

async function findPath() {
    if (!selectedStart || !selectedEnd || isPathfinding) return;

    isPathfinding = true;
    document.getElementById('findPathBtn').disabled = true;

    // Initialize A*
    openSet.clear();
    closedSet.clear();
    finalPath = [];

    const gScore = {};
    const fScore = {};
    const cameFrom = {};

    openSet.add(selectedStart);
    gScore[selectedStart] = 0;
    fScore[selectedStart] = junctionDistance(selectedStart, selectedEnd);

    while (openSet.size > 0) {
        // Find node with lowest fScore
        currentNode = Array.from(openSet).reduce((lowest, node) =>
            fScore[node] < fScore[lowest] ? node : lowest
        );

        if (currentNode === selectedEnd) {
            reconstructPath(cameFrom);
            break;
        }

        openSet.delete(currentNode);
        closedSet.add(currentNode);

        checkNeighbors(gScore, fScore, cameFrom);

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
    document.getElementById('findPathBtn').disabled = false;
    drawMap();
}

// Initialize
window.addEventListener('load', () => {
    document.getElementById('infoPanel').textContent =
        'Ready! Click two places to navigate between.';
});

window.addEventListener('load', () => {
    detectColorScheme();
    document.getElementById('findPathBtn').addEventListener('click', findPath);
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
