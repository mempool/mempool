import { TransactionFlags } from '@app/shared/filters.utils';
import { getVarIntLength, opcodes, parseMultisigScript, isPoint } from '@app/shared/script.utils';
import { Transaction } from '@interfaces/electrs.interface';
import { CpfpInfo, RbfInfo, TransactionStripped } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';

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
      case 'anchor': flags |= TransactionFlags.p2a; break;
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
      case 'anchor': flags |= TransactionFlags.p2a; break;
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
