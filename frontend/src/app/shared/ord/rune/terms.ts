import { Option } from './monads';
import { u128, u64 } from './integer';

export type Terms = {
  amount: Option<u128>;
  cap: Option<u128>;
  height: readonly [Option<u64>, Option<u64>];
  offset: readonly [Option<u64>, Option<u64>];
};
