/**
 * @file Display, filter, and sort school data.
 */

import { findAddress, normalizeAddress } from './address.js';
import { arrayToMap,
         getDefaultInputs,
         getStoredItem,
         populateDistances,
         storeItem } from './common.js';
import { renderAddressInput,
         renderDirectionsLink,
         renderLink,
         renderList,
         renderMapLink,
         renderOptions } from './html.js';
import { howFar, isBikeable, isWalkable } from './geo.js';
import { findSchoolDistances } from './path.js';
import { sortSchools } from './sort.js';
import addressData from './address-data.js';
import schoolData from './school-data.js';
import jcts from './junctions.js';

/**
 * Append a percent sign to the input.
 *
 * @param {?number} percent - A percentage
 * @returns {string} The formatted percentage, or the empty string
 */
function renderPercent(percent) {
    return (percent === null) ? '' : percent + '%';
}

/**
 * Format male/female percentages as a ratio.
 *
 * @param {?number} male - The percent of a population that's male
 * @param {?number} female - The percent of a population that's female
 * @returns A ratio, or the empty string
 */
function renderGender(male, female) {
    if (male === null && female === null) {
        return '';
    }
    if (male === null) {
        male = 100 - female;
    }
    if (female === null) {
        female = 100 - male;
    }
    return `${male}:${female}`;
}

/**
 * Format a ratio of numbers.
 *
 * @param {?number} antecedent - A number, e.g. students per class
 * @param {?number} consequent - A number, e.g. teachers in a classroom
 * @returns {string} A ratio, or the empty string
 */
function renderRatio(antecedent, consequent = 1) {
    return (antecedent === null || consequent === null) ? ''
        : `${antecedent}:${consequent}`;
}

/**
 * Render a select menu.
 *
 * @param {Map} options - Menu option values and names
 * @param {?string} selected - The value selected.
 * @param {?string} [defaultName=null] - The name of the default option
 * @param {string} [defaultValue=''] - The value of the default option
 * @returns {string} An HTML select menu
 */
function renderMenu(options, selected, name, defaultName = null, defaultValue = '') {
    const disabled = options.size ? '' : ' disabled';
    let html = `<select name="${name}" id="${name}"${disabled}>`;
    if (defaultName !== null) {
        const defOpt = new Map();
        defOpt.set(defaultValue, defaultName);
        html += renderOptions(defOpt, selected);
    }
    html += renderOptions(options, selected);
    html += '</select>';
    return html;
}

/**
 * Copy filter inputs into a new object.
 *
 * @param {Object.<string, string>} menus - Select menu inputs
 * @returns {Object.<string, string>} An object containing only filter menu inputs
 */
function copyFilters(menus) {
    return {
        grade: menus.grade,
        language: menus.language,
        neighborhood: menus.neighborhood,
        start: menus.start,
        target: menus.target,
        type: menus.type,
        within: menus.within,
    };
}

/**
 * Format ordinal numbers, e.g. "1st".
 *
 * @param {number} - A number
 * @returns {string} - A number with an ordinal suffix
 */
function formatOrdinal(num) {
    const str = num.toString();
    switch (str.slice(-2)) {
        case '11':
        case '12':
        case '13':
            return str + 'th';
    }
    switch (str.slice(-1)) {
        case '1':
            return str + 'st';
        case '2':
            return str + 'nd';
        case '3':
            return str + 'rd';
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
        case '0':
            return str + 'th';
        default:
            return num;
    }
}

/**
 * Find the distance to the nearest school.
 *
 * @param {Schools} schools - Data about some schools
 * @returns {number} Distance in miles
 */
function getMinDistance(schools) {
    let minDistance = Infinity;
    for (const school of schools) {
        if (school.distance < minDistance) {
            minDistance = school.distance;
        }
    }
    return minDistance;
}

/**
 * Get all the grade levels in the given schools.
 *
 * @param {Schools} schools - Data about some schools
 * @returns {Map} Menu option values and names for grade levels
 */
function getSchoolGrades(schools, selected) {
    const grades = new Map();
    let min = Infinity;
    let max = -Infinity;
    for (const school of schools) {
        if (school.pk) grades.set('pk', true);
        if (school.tk) grades.set('tk', true);
        if (school.k) grades.set('k', true);
        if (school.min !== null && school.max !== null) {
            for (let n = school.min; n <= school.max; n++) {
                grades.set(n, true);
            }
        }
        if (school.min < min) min = school.min;
        if (school.max > max) max = school.max;
    }
    const options = new Map();
    if (selected === 'pk' || grades.get('pk')) options.set('pk', 'Pre-K');
    if (selected === 'tk' || grades.get('tk')) options.set('tk', 'TK');
    if (selected === 'k' || grades.get('k')) options.set('k', 'K');
    for (let n = min; n <= max; n++) {
        if (selected === n || grades.get(n)) {
            options.set(n, formatOrdinal(n) + ' Grade');
        }
    }
    return options;
}

