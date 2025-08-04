/**
 * @file Display, filter, and sort school data.
 */

import schoolData from './school-data.js';
import addressData from './address-data.js';
import { calculateDistance,
         expandCoords,
         getDirectionsURL,
         getMapURL } from './geo.js';

/**
 * Escape form input (except spaces) for safe output to HTML.
 *
 * @param {string} value - Unescaped user input
 * @returns {string} The input string with unsafe characters escaped
 */
function escapeFormInput(value) {
    return encodeURIComponent(value).replaceAll('%20', ' ');
}

/**
 * Render a hyperlink, perhaps opening in a new browser tab.
 *
 * @param {?string} url - An absolute or relative URL
 * @param {?string} text - The link text or content, as HTML
 * @param {boolean} [newTab=false] - Whether to open the link in a new tab
 * @returns {string} A hyperlink, or the 2nd arg if the 1st arg is empty
 */
function renderLink(url, text, newTab = false) {
    if (text === null || text === '') {
        return '';
    }
    if (url === null || url === '') {
        return text;
    }
    let link = '<a';
    if (newTab === true) {
        link += ' target="_blank"';
    }
    link += ` href="${url}">${text}</a>`;
    return link;
}

/**
 * Generate a Google Maps hyperlink for directions, to open in a new tab.
 *
 * @param {string} fro - The search terms for the origin
 * @param {string} to - The search terms for the destination
 * @param {string} text - The link text or content, as HTML
 * @returns {string} A hyperlink, or the 3rd arg if the 1st or 2nd arg is empty
 */
function renderDirectionsLink(fro, to, text) {
    const url = getDirectionsURL(fro, to);
    if (url === '') {
        return text;
    }
    return renderLink(url, text, true);
}

/**
 * Generate a Google Maps hyperlink, to open in a new tab.
 *
 * @param {string} search - The search terms for a place
 * @param {string} text - The link text or content, as HTML
 * @returns {string} A hyperlink, or the 2nd arg if the 1st arg is empty
 */
function renderMapLink(search, text) {
    if (search === '') {
        return '';
    }
    const url = getMapURL(search);
    return renderLink(url, text, true);
}

/**
 * Generate HTML for an unordered list.
 *
 * @param {Array} array - The list items
 * @returns {string} An unordered list, as HTML
 */
function renderList(array) {
    if (array.length === 0) {
        return '';
    }
    let html = '<ul>';
    for (const element of array) {
        html += `<li>${element}</li>`;
    }
    html += '</ul>';
    return html;
}

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
 * Convert an array to a map.
 *
 * @param {Array} array - An array
 * @returns A map object
 */
function arrayToMap(array) {
    if (!Array.isArray(array)) {
        return array;
    }
    const map = new Map();
    for (const value of array) {
        map.set(value, value);
    }
    return map;
}

/**
 * Render options for a select menu.
 *
 * @param {Map} options - Menu option values and names
 * @param {string} selected - The value selected.
 * @returns {string} HTML options for a select menu or datalist
 */
function renderOptions(options, selected) {
    let html = '';
    for (const [key, value] of options.entries()) {
        const s = (key.toString() === selected) ? ' selected' : '';
        html += `<option value="${key}"${s}>${value}</option>`;
    }
    return html;
}

/**
 * Render a select menu.
 *
 * @param {Map} options - Menu option values and names
 * @param {string} selected - The value selected.
 * @param {string} [defaultName=null] - The name of the default option
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
 * Get all the grade levels in the given schools.
 *
 * @param {Array.<School>} schools - Data about some schools
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
 * @param {Array.<School>} schoolData - Data about all schools
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
 * @param {Array.<School>} schools - Data about some schools
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
 * @param {Array.<School>} schoolData - Data about all schools
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
 * @param {Array.<School>} schools - Data about some schools
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
 * @param {Array.<School>} schoolData - Data about all schools
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
 * @param {Array.<School>} schools - Data about some schools
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
 * @param {Array.<School>} schoolData - Data about all schools
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
 * @param {Array.<School>} schools - Data about some schools
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
 * @param {Array.<School>} schoolData - Data about all schools
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
 * @param {Array.<School>} schools - Data about some schools
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
 * @param {Array.<School>} schoolData - Data about all schools
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
 * @param {Array.<School>} schools - Data about some schools
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
 * @param {Array.<School>} schoolData - Data about all schools
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
 * Render a street address form input, with autocomplete.
 *
 * @returns {string} A text input for a street address
 */
function renderAddressInput() {
    let html = '<input name="address" id="address" list="addresses"';
    html += ' placeholder="Your Address" autocomplete="street-address">';
    html += '<datalist id="addresses"></datalist>';
    return html;
}

/**
 * Render an HTML form, for filtering and sorting school data.
 *
 * @param {Object.<string, boolean>} shown - Which fields are shown
 * @param {Array.<School>} schoolData - Data about all schools
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
function renderDistance(distance) {
    if (distance === null || distance === undefined) {
        return '';
    }
    return distance.toFixed(1) + ' mi.';
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
    const name = getSchoolName(school).replace(/\bSan Francisco\b/g,
        '<abbr title="San Francisco">SF</abbr>');
    return renderLink(school.urls.main, name, true);
}

/**
 * Render one school's data as a table row.
 *
 * @param {Object.<string, boolean>} shown - Which fields are shown
 * @param {Array.<School>} schools - Data about some schools
 * @param {string} address - A street address
 * @returns {string} An HTML table row
 */
