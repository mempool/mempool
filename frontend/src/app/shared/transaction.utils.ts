import { TransactionFlags } from '@app/shared/filters.utils';
import { getVarIntLength, parseMultisigScript, isPoint } from '@app/shared/script.utils';
import { Transaction, Vin } from '@interfaces/electrs.interface';
import { CpfpInfo, RbfInfo, TransactionStripped } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { hash, Hash } from './sha256';
import { AddressType } from './address-utils';

// Bitcoin Core default policy settings
const MAX_STANDARD_TX_WEIGHT = 400_000;
const MAX_BLOCK_SIGOPS_COST = 80_000;
const MAX_STANDARD_TX_SIGOPS_COST = (MAX_BLOCK_SIGOPS_COST / 5);
const MIN_STANDARD_TX_NONWITNESS_SIZE = 65;
const MAX_P2SH_SIGOPS = 15;
const MAX_STANDARD_P2WSH_STACK_ITEMS = 100;
const MAX_STANDARD_P2WSH_STACK_ITEM_SIZE = 80;
const MAX_STANDARD_TAPSCRIPT_STACK_ITEM_SIZE = 80;
const MAX_STANDARD_P2WSH_SCRIPT_SIZE = 3600;
const MAX_STANDARD_SCRIPTSIG_SIZE = 1650;
const DUST_RELAY_TX_FEE = 3;
const MAX_OP_RETURN_RELAY = 83;
const DEFAULT_PERMIT_BAREMULTISIG = true;

export function countScriptSigops(script: string, isRawScript: boolean = false, witness: boolean = false): number {
  if (!script?.length) {
    return 0;
  }

  let sigops = 0;
  // count OP_CHECKSIG and OP_CHECKSIGVERIFY
  sigops += (script.match(/OP_CHECKSIG/g)?.length || 0);

  // count OP_CHECKMULTISIG and OP_CHECKMULTISIGVERIFY
  if (isRawScript) {
    // in scriptPubKey or scriptSig, always worth 20
    sigops += 20 * (script.match(/OP_CHECKMULTISIG/g)?.length || 0);
  } else {
    // in redeem scripts and witnesses, worth N if preceded by OP_N, 20 otherwise
    const matches = script.matchAll(/(?:OP_(?:PUSHNUM_)?(\d+))? OP_CHECKMULTISIG/g);
    for (const match of matches) {
      const n = parseInt(match[1]);
      if (Number.isInteger(n)) {
        sigops += n;
      } else {
        sigops += 20;
      }
    }
  }

  return witness ? sigops : (sigops * 4);
}

export function setSchnorrSighashFlags(flags: bigint, witness: string[]): bigint {
  // no witness items
  if (!witness?.length) {
    return flags;
  }
  const hasAnnex = witness.length > 1 && witness[witness.length - 1].startsWith('50');
  if (witness?.length === (hasAnnex ? 2 : 1)) {
    // keypath spend, signature is the only witness item
    if (witness[0].length === 130) {
      flags |= setSighashFlags(flags, witness[0]);
    } else {
      flags |= TransactionFlags.sighash_default;
    }
  } else {
    // scriptpath spend, all items except for the script, control block and annex could be signatures
    for (let i = 0; i < witness.length - (hasAnnex ? 3 : 2); i++) {
      // handle probable signatures
      if (witness[i].length === 130) {
        flags |= setSighashFlags(flags, witness[i]);
      } else if (witness[i].length === 128) {
        flags |= TransactionFlags.sighash_default;
      }
    }
  }
  return flags;
}

export function isDERSig(w: string): boolean {
  // heuristic to detect probable DER signatures
  return (w.length >= 18
    && w.startsWith('30') // minimum DER signature length is 8 bytes + sighash flag (see https://mempool.space/testnet/tx/c6c232a36395fa338da458b86ff1327395a9afc28c5d2daa4273e410089fd433)
    && ['01', '02', '03', '81', '82', '83'].includes(w.slice(-2)) // signature must end with a valid sighash flag
    && (w.length === (2 * parseInt(w.slice(2, 4), 16)) + 6) // second byte encodes the combined length of the R and S components
  );
}

export enum SighashFlag {
  DEFAULT = 0,
  ALL = 1,
  NONE = 2,
  SINGLE = 3,
  ANYONECANPAY = 0x80
}

export type SighashValue =
  SighashFlag.DEFAULT |
  SighashFlag.ALL |
  SighashFlag.NONE |
  SighashFlag.SINGLE |
  (SighashFlag.ALL & SighashFlag.ANYONECANPAY) |
  (SighashFlag.NONE & SighashFlag.ANYONECANPAY) |
  (SighashFlag.SINGLE & SighashFlag.ANYONECANPAY) |
  (SighashFlag.ALL & SighashFlag.NONE);

export interface SigInfo {
  signature: string;
  sighash: SighashValue;
}

export class Sighash {
  static isACP(val: SighashValue): boolean {
    return val >= SighashFlag.ANYONECANPAY;
  }

  static isNone(val: SighashValue): boolean {
    return (val & 0x7F) === SighashFlag.NONE;
  }

  static isSingle(val: SighashValue): boolean {
    return (val & 0x7F) === SighashFlag.SINGLE;
  }

  static isAll(val: SighashValue): boolean {
    return (val & 0x7F) === SighashFlag.ALL;
  }

  static isDefault(val: SighashValue): boolean {
    return val === SighashFlag.DEFAULT;
  }
}

export function decodeSighashFlag(sighash: number): SighashValue {
  if (sighash >= 0 && sighash <= 0x03 || sighash > 0x80 && sighash <= 0x83) {
    return sighash as SighashValue;
  }
  return SighashFlag.DEFAULT;
}

export function extractDERSignaturesWitness(witness: string[]): SigInfo[] {
  if (!witness?.length) {
    return [];
  }

  const signatures: SigInfo[] = [];

  for (const w of witness) {
    if (isDERSig(w)) {
      signatures.push({
        signature: w,
        sighash: decodeSighashFlag(parseInt(w.slice(-2), 16)),
      });
    }
  }

  return signatures;
}

export function extractDERSignaturesASM(script_asm: string): SigInfo[] {
  if (!script_asm) {
    return [];
  }

  const signatures: SigInfo[] = [];
  const ops = script_asm.split(' ');

  for (let i = 0; i < ops.length - 1; i++) {
    // Look for OP_PUSHBYTES_N followed by a hex string
    if (ops[i].startsWith('OP_PUSHBYTES_')) {
      const hexData = ops[i + 1];
      if (isDERSig(hexData)) {
        const sighash = decodeSighashFlag(parseInt(hexData.slice(-2), 16));
        signatures.push({
          signature: hexData.slice(0, -2), // Remove sighash byte
          sighash
        });
      }
    }
  }

  return signatures;
}

export function extractSchnorrSignatures(witnesses: string[]): SigInfo[] {
  if (!witnesses?.length) {
    return [];
  }

  const signatures: SigInfo[] = [];

  for (const witness of witnesses) {
    if (witness.length === 130) {
      signatures.push({
        signature: witness,
        sighash: decodeSighashFlag(parseInt(witness.slice(-2), 16)),
      });
    } else if (witness.length === 128) {
      signatures.push({
        signature: witness,
        sighash: SighashFlag.DEFAULT,
      });
    }
  }

  return signatures;
}

export function processInputSignatures(vin: Vin): SigInfo[] {
  const addressType = vin.prevout?.scriptpubkey_type as AddressType;
  let signatures: SigInfo[] = [];
  switch(addressType) {
    case 'p2pk':
    case 'multisig':
    case 'p2pkh':
      signatures = extractDERSignaturesASM(vin.scriptsig_asm);
      break;
    case 'p2sh':
      signatures = [...extractDERSignaturesASM(vin.scriptsig_asm), ...extractDERSignaturesASM(vin.inner_redeemscript_asm), ...extractDERSignaturesWitness(vin.witness || [])];
      break;
    case 'v0_p2wpkh':
      signatures = extractDERSignaturesWitness(vin.witness || []);
      break;
    case 'v0_p2wsh':
      signatures = extractDERSignaturesWitness(vin.witness || []);
      break;
    case 'v1_p2tr': {
      const hasAnnex = vin.witness[vin.witness.length - 1].startsWith('50');
      const isKeyspend = vin.witness.length === (hasAnnex ? 2 : 1);
      if (isKeyspend) {
        signatures = extractSchnorrSignatures(vin.witness);
      } else {
        const stackItems = vin.witness.slice(0, hasAnnex ? -3 : -2);
        signatures = extractSchnorrSignatures(stackItems);
      }
    } break;
    default:
      // non-signed input types?
      break;
  }
  return signatures;
}

