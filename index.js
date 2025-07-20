import schoolData from './school-data.js';
import addressData from './address-data.js';
import { calculateDistance,
         expandCoords,
         getDirectionsURL,
         getMapURL } from './geo.js';

function escapeFormInput(value) {
    return encodeURIComponent(value).replaceAll('%20', ' ');
}

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

function renderDirectionsLink(fro, to, text) {
    const url = getDirectionsURL(fro, to);
    if (url === '') {
        return text;
    }
    return renderLink(url, text, true);
}

function renderMapLink(search, text) {
    if (search === '') {
        return '';
    }
    const url = getMapURL(search);
    return renderLink(url, text, true);
}

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

function renderPercent(percent) {
    return (percent === null) ? '' : percent + '%';
}

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

function renderRatio(antecedent, consequent = 1) {
    return (antecedent === null || consequent === null) ? ''
        : `${antecedent}:${consequent}`;
}

// Convert an array to a map.
function arrayToMap(collection) {
    if (!Array.isArray(collection)) {
        return collection;
    }
    const map = new Map();
    for (const value of collection) {
        map.set(value, value);
    }
    return map;
}

// Render options for a select menu.
// Accepts an array, object, map, or set, and the value selected.
function renderOptions(options, selected) {
    const map = arrayToMap(options);
    let html = '';
    for (const [key, value] of map.entries()) {
        const s = (key.toString() === selected) ? ' selected' : '';
        html += `<option value="${key}"${s}>${value}</option>`;
    }
    return html;
}

function copyFilters(menus) {
    return {
        grade: menus.grade,
        language: menus.language,
        neighborhood: menus.neighborhood,
        start: menus.start,
        target: menus.target,
        type: menus.type,
    };
}

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

function renderGradeMenu(schoolData, menus) {
    const filters = copyFilters(menus);
    filters.grade = '';
    const schools = filterSchools(schoolData, filters);
    const gradeOptions = getSchoolGrades(schools, menus.grade);
    let html = '<select name="grade" id="grade">';
    html += '<option value="">Any Grade</option>';
    html += renderOptions(gradeOptions, menus.grade);
    html += '</select>';
    return html;
}

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
    return languages.sort();
}

function renderLanguageMenu(schoolData, menus) {
    const filters = copyFilters(menus);
    filters.language = '';
    const schools = filterSchools(schoolData, filters);
    const languages = getLanguages(schools, menus.language);
    const disabled = languages.length ? '' : ' disabled';
    let html = `<select name="language" id="language"${disabled}>`;
    html += '<option value="">Any Language</option>';
    html += renderOptions(languages, menus.language);
    html += '</select>';
    return html;
}

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
    return neighborhoods.sort();
}

function renderNeighborhoodMenu(schoolData, menus) {
    const filters = copyFilters(menus);
    filters.neighborhood = '';
    const schools = filterSchools(schoolData, filters);
    const neighborhoods = getNeighborhoods(schools, menus.neighborhood);
    let html = '<select name="neighborhood" id="neighborhood">';
    html += '<option value="">Any Neighborhood</option>';
    html += renderOptions(neighborhoods, menus.neighborhood);
    html += '</select>';
    return html;
}

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

function renderTypeMenu(schoolData, menus) {
    const filters = copyFilters(menus);
    filters.type = '';
    const schools = filterSchools(schoolData, filters);
    const types = getSchoolTypes(schools, menus.type);
    let html = '<select name="type" id="type">';
    html += '<option value="">Any School Type</option>';
    html += renderOptions(types, menus.type);
    html += '</select>';
    return html;
}

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

function renderStartTimeMenu(schoolData, menus) {
    const filters = copyFilters(menus);
    filters.start = '';
    const schools = filterSchools(schoolData, filters);
    const starts = getStartTimes(schools, menus.start);
    let html = '<select name="start" id="start">';
    html += '<option value="">Any Start Time</option>';
    html += renderOptions(starts, menus.start);
    html += '</select>';
    return html;
}

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

