import junctions from './junctions.js';

// Map state
let bounds;
let canvas, ctx;
let canvasAspectRatio, mapAspectRatio;
let mapDisplayWidth, mapDisplayHeight, mapOffsetX, mapOffsetY;
let start, end, isPathfinding = false;
let zoom = 1;
const minZoom = 1.0;
const maxZoom = 100;
let panX = 0, panY = 0;
let isDragging = false;
let hasSignificantlyDragged = false;
let lastMouseX = 0, lastMouseY = 0;
let isPinching = false;
let initialPinchDistance = 0;
let initialPinchCenter = { x: 0, y: 0 };
let initialZoom = 1;
let theme = 'light';

const colors = {
    light: {
        background: '#fff', // White
        streets: '#bbb', // Light Gray
        oneWays: '#444', // Dark Gray
        junctions: '#ccc', // Light Gray
        start: '#28a745', // Green
        end: '#dc3545', // Red
        current: '#ff6b35', // Orange
        openSet: '#ffc107', // Yellow
        closedSet: '#db1', // Gold
        path: '#06c', // Blue
        text: '#000' // Black
    },
    dark: {
        background: '#000', // Black
        streets: '#444', // Dark Gray
        oneWays: '#bbb', // Light Gray
        junctions: '#333', // Dark Gray
        start: '#4ade80', // Green
        end: '#f87171', // Salmon
        current: '#fb923c', // Orange
        openSet: '#da3', // Ochre
        closedSet: '#860', // Gold
        path: '#60a5fa', // Blue
        text: '#fff' // White
    }
};

// A* visualization state
let openSet = new Set();
let closedSet = new Set();
let here = null;
let path = [];

function info(message = '') {
    document.getElementById('infoPanel').textContent = message;
}

function log(message = '') {
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

    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;

    // Calculate the actual geographic aspect ratio of SF.
    // At SF's latitude, 1° longitude ≈ 0.79 × 1° latitude in distance.
    // We must set mapAspectRatio before calling resizeCanvas().
    mapAspectRatio = (lonRange * 0.79) / latRange;

    // Add padding
    const padding = 0.005;
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

    // Convert to screen coordinates within the map display area
    // We must call resizeCanvas() first to populate these values.
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

function invisible(x, y, margin = 50) {
    return x < -margin || x > canvas.width + margin
        || y < -margin || y > canvas.height + margin;
}

function visible(x, y, margin) {
    return !invisible(x, y, margin);
}

function isOneWayStreet(fromCNN, toCNN) {
    // Check if fromCNN connects to toCNN but toCNN doesn't connect back to fromCNN
    if (!junctions[fromCNN] || !junctions[toCNN]) return false;

    const fromHasTo = junctions[fromCNN].adj.includes(parseInt(toCNN));
    const toHasFrom = junctions[toCNN].adj.includes(parseInt(fromCNN));

    return fromHasTo && !toHasFrom;
}

function drawArrow(x1, y1, x2, y2, color) {
    const arrowLength = Math.max(6, zoom + 1);
    const arrowAngle = Math.PI / 6; // 30 degrees

    // Calculate arrow position (closer to the end point)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < arrowLength * 2) return; // Don't draw arrow if segment is too short

    // Position arrow at 75% along the segment
    const arrowX = x1 + dx * 0.75;
    const arrowY = y1 + dy * 0.75;

    // Calculate arrow direction
    const angle = Math.atan2(dy, dx);

    // Draw arrow head
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, zoom / 4);
    ctx.lineCap = 'round';

    ctx.beginPath();
    // Arrow point
    ctx.moveTo(arrowX, arrowY);
    // Left wing
    ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle - arrowAngle),
        arrowY - arrowLength * Math.sin(angle - arrowAngle)
    );
    // Right wing
    ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle + arrowAngle),
        arrowY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.lineTo(arrowX, arrowY);
    ctx.fill();
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
    //console.time('drawStreets()');
    let streetCount = 0;

    // First pass: Draw regular two-way streets
    ctx.strokeStyle = getColor('streets');
    ctx.lineWidth = Math.max(1.5, zoom / 3);
    ctx.beginPath();

    const drawnConnections = new Set();
    const oneWaySegments = [];

    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [x1, y1] = junction.screen;

        for (const adjCNN of junction.adj) {
            if (!junctions[adjCNN]) continue;

            const connectionKey = [cnn, adjCNN].sort().join('-');
            if (drawnConnections.has(connectionKey)) continue;
            drawnConnections.add(connectionKey);

            const [x2, y2] = junctions[adjCNN].screen;

            if (!segmentIsVisible(x1, y1, x2, y2)) continue;
            streetCount++;

            // Check if this is a one-way street
            const isOneWayFromTo = isOneWayStreet(cnn, adjCNN);
            const isOneWayToFrom = isOneWayStreet(adjCNN, cnn);

            if (isOneWayFromTo || isOneWayToFrom) {
                // Store one-way segment for later drawing
                oneWaySegments.push({
                    x1, y1, x2, y2,
                    fromCNN: isOneWayFromTo ? cnn : adjCNN,
                    toCNN: isOneWayFromTo ? adjCNN : cnn
                });
            } else {
                // Regular two-way street
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            }
        }
    });

    ctx.stroke();

    // Second pass: Draw one-way streets with different color and arrows
    if (oneWaySegments.length > 0) {
        ctx.strokeStyle = getColor('oneWays');
        ctx.lineWidth = Math.max(1.5, zoom / 3);
        ctx.beginPath();

        oneWaySegments.forEach(segment => {
            ctx.moveTo(segment.x1, segment.y1);
            ctx.lineTo(segment.x2, segment.y2);
        });

        ctx.stroke();

        // Draw arrows on one-way streets (only when zoomed in enough)
        if (zoom > 2) {
            oneWaySegments.forEach(segment => {
                // Determine arrow direction based on which junction points to which
                const [fromX, fromY] = junctions[segment.fromCNN].screen;
                const [toX, toY] = junctions[segment.toCNN].screen;
                drawArrow(fromX, fromY, toX, toY, getColor('oneWays'));
            });
        }
    }

    //console.timeEnd('drawStreets()');
    return streetCount;
}

