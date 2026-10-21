import { hash as sha256 } from '@app/shared/sha256';
import { ripemd160 } from '@app/shared/ripemd160';
import { hexStringToUint8Array, uint8ArrayToHexString, isDERSig, parseTaproot } from '@app/shared/transaction.utils';
import { isPoint } from '@app/shared/script.utils';
import { Vin } from '@interfaces/electrs.interface';

export type ScriptSection = 'scriptsig' | 'scriptpubkey' | 'witness' | 'redeemscript' | 'witnessscript' | 'tapscript' | 'template';
export type OpCategory = 'push' | 'stack' | 'arith' | 'compare' | 'crypto' | 'flow' | 'locktime' | 'disabled' | 'invalid';

export interface ScriptOp {
  code: number | null; // null for witness items, which have no opcode byte
  name: string;
  data?: string;
  section: ScriptSection;
  inner?: ScriptSection; // nested box inside a template: where the hash comes from
  label?: string;
  error?: string;
}

export interface ScriptProgram {
  ops: ScriptOp[];
  tapscript: boolean;
  tooLarge?: boolean; // known to be over the budget before it was built (see withinBudget)
}

export interface OpContext {
  stack: string[];
  alt: string[];
  exec: boolean[];
  op: ScriptOp;
  executing: boolean;
  tapscript: boolean;
}

export interface OpcodeDef {
  name: string;
  category: OpCategory;
  description: string;
  reads: number | ((stack: string[]) => number);
  flow?: boolean; // IF/NOTIF/ELSE/ENDIF also run inside a branch that isn't executed
  run?: (ctx: OpContext) => void;
}

export class ScriptError extends Error {}

const errors = {
  underflow: $localize`:@@script-debugger.error.underflow:Not enough items on the stack`,
  altUnderflow: $localize`:@@script-debugger.error.alt-underflow:The alt stack is empty`,
  verify: $localize`:@@script-debugger.error.verify:Verification failed`,
  opReturn: $localize`:@@script-debugger.error.op-return:OP_RETURN makes the script fail`,
  unbalanced: $localize`:@@script-debugger.error.unbalanced:Unbalanced conditional`,
  disabled: $localize`:@@script-debugger.error.disabled:Disabled opcode`,
  invalid: $localize`:@@script-debugger.error.invalid:Invalid opcode`,
  unsupported: $localize`:@@script-debugger.error.unsupported:Unsupported opcode`,
  truncated: $localize`:@@script-debugger.error.truncated:Push goes past the end of the script`,
  tapscriptOnly: $localize`:@@script-debugger.error.tapscript-only:Only valid in tapscript`,
  notInTapscript: $localize`:@@script-debugger.error.not-in-tapscript:Not allowed in tapscript`,
  stackLimit: $localize`:@@script-debugger.error.stack-limit:More than 1000 items on the stacks`,
  endFalse: $localize`:@@script-debugger.error.end-false:The script did not end with a single true item`,
};

const MAX_STACK = 1000;

export function decodeNum(hex: string): number {
  const bytes = hexStringToUint8Array(hex);
  if (!bytes.length) {
    return 0;
  }
  let value = 0;
  for (let i = bytes.length - 1; i >= 0; i--) {
    value = value * 256 + (i === bytes.length - 1 ? bytes[i] & 0x7f : bytes[i]);
  }
  return bytes[bytes.length - 1] & 0x80 ? -value : value;
}

export function encodeNum(n: number): string {
  const bytes: number[] = [];
  let abs = Math.abs(n);
  while (abs > 0) {
    bytes.push(abs % 256);
    abs = Math.floor(abs / 256);
  }
  if (bytes.length && bytes[bytes.length - 1] & 0x80) {
    bytes.push(n < 0 ? 0x80 : 0x00);
  } else if (n < 0) {
    bytes[bytes.length - 1] |= 0x80;
  }
  return uint8ArrayToHexString(new Uint8Array(bytes));
}

export function castToBool(hex: string): boolean {
  const bytes = hexStringToUint8Array(hex);
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) {
      return !(i === bytes.length - 1 && bytes[i] === 0x80); // negative zero
    }
  }
  return false;
}

const TRUE = '01';
const FALSE = '';

function popN(stack: string[], n: number): string[] {
  if (stack.length < n) {
    throw new ScriptError(errors.underflow);
  }
  return stack.splice(stack.length - n, n);
}

function pop(stack: string[]): string {
  return popN(stack, 1)[0];
}

function peek(stack: string[], depth = 0): string {
  if (stack.length <= depth) {
    throw new ScriptError(errors.underflow);
  }
  return stack[stack.length - 1 - depth];
}

function hashHex(fn: (data: Uint8Array) => Uint8Array, hex: string): string {
  return uint8ArrayToHexString(fn(hexStringToUint8Array(hex)));
}

function verify(value: string): void {
  if (!castToBool(value)) {
    throw new ScriptError(errors.verify);
  }
}

// shortcut: signatures aren't checked, a non-empty one counts as valid (the tooltip says so). Exact for tapscript and
// standard spends (NULLFAIL); a mined non-standard legacy / v0 spend that relies on a failing non-empty signature
// shows the wrong path. Upgrade by verifying signatures (sighash + secp256k1) if those spends matter
function sigResult(sig: string): string {
  return sig !== '' ? TRUE : FALSE;
}

