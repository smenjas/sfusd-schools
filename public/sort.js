/**
 * Sort schools.
 * @module public/sort
 */

/**
 * Sort schools, based on multiple criteria, in place.
 *
 * @param {Schools} schools - Data about some schools
 * @param {string} sort - Which field to sort by
 */
export function sortSchools(schools, sort) {
    const sortFunctions = {
        name: (a, b) => a.name.localeCompare(b.name),
        distance: (a, b) => a.distance - b.distance,
        neighborhood: (a, b) => a.neighborhood.localeCompare(b.neighborhood),
        usnews: sortSchoolsByUSNews,
        greatschools: sortSchoolsByGreatSchools,
        students: sortSchoolsByStudents,
        ratio: sortSchoolsByRatio,
        reading: sortSchoolsByReading,
        math: sortSchoolsByMath,
        science: sortSchoolsByScience,
        graduated: sortSchoolsByGraduated,
        seatsPerApp: sortSchoolsBySeatsPerApp,
    }
    if (!(sort in sortFunctions)) {
        return;
    }
    schools.sort(sortFunctions[sort]);
}

function sortSchoolsByGraduated(a, b) {
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

function sortSchoolsByGreatSchools(a, b) {
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

function sortSchoolsByMath(a, b) {
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

function sortSchoolsByRatio(a, b) {
    if (a.ratio !== b.ratio) {
        return a.ratio - b.ratio;
    }
    return a.students - b.students;
}

function sortSchoolsByReading(a, b) {
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

function sortSchoolsByScience(a, b) {
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

function sortSchoolsBySeatsPerApp(a, b) {
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

function sortSchoolsByStudents(a, b) {
    if (a.students !== b.students) {
        return a.students - b.students;
    }
    return a.ratio - b.ratio;
}

function sortSchoolsByUSNews(a, b) {
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