/**
 * Render a select menu for school grade levels.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {Object.<string, string>} menus - Select menu input values
 * @returns {string} An HTML select menu
 */
function renderGradeMenu(schoolData, menus) {
    const schools = filterSchools(schoolData, menus, 'grade');
    const gradeOptions = getSchoolGrades(schools, menus.grade);
    return renderMenu(gradeOptions, menus.grade, 'grade', 'Any Grade');
}

/**
 * Get all the language programs in the given schools.
 *
 * @param {Schools} schools - Data about some schools
 * @returns {Map} Menu option values and names for language programs
 */
function getLanguages(schools, selected) {
    const languages = [];
    for (const school of schools) {
        const langs = school.languages;
        for (const lang of langs) {
            const language = lang.split(' ', 1)[0];
            if (!languages.includes(language)) {
                languages.push(language);
            }
        }
    }
    if (selected && !languages.includes(selected)) {
        languages.push(selected);
    }
    return arrayToMap(languages.sort());
}

/**
 * Render a select menu for school language programs.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {Object.<string, string>} menus - Select menu input values
 * @returns {string} An HTML select menu
 */
function renderLanguageMenu(schoolData, menus) {
    const schools = filterSchools(schoolData, menus, 'language');
    const languages = getLanguages(schools, menus.language);
    return renderMenu(languages, menus.language, 'language', 'Any Language');
}

/**
 * Get all the neighborhoods the given schools are in.
 *
 * @param {Schools} schools - Data about some schools
 * @returns {Map} Menu option values and names for neighborhoods
 */
function getNeighborhoods(schools, selected) {
    const neighborhoods = [];
    for (const school of schools) {
        const hood = school.neighborhood;
        if (!neighborhoods.includes(hood)) {
            neighborhoods.push(hood);
        }
    }
    if (selected && !neighborhoods.includes(selected)) {
        neighborhoods.push(selected);
    }
    return arrayToMap(neighborhoods.sort());
}

/**
 * Render a select menu for neighborhoods.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {Object.<string, string>} menus - Select menu input values
 * @returns {string} An HTML select menu
 */
function renderNeighborhoodMenu(schoolData, menus) {
    const schools = filterSchools(schoolData, menus, 'neighborhood');
    const neighborhoods = getNeighborhoods(schools, menus.neighborhood);
    return renderMenu(neighborhoods, menus.neighborhood, 'neighborhood', 'Any Neighborhood');
}

/**
 * Get all the school types to choose from, e.g. Elementary.
 *
 * @param {Schools} schools - Data about some schools
 * @returns {Map} Menu option values and names for school types
 */
function getSchoolTypes(schools, selected) {
    const allTypes = [
        'Early Education',
        'Elementary',
        'K-8',
        'Middle',
        'High',
    ];
    const types = [];
    outer: for (const school of schools) {
        inner: for (const type of school.types) {
            if (types.includes(type)) {
                continue;
            }
            types.push(type);
            if (types.length >= allTypes.length) {
                break outer;
            }
        }
    }
    const orderedTypes = new Map();
    for (const type of allTypes) {
        if (selected === type || types.includes(type)) {
            orderedTypes.set(type, `${type} School`);
        }
    }
    return orderedTypes;
}

/**
 * Render a select menu for school types, e.g. Elementary.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {Object.<string, string>} menus - Select menu input values
 * @returns {string} An HTML select menu
 */
function renderTypeMenu(schoolData, menus) {
    const schools = filterSchools(schoolData, menus, 'type');
    const types = getSchoolTypes(schools, menus.type);
    return renderMenu(types, menus.type, 'type', 'Any Type');
}

/**
 * Get school start times to choose from.
 *
 * @param {Schools} schools - Data about some schools
 * @returns {Map} Menu option values and names for start times
 */
