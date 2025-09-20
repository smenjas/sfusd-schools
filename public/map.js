import { formatStreet } from './address.js';
import { expandCoords, howFar } from './geo.js';
import addressData from './address-data.js';
import junctions from './junctions.js';
import schools from './school-data.js';
import segments from './segments.js';

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
let lastPanX = 0, lastPanY = 0, lastZoom = 1;
let coordinatesCached = false;
let animationFrameId = null;
let needsRedraw = false;
let isDragging = false;
let hasSignificantlyDragged = false;
let lastMouseX = 0, lastMouseY = 0;
let isPinching = false;
let initialPinchDistance = 0;
let initialPinchCenter = { x: 0, y: 0 };
let initialZoom = 1;
let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;
const tapThreshold = 10; // pixels
const tapMaxDuration = 300; // milliseconds
let theme = 'light';
let addresses = {};
let segmentJunctions = {};

const colors = {
    light: {
        background: '#fff', // White
        schools: '#f44', // Red
        streets: '#bbb', // Light Gray
        oneWays: '#7f7f7f', // Gray
        arrows: '#4f4f4f', // Dark Gray
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
        schools: '#f44', // Red
        streets: '#444', // Dark Gray
        oneWays: '#7f7f7f', // Gray
        arrows: '#afafaf', // Lightish Gray
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
    const normalizedX = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
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

    // Convert to normalized coordinates
    const normalizedX = baseX / canvas.width;
    const normalizedY = baseY / canvas.height;

    // Reverse the coordinate mapping
    const lon = bounds.minLon + normalizedX * (bounds.maxLon - bounds.minLon);
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

function isOneWaySegment(cnn1, cnn2) {
    if (isOneWayStreet(cnn1, cnn2)) return cnn2;
    if (isOneWayStreet(cnn2, cnn1)) return cnn1;
    return null;
}

function drawArrow(x1, y1, x2, y2, color) {
    const arrowLength = Math.max(6, zoom + 1);
    const arrowAngle = Math.PI / 7;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Don't draw arrow if segment is too short
    if (length < arrowLength * 2) return;

    // Calculate arrow position (closer to the end point)
    const arrowX = x1 + dx * 0.9;
    const arrowY = y1 + dy * 0.9;

    // Calculate arrow direction
    const angle = Math.atan2(dy, dx);

    // Draw arrow head
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, zoom / 4);

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

function drawAddresses() {
    // Only show addresses when zoomed in enough to be readable
    if (zoom < 30) return 0;

    //console.time('  drawAddresses()');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.miterLimit = 3;
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `${Math.max(10, zoom / 5)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let addressCount = 0;
    const radius = Math.max(1, 0.025 * zoom);

    Object.entries(addresses).forEach(([street, numbers]) => {
        Object.entries(numbers).forEach(([number, coords]) => {
            const [x, y] = coords.screen;

            if (invisible(x, y, 30)) return;

            // Draw a small dot for the address location
            ctx.fillStyle = getColor('text');
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();

            // Draw address number slightly offset so it doesn't overlap the dot
            const offsetY = Math.max(8, 10/zoom);
            ctx.fillStyle = getColor('text');
            ctx.strokeText(number, x, y - offsetY);
            ctx.fillText(number, x, y - offsetY);

            addressCount++;
        });
    });

    //console.timeEnd('  drawAddresses()');
    return addressCount;
}

function drawSchool(size, school) {
    const [x, y] = school.screen;
    if (invisible(x, y)) return false;

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

    if (zoom < 3) return true;

    // Draw school name when zoomed in enough
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `${Math.max(10, zoom / 2)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const schoolName = `${school.prefix} ${school.name} ${school.suffix}`.trim();
    const textY = y + size/2 + 2;
    ctx.strokeText(schoolName, x, textY);
    ctx.fillText(schoolName, x, textY);

    return true;
}

function drawSchools() {
    //console.time('  drawSchools()');
    //const size = Math.max(8, zoom * 1.25, Math.min(20, zoom * 4));
    const size = Math.max(1, zoom * 1.25);
    let schoolCount = 0;

    schools.forEach(school => {
        schoolCount += drawSchool(size, school);
    });

    //console.timeEnd('  drawSchools()');
    return schoolCount;
}

function drawStreetNames() {
    if (zoom < 4) return;

    //console.time('  drawStreetNames()');
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `${Math.max(10, zoom / 2)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    const streetSegments = new Map(); // street name -> array of segments

    // Collect street segments
    for (const [cnn, segment] of Object.entries(segments)) {
        if (!segmentIsVisible(cnn, 0)) continue;

        const street = segments[cnn].street;
        if (!streetSegments.has(street)) {
            streetSegments.set(street, []);
        }
        streetSegments.get(street).push({
            cnn,
            distance: segment.distance
        });
    }

    // Draw street names on longest segments
    streetSegments.forEach((blocks, street) => {
        // Find the longest segment for this street
        const longestSegment = blocks.reduce((longest, segment) =>
            segment.distance > longest.distance ? segment : longest
        );

        // Only draw if segment is long enough for text
        const textWidth = ctx.measureText(street).width;
        const xy1 = segments[longestSegment.cnn].screen[0];
        const xy2 = segments[longestSegment.cnn].screen.at(-1);
        const length = coordsDistance(xy1, xy2);
        if (length > textWidth / 2) {
            drawStreetNameOnSegment(street, longestSegment.cnn);
        }
    });
    //console.timeEnd('  drawStreetNames()');
}

function drawStreetNameOnSegment(street, cnn) {
    const segment = segments[cnn];
    if (!segment) return;

    const points = segment.screen;
    let longest = -Infinity, longestIndex;
    for (let i = 0; i < points.length - 1; i++) {
        const length = coordsDistance(points[i], points[i + 1]);
        if (length > longest) {
            longest = length;
            longestIndex = i;
        }
    }

    if (!longestIndex) return;

    const [x1, y1] = points[longestIndex];
    const [x2, y2] = points[longestIndex + 1];

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
    street = formatStreet(street);
    ctx.strokeText(street, 0, 0);
    ctx.fillText(street, 0, 0);

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

function lineIsVisible(x1, y1, x2, y2, margin = 100) {
    // Check if line segment intersects with viewport (including margin)
    const rectLeft = -margin;
    const rectTop = -margin;
    const rectRight = canvas.width + margin;
    const rectBottom = canvas.height + margin;

    return lineIntersectsRect(x1, y1, x2, y2, rectLeft, rectTop, rectRight, rectBottom);
}

function segmentIsVisible(cnn, margin) {
    const points = segments[cnn].screen;
    if (points.length < 2) {
        console.log('Segment', cnn, 'only has', points.length, 'coordinates:', points);
        return false;
    }
    for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        if (lineIsVisible(x1, y1, x2, y2, margin)) {
            return true;
        }
    }
    return false;
}

function drawSegment(ctx, cnn) {
    const segment = segments[cnn];
    if (!segment) return;

    const points = segment.screen;
    if (points.length < 2) return;

    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }
}

function drawStreets() {
    //console.time('  drawStreets()');
    let streetCount = 0;

    // 1st pass: Draw regular two-way streets
    //console.time('    drawStreets(): 2-way');
    ctx.strokeStyle = getColor('streets');
    ctx.lineWidth = Math.max(1.5, zoom / 3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const oneWaySegments = [];

    Object.entries(segments).forEach(([cnn, segment]) => {
        if (!segmentIsVisible(cnn, 200)) return;
        streetCount++;

        // Check if this is a one-way street
        if (segment.to) {
            // Store one-way segment for later drawing
            oneWaySegments.push(cnn);
        } else {
            // Regular two-way street
            drawSegment(ctx, cnn);
        }
    });

    ctx.stroke();
    //console.timeEnd('    drawStreets(): 2-way');

    // 2nd pass: Draw one-way streets in a different color
    if (oneWaySegments.length > 0) {
        //console.time('    drawStreets(): 1-way');
        ctx.strokeStyle = getColor('oneWays');
        ctx.lineWidth = Math.max(1.5, zoom / 3);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        oneWaySegments.forEach(cnn => {
            drawSegment(ctx, cnn);
        });

        ctx.stroke();
        //console.timeEnd('    drawStreets(): 1-way');

        // Draw arrows on one-way streets (only when zoomed in enough)
        if (zoom > 2) {
            //console.time('    drawStreets(): 1-way arrows');
            oneWaySegments.forEach(cnn => {
                // Determine arrow direction based on which junction points to which
                const segment = segments[cnn];
                if (!segment || segment.screen.length < 2) {
                    console.warn('Segment', cnn, 'only has', segment.screen.length, 'coordinates:', segment.screen);
                    return;
                }
                const screen = Array.from(segment.screen);
                if (segment.to === segment.f) screen.reverse();
                const [x1, y1] = screen.at(-2);
                const [x2, y2] = screen.at(-1);
                drawArrow(ctx, x1, y1, x2, y2, getColor('arrows'));
            });
            //console.timeEnd('    drawStreets(): 1-way arrows');
        }
    }

    //console.timeEnd('  drawStreets()');
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
    //console.time('  drawJunctions()');
    let junctionCount = 0;
    const radius = Math.max(0.5, zoom / 2.5);

    // 1st pass: Draw all gray/default junctions
    // Batch all gray junctions into a single path
    ctx.fillStyle = getColor('junctions');
    ctx.beginPath();

    for (const cnn in junctions) {
        const [x, y] = junctions[cnn].screen;

        if (invisible(x, y)) continue;
        junctionCount++;

        // Skip special junctions for later
        if (cnn === start || cnn === end || here === cnn ||
            openSet.has(cnn) || closedSet.has(cnn)) {
            continue;
        }

        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
    }

    ctx.fill();

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

    //console.timeEnd('  drawJunctions()');
    return junctionCount;
}

function drawJunctionStart() {
    // 5th pass: Draw starting point
    if (!start || !junctions[start]) return;
    const [x, y] = junctions[start].screen;
    if (invisible(x, y)) return;
    const radius = Math.max(2, zoom / 2) * 3;
    drawJunction(x, y, radius, getColor('start'));
    drawJunctionOutline(x, y, radius, getColor('text'));
}

function drawJunctionEnd() {
    // 6th pass: Draw end point
    if (!end || !junctions[end]) return;
    const [x, y] = junctions[end].screen;
    if (invisible(x, y)) return;
    const radius = Math.max(2, zoom / 2) * 3;
    drawJunction(x, y, radius, getColor('end'));
    drawJunctionOutline(x, y, radius, getColor('text'));
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
    if (!canvas || !ctx || !bounds) return;
    console.time('drawMap()');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background using theme color
    ctx.fillStyle = getColor('background');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update screen coordinates.
    //console.time('Postprocess data (update screen coordinates)');
    if (zoom >= 30) postprocessAddresses();
    postprocessJunctions();
    postprocessSchools();
    postprocessSegments();
    //console.timeEnd('Postprocess data (update screen coordinates)');

    const streetCount = drawStreets();
    const junctionCount = drawJunctions();
    drawPath();
    drawJunctionStart();
    drawJunctionEnd();
    drawStreetNames();
    const schoolCount = drawSchools();
    drawJunctionLabels();
    const addressCount = drawAddresses();

    const counts = [
        //`${junctionCount} junctions`,
        //`${streetCount} streets`,
    ];
    if (schoolCount) counts.push(`${schoolCount} schools`);
    if (addressCount) counts.push(`${addressCount} addresses`);
    const zoomDigits = (zoom < 10) ? 1 : 0;
    const stats = [
        //`Canvas: ${canvas.width}x${canvas.height}`,
        `Zoom: ${zoom.toFixed(zoomDigits)}x`,
        counts.join(', '),
    ].join(' | ');
    log(stats);

    console.timeEnd('drawMap()');
    //console.log(' ');
}

function drawPath() {
    if (path.length < 2) return;

    ctx.strokeStyle = getColor('path');
    ctx.lineWidth = Math.max(3, zoom / 1.25);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < path.length - 1; i++) {
        const cnn1 = path[i], cnn2 = path[i + 1];
        const cnn = segmentJunctions[cnn1][cnn2][0];
        drawSegment(ctx, cnn);
    }
    ctx.stroke();
}

// Throttled redraw using requestAnimationFrame
function requestRedraw() {
    if (!needsRedraw) {
        needsRedraw = true;
        animationFrameId = requestAnimationFrame(() => {
            drawMap();
            needsRedraw = false;
        });
    }
}

function postprocessAddresses() {
    //console.time('postprocessAddresses()');
    // Calculate the screen coordinates for each address.
    for (const street in addresses) {
        for (const number in addresses[street]) {
            const [lat, lon] = addresses[street][number].ll;
            addresses[street][number].screen = coordsToScreen(lat, lon);
        }
    }
    //console.timeEnd('postprocessAddresses()');
}

function postprocessJunctions() {
    // Calculate the screen coordinates for each junction.
    // Only recalculate if pan/zoom changed significantly
    //console.time('postprocessJunctions()');
    const panThreshold = 0.5;
    const zoomThreshold = 0.001;

    if (coordinatesCached &&
        Math.abs(panX - lastPanX) < panThreshold &&
        Math.abs(panY - lastPanY) < panThreshold &&
        Math.abs(zoom - lastZoom) < zoomThreshold) {
        //console.timeEnd('postprocessJunctions()');
        return; // Use cached coordinates
    }

    for (const cnn in junctions) {
        const [lat, lon] = junctions[cnn].ll;
        junctions[cnn].screen = coordsToScreen(lat, lon);
    }

    // Cache current transform state
    lastPanX = panX;
    lastPanY = panY;
    lastZoom = zoom;
    coordinatesCached = true;
    //console.timeEnd('postprocessJunctions()');
}

function postprocessSchools() {
    // Calculate the screen coordinates for each school.
    //console.time('postprocessSchools()');
    for (let i = 0; i < schools.length; i++) {
        const [lat, lon] = schools[i].ll;
        schools[i].screen = coordsToScreen(lat, lon);
    }
    //console.timeEnd('postprocessSchools()');
}

function postprocessSegments() {
    // Calculate the screen coordinates for each segment.
    //console.time('postprocessSegments()');
    for (const cnn in segments) {
        segments[cnn].screen = [];
        for (const coords of segments[cnn].line) {
            const [lat, lon] = coords;
            segments[cnn].screen.push(coordsToScreen(lat, lon));
        }
    }
    //console.timeEnd('postprocessSegments()');
}

function preprocessAddresses() {
    //console.time('preprocessAddresses()');
    Object.entries(addressData).forEach(([street, numbers]) => {
        addresses[street] = {};
        Object.entries(numbers).forEach(([number, ll]) => {
            // Convert decimals to full geographic coordinates.
            addresses[street][number] = { ll: expandCoords(ll) };
        });
    });
    //console.timeEnd('preprocessAddresses()');
}

function preprocessJunctions() {
    //console.time('preprocessJunctions()');
    Object.entries(junctions).forEach(([cnn, junction]) => {
        // Convert decimals to full geographic coordinates.
        junctions[cnn].ll = expandCoords(junction.ll);
    });
    //console.timeEnd('preprocessJunctions()');
}

function howFarSegment(cnn) {
    const segment = segments[cnn];
    if (!segment) return Infinity;
    if (segment.line.length < 2) return 0;
    let distance = 0;
    for (let i = 0; i < segment.line.length - 1; i++) {
        const coords1 = segment.line[i];
        const coords2 = segment.line[i + 1];
        distance += howFar(coords1, coords2);
    }
    return distance;
}

function preprocessSegment(cnn) {
    const segment = segments[cnn];
    if (!segment) return;
    const f = segment.f;
    const t = segment.t;

    // Convert decimals to full geographic coordinates.
    for (let i = 0; i < segment.line.length; i++) {
        segment.line[i] = expandCoords(segment.line[i]);
    }

    // Allow fast segment lookup by junction CNN.
    if (!segmentJunctions[f]) {
        segmentJunctions[f] = {};
    }
    if (!segmentJunctions[f][t]) {
        segmentJunctions[f][t] = [];
    }
    segmentJunctions[f][t].push(cnn);
    if (!segmentJunctions[t]) {
        segmentJunctions[t] = {};
    }
    if (!segmentJunctions[t][f]) {
        segmentJunctions[t][f] = [];
    }
    segmentJunctions[t][f].push(cnn);

    segment.to = isOneWaySegment(f, t);
    segment.distance = howFarSegment(cnn);
}

function preprocessSegments() {
    //console.time('preprocessSegments()');
    for (const cnn in segments) {
        preprocessSegment(cnn);
    }
    //console.timeEnd('preprocessSegments()');
}

function resizeCanvas() {
    //console.time('resizeCanvas()');
    if (!canvas) return;

    // Step 1: Store the geographic center point before resizing
    let centerLat, centerLon;
    if (bounds) {
        const centerScreenX = canvas.width / 2;
        const centerScreenY = canvas.height / 2;
        [centerLat, centerLon] = screenToCoords(centerScreenX, centerScreenY);
    }

    // Step 2: Update canvas dimensions
    const container = document.querySelector('.map-container');
    const rect = container.getBoundingClientRect();

    // Set canvas size to match container
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Step 3: Calculate display dimensions to maintain geographic accuracy
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

    // Step 4: Adjust pan to keep the same geographic center point centered
    if (bounds && centerLat !== undefined && centerLon !== undefined) {
        const [newCenterX, newCenterY] = coordsToScreen(centerLat, centerLon);
        const newCenterScreenX = canvas.width / 2;
        const newCenterScreenY = canvas.height / 2;

        // Adjust pan so the center point appears at the center of the new viewport
        panX += (newCenterX - newCenterScreenX) / zoom;
        panY += (newCenterY - newCenterScreenY) / zoom;
    }

    requestRedraw();
    //console.timeEnd('resizeCanvas()');
}

function loadMap() {
    console.time('loadMap()');
    canvas = document.getElementById('mapCanvas');
    ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) {
        info('Oh no! Can\'t draw the map, sorry.');
        log('Cannot initialize canvas');
        return;
    }

    //console.time('Preprocess data');
    preprocessAddresses();
    preprocessJunctions();
    preprocessSegments();
    //console.timeEnd('Preprocess data');

    // Must calculate map boundaries before calling resizeCanvas().
    bounds = calculateBounds();
    console.log(`Map bounds: lat ${bounds.minLat.toFixed(5)} - ${bounds.maxLat.toFixed(5)}, lon ${bounds.minLon.toFixed(5)} - ${bounds.maxLon.toFixed(5)}`);

    addEventListeners();

    // Resize canvas to fill container
    // resizeCanvas() calls drawMap().
    resizeCanvas();

    info('Select start and end points to find a path.');
    console.timeEnd('loadMap()');
}

function findClosestJunction(baseX, baseY, threshold = zoom * 50) {
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

function findClosestSchool(baseX, baseY, threshold = zoom * 50) {
    let closestSchool = null;
    let closestDistance = Infinity;

    schools.forEach((school, index) => {
        const [x, y] = school.screen;
        const distance = coordsDistance([y, x], [baseY, baseX]);

        if (distance < threshold / zoom && distance < closestDistance) {
            closestDistance = distance;
            closestSchool = school;
        }
    });

    return closestSchool;
}

function addEventListeners() {
    // Mouse events for pan/zoom
    canvas.addEventListener('mousedown', handleMouseDown);
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
    hasSignificantlyDragged = false;
    lastMouseX = e.offsetX;
    lastMouseY = e.offsetY;

    // Add document-level listeners to handle mouse events outside the canvas
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection while dragging
    e.preventDefault();
}

function handleMouseMove(e) {
    if (!isDragging) return;

    // Get canvas position to calculate relative coordinates
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const deltaX = mouseX - lastMouseX;
    const deltaY = mouseY - lastMouseY;

    // Track if significant movement occurred
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        hasSignificantlyDragged = true;
    }

    panX -= deltaX / zoom;
    panY -= deltaY / zoom;

    lastMouseX = mouseX;
    lastMouseY = mouseY;

    requestRedraw();
}

function handleMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;

    // Remove document-level listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
}

function zoomCanvas(x, y, zoomFactor) {
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * zoomFactor));
    if (newZoom === zoom) return;

    // Reverse the coordinate transformation to find where the mouse points in
    // the "base" coordinate space (before zoom/pan).

    // First, reverse the zoom transformation
    const baseX = x / newZoom - panX;
    const baseY = y / newZoom - panY;

    // Pan baseX,baseY to x,y after zoom
    panX = x / zoom - baseX;
    panY = y / zoom - baseY;

    zoom = newZoom;

    requestRedraw();
}

function handleWheel(e) {
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

    // Zoom toward mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    zoomCanvas(mouseX, mouseY, zoomFactor);
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

    handleTouchTap(mouseX, mouseY);
}

function getTouchCoordinates(e) {
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
function getTouchCenter(touch1, touch2) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
        y: (touch1.clientY + touch2.clientY) / 2 - rect.top
    };
}

function handleTouchStart(e) {
    e.preventDefault(); // Prevent scrolling

    if (e.touches.length === 1) {
        // Single touch - start panning or potential tap
        isDragging = true;
        isPinching = false;
        hasSignificantlyDragged = false; // Reset drag tracking

        const coords = getTouchCoordinates(e);
        lastMouseX = coords.x;
        lastMouseY = coords.y;

        // Track touch start for tap detection
        touchStartTime = Date.now();
        touchStartX = coords.x;
        touchStartY = coords.y;
        touchMoved = false;

    } else if (e.touches.length === 2) {
        // Two touches - start pinching
        isDragging = false;
        isPinching = true;
        touchMoved = true; // Pinch gestures are not taps

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        initialPinchDistance = getTouchDistance(touch1, touch2);
        initialPinchCenter = getTouchCenter(touch1, touch2);
        initialZoom = zoom;
    }
}

function handleTouchTap(tapX, tapY) {
    const closestCNN = findClosestJunction(tapX, tapY);
    if (closestCNN) {
        selectJunction(closestCNN);
    }

    const school = findClosestSchool(tapX, tapY);
    if (school) {
        info(`School: ${school.prefix} ${school.name} ${school.suffix} - ${school.address}`);
    }
}

function handleTouchMove(e) {
    e.preventDefault(); // Prevent scrolling

    if (e.touches.length === 1 && isDragging && !isPinching) {
        // Single touch panning
        const coords = getTouchCoordinates(e);
        const deltaX = coords.x - lastMouseX;
        const deltaY = coords.y - lastMouseY;

        // Check if movement exceeds tap threshold
        const totalDeltaX = Math.abs(coords.x - touchStartX);
        const totalDeltaY = Math.abs(coords.y - touchStartY);

        if (totalDeltaX > tapThreshold || totalDeltaY > tapThreshold) {
            touchMoved = true;
            hasSignificantlyDragged = true;
        }

        panX -= deltaX / zoom;
        panY -= deltaY / zoom;

        lastMouseX = coords.x;
        lastMouseY = coords.y;

        requestRedraw();
    } else if (e.touches.length === 2 && isPinching) {
        // Two touch pinch-to-zoom
        touchMoved = true; // Pinch gestures are not taps

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const currentDistance = getTouchDistance(touch1, touch2);
        const currentCenter = getTouchCenter(touch1, touch2);

        // Calculate zoom factor based on distance change
        const zoomFactor = currentDistance / initialPinchDistance;
        zoomCanvas(currentCenter.x, currentCenter.y, zoomFactor);
    }
}

function handleTouchEnd(e) {
    e.preventDefault(); // Prevent scrolling

    if (e.touches.length === 0) {
        // No more touches - check if this was a tap
        const touchDuration = Date.now() - touchStartTime;

        if (!touchMoved && !isPathfinding &&
            touchDuration < tapMaxDuration &&
            isDragging && !isPinching) {

            // This was a tap - treat it like a click for junction selection
            handleTouchTap(touchStartX, touchStartY);
        }

        // Reset touch state
        isDragging = false;
        isPinching = false;
        hasSignificantlyDragged = false;
        touchMoved = false;

    } else if (e.touches.length === 1 && isPinching) {
        // Went from pinch to single touch - switch to panning
        isPinching = false;
        isDragging = true;
        touchMoved = true; // Prevent this from being considered a tap

        const coords = getTouchCoordinates(e);
        lastMouseX = coords.x;
        lastMouseY = coords.y;
    }
}

function selectJunction(cnn) {
    if (!start) {
        start = parseInt(cnn);
        info('Select an end point to find a path.');
        drawMap();
        return;
    }

    if (!end && cnn !== start) {
        end = parseInt(cnn);
        document.getElementById('findPathBtn').disabled = false;
        info('Start and end points selected.');
        drawMap();
        return;
    }

    // Reset selection
    start = parseInt(cnn);
    end = null;
    document.getElementById('findPathBtn').disabled = true;
    info('Select an end point to find a path.');
    drawMap();
}

function zoomTowardCenter(zoomFactor) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    zoomCanvas(centerX, centerY, zoomFactor);
}

function zoomIn() {
    zoomTowardCenter(1.5);
}

function zoomOut() {
    zoomTowardCenter(1 / 1.5);
}

function fitToView() {
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
