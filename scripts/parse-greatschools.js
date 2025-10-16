/**
 * @file Parse the HTML from: https://www.sfusd.edu/schools/directory/table
 */

import fs from 'fs';
import { JSDOM } from 'jsdom';
import { compareAddresses, normalizeAddress } from '../public/address.js';
import { removeAccents } from '../public/string.js';
import schoolData from '../public/school-data.js';

/**
 * Parse an HTML file into a Document Object Model (DOM).
 *
 * @param {string} filePath - A filesystem path to an HTML file
 * @returns {Object} A DOM object
 */
function parseHtmlFile(filePath) {
    try {
        const html = fs.readFileSync(filePath, 'utf8');
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        return doc;
    }
    catch (err) {
        console.error('Error parsing HTML file:', err.message);
        return null;
    }
}

function getMatchingFilenames(directory, pattern) {
    try {
        const filenames = fs.readdirSync(directory);
        return filenames.filter(filename => pattern.test(filename));
    }
    catch (error) {
        console.error(`Error reading ${directory}:`, error);
        return [];
    }
}

function getSchoolName(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    try {
        const doc = parseHtmlFile(filePath);
    }
    catch (err) {
        console.error('Error parsing HTML:', err.message);
    }
}

function getGreatSchoolsRating(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    try {
        const doc = parseHtmlFile(filePath);
        const h1 = doc.querySelector('h1');
        const name = h1.textContent.trim()
        const div = doc.querySelector('.circle-rating--xtra-large');
        if (!div) return;
        const rating = parseInt(div.textContent.trim().split('/').shift());
        return { name, rating };
    }
    catch (err) {
        console.error('Error parsing HTML:', err.message);
    }
}

function getGreatSchoolsRatings(directory, filenames) {
    const ratings = {};
    for (const filename of filenames) {
        const filePath = `${directory}/${filename}`;
        const data = getGreatSchoolsRating(filePath);
        if (!data) continue;
        const { name, rating } = data;
        ratings[name] = rating;
    }
    return ratings;
}

const directory = './cache/greatschools';
const filenames = getMatchingFilenames(directory, /^www_greatschools_org_california_san_francisco_/);
const ratings = getGreatSchoolsRatings(directory, filenames);
console.log(ratings);