function renderTargetsMenu(schoolData, menus) {
    const filters = copyFilters(menus);
    filters.target = '';
    const schools = filterSchools(schoolData, filters);
    const targets = getTargets(schools, menus.target);
    const disabled = targets.size ? '' : ' disabled';
    let html = `<select name="target" id="target"${disabled}>`;
    html += '<option value="">Feeds Into Any School</option>';
    html += renderOptions(targets, menus.target);
    html += '</select>';
    return html;
}

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

function renderDistancesMenu(schoolData, inputs) {
    const filters = copyFilters(inputs.menus);
    filters.within = '';
    const schools = filterSchools(schoolData, filters);
    const distances = getDistances(schools, inputs.menus.within);
    let disabled = distances.size ? '' : ' disabled ';
    if (inputs.address === '') {
        disabled += ' title="Enter your address to filter by distance."';
    }
    let html = `<select name="within" id="within"${disabled}>`;
    html += '<option value="">Within Any Distance</option>';
    html += renderOptions(distances, inputs.menus.within);
    html += '</select>';
    return html;
}

function getSortables(shown) {
    const fields = new Map();
    fields.set('name', 'Name');
    if (shown.distance) {
        fields.set('distance', 'Distance');
    }
    fields.set('neighborhood', 'Neighborhood');
    if (shown.usnews) {
        fields.set('usnews', 'US News Ranking');
    }
    if (shown.greatschools) {
        fields.set('greatschools', 'GreatSchools Score');
    }
    fields.set('students', 'School Size');
    if (shown.ratio) {
        fields.set('ratio', 'Student Teacher Ratio');
    }
    if (shown.reading) {
        fields.set('reading', 'Reading');
    }
    if (shown.math) {
        fields.set('math', 'Math');
    }
    if (shown.science) {
        fields.set('science', 'Science');
    }
    if (shown.graduated) {
        fields.set('graduated', 'Graduated');
    }
    fields.set('seatsPerApp', 'Seats/App');
    for (const [field, desc] of fields) {
        fields.set(field, `Sort by ${desc}`);
    }
    return fields;
}

function renderSortMenu(shown, sort) {
    const sorts = getSortables(shown);
    let html = '<select name="sort" id="sort">';
    html += renderOptions(sorts, sort);
    html += '</select>';
    return html;
}

function renderAddressInput() {
    let html = '<input name="address" id="address" list="addresses" placeholder="Your Address">';
    html += '<datalist id="addresses"></datalist>';
    html += '<span id="coords-link"></span>';
    return html;
}

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
    html += renderTargetsMenu(schoolData, inputs.menus);
    html += '</div>';
    html += '<div class="form-group">';
    html += renderDistancesMenu(schoolData, inputs);
    html += '</div>';
    html += '<div class="form-group">';
    html += '<button type="reset">Reset</button>';
    html += '</div>';
    html += '</form>';
    return html;
}

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

function getMinGrade(school) {
    return school.pk
        ? 'PK' : school.tk
        ? 'TK' : school.k
        ? 'K' : school.min;
}

function getMaxGrade(school) {
    return school.max
        ? school.max : school.k
        ? 'K' : school.tk
        ? 'TK' : school.pk
        ? 'PK' : '';
}

// Render a school's grade range (e.g. "TK-5").
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
}

function renderDistance(distance) {
    if (distance === null || distance === undefined) {
        return '';
    }
    return distance.toFixed(1) + ' mi.';
}

function renderGreatSchoolsScore(school) {
    if (school.greatschools === null) {
        return '';
    }
    const text = `${school.greatschools}/10`;
    return renderLink(school.urls.greatschools, text, true);
}

function renderUSNewsRank(school) {
    if (school.usnews === null) {
        return '';
    }
    const text = formatOrdinal(school.usnews);
    return renderLink(school.urls.usnews, text, true);
}

function renderSchoolName(school) {
    const name = getSchoolName(school).replace(/\bSan Francisco\b/g,
        '<abbr title="San Francisco">SF</abbr>');
    return renderLink(school.urls.main, name, true);
}