function multisig({ stack, tapscript }: OpContext): string {
  if (tapscript) {
    throw new ScriptError(errors.notInTapscript);
  }
  const n = decodeNum(pop(stack));
  popN(stack, n);
  const m = decodeNum(pop(stack));
  const sigs = popN(stack, m);
  pop(stack); // extra item consumed by a historical off-by-one bug
  return sigs.every(sig => sig !== '') ? TRUE : FALSE;
}

function multisigReads(stack: string[]): number {
  const n = decodeNum(peek(stack));
  const m = decodeNum(peek(stack, n + 1));
  return n + m + 3;
}

type OpRun = (ctx: OpContext) => void;

const unary = (fn: (a: number) => number): OpRun => ({ stack }) => {
  stack.push(encodeNum(fn(decodeNum(pop(stack)))));
};

const binary = (fn: (a: number, b: number) => number): OpRun => ({ stack }) => {
  const [a, b] = popN(stack, 2).map(decodeNum);
  stack.push(encodeNum(fn(a, b)));
};

const andVerify = (run: OpRun): OpRun => (ctx) => {
  run(ctx);
  verify(pop(ctx.stack));
};

const pushData: OpRun = ({ stack, op }) => {
  stack.push(op.data);
};

const pushNum = (n: number): OpRun => ({ stack }) => {
  stack.push(encodeNum(n));
};

const nothing: OpRun = () => undefined;

const equal: OpRun = ({ stack }) => {
  const [a, b] = popN(stack, 2);
  stack.push(a === b ? TRUE : FALSE);
};

const checksig: OpRun = ({ stack }) => {
  const [sig] = popN(stack, 2);
  stack.push(sigResult(sig));
};

const describe = {
  pushbytes: (n: number): string => $localize`:@@script-debugger.op.pushbytes:Pushes the next ${n}:count: bytes onto the stack`,
  pushdata: $localize`:@@script-debugger.op.pushdata:Pushes data onto the stack, with its length given in the next bytes`,
  pushnum: (n: number): string => $localize`:@@script-debugger.op.pushnum:Pushes the number ${n}:number: onto the stack`,
  nop: $localize`:@@script-debugger.op.nop:Does nothing`,
  disabled: $localize`:@@script-debugger.op.disabled:Disabled opcode. A script that contains it is invalid, except in tapscript where it makes the script succeed`,
  invalid: $localize`:@@script-debugger.op.invalid:Invalid opcode. The script fails if it is executed, except in tapscript where it makes the script succeed`,
};

