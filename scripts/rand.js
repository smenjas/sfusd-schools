// Randomly choose a whole number, inclusively.
export function randInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Randomly choose an array index.
export function randIndex(array) {
    return randInt(0, array.length - 1);
}

// Randomly choose an array element.
export function randElement(array) {
    return array[randIndex(array)];
}
