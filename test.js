import Test from './scripts/test.js';

const failed = Test.runAll();
console.log(failed, 'tests failed.');

process.exit(failed ? 1 : 0);
