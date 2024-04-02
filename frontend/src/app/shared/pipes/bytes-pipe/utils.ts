/* tslint:disable */

export type CollectionPredicate = (item?: any, index?: number, collection?: any[]) => boolean;

export function isUndefined(value: any): value is undefined {

  return typeof value === 'undefined';
}

export function isNull(value: any): value is null {
  return value === null;
}

export function isNumber(value: any): value is number {
  return typeof value === 'number';
}

export function isNumberFinite(value: any): value is number {
  return isNumber(value) && isFinite(value);
}

// Not strict positive
export function isPositive(value: number): boolean {
  return value >= 0;
}


export function isInteger(value: number): boolean {
  // No rest, is an integer
  return (value % 1) === 0;
}

export function isNil(value: any): value is (null | undefined) {
  return value === null || typeof (value) === 'undefined';
}

export function isString(value: any): value is string {
  return typeof value === 'string';
}

export function isObject(value: any): boolean {
  return value !== null && typeof value === 'object';
}

export function isArray(value: any): boolean {
  return Array.isArray(value);
}

export function isFunction(value: any): boolean {
  return typeof value === 'function';
}

export function toDecimal(value: number, decimal: number): number {
  return Math.round(value * Math.pow(10, decimal)) / Math.pow(10, decimal);
}

export function toSigFigs(value: number, sigFigs: number): string {
  return value >= Math.pow(10, sigFigs - 1) ? Math.round(value).toString() : value.toPrecision(sigFigs);
}

export function upperFirst(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function createRound(method: string): Function {
  // <any>Math to suppress error
  const func: any = (<any>Math)[method];
  return function (value: number, precision: number = 0) {
    if (typeof value === 'string') {
      throw new TypeError('Rounding method needs a number');
    }
    if (typeof precision !== 'number' || isNaN(precision)) {
      precision = 0;
    }
    if (precision) {
      let pair = `${value}e`.split('e');
      const val = func(`${pair[0]}e` + (+pair[1] + precision));
      pair = `${val}e`.split('e');
      return +(pair[0] + 'e' + (+pair[1] - precision));
    }
    return func(value);
  };
}

export function leftPad(str: string, len: number = 0, ch: any = ' ') {
  str = String(str);
  ch = toString(ch);
  let i = -1;
  const length = len - str.length;
  while (++i < length && (str.length + ch.length) <= len) {
    str = ch + str;
  }
  return str;
}

export function rightPad(str: string, len: number = 0, ch: any = ' ') {
  str = String(str);
  ch = toString(ch);
  let i = -1;
  const length = len - str.length;
  while (++i < length && (str.length + ch.length) <= len) {
    str += ch;
  }
  return str;
}

export function toString(value: number | string) {
  return `${value}`;
}

export function pad(str: string, len: number = 0, ch: any = ' '): string {
  str = String(str);
  ch = toString(ch);
  let i = -1;
  const length = len - str.length;

  let left = true;
  while (++i < length) {
    const l = (str.length + ch.length <= len) ? (str.length + ch.length) : (str.length + 1);
    if (left) {
      str = leftPad(str, l, ch);
    } else {
      str = rightPad(str, l, ch);
    }
    left = !left;
  }
  return str;
}

export function flatten(input: any[], index: number = 0): any[] {

  if (index >= input.length) {
    return input;
  }

  if (isArray(input[index])) {
    return flatten(
      input.slice(0, index).concat(input[index], input.slice(index + 1)),
      index
    );
  }

  return flatten(input, index + 1);

}


export function getProperty(value: { [key: string]: any }, key: string): any {

  if (isNil(value) || !isObject(value)) {
    return undefined;
  }

  const keys: string[] = key.split('.');
  let result: any = value[keys.shift()!];

  for (const kk of keys) {
    if (isNil(result) || !isObject(result)) {
      return undefined;
    }

    result = result[kk];
  }

  return result;
}

export function sum(input: Array<number>, initial = 0): number {

  return input.reduce((previous: number, current: number) => previous + current, initial);
}

// http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
export function shuffle(input: any): any {

  if (!isArray(input)) {
    return input;
  }

  const copy = [...input];

  for (let i = copy.length; i; --i) {
    const j = Math.floor(Math.random() * i);
    const x = copy[i - 1];
    copy[i - 1] = copy[j];
    copy[j] = x;
  }

  return copy;
}

export function deepIndexOf(collection: any[], value: any) {

  let index = -1;
  const length = collection.length;

  while (++index < length) {
    if (deepEqual(value, collection[index])) {
      return index;
    }
  }

  return -1;
}


export function deepEqual(a: any, b: any) {

  if (a === b) {
    return true;
  }

  if (!(typeof a === 'object' && typeof b === 'object')) {
    return a === b;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  const hasOwn = Object.prototype.hasOwnProperty;
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!hasOwn.call(b, keysA[i]) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

export function isDeepObject(object: any) {

  return object.__isDeepObject__;
}

export function wrapDeep(object: any) {

  return new DeepWrapper(object);
}

export function unwrapDeep(object: any) {

  if (isDeepObject(object)) {
    return object.data;
  }

  return object;
}

export class DeepWrapper {

  public __isDeepObject__ = true;

  constructor(public data: any) { }
}

export function count(input: any): any {

  if (!isArray(input) && !isObject(input) && !isString(input)) {
    return input;
  }

  if (isObject(input)) {
    return Object.keys(input).map((value) => input[value]).length;
  }

  return input.length;
}

export function empty(input: any): any {

  if (!isArray(input)) {
    return input;
  }

  return input.length === 0;
}

export function every(input: any, predicate: CollectionPredicate) {

  if (!isArray(input) || !predicate) {
    return input;
  }

  let result = true;
  let i = -1;

  while (++i < input.length && result) {
    result = predicate(input[i], i, input);
  }


  return result;
}

export function takeUntil(input: any[], predicate: CollectionPredicate) {

  let i = -1;
  const result: any = [];
  while (++i < input.length && !predicate(input[i], i, input)) {
    result[i] = input[i];
  }

  return result;
}

export function takeWhile(input: any[], predicate: CollectionPredicate) {
  return takeUntil(input, (item: any, index: number | undefined, collection: any[] | undefined) =>
    !predicate(item, index, collection));
}

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent
export function hasTouchScreen(): boolean {
  let hasTouchScreen = false;
  if ('maxTouchPoints' in navigator) {
    hasTouchScreen = navigator.maxTouchPoints > 0;
  } else if ('msMaxTouchPoints' in navigator) {
    // @ts-ignore
    hasTouchScreen = navigator.msMaxTouchPoints > 0;
  } else {
    const mQ = window.matchMedia?.('(pointer:coarse)');
    if (mQ?.media === '(pointer:coarse)') {
      hasTouchScreen = !!mQ.matches;
    } else if ('orientation' in window) {
      hasTouchScreen = true; // deprecated, but good fallback
    } else {
      // @ts-ignore - Only as a last resort, fall back to user agent sniffing
    const UA = navigator.userAgent;
      hasTouchScreen =
        /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(UA) ||
        /\b(Android|Windows Phone|iPad|iPod)\b/i.test(UA);
    }
  }
  return hasTouchScreen;
}