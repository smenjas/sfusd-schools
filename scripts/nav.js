/**
 * @file Navigate between places in San Francisco, California.
 */

import dotenv from 'dotenv';
import { metersToMiles } from '../public/geo.js';
import { getRouteData } from './gmaps.js';
import { findSchoolDistances } from '../public/path.js';
import addressData from '../public/address-data.js';
import schoolData from '../public/school-data.js';
import jcts from '../public/junctions.js';

dotenv.config({ path: '../.env', quiet: true });

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

console.log(start);
//const distances = findSchoolDistances(addressData, schoolData, jcts, start);

for (const school of schoolData) {
    const { m, s } = await getRouteData(start, school.address);
    const miles = metersToMiles(m);
    //const minutes = s / 60;
    //const mph = miles / (s / 3600);
    //console.log({ miles, s, minutes, mph });
    console.log(miles.toFixed(1), school.name, school.types[0]);
}
