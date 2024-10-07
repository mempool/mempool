import { Flaw } from './flaw';
import { None, Option } from './monads';
import { Rune } from './rune';
import { RuneId } from './runeid';

export class Cenotaph {
  readonly type = 'cenotaph';

  constructor(
    readonly flaws: Flaw[],
    readonly etching: Option<Rune> = None,
    readonly mint: Option<RuneId> = None
  ) {}
}