/**
 * Validates most standardness rules
 *
 * returns true early if any standardness rule is violated, otherwise false
 * (except for non-mandatory-script-verify-flag and p2sh script evaluation rules which are *not* enforced)
 *
 * As standardness rules change, we'll need to apply the rules in force *at the time* to older blocks.
 * For now, just pull out individual rules into versioned functions where necessary.
 */
export function isNonStandard(tx: Transaction, height?: number, network?: string): boolean {
  // version
  if (isNonStandardVersion(tx, height, network)) {
    return true;
  }

  // tx-size
  if (tx.weight > MAX_STANDARD_TX_WEIGHT) {
    return true;
  }

  // tx-size-small
  if (getNonWitnessSize(tx) < MIN_STANDARD_TX_NONWITNESS_SIZE) {
    return true;
  }

  // bad-txns-too-many-sigops
  if (tx.sigops && tx.sigops > MAX_STANDARD_TX_SIGOPS_COST) {
    return true;
  }

  // input validation
  for (const vin of tx.vin) {
    if (vin.is_coinbase) {
      // standardness rules don't apply to coinbase transactions
      return false;
    }
    // scriptsig-size
    if ((vin.scriptsig.length / 2) > MAX_STANDARD_SCRIPTSIG_SIZE) {
      return true;
    }
    // scriptsig-not-pushonly
    if (vin.scriptsig_asm) {
      for (const op of vin.scriptsig_asm.split(' ')) {
        if (opcodes[op] && opcodes[op] > opcodes['OP_16']) {
          return true;
        }
      }
    }
    // bad-txns-nonstandard-inputs
    if (vin.prevout?.scriptpubkey_type === 'p2sh') {
      // TODO: evaluate script (https://github.com/bitcoin/bitcoin/blob/1ac627c485a43e50a9a49baddce186ee3ad4daad/src/policy/policy.cpp#L177)
      // countScriptSigops returns the witness-scaled sigops, so divide by 4 before comparison with MAX_P2SH_SIGOPS
      const sigops = (countScriptSigops(vin.inner_redeemscript_asm || '') / 4);
      if (sigops > MAX_P2SH_SIGOPS) {
        return true;
      }
    } else if (['unknown', 'provably_unspendable', 'empty'].includes(vin.prevout?.scriptpubkey_type || '')) {
      return true;
    } else if (isNonStandardAnchor(tx, height, network)) {
      return true;
    }
    // TODO: bad-witness-nonstandard
  }

  // output validation
  let opreturnCount = 0;
  for (const vout of tx.vout) {
    // scriptpubkey
    if (['nonstandard', 'provably_unspendable', 'empty'].includes(vout.scriptpubkey_type)) {
      // (non-standard output type)
      return true;
    } else if (vout.scriptpubkey_type === 'unknown') {
      // undefined segwit version/length combinations are actually standard in outputs
      // https://github.com/bitcoin/bitcoin/blob/2c79abc7ad4850e9e3ba32a04c530155cda7f980/src/script/interpreter.cpp#L1950-L1951
      if (vout.scriptpubkey.startsWith('00') || !isWitnessProgram(vout.scriptpubkey)) {
        return true;
      }
    } else if (vout.scriptpubkey_type === 'multisig') {
      if (!DEFAULT_PERMIT_BAREMULTISIG) {
        // bare-multisig
        return true;
      }
      const mOfN = parseMultisigScript(vout.scriptpubkey_asm);
      if (!mOfN || mOfN.n < 1 || mOfN.n > 3 || mOfN.m < 1 || mOfN.m > mOfN.n) {
        // (non-standard bare multisig threshold)
        return true;
      }
    } else if (vout.scriptpubkey_type === 'op_return') {
      opreturnCount++;
      if ((vout.scriptpubkey.length / 2) > MAX_OP_RETURN_RELAY) {
        // over default datacarrier limit
        return true;
      }
    }
    // dust
    // (we could probably hardcode this for the different output types...)
    if (vout.scriptpubkey_type !== 'op_return') {
      let dustSize = (vout.scriptpubkey.length / 2);
      // add varint length overhead
      dustSize += getVarIntLength(dustSize);
      // add value size
      dustSize += 8;
      if (isWitnessProgram(vout.scriptpubkey)) {
        dustSize += 67;
      } else {
        dustSize += 148;
      }
      if (vout.value < (dustSize * DUST_RELAY_TX_FEE)) {
        // under minimum output size
        return true;
      }
    }
  }

  // multi-op-return
  if (opreturnCount > 1) {
    return true;
  }

  // TODO: non-mandatory-script-verify-flag

  return false;
}

// Individual versioned standardness rules

const V3_STANDARDNESS_ACTIVATION_HEIGHT = {
  'testnet4': 42_000,
  'testnet': 2_900_000,
  'signet': 211_000,
  '': 863_500,
};
function isNonStandardVersion(tx: Transaction, height?: number, network?: string): boolean {
  let TX_MAX_STANDARD_VERSION = 3;
  if (
    height != null
    && network != null
    && V3_STANDARDNESS_ACTIVATION_HEIGHT[network]
    && height <= V3_STANDARDNESS_ACTIVATION_HEIGHT[network]
  ) {
    // V3 transactions were non-standard to spend before v28.x (scheduled for 2024/09/30 https://github.com/bitcoin/bitcoin/issues/29891)
    TX_MAX_STANDARD_VERSION = 2;
  }

  if (tx.version > TX_MAX_STANDARD_VERSION) {
    return true;
  }
  return false;
}

const ANCHOR_STANDARDNESS_ACTIVATION_HEIGHT = {
  'testnet4': 42_000,
  'testnet': 2_900_000,
  'signet': 211_000,
  '': 863_500,
};
function isNonStandardAnchor(tx: Transaction, height?: number, network?: string): boolean {
  if (
    height != null
    && network != null
    && ANCHOR_STANDARDNESS_ACTIVATION_HEIGHT[network]
    && height <= ANCHOR_STANDARDNESS_ACTIVATION_HEIGHT[network]
  ) {
    // anchor outputs were non-standard to spend before v28.x (scheduled for 2024/09/30 https://github.com/bitcoin/bitcoin/issues/29891)
    return true;
  }
  return false;
}

// A witness program is any valid scriptpubkey that consists of a 1-byte push opcode
// followed by a data push between 2 and 40 bytes.
// https://github.com/bitcoin/bitcoin/blob/2c79abc7ad4850e9e3ba32a04c530155cda7f980/src/script/script.cpp#L224-L240
function isWitnessProgram(scriptpubkey: string): false | { version: number, program: string } {
  if (scriptpubkey.length < 8 || scriptpubkey.length > 84) {
    return false;
  }
  const version = parseInt(scriptpubkey.slice(0,2), 16);
  if (version !== 0 && version < 0x51 || version > 0x60) {
      return false;
  }
  const push = parseInt(scriptpubkey.slice(2,4), 16);
  if (push + 2 === (scriptpubkey.length / 2)) {
    return {
      version: version ? version - 0x50 : 0,
      program: scriptpubkey.slice(4),
    };
  }
  return false;
}

export function getNonWitnessSize(tx: Transaction): number {
  let weight = tx.weight;
  let hasWitness = false;
  for (const vin of tx.vin) {
    if (vin.witness?.length) {
      hasWitness = true;
      // witness count
      weight -= getVarIntLength(vin.witness.length);
      for (const witness of vin.witness) {
        // witness item size + content
        weight -= getVarIntLength(witness.length / 2) + (witness.length / 2);
      }
    }
  }
  if (hasWitness) {
    // marker & segwit flag
    weight -= 2;
  }
  return Math.ceil(weight / 4);
}

export function setSegwitSighashFlags(flags: bigint, witness: string[]): bigint {
  for (const w of witness) {
    if (isDERSig(w)) {
      flags |= setSighashFlags(flags, w);
    }
  }
  return flags;
}

export function setLegacySighashFlags(flags: bigint, scriptsig_asm: string): bigint {
  for (const item of scriptsig_asm.split(' ')) {
    // skip op_codes
    if (item.startsWith('OP_')) {
      continue;
    }
    // check pushed data
    if (isDERSig(item)) {
      flags |= setSighashFlags(flags, item);
    }
  }
  return flags;
}

