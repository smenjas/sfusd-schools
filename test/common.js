/**
 * Unit tests for shared functions
 * @module test/common
 */

import { arrayToMap,
         findSchool,
         splitSchoolDescription } from '../public/common.js';
import Test from '../scripts/test.js';

export default class CommonTest {
    static arrayToMap() {
        const tests = [
            [[], undefined],
            [[null], null],
            [[0], 0],
            [[1], 1],
            [[''], ''],
            [[[]], new Map()],
            [[['a']], new Map([['a', 'a']])],
        ];
        return Test.run(arrayToMap, tests);
    }

    static findSchool() {
        const schools = [
            {name: 'Lowell', campus: '', types: ['High']},
            {name: 'Rooftop', campus: 'Twin Peaks', types: ['Elementary']},
            {name: 'Rooftop', campus: 'Mayeda', types: ['Elementary']},
        ];
        const tests = [
            [[schools, 'Lowell', 'High'], schools[0]],
            [[schools, 'Rooftop', 'Elementary', 'Twin Peaks'], schools[1]],
            [[schools, 'Rooftop', 'Elementary', 'Mayeda'], schools[2]],
        ];
        return Test.run(findSchool, tests);
    }

    static splitSchoolDescription() {
        const tests = [
            [['Havard Early Education'], ['Havard', 'Early Education', '']],
            [['Lowell High'], ['Lowell', 'High', '']],
            [['Rooftop Elementary - Twin Peaks'], ['Rooftop', 'Elementary', 'Twin Peaks']],
        ];
        return Test.run(splitSchoolDescription, tests);
    }
}