function getStartTimes(schools, selected) {
    const startTimes = new Map([
        [7, 'Before 8:00 am'],
        [8, '8:00-8:59 am'],
        [9, 'After 9:00 am'],
    ]);
    const hours = [];
    for (const school of schools) {
        if (!school.start) {
            console.log(school.name, school.types[0], 'does not have a start time.');
            continue;
        }
        const hour = parseInt(school.start.split(':')[0]);
        if (hours.includes(hour)) {
            continue;
        }
        hours.push(hour);
        if (hours.length >= startTimes.size) {
            break;
        }
    }
    for (const hour of startTimes.keys()) {
        if (selected !== hour && !hours.includes(hour)) {
            startTimes.delete(hour);
        }
    }
    return startTimes;
}

/**
 * Render a select menu for school start times.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {Object.<string, string>} menus - Select menu input values
 * @returns {string} An HTML select menu
 */
function renderStartTimeMenu(schoolData, menus) {
    const schools = filterSchools(schoolData, menus, 'start');
    const starts = getStartTimes(schools, menus.start);
    return renderMenu(starts, menus.start, 'start', 'Any Start Time');
}

/**
 * Get which schools each school feeds into.
 *
 * @param {Schools} schools - Data about some schools
 * @returns {Map} Menu option values and names for target schools
 */
function getTargets(schools, selected) {
    const targets = [];
    for (const school of schools) {
        for (const target of school.feedsInto) {
            if (!targets.includes(target)) {
                targets.push(target);
            }
        }
    }
    if (selected && !targets.includes(selected)) {
        targets.push(selected);
    }
    targets.sort();
    const targetsMap = new Map();
    for (const target of targets) {
        targetsMap.set(target, `Feeds Into ${target}`);
    }
    return targetsMap;
}

/**
 * Render a select menu for which school each school feeds into.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {Object.<string, string>} menus - Select menu input values
 * @returns {string} An HTML select menu
 */
function renderTargetMenu(schoolData, menus) {
    const schools = filterSchools(schoolData, menus, 'target');
    const targets = getTargets(schools, menus.target);
    return renderMenu(targets, menus.target, 'target', 'Feeds Into Any School');
}

/**
 * Get maximum school commute distances.
 *
 * @param {Schools} schools - Data about some schools
 * @returns {Map} Menu option values and names for commute distances
 */
function getDistances(schools, selected) {
    const distances = [];
    for (const school of schools) {
        if (isNaN(school.distance)) {
            continue;
        }
        const distance = Math.ceil(school.distance);
        if (distance > 0 && !distances.includes(distance)) {
            distances.push(distance);
        }
    }
    if (selected && !distances.includes(parseInt(selected))) {
        distances.push(selected);
    }
    distances.sort((a, b) => a - b);
    distances.pop();
    const distancesMap = new Map();
    for (const distance of distances) {
        const unit = (distance === 1) ? 'mile' : 'miles';
        distancesMap.set(distance, `Within ${distance} ${unit}`);
    }
    return distancesMap;
}

/**
 * Render a select menu for maximum school commute distances.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {Object.<string, string>} menus - Select menu input values
 * @returns {string} An HTML select menu
 */
function renderDistanceMenu(schoolData, menus) {
    const schools = filterSchools(schoolData, menus, 'within');
    const distances = getDistances(schools, menus.within);
    return renderMenu(distances, menus.within, 'within', 'Within Any Distance');
}

/**
 * Filter which fields to sort by.
 *
 * @param {Map} sorts - Fields to sort by
 * @param {Object.<string, boolean>} shown - Which fields are shown
 * @returns {Map} Fields to sort by, restricted to those shown
 */
function filterSortables(sorts, shown) {
    const fields = new Map();
    for (const [key, value] of sorts) {
        if (!(key in shown) || shown[key]) {
            fields.set(key, value);
        }
    }
    return fields;
}

/**
 * Get the fields to sort schools by.
 *
 * @param {Object.<string, boolean>} shown - Which fields are shown
 * @returns {Map} Fields to sort by, restricted to those shown
 */
function getSortables(shown) {
    const fields = new Map([
        ['name', 'Name'],
        ['distance', 'Distance'],
        ['neighborhood', 'Neighborhood'],
        ['usnews', 'US News Ranking'],
        ['greatschools', 'GreatSchools Score'],
        ['students', 'School Size'],
        ['ratio', 'Student Teacher Ratio'],
        ['reading', 'Reading'],
        ['math', 'Math'],
        ['science', 'Science'],
        ['graduated', 'Graduated'],
        ['seatsPerApp', 'Seats/App'],
    ]);
    for (const [field, desc] of fields) {
        fields.set(field, `Sort by ${desc}`);
    }
    return filterSortables(fields, shown);
}

