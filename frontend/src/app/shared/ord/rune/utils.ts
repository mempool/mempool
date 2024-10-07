type GrowToSize<T, N extends number, A extends T[]> = A['length'] extends N
  ? A
  : GrowToSize<T, N, [...A, T]>;

export type FixedArray<T, N extends number> = GrowToSize<T, N, []>;

