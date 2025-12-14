const authValidators = require('./authValidators');
const accountValidators = require('./accountValidators');
const employeeValidators = require('./employeeValidators');
const tagsValidators = require('./tagsValidators');

module.exports = {
    ...authValidators,
    ...accountValidators,
    ...employeeValidators,
    ...tagsValidators
};