/**
 * Randomization functions
 * @module scripts/random
 */

/**
 * Randomly choose a whole number, inclusively.
 *
 * @param {number} min - The minimum number to choose
 * @param {number} max - The maximum number to choose
 * @returns {number} A random number within the range, inclusive
 */
export function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Randomly choose an array index.
 *
 * @param {Array} array - An array
 * @returns {number} A random array index
 */
export function randomIndex(array) {
    return randomInt(0, array.length - 1);
}

/**
 * Randomly choose an array element.
 *
 * @param {Array} array - An array
 * @returns {*} A random array element
 */
export function randomElement(array) {
    return array[randomIndex(array)];
}