export function setSighashFlags(flags: bigint, signature: string): bigint {
  switch(signature.slice(-2)) {
    case '01': return flags | TransactionFlags.sighash_all;
    case '02': return flags | TransactionFlags.sighash_none;
    case '03': return flags | TransactionFlags.sighash_single;
    case '81': return flags | TransactionFlags.sighash_all | TransactionFlags.sighash_acp;
    case '82': return flags | TransactionFlags.sighash_none | TransactionFlags.sighash_acp;
    case '83': return flags | TransactionFlags.sighash_single | TransactionFlags.sighash_acp;
    default: return flags | TransactionFlags.sighash_default; // taproot only
  }
}

export function isBurnKey(pubkey: string): boolean {
  return [
    '022222222222222222222222222222222222222222222222222222222222222222',
    '033333333333333333333333333333333333333333333333333333333333333333',
    '020202020202020202020202020202020202020202020202020202020202020202',
    '030303030303030303030303030303030303030303030303030303030303030303',
  ].includes(pubkey);
}

export function getTransactionFlags(tx: Transaction, cpfpInfo?: CpfpInfo, replacement?: boolean, height?: number, network?: string): bigint {
  let flags = tx.flags ? BigInt(tx.flags) : 0n;

  // Update variable flags (CPFP, RBF)
  if (cpfpInfo) {
    if (cpfpInfo.ancestors.length) {
      flags |= TransactionFlags.cpfp_child;
    }
    if (cpfpInfo.descendants?.length) {
      flags |= TransactionFlags.cpfp_parent;
    }
  }
  if (replacement) {
    flags |= TransactionFlags.replacement;
  }

  // Already processed static flags, no need to do it again
  if (tx.flags) {
    return flags;
  }

  // Process static flags
  if (tx.version === 1) {
    flags |= TransactionFlags.v1;
  } else if (tx.version === 2) {
    flags |= TransactionFlags.v2;
  } else if (tx.version === 3) {
    flags |= TransactionFlags.v3;
  }
  const reusedInputAddresses: { [address: string ]: number } = {};
  const reusedOutputAddresses: { [address: string ]: number } = {};
  const inValues = {};
  const outValues = {};
  let rbf = false;
  for (const vin of tx.vin) {
    if (vin.sequence < 0xfffffffe) {
      rbf = true;
    }
    switch (vin.prevout?.scriptpubkey_type) {
      case 'p2pk': flags |= TransactionFlags.p2pk; break;
      case 'multisig': flags |= TransactionFlags.p2ms; break;
      case 'p2pkh': flags |= TransactionFlags.p2pkh; break;
      case 'p2sh': flags |= TransactionFlags.p2sh; break;
      case 'v0_p2wpkh': flags |= TransactionFlags.p2wpkh; break;
      case 'v0_p2wsh': flags |= TransactionFlags.p2wsh; break;
      case 'v1_p2tr': {
        flags |= TransactionFlags.p2tr;
        // every valid taproot input has at least one witness item, however transactions
        // created before taproot activation don't need to have any witness data
        // (see https://mempool.space/tx/b10c007c60e14f9d087e0291d4d0c7869697c6681d979c6639dbd960792b4d41)
        if (vin.witness?.length) {
          // in taproot, if the last witness item begins with 0x50, it's an annex
          const hasAnnex = vin.witness?.[vin.witness.length - 1].startsWith('50');
          // script spends have more than one witness item, not counting the annex (if present)
          if (vin.witness.length > (hasAnnex ? 2 : 1)) {
            // the script itself is the second-to-last witness item, not counting the annex
            const asm = vin.inner_witnessscript_asm;
            // inscriptions smuggle data within an 'OP_0 OP_IF ... OP_ENDIF' envelope
            if (asm?.includes('OP_0 OP_IF')) {
              flags |= TransactionFlags.inscription;
            }
          }
        }
      } break;
    }

    // sighash flags
    if (vin.prevout?.scriptpubkey_type === 'v1_p2tr') {
      flags |= setSchnorrSighashFlags(flags, vin.witness);
    } else if (vin.witness) {
      flags |= setSegwitSighashFlags(flags, vin.witness);
    } else if (vin.scriptsig?.length) {
      flags |= setLegacySighashFlags(flags, vin.scriptsig_asm);
    }

    if (vin.prevout?.scriptpubkey_address) {
      reusedInputAddresses[vin.prevout?.scriptpubkey_address] = (reusedInputAddresses[vin.prevout?.scriptpubkey_address] || 0) + 1;
    }
    inValues[vin.prevout?.value || Math.random()] = (inValues[vin.prevout?.value || Math.random()] || 0) + 1;
  }
  if (rbf) {
    flags |= TransactionFlags.rbf;
  } else {
    flags |= TransactionFlags.no_rbf;
  }
  let hasFakePubkey = false;
  let P2WSHCount = 0;
  let olgaSize = 0;
  for (const vout of tx.vout) {
    switch (vout.scriptpubkey_type) {
      case 'p2pk': {
        flags |= TransactionFlags.p2pk;
        // detect fake pubkey (i.e. not a valid DER point on the secp256k1 curve)
        hasFakePubkey = hasFakePubkey || !isPoint(vout.scriptpubkey?.slice(2, -2));
      } break;
      case 'multisig': {
        flags |= TransactionFlags.p2ms;
        // detect fake pubkeys (i.e. not valid DER points on the secp256k1 curve)
        const asm = vout.scriptpubkey_asm;
        for (const key of (asm?.split(' ') || [])) {
          if (!hasFakePubkey && !key.startsWith('OP_')) {
            hasFakePubkey = hasFakePubkey || isBurnKey(key) || !isPoint(key);
          }
        }
      } break;
      case 'p2pkh': flags |= TransactionFlags.p2pkh; break;
      case 'p2sh': flags |= TransactionFlags.p2sh; break;
      case 'v0_p2wpkh': flags |= TransactionFlags.p2wpkh; break;
      case 'v0_p2wsh': flags |= TransactionFlags.p2wsh; break;
      case 'v1_p2tr': flags |= TransactionFlags.p2tr; break;
      case 'op_return': flags |= TransactionFlags.op_return; break;
    }
    if (vout.scriptpubkey_address) {
      reusedOutputAddresses[vout.scriptpubkey_address] = (reusedOutputAddresses[vout.scriptpubkey_address] || 0) + 1;
    }
    if (vout.scriptpubkey_type === 'v0_p2wsh') {
      if (!P2WSHCount) {
        olgaSize = parseInt(vout.scriptpubkey.slice(4, 8), 16);
      }
      P2WSHCount++;
      if (P2WSHCount === Math.ceil((olgaSize + 2) / 32)) {
        const nullBytes = (P2WSHCount * 32) - olgaSize - 2;
        if (vout.scriptpubkey.endsWith(''.padEnd(nullBytes * 2, '0'))) {
          flags |= TransactionFlags.fake_scripthash;
        }
      }
    } else {
      P2WSHCount = 0;
    }
    outValues[vout.value || Math.random()] = (outValues[vout.value || Math.random()] || 0) + 1;
  }
  if (hasFakePubkey) {
    flags |= TransactionFlags.fake_pubkey;
  }
  
  // fast but bad heuristic to detect possible coinjoins
  // (at least 5 inputs and 5 outputs, less than half of which are unique amounts, with no address reuse)
  const addressReuse = Object.keys(reusedOutputAddresses).reduce((acc, key) => Math.max(acc, (reusedInputAddresses[key] || 0) + (reusedOutputAddresses[key] || 0)), 0) > 1;
  if (!addressReuse && tx.vin.length >= 5 && tx.vout.length >= 5 && (Object.keys(inValues).length + Object.keys(outValues).length) <= (tx.vin.length + tx.vout.length) / 2 ) {
    flags |= TransactionFlags.coinjoin;
  }
  // more than 5:1 input:output ratio
  if (tx.vin.length / tx.vout.length >= 5) {
    flags |= TransactionFlags.consolidation;
  }
  // less than 1:5 input:output ratio
  if (tx.vin.length / tx.vout.length <= 0.2) {
    flags |= TransactionFlags.batch_payout;
  }

  if (isNonStandard(tx, height, network)) {
    flags |= TransactionFlags.nonstandard;
  }

  return flags;
}

