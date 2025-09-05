import junctions from './junctions.js';

// Map state
let canvas, ctx;
let mapBounds = null;
let zoom = 1;
const minZoom = 1.0;
const maxZoom = 100;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;
let selectedStart = null;
let selectedEnd = null;
let isPathfinding = false;

// A* visualization state
let openSet = new Set();
let closedSet = new Set();
let currentNode = null;
let finalPath = [];

function log(message) {
    console.log(message);
    document.getElementById('debugPanel').textContent = message;
}

function calculateMapBounds(junctionData = junctions) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    Object.values(junctionData).forEach(junction => {
        const [lat, lng] = junction.ll;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    });

    // Add 5% padding
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
    if (!mapBounds) return [0, 0];

    // Calculate normalized coordinates (0-1)
    const normalizedX = (mapBounds.maxLng - lng) / (mapBounds.maxLng - mapBounds.minLng);
    const normalizedY = (mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat);

    // Don't apply aspect correction here - we'll handle it in the display calculations

    // Calculate the actual geographic aspect ratio of SF
    // At SF's latitude, 1° longitude ≈ 0.79 × 1° latitude in distance
    // So our map's natural width/height ratio should be: lng_range * 0.79 / lat_range
    const lngRange = mapBounds.maxLng - mapBounds.minLng;
    const latRange = mapBounds.maxLat - mapBounds.minLat;
    const mapAspectRatio = (lngRange * 0.79) / latRange;

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

function screenToLatLng(screenX, screenY) {
    if (!mapBounds) return [0, 0];

    // Reverse the transformation
    const normalizedX = (screenX / zoom - offsetX) / canvas.width;
    const normalizedY = (screenY / zoom - offsetY) / canvas.height;

    // Reverse the coordinate mapping
    const lng = mapBounds.maxLng - normalizedX * (mapBounds.maxLng - mapBounds.minLng);
    const lat = mapBounds.maxLat - normalizedY * (mapBounds.maxLat - mapBounds.minLat);

    return [lat, lng];
}

