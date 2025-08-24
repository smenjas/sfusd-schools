/**
 * Unit tests for sorting functions
 * @module test/sort
 */

import { sortSchools } from '../public/sort.js';
import Test from '../scripts/test.js';

const schools = [
    {
        name: 'Revere',
        neighborhood: 'Bernal Heights',
        distance: 3.1,
        usnews: 53,
        greatschools: 2,
        students: 459,
        ratio: 15,
        math: 7,
        reading: 12,
        science: null,
        graduated: null,
        seatsPerApp: 27,
    },
    {
        name: 'Mission',
        neighborhood: 'Mission',
        distance: 1.8,
        usnews: 11,
        greatschools: 4,
        students: 1041,
        ratio: 19,
        math: 17,
        reading: 40,
        science: 9,
        graduated: 80,
        seatsPerApp: 40,
    },
];

const reversed = [schools[1], schools[0]];

export default class SortTest {
    static sortSchools() {
        const copy = Array.from(schools);
        const tests = [
            [[copy], reversed],
            [[copy, ''], reversed],
            [[copy, 'name'], reversed],
            [[copy, 'distance'], reversed],
            [[copy, 'neighborhood'], schools],
            [[copy, 'usnews'], reversed],
            [[copy, 'greatschools'], reversed],
            [[copy, 'students'], schools],
            [[copy, 'ratio'], schools],
            [[copy, 'reading'], reversed],
            [[copy, 'math'], reversed],
            [[copy, 'science'], reversed],
            [[copy, 'graduated'], reversed],
            [[copy, 'seatsPerApp'], schools],
        ];
        return Test.run(sortSchools, tests);
    }
}
