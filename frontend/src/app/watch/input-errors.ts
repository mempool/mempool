import { InputErrorCode, InputErrorParams } from '@app/watch/input-error';

export function describeInputError(code: InputErrorCode, params: InputErrorParams = {}): string {
  const p = params;
  switch (code) {
    case 'private-key':
      return $localize`:@@watch.error.private-key:Private keys are not accepted. Import a public descriptor or xpub.`;
    case 'unrecognized-input':
      return $localize`:@@watch.error.unrecognized-input:Not a recognized output descriptor, address list or extended public key.`;
    case 'key-network':
      return $localize`:@@watch.error.key-network:This is a ${p.keyNetwork}:keyNetwork: key, but you are on ${p.network}:network:. Switch networks, or import the key for this network.`;
    case 'descriptor-key-network':
      return $localize`:@@watch.error.descriptor-key-network:This descriptor contains a ${p.keyNetwork}:keyNetwork: key, but you are on ${p.network}:network:.`;
    case 'descriptor-network':
      return $localize`:@@watch.error.descriptor-network:This descriptor's keys are for a different network than ${p.network}:network:.`;
    case 'xpub-prefix':
      return $localize`:@@watch.error.xpub-prefix:Unrecognized extended key prefix "${p.prefix}:prefix:". Expected one of: ${p.expected}:expected:.`;
    case 'xpub-length':
      return $localize`:@@watch.error.xpub-length:Malformed extended key: unexpected length.`;
    case 'xpub-checksum':
      return $localize`:@@watch.error.xpub-checksum:Invalid extended key: checksum does not match. Check for a typo.`;
    case 'xpub-multisig-key':
      return $localize`:@@watch.error.xpub-multisig-key:A ${p.prefix}:prefix: key is one cosigner of a multisig wallet. Import the wallet's output descriptor instead.`;
    case 'xpub-version':
      return $localize`:@@watch.error.xpub-version:Extended key version bytes do not match its "${p.prefix}:prefix:" prefix.`;
    case 'descriptor-character':
      return $localize`:@@watch.error.descriptor-character:Descriptor contains an unsupported character: ${p.char}:char:`;
    case 'descriptor-checksum':
      return $localize`:@@watch.error.descriptor-checksum:Descriptor checksum is invalid. Check that the descriptor was copied exactly.`;
    case 'address-other-network':
      return $localize`:@@watch.error.address-other-network:Line ${p.line}:line:: ${p.address}:address: is a ${p.addressNetwork}:addressNetwork: address, but you are on ${p.network}:network:.`;
    case 'address-invalid':
      return $localize`:@@watch.error.address-invalid:Line ${p.line}:line:: ${p.address}:address: is not a valid Bitcoin address.`;
    case 'address-list-empty':
      return $localize`:@@watch.error.address-list-empty:Paste at least one address.`;
    case 'address-list-too-long':
      return $localize`:@@watch.error.address-list-too-long:An address list can have at most ${Number(p.max).toLocaleString()}:max: addresses; this one has ${Number(p.count).toLocaleString()}:count:.`;
    case 'descriptor-step-invalid':
      return $localize`:@@watch.error.descriptor-step-invalid:Invalid derivation step "${p.step}:step:".`;
    case 'descriptor-step-range':
      return $localize`:@@watch.error.descriptor-step-range:Derivation step "${p.step}:step:" is out of range.`;
    case 'descriptor-hardened-step':
      return $localize`:@@watch.error.descriptor-hardened-step:Hardened derivation after an extended public key is impossible. Remove the hardened step or use the account xpub.`;
    case 'descriptor-origin-unclosed':
      return $localize`:@@watch.error.descriptor-origin-unclosed:Key origin is missing its closing "]".`;
    case 'descriptor-origin-fingerprint':
      return $localize`:@@watch.error.descriptor-origin-fingerprint:Key origin must start with an 8-character hex fingerprint.`;
    case 'descriptor-fixed-key':
      return $localize`:@@watch.error.descriptor-fixed-key:Fixed public keys are not supported. Use an extended public key ending in /<0;1>/*.`;
    case 'descriptor-key-type':
      return $localize`:@@watch.error.descriptor-key-type:Each key must be an xpub or tpub.`;
    case 'descriptor-key-invalid':
      return $localize`:@@watch.error.descriptor-key-invalid:Invalid extended public key: ${p.reason}:reason:`;
    case 'descriptor-key-unranged':
      return $localize`:@@watch.error.descriptor-key-unranged:Each key must end in /* so the wallet can derive addresses.`;
    case 'descriptor-wildcard':
      return $localize`:@@watch.error.descriptor-wildcard:Only one trailing * is allowed per key.`;
    case 'descriptor-multipath-count':
      return $localize`:@@watch.error.descriptor-multipath-count:Only one multipath element is allowed per key.`;
    case 'descriptor-multipath-invalid':
      return $localize`:@@watch.error.descriptor-multipath-invalid:Invalid multipath element "${p.element}:element:".`;
    case 'descriptor-multipath-values':
      return $localize`:@@watch.error.descriptor-multipath-values:The multipath element must be <0;1> (receive and change), not ${p.element}:element:.`;
    case 'descriptor-path-steps':
      return $localize`:@@watch.error.descriptor-path-steps:Only keys ending in /<0;1>/* are supported, with no derivation steps between the key and <0;1>. A multisig cosigner may instead end in one fixed step, such as /0/*.`;
    case 'descriptor-whitespace':
      return $localize`:@@watch.error.descriptor-whitespace:Descriptors cannot contain spaces or line breaks. Paste the descriptor exactly as your wallet exported it.`;
    case 'descriptor-checksum-present':
      return $localize`:@@watch.error.descriptor-checksum-present:Strip the descriptor checksum before parsing.`;
    case 'descriptor-unrecognized':
      return $localize`:@@watch.error.descriptor-unrecognized:Not a recognized output descriptor.`;
    case 'descriptor-taproot-script':
      return $localize`:@@watch.error.descriptor-taproot-script:Taproot script paths are not supported. Use tr(KEY) for a key-path wallet.`;
    case 'descriptor-sh-inner':
      return $localize`:@@watch.error.descriptor-sh-inner:sh() is supported only around wpkh(), wsh(), multi() or sortedmulti().`;
    case 'descriptor-wsh-inner':
      return $localize`:@@watch.error.descriptor-wsh-inner:Only multi() and sortedmulti() multisig scripts are supported here.`;
    case 'descriptor-multisig-keys':
      return $localize`:@@watch.error.descriptor-multisig-keys:This multisig has ${p.count}:count: keys; at most ${p.max}:max: are supported here.`;
    case 'descriptor-multisig-threshold':
      return $localize`:@@watch.error.descriptor-multisig-threshold:The multisig threshold must be a number from 1 to ${p.count}:count:, not "${p.threshold}:threshold:".`;
    case 'descriptor-multisig-duplicate':
      return $localize`:@@watch.error.descriptor-multisig-duplicate:The same key appears more than once in this multisig.`;
    case 'descriptor-multipath-mixed':
      return $localize`:@@watch.error.descriptor-multipath-mixed:Some keys end in …/0/* and others in …/1/*. Use …/<0;1>/* for the keys that have receive and change paths.`;
    case 'descriptor-function':
      return $localize`:@@watch.error.descriptor-function:"${p.fn}:fn:()" descriptors are not supported. Use pkh, sh(wpkh), wpkh, tr, or multi/sortedmulti inside wsh, sh(wsh) or sh.`;
    case 'descriptor-no-multipath':
      return $localize`:@@watch.error.descriptor-no-multipath:This descriptor has no change path. Use …/<0;1>/* or a plain extended public key.`;
    case 'descriptor-chain':
      return $localize`:@@watch.error.descriptor-chain:Chain ${p.chain}:chain: does not exist in this descriptor.`;
    case 'descriptor-index':
      return $localize`:@@watch.error.descriptor-index:Address index ${p.index}:index: is out of range.`;
    case 'derivation-no-public-key':
      return $localize`:@@watch.error.derivation-no-public-key:Derivation produced no public key.`;
    case 'derivation-no-address':
      return $localize`:@@watch.error.derivation-no-address:Could not encode an address for this script.`;
  }
}
