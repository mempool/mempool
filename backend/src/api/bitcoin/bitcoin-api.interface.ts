export namespace IBitcoinApi {
  export interface MempoolInfo {
    loaded: boolean; //  (boolean) True if the mempool is fully loaded
    size: number; //  (numeric) Current tx count
    bytes: number; //  (numeric) Sum of all virtual transaction sizes as defined in BIP 141.
    usage: number; //  (numeric) Total memory usage for the mempool
    maxmempool: number; //  (numeric) Maximum memory usage for the mempool
    mempoolminfee: number; //  (numeric) Minimum fee rate in BTC/kB for tx to be accepted.
    minrelaytxfee: number; //  (numeric) Current minimum relay fee for transactions
  }

  export interface RawMempool {
    [txId: string]: MempoolEntry;
  }

  export interface MempoolEntry {
    vsize: number; //  (numeric) virtual transaction size as defined in BIP 141.
    weight: number; //  (numeric) transaction weight as defined in BIP 141.
    time: number; //  (numeric) local time transaction entered pool in seconds since 1 Jan 1970 GMT
    height: number; //  (numeric) block height when transaction entered pool
    descendantcount: number; //  (numeric) number of in-mempool descendant transactions (including this one)
    descendantsize: number; //  (numeric) virtual transaction size of in-mempool descendants (including this one)
    ancestorcount: number; //  (numeric) number of in-mempool ancestor transactions (including this one)
    ancestorsize: number; //  (numeric) virtual transaction size of in-mempool ancestors (including this one)
    wtxid: string; //  (string) hash of serialized transactionumber; including witness data
    fees: {
      base: number; //  (numeric) transaction fee in BTC
      modified: number; //  (numeric) transaction fee with fee deltas used for mining priority in BTC
      ancestor: number; //  (numeric) modified fees (see above) of in-mempool ancestors (including this one) in BTC
      descendant: number; //  (numeric) modified fees (see above) of in-mempool descendants (including this one) in BTC
    };
    depends: string[]; //  (string) parent transaction id
    spentby: string[]; //  (array) unconfirmed transactions spending outputs from this transaction
    'bip125-replaceable': boolean; //  (boolean) Whether this transaction could be replaced due to BIP125 (replace-by-fee)
  }

  export interface Block {
    hash: string; //  (string) the block hash (same as provided)
    confirmations: number; //  (numeric) The number of confirmations, or -1 if the block is not on the main chain
    size: number; //  (numeric) The block size
    strippedsize: number; //  (numeric) The block size excluding witness data
    weight: number; //  (numeric) The block weight as defined in BIP 141
    height: number; //  (numeric) The block height or index
    version: number; //  (numeric) The block version
    versionHex: string; //  (string) The block version formatted in hexadecimal
    merkleroot: string; //  (string) The merkle root
    tx: Transaction[];
    time: number; //  (numeric) The block time expressed in UNIX epoch time
    mediantime: number; //  (numeric) The median block time expressed in UNIX epoch time
    nonce: number; //  (numeric) The nonce
    bits: string; //  (string) The bits
    difficulty: number; //  (numeric) The difficulty
    chainwork: string; //  (string) Expected number of hashes required to produce the chain up to this block (in hex)
    nTx: number; //  (numeric) The number of transactions in the block
    previousblockhash: string; //  (string) The hash of the previous block
    nextblockhash: string; //  (string) The hash of the next block
  }

  export interface Transaction {
    in_active_chain: boolean; //  (boolean) Whether specified block is in the active chain or not
    hex: string; //  (string) The serialized, hex-encoded data for 'txid'
    txid: string; //  (string) The transaction id (same as provided)
    hash: string; //  (string) The transaction hash (differs from txid for witness transactions)
    size: number; //  (numeric) The serialized transaction size
    vsize: number; //  (numeric) The virtual transaction size (differs from size for witness transactions)
    weight: number; //  (numeric) The transaction's weight (between vsize*4-3 and vsize*4)
    version: number; //  (numeric) The version
    locktime: number; //  (numeric) The lock time
    vin: Vin[];
    vout: Vout[];
    blockhash: string; //  (string) the block hash
    confirmations: number; //  (numeric) The confirmations
    blocktime: number; //  (numeric) The block time expressed in UNIX epoch time
    time: number; //  (numeric) Same as blocktime
  }

  interface Vin {
    txid?: string; //  (string) The transaction id
    vout?: number; //  (string)
    scriptSig?: {
      //  (json object) The script
      asm: string; //  (string) asm
      hex: string; //  (string) hex
    };
    sequence: number; //  (numeric) The script sequence number
    txinwitness?: string[]; //  (string) hex-encoded witness data
    coinbase?: string;
  }

  interface Vout {
    value: number; //  (numeric) The value in BTC
    n: number; //  (numeric) index
    scriptPubKey: {
      //  (json object)
      asm: string; //  (string) the asm
      hex: string; //  (string) the hex
      reqSigs: number; //  (numeric) The required sigs
      type: string; //  (string) The type, eg 'pubkeyhash'
      addresses: string[]; //  (string) bitcoin address
    };
  }

  export interface AddressInformation {
    isvalid: boolean; //  (boolean) If the address is valid or not. If not, this is the only property returned.
    address: string; //  (string) The bitcoin address validated
    scriptPubKey: string; //  (string) The hex-encoded scriptPubKey generated by the address
    isscript: boolean; //  (boolean) If the key is a script
    iswitness: boolean; //  (boolean) If the address is a witness
    witness_version?: boolean; //  (numeric, optional) The version number of the witness program
    witness_program: string; //  (string, optional) The hex value of the witness program
  }

  export interface ChainTips {
    height: number; //  (numeric) height of the chain tip
    hash: string; //  (string) block hash of the tip
    branchlen: number; //  (numeric) zero for main chain, otherwise length of branch connecting the tip to the main chain
    status: 'invalid' | 'headers-only' | 'valid-headers' | 'valid-fork' | 'active';
  }
}
