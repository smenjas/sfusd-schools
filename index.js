import schoolData from './school-data.js';

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

function renderMapLink(search, text) {
    const url = 'https://www.google.com/maps/search/' + search.replaceAll(' ', '+');
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

function getSchoolGrades(schools) {
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
                    console.warn(school.name, 'has invalid school grade:', n);
                    continue;
                }
                grades.set(n, true);
            }
        }
    }
    const options = [];
    if (grades.get('pk')) options.push(['pk', 'Pre-K']);
    if (grades.get('tk')) options.push(['tk', 'TK']);
    if (grades.get('k')) options.push(['k', 'K']);
    for (let n = 1; n <= 12; n++) {
        if (grades.get(n)) options.push([n, n]);
    }
    return new Map(options);
}

function renderGradeMenu(schools, grade) {
    const gradeOptions = getSchoolGrades(schools);
    let html = '<label for="grade">Grade: </label>';
    html += '<select name="grade" id="grade">';
    html += '<option value="">Any</option>';
    html += renderOptions(gradeOptions, grade);
    html += '</select>';
    return html;
}

function getLanguages(schools) {
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
    return languages.sort();
}

function renderLanguageMenu(schools, language) {
    const languages = getLanguages(schools);
    let html = '<label for="language">Language: </label>';
    html += '<select name="language" id="language">';
    html += '<option value="">Any</option>';
    html += renderOptions(languages, language);
    html += '</select>';
    return html;
}

function getNeighborhoods(schools) {
    const neighborhoods = [];
    for (const key in schools) {
        const school = schools[key];
        const hood = school.neighborhood;
        if (!neighborhoods.includes(hood)) {
            neighborhoods.push(hood);
        }
    }
    return neighborhoods.sort();
}

function renderNeighborhoodMenu(schools, neighborhood) {
    const neighborhoods = getNeighborhoods(schools);
    let html = '<label for="neighborhood">Neighborhood: </label>';
    html += '<select name="neighborhood" id="neighborhood">';
    html += '<option value="">Any</option>';
    html += renderOptions(neighborhoods, neighborhood);
    html += '</select>';
    return html;
}

function getSchoolTypes(schools) {
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
        if (types.includes(type)) orderedTypes.push(type);
    }
    return orderedTypes;
}

function renderTypeMenu(schools, type) {
    const types = getSchoolTypes(schools);
    let html = '<label for="type">Type: </label>';
    html += '<select name="type" id="type">';
    html += '<option value="">Any</option>';
    html += renderOptions(types, type);
    html += '</select>';
    return html;
}

function renderSchoolForm(schools, filters) {
    let html = '<form id="schoolForm">';
    html += '<fieldset>';
    html += renderTypeMenu(schools, filters.type);
    html += ' ';
    html += renderGradeMenu(schools, filters.grade);
    html += ' ';
    html += renderNeighborhoodMenu(schools, filters.neighborhood);
    html += ' ';
    html += renderLanguageMenu(schools, filters.language);
    html += ' ';
    html += '<input type="reset">';
    html += '</fieldset>';
    html += '</form>';
    return html;
}

function renderSchoolsHeader() {
    let html = '';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Name</th>';
    html += '<th>Grades</th>';
    html += '<th>Start Time</th>';
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

// Render one school's data as a table row.
function renderSchoolRow(school) {
    const schoolLink = renderLink(school.urls.main, school.name, true);
    const greatschoolsLink = renderLink(school.urls.greatschools, school.greatschools, true);
    const usnewsLink = renderLink(school.urls.usnews, school.usnews, true);
    const search = `${school.name} ${school.types[0]} School in San Francisco, California`;
    const mapLink = renderMapLink(search, school.address);
    const min = getMinGrade(school);
    const max = getMaxGrade(school);
    let html = '';
    html += '<tr>';
    html += `<td>${schoolLink}</td>`;
    html += `<td>${renderGradeRange(min, max)}</td>`;
    html += `<td class="num">${school.start}</td>`;
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
function renderSchoolTable(schools) {
    const numSchools = Object.keys(schools).length;
    let html = '<table>';
    html += `<caption>${numSchools} Schools</caption>`;
    if (numSchools < 1) {
        html += '</table>';
        return html;
    }
    html += renderSchoolsHeader();
    html += '<tbody>';
    for (const key in schools) {
        html += renderSchoolRow(schools[key]);
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

function filterSchools(schoolData, filters) {
    const schools = {};
    for (const key in schoolData) {
        const school = schoolData[key];
        if (filterType(school, filters.type) &&
            filterGrade(school, filters.grade) &&
            filterNeighborhood(school, filters.neighborhood) &&
            filterLanguage(school, filters.language)) {
            schools[key] = school;
        }
    }
    return schools;
}

function renderSchools(schoolData, filters) {
    const schools = filterSchools(schoolData, filters);
    let html = renderSchoolForm(schools, filters);
    html += renderSchoolTable(schools);
    return html;
}

function addEventListeners(schoolData, filters) {
    // Remove existing event listeners.
    const oldMenus = document.querySelectorAll('select');
    for (const menu of oldMenus) {
        menu.replaceWith(menu.cloneNode(true));
    }
    const oldReset = document.querySelector('input[type=reset]');
    oldReset.replaceWith(oldReset.cloneNode(true));
    // Add event listeners.
    const menus = document.querySelectorAll('select');
    for (const menu of menus) {
        menu.addEventListener('change', event => {
            const name = event.target.name;
            const value = event.target.value;
            filters[name] = value;
            localStorage.setItem('filters', JSON.stringify(filters));
            renderPage(schoolData, filters);
        });
    }
    const reset = document.querySelector('input[type=reset]');
    reset.addEventListener('click', event => {
        for (const menu of menus) {
            menu.value = '';
            menu.dispatchEvent(new Event('change'));
        }
    });
}

// Render a web page.
function renderPage(schoolData, filters) {
    document.title = 'SFUSD Schools';
    const html = renderSchools(schoolData, filters);
    document.getElementById('schools').innerHTML = html;
    addEventListeners(schoolData, filters);
}

const filtersJSON = localStorage.getItem('filters');
const filters = filtersJSON ? JSON.parse(filtersJSON) : {};
renderPage(schoolData, filters);
