// simple recursive deep clone for literal-type objects
// does not preserve Dates, Maps, Sets etc
// does not support recursive objects
// properties deeper than maxDepth will be shallow cloned
export function deepClone(obj: any, maxDepth: number = 50, depth: number = 0): any {
  let cloned = obj;
  if (depth < maxDepth && typeof obj === 'object') {
    cloned = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      cloned[key] = deepClone(obj[key], maxDepth, depth + 1);
    }
  }
  return cloned;
}