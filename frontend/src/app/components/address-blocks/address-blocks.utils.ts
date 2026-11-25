import { Status, Transaction } from '@interfaces/electrs.interface';
import { getAddressActivity } from '@app/shared/address-activity.utils';
import { feeLevels } from '@app/app.constants';

export interface AddressBlockGroup {
  id: string;
  firstTxid: string;
  status: Status;
  count: number;
  net: number | null;
  received: boolean;
  sent: boolean;
  partial: boolean;
  skippedBlocks: number;
  feeRates: number[];
}

/**
 * Groups address transactions (sorted newest first, unconfirmed before confirmed) by block.
 * Liquid can contain multiple assets and confidential values, so its net change is omitted.
 */
export function buildAddressBlockGroups(transactions: Transaction[] | null, addresses: string[], fullyLoaded: boolean, isLiquid: boolean): AddressBlockGroup[] {
  const groups: AddressBlockGroup[] = [];
  let group: AddressBlockGroup;
  for (const tx of transactions ?? []) {
    const id = tx.status.confirmed ? tx.status.block_hash || tx.txid : 'unconfirmed';
    if (group?.id !== id) {
      const previousHeight = group?.status.block_height;
      group = {
        id, firstTxid: tx.txid, status: tx.status, count: 0, net: 0, received: false, sent: false, partial: false, feeRates: [],
        skippedBlocks: Number.isFinite(previousHeight) && Number.isFinite(tx.status.block_height)
          ? Math.max(0, previousHeight - tx.status.block_height - 1) : 0,
      };
      groups.push(group);
    }
    const activity = getAddressActivity(tx, addresses);
    group.count++;
    group.received ||= activity.received;
    group.sent ||= activity.sent;
    if (!tx.status.confirmed) {
      group.feeRates.push(tx.fee / (tx.weight / 4));
    }
    group.net = !isLiquid && group.net !== null && Number.isFinite(activity.value)
      ? group.net + activity.value : null;
  }
  const lastGroup = groups[groups.length - 1];
  if (lastGroup && !fullyLoaded) {
    lastGroup.partial = true;
  }
  return groups;
}

const blockGradientColors: Record<string, [string, string]> = {
  '': ['var(--mainnet-alt)', 'var(--primary)'],
  liquid: ['var(--liquid)', 'var(--testnet-alt)'],
  'liquidtestnet': ['var(--liquidtestnet)', 'var(--liquidtestnet-alt)'],
  testnet: ['var(--testnet)', 'var(--testnet-alt)'],
  testnet4: ['var(--testnet)', 'var(--testnet-alt)'],
  signet: ['var(--signet)', 'var(--signet-alt)'],
  regtest: ['var(--regtest)', 'var(--regtest-alt)'],
};

export function minedBlockBackground(network: string): string {
  const [top, bottom] = blockGradientColors[network] ?? blockGradientColors[''];
  return `linear-gradient(${top}, ${bottom})`;
}

export function pendingBlockBackground(feeRates: number[], mempoolFeeColors: string[]): string {
  const colors = feeRates.slice().sort((a, b) => a - b).map(fee => {
    const nextLevel = feeLevels.findIndex(level => level > fee);
    const index = nextLevel < 0 ? feeLevels.length - 1 : Math.max(0, nextLevel - 1);
    return '#' + mempoolFeeColors[index];
  });
  return colors.length > 1
    ? `linear-gradient(to right, ${colors.join(', ')})`
    : colors[0] ?? 'var(--mempool-block-loading)';
}
