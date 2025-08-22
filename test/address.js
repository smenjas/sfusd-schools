/**
 * Unit tests for address functions
 * @module tests/address
 */

import { compareAddresses,
         fixNumberedStreets,
         normalizeAddress,
         replaceStreetSuffixes,
         splitStreetAddress } from '../public/address.js';
import Test from '../scripts/test.js';
import addressData from '../public/address-data.js';

export default class AddressTest {
    static compareAddresses() {
        const tests = [
            [['123 fake street', '123 Fake St'], true],
            [['1 Main St', '2 Main St'], false],
        ];
        return Test.run(compareAddresses, tests);
    }

    static fixNumberedStreets() {
        const tests = [
            [['151 3RD ST'], '151 03RD ST'],
            [['701 MISSION ST'], '701 MISSION ST'],
        ];
        return Test.run(fixNumberedStreets, tests);
    }

    static normalizeAddress() {
        const tests = [
            [[' 151  3rd street'], '151 03RD ST'],
            [['3125 César Chávez St'], '3125 CESAR CHAVEZ ST'],
        ];
        return Test.run(normalizeAddress, tests);
    }

    static replaceStreetSuffixes() {
        const tests = [
            [['151 3RD STREET'], '151 3RD ST'],
            [['3RD STREET', true], '3RD ST'],
            [['1220 AVENUE M'], '1220 AVENUE M'],
        ];
        return Test.run(replaceStreetSuffixes, tests);
    }

    static splitStreetAddress() {
        const tests = [
            [['151 3rd St'], ['151', '3rd St']],
            [['701 Mission St'], ['701', 'Mission St']],
        ];
        return Test.run(splitStreetAddress, tests);
    }
}
