import { formatStreet } from './address.js';
import { expandCoords, howFar } from './geo.js';
import { stripTags } from './html.js';
import { describePath } from './path.js';
import addressData from './address-data.js';
import junctions from './junctions.js';
import schools from './school-data.js';
import segments from './segments.js';

// Map state
let bounds;
let canvases = { bg: null, pf: null, ui: null };
let contexts = { bg: null, pf: null, ui: null };
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

    // Convert to screen coordinates within the map display area
    // We must call resizeCanvases() first to populate these values.
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

function coordsDistance(a, b) {
    const [ax, ay] = a;
    const [bx, by] = b;
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
}

function invisible(x, y, margin = 50) {
    // Transform margin to account for zoom
    margin /= zoom;
    const canvas = canvases.bg;
    const viewLeft = panX - margin;
    const viewTop = panY - margin;
    const viewRight = panX + canvas.width / zoom + margin;
    const viewBottom = panY + canvas.height / zoom + margin;

    return x < viewLeft || x > viewRight || y < viewTop || y > viewBottom;
}

function visible(x, y, margin) {
    return !invisible(x, y, margin);
}

function drawArrow(ctx, x1, y1, x2, y2, color) {
    const arrowLength = Math.min(2, 100 / zoom);
    const arrowAngle = Math.PI / 7;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Don't draw arrow if segment is too short
    if (length < arrowLength) return;

    // Calculate arrow position (closer to the end point)
    const arrowX = x1 + dx * 0.95;
    const arrowY = y1 + dy * 0.95;

    // Calculate arrow direction
    const angle = Math.atan2(dy, dx);

    // Draw arrow head
    ctx.fillStyle = color;
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
    if (zoom < 30) return 0;

    //console.time('  drawAddresses()');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2 / zoom;
    ctx.miterLimit = 3;
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `${Math.min(0.3, 11 / zoom)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let addressCount = 0;
    const radius = 0.05;

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
            const offsetY = 0.125;
            ctx.fillStyle = getColor('text');
            ctx.strokeText(number, x, y - offsetY);
            ctx.fillText(number, x, y - offsetY);

            addressCount++;
        });
    });

    //console.timeEnd('  drawAddresses()');
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
    //console.time('  drawSchools()');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4 / zoom;

    const size = Math.min(1.5, 100 / zoom);
    let schoolCount = 0;

    schools.forEach(school => {
        schoolCount += drawSchool(ctx, size, school);
    });

    //console.timeEnd('  drawSchools()');
    return schoolCount;
}

function drawStreetNames(ctx) {
    if (zoom < 6) return;

    //console.time('  drawStreetNames()');
    ctx.fillStyle = getColor('text');
    ctx.strokeStyle = getColor('background');
    ctx.font = `${Math.min(1.5, 18 / zoom)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4 / zoom;
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
            distance: segment.distance,
            visibleLength: calculateSegmentVisibleLength(cnn)
        });
    }

    // Draw street names on segments with most visible length
    streetSegments.forEach((blocks, street) => {
        // Find the segment with the most visible length for this street
        const bestSegment = blocks.reduce((best, segment) =>
            segment.visibleLength > best.visibleLength ? segment : best
        );

        // Only draw if segment has significant visible length
        const textWidth = ctx.measureText(street).width;
        if (bestSegment.visibleLength > textWidth / 4) {
            // Check if this is a long segment that should have multiple labels
            const labelSpacing = Math.max(textWidth * 2, 150 / zoom);
            if (bestSegment.visibleLength > labelSpacing * 2) {
                // Long segment - use multiple labels
                drawMultipleLabelsOnSegment(ctx, street, bestSegment.cnn);
            } else {
                // Short segment - use single label
                drawStreetNameOnSegment(ctx, street, bestSegment.cnn);
            }
        }
    });
    //console.timeEnd('  drawStreetNames()');
}