export const OPCODES: Record<number, OpcodeDef> = {
  0x00: { name: 'OP_0', category: 'push', reads: 0, run: pushData,
    description: $localize`:@@script-debugger.op.0:Pushes an empty item (zero, false) onto the stack` },
  0x4c: { name: 'OP_PUSHDATA1', category: 'push', reads: 0, run: pushData, description: describe.pushdata },
  0x4d: { name: 'OP_PUSHDATA2', category: 'push', reads: 0, run: pushData, description: describe.pushdata },
  0x4e: { name: 'OP_PUSHDATA4', category: 'push', reads: 0, run: pushData, description: describe.pushdata },
  0x4f: { name: 'OP_PUSHNUM_NEG1', category: 'push', reads: 0, run: pushNum(-1), description: describe.pushnum(-1) },
  0x50: { name: 'OP_RESERVED', category: 'invalid', reads: 0, description: describe.invalid },
  0x61: { name: 'OP_NOP', category: 'flow', reads: 0, run: nothing, description: describe.nop },
  0x62: { name: 'OP_VER', category: 'invalid', reads: 0, description: describe.invalid },
  0x63: { name: 'OP_IF', category: 'flow', reads: 1, flow: true,
    description: $localize`:@@script-debugger.op.if:Pops the top item. If it is false, the following opcodes are read but not executed until ELSE or ENDIF`,
    run: ({ stack, exec, executing }) => { exec.push(executing ? castToBool(pop(stack)) : false); } },
  0x64: { name: 'OP_NOTIF', category: 'flow', reads: 1, flow: true,
    description: $localize`:@@script-debugger.op.notif:Pops the top item. If it is true, the following opcodes are read but not executed until ELSE or ENDIF`,
    run: ({ stack, exec, executing }) => { exec.push(executing ? !castToBool(pop(stack)) : false); } },
  0x65: { name: 'OP_VERIF', category: 'disabled', reads: 0, description: describe.disabled },
  0x66: { name: 'OP_VERNOTIF', category: 'disabled', reads: 0, description: describe.disabled },
  0x67: { name: 'OP_ELSE', category: 'flow', reads: 0, flow: true,
    description: $localize`:@@script-debugger.op.else:Switches between executing and not executing the opcodes until ENDIF`,
    run: ({ exec }) => {
      if (!exec.length) {
        throw new ScriptError(errors.unbalanced);
      }
      exec[exec.length - 1] = !exec[exec.length - 1];
    } },
  0x68: { name: 'OP_ENDIF', category: 'flow', reads: 0, flow: true,
    description: $localize`:@@script-debugger.op.endif:Ends an IF / ELSE block`,
    run: ({ exec }) => {
      if (!exec.length) {
        throw new ScriptError(errors.unbalanced);
      }
      exec.pop();
    } },
  0x69: { name: 'OP_VERIFY', category: 'compare', reads: 1,
    description: $localize`:@@script-debugger.op.verify:Pops the top item. The transaction is invalid if it is false`,
    run: ({ stack }) => verify(pop(stack)) },
  0x6a: { name: 'OP_RETURN', category: 'flow', reads: 0,
    description: $localize`:@@script-debugger.op.return:Makes the script fail immediately`,
    run: () => { throw new ScriptError(errors.opReturn); } },

  0x6b: { name: 'OP_TOALTSTACK', category: 'stack', reads: 1,
    description: $localize`:@@script-debugger.op.toaltstack:Moves the top item onto the alt stack`,
    run: ({ stack, alt }) => { alt.push(pop(stack)); } },
  0x6c: { name: 'OP_FROMALTSTACK', category: 'stack', reads: 0,
    description: $localize`:@@script-debugger.op.fromaltstack:Moves the top item of the alt stack back onto the stack`,
    run: ({ stack, alt }) => {
      if (!alt.length) {
        throw new ScriptError(errors.altUnderflow);
      }
      stack.push(alt.pop());
    } },
  0x6d: { name: 'OP_2DROP', category: 'stack', reads: 2,
    description: $localize`:@@script-debugger.op.2drop:Removes the top two items`,
    run: ({ stack }) => { popN(stack, 2); } },
  0x6e: { name: 'OP_2DUP', category: 'stack', reads: 2,
    description: $localize`:@@script-debugger.op.2dup:Duplicates the top two items`,
    run: ({ stack }) => { stack.push(peek(stack, 1), peek(stack, 0)); } }, // arguments are read before anything is pushed
  0x6f: { name: 'OP_3DUP', category: 'stack', reads: 3,
    description: $localize`:@@script-debugger.op.3dup:Duplicates the top three items`,
    run: ({ stack }) => { stack.push(peek(stack, 2), peek(stack, 1), peek(stack, 0)); } },
  0x70: { name: 'OP_2OVER', category: 'stack', reads: 4,
    description: $localize`:@@script-debugger.op.2over:Copies the third and fourth items to the top`,
    run: ({ stack }) => { stack.push(peek(stack, 3), peek(stack, 2)); } },
  0x71: { name: 'OP_2ROT', category: 'stack', reads: 6,
    description: $localize`:@@script-debugger.op.2rot:Moves the fifth and sixth items to the top`,
    run: ({ stack }) => { const items = popN(stack, 6); stack.push(...items.slice(2), ...items.slice(0, 2)); } },
  0x72: { name: 'OP_2SWAP', category: 'stack', reads: 4,
    description: $localize`:@@script-debugger.op.2swap:Swaps the top two pairs of items`,
    run: ({ stack }) => { const items = popN(stack, 4); stack.push(...items.slice(2), ...items.slice(0, 2)); } },
  0x73: { name: 'OP_IFDUP', category: 'stack', reads: 1,
    description: $localize`:@@script-debugger.op.ifdup:Duplicates the top item if it is not zero`,
    run: ({ stack }) => { if (castToBool(peek(stack))) { stack.push(peek(stack)); } } },
  0x74: { name: 'OP_DEPTH', category: 'stack', reads: 0,
    description: $localize`:@@script-debugger.op.depth:Pushes the number of items on the stack`,
    run: ({ stack }) => { stack.push(encodeNum(stack.length)); } },
  0x75: { name: 'OP_DROP', category: 'stack', reads: 1,
    description: $localize`:@@script-debugger.op.drop:Removes the top item`,
    run: ({ stack }) => { pop(stack); } },
  0x76: { name: 'OP_DUP', category: 'stack', reads: 1,
    description: $localize`:@@script-debugger.op.dup:Duplicates the item on top of the stack`,
    run: ({ stack }) => { stack.push(peek(stack)); } },
  0x77: { name: 'OP_NIP', category: 'stack', reads: 2,
    description: $localize`:@@script-debugger.op.nip:Removes the second item from the top`,
    run: ({ stack }) => { const [, b] = popN(stack, 2); stack.push(b); } },
  0x78: { name: 'OP_OVER', category: 'stack', reads: 2,
    description: $localize`:@@script-debugger.op.over:Copies the second item to the top`,
    run: ({ stack }) => { stack.push(peek(stack, 1)); } },
  0x79: { name: 'OP_PICK', category: 'stack', reads: stack => decodeNum(peek(stack)) + 2,
    description: $localize`:@@script-debugger.op.pick:Pops a number n, then copies the item n places down to the top`,
    run: ({ stack }) => { const n = decodeNum(pop(stack)); stack.push(peek(stack, n)); } },
  0x7a: { name: 'OP_ROLL', category: 'stack', reads: stack => decodeNum(peek(stack)) + 2,
    description: $localize`:@@script-debugger.op.roll:Pops a number n, then moves the item n places down to the top`,
    run: ({ stack }) => { const n = decodeNum(pop(stack)); peek(stack, n); stack.push(...stack.splice(stack.length - 1 - n, 1)); } },
  0x7b: { name: 'OP_ROT', category: 'stack', reads: 3,
    description: $localize`:@@script-debugger.op.rot:Moves the third item to the top`,
    run: ({ stack }) => { const [a, b, c] = popN(stack, 3); stack.push(b, c, a); } },
  0x7c: { name: 'OP_SWAP', category: 'stack', reads: 2,
    description: $localize`:@@script-debugger.op.swap:Swaps the top two items`,
    run: ({ stack }) => { const [a, b] = popN(stack, 2); stack.push(b, a); } },
  0x7d: { name: 'OP_TUCK', category: 'stack', reads: 2,
    description: $localize`:@@script-debugger.op.tuck:Copies the top item below the second item`,
    run: ({ stack }) => { const [a, b] = popN(stack, 2); stack.push(b, a, b); } },

  0x7e: { name: 'OP_CAT', category: 'disabled', reads: 0, description: describe.disabled },
  0x7f: { name: 'OP_SUBSTR', category: 'disabled', reads: 0, description: describe.disabled },
  0x80: { name: 'OP_LEFT', category: 'disabled', reads: 0, description: describe.disabled },
  0x81: { name: 'OP_RIGHT', category: 'disabled', reads: 0, description: describe.disabled },
  0x82: { name: 'OP_SIZE', category: 'stack', reads: 1,
    description: $localize`:@@script-debugger.op.size:Pushes the size in bytes of the top item`,
    run: ({ stack }) => { stack.push(encodeNum(peek(stack).length / 2)); } },
  0x83: { name: 'OP_INVERT', category: 'disabled', reads: 0, description: describe.disabled },
  0x84: { name: 'OP_AND', category: 'disabled', reads: 0, description: describe.disabled },
  0x85: { name: 'OP_OR', category: 'disabled', reads: 0, description: describe.disabled },
  0x86: { name: 'OP_XOR', category: 'disabled', reads: 0, description: describe.disabled },
  0x87: { name: 'OP_EQUAL', category: 'compare', reads: 2, run: equal,
    description: $localize`:@@script-debugger.op.equal:Pops the top two items and pushes true if they are equal, false otherwise` },
  0x88: { name: 'OP_EQUALVERIFY', category: 'compare', reads: 2, run: andVerify(equal),
    description: $localize`:@@script-debugger.op.equalverify:Pops the top two items and checks they are equal. The transaction is invalid if they are not` },
  0x89: { name: 'OP_RESERVED1', category: 'invalid', reads: 0, description: describe.invalid },
  0x8a: { name: 'OP_RESERVED2', category: 'invalid', reads: 0, description: describe.invalid },

  0x8b: { name: 'OP_1ADD', category: 'arith', reads: 1, run: unary(a => a + 1),
    description: $localize`:@@script-debugger.op.1add:Adds 1 to the top item` },
  0x8c: { name: 'OP_1SUB', category: 'arith', reads: 1, run: unary(a => a - 1),
    description: $localize`:@@script-debugger.op.1sub:Subtracts 1 from the top item` },
  0x8d: { name: 'OP_2MUL', category: 'disabled', reads: 0, description: describe.disabled },
  0x8e: { name: 'OP_2DIV', category: 'disabled', reads: 0, description: describe.disabled },
  0x8f: { name: 'OP_NEGATE', category: 'arith', reads: 1, run: unary(a => -a),
    description: $localize`:@@script-debugger.op.negate:Flips the sign of the top item` },
  0x90: { name: 'OP_ABS', category: 'arith', reads: 1, run: unary(Math.abs),
    description: $localize`:@@script-debugger.op.abs:Makes the top item positive` },
  0x91: { name: 'OP_NOT', category: 'arith', reads: 1, run: unary(a => a === 0 ? 1 : 0),
    description: $localize`:@@script-debugger.op.not:Turns 0 into 1, and any other number into 0` },
  0x92: { name: 'OP_0NOTEQUAL', category: 'arith', reads: 1, run: unary(a => a !== 0 ? 1 : 0),
    description: $localize`:@@script-debugger.op.0notequal:Turns 0 into 0, and any other number into 1` },
  0x93: { name: 'OP_ADD', category: 'arith', reads: 2, run: binary((a, b) => a + b),
    description: $localize`:@@script-debugger.op.add:Adds the top two items` },
  0x94: { name: 'OP_SUB', category: 'arith', reads: 2, run: binary((a, b) => a - b),
    description: $localize`:@@script-debugger.op.sub:Subtracts the top item from the second item` },
  0x95: { name: 'OP_MUL', category: 'disabled', reads: 0, description: describe.disabled },
  0x96: { name: 'OP_DIV', category: 'disabled', reads: 0, description: describe.disabled },
  0x97: { name: 'OP_MOD', category: 'disabled', reads: 0, description: describe.disabled },
  0x98: { name: 'OP_LSHIFT', category: 'disabled', reads: 0, description: describe.disabled },
  0x99: { name: 'OP_RSHIFT', category: 'disabled', reads: 0, description: describe.disabled },
  0x9a: { name: 'OP_BOOLAND', category: 'arith', reads: 2, run: binary((a, b) => a !== 0 && b !== 0 ? 1 : 0),
    description: $localize`:@@script-debugger.op.booland:Pushes 1 if both top items are not zero, 0 otherwise` },
  0x9b: { name: 'OP_BOOLOR', category: 'arith', reads: 2, run: binary((a, b) => a !== 0 || b !== 0 ? 1 : 0),
    description: $localize`:@@script-debugger.op.boolor:Pushes 1 if either top item is not zero, 0 otherwise` },
  0x9c: { name: 'OP_NUMEQUAL', category: 'compare', reads: 2, run: binary((a, b) => a === b ? 1 : 0),
    description: $localize`:@@script-debugger.op.numequal:Pushes 1 if the top two numbers are equal, 0 otherwise` },
  0x9d: { name: 'OP_NUMEQUALVERIFY', category: 'compare', reads: 2, run: andVerify(binary((a, b) => a === b ? 1 : 0)),
    description: $localize`:@@script-debugger.op.numequalverify:Checks the top two numbers are equal. The transaction is invalid if they are not` },
  0x9e: { name: 'OP_NUMNOTEQUAL', category: 'compare', reads: 2, run: binary((a, b) => a !== b ? 1 : 0),
    description: $localize`:@@script-debugger.op.numnotequal:Pushes 1 if the top two numbers are not equal, 0 otherwise` },
  0x9f: { name: 'OP_LESSTHAN', category: 'compare', reads: 2, run: binary((a, b) => a < b ? 1 : 0),
    description: $localize`:@@script-debugger.op.lessthan:Pushes 1 if the second item is less than the top item` },
  0xa0: { name: 'OP_GREATERTHAN', category: 'compare', reads: 2, run: binary((a, b) => a > b ? 1 : 0),
    description: $localize`:@@script-debugger.op.greaterthan:Pushes 1 if the second item is greater than the top item` },
  0xa1: { name: 'OP_LESSTHANOREQUAL', category: 'compare', reads: 2, run: binary((a, b) => a <= b ? 1 : 0),
    description: $localize`:@@script-debugger.op.lessthanorequal:Pushes 1 if the second item is less than or equal to the top item` },
  0xa2: { name: 'OP_GREATERTHANOREQUAL', category: 'compare', reads: 2, run: binary((a, b) => a >= b ? 1 : 0),
    description: $localize`:@@script-debugger.op.greaterthanorequal:Pushes 1 if the second item is greater than or equal to the top item` },
  0xa3: { name: 'OP_MIN', category: 'arith', reads: 2, run: binary(Math.min),
    description: $localize`:@@script-debugger.op.min:Keeps the smaller of the top two items` },
  0xa4: { name: 'OP_MAX', category: 'arith', reads: 2, run: binary(Math.max),
    description: $localize`:@@script-debugger.op.max:Keeps the larger of the top two items` },
  0xa5: { name: 'OP_WITHIN', category: 'compare', reads: 3,
    description: $localize`:@@script-debugger.op.within:Pushes 1 if the third item is between the second (included) and the top item (excluded)`,
    run: ({ stack }) => { const [x, min, max] = popN(stack, 3).map(decodeNum); stack.push(encodeNum(x >= min && x < max ? 1 : 0)); } },

  0xa6: { name: 'OP_RIPEMD160', category: 'crypto', reads: 1,
    description: $localize`:@@script-debugger.op.ripemd160:Replaces the top item with its RIPEMD-160 hash`,
    run: ({ stack }) => { stack.push(hashHex(ripemd160, pop(stack))); } },
  // shortcut: no SHA-1 implementation in the frontend, add one if SHA-1 puzzle scripts matter
  0xa7: { name: 'OP_SHA1', category: 'crypto', reads: 1,
    description: $localize`:@@script-debugger.op.sha1:Replaces the top item with its SHA-1 hash`,
    run: () => { throw new ScriptError(errors.unsupported); } },
  0xa8: { name: 'OP_SHA256', category: 'crypto', reads: 1,
    description: $localize`:@@script-debugger.op.sha256:Replaces the top item with its SHA-256 hash`,
    run: ({ stack }) => { stack.push(hashHex(sha256, pop(stack))); } },
  0xa9: { name: 'OP_HASH160', category: 'crypto', reads: 1,
    description: $localize`:@@script-debugger.op.hash160:Replaces the top item with its HASH160 (SHA-256, then RIPEMD-160)`,
    run: ({ stack }) => { stack.push(hashHex(data => ripemd160(sha256(data)), pop(stack))); } },
  0xaa: { name: 'OP_HASH256', category: 'crypto', reads: 1,
    description: $localize`:@@script-debugger.op.hash256:Replaces the top item with its double SHA-256 hash`,
    run: ({ stack }) => { stack.push(hashHex(data => sha256(sha256(data)), pop(stack))); } },
  0xab: { name: 'OP_CODESEPARATOR', category: 'crypto', reads: 0, run: nothing,
    description: $localize`:@@script-debugger.op.codeseparator:Marks where the signed part of the script starts` },
  0xac: { name: 'OP_CHECKSIG', category: 'crypto', reads: 2, run: checksig,
    description: $localize`:@@script-debugger.op.checksig:Pops a public key and a signature, and pushes true if the signature is valid for this transaction` },
  0xad: { name: 'OP_CHECKSIGVERIFY', category: 'crypto', reads: 2, run: andVerify(checksig),
    description: $localize`:@@script-debugger.op.checksigverify:Checks the signature against the public key. The transaction is invalid if it does not match` },
  0xae: { name: 'OP_CHECKMULTISIG', category: 'crypto', reads: multisigReads,
    description: $localize`:@@script-debugger.op.checkmultisig:Checks m signatures against n public keys, and pushes true if they all match`,
    run: ctx => { ctx.stack.push(multisig(ctx)); } },
  0xaf: { name: 'OP_CHECKMULTISIGVERIFY', category: 'crypto', reads: multisigReads,
    description: $localize`:@@script-debugger.op.checkmultisigverify:Checks m signatures against n public keys. The transaction is invalid if they do not all match`,
    run: ctx => verify(multisig(ctx)) },

  0xb1: { name: 'OP_CLTV', category: 'locktime', reads: 1, run: ({ stack }) => { peek(stack); },
    description: $localize`:@@script-debugger.op.cltv:Checks the transaction's locktime has reached the top item (a block height or time)` },
  0xb2: { name: 'OP_CSV', category: 'locktime', reads: 1, run: ({ stack }) => { peek(stack); },
    description: $localize`:@@script-debugger.op.csv:Checks the input has waited at least the top item (blocks or time) since its output was confirmed` },
  0xba: { name: 'OP_CHECKSIGADD', category: 'crypto', reads: 3,
    description: $localize`:@@script-debugger.op.checksigadd:Pops a public key, a number and a signature, and pushes the number plus 1 if the signature is valid`,
    run: ({ stack, tapscript }) => {
      if (!tapscript) {
        throw new ScriptError(errors.tapscriptOnly);
      }
      const [sig, n] = popN(stack, 3);
      stack.push(encodeNum(decodeNum(n) + (sigResult(sig) ? 1 : 0)));
    } },
  0xfd: { name: 'OP_PUBKEYHASH', category: 'invalid', reads: 0, description: describe.invalid },
  0xfe: { name: 'OP_PUBKEY', category: 'invalid', reads: 0, description: describe.invalid },
  0xff: { name: 'OP_INVALIDOPCODE', category: 'invalid', reads: 0, description: describe.invalid },
};

