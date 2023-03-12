/**
 * @description Method to filter array for unique values
 * @param {String} [key] set if values are objects, filter by key
 * @returns {Function} curried function to filter unqiue values
 * @example ['a', 'a', 'c'].filter(unique())
 */
export const unique = key => {
  if (key) {
    return (obj, index, self) => self.findIndex(s => s[key] === obj[key]) === index;
  }

  return (obj, index, self) => self.findIndex(s => s === obj) === index;
};

export default unique;