function drawStreetNameOnSegment(ctx, street, cnn) {
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

    if (longestIndex === undefined) return;

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
    margin /= zoom;
    const canvas = canvases.bg;
    const rectLeft = panX - margin;
    const rectTop = panY - margin;
    const rectRight = panX + canvas.width / zoom + margin;
    const rectBottom = panY + canvas.height / zoom + margin;

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

function drawBezier(ctx, points, i) {
    const p0 = points[i - 1];
    const p1 = points[i];     // Start of current span
    const p2 = points[i + 1]; // End of current span
    const p3 = points[i + 2];

    // Normalize vectors
    function normalize(x, y) {
        const length = Math.sqrt(x * x + y * y);
        return length > 0 ? [x / length, y / length] : [0, 0];
    }

    const [norm1X, norm1Y] = normalize(p2[0] - p0[0], p2[1] - p0[1]);
    const [norm2X, norm2Y] = normalize(p3[0] - p1[0], p3[1] - p1[1]);

    const tension = 0.4;
    const spanLength = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
    const controlDistance = spanLength * tension;

    const cp1 = [p1[0] + norm1X * controlDistance, p1[1] + norm1Y * controlDistance];
    const cp2 = [p2[0] - norm2X * controlDistance, p2[1] - norm2Y * controlDistance];

    ctx.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], p2[0], p2[1]);
}

function drawSegment(ctx, cnn) {
    const segment = segments[cnn];
    if (!segment) return;

    const points = segment.screen;
    if (points.length < 2) return;

    ctx.moveTo(points[0][0], points[0][1]);

    // Draw the first span as a straight line.
    ctx.lineTo(points[1][0], points[1][1]);

    if (points.length < 5) {
        for (let i = 2; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
        }
        return;
    }

    // Draw middle spans using Bézier curves.
    for (let i = 1; i < points.length - 2; i++) {
        drawBezier(ctx, points, i);
    }

    // Draw the last span as a straight line.
    const end = points[points.length - 1];
    ctx.lineTo(end[0], end[1]);
}

function drawStreets(ctx) {
    //console.time('  drawStreets()');
    let streetCount = 0;

    // 1st pass: Draw regular two-way streets
    //console.time('    drawStreets(): 2-way');
    ctx.strokeStyle = getColor('streets');
    ctx.lineWidth = Math.min(1, 25 / zoom);
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
            return;
        }

        // Regular two-way street
        drawSegment(ctx, cnn);
    });

    ctx.stroke();
    //console.timeEnd('    drawStreets(): 2-way');

    if (!oneWaySegments.length) {
        //console.timeEnd('  drawStreets()');
        return streetCount;
    }

    // 2nd pass: Draw one-way streets in a different color
    //console.time('    drawStreets(): 1-way');
    ctx.strokeStyle = getColor('oneWays');
    ctx.lineWidth = Math.min(1, 25 / zoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    oneWaySegments.forEach(cnn => {
        drawSegment(ctx, cnn);
    });

    ctx.stroke();
    //console.timeEnd('    drawStreets(): 1-way');

    if (zoom < 2) {
        //console.timeEnd('  drawStreets()');
        return streetCount;
    }

    // Draw arrows on one-way streets (only when zoomed in enough)
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

        // Find the longest span in the segment
        let longestSpanLength = 0;
        let longestSpanIndex = 0;

        for (let i = 0; i < screen.length - 1; i++) {
            const [x1, y1] = screen[i];
            const [x2, y2] = screen[i + 1];
            const spanLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

            if (spanLength > longestSpanLength) {
                longestSpanLength = spanLength;
                longestSpanIndex = i;
            }
        }

        // Draw arrow on the longest span
        const [x1, y1] = screen[longestSpanIndex];
        const [x2, y2] = screen[longestSpanIndex + 1];
        drawArrow(ctx, x1, y1, x2, y2, getColor('arrows'));
    });
    //console.timeEnd('    drawStreets(): 1-way arrows');

    //console.timeEnd('  drawStreets()');
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
    //console.time('  drawJunctions()');
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
    //console.timeEnd('  drawJunctions()');
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

function drawSelectedJunction(ctx, x, y, color) {
    if (invisible(x, y)) return;
    const radius = Math.min(5, 25 / zoom);
    drawJunction(ctx, x, y, radius, color);
    drawJunctionOutline(ctx, x, y, radius, getColor('text'));
}

function drawJunctionStart(ctx) {
    // 5th pass: Draw starting point
    if (!start || !junctions[start]) return;
    const [x, y] = junctions[start].screen;
    drawSelectedJunction(ctx, x, y, getColor('start'));
}