for (let n = 1; n <= 75; n++) {
  OPCODES[n] = { name: `OP_PUSHBYTES_${n}`, category: 'push', reads: 0, run: pushData, description: describe.pushbytes(n) };
}
for (let n = 1; n <= 16; n++) {
  OPCODES[0x50 + n] = { name: `OP_PUSHNUM_${n}`, category: 'push', reads: 0, run: pushNum(n), description: describe.pushnum(n) };
}
for (const n of [1, 4, 5, 6, 7, 8, 9, 10]) {
  OPCODES[0xaf + n] = { name: `OP_NOP${n}`, category: 'flow', reads: 0, run: nothing, description: describe.nop };
}
for (let code = 0xbb; code <= 0xfc; code++) {
  OPCODES[code] = { name: `OP_RETURN_${code}`, category: 'invalid', reads: 0, description: describe.invalid };
}

export function isOpSuccess(code: number): boolean {
  return code === 80 || code === 98 || (code >= 126 && code <= 129) || (code >= 131 && code <= 134)
    || code === 137 || code === 138 || code === 141 || code === 142 || (code >= 149 && code <= 153)
    || (code >= 187 && code <= 254);
}

// stops after MAX_OPS + 1 ops: a script that long is over the debugger's budget anyway (see withinBudget)
export function parseScript(hex: string, section: ScriptSection): ScriptOp[] {
  const buf = hexStringToUint8Array(hex);
  const ops: ScriptOp[] = [];
  let i = 0;
  while (i < buf.length && ops.length <= MAX_OPS) {
    const code = buf[i++];
    const op: ScriptOp = { code, name: OPCODES[code].name, section };
    if (code >= 0x01 && code <= 0x4e) {
      let length = code;
      if (code === 0x4c) {
        length = buf[i];
        i += 1;
      } else if (code === 0x4d) {
        length = buf[i] | (buf[i + 1] << 8);
        i += 2;
      } else if (code === 0x4e) {
        length = (buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16) | (buf[i + 3] << 24)) >>> 0;
        i += 4;
      }
      if (!(i + length <= buf.length)) { // also catches a missing PUSHDATA length (NaN)
        op.error = errors.truncated;
        ops.push(op);
        break;
      }
      op.data = uint8ArrayToHexString(buf.slice(i, i + length));
      i += length;
    } else if (code === 0x00) {
      op.data = '';
    }
    ops.push(op);
  }
  return ops;
}

