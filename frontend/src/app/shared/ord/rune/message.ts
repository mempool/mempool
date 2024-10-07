import { Edict } from './edict';
import { Flaw } from './flaw';
import { u128, u64, u32 } from './integer';
import { RuneId } from './runeid';
import { Tag } from './tag';

export class Message {
  constructor(
    readonly flaws: Flaw[],
    readonly edicts: Edict[],
    readonly fields: Map<u128, u128[]>
  ) {}

  static fromIntegers(numOutputs: number, payload: u128[]): Message {
    const edicts: Edict[] = [];
    const fields = new Map<u128, u128[]>();
    const flaws: Flaw[] = [];

    for (const i of [...Array(Math.ceil(payload.length / 2)).keys()].map((n) => n * 2)) {
      const tag = payload[i];

      if (u128(Tag.BODY) === tag) {
        let id = new RuneId(u64(0), u32(0));
        const chunkSize = 4;

        const body = payload.slice(i + 1);
        for (let j = 0; j < body.length; j += chunkSize) {
          const chunk = body.slice(j, j + chunkSize);
          if (chunk.length !== chunkSize) {
            flaws.push(Flaw.TRAILING_INTEGERS);
            break;
          }

          const optionNext = id.next(chunk[0], chunk[1]);
          if (optionNext.isNone()) {
            flaws.push(Flaw.EDICT_RUNE_ID);
            break;
          }
          const next = optionNext.unwrap();

          const optionEdict = Edict.fromIntegers(numOutputs, next, chunk[2], chunk[3]);
          if (optionEdict.isNone()) {
            flaws.push(Flaw.EDICT_OUTPUT);
            break;
          }
          const edict = optionEdict.unwrap();

          id = next;
          edicts.push(edict);
        }
        break;
      }

      const value = payload[i + 1];
      if (value === undefined) {
        flaws.push(Flaw.TRUNCATED_FIELD);
        break;
      }

      const values = fields.get(tag) ?? [];
      values.push(value);
      fields.set(tag, values);
    }

    return new Message(flaws, edicts, fields);
  }
}
