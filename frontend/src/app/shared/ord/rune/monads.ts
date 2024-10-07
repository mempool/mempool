// Copied with MIT License from link below:
// https://github.com/thames-technology/monads/blob/de957d3d68449d659518d99be4ea74bbb70dfc8e/src/option/option.ts

/**
 * Type representing any value except 'undefined'.
 * This is useful when working with strict null checks, ensuring that a value can be null but not undefined.
 */
type NonUndefined = {} | null; // eslint-disable-line @typescript-eslint/ban-types

/**
 * Enum-like object to represent the type of an Option (Some or None).
 */
export const OptionType = {
  Some: Symbol(':some'),
  None: Symbol(':none'),
};

/**
 * Interface for handling match operations on an Option.
 * Allows executing different logic based on the Option being Some or None.
 */
interface Match<A, B> {
  some: (val: A) => B;
  none: (() => B) | B;
}

/**
 * The Option interface representing an optional value.
 * An Option is either Some, holding a value, or None, indicating the absence of a value.
 */
export interface Option<T extends NonUndefined> {
  /**
   * Represents the type of the Option: either Some or None. Useful for debugging and runtime checks.
   */
  type: symbol;

  /**
   * Determines if the Option is a Some.
   *
   * @returns true if the Option is Some, otherwise false.
   *
   * #### Example
   *
   * ```ts
   * console.log(Some(5).isSome()); // true
   * console.log(None.isSome()); // false
   * ```
   */
  isSome(): boolean;

  /**
   * Determines if the Option is None.
   *
   * @returns true if the Option is None, otherwise false.
   *
   * #### Example
   *
   * ```ts
   * console.log(Some(5).isNone()); // false
   * console.log(None.isNone()); // true
   * ```
   */
  isNone(): boolean;

  /**
   * Performs a match operation on the Option, allowing for branching logic based on its state.
   * This method takes an object with functions for each case (Some or None) and executes
   * the corresponding function based on the Option's state, returning the result.
   *
   * @param fn An object containing two properties: `some` and `none`, which are functions
   * to handle the Some and None cases, respectively.
   * @returns The result of applying the corresponding function based on the Option's state.
   *
   * #### Example
   *
   * ```ts
   * const optionSome = Some(5);
   * const matchResultSome = optionSome.match({
   *   some: (value) => `The value is ${value}.`,
   *   none: () => 'There is no value.',
   * });
   * console.log(matchResultSome); // Outputs: "The value is 5."
   *
   * const optionNone = None;
   * const matchResultNone = optionNone.match({
   *   some: (value) => `The value is ${value}.`,
   *   none: () => 'There is no value.',
   * });
   * console.log(matchResultNone); // Outputs: "There is no value."
   * ```
   */
  match<U extends NonUndefined>(fn: Match<T, U>): U;

  /**
   * Applies a function to the contained value (if any), or returns a default if None.
   *
   * @param fn A function that takes a value of type T and returns a value of type U.
   * @returns An Option containing the function's return value if the original Option is Some, otherwise None.
   *
   * #### Examples
   *
   * ```ts
   * const length = Some("hello").map(s => s.length); // Some(5)
   * const noneLength = None.map(s => s.length); // None
   * ```
   */
  map<U extends NonUndefined>(fn: (val: T) => U): Option<U>;

  inspect(fn: (val: T) => void): Option<T>;

  /**
   * Transforms the Option into another by applying a function to the contained value,
   * chaining multiple potentially failing operations.
   *
   * @param fn A function that takes a value of type T and returns an Option of type U.
   * @returns The Option returned by the function if the original Option is Some, otherwise None.
   *
   * #### Examples
   *
   * ```ts
   * const parse = (s: string) => {
   *   const parsed = parseInt(s);
   *   return isNaN(parsed) ? None : Some(parsed);
   * };
   * const result = Some("123").andThen(parse); // Some(123)
   * const noResult = Some("abc").andThen(parse); // None
   * ```
   */
  andThen<U extends NonUndefined>(fn: (val: T) => Option<U>): Option<U>;

  /**
   * Returns this Option if it is Some, otherwise returns the option provided as a parameter.
   *
   * @param optb The alternative Option to return if the original Option is None.
   * @returns The original Option if it is Some, otherwise `optb`.
   *
   * #### Examples
   *
   * ```ts
   * const defaultOption = Some("default");
   * const someOption = Some("some").or(defaultOption); // Some("some")
   * const noneOption = None.or(defaultOption); // Some("default")
   * ```
   */
  or(optb: Option<T>): Option<T>;

  orElse(optb: () => Option<T>): Option<T>;

  /**
   * Returns the option provided as a parameter if the original Option is Some, otherwise returns None.
   *
   * @param optb The Option to return if the original Option is Some.
   * @returns `optb` if the original Option is Some, otherwise None.
   *
   * #### Examples
   *
   * ```ts
   * const anotherOption = Some("another");
   * const someOption = Some("some").and(anotherOption); // Some("another")
   * const noneOption = None.and(anotherOption); // None
   * ```
   */
  and<U extends NonUndefined>(optb: Option<U>): Option<U>;