export function witnessOp(data: string, section: ScriptSection = 'witness'): ScriptOp {
  return { code: null, name: '', data, section };
}

export const pushLabels = {
  signature: $localize`:@@script-debugger.label.signature:Signature`,
  publicKey: $localize`:@@script-debugger.label.public-key:Public key`,
  publicKeyHash: $localize`:@@script-debugger.label.public-key-hash:Public key hash`,
  scriptHash: $localize`:@@script-debugger.label.script-hash:Script hash`,
  redeemScript: $localize`:@@script-debugger.label.redeem-script:Redeem script`,
  hash: $localize`:@@script-debugger.label.hash:Hash`,
};

export const HASH_OPS = [0xa6, 0xa7, 0xa8, 0xa9, 0xaa]; // RIPEMD160, SHA1, SHA256, HASH160, HASH256

const SIG_OPS = [0xac, 0xad, 0xba]; // CHECKSIG, CHECKSIGVERIFY, CHECKSIGADD

function labelPushes(program: ScriptProgram): ScriptProgram {
  program.ops.forEach((op, i) => {
    const data = op.data;
    if (op.label || !data) {
      return;
    }
    if (isDERSig(data) || (program.tapscript && op.code === null && (data.length === 128 || data.length === 130))) {
      op.label = pushLabels.signature;
    } else if (((data.length === 66 || data.length === 130) && isPoint(data))
      || (program.tapscript && data.length === 64 && SIG_OPS.includes(program.ops[i + 1]?.code))) {
      op.label = pushLabels.publicKey;
    } else if (HASH_OPS.includes(program.ops[i - 1]?.code)) {
      op.label = pushLabels.hash; // the value a hash is compared against: HASH160 <h> EQUAL
    }
  });
  return program;
}

