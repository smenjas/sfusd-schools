/**
 * @file Find the projection from an address to a street segment.
 */

import { findAddressProjection } from '../public/projection.js';
import addressData from '../public/address-data.js';
import jcts from '../public/junctions.js';

const cnnA = 27187;
const cnnB = 27188;
const address = '100 John F Kennedy Dr';

const coords = findAddressProjection(addressData, jcts, cnnA, cnnB, address);
console.log(address, coords);