export function getUnacceleratedFeeRate(tx: Transaction, accelerated: boolean): number {
  if (accelerated) {
    let ancestorVsize = tx.weight / 4;
    let ancestorFee = tx.fee;
    for (const ancestor of tx.ancestors || []) {
      ancestorVsize += (ancestor.weight / 4);
      ancestorFee += ancestor.fee;
    }
    return Math.min(tx.fee / (tx.weight / 4), (ancestorFee / ancestorVsize));
  } else {
    return tx.effectiveFeePerVsize;
  }
}

export function identifyPrioritizedTransactions(transactions: TransactionStripped[]): { prioritized: string[], deprioritized: string[] } {
  // find the longest increasing subsequence of transactions
  // (adapted from https://en.wikipedia.org/wiki/Longest_increasing_subsequence#Efficient_algorithms)
  // should be O(n log n)
  const X = transactions.slice(1).reverse(); // standard block order is by *decreasing* effective fee rate, but we want to iterate in increasing order (and skip the coinbase)
  if (X.length < 2) {
    return { prioritized: [], deprioritized: [] };
  }
  const N = X.length;
  const P: number[] = new Array(N);
  const M: number[] = new Array(N + 1);
  M[0] = -1; // undefined so can be set to any value

  let L = 0;
  for (let i = 0; i < N; i++) {
    // Binary search for the smallest positive l ≤ L
    // such that X[M[l]].effectiveFeePerVsize > X[i].effectiveFeePerVsize
    let lo = 1;
    let hi = L + 1;
    while (lo < hi) {
      const mid = lo + Math.floor((hi - lo) / 2); // lo <= mid < hi
      if (X[M[mid]].rate > X[i].rate) {
        hi = mid;
      } else { // if X[M[mid]].effectiveFeePerVsize < X[i].effectiveFeePerVsize
        lo = mid + 1;
      }
    }

    // After searching, lo == hi is 1 greater than the
    // length of the longest prefix of X[i]
    const newL = lo;

    // The predecessor of X[i] is the last index of
    // the subsequence of length newL-1
    P[i] = M[newL - 1];
    M[newL] = i;

    if (newL > L) {
      // If we found a subsequence longer than any we've
      // found yet, update L
      L = newL;
    }
  }

  // Reconstruct the longest increasing subsequence
  // It consists of the values of X at the L indices:
  // ..., P[P[M[L]]], P[M[L]], M[L]
  const LIS: TransactionStripped[] = new Array(L);
  let k = M[L];
  for (let j = L - 1; j >= 0; j--) {
    LIS[j] = X[k];
    k = P[k];
  }

  const lisMap = new Map<string, number>();
  LIS.forEach((tx, index) => lisMap.set(tx.txid, index));

  const prioritized: string[] = [];
  const deprioritized: string[] = [];

  let lastRate = 0;

  for (const tx of X) {
    if (lisMap.has(tx.txid)) {
      lastRate = tx.rate;
    } else {
      if (Math.abs(tx.rate - lastRate) < 0.1) {
        // skip if the rate is almost the same as the previous transaction
      } else if (tx.rate <= lastRate) {
        prioritized.push(tx.txid);
      } else {
        deprioritized.push(tx.txid);
      }
    }
  }

  return { prioritized, deprioritized };
}

// Adapted from mempool backend https://github.com/mempool/mempool/blob/14e49126c3ca8416a8d7ad134a95c5e090324d69/backend/src/api/transaction-utils.ts#L254
// Converts hex bitcoin script to ASM
function convertScriptSigAsm(hex: string): string {

  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(hex.substr(i * 2, 2), 16);
  }

  const b = [];
  let i = 0;

  while (i < buf.length) {
    const op = buf[i];
    if (op >= 0x01 && op <= 0x4e) {
      i++;
      let push;
      if (op === 0x4c) {
        push = buf[i];
        b.push('OP_PUSHDATA1');
        i += 1;
      } else if (op === 0x4d) {
        push = buf[i] | (buf[i + 1] << 8);
        b.push('OP_PUSHDATA2');
        i += 2;
      } else if (op === 0x4e) {
        push = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16) | (buf[i + 3] << 24);
        b.push('OP_PUSHDATA4');
        i += 4;
      } else {
        push = op;
        b.push('OP_PUSHBYTES_' + push);
      }

      const data = buf.slice(i, i + push);
      if (data.length !== push) {
        break;
      }

      b.push(uint8ArrayToHexString(data));
      i += data.length;
    } else {
      if (op === 0x00) {
        b.push('OP_0');
      } else if (op === 0x4f) {
        b.push('OP_PUSHNUM_NEG1');
      } else if (op === 0xb1) {
        b.push('OP_CLTV');
      } else if (op === 0xb2) {
        b.push('OP_CSV');
      } else if (op === 0xba) {
        b.push('OP_CHECKSIGADD');
      } else {
        const opcode = opcodes[op];
        if (opcode) {
          b.push(opcode);
        } else {
          b.push('OP_RETURN_' + op);
        }
      }
      i += 1;
    }
  }

  return b.join(' ');
}

// Copied from mempool backend https://github.com/mempool/mempool/blob/14e49126c3ca8416a8d7ad134a95c5e090324d69/backend/src/api/transaction-utils.ts#L327
/**
 * This function must only be called when we know the witness we are parsing
 * is a taproot witness.
 * @param witness An array of hex strings that represents the witness stack of
 *                the input.
 * @returns null if the witness is not a script spend, and the hex string of
 *          the script item if it is a script spend.
 */
function witnessToP2TRScript(witness: string[]): string | null {
  if (witness.length < 2) return null;
  // Note: see BIP341 for parsing details of witness stack

  // If there are at least two witness elements, and the first byte of the
  // last element is 0x50, this last element is called annex a and
  // is removed from the witness stack.
  const hasAnnex = witness[witness.length - 1].substring(0, 2) === '50';
  // If there are at least two witness elements left, script path spending is used.
  // Call the second-to-last stack element s, the script.
  // (Note: this phrasing from BIP341 assumes we've *removed* the annex from the stack)
  if (hasAnnex && witness.length < 3) return null;
  const positionOfScript = hasAnnex ? witness.length - 3 : witness.length - 2;
  return witness[positionOfScript];
}

// Copied from mempool backend https://github.com/mempool/mempool/blob/14e49126c3ca8416a8d7ad134a95c5e090324d69/backend/src/api/transaction-utils.ts#L227
// Fills inner_redeemscript_asm and inner_witnessscript_asm fields of fetched prevouts for decoded transactions
export function addInnerScriptsToVin(vin: Vin): void {
  if (!vin.prevout) {
    return;
  }

  if (vin.prevout.scriptpubkey_type === 'p2sh') {
    const redeemScript = vin.scriptsig_asm.split(' ').reverse()[0];
    vin.inner_redeemscript_asm = convertScriptSigAsm(redeemScript);
    if (vin.witness && vin.witness.length) {
      const witnessScript = vin.witness[vin.witness.length - 1];
      vin.inner_witnessscript_asm = convertScriptSigAsm(witnessScript);
    }
  }

  if (vin.prevout.scriptpubkey_type === 'v0_p2wsh' && vin.witness) {
    const witnessScript = vin.witness[vin.witness.length - 1];
    vin.inner_witnessscript_asm = convertScriptSigAsm(witnessScript);
  }

  if (vin.prevout.scriptpubkey_type === 'v1_p2tr' && vin.witness) {
    const witnessScript = witnessToP2TRScript(vin.witness);
    if (witnessScript !== null) {
      vin.inner_witnessscript_asm = convertScriptSigAsm(witnessScript);
    }
  }
}

// Adapted from bitcoinjs-lib at https://github.com/bitcoinjs/bitcoinjs-lib/blob/32e08aa57f6a023e995d8c4f0c9fbdc5f11d1fa0/ts_src/transaction.ts#L78
/**
 * @param buffer The raw transaction data
 * @param network
 * @param inputs Additional information from a PSBT, if available
 * @returns The decoded transaction object and the raw hex
 */
