/**
 * @description Method to get random element from array
 * @param {*[]} arr the array
 * @returns {*} random element
 * @example random(['a', 'b', 'c'])
 */
export const random = arr => {
    return arr[Math.floor(Math.random() * arr.length)];
};

export default random;