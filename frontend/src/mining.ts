/**
 * Mining Types Definition
 * Version: 4.0.0
 * Last updated: 2025-02-05
 * @josef edwards and @interchain.io
 */

export interface MiningRequest {
  blockData: string;
  difficulty?: number;
  timestamp?: number;
  nonce?: number;
  worker?: string;
  extraData?: string;
}

export interface MiningResponse {
  success: boolean;
  hash?: string;
  nonce?: number;
  timestamp?: string;
  error?: string;
  difficulty?: number;
  worker?: string;
}

export interface AIPoWRResult {
  hash: string;
  nonce: number;
  timestamp: number;
  difficulty: number;
  elapsed: number;
}

export interface StratumJob {
  jobId: string;
  prevHash: string;
  coinbase1: string;
  coinbase2: string;
  merkleRoot: string;
  version: string;
  nbits: string;
  ntime: string;
  cleanJobs: boolean;
  target?: string;
  extraNonce1?: string;
  extraNonce2Size?: number;
}

export interface StratumSubmit {
  workerId: string;
  jobId: string;
  extraNonce2: string;
  nTime: string;
  nonce: string;
  aiPowrProof?: string;
}

export interface StratumClient {
  id: string;
  socket: any;
  subscribed: boolean;
  authorized: boolean;
  difficulty: number;
  extraNonce1: string;
}
