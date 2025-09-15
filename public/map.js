import { formatStreet } from './address.js';
import { expandCoords } from './geo.js';
import { stripTags } from './html.js';
import { describePath } from './path.js';
import addressData from './address-data.js';
import junctions from './junctions.js';
import schools from './school-data.js';
import segmentData from './segments.js';

// Map state
let bounds;
let canvas = { bg: null, pf: null, ui: null };
let context = { bg: null, pf: null, ui: null };
const dirty = { bg: true, pf: true, ui: true };
let canvasAspectRatio, mapAspectRatio;
let mapDisplayWidth, mapDisplayHeight, mapOffsetX, mapOffsetY;
let start, end, isPathfinding = false;
let zoom = 1;
const minZoom = 1.0;
const maxZoom = 100;
let panX = 0, panY = 0;
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
let segments = {};

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
        markAllLayersDirty();
        drawMap(); // Redraw with new colors
    });
}

function getColor(colorName) {
    return colors[theme][colorName];
}

function markAllLayersDirty() {
    dirty.bg = true;
    dirty.pf = true;
    dirty.ui = true;
}

function initializeMapView() {
    if (!canvas.bg || !bounds) return;

    // Calculate the center of the map data in base coordinates
    const mapCenterX = mapDisplayWidth / 2 + mapOffsetX;
    const mapCenterY = mapDisplayHeight / 2 + mapOffsetY;

    // Calculate where we want the center to appear (center of canvas)
    const viewportCenterX = canvas.bg.width / 2;
    const viewportCenterY = canvas.bg.height / 2;

    // Set pan so that map center appears at viewport center
    panX = mapCenterX - viewportCenterX / zoom;
    panY = mapCenterY - viewportCenterY / zoom;

    // Initial zoom that fits the map nicely in the viewport
    const scaleX = canvas.bg.width / mapDisplayWidth;
    const scaleY = canvas.bg.height / mapDisplayHeight;
    zoom = Math.min(scaleX, scaleY) * 0.99; // A little padding

    // Recalculate pan with the new zoom level
    panX = mapCenterX - viewportCenterX / zoom;
    panY = mapCenterY - viewportCenterY / zoom;

    // Mark all layers dirty since zoom/pan changed
    markAllLayersDirty();
    drawMap();
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
    // We must set mapAspectRatio before calling resizeCanvases().
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

    // Convert to base screen coordinates (before zoom/pan transform)
    const baseX = normalizedX * mapDisplayWidth + mapOffsetX;
    const baseY = normalizedY * mapDisplayHeight + mapOffsetY;

    return [baseX, baseY];
}

