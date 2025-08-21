/**
 * HTML utility functions
 * @module public/html
 */

import { getDirectionsURL, getMapURL } from './geo.js';

/**
 * Render a street address form input, with autocomplete.
 *
 * @param {string} name - The name for the address input
 * @param {string} datalist - The ID for the datalist
 * @returns {string} A text input for a street address
 */
export function renderAddressInput(name = 'address', datalist = 'addresses') {
    let html = `<input name="${name}" id="${name}" list="${datalist}"`;
    html += ' placeholder="Your Address" autocomplete="street-address">';
    html += `<datalist id="${datalist}"></datalist>`;
    return html;
}

/**
 * Generate a Google Maps hyperlink for directions, to open in a new tab.
 *
 * @param {string} fro - The search terms for the origin
 * @param {string} to - The search terms for the destination
 * @param {string} text - The link text or content, as HTML
 * @returns {string} A hyperlink, or the 3rd arg if the 1st or 2nd arg is empty
 */
export function renderDirectionsLink(fro, to, text) {
    const url = getDirectionsURL(fro, to);
    return renderLink(url, text, true);
}

/**
 * Render a hyperlink, perhaps opening in a new browser tab.
 *
 * @param {?string} url - An absolute or relative URL
 * @param {?string} text - The link text or content, as HTML
 * @param {boolean} [newTab=false] - Whether to open the link in a new tab
 * @returns {string} A hyperlink, or the 2nd arg if the 1st arg is empty
 */
export function renderLink(url, text, newTab = false) {
    if (text === undefined || text === null || text === '') {
        return '';
    }
    if (url === undefined || url === null || url === '') {
        return text;
    }
    let link = '<a';
    if (newTab) {
        link += ' target="_blank"';
    }
    link += ` href="${url}">${text}</a>`;
    return link;
}

/**
 * Generate HTML for a list.
 *
 * @param {Array} array - The list items
 * @param {boolean} ordered - Whether to make an ordered list
 * @returns {string} A list, as HTML
 */
export function renderList(array, ordered = false) {
    if (!array || !Array.isArray(array) || array.length === 0) {
        return '';
    }
    let html = ordered ? '<ol>' : '<ul>';
    for (const element of array) {
        html += `<li>${element}</li>`;
    }
    html += ordered ? '</ol>' : '</ul>';
    return html;
}

/**
 * Generate a Google Maps hyperlink, to open in a new tab.
 *
 * @param {string} search - The search terms for a place
 * @param {string} [text=''] - The link text or content, as HTML
 * @returns {string} A hyperlink, or the 2nd arg if the 1st arg is empty
 */
export function renderMapLink(search, text = '') {
    if (search === '') {
        return '';
    }
    const url = getMapURL(search);
    if (text === '') {
        text = search;
    }
    return renderLink(url, text, true);
}

/**
 * Render options for a select menu.
 *
 * @param {Map} options - Menu option values and names
 * @param {?string} selected - The value selected.
 * @returns {string} HTML options for a select menu or datalist
 */
export function renderOptions(options, selected) {
    if (!(options instanceof Map) || !options.size) {
        return '';
    }
    let html = '';
    for (const [key, value] of options.entries()) {
        const s = (key.toString() === selected) ? ' selected' : '';
        html += `<option value="${key}"${s}>${value}</option>`;
    }
    return html;
}
