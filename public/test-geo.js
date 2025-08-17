/**
 * Unit tests for geographic utility functions
 * @module public/test-geo
 */

import { findAzimuth } from './geo.js';

export function test_findAzimuth() {
    const tests = [
        [[[0, 0], [1, 0]], 0],
        [[[0, 0], [0, 1]], 90],
        [[[0, 0], [-1, 0]], 180],
        [[[0, 0], [0, -1]], 270],
    ];
    let failures = 0;
    for (const test of tests) {
        const [args, expected] = test;
        const [a, b] = args;
        const actual = findAzimuth(a, b);
        const failed = expected !== actual;
        failures += failed;
        console.log(failed ? 'FAIL:' : 'pass:', a, b, expected, failed ? '!==' : '===', actual);
    }
    return failures;
}
