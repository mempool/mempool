import { ILightningApi } from '../lightning-api.interface';
import FundingTxFetcher from '../../../tasks/lightning/sync-tasks/funding-tx-fetcher';
import logger from '../../../logger';
import { Common } from '../../common';

/**
 * Convert a clightning "listnode" entry to a lnd node entry
 */
export function convertNode(clNode: any): ILightningApi.Node {
  return {
    alias: clNode.alias ?? '',
    color: `#${clNode.color ?? ''}`,
    features: [], // TODO parse and return clNode.feature
    pub_key: clNode.nodeid,
    addresses: clNode.addresses?.map((addr) => {
      let address = addr.address;
      if (addr.type === 'ipv6') {
        address = `[${address}]`;
      }
      return {
        network: addr.type,
        addr: `${address}:${addr.port}`
      };
    }) ?? [],
    last_update: clNode?.last_timestamp ?? 0,
  };
}

/**
 * Convert clightning "listchannels" response to lnd "describegraph.edges" format
 */
export async function convertAndmergeBidirectionalChannels(clChannels: any[]): Promise<ILightningApi.Channel[]> {
  logger.info('Converting clightning nodes and channels to lnd graph format');

  let loggerTimer = new Date().getTime() / 1000;
  let channelProcessed = 0;

  const consolidatedChannelList: ILightningApi.Channel[] = [];
  const clChannelsDict = {};
  const clChannelsDictCount = {};

  for (const clChannel of clChannels) {
    if (!clChannelsDict[clChannel.short_channel_id]) {
      clChannelsDict[clChannel.short_channel_id] = clChannel;
      clChannelsDictCount[clChannel.short_channel_id] = 1;
    } else {
      consolidatedChannelList.push(
        await buildFullChannel(clChannel, clChannelsDict[clChannel.short_channel_id])
      );
      delete clChannelsDict[clChannel.short_channel_id];
      clChannelsDictCount[clChannel.short_channel_id]++;
    }

    const elapsedSeconds = Math.round((new Date().getTime() / 1000) - loggerTimer);
    if (elapsedSeconds > 10) {
      logger.info(`Building complete channels from clightning output. Channels processed: ${channelProcessed + 1} of ${clChannels.length}`);
      loggerTimer = new Date().getTime() / 1000;
    }

    ++channelProcessed;
  }

  channelProcessed = 0;
  const keys = Object.keys(clChannelsDict);
  for (const short_channel_id of keys) {
    consolidatedChannelList.push(await buildIncompleteChannel(clChannelsDict[short_channel_id]));

    const elapsedSeconds = Math.round((new Date().getTime() / 1000) - loggerTimer);
    if (elapsedSeconds > 10) {
      logger.info(`Building partial channels from clightning output. Channels processed: ${channelProcessed + 1} of ${keys.length}`);
      loggerTimer = new Date().getTime() / 1000;
    }
  }

  return consolidatedChannelList;
}

/**
 * Convert two clightning "getchannels" entries into a full a lnd "describegraph.edges" format
 * In this case, clightning knows the channel policy for both nodes
 */
async function buildFullChannel(clChannelA: any, clChannelB: any): Promise<ILightningApi.Channel> {
  const lastUpdate = Math.max(clChannelA.last_update ?? 0, clChannelB.last_update ?? 0);

  const tx = await FundingTxFetcher.$fetchChannelOpenTx(clChannelA.short_channel_id);
  const parts = clChannelA.short_channel_id.split('x');
  const outputIdx = parts[2];

  return {
    channel_id: Common.channelShortIdToIntegerId(clChannelA.short_channel_id),
    capacity: clChannelA.satoshis,
    last_update: lastUpdate,
    node1_policy: convertPolicy(clChannelA),
    node2_policy: convertPolicy(clChannelB),
    chan_point: `${tx.txid}:${outputIdx}`,
    node1_pub: clChannelA.source,
    node2_pub: clChannelB.source,
  };
}

/**
 * Convert one clightning "getchannels" entry into a full a lnd "describegraph.edges" format
 * In this case, clightning knows the channel policy of only one node
 */
async function buildIncompleteChannel(clChannel: any): Promise<ILightningApi.Channel> {
  const tx = await FundingTxFetcher.$fetchChannelOpenTx(clChannel.short_channel_id);
  const parts = clChannel.short_channel_id.split('x');
  const outputIdx = parts[2];

  return {
    channel_id: Common.channelShortIdToIntegerId(clChannel.short_channel_id),
    capacity: clChannel.satoshis,
    last_update: clChannel.last_update ?? 0,
    node1_policy: convertPolicy(clChannel),
    node2_policy: null,
    chan_point: `${tx.txid}:${outputIdx}`,
    node1_pub: clChannel.source,
    node2_pub: clChannel.destination,
  };
}

/**
 * Convert a clightning "listnode" response to a lnd channel policy format
 */
function convertPolicy(clChannel: any): ILightningApi.RoutingPolicy {
  return {
    time_lock_delta: clChannel.delay,
    min_htlc: clChannel.htlc_minimum_msat.slice(0, -4),
    max_htlc_msat: clChannel.htlc_maximum_msat.slice(0, -4),
    fee_base_msat: clChannel.base_fee_millisatoshi,
    fee_rate_milli_msat: clChannel.fee_per_millionth,
    disabled: !clChannel.active,
    last_update: clChannel.last_update ?? 0,
  };
}
