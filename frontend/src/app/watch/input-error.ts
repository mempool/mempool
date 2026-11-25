// A code, not a message, keeps $localize out of the parsers; describeInputError() words it.
export type InputErrorCode =
  | 'private-key'
  | 'unrecognized-input'
  | 'key-network'
  | 'descriptor-key-network'
  | 'descriptor-network'
  | 'xpub-prefix'
  | 'xpub-length'
  | 'xpub-checksum'
  | 'xpub-version'
  | 'xpub-multisig-key'
  | 'descriptor-character'
  | 'descriptor-checksum'
  | 'address-other-network'
  | 'address-invalid'
  | 'address-list-empty'
  | 'address-list-too-long'
  // Raised by descriptor.ts.
  | 'descriptor-step-invalid'
  | 'descriptor-step-range'
  | 'descriptor-hardened-step'
  | 'descriptor-origin-unclosed'
  | 'descriptor-origin-fingerprint'
  | 'descriptor-fixed-key'
  | 'descriptor-key-type'
  | 'descriptor-key-invalid'
  | 'descriptor-key-unranged'
  | 'descriptor-wildcard'
  | 'descriptor-multipath-count'
  | 'descriptor-multipath-invalid'
  | 'descriptor-multipath-values'
  | 'descriptor-path-steps'
  | 'descriptor-whitespace'
  | 'descriptor-checksum-present'
  | 'descriptor-unrecognized'
  | 'descriptor-taproot-script'
  | 'descriptor-sh-inner'
  | 'descriptor-wsh-inner'
  | 'descriptor-multisig-keys'
  | 'descriptor-multisig-threshold'
  | 'descriptor-multisig-duplicate'
  | 'descriptor-multipath-mixed'
  | 'descriptor-function'
  | 'descriptor-no-multipath'
  | 'descriptor-chain'
  | 'descriptor-index'
  | 'derivation-no-public-key'
  | 'derivation-no-address';

export type InputErrorParams = Record<string, string | number>;

export class InputError extends Error {
  constructor(readonly code: InputErrorCode, readonly params: InputErrorParams = {}) {
    super(code);
  }
}
