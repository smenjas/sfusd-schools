import addressData from './address-data.js';
import junctions from './junctions.js';
import schoolData from './school-data.js';

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
let addresses = {};
let schools = [];

const colors = {
    light: {
        background: '#fff', // White
        schools: '#f44', // Red
        streets: '#bbb', // Light Gray
        oneWayStreets: '#444', // Dark Gray
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
        schools: '#f44', // Red
        streets: '#444', // Dark Gray
        oneWayStreets: '#bbb', // Light Gray
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

function isOneWayStreet(fromCNN, toCNN) {
    // Check if fromCNN connects to toCNN but toCNN doesn't connect back to fromCNN
    if (!junctions[fromCNN] || !junctions[toCNN]) return false;

    const fromHasTo = junctions[fromCNN].adj.includes(parseInt(toCNN));
    const toHasFrom = junctions[toCNN].adj.includes(parseInt(fromCNN));

    return fromHasTo && !toHasFrom;
}

function drawArrow(x1, y1, x2, y2, color) {
    const arrowLength = Math.max(8, 3 / zoom);
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
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, 1.5 / zoom);
    ctx.lineCap = 'round';

    ctx.beginPath();
    // Arrow point
    ctx.moveTo(arrowX, arrowY);
    // Left wing
    ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle - arrowAngle),
        arrowY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(arrowX, arrowY);
    // Right wing
    ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle + arrowAngle),
        arrowY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();
}

function drawAddresses() {
    // Only show addresses when zoomed in enough to be readable
    if (zoom < 40) return 0;

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

            if (invisible(x, y, 30)) return;

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
        });
    });

    return addressCount;
}

