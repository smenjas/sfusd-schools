/**
 * Unit tests for string functions
 * @module test/string
 */

import { capitalize,
         capitalizeWords,
         compressWhitespace,
         encode,
         encodeURLParam,
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

    static encode() {
        const tests = [
            [['Tom & Jerry'], 'Tom &amp; Jerry'],
            [['">Gotcha!'], '&quot;&gt;Gotcha!'],
        ];
        return Test.run(encode, tests);
    }

    static encodeURLParam() {
        const tests = [
            [['&q=gotcha'], '%26q%3Dgotcha'],
            [['123 Fake St, 12345'], '123+Fake+St%2C+12345'],
            [['123 Fake St, 12345', false], '123+Fake+St%2C+12345'],
            [['123 Fake St, 12345', true], '123+Fake+St,+12345'],
        ];
        return Test.run(encodeURLParam, tests);
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