function fromBuffer(buffer: Uint8Array, network: string, inputs?: { key: Uint8Array; value: Uint8Array }[][]): { tx: Transaction, hex: string } {
  let offset = 0;

  // Parse raw transaction
  const tx = {
    status: {
      confirmed: null,
      block_height: null,
      block_hash: null,
      block_time: null,
    }
  } as Transaction;
  
  [tx.version, offset] = readInt32(buffer, offset);

  let marker, flag;
  [marker, offset] = readInt8(buffer, offset);
  [flag, offset] = readInt8(buffer, offset);

  let isLegacyTransaction = true;
  if (marker === 0x00 && flag === 0x01) {
    isLegacyTransaction = false;
  } else {
    offset -= 2;
  }

  let vinLen;
  [vinLen, offset] = readVarInt(buffer, offset);
  if (vinLen === 0) {
    throw new Error('Transaction has no inputs');
  }
  tx.vin = [];
  for (let i = 0; i < vinLen; ++i) {
    let txid, vout, scriptsig, sequence;
    [txid, offset] = readSlice(buffer, offset, 32);
    txid = uint8ArrayToHexString(txid.reverse());
    [vout, offset] = readInt32(buffer, offset, true);
    [scriptsig, offset] = readVarSlice(buffer, offset);
    scriptsig = uint8ArrayToHexString(scriptsig);
    [sequence, offset] = readInt32(buffer, offset, true);
    const is_coinbase = txid === '0'.repeat(64);
    const scriptsig_asm = convertScriptSigAsm(scriptsig);
    tx.vin.push({ txid, vout, scriptsig, sequence, is_coinbase, scriptsig_asm, prevout: null });
  }

  let voutLen;
  [voutLen, offset] = readVarInt(buffer, offset);
  tx.vout = [];
  for (let i = 0; i < voutLen; ++i) {
    let value, scriptpubkeyArray, scriptpubkey;
    [value, offset] = readInt64(buffer, offset);
    value = Number(value);
    [scriptpubkeyArray, offset] = readVarSlice(buffer, offset);
    scriptpubkey = uint8ArrayToHexString(scriptpubkeyArray);
    const scriptpubkey_asm = convertScriptSigAsm(scriptpubkey);
    const toAddress = scriptPubKeyToAddress(scriptpubkey, network);
    const scriptpubkey_type = toAddress.type;
    const scriptpubkey_address = toAddress?.address;
    tx.vout.push({ value, scriptpubkey, scriptpubkey_asm, scriptpubkey_type, scriptpubkey_address });
  }

  if (!isLegacyTransaction) {
    for (let i = 0; i < vinLen; ++i) {
      let witness;
      [witness, offset] = readVector(buffer, offset);
      tx.vin[i].witness = witness.map(uint8ArrayToHexString);
    }
  }

  [tx.locktime, offset] = readInt32(buffer, offset, true);

  if (offset !== buffer.length) {
    throw new Error('Transaction has unexpected data');
  }
  
  // Optionally add data from PSBT: prevouts, redeem/witness scripts and signatures
  if (inputs) {
    for (let i = 0; i < tx.vin.length; i++) {
      const vin = tx.vin[i];
      const inputRecords = inputs[i];

      const groups = {
        nonWitnessUtxo: null,
        witnessUtxo: null,
        finalScriptSig: null,
        finalScriptWitness: null,
        redeemScript: null,
        witnessScript: null,
        partialSigs: []
      };

      for (const record of inputRecords) {
        switch (record.key[0]) {
          case 0x00:
            groups.nonWitnessUtxo = record;
            break;
          case 0x01:
            groups.witnessUtxo = record;
            break;
          case 0x07:
            groups.finalScriptSig = record;
            break;
          case 0x08:
            groups.finalScriptWitness = record;
            break;
          case 0x04:
            groups.redeemScript = record;
            break;
          case 0x05:
            groups.witnessScript = record;
            break;
          case 0x02:
            groups.partialSigs.push(record);
            break;
        }
      }

      // Fill prevout
      if (groups.witnessUtxo && !vin.prevout) {
        let value, scriptpubkeyArray, scriptpubkey, outputOffset = 0;
        [value, outputOffset] = readInt64(groups.witnessUtxo.value, outputOffset);
        value = Number(value);
        [scriptpubkeyArray, outputOffset] = readVarSlice(groups.witnessUtxo.value, outputOffset);
        scriptpubkey = uint8ArrayToHexString(scriptpubkeyArray);
        const scriptpubkey_asm = convertScriptSigAsm(scriptpubkey);
        const toAddress = scriptPubKeyToAddress(scriptpubkey, network);
        const scriptpubkey_type = toAddress.type;
        const scriptpubkey_address = toAddress?.address;
        vin.prevout = { value, scriptpubkey, scriptpubkey_asm, scriptpubkey_type, scriptpubkey_address };
      }
      if (groups.nonWitnessUtxo && !vin.prevout) {
        const utxoTx = fromBuffer(groups.nonWitnessUtxo.value, network).tx;
        vin.prevout = utxoTx.vout[vin.vout];
      }

      // Fill final scriptSig or witness
      let finalizedScriptSig = false;
      if (groups.finalScriptSig) {
        vin.scriptsig = uint8ArrayToHexString(groups.finalScriptSig.value);
        vin.scriptsig_asm = convertScriptSigAsm(vin.scriptsig);
        finalizedScriptSig = true;
      }
      let finalizedWitness = false;
      if (groups.finalScriptWitness) {
        let witness = [];
        let witnessOffset = 0;
        [witness, witnessOffset] = readVector(groups.finalScriptWitness.value, witnessOffset);
        vin.witness = witness.map(uint8ArrayToHexString);
        finalizedWitness = true;
      }
      if (finalizedScriptSig && finalizedWitness) {
        continue;
      }

      // Fill redeem script and/or witness script
      if (groups.redeemScript && !finalizedScriptSig) {
        const redeemScript = groups.redeemScript.value;
        if (redeemScript.length > 520) {
          throw new Error("Redeem script must be <= 520 bytes");
        }
        let pushOpcode;
        if (redeemScript.length < 0x4c) {
          pushOpcode = new Uint8Array([redeemScript.length]);
        } else if (redeemScript.length <= 0xff) {
          pushOpcode = new Uint8Array([0x4c, redeemScript.length]); // OP_PUSHDATA1
        } else {
          pushOpcode = new Uint8Array([0x4d, redeemScript.length & 0xff, redeemScript.length >> 8]); // OP_PUSHDATA2
        }
        vin.scriptsig = (vin.scriptsig || '') + uint8ArrayToHexString(pushOpcode) + uint8ArrayToHexString(redeemScript);
        vin.scriptsig_asm = convertScriptSigAsm(vin.scriptsig);
      }
      if (groups.witnessScript && !finalizedWitness) {
        vin.witness = (vin.witness || []).concat(uint8ArrayToHexString(groups.witnessScript.value));
      }


      // Fill partial signatures
      for (const record of groups.partialSigs) {
        const scriptpubkey_type = vin.prevout?.scriptpubkey_type;
        if (scriptpubkey_type === 'v0_p2wsh' && !finalizedWitness) {
          vin.witness = vin.witness || [];
          vin.witness.unshift(uint8ArrayToHexString(record.value));
        }
        if (scriptpubkey_type === 'p2sh') {
          const redeemScriptStr = vin.scriptsig_asm ? vin.scriptsig_asm.split(' ').reverse()[0] : '';
          if (redeemScriptStr.startsWith('00') && redeemScriptStr.length === 68 && vin.witness?.length) {
            if (!finalizedWitness) {
              vin.witness.unshift(uint8ArrayToHexString(record.value));
            }
          } else {
            if (!finalizedScriptSig) {
              const signature = record.value;
              if (signature.length > 73) {
                throw new Error("Signature must be <= 73 bytes");
              }
              const pushOpcode = new Uint8Array([signature.length]);
              vin.scriptsig = uint8ArrayToHexString(pushOpcode) + uint8ArrayToHexString(signature) + (vin.scriptsig || '');
              vin.scriptsig_asm = convertScriptSigAsm(vin.scriptsig);
            }
          }
        }
      }
    }    
  }

  // Calculate final size, weight, and txid
  const hasWitness = tx.vin.some(vin => vin.witness?.length);
  let witnessSize = 0;
  if (hasWitness) {
    for (let i = 0; i < tx.vin.length; ++i) {
      const witnessItems = tx.vin[i].witness || [];
      witnessSize += getVarIntLength(witnessItems.length);
      for (const item of witnessItems) {
        const witnessItem = hexStringToUint8Array(item);
        witnessSize += getVarIntLength(witnessItem.length);
        witnessSize += witnessItem.length;
      }
    }
    witnessSize += 2;
  }

  const rawHex = serializeTransaction(tx, hasWitness);
  tx.size = rawHex.length;
  tx.weight = (tx.size - witnessSize) * 3 + tx.size;
  tx.txid = txid(tx);

  return { tx, hex: uint8ArrayToHexString(rawHex) };
}

