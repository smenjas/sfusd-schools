/**
 * @file How long does it take to drive or bike in the City, on average?
 *
 * On average, people walk 3 MPH, bike 9 MPH, and drive 17 MPH. Ideally, the
 * commute would be 15 minutes or less. In 15 minutes, someone can walk 3/4 of
 * a mile, bike 2 miles, or drive 4 miles.
 */

import { mean, median } from './stat.js';
import commuteData from './commute-data.js';

/**
 * Calculate speed based on the time it takes to travel a distance.
 *
 * @param {number} miles - A distance in miles
 * @param {number} min - A time in minutes
 * @returns {number} A speed in miles per hour
 */
function calculateMph(miles, min) {
    return (miles / min) * 60;
}

let autoMin = Infinity;
let autoMax = -Infinity;
let bikeMin = Infinity;
let bikeMax = -Infinity;
const autoMphs = [];
const bikeMphs = [];
const addresses = [];

for (const school of commuteData) {
    const { distance, drive, bike } = school;

    const autoMph = calculateMph(distance, drive);
    autoMphs.push(autoMph);
    if (autoMph < autoMin) autoMin = autoMph;
    if (autoMph > autoMax) autoMax = autoMph;

    const bikeMph = calculateMph(distance, bike);
    bikeMphs.push(bikeMph);
    if (bikeMph < bikeMin) bikeMin = bikeMph;
    if (bikeMph > bikeMax) bikeMax = bikeMph;

    // Q: How far can you drive in 15 minutes?
    // A: About 4-6 miles, depending on the route
    if (drive === 15) {
        console.log({distance, drive});
    }

    // Q: How far can you bike in 15 minutes?
    // A: About 2 miles
    if (bike === 15) {
        console.log({distance, bike});
    }

    //console.log('drive:', autoMph.toFixed(1), 'bike:', bikeMph.toFixed(1));
}

const autoMedian = median(autoMphs);
const autoMean = mean(autoMphs);

const bikeMedian = median(bikeMphs);
const bikeMean = mean(bikeMphs);

const walkMin = 2;
const walkMean = 3;
const walkMax = 4;

const bikeThreshold = bikeMean / 4;
const walkThreshold = walkMean / 4;

console.log({autoMin, autoMedian, autoMean, autoMax,
             bikeMin, bikeMedian, bikeMean, bikeMax,
             walkMin, walkMean, walkMax});
console.log('A person can bike about', bikeThreshold.toFixed(2), 'mi. in 15 minutes.');
console.log('A person can walk about', walkThreshold.toFixed(2), 'mi. in 15 minutes.');
