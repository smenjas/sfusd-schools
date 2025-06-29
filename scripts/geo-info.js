import addressData from '../public/address-data.js';
import { expandCoords, getMapURL, lonToMilesFactor } from '../public/geo.js';

function getCoordsURL(coords) {
    if (!coords) {
        return '';
    }
    return getMapURL(expandCoords(coords).join(','));
}

let minLon = Infinity;
let minLonLat = null;
let east = '';

let maxLon = -Infinity;
let maxLonLat = null;
let west = '';

let minLat = Infinity;
let minLatLon = null;
let south = '';

let maxLat = -Infinity;
let maxLatLon = null;
let north = '';

for (const st in addressData) {
    for (const n in addressData[st]) {
        const lat = addressData[st][n][0].toString().padEnd(4, '0');
        const lon = addressData[st][n][1].toString().padEnd(4, '0');
        if (lat < minLat) {
            minLat = lat;
            minLatLon = lon;
            south = `${n} ${st}`;
            //console.log(`New min lat for ${south}`, getCoordsURL([lat, lon]));
        }
        if (lat > maxLat) {
            maxLat = lat;
            maxLatLon = lon;
            north = `${n} ${st}`;
            //console.log(`New max lat for ${north}`, getCoordsURL([lat, lon]));
        }
        if (lon < minLon) {
            minLon = lon;
            minLonLat = lat;
            east = `${n} ${st}`;
            //console.log(`New min lon for ${east}`, getCoordsURL([lat, lon]));
        }
        if (lon > maxLon) {
            maxLon = lon;
            maxLonLat = lat;
            west = `${n} ${st}`;
            //console.log(`New max lon for ${west}`, getCoordsURL([lat, lon]));
        }
    }
}

const maxFactor = lonToMilesFactor(`37.${maxLat}`);
console.log({maxLat, maxFactor});

const minFactor = lonToMilesFactor(`37.${minLat}`);
console.log({minLat, minFactor});

console.log('Northernmost address:', getCoordsURL([maxLat, maxLatLon]), north);
console.log('Southernmost address:', getCoordsURL([minLat, minLatLon]), south);
console.log('Easternmost address: ', getCoordsURL([minLonLat, minLon]), east);
console.log('Westernmost address: ', getCoordsURL([maxLonLat, maxLon]), west);

for (let lat = 0; lat <= 90; lat += 10) {
    console.log(lat, Math.round(lonToMilesFactor(lat) * 10) / 10);
}