/**
 * Render a select menu for which criteria to sort schools by.
 *
 * @param {Object.<string, boolean>} shown - Which fields are shown
 * @param {string} sort - Which field to sort by
 * @returns {string} An HTML select menu
 */
function renderSortMenu(shown, sort) {
    const sorts = getSortables(shown);
    return renderMenu(sorts, sort, 'sort');
}

/**
 * Render an HTML form, for filtering and sorting school data.
 *
 * @param {Object.<string, boolean>} shown - Which fields are shown
 * @param {Schools} schoolData - Data about all schools
 * @param {Object} inputs - Form input values
 * @returns {string} An HTML form
 */
function renderForm(shown, schoolData, inputs) {
    let html = '<form id="schoolForm">';
    html += '<div class="form-group">';
    html += renderAddressInput();
    html += '</div>';
    html += '<div class="form-group">';
    html += renderSortMenu(shown, inputs.menus.sort);
    html += '</div>';
    html += '<div class="form-group">';
    html += renderGradeMenu(schoolData, inputs.menus);
    html += '</div>';
    html += '<div class="form-group">';
    html += renderTypeMenu(schoolData, inputs.menus);
    html += '</div>';
    html += '<div class="form-group">';
    html += renderStartTimeMenu(schoolData, inputs.menus);
    html += '</div>';
    html += '<div class="form-group">';
    html += renderNeighborhoodMenu(schoolData, inputs.menus);
    html += '</div>';
    html += '<div class="form-group">';
    html += renderLanguageMenu(schoolData, inputs.menus);
    html += '</div>';
    html += '<div class="form-group">';
    html += renderTargetMenu(schoolData, inputs.menus);
    html += '</div>';
    html += '<div class="form-group">';
    html += renderDistanceMenu(schoolData, inputs.menus);
    html += '</div>';
    html += '<div class="form-group">';
    html += '<button type="reset">Reset</button>';
    html += '</div>';
    html += '</form>';
    return html;
}

/**
 * Render the header for an HTML table showing school data.
 *
 * @param {Object.<string, boolean>} shown - Which fields are shown
 * @returns {string} An HTML table header
 */
function renderHeader(shown) {
    let html = '';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Name</th>';
    html += '<th>Grades</th>';
    html += '<th>Start Time</th>';
    if (shown.distance) {
        html += '<th>Distance</th>';
    }
    html += '<th>Neighborhood</th>';
    html += '<th>Address</th>';
    if (shown.usnews) {
        html += '<th title="Ranking: lower numbers are better">US News</th>';
    }
    if (shown.greatschools) {
        html += '<th title="Score: higher numbers are better">Great<wbr>Schools</th>';
    }
    html += '<th>Students</th>';
    if (shown.teachers) {
        html += '<th>Teachers</th>';
    }
    if (shown.ratio) {
        html += '<th title="Student:Teacher">Ratio</th>';
    }
    if (shown.reading) {
        html += '<th>Reading</th>';
    }
    if (shown.math) {
        html += '<th>Math</th>';
    }
    if (shown.science) {
        html += '<th>Science</th>';
    }
    if (shown.graduated) {
        html += '<th>Graduated</th>';
    }
    //html += '<th>Minority</th>';
    //html += '<th>Low Income</th>';
    //html += '<th title="Male/Female">M/F</th>';
    html += '<th title="Chance of Acceptance">Seats/App</th>';
    html += '<th>Languages</th>';
    if (shown.feedsInto) {
        html += '<th>Feeds Into</th>';
    }
    html += '</tr>';
    html += '</thead>';
    return html;
}

/**
 * Get a school's minimum grade level.
 *
 * @param {School} school - Data about a school
 * @returns {(string|?number)} The school's minimum grade level
 */
function getMinGrade(school) {
    return school.pk ? 'PK' :
        school.tk ? 'TK' :
        school.k ? 'K' :
        school.min;
}

/**
 * Get a school's maximum grade level.
 *
 * @param {School} school - Data about a school
 * @returns {(string|?number)} The school's maximum grade level
 */
function getMaxGrade(school) {
    return school.max ? school.max :
        school.k ? 'K' :
        school.tk ? 'TK' :
        school.pk ? 'PK' :
        null;
}

/**
 * Render a school's grade range, e.g. TK-5.
 *
 * @param {School} school - Data about a school
 * @returns {(string|number)} A grade range
 */
