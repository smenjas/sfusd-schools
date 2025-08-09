/**
 * @file How long does it take to drive or bike in the City, on average?
 *
 * On average, people walk 3 MPH, bike 8.6 MPH, and drive 17-30ish MPH.
 * Ideally, commutes are 15 minutes or less. In 15 minutes, someone can
 * walk 0.75 miles, bike 2.15 miles, or drive 2-8 miles.
 */

import { mean, median } from './stat.js';
import { metersToMiles } from '../public/geo.js';
import gmapsData from './gmaps-data.js';

/**
 * Calculate speed based on the time it takes to travel a distance.
 *
 * @param {number} miles - A distance in miles
 * @param {number} min - A time in minutes
 * @returns {number} A speed in miles per hour
 */
function calculateMph(miles, min) {
    if (!miles || !min) {
        return 0;
    }
    return (miles / min) * 60;
}

function formatNumber(number, digits = 0) {
    return parseFloat(number.toFixed(digits));
}

let autoMin = Infinity;
let autoMax = -Infinity;
let autoMin15 = Infinity;
let autoMax15 = -Infinity;
const autoMphs = [];
const bikeMphs = [];
const addresses = [];

for (const origin in gmapsData) {
    for (const destination in gmapsData[origin]) {
        const { m, s } = gmapsData[origin][destination];

        if (isNaN(m) && isNaN(s)) {
            console.log('Cannot calculate speed:', origin, 'to', destination, {m, s});
            continue;
        }

        const distance = metersToMiles(m);
        const drive = s / 60;
        const autoMph = calculateMph(distance, drive);
        autoMphs.push(autoMph);

        if (autoMph > 0 && autoMph < autoMin) autoMin = autoMph;
        if (autoMph < Infinity && autoMph > autoMax) autoMax = autoMph;

        // Q: How far can you drive in 15 minutes?
        // A: About 4-6 miles, depending on the route
        if (drive >= 15 && drive < 16) {
            if (distance < autoMin15) autoMin15 = distance;
            if (distance > autoMax15) autoMax15 = distance;
            //console.log({distance, drive});
        }

        //console.log('drive:', autoMph.toFixed(1));
    }
}

const autoMedian = median(autoMphs);
const autoMean = mean(autoMphs);

const bikeMin = 4;
const bikeMedian = 8.7;
const bikeMean = 8.6;
const bikeMax = 12.75;

const walkMin = 2;
const walkMean = 3;
const walkMax = 4;

const bikeThreshold = bikeMean / 4;
const walkThreshold = walkMean / 4;

console.log('Miles per hour:');
console.log({walkMin, walkMean, walkMax,
    bikeMin, bikeMedian, bikeMean, bikeMax,
    autoMin, autoMedian, autoMean, autoMax});
console.log('A person can walk about', formatNumber(walkThreshold, 2), 'mi. in 15 minutes.');
console.log('A person can bike about', formatNumber(bikeThreshold, 2), 'mi. in 15 minutes.');
console.log('Minimum distance driven in 15 min.:', formatNumber(autoMin15, 2), 'mi.');
console.log('Maximum distance driven in 15 min.:', formatNumber(autoMax15, 2), 'mi.');