/**
 * Decodes a PSBT buffer into the unsigned raw transaction and input map
 * @param psbtBuffer
 * @returns
 *   - the unsigned transaction from a PSBT (txHex)
 *   - the full input map for each input in to fill signatures and prevouts later (inputs)
 */
function decodePsbt(psbtBuffer: Uint8Array): { rawTx: Uint8Array; inputs: { key: Uint8Array; value: Uint8Array }[][] } {
  let offset = 0;

  // magic: "psbt" in ASCII
  const expectedMagic = [0x70, 0x73, 0x62, 0x74];
  for (let i = 0; i < expectedMagic.length; i++) {
    if (psbtBuffer[offset + i] !== expectedMagic[i]) {
      throw new Error("Invalid PSBT magic bytes");
    }
  }
  offset += expectedMagic.length;

  const separator = psbtBuffer[offset];
  offset += 1;
  if (separator !== 0xff) {
    throw new Error("Invalid PSBT separator");
  }

  // GLOBAL MAP
  let rawTx: Uint8Array | null = null;
  while (offset < psbtBuffer.length) {
    const [keyLen, newOffset] = readVarInt(psbtBuffer, offset);
    offset = newOffset;
    // key length of 0 means the end of the global map
    if (keyLen === 0) {
      break;
    }
    const key = psbtBuffer.slice(offset, offset + keyLen);
    offset += keyLen;
    const [valLen, newOffset2] = readVarInt(psbtBuffer, offset);
    offset = newOffset2;
    const value = psbtBuffer.slice(offset, offset + valLen);
    offset += valLen;

    // Global key type 0x00 holds the unsigned transaction.
    if (key[0] === 0x00) {
      rawTx = value;
    }
  }

  if (!rawTx) {
    throw new Error("Unsigned transaction not found in PSBT");
  }

  let numInputs: number;
  let txOffset = 0;
  // Skip version (4 bytes)
  txOffset += 4;
  if (rawTx[txOffset] === 0x00 && rawTx[txOffset + 1] === 0x01) {
    txOffset += 2;
  }
  const [inputCount, newTxOffset] = readVarInt(rawTx, txOffset);
  txOffset = newTxOffset;
  numInputs = inputCount;

  // INPUT MAPS
  const inputs: { key: Uint8Array; value: Uint8Array }[][] = [];
  for (let i = 0; i < numInputs; i++) {
    const inputRecords: { key: Uint8Array; value: Uint8Array }[] = [];
    const seenKeys = new Set<string>();
    while (offset < psbtBuffer.length) {
      const [keyLen, newOffset] = readVarInt(psbtBuffer, offset);
      offset = newOffset;
      // key length of 0 means the end of the input map
      if (keyLen === 0) {
        break;
      }
      const key = psbtBuffer.slice(offset, offset + keyLen);
      offset += keyLen;

      const keyHex = uint8ArrayToHexString(key);
      if (seenKeys.has(keyHex)) {
        throw new Error(`Duplicate key in input map`);
      }
      seenKeys.add(keyHex);

      const [valLen, newOffset2] = readVarInt(psbtBuffer, offset);
      offset = newOffset2;
      const value = psbtBuffer.slice(offset, offset + valLen);
      offset += valLen;

      inputRecords.push({ key, value });
    }
    inputs.push(inputRecords);
  }

  return { rawTx, inputs };
}

export function decodeRawTransaction(input: string, network: string): { tx: Transaction, hex: string } {
  if (!input.length) {
    throw new Error('Empty input');
  }

  let buffer: Uint8Array;
  if (input.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(input)) {
    buffer = hexStringToUint8Array(input);
  } else if (/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)|[A-Za-z0-9+/]{3}=)?$/.test(input)) {
    buffer = base64ToUint8Array(input);
  } else {
    throw new Error('Invalid input: not a valid transaction or PSBT');
  }

  if (buffer[0] === 0x70 && buffer[1] === 0x73 && buffer[2] === 0x62 && buffer[3] === 0x74) { // PSBT magic bytes
    const { rawTx, inputs } = decodePsbt(buffer);
    return fromBuffer(rawTx, network, inputs);
  }

  return fromBuffer(buffer, network);
}

function serializeTransaction(tx: Transaction, includeWitness: boolean = true): Uint8Array {
  const result: number[] = [];

  // Add version
  result.push(...intToBytes(tx.version, 4));

  if (includeWitness) {
    // Add SegWit marker and flag bytes (0x00, 0x01)
    result.push(0x00, 0x01);
  }

  // Add input count and inputs
  result.push(...varIntToBytes(tx.vin.length));
  for (const input of tx.vin) {
    result.push(...hexStringToUint8Array(input.txid).reverse());
    result.push(...intToBytes(input.vout, 4));
    const scriptSig = hexStringToUint8Array(input.scriptsig);
    result.push(...varIntToBytes(scriptSig.length));
    result.push(...scriptSig);
    result.push(...intToBytes(input.sequence, 4));
  }

  // Add output count and outputs
  result.push(...varIntToBytes(tx.vout.length));
  for (const output of tx.vout) {
    result.push(...bigIntToBytes(BigInt(output.value), 8));
    const scriptPubKey = hexStringToUint8Array(output.scriptpubkey);
    result.push(...varIntToBytes(scriptPubKey.length));
    result.push(...scriptPubKey);
  }

  if (includeWitness) {
    for (const input of tx.vin) {
      const witnessItems = input.witness || [];
      result.push(...varIntToBytes(witnessItems.length));
      for (const item of witnessItems) {
        const witnessBytes = hexStringToUint8Array(item);
        result.push(...varIntToBytes(witnessBytes.length));
        result.push(...witnessBytes);
      }
    }
  }

  // Add locktime
  result.push(...intToBytes(tx.locktime, 4));

  return new Uint8Array(result);
}

function txid(tx: Transaction): string {
  const serializedTx = serializeTransaction(tx, false);
  const hash1 = new Hash().update(serializedTx).digest();
  const hash2 = new Hash().update(hash1).digest();
  return uint8ArrayToHexString(hash2.reverse());
}

// Copied from mempool backend https://github.com/mempool/mempool/blob/14e49126c3ca8416a8d7ad134a95c5e090324d69/backend/src/api/transaction-utils.ts#L177
export function countSigops(transaction: Transaction): number {
  let sigops = 0;

  for (const input of transaction.vin) {
    if (input.scriptsig_asm) {
      sigops += countScriptSigops(input.scriptsig_asm, true);
    }
    if (input.prevout) {
      switch (true) {
        case input.prevout.scriptpubkey_type === 'p2sh' && input.witness?.length === 2 && input.scriptsig && input.scriptsig.startsWith('160014'):
        case input.prevout.scriptpubkey_type === 'v0_p2wpkh':
          sigops += 1;
          break;

        case input.prevout?.scriptpubkey_type === 'p2sh' && input.witness?.length && input.scriptsig && input.scriptsig.startsWith('220020'):
        case input.prevout.scriptpubkey_type === 'v0_p2wsh':
          if (input.witness?.length) {
            sigops += countScriptSigops(convertScriptSigAsm(input.witness[input.witness.length - 1]), false, true);
          }
          break;

        case input.prevout.scriptpubkey_type === 'p2sh':
          if (input.inner_redeemscript_asm) {
            sigops += countScriptSigops(input.inner_redeemscript_asm);
          }
          break;
      }
    }
  }

  for (const output of transaction.vout) {
    if (output.scriptpubkey_asm) {
      sigops += countScriptSigops(output.scriptpubkey_asm, true);
    }
  }

  return sigops;
}

function scriptPubKeyToAddress(scriptPubKey: string, network: string): { address: string, type: string } {
  // P2PKH
  if (/^76a914[0-9a-f]{40}88ac$/.test(scriptPubKey)) {
    return { address: p2pkh(scriptPubKey.substring(6, 6 + 40), network), type: 'p2pkh' };
  }
  // P2PK
  if (/^21[0-9a-f]{66}ac$/.test(scriptPubKey) || /^41[0-9a-f]{130}ac$/.test(scriptPubKey)) {
    return { address: null, type: 'p2pk' };
  }
  // P2SH
  if (/^a914[0-9a-f]{40}87$/.test(scriptPubKey)) {
    return { address: p2sh(scriptPubKey.substring(4, 4 + 40), network), type: 'p2sh' };
  }
  // P2WPKH
  if (/^0014[0-9a-f]{40}$/.test(scriptPubKey)) {
    return { address: p2wpkh(scriptPubKey.substring(4, 4 + 40), network), type: 'v0_p2wpkh' };
  }
  // P2WSH
  if (/^0020[0-9a-f]{64}$/.test(scriptPubKey)) {
    return { address: p2wsh(scriptPubKey.substring(4, 4 + 64), network), type: 'v0_p2wsh' };
  }
  // P2TR
  if (/^5120[0-9a-f]{64}$/.test(scriptPubKey)) {
    return { address: p2tr(scriptPubKey.substring(4, 4 + 64), network), type: 'v1_p2tr' };
  }
  // multisig
  if (/^[0-9a-f]+ae$/.test(scriptPubKey)) {
    return { address: null, type: 'multisig' };
  }
  // anchor
  if (scriptPubKey === '51024e73') {
    return { address: p2a(network), type: 'anchor' };
  }
  // op_return
  if (/^6a/.test(scriptPubKey)) {
    return { address: null, type: 'op_return' };
  }
  return { address: null, type: 'unknown' };
}