function renderGradeRange(school) {
    const min = getMinGrade(school);
    const max = getMaxGrade(school);
    if (min !== null && max !== null && min !== max) {
        return `${min}-${max}`;
    }
    if (min !== null) {
        return min;
    }
    if (max !== null) {
        return max;
    }
    return '';
}

/**
 * Format a distance in miles.
 *
 * @param {?number} distance - Distance in miles
 * @returns {string} A distance in miles, or the empty string
 */
function renderDistance(origin, destination, distance) {
    if (distance === null || distance === undefined) {
        return '';
    }
    const linkText = distance.toFixed(1) + '&nbsp;mi.';
    let html = renderDirectionsLink(origin, destination, linkText);
    if (isWalkable(distance)) {
        html = '<span title="Walkable">&#x1F6B6;&nbsp;' + html + '</span>';
    }
    else if (isBikeable(distance)) {
        html = '<span title="Bikeable">&#x1F6B2;&nbsp;' + html + '</span>';
    }
    return html;
}

/**
 * Format a school's GreatSchools score, e.g. "5/10".
 *
 * @param {School} school - Data about a school
 * @returns {string} A GreatSchools score as a hyperlink, or the empty string
 */
function renderGreatSchoolsScore(school) {
    if (school.greatschools === null) {
        return '';
    }
    const text = `${school.greatschools}/10`;
    return renderLink(school.urls.greatschools, text, true);
}

/**
 * Format a school's US News rank, e.g. "5th".
 *
 * @param {School} school - Data about a school
 * @returns {string} A US News rank as a hyperlink, or the empty string
 */
function renderUSNewsRank(school) {
    if (school.usnews === null) {
        return '';
    }
    const text = formatOrdinal(school.usnews);
    return renderLink(school.urls.usnews, text, true);
}

/**
 * Format a school's name.
 *
 * @param {School} school - Data about a school
 * @returns {string} A school's name as a hyperlink, or the empty string
 */
function renderSchoolName(school) {
    let name = getSchoolName(school).replace(/\bSan Francisco\b/g,
        '<abbr title="San Francisco">SF</abbr>');
    if (school.charter) {
        name += ' (Charter)';
    }
    return renderLink(school.urls.main, name, true);
}

/**
 * Render one school's data as a table row.
 *
 * @param {Object.<string, boolean>} shown - Which fields are shown
 * @param {Schools} schools - Data about some schools
 * @param {string} address - A street address
 * @returns {string} An HTML table row
 */
function renderRow(shown, school, address) {
    const fullName = getSchoolFullName(school);
    const city = 'San Francisco, CA';
    const origin = `${address}, ${city}, USA`;
    const search = `${fullName}, ${school.address}, ${city} ${school.zip}`;
    const directionsLink = renderDistance(origin, search, school.distance);
    const mapLink = renderMapLink(search, school.address);
    let html = '';
    html += '<tr>';
    html += `<td>${renderSchoolName(school)}</td>`;
    html += `<td>${renderGradeRange(school)}</td>`;
    html += `<td class="num">${school.start}</td>`;
    if (shown.distance) {
        html += `<td class="num">${directionsLink}</td>`;
    }
    html += `<td>${school.neighborhood}</td>`;
    html += `<td>${mapLink}</td>`;
    if (shown.usnews) {
        html += `<td class="num">${renderUSNewsRank(school)}</td>`;
    }
    if (shown.greatschools) {
        html += `<td class="num">${renderGreatSchoolsScore(school)}</td>`;
    }
    html += `<td class="num">${school.students ?? ''}</td>`;
    if (shown.teachers) {
        html += `<td class="num">${school.teachers ?? ''}</td>`;
    }
    if (shown.ratio) {
        html += `<td class="num">${renderRatio(school.ratio)}</td>`;
    }
    if (shown.reading) {
        html += `<td class="num">${renderPercent(school.reading)}</td>`;
    }
    if (shown.math) {
        html += `<td class="num">${renderPercent(school.math)}</td>`;
    }
    if (shown.science) {
        html += `<td class="num">${renderPercent(school.science)}</td>`;
    }
    if (shown.graduated) {
        html += `<td class="num">${renderPercent(school.graduated)}</td>`;
    }
    //html += `<td class="num">${renderPercent(school.minority)}</td>`;
    //html += `<td class="num">${renderPercent(school.lowIncome)}</td>`;
    //html += `<td class="num">${renderGender(school.male, school.female)}</td>`;
    html += `<td class="num">${renderPercent(school.seatsPerApp)}</td>`;
    html += `<td>${renderList(school.languages)}</td>`;
    if (shown.feedsInto) {
        html += `<td>${renderList(school.feedsInto)}</td>`;
    }
    html += '</tr>';
    return html;
}

