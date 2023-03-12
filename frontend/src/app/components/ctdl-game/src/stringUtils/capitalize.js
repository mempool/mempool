/**
 * @description Method to capitalize first letter of string
 * @param {String} string the string to capitalize
 * @returns {String} capitalized string
 */
export const capitalize = string => {
    string = string.split('');
    return string.shift().toUpperCase() + string.join('');
};