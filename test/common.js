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
        ];
        return Test.run(arrayToMap, tests);
    }

    static findSchool() {
        const tests = [
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