function drawMap() {
    if (!canvas || !ctx || !mapBounds) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let visibleJunctions = 0;
    let visibleStreets = 0;
    let totalJunctions = 0;
    let sampleCoords = []; // Debug: collect some coordinates

    // Draw streets
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = Math.max(2, 1 / zoom);
    ctx.beginPath();

    const drawnConnections = new Set();
    Object.entries(junctions).forEach(([junctionId, junction]) => {
        const [lat1, lng1] = junction.ll;
        const [x1, y1] = latLngToScreen(lat1, lng1);

        totalJunctions++;

        // Collect sample coordinates for debugging
        if (sampleCoords.length < 5) {
            sampleCoords.push(`${junctionId}: [${lat1}, ${lng1}] -> [${x1.toFixed(1)}, ${y1.toFixed(1)}]`);
        }

        junction.adj.forEach(adjId => {
            if (junctions[adjId]) {
                const connectionKey = [junctionId, adjId].sort().join('-');
                if (!drawnConnections.has(connectionKey)) {
                    drawnConnections.add(connectionKey);

                    const [lat2, lng2] = junctions[adjId].ll;
                    const [x2, y2] = latLngToScreen(lat2, lng2);

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
        ctx.strokeStyle = '#0066cc';
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

    // Draw junctions in layers (gray first, then colored on top)
    const junctionRadius = Math.max(2, 1.5 / zoom); // Much smaller default size

    // First pass: Draw all gray/default junctions
    Object.entries(junctions).forEach(([junctionId, junction]) => {
        const [lat, lng] = junction.ll;
        const [x, y] = latLngToScreen(lat, lng);

        // Skip if not visible
        const margin = 50;
        if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
            return;
        }

        // Only draw if it's a default/gray junction
        if (!(selectedStart && junctionId === selectedStart) &&
            !(selectedEnd && junctionId === selectedEnd) &&
            currentNode !== junctionId &&
            !openSet.has(junctionId) &&
            !closedSet.has(junctionId)) {

            ctx.fillStyle = '#333333';
            ctx.beginPath();
            ctx.arc(x, y, junctionRadius, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Draw junction ID when zoomed in
        if (zoom > 12) {
            ctx.lineJoin = 'round';
            ctx.lineWidth = 5;
            ctx.miterLimit = 3;
            ctx.fillStyle = '#000000';
            ctx.strokeStyle = '#ffffff';
            ctx.font = `${Math.max(12, zoom / 4)}px Arial`;
            ctx.textAlign = 'center';
            ctx.strokeText(junctionId, x, y - junctionRadius - 3);
            ctx.fillText(junctionId, x, y - junctionRadius - 3);
        }
    });

    // Second pass: Draw closed set (gray but part of algorithm)
    closedSet.forEach(junctionId => {
        if (!junctions[junctionId]) return;

        const [lat, lng] = junctions[junctionId].ll;
        const [x, y] = latLngToScreen(lat, lng);

        const margin = 50;
        if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
            return;
        }

        ctx.fillStyle = '#6c757d'; // Gray for closed set
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 1.3, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Third pass: Draw open set (yellow)
    openSet.forEach(junctionId => {
        if (!junctions[junctionId]) return;

        const [lat, lng] = junctions[junctionId].ll;
        const [x, y] = latLngToScreen(lat, lng);

        const margin = 50;
        if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
            return;
        }

        ctx.fillStyle = '#ffc107'; // Yellow for open set
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 1.8, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Fourth pass: Draw current node (orange)
    if (currentNode && junctions[currentNode]) {
        const [lat, lng] = junctions[currentNode].ll;
        const [x, y] = latLngToScreen(lat, lng);

        const margin = 50;
        if (x >= -margin && x <= canvas.width + margin && y >= -margin && y <= canvas.height + margin) {
            ctx.fillStyle = '#ff6b35'; // Orange for current
            ctx.beginPath();
            ctx.arc(x, y, junctionRadius * 2.2, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    // Fifth pass: Draw start/end points (largest, on top)
    if (selectedStart && junctions[selectedStart]) {
        const [lat, lng] = junctions[selectedStart].ll;
        const [x, y] = latLngToScreen(lat, lng);

        ctx.fillStyle = '#28a745'; // Green for start
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 3, 0, 2 * Math.PI);
        ctx.fill();

        // Black border for visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 3, 0, 2 * Math.PI);
        ctx.stroke();
    }

    if (selectedEnd && junctions[selectedEnd]) {
        const [lat, lng] = junctions[selectedEnd].ll;
        const [x, y] = latLngToScreen(lat, lng);

        ctx.fillStyle = '#dc3545'; // Red for end
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 3, 0, 2 * Math.PI);
        ctx.fill();

        // Black border for visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, junctionRadius * 3, 0, 2 * Math.PI);
        ctx.stroke();
    }

    // Count visible junctions for debugging
    visibleJunctions = Object.keys(junctions).filter(id => {
        const [lat, lng] = junctions[id].ll;
        const [x, y] = latLngToScreen(lat, lng);
        const margin = 50;
        return x >= -margin && x <= canvas.width + margin && y >= -margin && y <= canvas.height + margin;
    }).length;

    const debugInfo = [
        `Rendered ${visibleJunctions}/${totalJunctions} junctions, ${visibleStreets} streets`,
        `Zoom: ${zoom.toFixed(3)}x, Offset: [${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}]`,
        `Canvas: ${canvas.width}x${canvas.height}`,
        `Sample coords: ${sampleCoords[0] || 'none'}`
    ].join(' | ');

    log(debugInfo);
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

    console.log(`Preprocessed ${Object.keys(processed).length} junctions`);
    return processed;
}

function testCoordinateTransform() {
    if (!mapBounds) return;

    // Test with a few known coordinates
    const testCoords = [
        [mapBounds.minLat, mapBounds.minLng], // Should be near top-left
        [mapBounds.maxLat, mapBounds.maxLng], // Should be near bottom-right
        [(mapBounds.minLat + mapBounds.maxLat) / 2, (mapBounds.minLng + mapBounds.maxLng) / 2] // Should be center
    ];

    console.log('Coordinate transform test:');
    testCoords.forEach(([lat, lng], i) => {
        const [x, y] = latLngToScreen(lat, lng);
        console.log(`Test ${i}: [${lat.toFixed(0)}, ${lng.toFixed(0)}] -> [${x.toFixed(1)}, ${y.toFixed(1)}]`);
    });
}

function resizeCanvas() {
    const container = document.querySelector('.map-container');
    const rect = container.getBoundingClientRect();

    // Set canvas size to match container
    canvas.width = rect.width;
    canvas.height = rect.height;

    console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);

    // Redraw the map with new dimensions
    if (mapBounds) {
        fitToView();
    }
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

    mapBounds = calculateMapBounds();
    log(`Map bounds: lat ${mapBounds.minLat.toFixed(0)}-${mapBounds.maxLat.toFixed(0)}, lng ${mapBounds.minLng.toFixed(0)}-${mapBounds.maxLng.toFixed(0)}`);

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
    if (!mapBounds) return;

    // Set a reasonable zoom level
    zoom = 1.0;

    // Center the map
    offsetX = 0;
    offsetY = 0;

    log(`Fit to view: zoom=${zoom.toFixed(3)}, canvas=${canvas.width}x${canvas.height}`);

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

        // Get speed from control
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
