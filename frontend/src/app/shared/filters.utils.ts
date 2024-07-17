export interface Filter {
  key: string,
  label: string,
  flag: bigint,
  toggle?: string,
  group?: string,
  important?: boolean,
  tooltip?: boolean,
  txPage?: boolean,
}

export type FilterMode = 'and' | 'or';

export type GradientMode = 'fee' | 'age';

export interface ActiveFilter {
  mode: FilterMode,
  filters: string[],
  gradient: GradientMode,
}

// binary flags for transaction classification
export const TransactionFlags = {
  // features
  rbf:                                                         0b00000001n,
  no_rbf:                                                      0b00000010n,
  v1:                                                          0b00000100n,
  v2:                                                          0b00001000n,
  v3:                                                          0b00010000n,
  nonstandard:                                                 0b00100000n,
  // address types
  p2pk:                                               0b00000001_00000000n,
  p2ms:                                               0b00000010_00000000n,
  p2pkh:                                              0b00000100_00000000n,
  p2sh:                                               0b00001000_00000000n,
  p2wpkh:                                             0b00010000_00000000n,
  p2wsh:                                              0b00100000_00000000n,
  p2tr:                                               0b01000000_00000000n,
  // behavior
  cpfp_parent:                               0b00000001_00000000_00000000n,
  cpfp_child:                                0b00000010_00000000_00000000n,
  replacement:                               0b00000100_00000000_00000000n,
  acceleration:                              0b00001000_00000000_00000000n,
  // data
  op_return:                        0b00000001_00000000_00000000_00000000n,
  fake_pubkey:                      0b00000010_00000000_00000000_00000000n,
  inscription:                      0b00000100_00000000_00000000_00000000n,
  fake_scripthash:                  0b00001000_00000000_00000000_00000000n,
  // heuristics
  coinjoin:                0b00000001_00000000_00000000_00000000_00000000n,
  consolidation:           0b00000010_00000000_00000000_00000000_00000000n,
  batch_payout:            0b00000100_00000000_00000000_00000000_00000000n,
  // sighash
  sighash_all:    0b00000001_00000000_00000000_00000000_00000000_00000000n,
  sighash_none:   0b00000010_00000000_00000000_00000000_00000000_00000000n,
  sighash_single: 0b00000100_00000000_00000000_00000000_00000000_00000000n,
  sighash_default:0b00001000_00000000_00000000_00000000_00000000_00000000n,
  sighash_acp:    0b00010000_00000000_00000000_00000000_00000000_00000000n,
};

export function toFlags(filters: string[]): bigint {
  let flag = 0n;
  for (const filter of filters) {
    flag |= TransactionFlags[filter];
  }
  return flag;
}

export function toFilters(flags: bigint): Filter[] {
  const filters = [];
  for (const filter of Object.values(TransactionFilters).filter(f => f !== undefined)) {
    if (flags & filter.flag) {
      filters.push(filter);
    }
  }
  return filters;
}