function p2pkh(pubKeyHash: string, network: string): string {
  const pubkeyHashArray = hexStringToUint8Array(pubKeyHash);
  const version = ['testnet', 'testnet4', 'signet'].includes(network) ? 0x6f : 0x00;
  const versionedPayload = Uint8Array.from([version, ...pubkeyHashArray]);
  const hash1 = new Hash().update(versionedPayload).digest();
  const hash2 = new Hash().update(hash1).digest();
  const checksum = hash2.slice(0, 4);
  const finalPayload = Uint8Array.from([...versionedPayload, ...checksum]);
  const bitcoinAddress = base58Encode(finalPayload);
  return bitcoinAddress;
}

function p2sh(scriptHash: string, network: string): string {
  const scriptHashArray = hexStringToUint8Array(scriptHash);
  const version = ['testnet', 'testnet4', 'signet'].includes(network) ? 0xc4 : 0x05;
  const versionedPayload = Uint8Array.from([version, ...scriptHashArray]);
  const hash1 = new Hash().update(versionedPayload).digest();
  const hash2 = new Hash().update(hash1).digest();
  const checksum = hash2.slice(0, 4);
  const finalPayload = Uint8Array.from([...versionedPayload, ...checksum]);
  const bitcoinAddress = base58Encode(finalPayload);
  return bitcoinAddress;
}

function p2wpkh(pubKeyHash: string, network: string): string {
  const pubkeyHashArray = hexStringToUint8Array(pubKeyHash);
  const hrp = ['testnet', 'testnet4', 'signet'].includes(network) ? 'tb' : 'bc';
  const version = 0;
  const words = [version].concat(toWords(pubkeyHashArray));
  const bech32Address = bech32Encode(hrp, words);
  return bech32Address;
}

function p2wsh(scriptHash: string, network: string): string {
  const scriptHashArray = hexStringToUint8Array(scriptHash);
  const hrp = ['testnet', 'testnet4', 'signet'].includes(network) ? 'tb' : 'bc';
  const version = 0;
  const words = [version].concat(toWords(scriptHashArray));
  const bech32Address = bech32Encode(hrp, words);
  return bech32Address;
}

function p2tr(pubKeyHash: string, network: string): string {
  const pubkeyHashArray = hexStringToUint8Array(pubKeyHash);
  const hrp = ['testnet', 'testnet4', 'signet'].includes(network) ? 'tb' : 'bc';
  const version = 1;
  const words = [version].concat(toWords(pubkeyHashArray));
  const bech32Address = bech32Encode(hrp, words, 0x2bc830a3);
  return bech32Address;
}

function p2a(network: string): string {
  const pubkeyHashArray = hexStringToUint8Array('4e73');
  const hrp = ['testnet', 'testnet4', 'signet'].includes(network) ? 'tb' : 'bc';
  const version = 1;
  const words = [version].concat(toWords(pubkeyHashArray));
  const bech32Address = bech32Encode(hrp, words, 0x2bc830a3);
  return bech32Address;
}

// base58 encoding
function base58Encode(data: Uint8Array): string {
  const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  let hexString = Array.from(data)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  
  let num = BigInt("0x" + hexString);

  let encoded = "";
  while (num > 0) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }

  for (let byte of data) {
    if (byte === 0) {
      encoded = "1" + encoded;
    } else {
      break;
    }
  }

  return encoded;
}

// bech32 encoding
// Adapted from https://github.com/bitcoinjs/bech32/blob/5ceb0e3d4625561a459c85643ca6947739b2d83c/src/index.ts
function bech32Encode(prefix: string, words: number[], constant: number = 1) {
  const BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

  const checksum = createChecksum(prefix, words, constant);
  const combined = words.concat(checksum);
  let result = prefix + '1';
  for (let i = 0; i < combined.length; ++i) {
    result += BECH32_ALPHABET.charAt(combined[i]);
  }
  return result;
}

function polymodStep(pre) {
  const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  const b = pre >> 25;
  return (
    ((pre & 0x1ffffff) << 5) ^
    ((b & 1 ? GENERATORS[0] : 0) ^
      (b & 2 ? GENERATORS[1] : 0) ^
      (b & 4 ? GENERATORS[2] : 0) ^
      (b & 8 ? GENERATORS[3] : 0) ^
      (b & 16 ? GENERATORS[4] : 0))
  );
}

function prefixChk(prefix) {
  let chk = 1;
  for (let i = 0; i < prefix.length; ++i) {
    const c = prefix.charCodeAt(i);
    chk = polymodStep(chk) ^ (c >> 5);
  }
  chk = polymodStep(chk);
  for (let i = 0; i < prefix.length; ++i) {
    const c = prefix.charCodeAt(i);
    chk = polymodStep(chk) ^ (c & 0x1f);
  }
  return chk;
}

function createChecksum(prefix: string, words: number[], constant: number) {
  const POLYMOD_CONST = constant;
  let chk = prefixChk(prefix);
  for (let i = 0; i < words.length; ++i) {
    const x = words[i];
    chk = polymodStep(chk) ^ x;
  }
  for (let i = 0; i < 6; ++i) {
    chk = polymodStep(chk);
  }
  chk ^= POLYMOD_CONST;

  const checksum = [];
  for (let i = 0; i < 6; ++i) {
    checksum.push((chk >> (5 * (5 - i))) & 31);
  }
  return checksum;
}

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxV = (1 << toBits) - 1;

  for (let i = 0; i < data.length; ++i) {
    const value = data[i];
    if (value < 0 || value >> fromBits) throw new Error('Invalid value');
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxV);
    }
  }
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxV);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxV)) {
    throw new Error('Invalid data');
  }
  return ret;
}

function toWords(bytes) {
  return convertBits(bytes, 8, 5, true);
}

// Helper functions
export function uint8ArrayToHexString(uint8Array: Uint8Array): string {
  return Array.from(uint8Array).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function hexStringToUint8Array(hex: string): Uint8Array {
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return buf;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  return new Uint8Array([...binaryString].map(char => char.charCodeAt(0)));
}

function intToBytes(value: number, byteLength: number): number[] {
  const bytes = [];
  for (let i = 0; i < byteLength; i++) {
    bytes.push((value >> (8 * i)) & 0xff);
  }
  return bytes;
}

function bigIntToBytes(value: bigint, byteLength: number): number[] {
  const bytes = [];
  for (let i = 0; i < byteLength; i++) {
    bytes.push(Number((value >> BigInt(8 * i)) & 0xffn));
  }
  return bytes;
}

function varIntToBytes(value: number | bigint): number[] {
  const bytes = [];

  if (typeof value === 'number') {
    if (value < 0xfd) {
      bytes.push(value);
    } else if (value <= 0xffff) {
      bytes.push(0xfd, value & 0xff, (value >> 8) & 0xff);
    } else if (value <= 0xffffffff) {
      bytes.push(0xfe, ...intToBytes(value, 4));
    }
  } else {
    if (value < 0xfdn) {
      bytes.push(Number(value));
    } else if (value <= 0xffffn) {
      bytes.push(0xfd, Number(value & 0xffn), Number((value >> 8n) & 0xffn));
    } else if (value <= 0xffffffffn) {
      bytes.push(0xfe, ...intToBytes(Number(value), 4));
    } else {
      bytes.push(0xff, ...bigIntToBytes(value, 8));
    }
  }

  return bytes;
}

function readInt8(buffer: Uint8Array, offset: number): [number, number] {
  if (offset + 1 > buffer.length) {
    throw new Error('Buffer out of bounds');
  }
  return [buffer[offset], offset + 1];
}

function readInt16(buffer: Uint8Array, offset: number): [number, number] {
  if (offset + 2 > buffer.length) {
    throw new Error('Buffer out of bounds');
  }
  return [buffer[offset] | (buffer[offset + 1] << 8), offset + 2];
}

function readInt32(buffer: Uint8Array, offset: number, unsigned: boolean = false): [number, number] {
  if (offset + 4 > buffer.length) {
    throw new Error('Buffer out of bounds');
  }
  const value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
  return [unsigned ? value >>> 0 : value, offset + 4];
}

function readInt64(buffer: Uint8Array, offset: number): [bigint, number] {
  if (offset + 8 > buffer.length) {
    throw new Error('Buffer out of bounds');
  }
  const low = BigInt(buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24));
  const high = BigInt(buffer[offset + 4] | (buffer[offset + 5] << 8) | (buffer[offset + 6] << 16) | (buffer[offset + 7] << 24));
  return [(high << 32n) | (low & 0xffffffffn), offset + 8];
}

