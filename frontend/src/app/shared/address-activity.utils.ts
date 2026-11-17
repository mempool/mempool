import { Transaction, Vout } from '@interfaces/electrs.interface';

export interface AddressActivity {
  key: string;
  value: number;
  sent: boolean;
  received: boolean;
}

// Addresses of 66 or 130 hex characters are P2PK public keys.
function isAddressOutput(output: Vout | null | undefined, address: string): boolean {
  if (!output) {
    return false;
  }
  switch (address.length) {
    case 130: return output.scriptpubkey === '41' + address + 'ac';
    case 66: return output.scriptpubkey === '21' + address + 'ac';
    default: return output.scriptpubkey_address === address;
  }
}

/**
 * Scans a transaction's inputs and outputs once for the given addresses and caches the result
 * on the transaction, so the transaction list and the address block groups share a single scan.
 */
export function getAddressActivity(tx: Transaction, addresses: string[]): AddressActivity {
  const key = addresses.join(',');
  const cached: AddressActivity = tx['_addressActivity'];
  if (cached?.key === key) {
    return cached;
  }
  const activity: AddressActivity = { key, value: 0, sent: false, received: false };
  for (const output of tx.vout) {
    if (addresses.some(address => isAddressOutput(output, address))) {
      activity.value += output.value;
      activity.received = true;
    }
  }
  for (const input of tx.vin) {
    if (addresses.some(address => isAddressOutput(input.prevout, address))) {
      activity.value -= input.prevout.value;
      activity.sent = true;
    }
  }
  tx['_addressActivity'] = activity;
  return activity;
}
