import Test from '../scripts/test.js';

/**
 * Test automated tests.
 */
export default class TestTest {
    /**
     * Test the compare method.
     *
     * @returns {integer} How many tests failed
     */
    static compare() {
        const tests = [
            [[null, null], true],
            [[null, undefined], false],
            [[null, false], false],
            [[null, 0], false],
            [[null, ''], false],
            [[undefined, undefined], true],
            [[undefined, false], false],
            [[undefined, 0], false],
            [[undefined, ''], false],
            [[true, true], true],
            [[false, false], true],
            [[true, false], false],
            [[NaN, NaN], true],
            [[NaN, undefined], false],
            [[NaN, null], false],
            [[NaN, false], false],
            [[NaN, 0], false],
            [[0, false], false],
            [[0, 0], true],
            [[0, 1], false],
            [[0.1, 0.1], true],
            [[0.1, 0.2], false],
            [[0n, 0n], true],
            [[0n, 1n], false],
            [['', ''], true],
            [['', 'x'], false],
            [['x', 'x'], true],
            [['x', 'X'], false],
            [[ [], [] ], true],
            [[ [], [1] ], false],
            [[ [1], [1] ], true],
            [[ {}, {} ], true],
            [[ {}, {a: 1} ], false],
            [[ {a: 1}, {a: 1} ], true],
            [[ {a: 1}, {b: 1} ], false],
            [[ {a: 1}, {a: 2} ], false],
            [[new Set(), new Set()], true],
            [[new Set([]), new Set([])], true],
            [[new Set([1]), new Set([1])], true],
        ];

        return Test.run(Test.compare, tests);
    }

    /**
     * Test the compareArrays method.
     *
     * @returns {integer} How many tests failed
     */
    static compareArrays() {
        const tests = [
            [[ 0, [] ], false],
            [[ [], 0 ], false],
            [[ [], [] ], true],
            [[ [1], [1] ], true],
            [[ [1], [2] ], false],
            [[ [1], [1, 2] ], false],
            [[ [2, 1], [1, 2] ], false],
            [[ [1, 1, 2], [1, 2, 2] ], false],
            [[ [[]], [[]] ], true],
            [[ [[1]], [[]] ], false],
            [[ [[1]], [[1]] ], true],
            [[ [[1]], [[2]] ], false],
            [[ [[1, 2]], [[1, 2]] ], true],
            [[ [[1, 2]], [[2, 1]] ], false],
            [[ [[1, 1]], [[1, 2]] ], false],
            [[ [{}], [{}] ], true],
            [[ [{}], [{a: 1}] ], false],
            [[ [{a: 1}], [{}] ], false],
            [[ [{a: 1}], [{a: 1}] ], true],
            [[ [{a: 1}], [{a: 2}] ], false],
            [[ [{a: 1}], [{b: 1}] ], false],
        ];

        return Test.run(Test.compareArrays, tests);
    }

    /**
     * Test the compareObjects method.
     *
     * @returns {integer} How many tests failed
     */
    static compareObjects() {
        const tests = [
            [[ 0, {} ], false],
            [[ {}, 0 ], false],
            [[ {}, {} ], true],
            [[ {}, {a: 1} ], false],
            [[ {a: 1}, {} ], false],
            [[ {a: 1}, {a: 1} ], true],
            [[ {a: 1}, {a: 1, b: 1} ], false],
            [[ {a: 1, b: 1}, {a: 1} ], false],
            [[ {a: 1}, {a: 2} ], false],
            [[ {a: 1}, {b: 1} ], false],
            [[ {a: []}, {a: []} ], true],
            [[ {a: []}, {b: []} ], false],
            [[ {a: [1]}, {a: [1]} ], true],
            [[ {a: [1]}, {a: [2]} ], false],
            [[ {a: {}}, {a: {}} ], true],
            [[ {a: {}}, {b: {}} ], false],
            [[ {a: {x: 1}}, {a: {x: 1}} ], true],
            [[ {a: {x: 1}}, {a: {x: 2}} ], false],
        ];

        return Test.run(Test.compareObjects, tests);
    }

    /**
     * Test the compareSets method.
     *
     * @returns {integer} How many tests failed
     */
    static compareSets() {
        const tests = [
            [[ 0, new Set()], false],
            [[ new Set(), 0], false],
            [[ new Set(), new Set()], true],
            [[ new Set([]), new Set([])], true],
            [[ new Set([1]), new Set([1])], true],
            [[ new Set([1]), new Set([2])], false],
            [[ new Set([1]), new Set([1, 2])], false],
        ];

        return Test.run(Test.compareSets, tests);
    }

    /**
     * Test the isObject method.
     *
     * @returns {integer} How many tests failed
     */
    static isObject() {
        const tests = [
            [[ null ], false],
            [[ undefined ], false],
            [[ false ], false],
            [[ true ], false],
            [[ NaN ], false],
            [[ 0 ], false],
            [[ 0.1 ], false],
            [[ 0n ], false],
            [[ '' ], false],
            [[ 'a' ], false],
            [[ [] ], false],
            [[ [1] ], false],
            [[ {} ], true],
            [[ {a: 1} ], true],
            [[ Symbol() ], false],
            [[ new Map() ], false],
            [[ new Set() ], false],
            [[ new WeakMap() ], false],
            [[ new WeakSet() ], false],
        ];

        return Test.run(Test.isObject, tests);
    }
}
