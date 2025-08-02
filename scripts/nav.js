/**
 * @file Navigate between places in San Francisco, California.
 */

import jcts from './sf-junctions.js';
import { findSchoolDistances } from './path.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';

//const start = '443 Burnett Ave'; // Rooftop Elementary, geographic center of SF
//const start = '999 Marine Dr'; // Fort Point
//const start = '1 Marina Green Dr'; // Marina Green
//const start = '900 Beach St'; // Maritime Museum
//const start = '1220 Avenue M'; // Treasure Island Wastewater Treatment Plant
//const start = '55 Innes Ct'; // Hillpoint Park
//const start = '520 Spear Ave'; // Hunters Point
//const start = '625 Gilman Ave'; // Candlestick Point
const start = '1700 Silver Ave'; // Silver Terrace Athletic Fields
//const start = '2995 Sloat Blvd'; // SF Zoo
//const start = '1096 Point Lobos Ave'; // Camera Obscura

const distances = findSchoolDistances(addressData, schoolData, jcts, start);
