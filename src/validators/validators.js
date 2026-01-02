const authValidators = require('./authValidators');
const accountValidators = require('./accountValidators');
const employeeValidators = require('./employeeValidators');
const tagsValidators = require('./tagsValidators');
const readerValidators = require('./readerValidators');

module.exports = {
    ...authValidators,
    ...accountValidators,
    ...employeeValidators,
    ...tagsValidators,
    ...readerValidators
};