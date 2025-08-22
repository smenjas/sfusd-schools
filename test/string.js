/**
 * Unit tests for string functions
 * @module tests/string
 */

import { capitalize,
         capitalizeWords,
         compressWhitespace,
         removeAccents,
         removePunctuation } from '../public/string.js';
import Test from '../scripts/test.js';

export default class CommonTest {
    static capitalize() {
        const tests = [
            [['call me Ishmael'], 'Call me Ishmael'],
        ];
        return Test.run(capitalize, tests);
    }

    static capitalizeWords() {
        const tests = [
            [['a tale of two cities'], 'A Tale of Two Cities'],
            [['A TALE OF TWO CITIES'], 'A TALE OF TWO CITIES'],
            [['A TALE OF TWO CITIES', true], 'A Tale of Two Cities'],
        ];
        return Test.run(capitalizeWords, tests);
    }

    static compressWhitespace() {
        const tests = [
            [[' I need  some   space. '], 'I need some space.'],
        ];
        return Test.run(compressWhitespace, tests);
    }

    static removeAccents() {
        const tests = [
            [['César Chávez'], 'Cesar Chavez'],
        ];
        return Test.run(removeAccents, tests);
    }

    static removePunctuation() {
        const tests = [
            [['O\'Farrell St'], 'OFarrell St'],
        ];
        return Test.run(removePunctuation, tests);
    }
}
