/**
 * Unit tests for address functions
 * @module test/address
 */

import { abbrNumberedStreets,
         compareAddresses,
         findAddress,
         findAddressSuggestions,
         fixNumberedStreets,
         normalizeAddress,
         prettifyAddress,
         replaceStreetSuffixes,
         splitStreetAddress } from '../public/address.js';
import Test from '../scripts/test.js';
import addressData from '../public/address-data.js';

export default class AddressTest {
    static abbrNumberedStreets() {
        const tests = [
            [['01ST ST'], '1ST ST'],
            [['02ND RD'], '2ND RD'],
            [['03RD DR'], '3RD DR'],
            [['04TH AVE'], '4TH AVE'],
        ];
        return Test.run(abbrNumberedStreets, tests);
    }

    static compareAddresses() {
        const tests = [
            [['123 fake street', '123 Fake St'], true],
            [['1 Main St', '2 Main St'], false],
        ];
        return Test.run(compareAddresses, tests);
    }

    static findAddress() {
        const addrs = { 'MARINA GREEN DR': { 1:[8073, 4379] } };
        const tests = [
            [[addrs, '123 Fake St'], null],
            [[addrs, '1 Marina Green Dr'], ['37.8073', '-122.4379']],
        ];
        return Test.run(findAddress, tests);
    }

    static findAddressSuggestions() {
        const addrs = { 'MARINA GREEN DR': { 1:[8073, 4379] } };
        const tests = [
            [[addrs, '1', 'MARI', 'MARI'], ['1 MARINA GREEN DR']],
            [[addrs, '123 fake st'], []],
        ];
        return Test.run(findAddressSuggestions, tests);
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

    static prettifyAddress() {
        const tests = [
            [['151 03RD ST'], '151 3rd St'],
            [['701 MISSION ST'], '701 Mission St'],
        ];
        return Test.run(prettifyAddress, tests);
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
