/**
 * Unit tests for HTML functions
 * @module test/html
 */

import { renderAddressInput,
         renderDirectionsLink,
         renderLink,
         renderList,
         renderMapLink,
         renderOptions } from '../public/html.js';
import Test from '../scripts/test.js';

export default class HTMLTest {
    static renderAddressInput() {
        const addressInput = '<input name="address" id="address" list="addresses" placeholder="Your Address" autocomplete="street-address"><datalist id="addresses"></datalist>';
        const officeInput = '<input name="office" id="office" list="offices" placeholder="Your Address" autocomplete="street-address"><datalist id="offices"></datalist>';
        const tests = [
            [[], addressInput],
            [['office', 'offices'], officeInput],
        ];
        return Test.run(renderAddressInput, tests);
    }

    static renderDirectionsLink() {
        const prefix = 'https://www.google.com/maps/dir/';
        const url = `${prefix}3500+Great+Hwy,+94132/1220+Avenue+M,+94132`;
        const tests = [
            [['3500 Great Hwy, 94132', '1220 Avenue M, 94132', 'Go'], `<a target="_blank" href="${url}">Go</a>`],
        ];
        return Test.run(renderDirectionsLink, tests);
    }

    static renderLink() {
        const url = 'https://example.com';
        const tests = [
            [[], ''],
            [['', ''], ''],
            [[null, null], ''],
            [['', 'Click me'], 'Click me'],
            [[null, 'Click me'], 'Click me'],
            [[undefined, 'Click me'], 'Click me'],
            [[url, 'Click me'], '<a href="https://example.com">Click me</a>'],
            [[url, 'Click me', false], '<a href="https://example.com">Click me</a>'],
            [[url, 'Click me', true], '<a target="_blank" href="https://example.com">Click me</a>'],
        ];
        return Test.run(renderLink, tests);
    }

    static renderList() {
        const ol = '<ol><li>Item</li></ol>';
        const ul = '<ul><li>Item</li></ul>';
        const tests = [
            [[], ''],
            [[null], ''],
            [[0], ''],
            [[1], ''],
            [['Hello'], ''],
            [[[]], ''],
            [[['Item']], ul],
            [[['Item'], true], ol],
        ];
        return Test.run(renderList, tests);
    }

    static renderMapLink() {
        const prefix = 'https://www.google.com/maps/search/';
        const url = `${prefix}443+Burnett+Ave,+94131`;
        const tests = [
            [['443 Burnett Ave, 94131'], `<a target="_blank" href="${url}">443 Burnett Ave, 94131</a>`],
            [['443 Burnett Ave, 94131', 'Go'], `<a target="_blank" href="${url}">Go</a>`],
        ];
        return Test.run(renderMapLink, tests);
    }

    static renderOptions() {
        const map = new Map();
        map.set('', 'Any');
        const option = '<option value="">Any</option>';
        const tests = [
            [[], ''],
            [[map], option],
        ];
        return Test.run(renderOptions, tests);
    }
}