function drawJunction(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

function drawJunctionOutline(x, y, radius, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
}

function drawJunctions() {
    // Draw junctions in layers (gray first, then colors on top)
    //console.time('drawJunctions()');
    let junctionCount = 0;
    const radius = Math.max(0.5, zoom / 2.5);

    // 1st pass: Draw all gray/default junctions
    for (const cnn in junctions) {
        const [x, y] = junctions[cnn].screen;

        if (invisible(x, y)) continue;
        junctionCount++;

        // Only draw if it's a default/gray junction
        if (cnn === start || cnn === end || here === cnn ||
            openSet.has(cnn) || closedSet.has(cnn)) {
            continue;
        }

        drawJunction(x, y, radius, getColor('junctions'));
    }

    // 2nd pass: Draw current node
    if (here && junctions[here]) {
        const [x, y] = junctions[here].screen;
        if (visible(x, y)) {
            drawJunction(x, y, radius * 7, getColor('current'));
        }
    }

    // 3rd pass: Draw closed set
    closedSet.forEach(cnn => {
        if (!junctions[cnn]) return;
        const [x, y] = junctions[cnn].screen;
        if (invisible(x, y)) return;
        drawJunction(x, y, radius * 2, getColor('closedSet'));
    });

    // 4th pass: Draw open set
    openSet.forEach(cnn => {
        if (!junctions[cnn]) return;
        const [x, y] = junctions[cnn].screen;
        if (invisible(x, y)) return;
        drawJunction(x, y, radius * 2.5, getColor('openSet'));
    });

    //console.timeEnd('drawJunctions()');
    return junctionCount;
}

function drawJunctionStart() {
    // 5th pass: Draw starting point
    if (!start || !junctions[start]) return;
    const [x, y] = junctions[start].screen;
    if (invisible(x, y)) return;
    const radius = Math.max(2, zoom / 2);
    drawJunction(x, y, radius * 3, getColor('start'));
    drawJunctionOutline(x, y, radius * 3, getColor('text'));
}

function drawJunctionEnd() {
    // 6th pass: Draw end point
    if (!end || !junctions[end]) return;
    const [x, y] = junctions[end].screen;
    if (invisible(x, y)) return;
    const radius = Math.max(2, zoom / 2);
    drawJunction(x, y, radius * 3, getColor('end'));
    drawJunctionOutline(x, y, radius * 3, getColor('text'));
}

function drawJunctionLabels() {
    if (zoom < 20) return;

    for (const cnn in junctions) {
        const [x, y] = junctions[cnn].screen;

        if (invisible(x, y)) continue;

        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.miterLimit = 3;
        ctx.fillStyle = getColor('text');
        ctx.strokeStyle = getColor('background');
        ctx.font = `${Math.max(12, zoom / 4)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(cnn, x, y);
        ctx.fillText(cnn, x, y);
    }
}

function drawMap() {
    //console.time('drawMap()');
    if (!canvas || !ctx || !bounds) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background using theme color
    ctx.fillStyle = getColor('background');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update screen coordinates.
    postprocessJunctions();

    const streetCount = drawStreets();
    const junctionCount = drawJunctions();
    drawPath();
    drawJunctionStart();
    drawJunctionEnd();
    drawJunctionLabels();

    const counts = [
        `${junctionCount} junctions`,
        `${streetCount} streets`,
    ].join(', ');
    const stats = [
        `Canvas: ${canvas.width}x${canvas.height}`,
        `Zoom: ${zoom.toFixed(3)}x, Pan: [${panX.toFixed(1)}, ${panY.toFixed(1)}]`,
        counts,
    ].join(' | ');
    log(stats);

    //console.timeEnd('drawMap()');
    //console.log(' ');
}

function drawPath() {
    if (path.length < 2) return;

    ctx.strokeStyle = getColor('path');
    ctx.lineWidth = Math.max(3, zoom / 1.25);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const [startX, startY] = junctions[path[0]].screen;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < path.length; i++) {
        const [x, y] = junctions[path[i]].screen;
        ctx.lineTo(x, y);
    }
    ctx.stroke();
}

function padCoord(coord) {
    // Pad coordinates to 5 digits with trailing zeros
    return parseInt(coord.toString().padEnd(5, '0'));
}

function postprocessJunctions() {
    // Calculate the screen coordinates for each junction.
    //console.time('postprocessJunctions()');
    for (const cnn in junctions) {
        const [lat, lon] = junctions[cnn].ll;
        junctions[cnn].screen = coordsToScreen(lat, lon);
    }
    //console.timeEnd('postprocessJunctions()');
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
    if (!canvas) return;

    // Store the geographic center point before resizing
    let centerLat, centerLon;
    if (bounds) {
        const centerScreenX = canvas.width / 2;
        const centerScreenY = canvas.height / 2;
        [centerLat, centerLon] = screenToCoords(centerScreenX, centerScreenY);
    }

    const container = document.querySelector('.map-container');
    const rect = container.getBoundingClientRect();

    // Set canvas size to match container
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Calculate display dimensions to maintain geographic accuracy
    canvasAspectRatio = canvas.width / canvas.height;

    // Calculate geometry for coordsToScreen().
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

    // Adjust pan to keep the same geographic center point centered
    if (bounds && centerLat !== undefined && centerLon !== undefined) {
        const [newCenterX, newCenterY] = coordsToScreen(centerLat, centerLon);
        const newCenterScreenX = canvas.width / 2;
        const newCenterScreenY = canvas.height / 2;

        // Adjust pan so the center point appears at the center of the new viewport
        panX += (newCenterX - newCenterScreenX) / zoom;
        panY += (newCenterY - newCenterScreenY) / zoom;
    }

    drawMap();
}

function loadMap() {
    canvas = document.getElementById('mapCanvas');
    ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) {
        info('Oh no! Can\'t draw the map, sorry.');
        log('Cannot initialize canvas');
        return;
    }

    // Preprocess coordinates to pad trailing zeros
    const processedJunctions = preprocessJunctions(junctions);

    // Replace global junctions with processed ones
    Object.keys(junctions).forEach(key => delete junctions[key]);
    Object.assign(junctions, processedJunctions);

    // Must calculate map boundaries before calling resizeCanvas().
    bounds = calculateBounds();
    console.log(`Map bounds: lat 37.${bounds.minLat.toFixed(0)} - 37.${bounds.maxLat.toFixed(0)}, lon -122.${bounds.minLon.toFixed(0)} - -122.${bounds.maxLon.toFixed(0)}`);

    setupEventListeners();

    // Resize canvas to fill container
    // resizeCanvas() calls drawMap().
    resizeCanvas();

    info(`Street network loaded! ${Object.keys(junctions).length} junctions shown. Click two junctions to set start/end points.`);
}

function findClosestJunction(baseX, baseY, threshold = 15) {
    let closestCNN = null;
    let closestDistance = Infinity;

    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [x, y] = junction.screen;
        const distance = coordsDistance([y, x], [baseY, baseX]);

        if (distance < threshold / zoom && distance < closestDistance) {
            closestDistance = distance;
            closestCNN = cnn;
        }
    });

    return closestCNN;
}

function setupEventListeners() {
    // Mouse events for pan/zoom
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('click', handleClick);

    // Touch events for mobile panning
    const options = { passive: false };
    canvas.addEventListener('touchstart', handleTouchStart, options);
    canvas.addEventListener('touchmove', handleTouchMove, options);
    canvas.addEventListener('touchend', handleTouchEnd, options);
}

function handleMouseDown(e) {
    isDragging = true;
    hasSignificantlyDragged = false; // Reset drag tracking
    lastMouseX = e.offsetX;
    lastMouseY = e.offsetY;
}

function handleMouseMove(e) {
    if (!isDragging) return;

    const deltaX = e.offsetX - lastMouseX;
    const deltaY = e.offsetY - lastMouseY;

    // Track if significant movement occurred (more than 3 pixels)
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        hasSignificantlyDragged = true;
    }

    panX -= deltaX / zoom;
    panY -= deltaY / zoom;

    lastMouseX = e.offsetX;
    lastMouseY = e.offsetY;

    drawMap();
}

function handleMouseUp(e) {
    isDragging = false;
    // Don't reset hasSignificantlyDragged here - let handleClick check it
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
    // Ignore clicks that happen immediately after dragging
    if (isDragging || isPathfinding || hasSignificantlyDragged) {
        hasSignificantlyDragged = false; // Reset for next interaction
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const closestCNN = findClosestJunction(mouseX, mouseY);
    if (closestCNN) {
        selectJunction(closestCNN);
    }
}

function getTouchCoordinates(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
}

// Helper function to calculate distance between two touches
function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Helper function to get center point between two touches
function getTouchCenter(touch1, touch2, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
        y: (touch1.clientY + touch2.clientY) / 2 - rect.top
    };
}

function handleTouchStart(e) {
    e.preventDefault(); // Prevent scrolling

    if (e.touches.length === 1) {
        // Single touch - start panning
        isDragging = true;
        isPinching = false;
        const coords = getTouchCoordinates(e, canvas);
        lastMouseX = coords.x;
        lastMouseY = coords.y;
    } else if (e.touches.length === 2) {
        // Two touches - start pinching
        isDragging = false;
        isPinching = true;

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        initialPinchDistance = getTouchDistance(touch1, touch2);
        initialPinchCenter = getTouchCenter(touch1, touch2, canvas);
        initialZoom = zoom;
    }
}

function handleTouchMove(e) {
    e.preventDefault(); // Prevent scrolling

    if (e.touches.length === 1 && isDragging && !isPinching) {
        // Single touch panning
        const coords = getTouchCoordinates(e, canvas);
        const deltaX = coords.x - lastMouseX;
        const deltaY = coords.y - lastMouseY;

        panX -= deltaX / zoom;
        panY -= deltaY / zoom;

        lastMouseX = coords.x;
        lastMouseY = coords.y;

        drawMap();
    } else if (e.touches.length === 2 && isPinching) {
        // Two touch pinch-to-zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const currentDistance = getTouchDistance(touch1, touch2);
        const currentCenter = getTouchCenter(touch1, touch2, canvas);

        // Calculate zoom factor based on distance change
        const zoomFactor = currentDistance / initialPinchDistance;
        const newZoom = Math.max(minZoom, Math.min(maxZoom, initialZoom * zoomFactor));

        if (newZoom !== zoom) {
            // Calculate the point in "base" coordinate space for the pinch center
            const baseCenterX = initialPinchCenter.x / zoom + panX;
            const baseCenterY = initialPinchCenter.y / zoom + panY;

            // Adjust pan so the pinch center stays under the fingers
            panX = baseCenterX - currentCenter.x / newZoom;
            panY = baseCenterY - currentCenter.y / newZoom;

            zoom = newZoom;
            drawMap();
        }
    }
}

function handleTouchEnd(e) {
    e.preventDefault(); // Prevent scrolling

    if (e.touches.length === 0) {
        // No more touches
        isDragging = false;
        isPinching = false;
    } else if (e.touches.length === 1 && isPinching) {
        // Went from pinch to single touch - switch to panning
        isPinching = false;
        isDragging = true;
        const coords = getTouchCoordinates(e, canvas);
        lastMouseX = coords.x;
        lastMouseY = coords.y;
    }
}

function selectJunction(cnn) {
    if (!start) {
        start = parseInt(cnn);
        info(`Start point: Junction ${cnn}. Click another junction for the destination.`);
        drawMap();
        return;
    }

    if (!end && cnn !== start) {
        end = parseInt(cnn);
        document.getElementById('findPathBtn').disabled = false;
        info(`Route set: ${start} → ${end}. Ready for A* pathfinding!`);
        drawMap();
        return;
    }

    // Reset selection
    start = parseInt(cnn);
    end = null;
    document.getElementById('findPathBtn').disabled = true;
    info(`Start point: Junction ${start}. Click another junction for the destination.`);
    drawMap();
}

function zoomTowardCenter(zoomFactor) {
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * zoomFactor));
    if (newZoom === zoom) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Find what base coordinates the center currently shows
    const baseCenterX = centerX / zoom + panX;
    const baseCenterY = centerY / zoom + panY;

    // After zoom, adjust pan so that same base point appears at center
    panX = baseCenterX - centerX / newZoom;
    panY = baseCenterY - centerY / newZoom;

    zoom = newZoom;
    drawMap();
}

function zoomIn() {
    zoomTowardCenter(1.5);
}

function zoomOut() {
    zoomTowardCenter(1 / 1.5);
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
    start = null;
    end = null;
    isPathfinding = false;
    openSet.clear();
    closedSet.clear();
    here = null;
    path = [];

    document.getElementById('findPathBtn').disabled = true;
    info('Selection reset. Click two junctions to set new start/end points.');

    drawMap();
}

function checkNeighbors(gScore, fScore, cameFrom) {
    const neighbors = junctions[here].adj.filter(cnn => junctions[cnn]);
    for (const neighbor of neighbors) {
        if (closedSet.has(neighbor)) continue;

        const tentativeGScore = gScore[here] + junctionDistance(here, neighbor);

        if (!openSet.has(neighbor)) {
            // First time visiting this neighbor
            openSet.add(neighbor);
            cameFrom[neighbor] = here;
            gScore[neighbor] = tentativeGScore;
            fScore[neighbor] = gScore[neighbor] + junctionDistance(neighbor, end);
        } else if (tentativeGScore < (gScore[neighbor] || Infinity)) {
            // Found a better path to this neighbor
            cameFrom[neighbor] = here;
            gScore[neighbor] = tentativeGScore;
            fScore[neighbor] = gScore[neighbor] + junctionDistance(neighbor, end);
        }
        // If tentativeGScore >= existing gScore, don't update anything
    }
}

function reconstructPath(cameFrom) {
    let current = end;
    const pathSet = new Set();
    const maxPathLength = Object.keys(junctions).length;

    while (current && path.length < maxPathLength) {
        if (pathSet.has(current)) {
            // Cycle detected - use the path we have so far
            console.warn(`Circular reference detected at node ${current}. Using partial path.`);
            break;
        }

        pathSet.add(current);
        path.unshift(current);
        current = cameFrom[current];
    }

    if (path.length >= maxPathLength) {
        console.error("Path reconstruction hit length limit - using partial path");
    }

    // Validate the path we have
    if (!path.length) {
        console.error("No valid path could be reconstructed");
    }

    console.log(`Path reconstructed: ${path.join(' -> ')} (${path.length} nodes)`);

    // Optional: Check if we actually reached the start
    if (path[0] !== start) {
        console.warn(`Path doesn't reach start node. Got to ${path[0]}, wanted ${start}`);
    }
}

async function findPath() {
    if (!start || !end || isPathfinding) return;
    console.time('findPath()');

    isPathfinding = true;
    document.getElementById('findPathBtn').disabled = true;

    // Initialize A*
    openSet.clear();
    closedSet.clear();
    path = [];

    const gScore = {};
    const fScore = {};
    const cameFrom = {};

    openSet.add(start);
    gScore[start] = 0;
    fScore[start] = junctionDistance(start, end);

    while (openSet.size > 0) {
        // Find node with lowest fScore
        here = Array.from(openSet).reduce((lowest, node) =>
            fScore[node] < fScore[lowest] ? node : lowest
        );

        if (here === end) {
            reconstructPath(cameFrom);
            break;
        }

        openSet.delete(here);
        closedSet.add(here);

        checkNeighbors(gScore, fScore, cameFrom);

        // Update display
        drawMap();
        info(`A* running... Current: ${here} | Open: ${openSet.size} | Closed: ${closedSet.size}`);

        // Brief pause for visualization
        const speed = parseInt(document.getElementById('animationSpeed').value);
        await new Promise(resolve => setTimeout(resolve, speed));
    }

    info(path.length > 0 ?
        `Path found! ${path.length} junctions, cost: ${gScore[end].toFixed(1)}` :
        'No path found!');

    here = null;
    isPathfinding = false;
    document.getElementById('findPathBtn').disabled = false;
    console.timeEnd('findPath()');
    drawMap();
}

// Initialize
window.addEventListener('load', () => {
    info('Ready! Click two places to navigate between.');
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
    resizeCanvas();
});

function renderBackgroundLayer() {
    console.time('renderBackgroundLayer()');
    const ctx = context.bg;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.bg.width, canvas.bg.height);

    // Background using theme color
    ctx.fillStyle = getColor('background');
    ctx.fillRect(0, 0, canvas.bg.width, canvas.bg.height);

    // Apply transform
    applyCanvasTransform(ctx);

    // Draw static elements
    const streetCount = drawStreets(ctx);
    const junctionCount = drawJunctions(ctx);
    const schoolCount = drawSchools(ctx);
    const addressCount = drawAddresses(ctx);
    drawStreetNames(ctx);

    // Reset transform
    resetCanvasTransform(ctx);

    dirty.bg = false;

    const counts = [
        `${junctionCount} junctions`,
        `${streetCount} streets`,
        `${schoolCount} schools`,
        `${addressCount} addresses`,
    ].join(', ');
    const stats = [
        `Canvas: ${canvas.bg.width}x${canvas.bg.height}`,
        `Zoom: ${zoom.toFixed(3)}x, Pan: [${panX.toFixed(1)}, ${panY.toFixed(1)}]`,
        counts,
    ].join(' | ');
    log(stats);

    console.timeEnd('renderBackgroundLayer()');
}

function renderPathfindingLayer() {
    const ctx = context.pf;
    //console.time('renderPathfindingLayer()');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.pf.width, canvas.pf.height);

    // Apply transform
    applyCanvasTransform(ctx);

    // Draw pathfinding visualization
    drawPathSearch(ctx);
    drawPath(ctx);

    // Reset transform
    resetCanvasTransform(ctx);

    dirty.pf = false;
    //console.timeEnd('renderPathfindingLayer()');
}

function renderUILayer() {
    const ctx = context.ui;
    //console.time('renderUILayer()');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.ui.width, canvas.ui.height);

    // Apply transform
    applyCanvasTransform(ctx);

    // Draw UI elements
    drawJunctionStart(ctx);
    drawJunctionEnd(ctx);
    drawJunctionLabels(ctx);

    // Reset transform
    resetCanvasTransform(ctx);

    dirty.ui = false;
    //console.timeEnd('renderUILayer()');
}
