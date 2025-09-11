import { formatStreet } from './address.js';
import { stripTags } from './html.js';
import { describePath } from './path.js';
import addressData from './address-data.js';
import junctions from './junctions.js';
import schoolData from './school-data.js';

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
let theme = 'light';
let addresses = {};
let schools = [];

const colors = {
    light: {
        background: '#fff', // White
        schools: '#f44', // Red
        streets: '#bbb', // Light Gray
        oneWays: '#666', // Dark Gray
        junctions: '#ccc', // Light Gray
        start: '#28a745', // Green
        end: '#dc3545', // Red
        current: '#000', // Black
        openSet: '#ffc107', // Yellow
        closedSet: '#db1', // Gold
        path: '#06c', // Blue
        text: '#000' // Black
    },
    dark: {
        background: '#000', // Black
        schools: '#f44', // Red
        streets: '#444', // Dark Gray
        oneWays: '#aaa', // Light Gray
        junctions: '#333', // Dark Gray
        start: '#4ade80', // Green
        end: '#f87171', // Salmon
        current: '#fff', // White
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

function markLayersDirty(background = false, pathfinding = false, ui = false) {
    if (background) dirty.bg = true;
    if (pathfinding) dirty.pf = true;
    if (ui) dirty.ui = true;
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
    dirty.bg = true;
    dirty.pf = true;
    dirty.ui = true;

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

    // Reverse the canvas transform
    const baseX = screenX / zoom + panX;
    const baseY = screenY / zoom + panY;

    // Convert to normalized coordinates
    const normalizedX = (baseX - mapOffsetX) / mapDisplayWidth;
    const normalizedY = (baseY - mapOffsetY) / mapDisplayHeight;

    // Convert to lat/lon
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

function drawArrow(ctx, x1, y1, x2, y2, color) {
    const arrowLength = 3;
    const arrowAngle = Math.PI / 6;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < arrowLength * 2) return;

    const arrowX = x1 + dx * 0.75;
    const arrowY = y1 + dy * 0.75;
    const angle = Math.atan2(dy, dx);

    ctx.fillStyle = color;
    ctx.lineWidth = 0.75;

    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle - arrowAngle),
        arrowY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle + arrowAngle),
        arrowY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.lineTo(arrowX, arrowY);
    ctx.fill();
}

function drawAddresses(ctx) {
    if (zoom < 40) return 0;

    console.time('drawAddresses()');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.02;
    ctx.miterLimit = 3;
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `0.25px Arial`;
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

            // Draw address number slightly offset
            const offsetY = 0.2;
            ctx.fillStyle = getColor('text');
            ctx.strokeText(number, x, y - offsetY);
            ctx.fillText(number, x, y - offsetY);

            addressCount++;
        });
    });

    console.timeEnd('drawAddresses()');
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
    ctx.font = '2.5px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const schoolName = `${school.prefix} ${school.name} ${school.suffix}`.trim();
    const textY = y + size/2;
    ctx.strokeText(schoolName, x, textY);
    ctx.fillText(schoolName, x, textY);

    return true;
}

function drawSchools(ctx) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.25;

    const size = 4;
    let schoolCount = 0;

    schools.forEach(school => {
        schoolCount += drawSchool(ctx, size, school);
    });

    return schoolCount;
}