// witness program (0014<hash> / 0020<hash>) from a native scriptPubKey or a nested P2SH redeem script
function segwitOps(program: string, witness: string[], inner: ScriptSection): ScriptOp[] | null {
  if (/^0014[0-9a-f]{40}$/.test(program) && witness.length === 2) {
    const template = parseScript('76a914' + program.slice(4) + '88ac', 'template');
    template[2].inner = inner;
    template[2].label = pushLabels.publicKeyHash;
    return [...witness.map(item => witnessOp(item)), ...template];
  }
  if (/^0020[0-9a-f]{64}$/.test(program) && witness.length) {
    return [
      ...witness.slice(0, -1).map(item => witnessOp(item)),
      ...parseScript(witness[witness.length - 1], 'witnessscript'),
    ];
  }
  return null;
}

// Every step keeps a copy of the main and alt stacks, and an op grows them by at most 3 items (3DUP). Script ops keep
// them within MAX_STACK, but witness items don't count towards it until the script runs (and tapscript OP_SUCCESS
// skips even that), so each step holds at most min(3n, max(MAX_STACK, witness items)) entries. Programs over this
// budget aren't run (the debugger says it's too large), so a giant script (e.g. hundreds of thousands of NOPs, or
// thousands of witness items before an OP_SUCCESS) can't exhaust the browser's memory. The largest real ones seen
// (BitVM-style, ~8,900 ops) fit.
const MAX_SNAPSHOT_ENTRIES = 10_000_000;
// past this many ops the budget always fails, so parsing stops there instead of building a huge program first
const MAX_OPS = MAX_SNAPSHOT_ENTRIES / MAX_STACK;

