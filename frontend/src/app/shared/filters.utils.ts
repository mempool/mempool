export interface Filter {
  key: string,
  label: string,
  flag: bigint,
  toggle?: string,
  group?: string,
  important?: boolean,
}

// binary flags for transaction classification
export const TransactionFlags = {
  // features
  rbf:                                                         0b00000001n,
  no_rbf:                                                      0b00000010n,
  v1:                                                          0b00000100n,
  v2:                                                          0b00001000n,
  multisig:                                                    0b00010000n,
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
  // data
  op_return:                        0b00000001_00000000_00000000_00000000n,
  fake_pubkey:                      0b00000010_00000000_00000000_00000000n,
  inscription:                      0b00000100_00000000_00000000_00000000n,
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

export const TransactionFilters: { [key: string]: Filter } = {
    /* features */
    rbf: { key: 'rbf', label: 'RBF enabled', flag: TransactionFlags.rbf, toggle: 'rbf', important: true },
    no_rbf: { key: 'no_rbf', label: 'RBF disabled', flag: TransactionFlags.no_rbf, toggle: 'rbf', important: true },
    v1: { key: 'v1', label: 'Version 1', flag: TransactionFlags.v1, toggle: 'version' },
    v2: { key: 'v2', label: 'Version 2', flag: TransactionFlags.v2, toggle: 'version' },
    // multisig: { key: 'multisig', label: 'Multisig', flag: TransactionFlags.multisig },
    /* address types */
    p2pk: { key: 'p2pk', label: 'P2PK', flag: TransactionFlags.p2pk, important: true },
    p2ms: { key: 'p2ms', label: 'Bare multisig', flag: TransactionFlags.p2ms, important: true },
    p2pkh: { key: 'p2pkh', label: 'P2PKH', flag: TransactionFlags.p2pkh, important: true },
    p2sh: { key: 'p2sh', label: 'P2SH', flag: TransactionFlags.p2sh, important: true },
    p2wpkh: { key: 'p2wpkh', label: 'P2WPKH', flag: TransactionFlags.p2wpkh, important: true },
    p2wsh: { key: 'p2wsh', label: 'P2WSH', flag: TransactionFlags.p2wsh, important: true },
    p2tr: { key: 'p2tr', label: 'Taproot', flag: TransactionFlags.p2tr, important: true },
    /* behavior */
    cpfp_parent: { key: 'cpfp_parent', label: 'Paid for by child', flag: TransactionFlags.cpfp_parent, important: true },
    cpfp_child: { key: 'cpfp_child', label: 'Pays for parent', flag: TransactionFlags.cpfp_child, important: true },
    replacement: { key: 'replacement', label: 'Replacement', flag: TransactionFlags.replacement, important: true },
    /* data */
    op_return: { key: 'op_return', label: 'OP_RETURN', flag: TransactionFlags.op_return, important: true },
    fake_pubkey: { key: 'fake_pubkey', label: 'Fake pubkey', flag: TransactionFlags.fake_pubkey },
    inscription: { key: 'inscription', label: 'Inscription', flag: TransactionFlags.inscription, important: true },
    /* heuristics */
    coinjoin: { key: 'coinjoin', label: 'Coinjoin', flag: TransactionFlags.coinjoin, important: true },
    consolidation: { key: 'consolidation', label: 'Consolidation', flag: TransactionFlags.consolidation },
    batch_payout: { key: 'batch_payout', label: 'Batch payment', flag: TransactionFlags.batch_payout },
    /* sighash */
    sighash_all: { key: 'sighash_all', label: 'sighash_all', flag: TransactionFlags.sighash_all },
    sighash_none: { key: 'sighash_none', label: 'sighash_none', flag: TransactionFlags.sighash_none },
    sighash_single: { key: 'sighash_single', label: 'sighash_single', flag: TransactionFlags.sighash_single },
    sighash_default: { key: 'sighash_default', label: 'sighash_default', flag: TransactionFlags.sighash_default },
    sighash_acp: { key: 'sighash_acp', label: 'sighash_anyonecanpay', flag: TransactionFlags.sighash_acp },
};

export const FilterGroups: { label: string, filters: Filter[]}[] = [
  { label: 'Features', filters: ['rbf', 'no_rbf', 'v1', 'v2', 'multisig'] },
  { label: 'Address Types', filters: ['p2pk', 'p2ms', 'p2pkh', 'p2sh', 'p2wpkh', 'p2wsh', 'p2tr'] },
  { label: 'Behavior', filters: ['cpfp_parent', 'cpfp_child', 'replacement'] },
  { label: 'Data', filters: ['op_return', 'fake_pubkey', 'inscription'] },
  { label: 'Heuristics', filters: ['coinjoin', 'consolidation', 'batch_payout'] },
  { label: 'Sighash Flags', filters: ['sighash_all', 'sighash_none', 'sighash_single', 'sighash_default', 'sighash_acp'] },
].map(group => ({ label: group.label, filters: group.filters.map(filter => TransactionFilters[filter] || null).filter(f => f != null) }));