  /**
   * Returns the contained value if Some, otherwise returns the provided default value.
   *
   * @param def The default value to return if the Option is None.
   * @returns The contained value if Some, otherwise `def`.
   *
   * #### Examples
   *
   * ```ts
   * const someValue = Some("value").unwrapOr("default"); // "value"
   * const noneValue = None.unwrapOr("default"); // "default"
   * ```
   */
  unwrapOr(def: T): T;

  /**
   * Unwraps an Option, yielding the contained value if Some, otherwise throws an error.
   *
   * @returns The contained value.
   * @throws Error if the Option is None.
   *
   * #### Examples
   *
   * ```ts
   * console.log(Some("value").unwrap()); // "value"
   * console.log(None.unwrap()); // throws Error
   * ```
   */
  unwrap(): T | never;
}

/**
 * Implementation of Option representing a value (Some).
 */
interface SomeOption<T extends NonUndefined> extends Option<T> {
  unwrap(): T;
}

/**
 * Implementation of Option representing the absence of a value (None).
 */
interface NoneOption<T extends NonUndefined> extends Option<T> {
  unwrap(): never;
}

/**
 * Represents a Some value of Option.
 */
class SomeImpl<T extends NonUndefined> implements SomeOption<T> {
  constructor(private readonly val: T) {}

  get type() {
    return OptionType.Some;
  }

  isSome() {
    return true;
  }

  isNone() {
    return false;
  }

  match<B>(fn: Match<T, B>): B {
    return fn.some(this.val);
  }

  map<U extends NonUndefined>(fn: (val: T) => U): Option<U> {
    return Some(fn(this.val));
  }

  inspect(fn: (val: T) => void): Option<T> {
    fn(this.val);
    return this;
  }

  andThen<U extends NonUndefined>(fn: (val: T) => Option<U>): Option<U> {
    return fn(this.val);
  }

  or<U extends NonUndefined>(_optb: Option<U>): Option<T> {
    return this;
  }

  orElse(optb: () => Option<T>): Option<T> {
    return this;
  }

  and<U extends NonUndefined>(optb: Option<U>): Option<U> {
    return optb;
  }

  unwrapOr(_def: T): T {
    return this.val;
  }

  unwrap(): T {
    return this.val;
  }
}

/**
 * Represents a None value of Option.
 */
class NoneImpl<T extends NonUndefined> implements NoneOption<T> {
  get type() {
    return OptionType.None;
  }

  isSome() {
    return false;
  }

  isNone() {
    return true;
  }

  match<U>({ none }: Match<T, U>): U {
    if (typeof none === 'function') {
      return (none as () => U)();
    }

    return none;
  }

  map<U extends NonUndefined>(_fn: (val: T) => U): Option<U> {
    return new NoneImpl<U>();
  }

  inspect(fn: (val: T) => void): Option<T> {
    return this;
  }

  andThen<U extends NonUndefined>(_fn: (val: T) => Option<U>): Option<U> {
    return new NoneImpl<U>();
  }

  or<U extends NonUndefined>(optb: Option<U>): Option<U> {
    return optb;
  }

  orElse(optb: () => Option<T>): Option<T> {
    return optb();
  }

  and<U extends NonUndefined>(_optb: Option<U>): Option<U> {
    return new NoneImpl<U>();
  }

  unwrapOr(def: T): T {
    return def;
  }

  unwrap(): never {
    throw new ReferenceError('Trying to unwrap None.');
  }
}

/**
 * Creates a Some instance of Option containing the given value.
 * This function is used to represent the presence of a value in an operation that may not always produce a value.
 *
 * @param val The value to be wrapped in a Some Option.
 * @returns An Option instance representing the presence of a value.
 *
 * #### Example
 *
 * ```ts
 * const option = Some(42);
 * console.log(option.unwrap()); // Outputs: 42
 * ```
 */
export function Some<T extends NonUndefined>(val: T): Option<T> {
  return new SomeImpl(val);
}

/**
 * The singleton instance representing None, an Option with no value.
 * This constant is used to represent the absence of a value in operations that may not always produce a value.
 *
 * #### Example
 *
 * ```ts
 * const option = None;
 * console.log(option.isNone()); // Outputs: true
 * ```
 */
export const None: Option<any> = new NoneImpl(); // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Type guard to check if an Option is a Some value.
 * This function is used to narrow down the type of an Option to SomeOption in TypeScript's type system.
 *
 * @param val The Option to be checked.
 * @returns true if the provided Option is a SomeOption, false otherwise.
 *
 * #### Example
 *
 * ```ts
 * const option = Some('Success');
 * if (isSome(option)) {
 *   console.log('Option has a value:', option.unwrap());
 * }
 * ```
 */
export function isSome<T extends NonUndefined>(val: Option<T>): val is SomeOption<T> {
  return val.isSome();
}

/**
 * Type guard to check if an Option is a None value.
 * This function is used to narrow down the type of an Option to NoneOption in TypeScript's type system.
 *
 * @param val The Option to be checked.
 * @returns true if the provided Option is a NoneOption, false otherwise.
 *
 * #### Example
 *
 * ```ts
 * const option = None;
 * if (isNone(option)) {
 *   console.log('Option does not have a value.');
 * }
 * ```
 */
export function isNone<T extends NonUndefined>(val: Option<T>): val is NoneOption<T> {
  return val.isNone();
}