function drawStreetNames(ctx) {
    if (zoom < 6) return;

    console.time('drawStreetNames()');
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = '1.5px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 0.25;
    ctx.lineJoin = 'round';

    const drawnStreets = new Set();
    const streetSegments = new Map();

    // Collect street segments (same logic as before)
    for (const [cnn, junction] of Object.entries(junctions)) {
        const [x1, y1] = junction.screen;

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

            const [x2, y2] = junctions[adjCNN].screen;

            if (!segmentIsVisible(x1, y1, x2, y2, 100)) {
                continue;
            }

            const street = commonStreets[0]; // Use first common street
            if (!streetSegments.has(street)) {
                streetSegments.set(street, []);
            }
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
    console.timeEnd('drawStreetNames()');
}

function drawStreetNameOnSegment(ctx, street, segment) {
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

function segmentIsVisible(x1, y1, x2, y2, margin = 100) {
    const transformedMargin = margin / zoom;
    const rectLeft = panX - transformedMargin;
    const rectTop = panY - transformedMargin;
    const rectRight = panX + canvas.bg.width / zoom + transformedMargin;
    const rectBottom = panY + canvas.bg.height / zoom + transformedMargin;

    return lineIntersectsRect(x1, y1, x2, y2, rectLeft, rectTop, rectRight, rectBottom);
}

function drawStreets(ctx) {
    console.time('drawStreets()');
    let streetCount = 0;

    ctx.strokeStyle = getColor('streets');
    ctx.lineWidth = 1;
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

            if (!segmentIsVisible(x1, y1, x2, y2, 200)) continue;
            streetCount++;

            const isOneWayFromTo = isOneWayStreet(cnn, adjCNN);
            const isOneWayToFrom = isOneWayStreet(adjCNN, cnn);

            if (isOneWayFromTo || isOneWayToFrom) {
                oneWaySegments.push({
                    x1, y1, x2, y2,
                    fromCNN: isOneWayFromTo ? cnn : adjCNN,
                    toCNN: isOneWayFromTo ? adjCNN : cnn
                });
            } else {
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            }
        }
    });

    ctx.stroke();

    // Draw one-way streets
    if (oneWaySegments.length > 0) {
        ctx.strokeStyle = getColor('oneWays');
        ctx.lineWidth = 1;
        ctx.beginPath();

        oneWaySegments.forEach(segment => {
            ctx.moveTo(segment.x1, segment.y1);
            ctx.lineTo(segment.x2, segment.y2);
        });

        ctx.stroke();

        // Draw arrows only when zoomed in enough
        if (zoom > 2) {
            oneWaySegments.forEach(segment => {
                const [fromX, fromY] = junctions[segment.fromCNN].screen;
                const [toX, toY] = junctions[segment.toCNN].screen;
                drawArrow(ctx, fromX, fromY, toX, toY, getColor('oneWays'));
            });
        }
    }

    console.timeEnd('drawStreets()');
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
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
}

function drawJunctions(ctx) {
    console.time('drawJunctions()');
    let junctionCount = 0;
    const radius = 0.75;

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
    console.timeEnd('drawJunctions()');
    return junctionCount;
}

function drawPathSearch(ctx) {
    const radius = 2;

    // Draw current node
    if (here && junctions[here]) {
        const [x, y] = junctions[here].screen;
        if (visible(x, y)) {
            drawJunction(ctx, x, y, radius, getColor('current'));
        }
    }

    // Draw closed set
    closedSet.forEach(cnn => {
        if (!junctions[cnn]) return;
        const [x, y] = junctions[cnn].screen;
        if (invisible(x, y)) return;
        drawJunction(ctx, x, y, radius, getColor('closedSet'));
    });

    // Draw open set
    openSet.forEach(cnn => {
        if (!junctions[cnn]) return;
        const [x, y] = junctions[cnn].screen;
        if (invisible(x, y)) return;
        drawJunction(ctx, x, y, radius, getColor('openSet'));
    });
}

function drawJunctionStart(ctx) {
    if (!start || !junctions[start]) return;
    const [x, y] = junctions[start].screen;
    if (invisible(x, y)) return;
    const radius = 4;
    drawJunction(ctx, x, y, radius, getColor('start'));
    drawJunctionOutline(ctx, x, y, radius, getColor('text'));
}

function drawJunctionEnd(ctx) {
    if (!end || !junctions[end]) return;
    const [x, y] = junctions[end].screen;
    if (invisible(x, y)) return;
    const radius = 4;
    drawJunction(ctx, x, y, radius, getColor('end'));
    drawJunctionOutline(ctx, x, y, radius, getColor('text'));
}