function readVarInt(buffer: Uint8Array, offset: number): [number, number] {
  const [first, newOffset] = readInt8(buffer, offset);

  if (first < 0xfd) {
    return [first, newOffset];
  } else if (first === 0xfd) {
    return readInt16(buffer, newOffset);
  } else if (first === 0xfe) {
    return readInt32(buffer, newOffset, true);
  } else if (first === 0xff) {
    const [bigValue, nextOffset] = readInt64(buffer, newOffset);

    if (bigValue > Number.MAX_SAFE_INTEGER) {
      throw new Error("VarInt exceeds safe integer range");
    }

    const numValue = Number(bigValue);
    return [numValue, nextOffset];
  } else {
    throw new Error("Invalid VarInt prefix");
  }
}

function readSlice(buffer: Uint8Array, offset: number, n: number | bigint): [Uint8Array, number] {
  const length = Number(n);
  if (offset + length > buffer.length) {
    throw new Error('Cannot read slice out of bounds');
  }
  const slice = buffer.slice(offset, offset + length);
  return [slice, offset + length];
}

function readVarSlice(buffer: Uint8Array, offset: number): [Uint8Array, number] {
  const [length, newOffset] = readVarInt(buffer, offset);
  return readSlice(buffer, newOffset, length);
}

function readVector(buffer: Uint8Array, offset: number): [Uint8Array[], number] {
  const [count, newOffset] = readVarInt(buffer, offset);
  let updatedOffset = newOffset;
  const vector: Uint8Array[] = [];

  for (let i = 0; i < count; i++) {
    const [slice, nextOffset] = readVarSlice(buffer, updatedOffset);
    vector.push(slice);
    updatedOffset = nextOffset;
  }

  return [vector, updatedOffset];
}

// SHA256(SHA256(tag) || SHA256(tag) || dataHex)
export function taggedHash(tag: string, dataHex: string): string {
  const encoder = new TextEncoder();
  const tagHash = hash(encoder.encode(tag));
  return uint8ArrayToHexString(hash(new Uint8Array([...tagHash, ...tagHash, ...hexStringToUint8Array(dataHex)])));
}

export function compactSize(n: number): Uint8Array {
  if (n <= 252) {
    return new Uint8Array([n]);
  } else if (n <= 0xffff) {
    return new Uint8Array([0xfd, n & 0xff, (n >> 8) & 0xff]);
  } else if (n <= 0xffffffff) {
    return new Uint8Array([0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
  } else {
    const buffer = new Uint8Array(9);
    buffer[0] = 0xff;
    let num = BigInt(n);
    for (let i = 1; i <= 8; i++) {
      buffer[i] = Number(num & BigInt(0xff));
      num >>= BigInt(8);
    }
    return buffer;
  }
}

// Inversed the opcodes object from https://github.com/mempool/mempool/blob/14e49126c3ca8416a8d7ad134a95c5e090324d69/backend/src/utils/bitcoin-script.ts#L1
const opcodes = {
  0: 'OP_0',
  76: 'OP_PUSHDATA1',
  77: 'OP_PUSHDATA2',
  78: 'OP_PUSHDATA4',
  79: 'OP_PUSHNUM_NEG1',
  80: 'OP_RESERVED',
  81: 'OP_PUSHNUM_1',
  82: 'OP_PUSHNUM_2',
  83: 'OP_PUSHNUM_3',
  84: 'OP_PUSHNUM_4',
  85: 'OP_PUSHNUM_5',
  86: 'OP_PUSHNUM_6',
  87: 'OP_PUSHNUM_7',
  88: 'OP_PUSHNUM_8',
  89: 'OP_PUSHNUM_9',
  90: 'OP_PUSHNUM_10',
  91: 'OP_PUSHNUM_11',
  92: 'OP_PUSHNUM_12',
  93: 'OP_PUSHNUM_13',
  94: 'OP_PUSHNUM_14',
  95: 'OP_PUSHNUM_15',
  96: 'OP_PUSHNUM_16',
  97: 'OP_NOP',
  98: 'OP_VER',
  99: 'OP_IF',
  100: 'OP_NOTIF',
  101: 'OP_VERIF',
  102: 'OP_VERNOTIF',
  103: 'OP_ELSE',
  104: 'OP_ENDIF',
  105: 'OP_VERIFY',
  106: 'OP_RETURN',
  107: 'OP_TOALTSTACK',
  108: 'OP_FROMALTSTACK',
  109: 'OP_2DROP',
  110: 'OP_2DUP',
  111: 'OP_3DUP',
  112: 'OP_2OVER',
  113: 'OP_2ROT',
  114: 'OP_2SWAP',
  115: 'OP_IFDUP',
  116: 'OP_DEPTH',
  117: 'OP_DROP',
  118: 'OP_DUP',
  119: 'OP_NIP',
  120: 'OP_OVER',
  121: 'OP_PICK',
  122: 'OP_ROLL',
  123: 'OP_ROT',
  124: 'OP_SWAP',
  125: 'OP_TUCK',
  126: 'OP_CAT',
  127: 'OP_SUBSTR',
  128: 'OP_LEFT',
  129: 'OP_RIGHT',
  130: 'OP_SIZE',
  131: 'OP_INVERT',
  132: 'OP_AND',
  133: 'OP_OR',
  134: 'OP_XOR',
  135: 'OP_EQUAL',
  136: 'OP_EQUALVERIFY',
  137: 'OP_RESERVED1',
  138: 'OP_RESERVED2',
  139: 'OP_1ADD',
  140: 'OP_1SUB',
  141: 'OP_2MUL',
  142: 'OP_2DIV',
  143: 'OP_NEGATE',
  144: 'OP_ABS',
  145: 'OP_NOT',
  146: 'OP_0NOTEQUAL',
  147: 'OP_ADD',
  148: 'OP_SUB',
  149: 'OP_MUL',
  150: 'OP_DIV',
  151: 'OP_MOD',
  152: 'OP_LSHIFT',
  153: 'OP_RSHIFT',
  154: 'OP_BOOLAND',
  155: 'OP_BOOLOR',
  156: 'OP_NUMEQUAL',
  157: 'OP_NUMEQUALVERIFY',
  158: 'OP_NUMNOTEQUAL',
  159: 'OP_LESSTHAN',
  160: 'OP_GREATERTHAN',
  161: 'OP_LESSTHANOREQUAL',
  162: 'OP_GREATERTHANOREQUAL',
  163: 'OP_MIN',
  164: 'OP_MAX',
  165: 'OP_WITHIN',
  166: 'OP_RIPEMD160',
  167: 'OP_SHA1',
  168: 'OP_SHA256',
  169: 'OP_HASH160',
  170: 'OP_HASH256',
  171: 'OP_CODESEPARATOR',
  172: 'OP_CHECKSIG',
  173: 'OP_CHECKSIGVERIFY',
  174: 'OP_CHECKMULTISIG',
  175: 'OP_CHECKMULTISIGVERIFY',
  176: 'OP_NOP1',
  177: 'OP_CHECKLOCKTIMEVERIFY',
  178: 'OP_CHECKSEQUENCEVERIFY',
  179: 'OP_NOP4',
  180: 'OP_NOP5',
  181: 'OP_NOP6',
  182: 'OP_NOP7',
  183: 'OP_NOP8',
  184: 'OP_NOP9',
  185: 'OP_NOP10',
  186: 'OP_CHECKSIGADD',
  253: 'OP_PUBKEYHASH',
  254: 'OP_PUBKEY',
  255: 'OP_INVALIDOPCODE',
};