function drawJunctionEnd(ctx) {
    // 6th pass: Draw end point
    if (!end || !junctions[end]) return;
    const [x, y] = junctions[end].screen;
    drawSelectedJunction(ctx, x, y, getColor('end'));
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

function renderLayer(key, draw) {
    if (!dirty[key] || !canvases[key] || !contexts[key]) return;

    //console.time(`renderLayer(${key}, ...)`);
    const canvas = canvases[key];
    const ctx = contexts[key];

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    applyCanvasTransform(ctx);

    // Draw canvas layer
    draw(ctx);

    resetCanvasTransform(ctx);

    // Force canvas flush with getImageData
    if (key === 'bg') {
        ctx.getImageData(0, 0, 1, 1);
    }

    dirty[key] = false;
    //console.timeEnd(`renderLayer(${key}, ...)`);
}

function renderBackgroundLayer() {
    if (!dirty.bg) return;
    console.time('renderBackgroundLayer()');
    const canvas = canvases.bg;
    renderLayer('bg', (ctx) => {
        // Background using theme color
        ctx.fillStyle = getColor('background');
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw static elements
        const streetCount = drawStreets(ctx);
        const junctionCount = drawJunctions(ctx);
        drawStreetNames(ctx);
        const schoolCount = drawSchools(ctx);
        const addressCount = drawAddresses(ctx);

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
    });
    console.timeEnd('renderBackgroundLayer()');
}

function renderPathfindingLayer() {
    renderLayer('pf', (ctx) => {
        // Draw pathfinding visualization
        drawPathSearch(ctx);
        drawPath(ctx);
    });
}

function renderUILayer() {
    renderLayer('ui', (ctx) => {
        // Draw UI elements
        drawJunctionStart(ctx);
        drawJunctionEnd(ctx);
        drawJunctionLabels(ctx);
    });
}

function drawMap() {
    if (!bounds) return;
    //console.time('drawMap()');

    // Render every layer (only if dirty)
    renderBackgroundLayer();
    renderPathfindingLayer();
    renderUILayer();

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

    for (let i = 0; i < path.length - 1; i++) {
        const cnn1 = path[i], cnn2 = path[i + 1];
        const cnn = segmentJunctions[cnn1][cnn2][0];
        drawSegment(ctx, cnn);
    }
    ctx.stroke();
}

// Apply canvas transform before drawing
function applyCanvasTransform(ctx) {
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-panX, -panY);
}

// Reset canvases transform after drawing
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

/**
 * For each street segment, create and populate the screen property, which is
 * an array of screen coordinates for each point on the street segment.
 *
 * @example
 * const segment = segments['4343000'];
 * // {
 * //     f: 20745,
 * //     t: 20767,
 * //     code: 5,
 * //     street: 'CONKLING ST',
 * //     line: [
 * //         [37.73473, -122.40181],
 * //         [37.73567, -122.4019],
 * //         [37.73592, -122.40235],
 * //         [37.73589, -122.40282]
 * //     ],
 * //     to: null, // This is not a one-way street.
 * //     distance: 0.120785034212399,
 * //     screen: [
 * //         [827.8443579550749, 710.5937175285718],
 * //         [827.3289493364407, 703.7795951443893],
 * //         [824.7519062432696, 701.9673285528427],
 * //         [822.060327901477, 702.1848005438447]
 * //     ]
 * // };
 */
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

    segment.distance = howFarSegment(cnn);
}

function preprocessSegments() {
    //console.time('preprocessSegments()');
    for (const cnn in segments) {
        preprocessSegment(cnn);
    }
    //console.timeEnd('preprocessSegments()');
}

function resizeCanvases() {
    //console.time('resizeCanvases()');
    const canvas = canvases.bg;
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

    for (const key in canvases) {
        canvases[key].width = rect.width;
        canvases[key].height = rect.height;
    }

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

    // Step 4: Update screen coordinates when bounds change (not on every pan/zoom).
    //console.time('Postprocess data (update screen coordinates)');
    postprocessAddresses();
    postprocessJunctions();
    postprocessSchools();
    postprocessSegments();
    //console.timeEnd('Postprocess data (update screen coordinates)');

    // Step 5: Adjust pan to keep the same geographic center point centered
    if (bounds && centerLat !== undefined && centerLon !== undefined) {
        const [newCenterX, newCenterY] = coordsToScreen(centerLat, centerLon);
        const newCenterScreenX = canvas.width / 2;
        const newCenterScreenY = canvas.height / 2;

        panX = newCenterX - newCenterScreenX / zoom;
        panY = newCenterY - newCenterScreenY / zoom;
    }

    markAllLayersDirty();
    //console.timeEnd('resizeCanvases()');
}