function drawJunctionLabels(ctx) {
    if (zoom < 20) return;

    for (const cnn in junctions) {
        const [x, y] = junctions[cnn].screen;

        if (invisible(x, y)) continue;

        ctx.lineJoin = 'round';
        ctx.lineWidth = 0.1;
        ctx.miterLimit = 3;
        ctx.fillStyle = getColor('text');
        ctx.strokeStyle = getColor('background');
        ctx.font = '0.6px Arial';
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
    ctx.lineWidth = 4;
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

function preprocessAddresses(rawAddresses) {
    const processed = {};

    Object.entries(rawAddresses).forEach(([street, addresses]) => {
        processed[street] = {};
        Object.entries(addresses).forEach(([number, coords]) => {
            // Convert decimals to full geographic coordinates.
            const [latDec, lonDec] = coords;
            processed[street][number] = {
                ll: [parseFloat(`37.${latDec}`), parseFloat(`-122.${lonDec}`)],
                screen: null,
            };
        });
    });

    return processed;
}

function preprocessJunctions(rawJunctions) {
    const processed = {};

    Object.entries(rawJunctions).forEach(([cnn, junction]) => {
        const [latDec, lonDec] = junction.ll;
        processed[cnn] = {
            ...junction,
            // Convert decimals to full geographic coordinates.
            ll: [
                parseFloat(`37.${latDec}`),
                parseFloat(`-122.${lonDec}`)
            ]
        };
    });

    return processed;
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

    // Step 5: Adjust pan to keep the same geographic center point centered
    if (bounds && centerLat !== undefined && centerLon !== undefined) {
        const [newCenterX, newCenterY] = coordsToScreen(centerLat, centerLon);
        const newCenterScreenX = canvas.bg.width / 2;
        const newCenterScreenY = canvas.bg.height / 2;

        // Adjust pan so the center point appears at the center of the new viewport
        panX = newCenterX - newCenterScreenX / zoom;
        panY = newCenterY - newCenterScreenY / zoom;
    }

    dirty.bg = true;
    dirty.pf = true;
    dirty.ui = true;

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

    // Preprocess coordinates to pad trailing zeros
    const processedJunctions = preprocessJunctions(junctions);

    // Replace global junctions with processed ones
    Object.keys(junctions).forEach(key => delete junctions[key]);
    Object.assign(junctions, processedJunctions);

    addresses = preprocessAddresses(addressData);
    schools = schoolData;

    // Must calculate map boundaries before calling resizeCanvases().
    bounds = calculateBounds();
    console.log(`Map bounds: lat ${bounds.minLat.toFixed(5)} - ${bounds.maxLat.toFixed(5)}, lon ${bounds.minLon.toFixed(5)} - ${bounds.maxLon.toFixed(5)}`);

    setupEventListeners();

    // Resize canvas to fill container
    resizeCanvases();

    // Calculate proper initial pan values to center the map
    initializeMapView();

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

function setupEventListeners() {
    // Use the top canvas (UI layer) for mouse events
    const topCanvas = canvas.ui;

    // Mouse events for pan/zoom
    topCanvas.addEventListener('mousedown', handleMouseDown);
    topCanvas.addEventListener('mousemove', handleMouseMove);
    topCanvas.addEventListener('mouseup', handleMouseUp);
    topCanvas.addEventListener('wheel', handleWheel);
    topCanvas.addEventListener('click', handleClick);

    // Touch events for mobile panning
    const options = { passive: false };
    topCanvas.addEventListener('touchstart', handleTouchStart, options);
    topCanvas.addEventListener('touchmove', handleTouchMove, options);
    topCanvas.addEventListener('touchend', handleTouchEnd, options);
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

    dirty.bg = true;
    dirty.pf = true;
    dirty.ui = true;

    requestRedraw();
}

function handleMouseUp(e) {
    isDragging = false;
    // Don't reset hasSignificantlyDragged here - let handleClick check it
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

    dirty.bg = true;
    dirty.pf = true;
    dirty.ui = true;

    requestRedraw();
}

function handleWheel(e) {
    e.preventDefault();

    // Zoom toward mouse position
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

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

    // Convert mouse coordinates to base coordinates for comparison
    const baseMouseX = mouseX / zoom + panX;
    const baseMouseY = mouseY / zoom + panY;

    const closestCNN = findClosestJunction(baseMouseX, baseMouseY);
    if (closestCNN) {
        selectJunction(closestCNN);
    }

    const school = findClosestSchool(baseMouseX, baseMouseY);
    if (school) {
        info(`School: ${school.prefix} ${school.name} ${school.suffix} - ${school.address}`);
    }
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
        // Single touch - start panning
        isDragging = true;
        isPinching = false;
        const coords = getTouchCoordinates(e);
        lastMouseX = coords.x;
        lastMouseY = coords.y;
    } else if (e.touches.length === 2) {
        // Two touches - start pinching
        isDragging = false;
        isPinching = true;

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        initialPinchDistance = getTouchDistance(touch1, touch2);
        initialPinchCenter = getTouchCenter(touch1, touch2);
        initialZoom = zoom;
    }
}

function handleTouchMove(e) {
    e.preventDefault(); // Prevent scrolling

    if (e.touches.length === 1 && isDragging && !isPinching) {
        // Single touch panning
        const coords = getTouchCoordinates(e);
        const deltaX = coords.x - lastMouseX;
        const deltaY = coords.y - lastMouseY;

        panX -= deltaX / zoom;
        panY -= deltaY / zoom;

        lastMouseX = coords.x;
        lastMouseY = coords.y;

        dirty.bg = true;
        dirty.pf = true;
        dirty.ui = true;

        requestRedraw();
    } else if (e.touches.length === 2 && isPinching) {
        // Two touch pinch-to-zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const currentDistance = getTouchDistance(touch1, touch2);
        const currentCenter = getTouchCenter(touch1, touch2);

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

            dirty.bg = true;
            dirty.pf = true;
            dirty.ui = true;

            requestRedraw();
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
        const coords = getTouchCoordinates(e);
        lastMouseX = coords.x;
        lastMouseY = coords.y;
    }
}

function selectJunction(cnn) {
    if (!start) {
        start = parseInt(cnn);
        info(`Start point: Junction ${cnn}. Click another junction for the destination.`);
        dirty.ui = true;
        requestRedraw();
        return;
    }

    if (!end && cnn !== start) {
        end = parseInt(cnn);
        document.getElementById('findPathBtn').disabled = false;
        info(`Route set: ${start} → ${end}. Ready for A* pathfinding!`);
        dirty.ui = true;
        requestRedraw();
        return;
    }

    // Reset selection
    resetSelection();
    start = parseInt(cnn);
    end = null;
    document.getElementById('findPathBtn').disabled = true;
    info(`Start point: Junction ${start}. Click another junction for the destination.`);
    dirty.pf = true;
    dirty.ui = true;
    requestRedraw();
}

function zoomTowardCenter(zoomFactor) {
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * zoomFactor));
    if (newZoom === zoom) return;

    const centerX = canvas.ui.width / 2;
    const centerY = canvas.ui.height / 2;

    // Find what base coordinates the center currently shows
    const baseCenterX = centerX / zoom + panX;
    const baseCenterY = centerY / zoom + panY;

    // After zoom, adjust pan so that same base point appears at center
    panX = baseCenterX - centerX / newZoom;
    panY = baseCenterY - centerY / newZoom;

    zoom = newZoom;

    dirty.bg = true;
    dirty.pf = true;
    dirty.ui = true;

    requestRedraw();
}

function zoomIn() {
    zoomTowardCenter(1.5);
}

function zoomOut() {
    zoomTowardCenter(1 / 1.5);
}

function fitToView() {
    if (!bounds) return;

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
}

function resetAndRedraw() {
    resetSelection();
    dirty.pf = true;
    dirty.ui = true;
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
    document.getElementById('resetBtn').addEventListener('click', resetAndRedraw);
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