function renderRow(shown, school, address) {
    const fullName = getSchoolFullName(school);
    const city = 'San Francisco, CA';
    const origin = `${address}, ${city}, USA`;
    const search = `${fullName}, ${school.address}, ${city} ${school.zip}`;
    const distance = renderDistance(school.distance);
    const directionsLink = renderDirectionsLink(origin, search, distance);
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
 * @param {Array.<School>} schools - Data about some schools
 * @param {string} address - A street address
 * @returns {string} An HTML table
 */
function renderTable(shown, schools, address) {
    const numSchools = Object.keys(schools).length;
    let html = '<table>';
    html += `<caption>${numSchools} Schools</caption>`;
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
 * @param {Array.<School>} schoolData - Data about all schools
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
 * Sort schools, based on multiple criteria, in place.
 *
 * @param {Array.<School>} schools - Data about some schools
 * @param {string} sort - Which field to sort by
 */
function sortSchools(schools, sort) {
    let sortFunction;
    switch (sort) {
        case 'name':
            sortFunction = (a, b) => a.name.localeCompare(b.name);
            break;
        case 'distance':
            sortFunction = (a, b) => a.distance - b.distance;
            break;
        case 'neighborhood':
            sortFunction = (a, b) => a.neighborhood.localeCompare(b.neighborhood);
            break;
        case 'usnews':
            sortFunction = (a, b) => {
                if (a.usnews !== null && b.usnews === null) {
                    return -1;
                }
                if (a.usnews === null && b.usnews !== null) {
                    return 1;
                }
                if (a.usnews !== b.usnews) {
                    return a.usnews - b.usnews;
                }
                if (a.greatschools !== b.greatschools) {
                    return b.greatschools - a.greatschools;
                }
                return b.reading - a.reading;
            }
            break;
        case 'greatschools':
            sortFunction = (a, b) => {
                if (a.greatschools !== null && b.greatschools === null) {
                    return -1;
                }
                if (a.greatschools === null && b.greatschools !== null) {
                    return 1;
                }
                if (a.greatschools !== b.greatschools) {
                    return b.greatschools - a.greatschools;
                }
                if (a.usnews !== b.usnews) {
                    return a.usnews - b.usnews;
                }
                return b.reading - a.reading;
            }
            break;
        case 'students':
            sortFunction = (a, b) => {
                if (a.students !== b.students) {
                    return a.students - b.students;
                }
                return a.ratio - b.ratio;
            }
            break;
        case 'ratio':
            sortFunction = (a, b) => {
                if (a.ratio !== b.ratio) {
                    return a.ratio - b.ratio;
                }
                return a.students - b.students;
            }
            break;
        case 'reading':
            sortFunction = (a, b) => {
                if (a.reading !== b.reading) {
                    return b.reading - a.reading;
                }
                if (a.math !== b.math) {
                    return b.math - a.math;
                }
                if (b.science !== a.science) {
                    return b.science - a.science;
                }
                return b.graduated - a.graduated;
            }
            break;
        case 'math':
            sortFunction = (a, b) => {
                if (a.math !== b.math) {
                    return b.math - a.math;
                }
                if (a.reading !== b.reading) {
                    return b.reading - a.reading;
                }
                if (b.science !== a.science) {
                    return b.science - a.science;
                }
                return b.graduated - a.graduated;
            }
            break;
        case 'science':
            sortFunction = (a, b) => {
                if (a.science !== b.science) {
                    return b.science - a.science;
                }
                if (a.math !== b.math) {
                    return b.math - a.math;
                }
                if (a.reading !== b.reading) {
                    return b.reading - a.reading;
                }
                return b.graduated - a.graduated;
            }
            break;
        case 'graduated':
            sortFunction = (a, b) => {
                if (a.graduated !== b.graduated) {
                    return b.graduated - a.graduated;
                }
                if (a.reading !== b.reading) {
                    return b.reading - a.reading;
                }
                if (a.math !== b.math) {
                    return b.math - a.math;
                }
                return b.science - a.science;
            }
            break;
        case 'seatsPerApp':
            sortFunction = (a, b) => {
                if (a.seatsPerApp !== null && b.seatsPerApp === null) {
                    return -1;
                }
                if (a.seatsPerApp === null && b.seatsPerApp !== null) {
                    return 1;
                }
                if (a.seatsPerApp !== b.seatsPerApp) {
                    return a.seatsPerApp - b.seatsPerApp;
                }
                if (a.reading !== b.reading) {
                    return b.reading - a.reading;
                }
                return b.math - a.math;
            }
            break;
        default:
            return;
    }
    schools.sort(sortFunction);
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
 * Update the distance between each school and the user's location.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {Array.<School>} schoolData - Data about all schools
 * @param {Object.<string, string>} inputs - Form input values
 * @param {Array.<number>} coords - Degrees latitude and longitude
 * @returns {boolean} Whether the page rendered
 */
function updateDistances(addressData, schoolData, inputs, coords) {
    for (const school of schoolData) {
        school.distance = calculateDistance(coords, school.ll);
    }
    if (!coords) {
        inputs.menus.within = '';
        return false;
    }
    if (inputs.menus.sort === '' || inputs.menus.sort === 'name') {
        inputs.menus.sort = 'distance';
    }
    renderPage(addressData, schoolData, inputs, coords);
    document.getElementById('address').select();
    return true;
}

/**
 * Suggest addresses matching what the user has typed so far.
 *
 * @param {Array.<string>} addresses - Suggested street addresses
 */
function suggestAddresses(addresses) {
    const datalist = document.getElementById('addresses');
    if (!datalist) {
        return;
    }
    datalist.innerHTML = renderOptions(arrayToMap(addresses));
}

/**
 * Find addresses matching what the user has typed so far.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {string} num - A street number, e.g. 221
 * @param {string} punct - A street name, maybe with punctuation
 * @param {string} nopunct - A street name without punctuation
 * @returns {Array.<string>} Suggested street addresses
 */
function findAddressSuggestions(addressData, num, punct, nopunct) {
    const addresses = [];
    for (const st in addressData) {
        if (st.startsWith(nopunct) && num in addressData[st]) {
            addresses.push(`${num} ${st}`);
        }
    }
    if (punct === nopunct) {
        return addresses.sort();
    }
    const puncts = {
        'O\'FARRELL ST': 'OFARRELL ST',
        'O\'REILLY AVE': 'OREILLY AVE',
        'O\'SHAUGHNESSY BLVD': 'OSHAUGHNESSY BLVD',
    };
    for (const p in puncts) {
        const st = puncts[p];
        if (p.startsWith(punct) && num in addressData[st]) {
            addresses.push(`${num} ${p}`);
        }
    }
    return addresses.sort();
}

/**
 * Search for a street address in San Francisco, California.
 *
 * @param {StreetAddresses} addressData - All SF street addresses
 * @param {string} address - A street address, from form input
 * @returns {Array.<number>} Degrees latitude and longitude
 */
function findAddress(addressData, address) {
    const parts = address.split(' ');
    if (parts.length < 2) {
        suggestAddresses([]);
        return;
    }
    if (isNaN(parts[0])) {
        suggestAddresses([]);
        return;
    }
    const num = parts.shift();
    const punct = parts.join(' ').toUpperCase();
    const nopunct = punct.replace(/[^A-Z0-9\s]/g, '');
    if (!(nopunct in addressData)) {
        const addresses = findAddressSuggestions(addressData, num, punct, nopunct);
        if (addresses.length <= 10) {
            suggestAddresses(addresses);
        }
        return;
    }
    if (!(num in addressData[nopunct])) {
        return;
    }
    return expandCoords(addressData[nopunct][num]);
}

/**
 * Find which columns ought to be shown, based on school data.
 *
 * @param {Array.<School>} schools - Data about some schools
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
 * @param {Array.<School>} schoolData - Data about all schools
 * @param {Object.<string, string>} inputs - Form input values
 * @param {Array.<number>} coords - Degrees latitude and longitude
 */
function addEventListeners(addressData, schoolData, inputs, coords) {
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
        localStorage.setItem('inputs', JSON.stringify(inputs));
        coords = findAddress(addressData, inputs.address);
        updateDistances(addressData, schoolData, inputs, coords);
    });

    // Listen for select menus, to filter schools.
    const menus = document.querySelectorAll('select');
    for (const menu of menus) {
        menu.addEventListener('change', event => {
            const name = event.target.name;
            const value = event.target.value;
            inputs.menus[name] = value;
            localStorage.setItem('inputs', JSON.stringify(inputs));
            renderPage(addressData, schoolData, inputs, coords);
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
        addressInput.value = '';
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
 * @param {Array.<School>} schoolData - Data about all schools
 * @param {Object.<string, string>} inputs - Form input values
 * @param {Array.<number>} coords - Degrees latitude and longitude
 */
function renderPage(addressData, schoolData, inputs, coords) {
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
    document.getElementById('schools').innerHTML = renderTable(shown, schools, inputs.address);
    addEventListeners(addressData, schoolData, inputs, coords);
    document.getElementById('address').value = escapeFormInput(inputs.address);
}

// Retrieve saved form input, or populate default values.
const inputsJSON = localStorage.getItem('inputs');
const inputs = inputsJSON ? JSON.parse(inputsJSON) : {
    address: '',
    menus: {
        sort: 'name',
        type: '',
        grade: '',
        neighborhood: '',
        start: '',
        language: '',
        target: '',
        within: '',
    },
};

// Calculate commute distances, and render the page.
const coords = findAddress(addressData, inputs.address);
updateDistances(addressData, schoolData, inputs, coords)
    || renderPage(addressData, schoolData, inputs, coords);