function screenToCoords(screenX, screenY) {
    if (!bounds) return [0, 0];

    // Reverse zoom and pan
    const baseX = screenX / zoom + panX;
    const baseY = screenY / zoom + panY;

    // Convert to normalized coordinates
    const normalizedX = (baseX - mapOffsetX) / mapDisplayWidth;
    const normalizedY = (baseY - mapOffsetY) / mapDisplayHeight;

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
    // Transform margin to account for zoom
    const transformedMargin = margin / zoom;
    const viewLeft = panX - transformedMargin;
    const viewTop = panY - transformedMargin;
    const viewRight = panX + canvas.bg.width / zoom + transformedMargin;
    const viewBottom = panY + canvas.bg.height / zoom + transformedMargin;

    return x < viewLeft || x > viewRight || y < viewTop || y > viewBottom;
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

function drawArrow(ctx, x1, y1, x2, y2) {
    const arrowLength = Math.max(1, 25 / zoom);
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
    ctx.fillStyle = getColor('arrows');
    ctx.lineWidth = Math.min(1, 25 / zoom);

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

function drawAddresses(ctx) {
    // Only show addresses when zoomed in enough to be readable
    if (zoom < 50) return 0;

    //console.time('drawAddresses()');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2 / zoom;
    ctx.miterLimit = 3;
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `${Math.min(0.18, 11 / zoom)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let addressCount = 0;

    Object.entries(addresses).forEach(([street, numbers]) => {
        Object.entries(numbers).forEach(([number, coords]) => {
            const [x, y] = coords.screen;

            if (invisible(x, y, 30)) return;

            // Draw a small dot for the address location
            ctx.fillStyle = getColor('text');
            ctx.beginPath();
            ctx.arc(x, y, 0.05, 0, 2 * Math.PI);
            ctx.fill();

            // Draw address number slightly offset so it doesn't overlap the dot
            const offsetY = 0.1;
            ctx.fillStyle = getColor('text');
            ctx.strokeText(number, x, y - offsetY);
            ctx.fillText(number, x, y - offsetY);

            addressCount++;
        });
    });

    //console.timeEnd('drawAddresses()');
    return addressCount;
}

function drawSchool(ctx, size, school) {
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
    ctx.font = `${Math.min(2, 24 / zoom)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const schoolName = `${school.prefix} ${school.name} ${school.suffix}`.trim();
    const textY = y + size/2.75;
    ctx.strokeText(schoolName, x, textY);
    ctx.fillText(schoolName, x, textY);

    return true;
}

function drawSchools(ctx) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4 / zoom;

    const size = Math.min(1.5, 100 / zoom);
    let schoolCount = 0;

    schools.forEach(school => {
        schoolCount += drawSchool(ctx, size, school);
    });

    return schoolCount;
}

function drawStreetNames(ctx) {
    if (zoom < 6) return;

    //console.time('drawStreetNames()');
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `${Math.min(1.5, 18 / zoom)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4 / zoom;
    ctx.lineJoin = 'round';

    const drawnStreets = new Set();
    const streetSegments = new Map(); // street name -> array of segments

    // Collect street segments
    for (const [cnn, junction] of Object.entries(junctions)) {
        const [x1, y1] = junction.screen;

        for (const adjCNN of junction.adj) {
            if (!junctions[adjCNN]) continue;
            const key = [cnn, adjCNN].sort().join('-');
            if (drawnStreets.has(key)) continue;
            drawnStreets.add(key);

            if (!segments[key].street.length) continue;
            if (!segmentIsVisible(cnn, adjCNN)) continue;

            const street = segments[key].street;
            if (!streetSegments.has(street)) {
                streetSegments.set(street, []);
            }
            const [x2, y2] = junctions[adjCNN].screen;
            streetSegments.get(street).push({
                x1, y1, x2, y2,
                length: coordsDistance([y1, x1], [y2, x2])
            });
        }
    }

    // Draw street names on longest segments
    streetSegments.forEach((segments, street) => {
        // Find the longest segment for this street
        const longestSegment = segments.reduce((longest, segment) =>
            segment.length > longest.length ? segment : longest
        );

        // Only draw if segment is long enough for text
        const textWidth = ctx.measureText(street).width;
        if (longestSegment.length > textWidth / 2) {
            drawStreetNameOnSegment(ctx, street, longestSegment);
        }
    });
    //console.timeEnd('drawStreetNames()');
}

function drawStreetNameOnSegment(ctx, street, segment) {
    // FIXME: Take into account segment curves.
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
    const transformedMargin = margin / zoom;
    const rectLeft = panX - transformedMargin;
    const rectTop = panY - transformedMargin;
    const rectRight = panX + canvas.bg.width / zoom + transformedMargin;
    const rectBottom = panY + canvas.bg.height / zoom + transformedMargin;

    return lineIntersectsRect(x1, y1, x2, y2, rectLeft, rectTop, rectRight, rectBottom);
}

function segmentIsVisible(cnn1, cnn2, margin) {
    const [x1, y1] = junctions[cnn1].screen;
    const [x2, y2] = junctions[cnn2].screen;
    const key = [cnn1, cnn2].sort().join('-');
    if (!(key in segments)) {
        return lineIsVisible(x1, y1, x2, y2, margin);
    }
    const pairs = segments[key].screen;
    pairs.push([x2, y2]);
    let x, y, fro = [x1, x2];
    for ([x, y] of pairs) {
        if (lineIsVisible(fro[0], fro[1], x, y, margin)) {
            return true;
        }
        fro = [x, y];
    }
    return false;
}

function drawSegment(ctx, cnn1, cnn2, oneWay = false) {
    const key = [cnn1, cnn2].sort().join('-');
    const [x1, y1] = junctions[cnn1].screen;
    let penultimatePair = junctions[cnn1].screen;
    ctx.moveTo(x1, y1);
    if (key in segments) {
        const pairs = segments[key].screen;
        for (const [x, y] of pairs) {
            ctx.lineTo(x, y);
        }
        penultimatePair = pairs.at(-1);
    }
    const [x2, y2] = junctions[cnn2].screen;
    ctx.lineTo(x2, y2);
    return penultimatePair;
}

function drawStreets(ctx) {
    //console.time('drawStreets()');
    let streetCount = 0;

    // 1st pass: Draw regular two-way streets
    ctx.strokeStyle = getColor('streets');
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.min(1, 25 / zoom);
    ctx.beginPath();

    const drawnConnections = new Set();
    const oneWaySegments = [];

    Object.entries(junctions).forEach(([cnn, junction]) => {
        const [x1, y1] = junction.screen;

        for (const adjCNN of junction.adj) {
            if (!junctions[adjCNN]) continue;

            const key = [cnn, adjCNN].sort().join('-');
            if (drawnConnections.has(key)) continue;
            drawnConnections.add(key);

            if (!segmentIsVisible(cnn, adjCNN, 200)) continue;
            streetCount++;

            // Check if this is a one-way street
            if (segments[key].to) {
                // Store one-way segment for later drawing
                oneWaySegments.push({
                    fromCNN: segments[key].to === cnn ? adjCNN : cnn,
                    toCNN: segments[key].to === cnn ? cnn : adjCNN
                });
            } else {
                // Regular two-way street
                drawSegment(ctx, cnn, adjCNN);
            }
        }
    });

    ctx.stroke();

    // 2nd pass: Draw one-way streets in a different color
    if (oneWaySegments.length > 0) {
        ctx.strokeStyle = getColor('oneWays');
        ctx.lineWidth = Math.min(1, 25 / zoom);
        ctx.beginPath();

        oneWaySegments.forEach(segment => {
            // Get the second to last pair of screen coordinates in the segment line.
            segment.pair = drawSegment(ctx, segment.fromCNN, segment.toCNN, true);
        });

        ctx.stroke();

        // Draw arrows on one-way streets (only when zoomed in enough)
        if (zoom > 2) {
            oneWaySegments.forEach(segment => {
                // Determine arrow direction based on which junction points to which
                const [fromX, fromY] = segment.pair;
                const [toX, toY] = junctions[segment.toCNN].screen;
                drawArrow(ctx, fromX, fromY, toX, toY);
            });
        }
    }

    //console.timeEnd('drawStreets()');
    return streetCount;
}

function drawJunction(ctx, x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

function drawJunctionOutline(ctx, x, y, radius, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.min(2, 5 / zoom);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
}

function drawJunctions(ctx) {
    //console.time('drawJunctions()');
    let junctionCount = 0;
    const radius = Math.min(0.5, 20 / zoom);

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
    //console.timeEnd('drawJunctions()');
    return junctionCount;
}

function drawPathSearch(ctx) {
    const radius = Math.min(0.5, 20 / zoom);

    // 2nd pass: Draw current node
    if (here && junctions[here]) {
        const [x, y] = junctions[here].screen;
        if (visible(x, y)) {
            drawJunction(ctx, x, y, radius * 7, getColor('current'));
        }
    }

    // 3rd pass: Draw closed set
    closedSet.forEach(cnn => {
        if (!junctions[cnn]) return;
        const [x, y] = junctions[cnn].screen;
        if (invisible(x, y)) return;
        drawJunction(ctx, x, y, radius * 2, getColor('closedSet'));
    });

    // 4th pass: Draw open set
    openSet.forEach(cnn => {
        if (!junctions[cnn]) return;
        const [x, y] = junctions[cnn].screen;
        if (invisible(x, y)) return;
        drawJunction(ctx, x, y, radius * 2.5, getColor('openSet'));
    });
}

function drawJunctionStart(ctx) {
    // 5th pass: Draw starting point
    if (!start || !junctions[start]) return;
    const [x, y] = junctions[start].screen;
    if (invisible(x, y)) return;
    const radius = Math.min(5, 25 / zoom);
    drawJunction(ctx, x, y, radius, getColor('start'));
    drawJunctionOutline(ctx, x, y, radius, getColor('text'));
}

function drawJunctionEnd(ctx) {
    // 6th pass: Draw end point
    if (!end || !junctions[end]) return;
    const [x, y] = junctions[end].screen;
    if (invisible(x, y)) return;
    const radius = Math.min(5, 25 / zoom);
    drawJunction(ctx, x, y, radius, getColor('end'));
    drawJunctionOutline(ctx, x, y, radius, getColor('text'));
}

function drawJunctionLabels(ctx) {
    if (zoom < 30) return;

    for (const cnn in junctions) {
        const [x, y] = junctions[cnn].screen;

        if (invisible(x, y)) continue;

        ctx.lineJoin = 'round';
        ctx.lineWidth = 2 / zoom;
        ctx.miterLimit = 3;
        ctx.fillStyle = getColor('text');
        ctx.strokeStyle = getColor('background');
        ctx.font = `${Math.min(1, 12 / zoom)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(cnn, x, y);
        ctx.fillText(cnn, x, y);
    }
}

function drawMap() {
    //console.time('drawMap()');
    if (!canvas.bg || !canvas.pf || !canvas.ui || !bounds) return;

    // Render each layer only if dirty
    if (dirty.bg) renderBackgroundLayer();
    if (dirty.pf) renderPathfindingLayer();
    if (dirty.ui) renderUILayer();

    //console.timeEnd('drawMap()');
    //console.log(' ');
}

function drawPath(ctx) {
    if (path.length < 2) return;

    ctx.strokeStyle = getColor('path');
    ctx.lineWidth = Math.min(4, 25 / zoom);
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

// Apply canvas transform before drawing
function applyCanvasTransform(ctx) {
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-panX, -panY);
}

// Reset canvas transform after drawing
function resetCanvasTransform(ctx) {
    ctx.restore();
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
    console.time('postprocessAddresses()');
    // Calculate the screen coordinates for each junction.
    for (const street in addresses) {
        for (const number in addresses[street]) {
            const [lat, lon] = addresses[street][number].ll;
            addresses[street][number].screen = coordsToScreen(lat, lon);
        }
    }
    console.timeEnd('postprocessAddresses()');
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
    for (const key in segments) {
        segments[key].screen = [];
        for (const coords of segments[key].line) {
            const [lat, lon] = coords;
            const [x, y] = coordsToScreen(lat, lon);
            segments[key].screen.push(coordsToScreen(lat, lon));
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

function preprocessSegmentLine(lls) {
    if (!lls) return [];
    const line = [];
    for (const ll of lls) {
        // Convert decimals to full geographic coordinates.
        line.push(expandCoords(ll));
    }
    return line;
}

function preprocessSegment(cnn, adjCNN) {
    if (!junctions[adjCNN]) return;

    const key = [cnn, adjCNN].sort().join('-');
    if (key in segments) return;

    const segment = {
        street: '',
        line: preprocessSegmentLine(segmentData[key]),
        to: null
    };

    // Check if this is a one-way street
    const isOneWayFromTo = isOneWayStreet(cnn, adjCNN);
    const isOneWayToFrom = isOneWayStreet(adjCNN, cnn);

    if (isOneWayFromTo || isOneWayToFrom) {
        segment.to = isOneWayFromTo ? adjCNN : cnn;
    }

    // Find common street names between the two junctions
    const commonStreets = junctions[cnn].streets.filter(street =>
        junctions[adjCNN].streets.includes(street)
    );
    if (commonStreets.length) {
        segment.street = commonStreets[0]; // Use first common street
    }

    segments[key] = segment;
}

function preprocessJunctions() {
    //console.time('preprocessJunctions()');
    Object.entries(junctions).forEach(([cnn, junction]) => {
        // Convert decimals to full geographic coordinates.
        junctions[cnn] = {
            ...junction,
            ll: expandCoords(junction.ll)
        };
        for (const adjCNN of junction.adj) {
            preprocessSegment(cnn, adjCNN);
        }
    });
    //console.timeEnd('preprocessJunctions()');
}

function resizeCanvases() {
    // Step 1: Store the geographic center point before resizing
    let centerLat, centerLon;
    if (bounds && canvas.bg) {
        const centerScreenX = canvas.bg.width / 2;
        const centerScreenY = canvas.bg.height / 2;
        [centerLat, centerLon] = screenToCoords(centerScreenX, centerScreenY);
    }

    // Step 2: Update canvas dimensions
    const container = document.querySelector('.map-container');
    const rect = container.getBoundingClientRect();

    for (const key in canvas) {
        canvas[key].width = rect.width;
        canvas[key].height = rect.height;
    }

    // Step 3: Update coordinate system parameters
    canvasAspectRatio = canvas.bg.width / canvas.bg.height;

    if (mapAspectRatio > canvasAspectRatio) {
        // Map is wider than canvas - fit to width
        mapDisplayWidth = canvas.bg.width;
        mapDisplayHeight = canvas.bg.width / mapAspectRatio;
        mapOffsetX = 0;
        mapOffsetY = (canvas.bg.height - mapDisplayHeight) / 2;
    } else {
        // Map is taller than canvas - fit to height
        mapDisplayWidth = canvas.bg.height * mapAspectRatio;
        mapDisplayHeight = canvas.bg.height;
        mapOffsetX = (canvas.bg.width - mapDisplayWidth) / 2;
        mapOffsetY = 0;
    }

    // Step 4: Recalculate screen coordinates with new coordinate system
    postprocessAddresses();
    postprocessJunctions();
    postprocessSchools();
    postprocessSegments();

    // Step 5: Adjust pan to keep the same geographic center point centered
    if (bounds && centerLat !== undefined && centerLon !== undefined) {
        const [newCenterX, newCenterY] = coordsToScreen(centerLat, centerLon);
        const newCenterScreenX = canvas.bg.width / 2;
        const newCenterScreenY = canvas.bg.height / 2;

        // Adjust pan so the center point appears at the center of the new viewport
        panX = newCenterX - newCenterScreenX / zoom;
        panY = newCenterY - newCenterScreenY / zoom;
    }

    markAllLayersDirty();
    requestRedraw();
}

function loadMap() {
    for (const key in canvas) {
        const id = `${key}Canvas`;
        canvas[key] = document.getElementById(id);
        if (!canvas[key]) {
            info('Oh no! Can\'t draw the map, sorry.');
            log("Cannot find canvas: " + id);
            return;
        }
        context[key] = canvas[key].getContext('2d');
        if (!context[key]) {
            info('Oh no! Can\'t draw the map, sorry.');
            log("Cannot get context for: " + id);
            return;
        }
    }

    preprocessJunctions();
    preprocessAddresses();

    // Must calculate map boundaries before calling resizeCanvases().
    bounds = calculateBounds();
    console.log(`Map bounds: lat ${bounds.minLat.toFixed(5)} - ${bounds.maxLat.toFixed(5)}, lon ${bounds.minLon.toFixed(5)} - ${bounds.maxLon.toFixed(5)}`);

    addEventListeners();

    // Resize canvas to fill container
    resizeCanvases();

    // Calculate proper initial pan values to center the map
    initializeMapView();

    info('Select start and end points to find a path.');
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

function findClosestSchool(baseX, baseY, threshold = 20) {
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
    canvas.ui.addEventListener('mousedown', handleMouseDown);
    canvas.ui.addEventListener('wheel', handleWheel);
    canvas.ui.addEventListener('click', handleClick);

    // Touch events for mobile panning
    const options = { passive: false };
    canvas.ui.addEventListener('touchstart', handleTouchStart, options);
    canvas.ui.addEventListener('touchmove', handleTouchMove, options);
    canvas.ui.addEventListener('touchend', handleTouchEnd, options);
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
    const rect = canvas.ui.getBoundingClientRect();
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

    markAllLayersDirty();
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

    markAllLayersDirty();
    requestRedraw();
}

function handleWheel(e) {
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

    // Zoom toward mouse position
    // Use canvas.ui for measurements since it's the interaction layer
    const rect = canvas.ui.getBoundingClientRect();
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

    const rect = canvas.ui.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    handleTouchTap(mouseX, mouseY);
}

function getTouchCoordinates(e) {
    const rect = canvas.ui.getBoundingClientRect();
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
    const rect = canvas.ui.getBoundingClientRect();
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
    // Convert tap coordinates to base coordinates for comparison
    const baseTapX = tapX / zoom + panX;
    const baseTapY = tapY / zoom + panY;

    const closestCNN = findClosestJunction(baseTapX, baseTapY);
    if (closestCNN) {
        selectJunction(closestCNN);
    }

    const school = findClosestSchool(baseTapX, baseTapY);
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

        markAllLayersDirty();
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
        dirty.ui = true;
        drawMap();
        return;
    }

    if (!end && cnn !== start) {
        end = parseInt(cnn);
        document.getElementById('findPathBtn').disabled = false;
        info('Start and end points selected.');
        dirty.ui = true;
        drawMap();
        return;
    }

    // Reset selection
    start = parseInt(cnn);
    end = null;
    document.getElementById('findPathBtn').disabled = true;
    info('Select an end point to find a path.');
    dirty.pf = true;
    dirty.ui = true;
    drawMap();
}

function zoomTowardCenter(zoomFactor) {
    const centerX = canvas.ui.width / 2;
    const centerY = canvas.ui.height / 2;
    zoomCanvas(centerX, centerY, zoomFactor);
}

function zoomIn() {
    zoomTowardCenter(1.5);
}

function zoomOut() {
    zoomTowardCenter(1 / 1.5);
}

function fitToView() {
    initializeMapView();
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
    const description = stripTags(describePath(addressData, junctions, path));
    console.log(description);

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
        dirty.pf = true;
        requestRedraw();
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

    dirty.pf = true;
    requestRedraw();
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

    document.getElementById('showBackground').addEventListener('change', (e) => {
        canvas.bg.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('showPathfinding').addEventListener('change', (e) => {
        canvas.pf.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('showUI').addEventListener('change', (e) => {
        canvas.ui.style.display = e.target.checked ? 'block' : 'none';
    });

    loadMap();
});

window.addEventListener('resize', () => {
    resizeCanvases();
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
    drawStreetNames(ctx);
    const schoolCount = drawSchools(ctx);
    const addressCount = drawAddresses(ctx);

    // Reset transform
    resetCanvasTransform(ctx);

    dirty.bg = false;

    const counts = [
        //`${junctionCount} junctions`,
        //`${streetCount} streets`,
    ];
    if (schoolCount) counts.push(`${schoolCount} schools`);
    if (addressCount) counts.push(`${addressCount} addresses`);
    const stats = [
        //`Canvas: ${canvas.bg.width}x${canvas.bg.height}`,
        `Zoom: ${zoom.toFixed(1)}x`,
        counts.join(', '),
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