function loadMap() {
    console.time('loadMap()');
    const contextOptions = { willReadFrequently: true };
    for (const key in canvases) {
        const id = `${key}Canvas`;
        canvases[key] = document.getElementById(id);
        if (!canvases[key]) {
            info('Oh no! Can\'t draw the map, sorry.');
            log("Cannot find canvas: " + id);
            return;
        }
        contexts[key] = canvases[key].getContext('2d', contextOptions);
        if (!contexts[key]) {
            info('Oh no! Can\'t draw the map, sorry.');
            log("Cannot get context for: " + id);
            return;
        }
    }

    //console.time('Preprocess data');
    preprocessAddresses();
    preprocessJunctions();
    preprocessSegments();
    //console.timeEnd('Preprocess data');

    // Must calculate map boundaries before calling resizeCanvases().
    bounds = calculateBounds();
    console.log(`Map bounds: lat ${bounds.minLat.toFixed(5)} - ${bounds.maxLat.toFixed(5)}, lon ${bounds.minLon.toFixed(5)} - ${bounds.maxLon.toFixed(5)}`);

    addEventListeners();

    // Resize canvases to fill container
    resizeCanvases();

    // Calculate proper initial pan values to center the map
    fitToView();

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
    const canvas = canvases.ui;

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
    const rect = canvases.ui.getBoundingClientRect();
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
    // Use canvases.ui for measurements since it's the interaction layer
    const rect = canvases.ui.getBoundingClientRect();
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

    const rect = canvases.ui.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    handleTouchTap(mouseX, mouseY);
}