/**
 * Render school data as an HTML table.
 *
 * @param {Object.<string, boolean>} shown - Which fields are shown
 * @param {Schools} schools - Data about some schools
 * @param {string} address - A street address
 * @param {?LatLon} coords - Degrees latitude and longitude
 * @returns {string} An HTML table
 */
function renderTable(shown, schools, address, coords) {
    const numSchools = Object.keys(schools).length;
    let caption = `${numSchools} Schools`;
    if (coords) {
        const minDistance = getMinDistance(schools);
        if (isWalkable(minDistance) || isBikeable(minDistance)) {
            caption += ' <span class="legend">&#x1F6B6 = walkable,';
            caption += ' &#x1F6B2; = bikeable in 20 minutes</span>';
        }
    }
    let html = '<table>';
    html += `<caption>${caption}</caption>`;
    if (numSchools < 1) {
        html += '</table>';
        return html;
    }
    html += renderHeader(shown);
    html += '<tbody>';
    for (const school of schools) {
        html += renderRow(shown, school, address);
    }
    html += '</tbody>';
    html += '</table>';
    return html;
}

/**
 * Determine whether to show this school, based on its type, e.g. Elementary.
 *
 * @param {School} school - Data about a school
 * @param {string} type - School type, e.g. Elementary
 * @returns {boolean} Whether to show this school
 */
function filterType(school, type) {
    return !type || school.types.includes(type);
}

/**
 * Determine whether to show this school, based on its grade levels, e.g. TK.
 *
 * @param {School} school - Data about a school
 * @param {string} grade - School grade level, e.g. TK
 * @returns {boolean} Whether to show this school
 */
function filterGrade(school, grade) {
    if (!grade) return true;
    if (grade === 'pk') return school.pk;
    if (grade === 'tk') return school.tk;
    if (grade === 'k') return school.k;
    const gradeNum = parseInt(grade);
    if (isNaN(gradeNum)) {
        return true;
    }
    if (school.min === null || school.max === null) {
        return false;
    }
    return gradeNum >= school.min && gradeNum <= school.max;
}

/**
 * Determine whether to show this school, based on its neighborhood.
 *
 * @param {School} school - Data about a school
 * @param {string} neighborhood - School neighborhood, e.g. Bayview
 * @returns {boolean} Whether to show this school
 */
function filterNeighborhood(school, neighborhood) {
    return !neighborhood || neighborhood === school.neighborhood;
}

/**
 * Determine whether to show this school, based on its start time.
 *
 * @param {School} school - Data about a school
 * @param {string} start - School start time hour, e.g. 8
 * @returns {boolean} Whether to show this school
 */
function filterStartTime(school, start) {
    if (!start) {
        return true;
    }
    const hour = school.start.split(':')[0];
    if (hour >= start && hour < parseInt(start) + 1) {
        return true;
    }
    return false;
}

/**
 * Determine whether to show this school, based on language programs.
 *
 * @param {School} school - Data about a school
 * @param {string} language - Language program, e.g. Spanish
 * @returns {boolean} Whether to show this school
 */
function filterLanguage(school, language) {
    // Has a language been chosen?
    if (!language) {
        return true;
    }
    // Do any of this school's languages match the chosen language exactly?
    if (school.languages.includes(language)) {
        return true;
    }
    // Do this school's languages contain the chosen language as a substring?
    // For example, the filter "Spanish" should match "Spanish Immersion".
    for (const lang of school.languages) {
        if (lang.includes(language)) {
            return true;
        }
    }
    // The chosen language does not match any of this school's languages.
    return false;
}

/**
 * Determine whether to show this school, based on which schools it feeds into.
 *
 * @param {School} school - Data about a school
 * @param {string} target - Target school, e.g. Everett
 * @returns {boolean} Whether to show this school
 */
function filterTarget(school, target) {
    if (!target) {
        return true;
    }
    if (school.feedsInto.includes(target)) {
        return true;
    }
    return false;
}

/**
 * Determine whether to show this school, based on commute distance.
 *
 * @param {School} school - Data about a school
 * @param {string} within - Maximum commute distance in miles
 * @returns {boolean} Whether to show this school
 */
function filterWithin(school, within) {
    if (!within) {
        return true;
    }
    if (school.distance <= within) {
        return true;
    }
    return false;
}

