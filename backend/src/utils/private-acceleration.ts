import { createHash } from 'crypto';

const HANDLE_PREFIX = 'mempool/private-acceleration/v1';

export type ConfirmedPrivateTransactions = { [handle: string]: string };

export function getPrivateHandle(txid: string): string {
  return createHash('sha256').update(HANDLE_PREFIX + txid.toLowerCase(), 'utf8').digest('hex');
}
