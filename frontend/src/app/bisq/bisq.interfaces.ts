export interface BisqBlocks {
  chainHeight: number;
  blocks: BisqBlock[];
}

export interface BisqBlock {
  height: number;
  time: number;
  hash: string;
  previousBlockHash: string;
  txs: BisqTransaction[];
}

export interface BisqTransaction {
  txVersion: string;
  id: string;
  blockHeight: number;
  blockHash: string;
  time: number;
  inputs: BisqInput[];
  outputs: BisqOutput[];
  txType: string;
  txTypeDisplayString: string;
  burntFee: number;
  invalidatedBsq: number;
  unlockBlockHeight: number;
}

interface BisqInput {
  spendingTxOutputIndex: number;
  spendingTxId: string;
  bsqAmount: number;
  isVerified: boolean;
  address: string;
  time: number;
}

export interface BisqOutput {
  txVersion: string;
  txId: string;
  index: number;
  bsqAmount: number;
  btcAmount: number;
  height: number;
  isVerified: boolean;
  burntFee: number;
  invalidatedBsq: number;
  address: string;
  scriptPubKey: BisqScriptPubKey;
  spentInfo?: SpentInfo;
  time: any;
  txType: string;
  txTypeDisplayString: string;
  txOutputType: string;
  txOutputTypeDisplayString: string;
  lockTime: number;
  isUnspent: boolean;
  opReturn?: string;
}

export interface BisqStats {
  minted: number;
  burnt: number;
  addresses: number;
  unspent_txos: number;
  spent_txos: number;
}

interface BisqScriptPubKey {
  addresses: string[];
  asm: string;
  hex: string;
  reqSigs: number;
  type: string;
}

interface SpentInfo {
  height: number;
  inputIndex: number;
  txId: string;
}

export interface BisqTrade {
  direction: string;
  price: string;
  amount: string;
  volume: string;
  payment_method: string;
  trade_id: string;
  trade_date: number;
  market?: string;
}

export interface Currencies {
  [txid: string]: Currency;
}

export interface Currency {
  code: string;
  name: string;
  precision: number;

  _type: string;
}

export interface Depth {
  [market: string]: Market;
}

interface Market {
  buys: string[];
  sells: string[];
}

export interface HighLowOpenClose {
  period_start: number | string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume_left: string;
  volume_right: string;
  avg: string;
}

export interface Markets {
  [txid: string]: Pair;
}

interface Pair {
  pair: string;
  lname: string;
  rname: string;
  lsymbol: string;
  rsymbol: string;
  lprecision: number;
  rprecision: number;
  ltype: string;
  rtype: string;
  name: string;
}

export interface Offers {
  [market: string]: OffersMarket;
}

export interface OffersMarket {
  buys: Offer[] | null;
  sells: Offer[] | null;
}

export interface OffersData {
  direction: string;
  currencyCode: string;
  minAmount: number;
  amount: number;
  price: number;
  date: number;
  useMarketBasedPrice: boolean;
  marketPriceMargin: number;
  paymentMethod: string;
  id: string;
  currencyPair: string;
  primaryMarketDirection: string;
  priceDisplayString: string;
  primaryMarketAmountDisplayString: string;
  primaryMarketMinAmountDisplayString: string;
  primaryMarketVolumeDisplayString: string;
  primaryMarketMinVolumeDisplayString: string;
  primaryMarketPrice: number;
  primaryMarketAmount: number;
  primaryMarketMinAmount: number;
  primaryMarketVolume: number;
  primaryMarketMinVolume: number;
}

export interface Offer {
  offer_id: string;
  offer_date: number;
  direction: string;
  min_amount: string;
  amount: string;
  price: string;
  volume: string;
  payment_method: string;
  offer_fee_txid: any;
}

export interface Tickers {
  [market: string]: Ticker | null;
}

export interface Ticker {
  last: string;
  high: string;
  low: string;
  volume_left: string;
  volume_right: string;
  buy: string | null;
  sell: string | null;
}

export interface Trade {
  market?: string;
  price: string;
  amount: string;
  volume: string;
  payment_method: string;
  trade_id: string;
  trade_date: number;
  _market: Pair;
}

export interface TradesData {
  currency: string;
  direction: string;
  tradePrice: number;
  tradeAmount: number;
  tradeDate: number;
  paymentMethod: string;
  offerDate: number;
  useMarketBasedPrice: boolean;
  marketPriceMargin: number;
  offerAmount: number;
  offerMinAmount: number;
  offerId: string;
  depositTxId?: string;
  currencyPair: string;
  primaryMarketDirection: string;
  primaryMarketTradePrice: number;
  primaryMarketTradeAmount: number;
  primaryMarketTradeVolume: number;

  _market: string;
  _tradePriceStr: string;
  _tradeAmountStr: string;
  _tradeVolumeStr: string;
  _offerAmountStr: string;
  _tradePrice: number;
  _tradeAmount: number;
  _tradeVolume: number;
  _offerAmount: number;
}

export interface MarketVolume {
  period_start: number;
  num_trades: number;
  volume: string;
}

export interface MarketsApiError {
  success: number;
  error: string;
}

export type Interval = 'minute' | 'half_hour' | 'hour' | 'half_day' | 'day' | 'week' | 'month' | 'year' | 'auto';

export interface SummarizedIntervals {
  [market: string]: SummarizedInterval;
}
export interface SummarizedInterval {
  period_start: number;
  open: number;
  close: number;
  high: number;
  low: number;
  avg: number;
  volume_right: number;
  volume_left: number;
  time?: number;
}
