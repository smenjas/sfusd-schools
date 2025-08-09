/**
 * Calculate the mean of a dataset.
 *
 * @param {Array.<number>} array - A dataset
 * @returns {number} The mean value
 */
export function mean(array) {
    const sum = array.reduce((acc, val) => acc + val, 0);
    return sum / array.length;
}

/**
 * Calculate the median of a dataset.
 *
 * @param {Array.<number>} array - A dataset
 * @returns {number} The median value
 */
export function median(array) {
    const copy = Array.from(array);
    copy.sort((a, b) => a - b);
    const mid = Math.floor(copy.length / 2);
    if (copy.length % 2 !== 0) {
        return copy[mid];
    }
    return (copy[mid - 1] + copy[mid]) / 2;
}