export function withinBudget(program: ScriptProgram): boolean {
  const n = program.ops.length;
  const witnessItems = program.ops.filter(op => op.section === 'witness').length;
  return !program.tooLarge && n <= MAX_OPS && n * Math.min(3 * n, Math.max(MAX_STACK, witnessItems)) <= MAX_SNAPSHOT_ENTRIES;
}

export function buildProgram(vin: Vin): ScriptProgram | null {
  const prevout = vin.prevout;
  if (vin.is_coinbase || vin.is_pegin || !prevout) {
    return null;
  }
  const witness = vin.witness || [];
  // each witness item is a step too: that many is over budget, so don't build them
  if (witness.length > MAX_OPS) {
    return { ops: [], tapscript: false, tooLarge: true };
  }
  const scriptsig = parseScript(vin.scriptsig || '', 'scriptsig');
  const spk = parseScript(prevout.scriptpubkey, 'scriptpubkey');
  switch (prevout.scriptpubkey_type) {
    case 'p2pk':
    case 'multisig':
      return labelPushes({ ops: [...scriptsig, ...spk], tapscript: false });
    case 'p2pkh':
      spk[2].label = pushLabels.publicKeyHash;
      return labelPushes({ ops: [...scriptsig, ...spk], tapscript: false });
    case 'p2sh': {
      const redeem = scriptsig[scriptsig.length - 1];
      if (redeem?.data === undefined) {
        return null;
      }
      redeem.label = pushLabels.redeemScript;
      spk[1].label = pushLabels.scriptHash;
      const rest = witness.length ? segwitOps(redeem.data, witness, 'redeemscript') : parseScript(redeem.data, 'redeemscript');
      return rest && labelPushes({ ops: [...scriptsig, ...spk, ...rest], tapscript: false });
    }
    case 'v0_p2wpkh':
    case 'v0_p2wsh': {
      const ops = segwitOps(prevout.scriptpubkey, witness, 'scriptpubkey');
      return ops && labelPushes({ ops, tapscript: false });
    }
    case 'v1_p2tr': {
      const taproot = vin.taprootInfo ?? parseTaproot(witness);
      if (taproot?.scriptPath?.leafVersion !== 0xc0) {
        return null;
      }
      return labelPushes({
        ops: [...taproot.stack.map(item => witnessOp(item)), ...parseScript(taproot.scriptPath.script, 'tapscript')],
        tapscript: true,
      });
    }
  }
  return null;
}

