import { Transaction } from '@interfaces/electrs.interface';

export const U128_MAX_BIGINT = 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn;

export class RuneId {
  block: number;
  index: number;

  constructor(block: number, index: number) {
    this.block = block;
    this.index = index;
  }

  toString(): string {
    return `${this.block}:${this.index}`;
  }
}

export type Etching = {
  divisibility?: number;
  premine?: bigint;
  symbol?: string;
  terms?: {
    cap?: bigint;
    amount?: bigint;
    offset?: {
      start?: bigint;
      end?: bigint;
    };
    height?: {
      start?: bigint;
      end?: bigint;
    };
  };
  turbo?: boolean;
  name?: string;
  spacedName?: string;
  supply?: bigint;
};

export type Edict = {
  id: RuneId;
  amount: bigint;
  output: number;
};

export type Runestone = {
  mint?: RuneId;
  pointer?: number;
  edicts?: Edict[];
  etching?: Etching;
};

type Message = {
  fields: Record<number, bigint[]>;
  edicts: Edict[];
}

export const UNCOMMON_GOODS: Etching = {
  divisibility: 0,
  premine: 0n,
  symbol: '⧉',
  terms: {
    cap: U128_MAX_BIGINT,
    amount: 1n,
    offset: {
      start: 0n,
      end: 0n,
    },
    height: {
      start: 840000n,
      end: 1050000n,
    },
  },
  turbo: false,
  name: 'UNCOMMONGOODS',
  spacedName: 'UNCOMMON•GOODS',
  supply: U128_MAX_BIGINT,
};

enum Tag {
  Body = 0,
  Flags = 2,
  Rune = 4,
  Premine = 6,
  Cap = 8,
  Amount = 10,
  HeightStart = 12,
  HeightEnd = 14,
  OffsetStart = 16,
  OffsetEnd = 18,
  Mint = 20,
  Pointer = 22,
  Cenotaph = 126,

  Divisibility = 1,
  Spacers = 3,
  Symbol = 5,
  Nop = 127,
}

const Flag = {
  ETCHING: 1n,
  TERMS: 1n << 1n,
  TURBO: 1n << 2n,
  CENOTAPH: 1n << 127n,
};

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{2}/g).map((byte) => parseInt(byte, 16)));
}

function decodeLEB128(bytes: Uint8Array): bigint[] {
  const integers: bigint[] = [];
  let index = 0;
  while (index < bytes.length) {
    let value = BigInt(0);
    let shift = 0;
    let byte: number;
    do {
      byte = bytes[index++];
      value |= BigInt(byte & 0x7f) << BigInt(shift);
      shift += 7;
    } while (byte & 0x80);
    integers.push(value);
  }
  return integers;
}

function integersToMessage(integers: bigint[]): Message {
  const message = {
    fields: {},
    edicts: [],
  };
  let inBody = false;
  while (integers.length) {
    if (!inBody) {
      // The integers are interpreted as a sequence of tag/value pairs, with duplicate tags appending their value to the field value.
      const tag: Tag = Number(integers.shift());
      if (tag === Tag.Body) {
        inBody = true;
      } else {
        const value = integers.shift();
        if (message.fields[tag]) {
          message.fields[tag].push(value);
        } else {
          message.fields[tag] = [value];
        }
      }
    } else {
      // If a tag with value zero is encountered, all following integers are interpreted as a series of four-integer edicts, each consisting of a rune ID block height, rune ID transaction index, amount, and output.
      const height = integers.shift();
      const txIndex = integers.shift();
      const amount = integers.shift();
      const output = integers.shift();
      message.edicts.push({
        id: new RuneId(Number(height), Number(txIndex)),
        amount,
        output,
      });
    }
  }
  return message;
}

function parseRuneName(rune: bigint): string {
  let name = '';
  rune += 1n;
  while (rune > 0n) {
    name = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Number((rune - 1n) % 26n)] + name;
    rune = (rune - 1n) / 26n;
  }
  return name;
}

function spaceRuneName(name: string, spacers: bigint): string {
  let i = 0;
  let spacedName = '';
  while (spacers > 0n || i < name.length) {
    spacedName += name[i];
    if (spacers & 1n) {
      spacedName += '•';
    }
    if (spacers > 0n) {
      spacers >>= 1n;
    }
    i++;
  }
  return spacedName;
}

function messageToRunestone(message: Message): Runestone {
  let etching: Etching | undefined;
  let mint: RuneId | undefined;
  let pointer: number | undefined;

  const flags = message.fields[Tag.Flags]?.[0] || 0n;
  if (flags & Flag.ETCHING) {
    const hasTerms = (flags & Flag.TERMS) > 0n;
    const isTurbo = (flags & Flag.TURBO) > 0n;
    const name = parseRuneName(message.fields[Tag.Rune]?.[0] ?? 0n);
    etching = {
      divisibility: Number(message.fields[Tag.Divisibility]?.[0] ?? 0n),
      premine: message.fields[Tag.Premine]?.[0],
      symbol: message.fields[Tag.Symbol]?.[0] ? String.fromCodePoint(Number(message.fields[Tag.Symbol][0])) : '¤',
      terms: hasTerms ? {
        cap: message.fields[Tag.Cap]?.[0],
        amount: message.fields[Tag.Amount]?.[0],
        offset: {
          start: message.fields[Tag.OffsetStart]?.[0],
          end: message.fields[Tag.OffsetEnd]?.[0],
        },
        height: {
          start: message.fields[Tag.HeightStart]?.[0],
          end: message.fields[Tag.HeightEnd]?.[0],
        },
      } : undefined,
      turbo: isTurbo,
      name,
      spacedName: spaceRuneName(name, message.fields[Tag.Spacers]?.[0] ?? 0n),
    };
    etching.supply = (
      (etching.terms?.cap ?? 0n) * (etching.terms?.amount ?? 0n)
    ) + (etching.premine ?? 0n);
  }
  const mintField = message.fields[Tag.Mint];
  if (mintField) {
    mint = new RuneId(Number(mintField[0]), Number(mintField[1]));
  }
  const pointerField = message.fields[Tag.Pointer];
  if (pointerField) {
    pointer = Number(pointerField[0]);
  }
  return {
    mint,
    pointer,
    edicts: message.edicts,
    etching,
  };
}

export function decipherRunestone(tx: Transaction): Runestone | void {
  const payload = tx.vout.find((vout) => vout.scriptpubkey.startsWith('6a5d'))?.scriptpubkey_asm.replace(/OP_\w+|\s/g, '');
  if (!payload) {
    return;
  }
  try {
    const integers = decodeLEB128(hexToBytes(payload));
    const message = integersToMessage(integers);
    return messageToRunestone(message);
  } catch (error) {
    console.error(error);
    return;
  }
}
