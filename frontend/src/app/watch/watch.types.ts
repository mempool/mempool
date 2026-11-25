export type ScriptType = 'pkh' | 'sh_wpkh' | 'wpkh' | 'tr';

export type WatchNetwork = 'mainnet' | 'testnet' | 'signet';

/** 0 = receive, 1 = change. */
export type Chain = 0 | 1;

export interface DerivedAddress {
  address: string;
  chain: Chain;
  index: number;
  scriptPubKey?: string;
}

export interface WalletUtxo {
  txid: string;
  vout: number;
  value: number;
  address: string;
  confirmed: boolean;
  blockHeight?: number;
}

export interface WalletBalance {
  confirmed: number;
  /** Net effect of unconfirmed transactions; may be negative. */
  pending: number;
  total: number;
}

export interface KeyInfo {
  fingerprint: string;
  fingerprintIsMaster: boolean;
  originPath?: string;
  /** A single-path cosigner's fixed step (KEY/n/*), used on both chains. */
  fixedStep?: number;
}

export interface MultisigInfo {
  threshold: number;
  keys: KeyInfo[];
}

interface WalletDefinitionBase {
  label: string;
  network: WatchNetwork;
}

export interface DescriptorWalletDefinition extends WalletDefinitionBase {
  kind: 'descriptor';
  /** The text the user pasted. */
  source: string;
  /** Normalized multipath descriptor. */
  descriptor: string;
  scriptType: ScriptType | string;
  /**
   * The master fingerprint only when `fingerprintIsMaster` (known from a key origin or a
   * depth-0 key); otherwise the pasted key's own, which will not match the device's.
   */
  fingerprint?: string;
  fingerprintIsMaster: boolean;
  /** From the descriptor's key origin, when it has one. */
  originPath?: string;
  multisig?: MultisigInfo;
  gapLimit: number;
  receiveIndex?: number;
}

/** Stored as receive-chain entries numbered in the order pasted. */
export interface AddressListWalletDefinition extends WalletDefinitionBase {
  kind: 'address-list';
  addresses: DerivedAddress[];
}

export type WalletDefinition = DescriptorWalletDefinition | AddressListWalletDefinition;

interface ScannedWallet {
  id: string;
  derivedCount: Record<Chain, number>;
  addresses: DerivedAddress[];
}

export type DescriptorWallet = DescriptorWalletDefinition & ScannedWallet;
export type AddressListWallet = AddressListWalletDefinition & ScannedWallet;
export type WatchWallet = DescriptorWallet | AddressListWallet;