export const TransactionFilters: { [key: string]: Filter } = {
    /* features */
    rbf: { key: 'rbf', label: 'RBF enabled', flag: TransactionFlags.rbf, toggle: 'rbf', important: true, tooltip: true, txPage: false, },
    no_rbf: { key: 'no_rbf', label: 'RBF disabled', flag: TransactionFlags.no_rbf, toggle: 'rbf', important: true, tooltip: true, txPage: false, },
    v1: { key: 'v1', label: 'Version 1', flag: TransactionFlags.v1, toggle: 'version', tooltip: true, txPage: false, },
    v2: { key: 'v2', label: 'Version 2', flag: TransactionFlags.v2, toggle: 'version', tooltip: true, txPage: false, },
    v3: { key: 'v3', label: 'Version 3', flag: TransactionFlags.v3, toggle: 'version', tooltip: true, txPage: false, },
    nonstandard: { key: 'nonstandard', label: 'Non-Standard', flag: TransactionFlags.nonstandard, important: true, tooltip: true, txPage: true, },
    /* address types */
    p2pk: { key: 'p2pk', label: 'P2PK', flag: TransactionFlags.p2pk, important: true, tooltip: true, txPage: true, },
    p2ms: { key: 'p2ms', label: 'Bare multisig', flag: TransactionFlags.p2ms, important: true, tooltip: true, txPage: true, },
    p2pkh: { key: 'p2pkh', label: 'P2PKH', flag: TransactionFlags.p2pkh, important: true, tooltip: false, },
    p2sh: { key: 'p2sh', label: 'P2SH', flag: TransactionFlags.p2sh, important: true, tooltip: false, },
    p2wpkh: { key: 'p2wpkh', label: 'P2WPKH', flag: TransactionFlags.p2wpkh, important: true, tooltip: false, },
    p2wsh: { key: 'p2wsh', label: 'P2WSH', flag: TransactionFlags.p2wsh, important: true, tooltip: false, },
    p2tr: { key: 'p2tr', label: 'Taproot', flag: TransactionFlags.p2tr, important: true, tooltip: false, },
    /* behavior */
    cpfp_parent: { key: 'cpfp_parent', label: 'Paid for by child', flag: TransactionFlags.cpfp_parent, important: true, tooltip: true, txPage: false, },
    cpfp_child: { key: 'cpfp_child', label: 'Pays for parent', flag: TransactionFlags.cpfp_child, important: true, tooltip: true, txPage: false, },
    replacement: { key: 'replacement', label: 'Replacement', flag: TransactionFlags.replacement, important: true, tooltip: true, txPage: false, },
    acceleration: window?.['__env']?.ACCELERATOR ? { key: 'acceleration', label: $localize`:@@b484583f0ce10f3341ab36750d05271d9d22c9a1:Accelerated`, flag: TransactionFlags.acceleration, important: false } : undefined,
    /* data */
    op_return: { key: 'op_return', label: 'OP_RETURN', flag: TransactionFlags.op_return, important: true, tooltip: true, txPage: true, },
    fake_pubkey: { key: 'fake_pubkey', label: 'Fake pubkey', flag: TransactionFlags.fake_pubkey, tooltip: true, txPage: true, },
    inscription: { key: 'inscription', label: 'Inscription', flag: TransactionFlags.inscription, important: true, tooltip: true, txPage: true, },
    fake_scripthash: { key: 'fake_scripthash', label: 'Fake scripthash', flag: TransactionFlags.fake_scripthash, tooltip: true, txPage: true,},
    /* heuristics */
    coinjoin: { key: 'coinjoin', label: $localize`Coinjoin`, flag: TransactionFlags.coinjoin, important: true, tooltip: true, txPage: true, },
    consolidation: { key: 'consolidation', label: $localize`Consolidation`, flag: TransactionFlags.consolidation, tooltip: true, txPage: true, },
    batch_payout: { key: 'batch_payout', label: $localize`Batch payment`, flag: TransactionFlags.batch_payout, tooltip: true, txPage: true, },
    /* sighash */
    sighash_all: { key: 'sighash_all', label: 'sighash_all', flag: TransactionFlags.sighash_all },
    sighash_none: { key: 'sighash_none', label: 'sighash_none', flag: TransactionFlags.sighash_none, tooltip: true },
    sighash_single: { key: 'sighash_single', label: 'sighash_single', flag: TransactionFlags.sighash_single, tooltip: true },
    sighash_default: { key: 'sighash_default', label: 'sighash_default', flag: TransactionFlags.sighash_default },
    sighash_acp: { key: 'sighash_acp', label: 'sighash_anyonecanpay', flag: TransactionFlags.sighash_acp, tooltip: true },
};

export const FilterGroups: { label: string, filters: Filter[]}[] = [
  { label: $localize`:@@885666551418fd59011ceb09d5c481095940193b:Features`, filters: ['rbf', 'no_rbf', 'v1', 'v2', 'v3', 'nonstandard'] },
  { label: $localize`Address Types`, filters: ['p2pk', 'p2ms', 'p2pkh', 'p2sh', 'p2wpkh', 'p2wsh', 'p2tr'] },
  { label: $localize`Behavior`, filters: ['cpfp_parent', 'cpfp_child', 'replacement', 'acceleration'] },
  { label: $localize`Data`, filters: ['op_return', 'fake_pubkey', 'fake_scripthash', 'inscription'] },
  { label: $localize`Heuristics`, filters: ['coinjoin', 'consolidation', 'batch_payout'] },
  { label: $localize`Sighash Flags`, filters: ['sighash_all', 'sighash_none', 'sighash_single', 'sighash_default', 'sighash_acp'] },
].map(group => ({ label: group.label, filters: group.filters.map(filter => TransactionFilters[filter] || null).filter(f => f != null) }));