import schoolData from './school-data.js';
import addressData from './address-data.js';
import { calculateDistance,
         expandCoords,
         getDirectionsURL,
         getMapURL } from './geo.js';

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

function renderCoordsLink(coords, text) {
    if (!coords) {
        return text;
    }
    return renderMapLink(coords.join(','), text);
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

function getSchoolGrades(schools, selected) {
    const grades = new Map([
        ['pk', false],
        ['tk', false],
        ['k', false],
        [1, false],
        [2, false],
        [3, false],
        [4, false],
        [5, false],
        [6, false],
        [7, false],
        [8, false],
        [9, false],
        [10, false],
        [11, false],
        [12, false],
    ]);
    let pk = false;
    let tk = false;
    let k = false;
    let min = Infinity;
    let max = -Infinity;
    for (const key in schools) {
        const school = schools[key];
        if (school.pk) grades.set('pk', true);
        if (school.tk) grades.set('tk', true);
        if (school.k) grades.set('k', true);
        if (school.min !== null && school.max !== null) {
            for (let n = school.min; n <= school.max; n++) {
                if (!grades.has(n)) {
                    console.warn(school.name, school.types[0], 'has invalid school grade:', n);
                    continue;
                }
                grades.set(n, true);
            }
        }
    }
    const options = [];
    if (selected === 'pk' || grades.get('pk')) options.push(['pk', 'Pre-K']);
    if (selected === 'tk' || grades.get('tk')) options.push(['tk', 'TK']);
    if (selected === 'k' || grades.get('k')) options.push(['k', 'K']);
    for (let n = 1; n <= 12; n++) {
        if (selected === n || grades.get(n)) options.push([n, n]);
    }
    return new Map(options);
}

function renderGradeMenu(schools, grade) {
    const gradeOptions = getSchoolGrades(schools, grade);
    let html = '<span class="nobr"><label for="grade">Grade: </label>';
    html += '<select name="grade" id="grade">';
    html += '<option value="">Any</option>';
    html += renderOptions(gradeOptions, grade);
    html += '</select></span>';
    return html;
}

function getLanguages(schools, selected) {
    const languages = [];
    for (const key in schools) {
        const school = schools[key];
        const langs = school.languages;
        for (const lang of langs) {
            const language = lang.split(' ', 1)[0];
            if (!languages.includes(language)) {
                languages.push(language);
            }
        }
    }
    if (selected !== '' && !languages.includes(selected)) {
        languages.push(selected);
    }
    return languages.sort();
}

function renderLanguageMenu(schools, language) {
    const languages = getLanguages(schools, language);
    let html = '<span class="nobr"><label for="language">Language: </label>';
    html += '<select name="language" id="language">';
    html += '<option value="">Any</option>';
    html += renderOptions(languages, language);
    html += '</select></span>';
    return html;
}

function getNeighborhoods(schools, selected) {
    const neighborhoods = [];
    for (const key in schools) {
        const school = schools[key];
        const hood = school.neighborhood;
        if (!neighborhoods.includes(hood)) {
            neighborhoods.push(hood);
        }
    }
    if (selected !== '' && !neighborhoods.includes(selected)) {
        neighborhoods.push(selected);
    }
    return neighborhoods.sort();
}

function renderNeighborhoodMenu(schools, neighborhood) {
    const neighborhoods = getNeighborhoods(schools, neighborhood);
    let html = '<span class="nobr"><label for="neighborhood">Neighborhood: </label>';
    html += '<select name="neighborhood" id="neighborhood">';
    html += '<option value="">Any</option>';
    html += renderOptions(neighborhoods, neighborhood);
    html += '</select></span>';
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
    outer: for (const key in schools) {
        const school = schools[key];
        inner: for (const type of school.types) {
            if (!types.includes(type)) {
                types.push(type);
                if (types.length >= allTypes.length) {
                    break outer;
                }
            }
        }
    }
    const orderedTypes = [];
    for (const type of allTypes) {
        if (selected === type || types.includes(type)) {
            orderedTypes.push(type);
        }
    }
    return orderedTypes;
}

function renderTypeMenu(schools, type) {
    const types = getSchoolTypes(schools, type);
    let html = '<span class="nobr"><label for="type">Type: </label>';
    html += '<select name="type" id="type">';
    html += '<option value="">Any</option>';
    html += renderOptions(types, type);
    html += '</select></span>';
    return html;
}

function getStartTimes() {
    return new Map([
        [7, 'Before 8:00 am'],
        [8, '8:00-8:59 am'],
        [9, 'After 9:00 am'],
    ]);
}

function renderStartTimeMenu(start) {
    const starts = getStartTimes();
    let html = '<span class="nobr"><label for="start">Start Time: </label>';
    html += '<select name="start" id="start">';
    html += '<option value="">Any</option>';
    html += renderOptions(starts, start);
    html += '</select></span>';
    return html;
}

function getSortables() {
    return [
        'Name',
        'Distance',
        'Neighborhood',
        'US News Ranking',
        'GreatSchools Score',
        'Ratio',
        'Math',
        'Reading',
        'Science',
        'Graduated',
        'Seats/App',
    ];
}

function renderSortMenu(sort) {
    const sorts = getSortables();
    let html = '<span class="nobr"><label for="sort">Sort by: </label>';
    html += '<select name="sort" id="sort">';
    html += renderOptions(sorts, sort);
    html += '</select></span>';
    return html;
}

function renderAddressInput() {
    let html = '<span class="nobr"><label for="address">Address: </label>';
    html += '<input name="address" id="address" list="addresses" size="32"></span>';
    html += '<datalist id="addresses"></datalist>';
    html += ' <span id="coords-link"></span>';
    return html;
}

function renderForm(schools, inputs) {
    let html = '<form id="schoolForm">';
    html += '<fieldset>';
    html += '<div>';
    html += renderAddressInput();
    html += '</div>';
    html += '<div>';
    html += renderSortMenu(inputs.menus.sort);
    html += '<button type="reset">Reset</button>';
    html += '</div>';
    html += '</fieldset>';
    html += '<fieldset class="filters">';
    html += '<legend>Filter by:</legend>';
    html += '<div>';
    html += renderTypeMenu(schools, inputs.menus.type);
    html += '</div>';
    html += '<div>';
    html += renderGradeMenu(schools, inputs.menus.grade);
    html += '</div>';
    html += '<div>';
    html += renderNeighborhoodMenu(schools, inputs.menus.neighborhood);
    html += '</div>';
    html += '<div>';
    html += renderLanguageMenu(schools, inputs.menus.language);
    html += '</div>';
    html += '<div>';
    html += renderStartTimeMenu(inputs.menus.start);
    html += '</div>';
    html += '</fieldset>';
    html += '</form>';
    return html;
}

function renderHeader() {
    let html = '';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Name</th>';
    html += '<th>Grades</th>';
    html += '<th>Start Time</th>';
    html += '<th>Distance</th>';
    html += '<th>Neighborhood</th>';
    html += '<th>Address</th>';
    html += '<th>US News</th>';
    html += '<th>Great<wbr>Schools</th>';
    //html += '<th>Min</th>';
    //html += '<th>Max</th>';
    html += '<th>Students</th>';
    html += '<th>Teachers</th>';
    html += '<th>Ratio</th>';
    html += '<th>Math</th>';
    html += '<th>Reading</th>';
    html += '<th>Science</th>';
    html += '<th>Graduated</th>';
    //html += '<th>Minority</th>';
    //html += '<th>Low Income</th>';
    //html += '<th>M/F</th>';
    html += '<th>Seats/App</th>';
    html += '<th>Languages</th>';
    html += '<th>Feeds Into</th>';
    html += '</tr>';
    html += '</thead>';
    return html;
}

function getMinGrade(school) {
    return school.pk ? 'PK' : school.tk ? 'TK' : school.k ? 'K' : school.min;
}

function getMaxGrade(school) {
    return school.max ? school.max : school.k ? 'K' : school.tk ? 'TK' : school.pk ? 'PK' : '';
}

// Render a school's grade range (e.g. "TK-5").
function renderGradeRange(min, max) {
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

// Render one school's data as a table row.
function renderRow(school, address) {
    const name = getSchoolName(school);
    const schoolLink = renderLink(school.urls.main, name, true);
    const greatschoolsLink = renderLink(school.urls.greatschools, school.greatschools, true);
    const usnewsLink = renderLink(school.urls.usnews, school.usnews, true);
    const fullName = getSchoolFullName(school);
    const city = 'San Francisco, CA';
    const origin = `${address}, ${city}, USA`;
    const search = `${fullName} School, ${school.address}, ${city} ${school.zip}`;
    const distance = renderDistance(school.distance);
    const directionsLink = renderDirectionsLink(origin, search, distance);
    const mapLink = renderMapLink(search, school.address);
    const min = getMinGrade(school);
    const max = getMaxGrade(school);
    let html = '';
    html += '<tr>';
    html += `<td>${schoolLink}</td>`;
    html += `<td>${renderGradeRange(min, max)}</td>`;
    html += `<td class="num">${school.start}</td>`;
    html += `<td class="num">${directionsLink}</td>`;
    html += `<td>${school.neighborhood}</td>`;
    html += `<td>${mapLink}</td>`;
    html += `<td class="num">${usnewsLink}</td>`;
    html += `<td class="num">${greatschoolsLink}</td>`;
    //html += `<td class="num">${min}</td>`;
    //html += `<td class="num">${school.max}</td>`;
    html += `<td class="num">${school.students ?? ''}</td>`;
    html += `<td class="num">${school.teachers ?? ''}</td>`;
    html += `<td class="num">${renderRatio(school.ratio)}</td>`;
    html += `<td class="num">${renderPercent(school.math)}</td>`;
    html += `<td class="num">${renderPercent(school.reading)}</td>`;
    html += `<td class="num">${renderPercent(school.science)}</td>`;
    html += `<td class="num">${renderPercent(school.graduated)}</td>`;
    //html += `<td class="num">${renderPercent(school.minority)}</td>`;
    //html += `<td class="num">${renderPercent(school.lowIncome)}</td>`;
    //html += `<td class="num">${renderGender(school.male, school.female)}</td>`;
    html += `<td class="num">${renderPercent(school.seatsPerApp)}</td>`;
    html += `<td>${renderList(school.languages)}</td>`;
    html += `<td>${renderList(school.feedsInto)}</td>`;
    html += '</tr>';
    return html;
}

// Render school data as an HTML table.
function renderTable(schools, address) {
    const numSchools = Object.keys(schools).length;
    let html = '<table>';
    html += `<caption>${numSchools} Schools</caption>`;
    if (numSchools < 1) {
        html += '</table>';
        return html;
    }
    html += renderHeader();
    html += '<tbody>';
    for (const key in schools) {
        html += renderRow(schools[key], address);
    }
    html += '</tbody>';
    html += '</table>';
    return html;
}

function filterType(school, type) {
    return type === ''
        || type === undefined
        || school.types.includes(type);
}

function filterGrade(school, grade) {
    if (grade === '' || grade === undefined) return true;
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
    return neighborhood === ''
        || neighborhood === undefined
        || neighborhood === school.neighborhood;
}

function filterStartTime(school, start) {
    if (start === '' || start === undefined || start === null) {
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
    if (language === '' || language === undefined) {
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

function filterSchool(school, menus) {
    const filters = {
        type: filterType,
        grade: filterGrade,
        neighborhood: filterNeighborhood,
        start: filterStartTime,
        language: filterLanguage,
    };
    for (const filter in filters) {
        if (!(filter in menus)) {
            // No saved form inputs for this user.
            continue;
        }
        const filterFunction = filters[filter];
        if (!filterFunction(school, menus[filter])) {
            return false;
        }
    }
    return true;
}

function filterSchools(schoolData, menus) {
    const schools = [];
    for (const school of schoolData) {
        if (!menus || filterSchool(school, menus)) {
            schools.push(school);
        }
    }
    return schools;
}

function sortSchools(schools, sort) {
    let sortFunction = () => {};
    switch (sort) {
        case 'Name':
            sortFunction = (a, b) => a.name.localeCompare(b.name);
            break;
        case 'Distance':
            sortFunction = (a, b) => a.distance - b.distance;
            break;
        case 'Neighborhood':
            sortFunction = (a, b) => a.neighborhood.localeCompare(b.neighborhood);
            break;
        case 'US News Ranking':
            sortFunction = (a, b) => a.usnews - b.usnews;
            break;
        case 'GreatSchools Score':
            sortFunction = (a, b) => b.greatschools - a.greatschools;
            break;
        case 'Ratio':
            sortFunction = (a, b) => a.ratio - b.ratio;
            break;
        case 'Math':
            sortFunction = (a, b) => b.math - a.math;
            break;
        case 'Reading':
            sortFunction = (a, b) => b.reading - a.reading;
            break;
        case 'Science':
            sortFunction = (a, b) => b.science - a.science;
            break;
        case 'Graduated':
            sortFunction = (a, b) => b.graduated - a.graduated;
            break;
        case 'Seats/App':
            sortFunction = (a, b) => a.seatsPerApp - b.seatsPerApp;
            break;
        default:
            return;
    }
    schools.sort(sortFunction);
}

function updateAddressInput(address, coords) {
    const addressInput = document.getElementById('address');
    const addressLabel = document.querySelector('label[for=address]');
    addressInput.value = address;
    addressLabel.innerHTML = renderCoordsLink(coords, 'Address: ');
}

function getSchoolFullName(school) {
    return `${getSchoolName(school)} ${school.types[0]}`;
}

function getSchoolName(school) {
    return `${school.prefix} ${school.name} ${school.suffix}`.trim();
}

// Update the distance between each school and the user's location.
//
// Returns true if the page rendered, or false otherwise.
function updateDistances(schoolData, inputs, coords) {
    for (const school of schoolData) {
        const name = getSchoolFullName(school);
        const schoolCoords = [school.lat, school.lon];
        school.distance = calculateDistance(coords, schoolCoords);
    }
    if (!coords) {
        return false;
    }
    if (inputs.menus.sort === 'Name') {
        inputs.menus.sort = 'Distance';
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
function findAddressSuggestions(num, str, street) {
    const addresses = [];
    for (const st in addressData) {
        if (st.startsWith(street) && num in addressData[st]) {
            addresses.push(`${num} ${st}`);
        }
    }
    if (str === street) {
        return addresses;
    }
    const puncts = {
        'O\'FARRELL ST': 'OFARRELL ST',
        'O\'REILLY AVE': 'OREILLY AVE',
        'O\'SHAUGHNESSY BLVD': 'OSHAUGHNESSY BLVD',
    };
    for (const punct in puncts) {
        const st = puncts[punct];
        if (punct.startsWith(str) && num in addressData[st]) {
            addresses.push(`${num} ${punct}`);
        }
    }
    return addresses;
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
    const str = parts.join(' ').toUpperCase();
    const street = str.replace(/[^A-Z0-9\s]/g, '');
    if (!(street in addressData)) {
        const addresses = findAddressSuggestions(num, str, street);
        if (addresses.length <= 10) {
            suggestAddresses(addresses);
        }
        return;
    }
    if (!(num in addressData[street])) {
        return;
    }
    return expandCoords(addressData[street][num]);
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
        if (inputs.sort === 'Distance') {
            inputs.sort = 'Name';
        }
        addressInput.dispatchEvent(new Event('input'));
        updateAddressInput('', null);
        for (const menu of menus) {
            menu.value = '';
            menu.dispatchEvent(new Event('change'));
        }
    });
}

// Render a web page.
function renderPage(schoolData, inputs, coords) {
    document.title = 'SFUSD Schools';
    const schools = filterSchools(schoolData, inputs.menus);
    sortSchools(schools, inputs.menus.sort);
    document.getElementById('input').innerHTML = renderForm(schools, inputs);
    document.getElementById('schools').innerHTML = renderTable(schools, inputs.address);
    addEventListeners(schoolData, inputs, coords);
    updateAddressInput(inputs.address, coords);
}

const inputsJSON = localStorage.getItem('inputs');
const inputs = inputsJSON ? JSON.parse(inputsJSON) : {
    address: '',
    menus: {
        sort: 'Name',
        type: '',
        grade: '',
        neighborhood: '',
        start: '',
        language: '',
    },
};

const coords = findAddress(inputs.address);
updateDistances(schoolData, inputs, coords)
    || renderPage(schoolData, inputs, coords);
