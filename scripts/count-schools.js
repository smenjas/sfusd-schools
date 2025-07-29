//import schoolData from '../public/school-data.js';
import schoolData from './school-data.js';

function logCount(count, singular, plural = null) {
    if (plural === null) {
        plural = singular + 's';
    }
    console.log(count, (count === 1) ? singular : plural);
}

logCount(schoolData.length, 'school', 'schools');

let count = 0;
for (const school of schoolData) {
    console.log(school.name, school.types[0]);
    if (++count > 10) {
        console.log('...');
        break;
    }
}
