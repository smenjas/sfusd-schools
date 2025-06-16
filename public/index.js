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

function renderOptions(map, selected) {
    let html = '';
    for (const [key, value] of map.entries()) {
        const s = (key.toString() === selected) ? ' selected' : '';
        html += `<option value="${key}"${s}>${value}</option>`;
    }
    return html;
}

function renderGradeMenu(grade) {
    const gradeOptions = new Map([
        ['', 'Any'],
        ['pk', 'Pre-K'],
        ['tk', 'TK'],
        ['k', 'K'],
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
        [5, 5],
        [6, 6],
        [7, 7],
        [8, 8],
        [9, 9],
        [10, 10],
        [11, 11],
        [12, 12],
    ]);
    let html = '<label for="grade">Grade: </label>';
    html += '<select name="grade" id="grade">';
    html += renderOptions(gradeOptions, grade);
    html += '</select>';
    return html;
}

function getLanguages() {
    const languages = [];
    for (const key in schoolData) {
        const school = schoolData[key];
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

function renderLanguageMenu(language) {
    const languages = getLanguages();
    let html = '<label for="language">Language: </label>';
    html += '<select name="language" id="language">';
    html += '<option value="">Any</option>';
    for (const lang of languages) {
        const selected = (lang === language) ? ' selected' : '';
        html += `<option value="${lang}"${selected}>${lang}</option>`;
    }
    html += '</select>';
    return html;
}

function getNeighborhoods() {
    const neighborhoods = [];
    for (const key in schoolData) {
        const school = schoolData[key];
        const hood = school.neighborhood;
        if (!neighborhoods.includes(hood)) {
            neighborhoods.push(hood);
        }
    }
    return neighborhoods.sort();
}

function renderNeighborhoodMenu(neighborhood) {
    const neighborhoods = getNeighborhoods();
    let html = '<label for="neighborhood">Neighborhood: </label>';
    html += '<select name="neighborhood" id="neighborhood">';
    html += '<option value="">Any</option>';
    for (const hood of neighborhoods) {
        const selected = (hood === neighborhood) ? ' selected' : '';
        html += `<option value="${hood}"${selected}>${hood}</option>`;
    }
    html += '</select>';
    return html;
}

function renderTypeMenu(type) {
    const types = [
        'Early Education',
        'Elementary',
        'Middle',
        'High',
    ];
    let html = '<label for="type">Type: </label>';
    html += '<select name="type" id="type">';
    html += '<option value="">Any</option>';
    for (const t of types) {
        const selected = (t === type) ? ' selected' : '';
        html += `<option value="${t}"${selected}>${t} School</option>`;
    }
    html += '</select>';
    return html;
}

function renderSchoolForm(schoolData, filters) {
    let html = '<form id="schoolForm">';
    html += '<fieldset>';
    html += renderTypeMenu(filters.type);
    html += ' ';
    html += renderGradeMenu(filters.grade);
    html += ' ';
    html += renderNeighborhoodMenu(filters.neighborhood);
    html += ' ';
    html += renderLanguageMenu(filters.language);
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
        || school.types.includes(type);
}

function filterGrade(school, grade) {
    if (grade === '') return true;
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
        || neighborhood === school.neighborhood;
}

function filterLanguage(school, language) {
    if (language === '') {
        return true;
    }
    if (school.languages.includes(language)) {
        return true;
    }
    for (const lang of school.languages) {
        if (lang.includes(language)) {
            return true;
        }
    }
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
    let html = renderSchoolForm(schoolData, filters);
    html += renderSchoolTable(schools);
    return html;
}

function addEventListeners(schoolData, filters) {
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
}

// Render a web page.
function renderPage(schoolData, filters) {
    document.title = 'SFUSD Schools';
    const html = renderSchools(schoolData, filters);
    document.getElementById('schools').innerHTML = html;
    addEventListeners(schoolData, filters);
}

const filters = JSON.parse(localStorage.getItem('filters')) || {};
renderPage(schoolData, filters);
