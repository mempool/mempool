export interface PrivateAccelerationEstimate {
  txSummary: {
    txid: string;
    effectiveVsize: number;
    effectiveFee: number;
    ancestorCount: number;
  };
  handle: string;
  targetFeeRate: number;
  nextBlockFee: number;
  cost: number;
  mempoolBaseFee: number;
  vsizeFee: number;
  userBalance: number;
  pools: number[];
  options: { fee: number }[];
  isProUser: boolean;
  availablePaymentMethods: { [method: string]: { min: number, max: number } };
  unavailable?: boolean;
}

export interface PrivateAccelerationInvoice {
  btcpayInvoiceId: string;
  btcDue: number;
  addresses: { [type: string]: string };
  expirationTime: number;
}