function drawSchools() {
    // Show schools at lower zoom levels than addresses
    if (zoom < 2) return 0;

    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, zoom / 5);

    let schoolCount = 0;

    schools.forEach(school => {
        const [lat, lon] = school.coords;
        const [x, y] = coordsToScreen(lat, lon);

        // Only draw if visible
        if (invisible(x, y, 50)) return;

        // Draw school marker - distinctive shape and color
        const size = Math.max(8, zoom * 1.25, Math.min(20, zoom * 4));

        // School marker as a house-like shape
        ctx.fillStyle = getColor('schools');
        ctx.strokeStyle = getColor('schools');

        // Draw a square with triangle roof
        ctx.beginPath();
        ctx.rect(x - size/2, y - size/4, size, size/2);
        ctx.fill();
        ctx.stroke();

        // Triangle roof
        ctx.beginPath();
        ctx.moveTo(x - size/2, y - size/4);
        ctx.lineTo(x, y - size/1.5);
        ctx.lineTo(x + size/2, y - size/4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw school name when zoomed in enough
        if (zoom > 4) {
            ctx.fillStyle = getColor('text');
            ctx.strokeStyle = getColor('background');
            ctx.font = `${Math.max(10, zoom / 2)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            const schoolName = `${school.prefix} ${school.name} ${school.suffix}`.trim();
            ctx.strokeText(schoolName, x, y + size/2 + 2);
            ctx.fillText(schoolName, x, y + size/2 + 2);
        }

        schoolCount++;
    });

    return schoolCount;
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
            if (!junctions[adjCNN]) continue;
            const connectionKey = [cnn, adjCNN].sort().join('-');
            if (drawnStreets.has(connectionKey)) continue;

            drawnStreets.add(connectionKey);

            // Find common street names between the two junctions
            const commonStreets = junction.streets.filter(street =>
                junctions[adjCNN].streets.includes(street)
            );

            if (!commonStreets.length) continue;

            const [lat2, lon2] = junctions[adjCNN].ll;
            const [x2, y2] = coordsToScreen(lat2, lon2);

            // Only process visible segments
            const margin = 100;
            if (invisible(x1, y1, margin) && invisible(x2, y2, margin)) {
                continue;
            }

            const streetName = commonStreets[0]; // Use first common street
            if (!streetSegments.has(streetName)) {
                streetSegments.set(streetName, []);
            }
            streetSegments.get(streetName).push({
                x1, y1, x2, y2,
                length: coordsDistance([y1, x1], [y2, x2])
            });
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
    let oneWayStreets = 0;

    // First pass: Draw regular two-way streets
    ctx.strokeStyle = getColor('streets');
    ctx.lineWidth = Math.max(1.5, zoom / 3);
    ctx.beginPath();

    const drawnConnections = new Set();
    const oneWaySegments = [];

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
                oneWayStreets++;
            } else {
                // Regular two-way street
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                visibleStreets++;
            }
        }
    });

    ctx.stroke();

    // Second pass: Draw one-way streets with different color and arrows
    if (oneWaySegments.length > 0) {
        ctx.strokeStyle = getColor('oneWayStreets');
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
                const fromJunction = junctions[segment.fromCNN];
                const toJunction = junctions[segment.toCNN];

                const [fromLat, fromLon] = fromJunction.ll;
                const [fromX, fromY] = coordsToScreen(fromLat, fromLon);

                const [toLat, toLon] = toJunction.ll;
                const [toX, toY] = coordsToScreen(toLat, toLon);

                drawArrow(fromX, fromY, toX, toY, getColor('oneWayStreets'));
            });
        }
    }

    return { regular: visibleStreets, oneWay: oneWayStreets };
}

function drawJunctions() {
    let visibleJunctions = 0;

    // Draw junctions in layers (gray first, then colors on top)
    const radius = Math.max(0.5, zoom / 2.5);

    // First pass: Draw all gray/default junctions
    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [lat, lon] = junction.ll;
        const [x, y] = coordsToScreen(lat, lon);

        // Skip if not visible
        if (invisible(x, y, 50)) return;
        visibleJunctions++;

        ctx.fillStyle = getColor('junctions');
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Only draw if it's a default/gray junction
        if (!(selectedStart && cnn === selectedStart) &&
            !(selectedEnd && cnn === selectedEnd) &&
            currentNode !== cnn &&
            !openSet.has(cnn) &&
            !closedSet.has(cnn)) {

            ctx.fillStyle = getColor('junctions');
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();
        }
    });

    // Second pass: Draw closed set
    closedSet.forEach(cnn => {
        if (!junctions[cnn]) return;

        const [lat, lon] = junctions[cnn].ll;
        const [x, y] = coordsToScreen(lat, lon);

        if (invisible(x, y, 50)) return;

        ctx.fillStyle = getColor('closedSet');
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.0, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Third pass: Draw open set
    openSet.forEach(cnn => {
        if (!junctions[cnn]) return;

        const [lat, lon] = junctions[cnn].ll;
        const [x, y] = coordsToScreen(lat, lon);

        if (invisible(x, y, 50)) return;

        ctx.fillStyle = getColor('openSet');
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.5, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Fourth pass: Draw current node
    if (currentNode && junctions[currentNode]) {
        const [lat, lon] = junctions[currentNode].ll;
        const [x, y] = coordsToScreen(lat, lon);

        if (visible(x, y, 50)) {
            ctx.fillStyle = getColor('current');
            ctx.beginPath();
            ctx.arc(x, y, radius * 7, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    return visibleJunctions;
}

function drawJunctionTerminals() {
    // Fifth pass: Draw start/end points
    const radius = Math.max(2, zoom / 2);

    if (selectedStart && junctions[selectedStart]) {
        const [lat, lon] = junctions[selectedStart].ll;
        const [x, y] = coordsToScreen(lat, lon);

        ctx.fillStyle = getColor('start');
        ctx.beginPath();
        ctx.arc(x, y, radius * 3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = getColor('text');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius * 3, 0, 2 * Math.PI);
        ctx.stroke();
    }

    if (selectedEnd && junctions[selectedEnd]) {
        const [lat, lon] = junctions[selectedEnd].ll;
        const [x, y] = coordsToScreen(lat, lon);

        ctx.fillStyle = getColor('end');
        ctx.beginPath();
        ctx.arc(x, y, radius * 3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = getColor('text');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius * 3, 0, 2 * Math.PI);
        ctx.stroke();
    }
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

    const streetInfo = drawStreets();
    const visibleJunctions = drawJunctions();
    drawFinalPath();
    drawJunctionTerminals();
    drawJunctionLabels();
    const addressCount = drawAddresses();
    const schoolCount = drawSchools();
    drawStreetNames();

    const stats = [
        `Canvas: ${canvas.width}x${canvas.height}`,
        `Rendered ${visibleJunctions} junctions, ${streetInfo.regular} two-way streets, ${streetInfo.oneWay} one-way streets, ${schoolCount} schools, ${addressCount} addresses`,
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

function preprocessSchools(rawSchools) {
    return rawSchools.map(school => ({
        ...school,
        coords: [
            padCoord(Math.round((school.ll[0] - 37) * 100000)),        // latitude
            padCoord(Math.round(Math.abs(school.ll[1] + 122) * 100000)) // longitude
        ]
    }));
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
    schools = preprocessSchools(schoolData);

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
        return;
    }

    // Check if user clicked on a school
    let closestSchool = null;
    let closestSchoolDistance = Infinity;

    schools.forEach((school, index) => {
        const [lat, lon] = school.coords;
        const [x, y] = coordsToScreen(lat, lon);
        const distance = coordsDistance([y, x], [mouseY, mouseX]);

        if (distance < 20 && distance < closestSchoolDistance) {
            closestSchoolDistance = distance;
            closestSchool = school;
        }
    });

    if (closestSchool) {
        document.getElementById('infoPanel').textContent =
            `School: ${closestSchool.prefix} ${closestSchool.name} ${closestSchool.suffix} - ${closestSchool.address}`;
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