export function isDebuggable(vin: Vin): boolean {
  return buildProgram(vin) !== null;
}

// a P2SH or nested segwit handover: the script after ScriptPubKey runs on a new stack.
// Nested P2SH-P2WSH with no witness arguments goes from ScriptPubKey straight to the witness script
export function isHandover(prev: ScriptSection | undefined, section: ScriptSection): boolean {
  return prev === 'scriptpubkey' && (section === 'redeemscript' || section === 'witness' || section === 'witnessscript');
}

export interface Step {
  opIndex: number | null; // null for steps that aren't a block: the BIP16 handover / nested segwit reset, and the final step
  stack: string[]; // stack and alt are copies taken before the step
  alt: string[];
  reads: number; // top items about to be used (white stroke)
  pushes: string[]; // items about to be added (faded)
  altReads: number;
  altPushes: string[];
  notExecuted?: boolean;
  error?: string;
  result?: 'valid' | 'invalid';
  opSuccess?: boolean;
}

// how many top items an op reads; if the stack is too short to tell, let the op itself report why it fails
function readsOf(def: OpcodeDef, stack: string[]): number {
  if (typeof def.reads === 'number') {
    return def.reads;
  }
  try {
    return def.reads(stack);
  } catch {
    return stack.length;
  }
}

function commonPrefix(a: string[], b: string[]): number {
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) {
    k++;
  }
  return k;
}

export class ScriptVM {
  run({ ops, tapscript }: ScriptProgram): Step[] {
    const steps: Step[] = [];
    let stack: string[] = [];
    let alt: string[] = [];
    const exec: boolean[] = [];
    let afterScriptSig: string[] = [];
    const opSuccessAt = tapscript ? ops.findIndex(op => op.code !== null && isOpSuccess(op.code)) : -1;

    const snapshot = (opIndex: number | null): Step => ({
      opIndex, stack: [...stack], alt: [...alt], reads: 0, pushes: [], altReads: 0, altPushes: [],
    });
    const diff = (step: Step): void => {
      const k = commonPrefix(step.stack, stack);
      step.reads = Math.max(step.reads, step.stack.length - k);
      step.pushes = stack.slice(k);
      const ka = commonPrefix(step.alt, alt);
      step.altReads = step.alt.length - ka;
      step.altPushes = alt.slice(ka);
    };
    const end = (valid: boolean, error?: string): Step[] => {
      steps.push({ ...snapshot(null), result: valid ? 'valid' : 'invalid', error });
      return steps;
    };

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const prev = ops[i - 1]?.section;
      if (op.section !== prev) {
        if (exec.length) {
          return end(false, errors.unbalanced);
        }
        if (prev === 'scriptsig') {
          afterScriptSig = [...stack];
        }
        if (isHandover(prev, op.section)) {
          if (!stack.length || !castToBool(stack[stack.length - 1])) {
            return end(false, errors.endFalse);
          }
          // BIP16: rerun from the stack left by scriptSig, minus the redeem script; nested segwit starts from the witness instead
          const handover = snapshot(null);
          stack = op.section === 'redeemscript' ? afterScriptSig.slice(0, -1) : [];
          diff(handover);
          steps.push(handover);
        }
        alt = []; // one alt stack per script run
        if (op.section === 'tapscript' && opSuccessAt !== -1) {
          steps.push({ ...snapshot(opSuccessAt), result: 'valid', opSuccess: true });
          return steps;
        }
      }

      const step = snapshot(i);
      steps.push(step);
      try {
        if (op.error) {
          throw new ScriptError(op.error);
        }
        if (op.code === null) {
          stack.push(op.data);
        } else {
          const def = OPCODES[op.code];
          const executing = exec.every(Boolean);
          if (def.category === 'disabled') {
            throw new ScriptError(errors.disabled);
          }
          if (executing || def.flow) {
            if (!def.run) {
              throw new ScriptError(errors.invalid);
            }
            if (executing) {
              step.reads = readsOf(def, stack);
            }
            // a nested IF / ELSE / ENDIF inside a branch that's already off only tracks nesting: show it as not executed
            const outer = op.code === 0x67 || op.code === 0x68 ? exec.slice(0, -1) : exec;
            if (def.flow && !outer.every(Boolean)) {
              step.notExecuted = true;
            }
            def.run({ stack, alt, exec, op, executing, tapscript });
          } else {
            step.notExecuted = true;
          }
          if (stack.length + alt.length > MAX_STACK) {
            throw new ScriptError(errors.stackLimit);
          }
        }
      } catch (e) {
        if (!(e instanceof ScriptError)) {
          throw e;
        }
        step.error = e.message;
        step.result = 'invalid';
        return steps;
      }
      diff(step);
    }

    if (exec.length) {
      return end(false, errors.unbalanced);
    }
    // segwit and tapscript require exactly one item left (CLEANSTACK is consensus there)
    const witnessRun = ops.some(op => op.section === 'witness');
    const valid = witnessRun ? stack.length === 1 && castToBool(stack[0]) : stack.length > 0 && castToBool(stack[stack.length - 1]);
    return end(valid, valid ? undefined : errors.endFalse);
  }
}
