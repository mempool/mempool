/**
 * @description Method to flatten array by 1 level
 * @param {*[]} arr the array to be flattened
 * @param {*} item current item in array
 * @returns {*[]} flattened array
 * @example arr.reduce(flatten, [])
 */
export const flatten = (arr, item) => {
    if (Array.isArray(item)) {
        arr = arr.concat(item);
    } else {
        arr.push(item);
    }
    return arr;
};

export default flatten;