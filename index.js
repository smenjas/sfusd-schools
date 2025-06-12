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
    for (let element of array) {
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
    html += `<td class="num}">${renderRatio(school.ratio)}</td>`;
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
function renderSchoolTable(schoolData) {
    let html = `<table id="schools">`;
    html += renderSchoolsHeader();
    html += '<tbody>';
    for (const key in schoolData) {
        html += renderSchoolRow(schoolData[key]);
    }
    html += '</tbody>';
    html += '</table>';
    return html;
}

// Render a web page.
function renderPage() {
    document.title = 'SFUSD Schools';
    return renderSchoolTable(schoolData);
}

const html = renderPage();
document.body.insertAdjacentHTML('beforeend', html);