/**
 * Determine whether to show this school, based on multiple criteria.
 *
 * @param {School} school - Data about a school
 * @param {Object.<string, string>} filters - Filter menu input values
 * @returns {boolean} Whether to show this school
 */
function filterSchool(school, filters) {
    const functions = {
        type: filterType,
        grade: filterGrade,
        neighborhood: filterNeighborhood,
        start: filterStartTime,
        language: filterLanguage,
        target: filterTarget,
        within: filterWithin,
    };
    for (const filter in functions) {
        if (!(filter in filters)) {
            // No saved form inputs for this user.
            continue;
        }
        const func = functions[filter];
        if (!func(school, filters[filter])) {
            return false;
        }
    }
    return true;
}

/**
 * Determine whether to show each school, based on multiple criteria.
 *
 * @param {Schools} schoolData - Data about all schools
 * @param {Object.<string, string>} menus - Select menu input values
 * @param {?string} [menu=null] - Menu to exclude from filtering
 * @param {Array.<Object>} Data about some schools
 */
function filterSchools(schoolData, menus, menu = null) {
    const filters = copyFilters(menus);
    if (menu !== null) {
        filters[menu] = '';
    }
    const schools = [];
    for (const school of schoolData) {
        if (!filters || filterSchool(school, filters)) {
            schools.push(school);
        }
    }
    return schools;
}

/**
 * Get a school's name and type, e.g. Lowell High School.
 *
 * @param {School} school - Data about a school
 * @returns {string} The school's name and type
 */
function getSchoolFullName(school) {
    let name = `${getSchoolName(school, false)} ${school.types[0]} School`;
    if (school.campus) {
        name += ` - ${renderGradeRange(school)} ${school.campus} Campus`;
    }
    return name;
}

/**
 * Get a school's name, e.g. Lowell.
 *
 * @param {School} school - Data about a school
 * @returns {string} The school's name
 */
function getSchoolName(school, campus = true) {
    let name = `${school.prefix} ${school.name} ${school.suffix}`.trim();
    if (campus && school.campus) {
        name += ` - ${school.campus}`;
    }
    return name;
}

/**
 * Focus the cursor on an input element.
 *
 * @param {string} id - The input element's ID attribute
 */
function focusInput(id) {
    const input = document.getElementById(id);
    input.focus();
    const length = input.value.length;
    input.setSelectionRange(length, length);
}

/**
 * Save distances in localStorage.
 *
 * @param {Object.<string, Object>} distances - Distances to schools
 * @returns {boolean} Whether the operation proceeded without an exception
 */
function storeDistances(distances) {
    if (storeItem('distances', distances)) {
        return true;
    }
    // Delete least recently used origin addresses.
    const addresses = Object.keys(distances);
    addresses.sort((a, b) => distances[a].timestamp - distances[b].timestamp);
    for (const address of addresses) {
        delete distances[address];
        if (storeItem('distances', distances)) {
            return true;
        }
    }
    return false;
}

/**
 * Update the distance between each school and the user's location, taking into
 * account obstacles on the ground (as the wolf runs, not as the crow flies).
 * Please note: this can take a second to calculate, impacting user experience.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Schools} schoolData - Data about all schools
 * @param {Junctions} jcts - All SF intersections
 * @param {Object} inputs - Form input values
 * @param {?LatLon} coords - Degrees latitude and longitude
 */
function updateDistancesByPath(addressData, schoolData, jcts, inputs, coords) {
    const stored = populateDistances(schoolData, inputs.address);
    if (!stored) {
        const distances = {};
        const address = normalizeAddress(inputs.address);
        distances[address] = findSchoolDistances(addressData, schoolData, jcts, address);
        storeDistances(distances);
    }
    populateDistances(schoolData, inputs.address);
    renderPage(addressData, schoolData, jcts, inputs, coords);
    focusInput('address');
}

/**
 * Update the distance between each school and the user's location.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Schools} schoolData - Data about all schools
 * @param {Junctions} jcts - All SF intersections
 * @param {Object} inputs - Form input values
 * @param {?LatLon} coords - Degrees latitude and longitude
 * @returns {boolean} Whether the page rendered
 */