// Render one school's data as a table row.
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

// Render school data as an HTML table.
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

function filterType(school, type) {
    return !type || school.types.includes(type);
}

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

function filterNeighborhood(school, neighborhood) {
    return !neighborhood || neighborhood === school.neighborhood;
}

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

function filterLanguage(school, language) {
    // Has a language been chosen?
    if (!language) {
        return true;
    }
    // Do this school's languages match the chosen language exactly?
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

function filterTarget(school, target) {
    if (!target) {
        return true;
    }
    if (school.feedsInto.includes(target)) {
        return true;
    }
    return false;
}

function filterWithin(school, within) {
    if (!within) {
        return true;
    }
    if (school.distance <= within) {
        return true;
    }
    return false;
}

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

function filterSchools(schoolData, filters) {
    const schools = [];
    for (const school of schoolData) {
        if (!filters || filterSchool(school, filters)) {
            schools.push(school);
        }
    }
    return schools;
}

function sortSchools(schools, sort) {
    let sortFunction = () => {};
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

function getSchoolFullName(school) {
    let name = `${getSchoolName(school, false)} ${school.types[0]} School`;
    if (school.campus) {
        name += ` - ${renderGradeRange(school)} ${school.campus} Campus`;
    }
    return name;
}

function getSchoolName(school, campus = true) {
    let name = `${school.prefix} ${school.name} ${school.suffix}`.trim();
    if (campus && school.campus) {
        name += ` - ${school.campus}`;
    }
    return name;
}

// Update the distance between each school and the user's location.
//
// Returns true if the page rendered, or false otherwise.
function updateDistances(schoolData, inputs, coords) {
    for (const school of schoolData) {
        const schoolCoords = [school.lat, school.lon];
        school.distance = calculateDistance(coords, schoolCoords);
    }
    if (!coords) {
        inputs.menus.within = '';
        return false;
    }
    if (inputs.menus.sort === '' || inputs.menus.sort === 'name') {
        inputs.menus.sort = 'distance';
    }
    renderPage(schoolData, inputs, coords);
    document.getElementById('address').select();
    return true;
}

// Suggest addresses matching what the user has typed so far.
function suggestAddresses(addresses) {
    const datalist = document.getElementById('addresses');
    if (!datalist) {
        return;
    }
    datalist.innerHTML = renderOptions(addresses);
}

// Find addresses matching what the user has typed so far.
//
// Accepts a street number, a street name (maybe with punctuation, like an
// apostrophe), and a street name without punctuation.
//
// Returns an array of suggested street addresses.
function findAddressSuggestions(num, punct, nopunct) {
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

// Search for an address in San Francisco, California.
//
// Accepts a string from a text input.
//
// Returns an array of degrees latitude and longitude, if found.
function findAddress(address) {
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
        const addresses = findAddressSuggestions(num, punct, nopunct);
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

function addEventListeners(schoolData, inputs, coords) {
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
        coords = findAddress(inputs.address);
        updateDistances(schoolData, inputs, coords);
    });

    // Listen for select menus, to filter schools.
    const menus = document.querySelectorAll('select');
    for (const menu of menus) {
        menu.addEventListener('change', event => {
            const name = event.target.name;
            const value = event.target.value;
            inputs.menus[name] = value;
            localStorage.setItem('inputs', JSON.stringify(inputs));
            renderPage(schoolData, inputs, coords);
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

// Render a web page.
function renderPage(schoolData, inputs, coords) {
    const schools = filterSchools(schoolData, inputs.menus);
    sortSchools(schools, inputs.menus.sort);
    const shown = findShownColumns(schools);
    document.getElementById('input').innerHTML = renderForm(shown, schoolData, inputs);
    document.getElementById('schools').innerHTML = renderTable(shown, schools, inputs.address);
    addEventListeners(schoolData, inputs, coords);
    document.getElementById('address').value = escapeFormInput(inputs.address);
}

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

const coords = findAddress(inputs.address);
updateDistances(schoolData, inputs, coords)
    || renderPage(schoolData, inputs, coords);
