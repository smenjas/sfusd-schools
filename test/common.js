/**
 * Unit tests for shared functions
 * @module tests/common
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
            {name: 'Lowell', types: ['High']},
        ];
        const tests = [
            [[schools, 'Lowell', 'High'], schools[0]],
        ];
        return Test.run(findSchool, tests);
    }

    static splitSchoolDescription() {
        const tests = [
            [['Havard Early Education'], ['Havard', 'Early Education']],
            [['Lowell High'], ['Lowell', 'High']],
        ];
        return Test.run(splitSchoolDescription, tests);
    }
}