function updateDistances(addressData, schoolData, jcts, inputs, coords) {
    // First, update distances quickly, as the crow flies.
    for (const school of schoolData) {
        school.distance = howFar(coords, school.ll);
    }
    if (!coords) {
        inputs.menus.within = '';
        return false;
    }
    // Asynchronously update distances, as the wolf runs.
    setTimeout(updateDistancesByPath, 0, addressData, schoolData, jcts, inputs, coords);
    if (inputs.menus.sort === '' || inputs.menus.sort === 'name') {
        inputs.menus.sort = 'distance';
        storeItem('inputs', inputs);
    }
    renderPage(addressData, schoolData, jcts, inputs, coords);
    focusInput('address');
    return true;
}

/**
 * Find which columns ought to be shown, based on school data.
 *
 * @param {Schools} schools - Data about some schools
 * @returns {Object.<string, boolean>} Which fields to show
 */
function findShownColumns(schools) {
    const shown = {
        distance: false,
        usnews: false,
        greatschools: false,
        teachers: false,
        ratio: false,
        reading: false,
        math: false,
        science: false,
        graduated: false,
        feedsInto: false,
    };
    for (const field in shown) {
        for (const school of schools) {
            if (Array.isArray(school[field])) {
                if (school[field].length > 0) {
                    shown[field] = true;
                    break;
                }
                continue;
            }
            if (school[field] !== null) {
                shown[field] = true;
                break;
            }
        }
    }
    return shown;
}

/**
 * Add event listeners to process form inputs, and update the page.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Schools} schoolData - Data about all schools
 * @param {Junctions} jcts - All SF intersections
 * @param {Object} inputs - Form input values
 * @param {?LatLon} coords - Degrees latitude and longitude
 */
function addEventListeners(addressData, schoolData, jcts, inputs, coords) {
    // Remove existing event listeners.
    const oldAddress = document.querySelector('input[name=address]');
    oldAddress.replaceWith(oldAddress.cloneNode(true));
    const oldMenus = document.querySelectorAll('select');
    for (const menu of oldMenus) {
        menu.replaceWith(menu.cloneNode(true));
    }
    const oldReset = document.querySelector('[type=reset]');
    oldReset.replaceWith(oldReset.cloneNode(true));

    // Listen for address input.
    const addressInput = document.getElementById('address');
    addressInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            // Don't submit the form and reload the page.
            event.preventDefault();
        }
    });
    addressInput.addEventListener('input', event => {
        inputs.address = event.target.value;
        storeItem('inputs', inputs);
        coords = findAddress(addressData, inputs.address);
        updateDistances(addressData, schoolData, jcts, inputs, coords);
    });

    // Listen for select menus, to filter schools.
    const menus = document.querySelectorAll('select');
    for (const menu of menus) {
        menu.addEventListener('change', event => {
            const name = event.target.name;
            const value = event.target.value;
            inputs.menus[name] = value;
            storeItem('inputs', inputs);
            renderPage(addressData, schoolData, jcts, inputs, coords);
        });
    }

    // Listen for the reset button, to clear inputs.
    const reset = document.querySelector('[type=reset]');
    reset.addEventListener('click', event => {
        addressInput.value = '';
        if (inputs.menus.sort === 'distance') {
            inputs.menus.sort = 'name';
        }
        addressInput.dispatchEvent(new Event('input'));
        for (const menu of menus) {
            menu.value = '';
            menu.dispatchEvent(new Event('change'));
        }
    });
}

/**
 * Render a web page, showing a form and school data as a table.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Schools} schoolData - Data about all schools
 * @param {Junctions} jcts - All SF intersections
 * @param {Object} inputs - Form input values
 * @param {?LatLon} coords - Degrees latitude and longitude
 */
function renderPage(addressData, schoolData, jcts, inputs, coords) {
    const schools = filterSchools(schoolData, inputs.menus);
    sortSchools(schools, inputs.menus.sort);
    const shown = findShownColumns(schools);
    document.getElementById('input').innerHTML = renderForm(shown, schoolData, inputs);
    const distanceMenu = document.getElementById('within');
    if (!coords) {
        distanceMenu.setAttribute('title', 'Enter your address to filter by distance.');
    }
    else {
        distanceMenu.removeAttribute('title');
    }
    document.getElementById('schools').innerHTML = renderTable(shown, schools, inputs.address, coords);
    addEventListeners(addressData, schoolData, jcts, inputs, coords);
    document.getElementById('address').value = inputs.address;
}

// Retrieve saved form input, or populate default values.
const inputs = getStoredItem('inputs') || getDefaultInputs();

// Calculate commute distances, and render the page.
const coords = findAddress(addressData, inputs.address);
updateDistances(addressData, schoolData, jcts, inputs, coords)
    || renderPage(addressData, schoolData, jcts, inputs, coords);