function getTouchCoordinates(e) {
    const rect = canvases.ui.getBoundingClientRect();
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
    const rect = canvases.ui.getBoundingClientRect();
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
    const canvas = canvases.ui;
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
    const canvas = canvases.bg;
    if (!canvas || !bounds) return;

    // Calculate the center of the map data in base coordinates
    const mapCenterX = mapDisplayWidth / 2 + mapOffsetX;
    const mapCenterY = mapDisplayHeight / 2 + mapOffsetY;

    // Calculate where we want the center to appear (center of canvas)
    const viewportCenterX = canvas.width / 2;
    const viewportCenterY = canvas.height / 2;

    // Set pan so that map center appears at viewport center
    panX = mapCenterX - viewportCenterX / zoom;
    panY = mapCenterY - viewportCenterY / zoom;

    // Initial zoom that fits the map nicely in the viewport
    const scaleX = canvas.width / mapDisplayWidth;
    const scaleY = canvas.height / mapDisplayHeight;
    zoom = Math.min(scaleX, scaleY) * 0.99; // A little padding

    // Recalculate pan with the new zoom level
    panX = mapCenterX - viewportCenterX / zoom;
    panY = mapCenterY - viewportCenterY / zoom;

    markAllLayersDirty();
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

        const tentativeGScore = gScore[here] + howFar(junctions[here].ll, junctions[neighbor].ll);

        if (!openSet.has(neighbor)) {
            // First time visiting this neighbor
            openSet.add(neighbor);
            cameFrom[neighbor] = here;
            gScore[neighbor] = tentativeGScore;
            fScore[neighbor] = gScore[neighbor] + howFar(junctions[neighbor].ll, junctions[end].ll);
        } else if (tentativeGScore < (gScore[neighbor] || Infinity)) {
            // Found a better path to this neighbor
            cameFrom[neighbor] = here;
            gScore[neighbor] = tentativeGScore;
            fScore[neighbor] = gScore[neighbor] + howFar(junctions[neighbor].ll, junctions[end].ll);
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
    fScore[start] = howFar(junctions[start].ll, junctions[end].ll);

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
        `Path found! ${path.length} junctions, ${gScore[end].toFixed(1)} mi.` :
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
        canvases.bg.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('showPathfinding').addEventListener('change', (e) => {
        canvases.pf.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('showUI').addEventListener('change', (e) => {
        canvases.ui.style.display = e.target.checked ? 'block' : 'none';
    });

    loadMap();
});

window.addEventListener('resize', () => {
    resizeCanvases();
    requestRedraw();
});

function calculateVisibleLineLength(x1, y1, x2, y2, margin = 0) {
    // Get viewport bounds
    margin /= zoom;
    const canvas = canvases.bg;
    const rectLeft = panX - margin;
    const rectTop = panY - margin;
    const rectRight = panX + canvas.width / zoom + margin;
    const rectBottom = panY + canvas.height / zoom + margin;

    // Clip line segment to rectangle using Liang-Barsky algorithm
    let t0 = 0, t1 = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Helper function for Liang-Barsky clipping
    function clipTest(p, q) {
        if (p === 0) {
            return q >= 0;
        }
        const t = q / p;
        if (p < 0) {
            if (t > t1) return false;
            if (t > t0) t0 = t;
        } else {
            if (t < t0) return false;
            if (t < t1) t1 = t;
        }
        return true;
    }

    // Test against each edge of the rectangle
    if (!clipTest(-dx, x1 - rectLeft)) return 0;  // Left edge
    if (!clipTest(dx, rectRight - x1)) return 0;   // Right edge
    if (!clipTest(-dy, y1 - rectTop)) return 0;    // Top edge
    if (!clipTest(dy, rectBottom - y1)) return 0;  // Bottom edge

    // Calculate the clipped segment length
    const clippedX1 = x1 + t0 * dx;
    const clippedY1 = y1 + t0 * dy;
    const clippedX2 = x1 + t1 * dx;
    const clippedY2 = y1 + t1 * dy;

    const clippedLength = Math.sqrt(
        Math.pow(clippedX2 - clippedX1, 2) +
        Math.pow(clippedY2 - clippedY1, 2)
    );

    return clippedLength;
}

function calculateSegmentVisibleLength(cnn) {
    const segment = segments[cnn];
    if (!segment || segment.screen.length < 2) return 0;

    let totalVisibleLength = 0;
    const points = segment.screen;

    // Sum up visible length of each line segment within the street segment
    for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        totalVisibleLength += calculateVisibleLineLength(x1, y1, x2, y2);
    }

    return totalVisibleLength;
}

function drawMultipleLabelsOnSegment(ctx, street, cnn) {
    const segment = segments[cnn];
    if (!segment || segment.screen.length < 2) return;

    const textWidth = ctx.measureText(street).width;
    const labelSpacing = Math.max(textWidth * 2, 150 / zoom); // Minimum spacing between labels
    const visibleLength = calculateSegmentVisibleLength(cnn);

    // Calculate how many labels we can fit
    const numLabels = Math.floor(visibleLength / labelSpacing);
    if (numLabels <= 1) {
        // Fall back to single label
        drawStreetNameOnSegment(ctx, street, cnn);
        return;
    }

    // Find all visible segments of the street
    const points = segment.screen;
    const visibleSegments = [];

    for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        const segmentLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const visibleLength = calculateVisibleLineLength(x1, y1, x2, y2);

        if (visibleLength > 0) {
            visibleSegments.push({
                index: i,
                x1, y1, x2, y2,
                totalLength: segmentLength,
                visibleLength: visibleLength,
                startVisible: calculateVisibleLineLength(x1, y1, x1, y1) > 0,
                endVisible: calculateVisibleLineLength(x2, y2, x2, y2) > 0
            });
        }
    }

    if (visibleSegments.length === 0) return;

    // Calculate total visible length and place labels at intervals
    let totalVisibleLength = visibleSegments.reduce((sum, seg) => sum + seg.visibleLength, 0);
    let labelInterval = totalVisibleLength / numLabels;

    let currentDistance = labelInterval / 2; // Start offset from beginning

    for (let labelIndex = 0; labelIndex < numLabels; labelIndex++) {
        let accumulatedDistance = 0;

        // Find which segment contains this label position
        for (const visibleSeg of visibleSegments) {
            if (accumulatedDistance + visibleSeg.visibleLength >= currentDistance) {
                // This segment contains our label position
                const segmentOffset = currentDistance - accumulatedDistance;
                const ratio = segmentOffset / visibleSeg.visibleLength;

                // Interpolate position along the segment
                const labelX = visibleSeg.x1 + ratio * (visibleSeg.x2 - visibleSeg.x1);
                const labelY = visibleSeg.y1 + ratio * (visibleSeg.y2 - visibleSeg.y1);

                // Calculate angle for text rotation
                const angle = Math.atan2(visibleSeg.y2 - visibleSeg.y1, visibleSeg.x2 - visibleSeg.x1);
                let displayAngle = angle;
                if (Math.abs(angle) > Math.PI / 2) {
                    displayAngle = angle + Math.PI;
                }

                // Draw the label
                ctx.save();
                ctx.translate(labelX, labelY);
                ctx.rotate(displayAngle);

                const formattedStreet = formatStreet(street);
                ctx.strokeText(formattedStreet, 0, 0);
                ctx.fillText(formattedStreet, 0, 0);

                ctx.restore();
                break;
            }
            accumulatedDistance += visibleSeg.visibleLength;
        }

        currentDistance += labelInterval;
    }
}
